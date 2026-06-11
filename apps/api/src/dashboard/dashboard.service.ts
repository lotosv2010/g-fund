import { Injectable, Inject, Logger } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { McpService } from '../mcp/mcp.service';
import type { AssetAllocationResponse, FundAssetClassNode, FundAssetDetail } from '@g-fund/types';

type DbType = NodePgDatabase<typeof schema>;

interface McpAssetClassNode {
  categoryCode: string;
  categoryName: string;
  levelType: string;
  amount: number;
  ratio: number;
  color: string;
  children: McpAssetClassNode[];
}

interface McpAssetClassResponse {
  fundAssetClassCategoryInfo: McpAssetClassNode[];
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private assetAllocationCache: { data: AssetAllocationResponse; fetchedAt: number } | null = null;
  private readonly ASSET_ALLOCATION_TTL = 60 * 60 * 1000; // 1 小时

  constructor(
    @Inject(DB) private readonly db: DbType,
    private readonly mcp: McpService,
  ) {}

  async getAssetAllocation(): Promise<AssetAllocationResponse> {
    // 检查缓存
    if (this.assetAllocationCache && Date.now() - this.assetAllocationCache.fetchedAt < this.ASSET_ALLOCATION_TTL) {
      this.logger.debug('Asset allocation cache hit');
      return this.assetAllocationCache.data;
    }

    const positions = await this.db.select().from(schema.positions);
    if (positions.length === 0) {
      return { categoryTree: [], fundDetails: [] };
    }

    const fundCodes = positions.map((p) => p.fundCode);
    const funds = await this.db
      .select()
      .from(schema.funds)
      .where(inArray(schema.funds.code, fundCodes));
    const fundMap = new Map(funds.map((f) => [f.code, f]));

    const holdingList = positions
      .map((p) => ({
        fundCode: p.fundCode,
        amount: parseFloat(p.currentValue ?? '0'),
      }))
      .filter((h) => h.amount > 0);

    if (holdingList.length === 0) {
      return { categoryTree: [], fundDetails: [] };
    }

    // 并行调用：1次聚合树 + N次单基金分类
    const [treeResult, ...fundResults] = await Promise.allSettled([
      this.mcp.callTool('GetFundAssetClassAnalysis', { holdingList }),
      ...holdingList.map((h) =>
        this.mcp.callTool('GetFundAssetClassAnalysis', {
          holdingList: [h],
        }),
      ),
    ]);

    // 解析聚合分类树
    const categoryTree =
      treeResult.status === 'fulfilled'
        ? this.parseCategoryTree(treeResult.value)
        : [];

    // 解析每只基金的分类
    const fundDetails: FundAssetDetail[] = [];
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const result = fundResults[i];
      const fund = fundMap.get(pos.fundCode);
      const detail = this.parseFundDetail(
        pos.fundCode,
        pos.fundName,
        pos.currentValue ?? '0',
        result.status === 'fulfilled' ? result.value : null,
        fund?.assetType ?? null,
      );
      fundDetails.push(detail);
    }

    const response: AssetAllocationResponse = { categoryTree, fundDetails };
    this.assetAllocationCache = { data: response, fetchedAt: Date.now() };
    return response;
  }

  clearCache(): void {
    this.assetAllocationCache = null;
  }

  private parseCategoryTree(result: unknown): FundAssetClassNode[] {
    const text =
      (result as { content?: { type: string; text?: string }[] })?.content?.find(
        (c) => c.type === 'text',
      )?.text ?? '';
    if (!text) return [];

    try {
      const data = JSON.parse(text) as McpAssetClassResponse;
      return (data.fundAssetClassCategoryInfo ?? []).map((node) =>
        this.mapNode(node),
      );
    } catch {
      this.logger.warn('Failed to parse asset class tree');
      return [];
    }
  }

  private mapNode(node: McpAssetClassNode): FundAssetClassNode {
    return {
      categoryCode: node.categoryCode,
      categoryName: node.categoryName,
      levelType: node.levelType as FundAssetClassNode['levelType'],
      amount: node.amount,
      ratio: node.ratio,
      color: node.color,
      children: node.children?.map((c) => this.mapNode(c)) ?? [],
    };
  }

  private parseFundDetail(
    fundCode: string,
    fundName: string,
    currentValue: string,
    result: unknown,
    assetType: string | null,
  ): FundAssetDetail {
    const text =
      (result as { content?: { type: string; text?: string }[] })?.content?.find(
        (c) => c.type === 'text',
      )?.text ?? '';

    let topCategory = '未分类';
    let level1Category = '未分类';
    let level2Category = '未分类';
    let categoryCode = '';

    if (text) {
      try {
        const data = JSON.parse(text) as McpAssetClassResponse;
        const top = data.fundAssetClassCategoryInfo?.[0];
        const level1 = top?.children?.[0];
        const level2 = level1?.children?.[0];

        if (top) topCategory = top.categoryName;
        if (level1) level1Category = level1.categoryName;
        if (level2) {
          level2Category = level2.categoryName;
          categoryCode = level2.categoryCode;
        }
      } catch {
        this.logger.warn(
          `Failed to parse asset class for ${fundCode}, raw text: ${text.slice(0, 200)}`,
        );
      }
    }

    // MCP 未返回有效分类时，用 assetType 降级
    if (topCategory === '未分类' && assetType) {
      const fallback = this.fallbackFromAssetType(assetType, fundName);
      topCategory = fallback.top;
      level1Category = fallback.level1;
      level2Category = fallback.level2;
    }

    return {
      fundCode,
      fundName,
      currentValue,
      topCategory,
      level1Category,
      level2Category,
      categoryCode,
    };
  }

  private fallbackFromAssetType(assetType: string, fundName: string): { top: string; level1: string; level2: string } {
    switch (assetType) {
      case 'bond':
        return { top: '债券固收', level1: '债券', level2: '纯债' };
      case 'money':
        return { top: '货币现金', level1: '货币', level2: '货币现金' };
      case 'qdii':
        return { top: '股票权益', level1: '海外', level2: '海外股票' };
      case 'gold':
        return { top: '另类及其他', level1: '商品', level2: '黄金白银' };
      case 'equity':
      default: {
        // 尝试从基金名称推断 level2
        const nameLevel2 = this.guessLevel2FromName(fundName);
        return { top: '股票权益', level1: 'A股', level2: nameLevel2 };
      }
    }
  }

  private guessLevel2FromName(fundName: string): string {
    const keywords: [string, string][] = [
      ['消费', '消费'],
      ['医药', '医药'],
      ['科技', '科技'],
      ['制造', '制造'],
      ['金融', '金融'],
      ['资源', '资源'],
      ['能源', '能源'],
      ['地产', '地产'],
      ['军工', '军工'],
      ['新能源', '新能源'],
      ['海外', '海外股票'],
      ['黄金', '黄金白银'],
      ['白银', '黄金白银'],
      ['均衡', '大盘均衡'],
    ];
    for (const [kw, cat] of keywords) {
      if (fundName.includes(kw)) return cat;
    }
    return '大盘均衡';
  }
}
