import { Injectable, Inject, Logger } from '@nestjs/common';
import { inArray, asc, ne, and, desc, gte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { McpService } from '../mcp/mcp.service';
import { MarketIndexService } from '../market-index/market-index.service';
import type { AssetAllocationResponse, FundAssetClassNode, FundAssetDetail, RebalanceResponse, RebalanceSuggestion, RiskSummaryResponse, BenchmarkComparisonResponse, BenchmarkPoint, AnomalyAlert, AnomalyResponse, IndustryExposureItem, IndustryExposureResponse } from '@g-fund/types';

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
    private readonly marketIndex: MarketIndexService,
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

    // 按 fundCode 映射 MCP 结果（holdingList 可能比 positions 短）
    const resultMap = new Map<string, unknown>();
    for (let i = 0; i < holdingList.length; i++) {
      const result = fundResults[i];
      resultMap.set(
        holdingList[i].fundCode,
        result.status === 'fulfilled' ? result.value : null,
      );
    }

    // 解析每只基金的分类
    const fundDetails: FundAssetDetail[] = [];
    for (const pos of positions) {
      const fund = fundMap.get(pos.fundCode);
      const detail = this.parseFundDetail(
        pos.fundCode,
        pos.fundName,
        pos.currentValue ?? '0',
        resultMap.get(pos.fundCode) ?? null,
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

  async getRebalanceSuggestion(): Promise<RebalanceResponse> {
    const positions = await this.db.select().from(schema.positions);
    if (positions.length === 0) return { totalValue: 0, suggestions: [] };

    const fundCodes = positions.map((p) => p.fundCode);
    const funds = await this.db
      .select()
      .from(schema.funds)
      .where(inArray(schema.funds.code, fundCodes));
    const fundMap = new Map(funds.map((f) => [f.code, f]));

    const totalValue = positions.reduce((sum, p) => sum + parseFloat(p.currentValue ?? '0'), 0);
    if (totalValue <= 0) return { totalValue: 0, suggestions: [] };

    // 只取 targetRatio > 0 的基金
    const eligible = positions.filter((p) => {
      const ratio = parseFloat(fundMap.get(p.fundCode)?.targetRatio ?? '0');
      return ratio > 0;
    });
    if (eligible.length === 0) return { totalValue, suggestions: [] };

    const ratioSum = eligible.reduce(
      (sum, p) => sum + parseFloat(fundMap.get(p.fundCode)!.targetRatio!),
      0,
    );

    const MIN_AMOUNT = 100;

    const suggestions: RebalanceSuggestion[] = [];
    for (const pos of eligible) {
      const fund = fundMap.get(pos.fundCode)!;
      const rawRatio = parseFloat(fund.targetRatio!);
      const normalizedRatio = (rawRatio / ratioSum) * 100;
      const currentValue = parseFloat(pos.currentValue ?? '0');
      const currentRatio = (currentValue / totalValue) * 100;
      const targetValue = (normalizedRatio / 100) * totalValue;
      const diff = targetValue - currentValue;

      if (Math.abs(diff) < MIN_AMOUNT) continue;

      suggestions.push({
        fundCode: pos.fundCode,
        fundName: pos.fundName,
        currentValue,
        targetValue,
        currentRatio,
        targetRatio: normalizedRatio,
        deviation: currentRatio - normalizedRatio,
        action: diff > 0 ? 'buy' : 'sell',
        amount: Math.abs(diff),
      });
    }

    suggestions.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

    return { totalValue, suggestions };
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

  async getRiskSummary(): Promise<RiskSummaryResponse> {
    const rows = await this.db
      .select({
        snapshotDate: schema.dailySnapshots.snapshotDate,
        totalValue: schema.dailySnapshots.totalValue,
      })
      .from(schema.dailySnapshots)
      .orderBy(asc(schema.dailySnapshots.snapshotDate));

    // 过滤掉周末（粗略过滤：只保留交易日，按 snapshotDate 判断）
    const snapshots = rows.filter((r) => {
      const dow = new Date(r.snapshotDate + 'T00:00:00').getDay();
      return dow !== 0 && dow !== 6;
    });

    if (snapshots.length < 2) {
      return { maxDrawdown: 0, annualizedVolatility: 0, currentDrawdown: 0, snapshotDays: snapshots.length };
    }

    const values = snapshots.map((r) => parseFloat(r.totalValue));

    // 最大回撤 & 当前回撤
    let peak = values[0];
    let maxDrawdown = 0;
    for (const v of values) {
      if (v > peak) peak = v;
      const dd = peak > 0 ? (peak - v) / peak : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // 当前回撤（从历史最高点到最新净值）
    const allTimePeak = Math.max(...values);
    const latestValue = values[values.length - 1];
    const currentDrawdown = allTimePeak > 0 ? (allTimePeak - latestValue) / allTimePeak : 0;

    // 年化波动率：日收益率标准差 × √252
    const dailyReturns: number[] = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] > 0) {
        dailyReturns.push((values[i] - values[i - 1]) / values[i - 1]);
      }
    }

    let annualizedVolatility = 0;
    if (dailyReturns.length >= 2) {
      const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
      annualizedVolatility = Math.sqrt(variance) * Math.sqrt(252);
    }

    return {
      maxDrawdown,
      annualizedVolatility,
      currentDrawdown,
      snapshotDays: snapshots.length,
    };
  }

  async getBenchmarkComparison(benchmarkCode = 'sh000300'): Promise<BenchmarkComparisonResponse> {
    const rows = await this.db
      .select({
        snapshotDate: schema.dailySnapshots.snapshotDate,
        totalValue: schema.dailySnapshots.totalValue,
        totalCost: schema.dailySnapshots.totalCost,
      })
      .from(schema.dailySnapshots)
      .orderBy(asc(schema.dailySnapshots.snapshotDate));

    const snapshots = rows.filter((r) => {
      const dow = new Date(r.snapshotDate + 'T00:00:00').getDay();
      return dow !== 0 && dow !== 6;
    });

    if (snapshots.length === 0) {
      return { points: [], benchmarkName: '沪深300', snapshotCount: 0 };
    }

    const startDate = snapshots[0].snapshotDate;
    const endDate = snapshots[snapshots.length - 1].snapshotDate;
    const daysDiff = Math.max(
      Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 5,
      5,
    );

    let indexHistory = await this.marketIndex.fetchHistory(benchmarkCode, daysDiff);

    // 历史表无数据时，用实时行情构造当日基准点
    if (indexHistory.length === 0) {
      const realtimeQuotes = await this.marketIndex.fetchRealtime([{ code: benchmarkCode, name: '沪深300' }]);
      if (realtimeQuotes.length > 0) {
        const q = realtimeQuotes[0];
        indexHistory = [{
          id: 0,
          indexCode: q.indexCode,
          name: q.name,
          close: q.close.toFixed(4),
          changePct: q.changePct.toFixed(4),
          turnover: '0',
          tradeDate: q.tradeDate,
          updatedAt: new Date(),
        }];
      }
    }

    // 按日期建立 Map
    const indexMap = new Map<string, number>();
    for (const h of indexHistory) {
      indexMap.set(h.tradeDate, parseFloat(h.close));
    }

    // 找到最接近 startDate 的基准点：优先找 >= startDate，否则取最近日期
    const sortedDates = [...indexMap.keys()].sort();
    const baseDate =
      sortedDates.find((d) => d >= startDate) ??
      sortedDates.reduceRight<string | undefined>((found, d) => found ?? (d <= startDate ? d : undefined), undefined) ??
      sortedDates[0];
    const baseClose = baseDate ? indexMap.get(baseDate) : undefined;

    if (!baseClose) {
      return { points: [], benchmarkName: '沪深300', snapshotCount: snapshots.length };
    }

    const baseCost = parseFloat(snapshots[0].totalCost);

    // 前向填充：初始值为最接近起始日的基准收盘价
    // 若基准数据晚于快照（如只有今日实时价），也能为所有快照提供基准值
    let lastKnownClose = baseClose;
    const points: BenchmarkPoint[] = [];

    for (const snap of snapshots) {
      const close = indexMap.get(snap.snapshotDate);
      if (close !== undefined) lastKnownClose = close;

      const portfolioValue = parseFloat(snap.totalValue);
      const portfolioCost = parseFloat(snap.totalCost);
      const effectiveCost = portfolioCost > 0 ? portfolioCost : baseCost;

      points.push({
        date: snap.snapshotDate,
        portfolioCumReturn: effectiveCost > 0 ? (portfolioValue - effectiveCost) / effectiveCost : 0,
        benchmarkCumReturn: (lastKnownClose - baseClose) / baseClose,
      });
    }

    return { points, benchmarkName: '沪深300', snapshotCount: snapshots.length };
  }

  async getAnomalies(): Promise<AnomalyResponse> {
    const PRICE_THRESHOLD = 0.03;
    const VALUATION_HIGH = 80;
    const VALUATION_LOW = 20;

    const positions = await this.db
      .select()
      .from(schema.positions)
      .where(ne(schema.positions.shares, '0'));

    if (positions.length === 0) {
      return { alerts: [], checkedAt: new Date().toISOString() };
    }

    const fundCodes = positions.map((p) => p.fundCode);

    const funds = await this.db
      .select()
      .from(schema.funds)
      .where(inArray(schema.funds.code, fundCodes));
    const fundMap = new Map(funds.map((f) => [f.code, f]));

    const navHistory = await this.db
      .select()
      .from(schema.fundNavHistory)
      .where(inArray(schema.fundNavHistory.fundCode, fundCodes))
      .orderBy(desc(schema.fundNavHistory.navDate));

    const latestNavMap = new Map<string, typeof navHistory[0]>();
    for (const nav of navHistory) {
      if (!latestNavMap.has(nav.fundCode)) {
        latestNavMap.set(nav.fundCode, nav);
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySignals = await this.db
      .select()
      .from(schema.slpSignalsLog)
      .where(
        and(
          inArray(schema.slpSignalsLog.fundCode, fundCodes),
          gte(schema.slpSignalsLog.triggeredAt, today),
        ),
      )
      .orderBy(desc(schema.slpSignalsLog.triggeredAt));

    const alerts: AnomalyAlert[] = [];

    for (const position of positions) {
      const fund = fundMap.get(position.fundCode);
      const latestNav = latestNavMap.get(position.fundCode);

      if (latestNav?.dailyReturn) {
        const dailyReturn = parseFloat(latestNav.dailyReturn);
        if (dailyReturn >= PRICE_THRESHOLD) {
          alerts.push({
            fundCode: position.fundCode,
            fundName: position.fundName,
            type: 'price_surge',
            severity: dailyReturn >= 0.05 ? 'danger' : 'warning',
            message: `今日涨幅 ${(dailyReturn * 100).toFixed(2)}%，关注是否止盈`,
            value: dailyReturn,
          });
        } else if (dailyReturn <= -PRICE_THRESHOLD) {
          alerts.push({
            fundCode: position.fundCode,
            fundName: position.fundName,
            type: 'price_drop',
            severity: dailyReturn <= -0.05 ? 'danger' : 'warning',
            message: `今日跌幅 ${(Math.abs(dailyReturn) * 100).toFixed(2)}%，关注是否补仓或止损`,
            value: dailyReturn,
          });
        }
      }

      if (fund?.valuationPercentile) {
        const vp = parseFloat(fund.valuationPercentile);
        if (vp > VALUATION_HIGH) {
          alerts.push({
            fundCode: position.fundCode,
            fundName: position.fundName,
            type: 'valuation_high',
            severity: 'warning',
            message: `估值分位 ${vp.toFixed(0)}%，处于历史高位，建议关注止盈时机`,
            value: vp,
          });
        } else if (vp < VALUATION_LOW) {
          alerts.push({
            fundCode: position.fundCode,
            fundName: position.fundName,
            type: 'valuation_low',
            severity: 'info',
            message: `估值分位 ${vp.toFixed(0)}%，处于历史低位，可关注加仓机会`,
            value: vp,
          });
        }
      }
    }

    const SIGNAL_PRIORITY: Record<string, number> = {
      deep_loss: 0,
      stop_loss: 1,
      take_profit: 2,
      warning: 3,
    };

    // 每只基金只保留优先级最高的一条信号
    const bestSignalPerFund = new Map<string, typeof todaySignals[0]>();
    for (const signal of todaySignals) {
      if (!signal.message) continue;
      const existing = bestSignalPerFund.get(signal.fundCode);
      const curPriority = SIGNAL_PRIORITY[signal.signalType] ?? 9;
      const existPriority = existing ? (SIGNAL_PRIORITY[existing.signalType] ?? 9) : Infinity;
      if (curPriority < existPriority) {
        bestSignalPerFund.set(signal.fundCode, signal);
      }
    }

    for (const signal of bestSignalPerFund.values()) {
      const position = positions.find((p) => p.fundCode === signal.fundCode);
      let anomalyType: AnomalyAlert['type'];
      if (signal.signalType === 'stop_loss' || signal.signalType === 'deep_loss') {
        anomalyType = 'stop_loss';
      } else if (signal.signalType === 'take_profit') {
        anomalyType = 'take_profit';
      } else {
        const pnl = signal.pnlRate ? parseFloat(signal.pnlRate) : 0;
        anomalyType = pnl < 0 ? 'stop_loss' : 'take_profit';
      }
      alerts.push({
        fundCode: signal.fundCode,
        fundName: position?.fundName ?? signal.fundCode,
        type: anomalyType,
        severity: signal.level === 'red' ? 'danger' : signal.level === 'orange' ? 'warning' : 'info',
        message: signal.message ?? '',
        value: signal.pnlRate ? parseFloat(signal.pnlRate) : undefined,
      });
    }

    const severityOrder: Record<string, number> = { danger: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return { alerts, checkedAt: new Date().toISOString() };
  }

  async getIndustryExposure(): Promise<IndustryExposureResponse> {
    const allocation = await this.getAssetAllocation();

    if (allocation.fundDetails.length === 0) {
      return { items: [], totalAmount: 0 };
    }

    const map = new Map<string, number>();
    let totalAmount = 0;

    for (const detail of allocation.fundDetails) {
      const amount = parseFloat(detail.currentValue);
      if (amount <= 0) continue;
      totalAmount += amount;
      const key = detail.level2Category !== '未分类' ? detail.level2Category : (detail.level1Category !== '未分类' ? detail.level1Category : '其他');
      map.set(key, (map.get(key) ?? 0) + amount);
    }

    const items: IndustryExposureItem[] = Array.from(map, ([industry, amount]) => ({
      industry,
      amount: Math.round(amount * 100) / 100,
      ratio: totalAmount > 0 ? Math.round((amount / totalAmount) * 10000) / 10000 : 0,
    })).sort((a, b) => b.amount - a.amount);

    return { items, totalAmount: Math.round(totalAmount * 100) / 100 };
  }
}
