import axios from "axios";
import type {
  FundListItem, CreateFundDto, UpdateFundDto, FundCategory, ReorderFundDto,
  PositionListItem, Transaction, CreateTransactionDto,
  DailyLog, CreateDailyLogDto, UpdateDailyLogDto, DailySnapshot,
  AppSetting, AiConfig, McpConfig,
  ChatSessionSummary, ChatSessionDetail, PersistChatMessageDto, ChatMessage,
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
};

export const transactionsApi = {
  list: (params?: { fundCode?: string; type?: string }) =>
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
