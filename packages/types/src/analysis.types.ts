export interface AnalysisRecord {
  id: number;
  provider: string;
  inputSnapshot: Record<string, unknown>;
  result: Record<string, unknown>;
  createdAt: string;
}
