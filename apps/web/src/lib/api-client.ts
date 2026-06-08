import axios from "axios";
import type {
  FundListItem, CreateFundDto, UpdateFundDto, FundCategory, ReorderFundDto,
  PositionListItem, Transaction, CreateTransactionDto,
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
