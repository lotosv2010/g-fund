import { Inject, Injectable, Logger } from '@nestjs/common';
import { Observable, Subscriber, firstValueFrom } from 'rxjs';
import { eq, and, gt, asc, lt, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types';
import type { SyncPositionItemResult, SyncPositionsResult, SyncStreamEvent } from '@g-fund/types';
import { DB } from '../db/db.module';
import { McpService } from '../mcp/mcp.service';
import { SettingsService } from '../settings/settings.service';
import { RealtimeQuoteService } from '../realtime-quote/realtime-quote.service';
import { TransactionConfirmationService } from '../transactions/transaction-confirmation.service';
import { DailySnapshotsService } from '../daily-snapshots/daily-snapshots.service';

type DbType = NodePgDatabase<typeof schema>;
type PositionRow = typeof schema.positions.$inferSelect;

export interface NavInfo {
  navUnit: string;
  navDate?: string;
}

const NAV_TOOL_PRIORITY = [
  /fund[_-]?history/i,
  /fund[_-]?nav/i,
  /history[_-]?nav/i,
  /\bnav\b/i,
  /净值/,
];

export function pickNavTool(tools: Tool[]): Tool | null {
  for (const pattern of NAV_TOOL_PRIORITY) {
    const hit = tools.find((t) => pattern.test(t.name) || pattern.test(t.description ?? ''));
    if (hit) return hit;
  }
  return null;
}

const FUND_CODE_KEY_PRIORITY = [
  /^fund[_-]?codes?$/i,
  /^codes?$/i,
  /^symbols?$/i,
  /fund[_-]?codes?/i,
  /codes?/i,
];

export function pickFundCodeArgName(tool: Tool): string {
  const schema = tool.inputSchema as { properties?: Record<string, unknown>; required?: string[] } | undefined;
  const props = schema?.properties ? Object.keys(schema.properties) : [];
  if (props.length === 0) return 'fundCode';
  for (const pattern of FUND_CODE_KEY_PRIORITY) {
    const hit = props.find((p) => pattern.test(p));
    if (hit) return hit;
  }
  return schema?.required?.[0] ?? props[0];
}

export function isArrayArg(tool: Tool, argName: string): boolean {
  const schema = tool.inputSchema as { properties?: Record<string, { type?: string }> } | undefined;
  return schema?.properties?.[argName]?.type === 'array';
}

function extractErrorText(result: CallToolResult): string {
  const text = (result.content ?? [])
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();
  return text || 'MCP 工具返回错误';
}

export function parseNavFromText(text: string): NavInfo | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fromJson = tryParseJsonNav(trimmed);
  if (fromJson) return fromJson;

  return tryParseLooseNav(trimmed);
}

function tryParseJsonNav(text: string): NavInfo | null {
  try {
    const obj = JSON.parse(text);
    return extractNavFromObject(obj);
  } catch {
    return null;
  }
}

function extractNavFromObject(obj: unknown): NavInfo | null {
  if (!obj || typeof obj !== 'object') return null;
  const record = obj as Record<string, unknown>;

  const candidates: unknown[] = [
    record,
    record.data,
    Array.isArray(record.data) ? record.data[0] : undefined,
    record.result,
    Array.isArray(record.list) ? record.list[0] : undefined,
    Array.isArray(record.items) ? record.items[0] : undefined,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const c = candidate as Record<string, unknown>;
    const navUnit = pickNavUnit(c);
    if (!navUnit) continue;
    const navDate = pickNavDate(c);
    return { navUnit, navDate };
  }
  return null;
}

const NAV_UNIT_KEYS = ['navUnit', 'nav_unit', 'unitNav', 'unit_nav', 'nav', 'netValue', 'net_value', 'unitNetValue', 'unit_net_value', '单位净值'];
const NAV_DATE_KEYS = ['navDate', 'nav_date', 'date', 'tradeDate', 'trade_date', '净值日期'];

function pickNavUnit(obj: Record<string, unknown>): string | null {
  for (const key of NAV_UNIT_KEYS) {
    const v = obj[key];
    const num = toNumber(v);
    if (num !== null && num > 0) return num.toFixed(4);
  }
  return null;
}

