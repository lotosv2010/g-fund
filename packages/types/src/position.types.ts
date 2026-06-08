export interface Position {
  id: number;
  fundCode: string;
  fundName: string;
  shares: string;
  costPrice: string;
  costAmount: string;
  createdAt: string;
  updatedAt: string;
}

export interface PositionListItem extends Position {
  currentValue: string;
  pnlAmount: string;
  pnlRate: string;
  type: string | null;
  category: string;
}
