import type { RealtimeQuote } from '@g-fund/types';

export interface QuoteCacheEntry {
  quote: RealtimeQuote;
  fetchedAt: number;
}

export interface BatchQuoteRequest {
  codes: string[];
}

export interface TiantianFundResponse {
  fundcode: string;
  name: string;
  jzrq: string;   // 净值日期
  dwjz: string;   // 单位净值
  gsz: string;    // 估算值
  gszzl: string;  // 估算涨跌幅 %
  gztime: string; // 估值时间
}
