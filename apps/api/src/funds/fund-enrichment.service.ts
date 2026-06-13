import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { McpService } from '../mcp/mcp.service';
import type { AssetType, ValuationLevel, FundInfoPreview, SyncFundInfoResult } from '@g-fund/types';

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

interface FundInfoCacheEntry {
  info: EastmoneyFundInfo;
  fetchedAt: number;
}

interface EastmoneyFundInfo {
  name: string | null;
  type: string | null;
  riskLevel: number | null;
}

const VALUATION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 小时
const FUND_INFO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 小时
const FETCH_TIMEOUT = 5000; // 5 秒超时
const SYNC_CONCURRENCY = 5;

// 天天基金 FTYPE → 风险等级映射
const FTYPE_TO_RISK: Record<string, number> = {
  '货币型': 1,
  '债券型': 2,
  '债券型-长债': 2,
  '债券型-中短债': 2,
  '债券型-混合债': 2,
  '指数型-固收': 2,
  '混合型-偏债': 2,
  '混合型-灵活': 3,
  '混合型-偏股': 3,
  '混合型-平衡': 3,
  '指数型-股票': 4,
  '指数型-海外股票': 5,
  '股票型': 4,
  'QDII': 5,
  'QDII-纯债': 3,
};

@Injectable()
export class FundEnrichmentService {
  private readonly logger = new Logger(FundEnrichmentService.name);
  private readonly valuationCache = new Map<string, ValuationCacheEntry>();
  private readonly fundInfoCache = new Map<string, FundInfoCacheEntry>();

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
      const funds = await this.db.select().from(schema.funds);
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
   * 从盈米 MCP GetFundDiagnosis 获取单个基金的估值百分位
   * 解析 valuation 文本中的百分比数字，如"低于67%的时期" -> 67
   */
  private async fetchValuationPercentile(fundCode: string): Promise<number | null> {
    const cached = this.valuationCache.get(fundCode);
    if (cached && Date.now() - cached.fetchedAt < VALUATION_CACHE_TTL) {
      return cached.percentile;
    }

    if (!this.mcp.isConnected()) {
      this.logger.debug(`MCP not connected, skipping valuation for ${fundCode}`);
      return null;
    }

    try {
      const result = await this.mcp.callTool('GetFundDiagnosis', { fundNameOrCode: fundCode });
      const text = (result as { content?: { type: string; text?: string }[] })
        ?.content?.find((c) => c.type === 'text')?.text ?? '';
      if (!text) return null;

      const data = JSON.parse(text) as {
        fundSummary?: {
          riskAndOpportunity?: {
            data?: { valuation?: string };
          };
        };
      };

      const valuation = data?.fundSummary?.riskAndOpportunity?.data?.valuation ?? '';
      // 匹配"低于X%"或"高于X%"，X 即为历史百分位
      const match = valuation.match(/(\d+(?:\.\d+)?)%/);
      if (!match) {
        this.logger.debug(`No percentile found in valuation text for ${fundCode}: ${valuation}`);
        return null;
      }

      const percentile = parseFloat(match[1]);
      if (percentile < 0 || percentile > 100) return null;

      this.valuationCache.set(fundCode, { percentile, fetchedAt: Date.now() });
      return percentile;
    } catch (err) {
      this.logger.warn(`Valuation fetch failed for ${fundCode}: ${(err as Error).message}`);
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

  /**
   * 预览基金信息（用于添加基金时自动填充）
   * 不写数据库，仅返回查询结果
   */
  async previewFundInfo(fundCode: string): Promise<FundInfoPreview> {
    const info = await this.fetchFundInfoFromEastmoney(fundCode);
    const assetType = info?.type ? this.mapFtypeToAssetType(info.type) : null;
    return {
      name: info?.name ?? null,
      type: info?.type ?? null,
      riskLevel: info?.riskLevel ?? null,
      assetType,
    };
  }

  /**
   * 批量为所有基金补全缺失字段（type / riskLevel / assetType）
   * 最多 SYNC_CONCURRENCY 并发
   */
  async syncAllFundInfo(): Promise<SyncFundInfoResult> {
    const result: SyncFundInfoResult = { total: 0, updated: 0, skipped: 0, failed: 0 };

    const funds = await this.db.select().from(schema.funds);
    result.total = funds.length;

    this.logger.log(`Sync fund info: ${funds.length} funds to process`);

    for (let i = 0; i < funds.length; i += SYNC_CONCURRENCY) {
      const batch = funds.slice(i, i + SYNC_CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((fund) => this.syncOneFundInfo(fund)),
      );
      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value === true) result.updated++;
        else if (r.status === 'fulfilled' && r.value === false) result.skipped++;
        else if (r.status === 'rejected') result.failed++;
      }
    }

    this.logger.log(`Sync fund info completed: ${result.updated} updated, ${result.failed} failed`);

    result.valuations = await this.refreshAllValuations();
    return result;
  }

