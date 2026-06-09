import { Injectable, Inject } from '@nestjs/common';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { McpService } from '../mcp/mcp.service';
import { DB } from '../db/db.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { eq } from 'drizzle-orm';

type DbType = NodePgDatabase<typeof schema>;

@Injectable()
export class AgentToolsService {
  constructor(
    private readonly mcp: McpService,
    @Inject(DB) private readonly db: DbType,
  ) {}

  getTools(): DynamicStructuredTool[] {
    const mcpTools = this.mcpTools();
    const dbTools = this.dbTools();
    return [...mcpTools, ...dbTools];
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
          const funds = await this.db.select().from(schema.funds);
          if (funds.length === 0) return '暂无持仓数据';
          return funds
            .map((f) => {
              const cost = parseFloat(f.costAmount ?? '0');
              const current = parseFloat(f.currentValue ?? '0');
              const pnl = (current - cost).toFixed(2);
              const pnlRate = cost > 0 ? (((current - cost) / cost) * 100).toFixed(2) : '0.00';
              return `${f.code} ${f.name}: 成本¥${cost}, 现值¥${current}, 盈亏¥${pnl}(${pnlRate}%)`;
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
}
