export const FUND_CATEGORIES = ['holding', 'longterm', 'watchlist'] as const;
export type FundCategory = (typeof FUND_CATEGORIES)[number];

export const FUND_CATEGORY_LABELS: Record<FundCategory, string> = {
  holding: '持有',
  longterm: '长期',
  watchlist: '关注',
};

export interface Fund {
  id: number;
  code: string;
  name: string;
  type: string | null;
  riskLevel: number | null;
  category: FundCategory;
  sortOrder: number;
  targetAmount: string;
  targetRatio: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FundListItem extends Fund {
  costAmount: string;
  currentValue: string;
  pnlAmount: string;
  pnlRate: string;
  hasPosition: boolean;
}

export interface CreateFundDto {
  code: string;
  name: string;
  type?: string;
  riskLevel?: number;
  category?: FundCategory;
  targetAmount?: string;
  targetRatio?: string;
  note?: string;
}

export interface UpdateFundDto {
  name?: string;
  type?: string;
  riskLevel?: number;
  category?: FundCategory;
  sortOrder?: number;
  targetAmount?: string;
  targetRatio?: string;
  note?: string;
}

export interface ReorderFundDto {
  code: string;
  sortOrder: number;
}

export interface AppSetting {
  key: string;
  value: string;
  updatedAt: string;
}
