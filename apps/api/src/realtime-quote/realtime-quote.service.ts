import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { RealtimeQuote } from '@g-fund/types';
import type { QuoteCacheEntry, TiantianFundResponse } from './realtime-quote.types';
import { isTradingHours } from '../common/trading-hours';

const API_BASE = 'https://fundgz.1234567.com.cn/js';
const TRADING_CACHE_TTL = 30_000;    // 交易时段 30s
const IDLE_CACHE_TTL = 300_000;       // 非交易时段 5min
const REQUEST_TIMEOUT = 5_000;

@Injectable()
export class RealtimeQuoteService {
  private readonly logger = new Logger(RealtimeQuoteService.name);
  private readonly cache = new Map<string, QuoteCacheEntry>();

  async fetchQuote(fundCode: string): Promise<RealtimeQuote> {
    const cached = this.getFromCache(fundCode);
    if (cached) return cached;

    const raw = await this.requestTiantianApi(fundCode);
    const quote = this.toRealtimeQuote(raw);
    this.setCache(fundCode, quote);
    return quote;
  }

  async fetchQuotes(codes: string[]): Promise<RealtimeQuote[]> {
    const results = await Promise.allSettled(
      codes.map((code) => this.fetchQuote(code)),
    );

    const quotes: RealtimeQuote[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        quotes.push(result.value);
      }
    }
    return quotes;
  }

  private getFromCache(fundCode: string): RealtimeQuote | null {
    const entry = this.cache.get(fundCode);
    if (!entry) return null;

    const ttl = isTradingHours() ? TRADING_CACHE_TTL : IDLE_CACHE_TTL;
    if (Date.now() - entry.fetchedAt > ttl) {
      this.cache.delete(fundCode);
      return null;
    }
    return entry.quote;
  }

  private setCache(fundCode: string, quote: RealtimeQuote): void {
    this.cache.set(fundCode, { quote, fetchedAt: Date.now() });
  }

  private async requestTiantianApi(fundCode: string): Promise<TiantianFundResponse> {
    const url = `${API_BASE}/${fundCode}.js?rt=${Date.now()}`;
    let text: string;

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        headers: {
          'Referer': 'https://fund.eastmoney.com/',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      text = await res.text();
    } catch (err) {
      this.logger.warn(`[${fundCode}] 天天基金 API 请求失败: ${(err as Error).message}`);
      throw new NotFoundException(`基金 ${fundCode} 估值数据获取失败`);
    }

    return this.parseJsonp(text, fundCode);
  }

  private parseJsonp(text: string, fundCode: string): TiantianFundResponse {
    const match = text.match(/^jsonpgz\((.+)\);?$/);
    if (!match) {
      this.logger.warn(`[${fundCode}] JSONP 解析失败: ${text.slice(0, 200)}`);
      throw new NotFoundException(`基金 ${fundCode} 估值数据格式异常`);
    }

    try {
      return JSON.parse(match[1]) as TiantianFundResponse;
    } catch {
      throw new NotFoundException(`基金 ${fundCode} 估值数据 JSON 解析失败`);
    }
  }

  private toRealtimeQuote(raw: TiantianFundResponse): RealtimeQuote {
    const estimateTime = raw.gztime || '';
    const isEstimate = this.checkIsEstimate(estimateTime);

    return {
      fundCode: raw.fundcode,
      name: raw.name,
      estimateNav: raw.gsz || raw.dwjz,
      dailyReturn: raw.gszzl || '0',
      lastNav: raw.dwjz,
      lastNavDate: raw.jzrq,
      estimateTime,
      isEstimate,
    };
  }

  private checkIsEstimate(gztime: string): boolean {
    if (!gztime) return false;
    // 估值时间格式: "2026-06-11 15:00" 或 "2026-06-11 14:30"
    // 如果时间是 15:00 且日期是今天，说明已收盘
    const parts = gztime.split(' ');
    if (parts.length < 2) return true;

    const timeStr = parts[1];
    const [hh, mm] = timeStr.split(':').map(Number);
    const totalMin = hh * 60 + mm;

    // 15:00 = 900 分钟，视为收盘
    return totalMin < 900;
  }
}
