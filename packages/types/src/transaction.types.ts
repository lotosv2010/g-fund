export interface Transaction {
  id: number;
  fundCode: string;
  fundName: string;
  type: 'buy' | 'sell';
  amount: string;
  shares: string | null;
  price: string | null;
  tradeDate: string;
  note: string | null;
  status: 'pending' | 'confirmed' | 'cancelled';
  confirmedAt: string | null;
  createdAt: string;
}

export interface CreateTransactionDto {
  fundCode: string;
  type: 'buy' | 'sell';
  amount: string;
  shares?: string;
  price?: string;
  tradeDate: string;
  note?: string;
}

export interface ImportTransactionRow {
  fundCode: string;
  type: 'buy' | 'sell';
  amount: number;
  shares?: number;
  price?: number;
  tradeDate: string;
  note?: string;
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
  value?: unknown;
}

export interface ImportResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: ImportError[];
  created: Transaction[];
}
