import { Injectable, Inject } from '@nestjs/common';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { McpService } from '../mcp/mcp.service';
import { DB } from '../db/db.module';
import { DcaService } from '../dca/dca.service';
import { StopLossTakeProfitService } from '../stop-loss-take-profit/stop-loss-take-profit.service';
import { RealtimeQuoteService } from '../realtime-quote/realtime-quote.service';
import { RulesService } from '../rules/rules.service';
import { FundsService } from '../funds/funds.service';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { eq } from 'drizzle-orm';

type DbType = NodePgDatabase<typeof schema>;

@Injectable()
export class AgentToolsService {
  private cachedTools: DynamicStructuredTool[] | null = null;
  private cachedMcpToolCount = -1;

  constructor(
    private readonly mcp: McpService,
    @Inject(DB) private readonly db: DbType,
    private readonly dcaService: DcaService,
    private readonly slpService: StopLossTakeProfitService,
    private readonly realtimeQuoteService: RealtimeQuoteService,
    private readonly rulesService: RulesService,
    private readonly fundsService: FundsService,
  ) {}

  getTools(): DynamicStructuredTool[] {
    const mcpCount = this.mcp.getTools().length;
    if (!this.cachedTools || mcpCount !== this.cachedMcpToolCount) {
      this.cachedTools = [...this.mcpTools(), ...this.dbTools(), ...this.domainTools()];
      this.cachedMcpToolCount = mcpCount;
    }
    return this.cachedTools;
  }

  private mcpTools(): DynamicStructuredTool[] {
    return this.mcp.getTools().map((t) => {
      const inputSchema = t.inputSchema ?? { type: 'object', properties: {} };
      const zodSchema = z.fromJSONSchema(inputSchema as Parameters<typeof z.fromJSONSchema>[0]);
      return new DynamicStructuredTool({
        name: t.name,
        description: t.description ?? '',
        schema: zodSchema,
        func: async (input) => {
          const result = await this.mcp.callTool(t.name, input as Record<string, unknown>);
          return result.content
            .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
            .map((c) => c.text)
            .join('\n');
        },
      });
    });
  }

