import { Inject, Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import * as schema from '@g-fund/db';
import { stocks } from 'stock-api';
import { DB } from '../db/db.module';
import { SettingsService } from '../settings/settings.service';
import type { MarketIndexQuote, IndexConfig } from './market-index.types';
import { DEFAULT_INDICES } from './market-index.types';

type DbType = NodePgDatabase<typeof schema>;

function toStockCode(code: string): string {
  return code.replace(/^sh/i, 'SH').replace(/^sz/i, 'SZ').replace(/^bj/i, 'SZ');
}

@Injectable()
export class MarketIndexService {
  private readonly logger = new Logger(MarketIndexService.name);
  private readonly cache = new Map<string, { quote: MarketIndexQuote; fetchedAt: number }>();
  private readonly CACHE_TTL = 30_000;

  constructor(
    @Inject(DB) private readonly db: DbType,
    private readonly settingsService: SettingsService,
  ) {}

  async resolveIndices(codesParam?: string): Promise<IndexConfig[]> {
    if (codesParam) {
      return codesParam.split(',').map((c) => {
        const found = DEFAULT_INDICES.find((d) => d.code === c.trim());
        return found ?? { code: c.trim(), name: c.trim() };
      });
    }

    try {
      const setting = await this.settingsService.get('watchlist_indices');
      const watchlist: unknown = JSON.parse(setting.value);
      if (Array.isArray(watchlist) && watchlist.length > 0) {
        return (watchlist as string[]).map((c) => {
          const found = DEFAULT_INDICES.find((d) => d.code === c);
          return found ?? { code: c, name: c };
        });
      }
    } catch {
      // no watchlist configured, use defaults
    }

    return DEFAULT_INDICES;
  }

  async fetchRealtime(indices: IndexConfig[] = DEFAULT_INDICES): Promise<MarketIndexQuote[]> {
    const codes = indices.map((i) => i.code);
    const cached = this.getFromCache(codes);
    if (cached.length === codes.length) return cached;

    const quotes = await this.fetchFromStockApi(indices);
    for (const quote of quotes) {
      this.cache.set(quote.indexCode, { quote, fetchedAt: Date.now() });
    }
    return quotes;
  }

  async fetchHistory(indexCode: string, days = 30): Promise<typeof schema.marketIndexHistory.$inferSelect[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.db
      .select()
      .from(schema.marketIndexHistory)
      .where(
        and(
          eq(schema.marketIndexHistory.indexCode, indexCode),
          gte(schema.marketIndexHistory.tradeDate, since.toISOString().split('T')[0]),
        ),
      )
      .orderBy(desc(schema.marketIndexHistory.tradeDate));
  }

  async archiveToday(): Promise<number> {
    const quotes = await this.fetchRealtime();
    if (quotes.length === 0) return 0;

    const values = quotes.map((q) => ({
      indexCode: q.indexCode,
      name: q.name,
      close: q.close.toFixed(4),
      changePct: q.changePct.toFixed(4),
      turnover: q.turnover.toFixed(2),
      tradeDate: q.tradeDate,
    }));

    await this.db
      .insert(schema.marketIndexHistory)
      .values(values)
      .onConflictDoUpdate({
        target: [schema.marketIndexHistory.indexCode, schema.marketIndexHistory.tradeDate],
        set: {
          close: sql`excluded.close`,
          changePct: sql`excluded.change_pct`,
          turnover: sql`excluded.turnover`,
          updatedAt: new Date(),
        },
      });

    this.logger.log(`Archived ${quotes.length} index records for today`);
    return quotes.length;
  }

  private getFromCache(codes: string[]): MarketIndexQuote[] {
    const now = Date.now();
    const quotes: MarketIndexQuote[] = [];

    for (const code of codes) {
      const entry = this.cache.get(code);
      if (entry && now - entry.fetchedAt < this.CACHE_TTL) {
        quotes.push(entry.quote);
      }
    }
    return quotes;
  }

  private async fetchFromStockApi(indices: IndexConfig[]): Promise<MarketIndexQuote[]> {
    try {
      const stockCodes = indices.map((i) => toStockCode(i.code));
      const stockList = await stocks.auto.getStocks(stockCodes);
      const today = new Date().toISOString().split('T')[0];

      const quotes: MarketIndexQuote[] = [];
      for (const stock of stockList) {
        const matched = indices.find((i) => toStockCode(i.code) === stock.code);
        if (!matched) continue;

        quotes.push({
          indexCode: matched.code,
          name: stock.name || matched.name,
          close: stock.now,
          changePct: stock.percent * 100,
          turnover: 0,
          tradeDate: today,
        });
      }

      if (quotes.length > 0) return quotes;
    } catch (err) {
      this.logger.warn(`stock-api request failed: ${(err as Error).message}`);
    }

    return this.getFallbackFromDb(indices);
  }

  private async getFallbackFromDb(indices: IndexConfig[]): Promise<MarketIndexQuote[]> {
    this.logger.log('Falling back to DB cache for index data');
    const quotes: MarketIndexQuote[] = [];

    for (const config of indices) {
      const [row] = await this.db
        .select()
        .from(schema.marketIndexHistory)
        .where(eq(schema.marketIndexHistory.indexCode, config.code))
        .orderBy(desc(schema.marketIndexHistory.tradeDate))
        .limit(1);

      if (row) {
        quotes.push({
          indexCode: row.indexCode,
          name: row.name,
          close: parseFloat(row.close),
          changePct: parseFloat(row.changePct ?? '0'),
          turnover: parseFloat(row.turnover ?? '0'),
          tradeDate: row.tradeDate,
        });
      }
    }

    return quotes;
  }
}
