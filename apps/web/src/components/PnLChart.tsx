"use client";
import { Card, Empty } from "antd";

export default function PnLChart() {
  return (
    <Card title="盈亏曲线" style={{ height: "100%" }}>
      <Empty
        description="盈亏曲线需接入 daily_snapshots 数据源，暂未实现"
        style={{ padding: "40px 0" }}
      />
    </Card>
  );
}
