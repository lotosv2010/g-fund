export interface Position {
  id: number;
  fundCode: string;
  fundName: string;
  shares: string;
  costPrice: string;
  costAmount: string;
  currentValue: string;
  navUnit: string | null;
  navDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PositionListItem extends Position {
  pnlAmount: string;
  pnlRate: string;
  type: string | null;
  category: string;
}

export interface UpsertPositionDto {
  fundCode: string;
  costAmount: string;
  costPrice: string;
  currentValue: string;
  shares: string;
}

export type SyncPositionItemStatus = "success" | "skipped" | "failed";

export interface SyncPositionItemResult {
  fundCode: string;
  fundName: string;
  status: SyncPositionItemStatus;
  oldValue: string;
  newValue?: string;
  navUnit?: string;
  navDate?: string;
  reason?: string;
}

export interface SyncPositionsResult {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  syncedAt: string;
  items: SyncPositionItemResult[];
}

export type SyncStreamEvent =
  | { type: "started"; total: number; toolName: string; codeArgName: string }
  | { type: "item"; index: number; total: number; result: SyncPositionItemResult }
  | { type: "done"; result: SyncPositionsResult }
  | { type: "error"; message: string };
