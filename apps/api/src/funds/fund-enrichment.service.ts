import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { McpService } from '../mcp/mcp.service';
import type { AssetType, ValuationLevel } from '@g-fund/types';

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

interface ValuationCacheEntry {
  percentile: number;
  fetchedAt: number;
}

const VALUATION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 小时
const FETCH_TIMEOUT = 5000; // 5 秒超时

@Injectable()
export class FundEnrichmentService {
  private readonly logger = new Logger(FundEnrichmentService.name);
  private readonly valuationCache = new Map<string, ValuationCacheEntry>();

  constructor(
    @Inject(DB) private readonly db: DbType,
    private readonly mcp: McpService,
  ) {}

  /**
   * 异步丰富基金资产类型（fire-and-forget）
   * 从 MCP 获取资产分类，失败时降级为名称关键词猜测
   */
  async enrichAssetType(fundCode: string, fundName: string): Promise<AssetType | null> {
    try {
      // 1. 尝试从 MCP 获取资产分类
      const mcpResult = await this.fetchAssetTypeFromMcp(fundCode);
      if (mcpResult) {
        await this.updateFundAssetType(fundCode, mcpResult);
        this.logger.log(`Asset type enriched from MCP: ${fundCode} -> ${mcpResult}`);
        return mcpResult;
      }

      // 2. MCP 失败，降级为名称关键词猜测
      const guessed = this.guessAssetTypeFromName(fundName);
      await this.updateFundAssetType(fundCode, guessed);
      this.logger.log(`Asset type guessed from name: ${fundCode} -> ${guessed}`);
      return guessed;
    } catch (err) {
      this.logger.warn(`Asset type enrichment failed for ${fundCode}: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * 批量刷新所有指数/权益类基金的估值百分位
   */
  async refreshAllValuations(): Promise<{ total: number; updated: number; failed: number }> {
    const result = { total: 0, updated: 0, failed: 0 };

    try {
      // 只查询指数和权益类基金（这些有可靠的外部估值数据）
      const funds = await this.db
        .select()
        .from(schema.funds)
        .where(inArray(schema.funds.assetType, ['index', 'equity']));

      result.total = funds.length;
      this.logger.log(`Starting valuation refresh for ${funds.length} funds`);

      for (const fund of funds) {
        try {
          const percentile = await this.fetchValuationPercentile(fund.code);
          if (percentile === null) {
            continue; // 无法获取，跳过
          }

          const level = this.deriveValuationLevel(percentile);
          await this.updateFundValuation(fund.code, percentile, level);
          result.updated++;
          this.logger.debug(`Valuation updated: ${fund.code} -> ${percentile}% (${level})`);
        } catch (err) {
          result.failed++;
          this.logger.warn(`Valuation fetch failed for ${fund.code}: ${(err as Error).message}`);
        }
      }

      this.logger.log(`Valuation refresh completed: ${result.updated}/${result.total} updated, ${result.failed} failed`);
    } catch (err) {
      this.logger.error(`Valuation refresh batch failed: ${(err as Error).message}`);
    }

    return result;
  }

  /**
   * 从外部 API 获取单个基金的估值百分位
   * 使用蛋卷基金指数估值 API
   */
  private async fetchValuationPercentile(fundCode: string): Promise<number | null> {
    // 检查缓存
    const cached = this.valuationCache.get(fundCode);
    if (cached && Date.now() - cached.fetchedAt < VALUATION_CACHE_TTL) {
      return cached.percentile;
    }

    try {
      // 蛋卷基金指数估值 API
      const url = `https://danjuanfunds.com/djapi/index_eva/pe/${fundCode}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as {
        data?: {
          pe_percentile?: number;
        };
      };

      const percentile = data?.data?.pe_percentile;
      if (typeof percentile !== 'number' || percentile < 0 || percentile > 100) {
        return null;
      }

      // 缓存结果
      this.valuationCache.set(fundCode, { percentile, fetchedAt: Date.now() });
      return percentile;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        this.logger.warn(`Valuation fetch timeout for ${fundCode}`);
      }
      return null;
    }
  }

  /**
   * 根据估值百分位推导估值水平
   * < 30% -> 低估
   * 30-70% -> 正常
   * > 70% -> 高估
   */
  private deriveValuationLevel(percentile: number): ValuationLevel {
    if (percentile < 30) return 'low';
    if (percentile > 70) return 'high';
    return 'normal';
  }

  /**
   * 从 MCP 获取资产分类并映射到 AssetType
   */
  private async fetchAssetTypeFromMcp(fundCode: string): Promise<AssetType | null> {
    if (!this.mcp.isConnected()) {
      return null;
    }

    try {
      const result = await this.mcp.callTool('GetFundAssetClassAnalysis', {
        holdingList: [{ fundCode, amount: 1 }],
      });

      const text =
        (result as { content?: { type: string; text?: string }[] })?.content?.find(
          (c) => c.type === 'text',
        )?.text ?? '';

      if (!text) return null;

      const data = JSON.parse(text) as McpAssetClassResponse;
      const top = data.fundAssetClassCategoryInfo?.[0];
      const level1 = top?.children?.[0];
      const level2 = level1?.children?.[0];

      if (!top) return null;

      return this.mapCategoryToAssetType(
        top.categoryName ?? '',
        level1?.categoryName ?? '',
        level2?.categoryName ?? '',
        '', // fundName not needed for MCP result
      );
    } catch (err) {
      this.logger.warn(`MCP asset class fetch failed for ${fundCode}: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * 将 MCP 分类映射到 AssetType
   */
  private mapCategoryToAssetType(
    topCategory: string,
    level1: string,
    level2: string,
    _fundName: string,
  ): AssetType {
    // 债券类
    if (topCategory.includes('债券') || topCategory.includes('固收')) {
      return 'bond';
    }

    // 货币类（映射到 bond，最接近的类型）
    if (topCategory.includes('货币') || topCategory.includes('现金')) {
      return 'bond';
    }

    // 另类资产
    if (topCategory.includes('另类') || level2.includes('黄金') || level2.includes('白银')) {
      return 'gold';
    }

    // QDII
    if (level1.includes('海外') || level1.includes('QDII') || level1.includes('全球')) {
      return 'qdii';
    }

    // 指数
    if (level2.includes('指数') || level2.includes('ETF') || level2.includes('被动')) {
      return 'index';
    }

    // 默认权益
    return 'equity';
  }

  /**
   * 根据基金名称关键词猜测资产类型（降级方案）
   * 复用 DashboardService.guessLevel2FromName 的模式
   */
  private guessAssetTypeFromName(fundName: string): AssetType {
    const name = fundName.toLowerCase();

    // 债券类关键词
    if (
      name.includes('债') ||
      name.includes('纯债') ||
      name.includes('信用债') ||
      name.includes('利率债')
    ) {
      return 'bond';
    }

    // 黄金类关键词
    if (name.includes('黄金') || name.includes('白银') || name.includes('贵金属')) {
      return 'gold';
    }

    // QDII 类关键词
    if (
      name.includes('qdii') ||
      name.includes('全球') ||
      name.includes('海外') ||
      name.includes('美国') ||
      name.includes('纳斯达克') ||
      name.includes('标普')
    ) {
      return 'qdii';
    }

    // 指数类关键词
    if (
      name.includes('指数') ||
      name.includes('etf') ||
      name.includes('沪深300') ||
      name.includes('中证500') ||
      name.includes('上证50') ||
      name.includes('创业板') ||
      name.includes('科创')
    ) {
      return 'index';
    }

    // 默认权益
    return 'equity';
  }

  /**
   * 更新基金资产类型
   */
  private async updateFundAssetType(fundCode: string, assetType: AssetType): Promise<void> {
    await this.db
      .update(schema.funds)
      .set({ assetType, updatedAt: new Date() })
      .where(eq(schema.funds.code, fundCode));
  }

  /**
   * 更新基金估值百分位和估值水平
   */
  private async updateFundValuation(
    fundCode: string,
    percentile: number,
    level: ValuationLevel,
  ): Promise<void> {
    await this.db
      .update(schema.funds)
      .set({
        valuationPercentile: String(percentile),
        valuationLevel: level,
        phase: level, // 保持双写同步
        updatedAt: new Date(),
      })
      .where(eq(schema.funds.code, fundCode));
  }
}
