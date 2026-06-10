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

  constructor(
    @Inject(DB) private readonly db: DbType,
    private readonly mcp: McpService,
  ) {}

  async getAssetAllocation(): Promise<AssetAllocationResponse> {
    const positions = await this.db.select().from(schema.positions);
    if (positions.length === 0) {
      return { categoryTree: [], fundDetails: [] };
    }

    const holdingList = positions.map((p) => ({
      fundCode: p.fundCode,
      amount: parseFloat(p.currentValue ?? '0'),
    }));

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
      const detail = this.parseFundDetail(
        pos.fundCode,
        pos.fundName,
        pos.currentValue ?? '0',
        result.status === 'fulfilled' ? result.value : null,
      );
      fundDetails.push(detail);
    }

    return { categoryTree, fundDetails };
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
        this.logger.warn(`Failed to parse asset class for ${fundCode}`);
      }
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
}
