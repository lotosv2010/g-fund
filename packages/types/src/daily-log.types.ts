export interface DailyLog {
  id: number;
  logDate: string;
  summary: string | null;
  marketNote: string | null;
  createdAt: string;
  updatedAt: string;
}
