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
