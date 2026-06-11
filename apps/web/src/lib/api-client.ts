import axios from "axios";
import type {
  FundListItem, CreateFundDto, UpdateFundDto, FundCategory, ReorderFundDto,
  PositionListItem, SyncPositionsResult, UpsertPositionDto,
  Transaction, CreateTransactionDto,
  DailyLog, CreateDailyLogDto, UpdateDailyLogDto, DailySnapshot,
  AppSetting, AiConfig, McpConfig,
  ChatSessionSummary, ChatSessionDetail, PersistChatMessageDto, ChatMessage,
  AssetAllocationResponse,
  DcaRules, SlpRules, FundRuleOverride, FundRuleOverrideType, BulletReserve,
  MarketIndexQuote, MarketIndexHistory,
} from "@g-fund/types";

const http = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api",
  timeout: 10000,
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.message ?? err.message;
    return Promise.reject(new Error(Array.isArray(msg) ? msg.join("; ") : msg));
  },
);

export const fundsApi = {
  list: (category?: FundCategory) =>
    http.get<FundListItem[]>("/funds", { params: category ? { category } : undefined }).then((r) => r.data),
  get: (code: string) => http.get<FundListItem>(`/funds/${code}`).then((r) => r.data),
  create: (dto: CreateFundDto) => http.post<FundListItem>("/funds", dto).then((r) => r.data),
  update: (code: string, dto: UpdateFundDto) =>
    http.patch<FundListItem>(`/funds/${code}`, dto).then((r) => r.data),
  remove: (code: string) => http.delete(`/funds/${code}`),
  reorder: (items: ReorderFundDto[]) =>
    http.patch("/funds/reorder", { items }).then((r) => r.data),
};

export const positionsApi = {
  list: () => http.get<PositionListItem[]>("/positions").then((r) => r.data),
  get: (fundCode: string) => http.get<PositionListItem>(`/positions/${fundCode}`).then((r) => r.data),
  fetchNav: (fundCode: string) =>
    http.get<{ navUnit: string; navDate?: string }>(`/positions/${fundCode}/nav`, { timeout: 15000 }).then((r) => r.data),
  upsert: (dto: UpsertPositionDto) =>
    http.put<PositionListItem>("/positions", dto).then((r) => r.data),
  remove: (fundCode: string) => http.delete(`/positions/${fundCode}`),
  sync: () =>
    http.post<SyncPositionsResult>("/positions/sync", undefined, { timeout: 60000 }).then((r) => r.data),
};

export const transactionsApi = {
  list: (params?: { fundCode?: string; type?: string; startDate?: string; endDate?: string }) =>
    http.get<Transaction[]>("/transactions", { params }).then((r) => r.data),
  create: (dto: CreateTransactionDto) =>
    http.post<Transaction>("/transactions", dto).then((r) => r.data),
  remove: (id: number) => http.delete(`/transactions/${id}`),
};

export const dailyLogsApi = {
  list: (params?: { from?: string; to?: string }) =>
    http.get<DailyLog[]>("/daily-logs", { params }).then((r) => r.data),
  create: (dto: CreateDailyLogDto) =>
    http.post<DailyLog>("/daily-logs", dto).then((r) => r.data),
  update: (id: number, dto: UpdateDailyLogDto) =>
    http.patch<DailyLog>(`/daily-logs/${id}`, dto).then((r) => r.data),
  remove: (id: number) => http.delete(`/daily-logs/${id}`),
};

export const dailySnapshotsApi = {
  list: (params?: { from?: string; to?: string }) =>
    http.get<DailySnapshot[]>("/daily-snapshots", { params }).then((r) => r.data),
  generate: () =>
    http.post<DailySnapshot>("/daily-snapshots/generate").then((r) => r.data),
};

export const settingsApi = {
  get: (key: string) => http.get<AppSetting>(`/settings/${key}`).then((r) => r.data),
  set: (key: string, value: string) =>
    http.put<AppSetting>(`/settings/${key}`, { value }).then((r) => r.data),
};

export const aiConfigApi = {
  get: () => http.get<AiConfig>("/settings/ai/config").then((r) => r.data),
  set: (config: AiConfig) => http.put<AppSetting>("/settings/ai/config", config).then((r) => r.data),
};

export const mcpConfigApi = {
  get: () => http.get<McpConfig>("/settings/mcp/config").then((r) => r.data),
  set: (config: McpConfig) => http.put<AppSetting>("/settings/mcp/config", config).then((r) => r.data),
};

