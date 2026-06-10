"use client";
import { Card, Tabs, Skeleton, Empty, Typography } from "antd";
import { PieChartOutlined } from "@ant-design/icons";
import { useMemo } from "react";
import type { AssetAllocationResponse, FundAssetDetail } from "@g-fund/types";
import { classifyFund, getGroupColor, getLevel2Color, ALLOCATION_GROUP_LABELS } from "@/lib/asset-class-mapping";
import type { AllocationGroup } from "@/lib/asset-class-mapping";

const { Text } = Typography;

interface AssetAllocationCardProps {
  data: AssetAllocationResponse | null;
  loading: boolean;
}

interface BarItem {
  name: string;
  amount: number;
  ratio: number;
  color: string;
}

function BarChart({ items, total }: { items: BarItem[]; total: number }) {
  if (items.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />;
  }

  const sorted = [...items].sort((a, b) => b.amount - a.amount);
  const maxRatio = sorted[0]?.ratio ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {sorted.map((item) => (
        <div key={item.name}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ fontSize: 13 }}>{item.name}</Text>
            <Text style={{ fontSize: 13 }}>
              <span style={{ color: "#888", marginRight: 8 }}>
                {`¥${item.amount.toLocaleString()}`}
              </span>
              <Text strong>{(item.ratio * 100).toFixed(1)}%</Text>
            </Text>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 4,
              background: "#f0f0f0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 4,
                width: `${Math.max((item.ratio / maxRatio) * 100, 2)}%`,
                background: item.color,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      ))}
      <div style={{ textAlign: "right", marginTop: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          合计：¥{total.toLocaleString()}
        </Text>
      </div>
    </div>
  );
}

function groupByLevel2(
  details: FundAssetDetail[],
  group: AllocationGroup,
): BarItem[] {
  const map = new Map<string, { amount: number; count: number }>();
  let totalAmount = 0;

  for (const d of details) {
    if (classifyFund(d) !== group) continue;
    const amount = parseFloat(d.currentValue);
    totalAmount += amount;
    const existing = map.get(d.level2Category) ?? { amount: 0, count: 0 };
    map.set(d.level2Category, {
      amount: existing.amount + amount,
      count: existing.count + 1,
    });
  }

  return Array.from(map, ([name, { amount }]) => ({
    name,
    amount: Math.round(amount * 100) / 100,
    ratio: totalAmount > 0 ? Math.round((amount / totalAmount) * 10000) / 10000 : 0,
    color: getLevel2Color(name),
  }));
}

function groupTotal(details: FundAssetDetail[], group: AllocationGroup): number {
  return details
    .filter((d) => classifyFund(d) === group)
    .reduce((sum, d) => sum + parseFloat(d.currentValue), 0);
}

export default function AssetAllocationCard({ data, loading }: AssetAllocationCardProps) {
  const details = useMemo(() => data?.fundDetails ?? [], [data]);

  const conservativeItems = useMemo(() => groupByLevel2(details, "conservative"), [details]);
  const coreItems = useMemo(() => groupByLevel2(details, "core"), [details]);
  const satelliteItems = useMemo(() => groupByLevel2(details, "satellite"), [details]);

  const conservativeTotal = useMemo(() => groupTotal(details, "conservative"), [details]);
  const coreTotal = useMemo(() => groupTotal(details, "core"), [details]);
  const satelliteTotal = useMemo(() => groupTotal(details, "satellite"), [details]);

  if (loading) {
    return (
      <Card title={<><PieChartOutlined /> 持仓分布</>} style={{ height: "100%" }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  if (!data || details.length === 0) {
    return (
      <Card title={<><PieChartOutlined /> 持仓分布</>} style={{ height: "100%" }}>
        <Empty description="暂无持仓数据" />
      </Card>
    );
  }

  const aggressiveTotal = coreTotal + satelliteTotal;

  const tabItems = [
    {
      key: "conservative",
      label: (
        <span>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: getGroupColor("conservative"),
              marginRight: 6,
            }}
          />
          {ALLOCATION_GROUP_LABELS.conservative}
          <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
            {`¥${Math.round(conservativeTotal).toLocaleString()}`}
          </Text>
        </span>
      ),
      children: <BarChart items={conservativeItems} total={conservativeTotal} />,
    },
    {
      key: "aggressive",
      label: (
        <span>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: getGroupColor("core"),
              marginRight: 6,
            }}
          />
          进阶
          <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
            {`¥${Math.round(aggressiveTotal).toLocaleString()}`}
          </Text>
        </span>
      ),
      children: (
        <Tabs
          size="small"
          items={[
            {
              key: "core",
              label: (
                <span>
                  {ALLOCATION_GROUP_LABELS.core}
                  <Text type="secondary" style={{ marginLeft: 4, fontSize: 11 }}>
                    {`¥${Math.round(coreTotal).toLocaleString()}`}
                  </Text>
                </span>
              ),
              children: <BarChart items={coreItems} total={coreTotal} />,
            },
            {
              key: "satellite",
              label: (
                <span>
                  {ALLOCATION_GROUP_LABELS.satellite}
                  <Text type="secondary" style={{ marginLeft: 4, fontSize: 11 }}>
                    {`¥${Math.round(satelliteTotal).toLocaleString()}`}
                  </Text>
                </span>
              ),
              children: <BarChart items={satelliteItems} total={satelliteTotal} />,
            },
          ]}
        />
      ),
    },
  ];

  return (
    <Card
      title={<><PieChartOutlined /> 持仓分布</>}
      style={{ height: "100%" }}
      styles={{ body: { padding: "12px 16px" } }}
    >
      <Tabs items={tabItems} />
    </Card>
  );
}
