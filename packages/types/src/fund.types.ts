export interface Fund {
  id: number;
  code: string;
  name: string;
  type: string | null;
  riskLevel: number | null;
  costAmount: string;
  currentValue: string;
  targetAmount: string;
  targetRatio: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FundListItem extends Fund {
  pnlAmount: string;
  pnlRate: string;
}

export interface CreateFundDto {
  code: string;
  name: string;
  type?: string;
  riskLevel?: number;
  costAmount?: string;
  currentValue?: string;
  targetAmount?: string;
  targetRatio?: string;
  note?: string;
}

export interface UpdateFundDto {
  name?: string;
  type?: string;
  riskLevel?: number;
  costAmount?: string;
  currentValue?: string;
  targetAmount?: string;
  targetRatio?: string;
  note?: string;
}