function pickNavDate(obj: Record<string, unknown>): string | undefined {
  for (const key of NAV_DATE_KEYS) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return null;
  const cleaned = v.replace(/[,\s]/g, '').replace(/%$/, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function tryParseLooseNav(text: string): NavInfo | null {
  const numMatch = text.match(/([0-9]+\.[0-9]{2,6})/);
  if (!numMatch) return null;
  const navUnit = Number(numMatch[1]).toFixed(4);
  const dateMatch = text.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
  return { navUnit, navDate: dateMatch?.[1] };
}

@Injectable()
export class PositionsSyncService {
  private readonly logger = new Logger(PositionsSyncService.name);

  constructor(
    @Inject(DB) private readonly db: DbType,
    private readonly mcp: McpService,
    private readonly settings: SettingsService,
    private readonly realtimeQuote: RealtimeQuoteService,
    private readonly confirmationService: TransactionConfirmationService,
    private readonly dailySnapshots: DailySnapshotsService,
  ) {}

  async fetchNav(fundCode: string): Promise<NavInfo> {
    if (!this.mcp.isConnected()) {
      throw new Error('MCP 未连接');
    }
    const navTool = pickNavTool(this.mcp.getTools());
    if (!navTool) {
      throw new Error('未找到净值工具');
    }
    const codeArgName = pickFundCodeArgName(navTool);
    const codeArgIsArray = isArrayArg(navTool, codeArgName);
    const argValue = codeArgIsArray ? [fundCode] : fundCode;
    const result = await this.mcp.callTool(navTool.name, { [codeArgName]: argValue });
    const text = (result.content ?? [])
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map((c) => c.text)
      .join('\n')
      .trim();
    const nav = parseNavFromText(text);
    if (!nav) {
      throw new Error(`无法解析基金 ${fundCode} 的净值`);
    }
    return nav;
  }

  async syncAll(): Promise<SyncPositionsResult> {
    return firstValueFrom(this.collectDone(this.syncStream()));
  }

  syncStream(): Observable<SyncStreamEvent> {
    return new Observable<SyncStreamEvent>((subscriber) => {
      let cancelled = false;
      this.runStream(subscriber, () => cancelled).catch((err) => {
        if (cancelled) return;
        const message = (err as Error).message;
        this.logger.error(`Sync stream error: ${message}`);
        subscriber.next({ type: 'error', message });
        subscriber.complete();
      });
      return () => {
        cancelled = true;
      };
    });
  }

  private collectDone(source: Observable<SyncStreamEvent>): Observable<SyncPositionsResult> {
    return new Observable<SyncPositionsResult>((subscriber) => {
      const sub = source.subscribe({
        next: (event) => {
          if (event.type === 'done') {
            subscriber.next(event.result);
            subscriber.complete();
          } else if (event.type === 'error') {
            subscriber.error(new Error(event.message));
          }
        },
        error: (err) => subscriber.error(err),
      });
      return () => sub.unsubscribe();
    });
  }

  private async runStream(
    subscriber: Subscriber<SyncStreamEvent>,
    isCancelled: () => boolean,
  ): Promise<void> {
    const positions = await this.db
      .select()
      .from(schema.positions)
      .where(gt(schema.positions.shares, '0'));

    const syncedAt = new Date().toISOString();

    if (positions.length === 0) {
      subscriber.next({
        type: 'done',
        result: { total: 0, succeeded: 0, failed: 0, skipped: 0, syncedAt, items: [] },
      });
      subscriber.complete();
      return;
    }

    if (!this.mcp.isConnected()) {
      const result = this.failAll(positions, 'MCP 未连接', syncedAt);
      this.emitFailAll(subscriber, result, 'mcp');
      return;
    }

    const navTool = pickNavTool(this.mcp.getTools());
    if (!navTool) {
      const result = this.failAll(positions, '未找到净值工具', syncedAt);
      this.emitFailAll(subscriber, result, 'no-tool');
      return;
    }
    const codeArgName = pickFundCodeArgName(navTool);
    const codeArgIsArray = isArrayArg(navTool, codeArgName);
    this.logger.log(
      `Using MCP tool "${navTool.name}" with arg "${codeArgName}" (array=${codeArgIsArray})`,
    );

    subscriber.next({
      type: 'started',
      total: positions.length,
      toolName: navTool.name,
      codeArgName,
    });

    const items: SyncPositionItemResult[] = [];
    for (let i = 0; i < positions.length; i++) {
      if (isCancelled()) return;
      const pos = positions[i];

      const argValue = codeArgIsArray ? [pos.fundCode] : pos.fundCode;
      let callResult = await this.mcp
        .callTool(navTool.name, { [codeArgName]: argValue })
        .catch((err: unknown) => (err instanceof Error ? err : new Error(String(err))));

      // 天天基金 fallback：MCP 失败时降级
      if (callResult instanceof Error || (callResult as CallToolResult).isError) {
        const fallback = await this.fetchNavFromTiantian(pos.fundCode).catch(() => null);
        if (fallback) {
          this.logger.warn(`[${pos.fundCode}] MCP failed, using tiantian fallback`);
          callResult = fallback;
        }
      }

      const item = this.buildItem(pos, callResult);

      // 持仓去重：MCP 返回的 navDate 与已存储的相同则跳过更新
      if (item.status === 'success' && item.navDate && pos.navDate === item.navDate && pos.navUnit) {
        const skipped: SyncPositionItemResult = {
          ...item,
          status: 'skipped',
          reason: '净值日期未变化，跳过更新',
        };
        items.push(skipped);
        if (item.navUnit) await this.confirmPending(pos.fundCode, item.navUnit);
        subscriber.next({ type: 'item', index: i, total: positions.length, result: skipped });
        continue;
      }

      items.push(item);

      if (item.status === 'success' && item.newValue) {
        await this.db
          .update(schema.positions)
          .set({
            currentValue: item.newValue,
            navUnit: item.navUnit ?? null,
            navDate: item.navDate ?? null,
            updatedAt: new Date(),
          })
          .where(eq(schema.positions.fundCode, pos.fundCode));

        if (item.navUnit && item.navDate) {
          await this.upsertNavHistory(pos.fundCode, item.navDate, item.navUnit);
        }
        if (item.navUnit) {
          await this.confirmPending(pos.fundCode, item.navUnit);
        }
      }

      subscriber.next({ type: 'item', index: i, total: positions.length, result: item });
    }

    const succeeded = items.filter((i) => i.status === 'success').length;
    const failed = items.filter((i) => i.status === 'failed').length;
    const skipped = items.filter((i) => i.status === 'skipped').length;

    // 确认没有持仓但有 pending 交易的基金（首次买入）
    const existingCodes = new Set(positions.map((p) => p.fundCode));
    await this.confirmNewFundPending(existingCodes, navTool, codeArgName, codeArgIsArray);

    await this.settings.set('last_sync_at', syncedAt);
    await this.dailySnapshots.generate().catch((err: unknown) => {
      this.logger.warn(`Auto snapshot failed: ${(err as Error).message}`);
    });

    subscriber.next({
      type: 'done',
      result: { total: items.length, succeeded, failed, skipped, syncedAt, items },
    });
    subscriber.complete();
  }

  private async upsertNavHistory(fundCode: string, navDate: string, navUnit: string): Promise<void> {
    const nav = parseFloat(navUnit);
    if (!Number.isFinite(nav) || nav <= 0) return;

    // 获取前一日净值计算日收益率
    const [prev] = await this.db
      .select({ navUnit: schema.fundNavHistory.navUnit })
      .from(schema.fundNavHistory)
      .where(
        and(
          eq(schema.fundNavHistory.fundCode, fundCode),
          lt(schema.fundNavHistory.navDate, navDate),
        ),
      )
      .orderBy(desc(schema.fundNavHistory.navDate))
      .limit(1);

    const prevNav = prev ? parseFloat(prev.navUnit) : null;
    const dailyReturn = prevNav && prevNav > 0
      ? ((nav - prevNav) / prevNav * 100).toFixed(4)
      : null;

    await this.db
      .insert(schema.fundNavHistory)
      .values({
        fundCode,
        navDate,
        navUnit,
        dailyReturn,
      })
      .onConflictDoUpdate({
        target: [schema.fundNavHistory.fundCode, schema.fundNavHistory.navDate],
        set: { navUnit, dailyReturn },
      });
  }

  private async confirmPending(fundCode: string, navUnit: string): Promise<void> {
    await this.confirmationService.confirmPending(fundCode, navUnit);
  }

  private async confirmNewFundPending(
    existingCodes: Set<string>,
    navTool: Tool,
    codeArgName: string,
    codeArgIsArray: boolean,
  ): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const allPending = await this.db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.status, 'pending'),
          lt(schema.transactions.tradeDate, today),
        ),
      )
      .orderBy(asc(schema.transactions.tradeDate));

    const pendingNewFunds = allPending.filter((tx) => !existingCodes.has(tx.fundCode));
    if (pendingNewFunds.length === 0) return;

    const fundCodes = [...new Set(pendingNewFunds.map((tx) => tx.fundCode))];
    for (const fundCode of fundCodes) {
      try {
        const argValue = codeArgIsArray ? [fundCode] : fundCode;
        const result = await this.mcp.callTool(navTool.name, { [codeArgName]: argValue });
        const text = (result.content ?? [])
          .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
          .map((c) => c.text)
          .join('\n')
          .trim();
        const nav = parseNavFromText(text);
        if (nav) {
          await this.confirmPending(fundCode, nav.navUnit);
        }
      } catch (err) {
        this.logger.warn(`Failed to confirm pending for new fund ${fundCode}: ${(err as Error).message}`);
      }
    }
  }

  private emitFailAll(
    subscriber: Subscriber<SyncStreamEvent>,
    result: SyncPositionsResult,
    _phase: 'mcp' | 'no-tool',
  ): void {
    subscriber.next({
      type: 'started',
      total: result.total,
      toolName: '',
      codeArgName: '',
    });
    result.items.forEach((it, i) => {
      subscriber.next({ type: 'item', index: i, total: result.total, result: it });
    });
    subscriber.next({ type: 'done', result });
    subscriber.complete();
  }

  private async fetchNavFromTiantian(fundCode: string): Promise<CallToolResult | null> {
    const quote = await this.realtimeQuote.fetchQuote(fundCode);
    if (!quote.lastNav || parseFloat(quote.lastNav) <= 0) return null;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          navUnit: quote.lastNav,
          navDate: quote.lastNavDate,
        }),
      }],
    } as CallToolResult;
  }

  private failAll(positions: PositionRow[], reason: string, syncedAt: string): SyncPositionsResult {
    const items: SyncPositionItemResult[] = positions.map((p) => ({
      fundCode: p.fundCode,
      fundName: p.fundName,
      status: 'failed',
      oldValue: p.currentValue ?? '0',
      reason,
    }));
    return { total: items.length, succeeded: 0, failed: items.length, skipped: 0, syncedAt, items };
  }

  private buildItem(
    position: PositionRow,
    callResult: CallToolResult | Error,
  ): SyncPositionItemResult {
    const base = {
      fundCode: position.fundCode,
      fundName: position.fundName,
      oldValue: position.currentValue ?? '0',
    };

    if (callResult instanceof Error) {
      this.logger.warn(`[${position.fundCode}] MCP call rejected: ${callResult.message}`);
      return { ...base, status: 'failed', reason: callResult.message };
    }
    if (callResult.isError) {
      const reason = extractErrorText(callResult);
      this.logger.warn(`[${position.fundCode}] MCP tool error: ${reason}`);
      return { ...base, status: 'failed', reason };
    }

    const text = callResult.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map((c) => c.text)
      .join('\n');
    const nav = parseNavFromText(text);
    if (!nav) {
      this.logger.warn(`[${position.fundCode}] NAV parse failed, raw: ${text.slice(0, 200)}`);
      return { ...base, status: 'failed', reason: '净值解析失败' };
    }

    const newValue = computeMarketValue(position, nav.navUnit);
    if (newValue === null) {
      return {
        ...base,
        status: 'skipped',
        navUnit: nav.navUnit,
        navDate: nav.navDate,
        reason: '该基金暂无份额信息，请先在「交易与持仓」录入快照或买入流水',
      };
    }

    return {
      ...base,
      status: 'success',
      navUnit: nav.navUnit,
      navDate: nav.navDate,
      newValue,
    };
  }
}

export function computeMarketValue(
  position: PositionRow | undefined,
  navUnit: string,
): string | null {
  const nav = Number(navUnit);
  if (!Number.isFinite(nav) || nav <= 0) return null;

  const shares = position ? Number(position.shares ?? '0') : 0;
  if (shares > 0) {
    return (shares * nav).toFixed(2);
  }

  return null;
}
