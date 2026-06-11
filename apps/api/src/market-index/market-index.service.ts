import { Inject, Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, desc } from 'drizzle-orm';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import type { MarketIndexQuote, IndexConfig } from './market-index.types';
import { DEFAULT_INDICES } from './market-index.types';

type DbType = NodePgDatabase<typeof schema>;

const SINA_API_BASE = 'https://hq.sinajs.cn/list=';
const REQUEST_TIMEOUT = 5_000;

@Injectable()
export class MarketIndexService {
  private readonly logger = new Logger(MarketIndexService.name);
  private readonly cache = new Map<string, { quote: MarketIndexQuote; fetchedAt: number }>();
  private readonly CACHE_TTL = 30_000; // 30s

  constructor(@Inject(DB) private readonly db: DbType) {}

  async fetchRealtime(indices: IndexConfig[] = DEFAULT_INDICES): Promise<MarketIndexQuote[]> {
    const codes = indices.map((i) => i.code);
    const cached = this.getFromCache(codes);
    if (cached.length === codes.length) return cached;

    const quotes = await this.fetchFromSina(indices);
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
    let archived = 0;

    for (const quote of quotes) {
      await this.db
        .insert(schema.marketIndexHistory)
        .values({
          indexCode: quote.indexCode,
          name: quote.name,
          close: quote.close.toFixed(4),
          changePct: quote.changePct.toFixed(4),
          turnover: quote.turnover.toFixed(2),
          tradeDate: quote.tradeDate,
        })
        .onConflictDoUpdate({
          target: [schema.marketIndexHistory.indexCode, schema.marketIndexHistory.tradeDate],
          set: {
            close: quote.close.toFixed(4),
            changePct: quote.changePct.toFixed(4),
            turnover: quote.turnover.toFixed(2),
            updatedAt: new Date(),
          },
        });
      archived++;
    }

    this.logger.log(`Archived ${archived} index records for today`);
    return archived;
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

  private async fetchFromSina(indices: IndexConfig[]): Promise<MarketIndexQuote[]> {
    const codes = indices.map((i) => i.code).join(',');
    const url = `${SINA_API_BASE}${codes}`;

    let text: string;
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        headers: {
          Referer: 'https://finance.sina.com.cn/',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
    } catch (err) {
      this.logger.warn(`Sina API request failed: ${(err as Error).message}`);
      return this.getFallbackFromDb(indices);
    }

    return this.parseSinaResponse(text, indices);
  }

  private parseSinaResponse(text: string, indices: IndexConfig[]): MarketIndexQuote[] {
    const quotes: MarketIndexQuote[] = [];
    const lines = text.split('\n').filter((l) => l.trim());

    for (const line of lines) {
      const match = line.match(/^hq_str_(\w+)="(.+)"$/);
      if (!match) continue;

      const code = match[1];
      const config = indices.find((i) => i.code === code);
      if (!config) continue;

      const fields = match[2].split(',');
      if (fields.length < 32) continue;

      // 新浪指数格式：name(0), open(1), preClose(2), high(3), low(4), close(5), ...
      const name = fields[0] || config.name;
      const close = parseFloat(fields[3]);
      const preClose = parseFloat(fields[2]);
      const turnover = parseFloat(fields[31]) || 0;

      if (!Number.isFinite(close) || !Number.isFinite(preClose) || preClose === 0) continue;

      const changePct = ((close - preClose) / preClose) * 100;
      const today = new Date().toISOString().split('T')[0];

      quotes.push({
        indexCode: code,
        name,
        close,
        changePct,
        turnover,
        tradeDate: today,
      });
    }

    return quotes;
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
