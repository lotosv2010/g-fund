export interface DailyLog {
  id: number;
  logDate: string;
  summary: string | null;
  marketNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDailyLogDto {
  logDate: string;
  summary?: string;
  marketNote?: string;
}

export interface UpdateDailyLogDto {
  summary?: string;
  marketNote?: string;
}
