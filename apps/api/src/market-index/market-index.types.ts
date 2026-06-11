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

// 默认关注的 6 大核心指数
export const DEFAULT_INDICES: IndexConfig[] = [
  { code: 'sh000001', name: '上证指数' },
  { code: 'sz399001', name: '深证成指' },
  { code: 'sh000300', name: '沪深300' },
  { code: 'sz399006', name: '创业板指' },
  { code: 'sh000688', name: '科创50' },
  { code: 'bj899050', name: '北证50' },
];

// 新浪财经 API 响应格式
// hq_str_sh000300="沪深300,3921.1274,..."
interface SinaResponse {
  [key: string]: string;
}