  private dbTools(): DynamicStructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'getPortfolioSummary',
        description: '获取当前持仓概览：基金代码、名称、持仓金额、成本、盈亏',
        schema: z.object({}),
        func: async () => {
          const rows = await this.db.select().from(schema.positions);
          if (rows.length === 0) return '暂无持仓数据';
          return rows
            .map((p) => {
              const cost = parseFloat(p.costAmount ?? '0');
              const current = parseFloat(p.currentValue ?? '0');
              const pnl = (current - cost).toFixed(2);
              const pnlRate = cost > 0 ? (((current - cost) / cost) * 100).toFixed(2) : '0.00';
              return `${p.fundCode} ${p.fundName}: 成本¥${cost}, 现值¥${current}, 盈亏¥${pnl}(${pnlRate}%)`;
            })
            .join('\n');
        },
      }),
      new DynamicStructuredTool({
        name: 'getTransactions',
        description: '获取最近交易记录，可指定基金代码过滤',
        schema: z.object({
          fundCode: z.string().optional().describe('基金代码，不传则返回全部'),
          limit: z.number().optional().default(10).describe('返回条数'),
        }),
        func: async ({ fundCode, limit }) => {
          const base = this.db.select().from(schema.transactions);
          const rows = fundCode
            ? await base.where(eq(schema.transactions.fundCode, fundCode)).limit(limit ?? 10)
            : await base.limit(limit ?? 10);
          if (rows.length === 0) return '暂无交易记录';
          return rows
            .map((r) => `${r.tradeDate} ${r.type === 'buy' ? '买入' : '卖出'} ${r.fundName} ¥${r.amount}`)
            .join('\n');
        },
      }),
    ];
  }

  private domainTools(): DynamicStructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'getDcaPlan',
        description: '获取本期定投计划，含 P0~P4 / T 系数明细、最终金额、是否跳过及原因。仅在双周四返回实际计划，非定投日返回空数组。',
        schema: z.object({}),
        func: async () => {
          const plan = await this.dcaService.calculate();
          if (plan.length === 0) return '今日非定投日，无定投计划';
          return JSON.stringify(plan, null, 2);
        },
      }),

      new DynamicStructuredTool({
        name: 'getStopLossSignals',
        description: '获取当前所有持仓的止盈止损信号，包含四态预警（🔴接近止盈/🟡接近止损/🔵低估/🟢正常）、止盈档位、止损档位、深度套牢 A/B/C 决策、反弹信号。可按基金代码过滤。',
        schema: z.object({
          fundCode: z.string().optional().describe('基金代码，不传则返回全部持仓信号'),
        }),
        func: async ({ fundCode }) => {
          const signals = fundCode
            ? await this.slpService.getSignalsByFund(fundCode)
            : await this.slpService.getSignals();
          if (signals.length === 0) return '暂无止盈止损信号';
          return JSON.stringify(signals, null, 2);
        },
      }),

      new DynamicStructuredTool({
        name: 'getRebalanceSuggestion',
        description: '获取资产再平衡建议：各基金实际持仓占比 vs 目标占比偏差报告，偏差超过 5% 的基金需要调整。',
        schema: z.object({}),
        func: async () => {
          const positions = await this.db.select().from(schema.positions);
          const funds = await this.db.select().from(schema.funds);
          if (positions.length === 0) return '暂无持仓，无法生成再平衡建议';

          const totalCost = positions.reduce((sum, p) => sum + parseFloat(p.costAmount ?? '0'), 0);
          if (totalCost <= 0) return '持仓成本为零，无法计算占比';

          const fundMap = new Map(funds.map((f) => [f.code, f]));
          const deviations: Array<{
            fundCode: string;
            fundName: string;
            actualRatio: number;
            targetRatio: number;
            deviation: number;
            action: string;
          }> = [];

          for (const pos of positions) {
            const fund = fundMap.get(pos.fundCode);
            const targetRatio = fund?.targetRatio ? parseFloat(fund.targetRatio) : 0;
            const cost = parseFloat(pos.costAmount ?? '0');
            const actualRatio = (cost / totalCost) * 100;
            const deviation = actualRatio - targetRatio;

            if (targetRatio > 0) {
              deviations.push({
                fundCode: pos.fundCode,
                fundName: pos.fundName,
                actualRatio: Math.round(actualRatio * 100) / 100,
                targetRatio,
                deviation: Math.round(deviation * 100) / 100,
                action: deviation > 5 ? '超配，建议减仓' : deviation < -5 ? '低配，建议加仓' : '正常',
              });
            }
          }

          const needsRebalance = deviations.filter((d) => Math.abs(d.deviation) > 5);
          if (needsRebalance.length === 0) return '各基金占比正常，无需再平衡';

          return JSON.stringify({
            totalCost,
            deviations: deviations.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation)),
            needsRebalance: needsRebalance.length,
          }, null, 2);
        },
      }),

      new DynamicStructuredTool({
        name: 'getDeepLossDiagnosis',
        description: '获取深度套牢基金（亏损>20%）的 A/B/C 决策上下文：A=补仓、B=观望、C=止损。包含估值分位、观望天数、近期趋势。',
        schema: z.object({}),
        func: async () => {
          const signals = await this.slpService.getSignals();
          const deepLossSignals = signals.filter((s) => s.signalType === 'deep_loss');
          if (deepLossSignals.length === 0) return '当前无深度套牢基金';
          return JSON.stringify(deepLossSignals, null, 2);
        },
      }),

      new DynamicStructuredTool({
        name: 'getRealtimeQuote',
        description: '获取单只基金的实时盘中估值（天天基金数据），包含估算净值、日涨跌幅、最新净值。可批量查询。',
        schema: z.object({
          fundCodes: z.union([z.string(), z.array(z.string())]).describe('基金代码，支持单个或多个'),
        }),
        func: async ({ fundCodes }) => {
          const codes = Array.isArray(fundCodes) ? fundCodes : [fundCodes];
          const quotes = await this.realtimeQuoteService.fetchQuotes(codes);
          if (quotes.length === 0) return '未获取到估值数据';
          return JSON.stringify(quotes, null, 2);
        },
      }),

      new DynamicStructuredTool({
        name: 'getRules',
        description: '获取当前生效的定投规则（DCA）和止盈止损规则（SLP）配置，包含各系数阈值、档位、例外规则等。当需要了解规则细节时调用此工具。',
        schema: z.object({}),
        func: async () => {
          const [dcaRules, slpRules] = await Promise.all([
            this.rulesService.getDcaRules(),
            this.rulesService.getSlpRules(),
          ]);
          return JSON.stringify({ dcaRules, slpRules }, null, 2);
        },
      }),

      new DynamicStructuredTool({
        name: 'getFundStage',
        description: '获取单只基金的生命周期阶段（dca 定投期 / holding 持有期）及进度百分比（持仓/目标）。',
        schema: z.object({
          fundCode: z.string().describe('基金代码'),
        }),
        func: async ({ fundCode }) => {
          const stage = await this.fundsService.computeLifecycleStage(fundCode);
          return JSON.stringify(stage, null, 2);
        },
      }),
    ];
  }
}