  private async syncOneFundInfo(fund: typeof schema.funds.$inferSelect): Promise<boolean> {
    const info = await this.fetchFundInfoFromEastmoney(fund.code);
    if (!info) return false;

    const inferredAssetType = info.type ? this.mapFtypeToAssetType(info.type) : null;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (info.type && info.type !== fund.type) updateData.type = info.type;
    if (info.riskLevel != null && info.riskLevel !== fund.riskLevel) updateData.riskLevel = info.riskLevel;
    if (inferredAssetType && inferredAssetType !== fund.assetType) updateData.assetType = inferredAssetType;

    if (Object.keys(updateData).length === 1) return false; // 只有 updatedAt，无实际更新

    await this.db.update(schema.funds).set(updateData).where(eq(schema.funds.code, fund.code));
    this.logger.debug(`Synced fund info: ${fund.code} -> type=${updateData.type ?? '-'}, riskLevel=${updateData.riskLevel ?? '-'}, assetType=${updateData.assetType ?? '-'}`);
    return true;
  }

  /**
   * 从天天基金搜索接口获取基金基础信息
   */
  private async fetchFundInfoFromEastmoney(fundCode: string): Promise<EastmoneyFundInfo | null> {
    const cached = this.fundInfoCache.get(fundCode);
    if (cached && Date.now() - cached.fetchedAt < FUND_INFO_CACHE_TTL) {
      return cached.info;
    }

    try {
      const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?callback=jQuery&m=1&key=${encodeURIComponent(fundCode)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://fund.eastmoney.com/',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!response.ok) return null;

      const text = await response.text();
      const match = text.match(/jQuery\((.*)\)/s);
      if (!match) return null;

      const data = JSON.parse(match[1]) as {
        ErrCode: number;
        Datas?: { CODE: string; FundBaseInfo?: { SHORTNAME?: string; FTYPE?: string } }[];
      };

      const item = data.Datas?.find((d) => d.CODE === fundCode);
      const base = item?.FundBaseInfo;
      if (!base) return null;

      const ftype = base.FTYPE ?? null;
      const info: EastmoneyFundInfo = {
        name: base.SHORTNAME ?? null,
        type: ftype,
        riskLevel: ftype ? (FTYPE_TO_RISK[ftype] ?? null) : null,
      };

      this.fundInfoCache.set(fundCode, { info, fetchedAt: Date.now() });
      return info;
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        this.logger.warn(`fetchFundInfo failed for ${fundCode}: ${(err as Error).message}`);
      }
      return null;
    }
  }

  /**
   * 将天天基金 FTYPE 映射到 AssetType
   */
  private mapFtypeToAssetType(ftype: string): AssetType {
    if (ftype.startsWith('债券型') || ftype === '指数型-固收' || ftype === '混合型-偏债') return 'bond';
    if (ftype === '货币型') return 'bond';
    if (ftype.startsWith('QDII') || ftype.includes('海外')) return 'qdii';
    if (ftype.startsWith('指数型')) return 'index';
    return 'equity';
  }
}
