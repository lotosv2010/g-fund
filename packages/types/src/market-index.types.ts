export interface MarketIndexQuote {
  indexCode: string;
  name: string;
  close: number;
  changePct: number;
  turnover: number;
  tradeDate: string;
}

export interface IndexConfig {
  code: string;
  name: string;
}

export const DEFAULT_INDICES: IndexConfig[] = [
  { code: 'sh000001', name: '上证指数' },
  { code: 'sz399001', name: '深证成指' },
  { code: 'sh000300', name: '沪深300' },
  { code: 'sz399006', name: '创业板指' },
  { code: 'sh000688', name: '科创50' },
  { code: 'bj899050', name: '北证50' },
];

export interface MarketIndexHistory {
  id: number;
  indexCode: string;
  name: string;
  close: string;
  changePct: string | null;
  turnover: string | null;
  tradeDate: string;
  updatedAt: string;
}
