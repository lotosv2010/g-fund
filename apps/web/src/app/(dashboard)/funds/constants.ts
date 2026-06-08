export const RISK_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "低风险", color: "green" },
  2: { label: "中低风险", color: "cyan" },
  3: { label: "中风险", color: "gold" },
  4: { label: "中高风险", color: "orange" },
  5: { label: "高风险", color: "red" },
};

export const FUND_TYPE_OPTIONS = ["股票型", "混合型", "债券型", "货币型", "指数型"] as const;
