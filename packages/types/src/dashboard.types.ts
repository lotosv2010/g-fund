export interface FundAssetClassNode {
  categoryCode: string;
  categoryName: string;
  levelType: "TOP_LEVEL" | "LEVEL1" | "LEVEL2";
  amount: number;
  ratio: number;
  color: string;
  children: FundAssetClassNode[];
}

export interface FundAssetDetail {
  fundCode: string;
  fundName: string;
  currentValue: string;
  topCategory: string;
  level1Category: string;
  level2Category: string;
  categoryCode: string;
}

export interface AssetAllocationResponse {
  categoryTree: FundAssetClassNode[];
  fundDetails: FundAssetDetail[];
}

export interface RebalanceSuggestion {
  fundCode: string;
  fundName: string;
  currentValue: number;
  targetValue: number;
  currentRatio: number;
  targetRatio: number;
  deviation: number;
  action: 'buy' | 'sell';
  amount: number;
}

export interface RebalanceResponse {
  totalValue: number;
  suggestions: RebalanceSuggestion[];
}
