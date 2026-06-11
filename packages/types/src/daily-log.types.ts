export interface DailyLog {
  id: number;
  logDate: string;
  summary: string | null;
  marketNote: string | null;
  stageChanges: StageChange[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDailyLogDto {
  logDate: string;
  summary?: string;
  marketNote?: string;
  stageChanges?: StageChange[];
}

export interface UpdateDailyLogDto {
  summary?: string;
  marketNote?: string;
  stageChanges?: StageChange[];
}

export interface StageChange {
  fundCode: string;
  fundName: string;
  fromStage: 'dca' | 'holding';
  toStage: 'dca' | 'holding';
  progress: number;
  trigger: 'buy' | 'sell' | 'rollback_buy' | 'rollback_sell' | 'target_change';
  timestamp: string;
}
