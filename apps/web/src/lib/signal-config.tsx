import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type { SignalLevel } from "@g-fund/types";

interface SignalEntry {
  color: string;
  icon: React.ReactNode;
  label: string;
}

export const SIGNAL_CONFIG: Record<string, SignalEntry> = {
  take_profit: { color: "#52c41a", icon: <CheckCircleOutlined />, label: "止盈" },
  stop_loss: { color: "#ff4d4f", icon: <CloseCircleOutlined />, label: "止损" },
  warning: { color: "#faad14", icon: <WarningOutlined />, label: "预警" },
  deep_loss: { color: "#ff4d4f", icon: <CloseCircleOutlined />, label: "深度套牢" },
};

export const LEVEL_COLORS: Record<SignalLevel, string> = {
  green: "#52c41a",
  blue: "#1677ff",
  yellow: "#faad14",
  red: "#ff4d4f",
};

export function formatPnlRate(rate: string | null | undefined): string {
  if (!rate) return "--";
  return `${(parseFloat(rate) * 100).toFixed(2)}%`;
}
