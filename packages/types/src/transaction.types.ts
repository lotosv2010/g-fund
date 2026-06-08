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
  createdAt: string;
}
