export const RISK_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "低风险", color: "green" },
  2: { label: "中低风险", color: "cyan" },
  3: { label: "中风险", color: "gold" },
  4: { label: "中高风险", color: "orange" },
  5: { label: "高风险", color: "red" },
};

export const FUND_TYPE_COLORS: Record<string, string> = {
  "货币型": "green",
  "债券型": "blue",
  "债券型-长债": "blue",
  "债券型-中短债": "blue",
  "债券型-混合债": "geekblue",
  "指数型-固收": "cyan",
  "混合型-偏债": "gold",
  "混合型-灵活": "orange",
  "混合型-偏股": "orange",
  "混合型-平衡": "gold",
  "指数型-股票": "cyan",
  "指数型-海外股票": "purple",
  "股票型": "red",
  "QDII": "purple",
  "QDII-纯债": "magenta",
};