export const bulletReserveApi = {
  get: () => http.get<BulletReserve>("/settings/bullet-reserve").then((r) => r.data),
  set: (reserve: BulletReserve) => http.put<AppSetting>("/settings/bullet-reserve", reserve).then((r) => r.data),
};

export const stopLossTakeProfitApi = {
  list: () =>
    http.get<import("@g-fund/types").StopLossTakeProfitSignal[]>("/stop-loss-take-profit").then((r) => r.data),
  get: (fundCode: string) =>
    http.get<import("@g-fund/types").StopLossTakeProfitSignal[]>(`/stop-loss-take-profit/${fundCode}`).then((r) => r.data),
  history: (params?: { fundCode?: string; days?: number }) =>
    http.get<import("@g-fund/types").SlpSignalLog[]>("/stop-loss-take-profit/history", { params }).then((r) => r.data),
};

export const dcaApi = {
  calculate: () =>
    http.get<import("@g-fund/types").DcaCalculation[]>("/dca").then((r) => r.data),
  calculateByFund: (fundCode: string) =>
    http.get<import("@g-fund/types").DcaCalculation | null>(`/dca/${fundCode}`).then((r) => r.data),
  getNextDate: () =>
    http.get<{ nextDate: string; isToday: boolean }>("/dca/next-date").then((r) => r.data),
  getSnapshots: (planDate: string) =>
    http.get<import("@g-fund/types").DcaSnapshot[]>(`/dca/snapshots/${planDate}`).then((r) => r.data),
  markExecuted: (id: number) =>
    http.patch<import("@g-fund/types").DcaSnapshot>(`/dca/snapshots/${id}/execute`).then((r) => r.data),
};

export const rulesApi = {
  getDca: () => http.get<DcaRules>("/rules/dca").then((r) => r.data),
  setDca: (rules: DcaRules) => http.put("/rules/dca", rules).then((r) => r.data),
  resetDca: () => http.post<DcaRules>("/rules/dca/reset").then((r) => r.data),
  getSlp: () => http.get<SlpRules>("/rules/slp").then((r) => r.data),
  setSlp: (rules: SlpRules) => http.put("/rules/slp", rules).then((r) => r.data),
  resetSlp: () => http.post<SlpRules>("/rules/slp/reset").then((r) => r.data),
  getFundOverrides: (code: string) =>
    http.get<FundRuleOverride[]>(`/rules/funds/${code}/overrides`).then((r) => r.data),
  setFundOverride: (code: string, type: FundRuleOverrideType, enabled: boolean, value?: number | null) =>
    http.put<FundRuleOverride>(`/rules/funds/${code}/overrides/${type}`, { enabled, value }).then((r) => r.data),
};

export const chatApi = {
  list: () => http.get<ChatSessionSummary[]>("/chat/sessions").then((r) => r.data),
  create: (title?: string) =>
    http.post<ChatSessionSummary>("/chat/sessions", { title }).then((r) => r.data),
  detail: (id: number) =>
    http.get<ChatSessionDetail>(`/chat/sessions/${id}`).then((r) => r.data),
  rename: (id: number, title: string) =>
    http.patch<ChatSessionSummary>(`/chat/sessions/${id}`, { title }).then((r) => r.data),
  remove: (id: number) => http.delete(`/chat/sessions/${id}`),
  appendMessage: (id: number, dto: PersistChatMessageDto) =>
    http.post<ChatMessage>(`/chat/sessions/${id}/messages`, dto).then((r) => r.data),
};

export const dashboardApi = {
  assetAllocation: () =>
    http.get<AssetAllocationResponse>("/dashboard/asset-allocation", { timeout: 30000 }).then((r) => r.data),
};

export const marketIndexApi = {
  realtime: () =>
    http.get<MarketIndexQuote[]>("/market-index/realtime").then((r) => r.data),
  history: (code: string, days?: number) =>
    http.get<MarketIndexHistory[]>(`/market-index/${code}/history`, { params: days ? { days } : undefined }).then((r) => r.data),
  getWatchlist: () =>
    http.get<AppSetting>("/settings/watchlist_indices").then((r) => r.data).catch(() => null),
  setWatchlist: (indices: string[]) =>
    http.put<AppSetting>("/settings/watchlist_indices", { value: JSON.stringify(indices) }).then((r) => r.data),
};
