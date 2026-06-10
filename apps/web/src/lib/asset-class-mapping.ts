import type { FundAssetDetail } from "@g-fund/types";

export type AllocationGroup = "conservative" | "core" | "satellite";

export const ALLOCATION_GROUP_LABELS: Record<AllocationGroup, string> = {
  conservative: "稳健",
  core: "核心",
  satellite: "卫星",
};

// 进阶-核心：均衡风格 + 海外 + 黄金
const CORE_KEYWORDS = ["均衡", "海外", "黄金", "白银"];

// 进阶-卫星：具体行业板块
const SATELLITE_KEYWORDS = ["消费", "医药", "科技", "制造", "金融", "资源", "能源", "地产", "军工", "新能源"];

export function classifyFund(detail: FundAssetDetail): AllocationGroup {
  const { topCategory, level2Category } = detail;

  // 货币现金、债券固收 → 稳健
  if (topCategory === "货币现金" || topCategory === "债券固收") {
    return "conservative";
  }

  // 股票权益下的细分
  if (topCategory === "股票权益") {
    for (const kw of SATELLITE_KEYWORDS) {
      if (level2Category.includes(kw)) return "satellite";
    }
    for (const kw of CORE_KEYWORDS) {
      if (level2Category.includes(kw)) return "core";
    }
    // 默认归入核心
    return "core";
  }

  // 另类及其他（黄金等）→ 核心
  if (topCategory === "另类及其他") {
    return "core";
  }

  // 未分类 → 核心
  return "core";
}

export function getGroupColor(group: AllocationGroup): string {
  switch (group) {
    case "conservative":
      return "#4FA3F3";
    case "core":
      return "#7c3aed";
    case "satellite":
      return "#ea580c";
  }
}

export function getLevel2Color(level2Name: string): string {
  const colorMap: Record<string, string> = {
    货币现金: "#4FA3F3",
    纯债: "#FFC053",
    一级债: "#FFD07E",
    二级债: "#FFDC9E",
    大盘均衡: "#7c3aed",
    中盘均衡: "#8b5cf6",
    小盘均衡: "#a78bfa",
    风格均衡: "#c4b5fd",
    海外股票: "#6366f1",
    黄金白银: "#f59e0b",
    消费: "#ea580c",
    医药: "#dc2626",
    科技: "#2563eb",
    制造: "#16a34a",
    金融: "#0891b2",
    资源: "#78716c",
    能源: "#a16207",
    地产: "#9333ea",
    军工: "#475569",
    新能源: "#059669",
  };
  return colorMap[level2Name] ?? "#6b7280";
}
