"use client";
import { Card, Tabs, Skeleton, Empty, Typography } from "antd";
import { PieChartOutlined } from "@ant-design/icons";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { AssetAllocationResponse, FundAssetDetail } from "@g-fund/types";
import { classifyFund, getGroupColor, getLevel2Color, ALLOCATION_GROUP_LABELS } from "@/lib/asset-class-mapping";
import type { AllocationGroup } from "@/lib/asset-class-mapping";

const Column = dynamic(() => import("@ant-design/charts").then((m) => m.Column), { ssr: false });

const { Text } = Typography;

interface AssetAllocationCardProps {
  data: AssetAllocationResponse | null;
  loading: boolean;
}

interface ChartItem {
  category: string;
  amount: number;
  ratio: number;
  color: string;
  funds: { fundCode: string; fundName: string; currentValue: string }[];
}

function CategoryChart({
  items,
  total,
}: {
  items: ChartItem[];
  total: number;
}) {
  const sorted = useMemo(() => [...items].sort((a, b) => b.amount - a.amount), [items]);

  const chartData = useMemo(
    () => sorted.map((i) => ({ category: i.category, amount: Math.round(i.amount) })),
    [sorted],
  );

  const colorMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const i of sorted) m[i.category] = i.color;
    return m;
  }, [sorted]);

  const colorArray = useMemo(() => sorted.map((i) => i.color), [sorted]);

  const fundMap = useMemo(() => {
    const m: Record<string, ChartItem> = {};
    for (const i of sorted) m[i.category] = i;
    return m;
  }, [sorted]);

  if (items.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ fontSize: 11, color: "#999", paddingLeft: 4, marginBottom: 2 }}>¥ (万元)</div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Column
          data={chartData}
          xField="category"
          yField="amount"
          colorField="category"
          color={colorArray}
          legend={false}
          autoFit
          axis={{
            x: { labelAutoRotate: false, style: { labelFontSize: 11 } },
            y: {
              title: false,
              line: true,
              lineStroke: "#d9d9d9",
              lineLineWidth: 1,
              tick: true,
              tickStroke: "#d9d9d9",
              labelFormatter: (v: number) => `${(v / 10000).toFixed(1)}`,
            },
          }}
          style={{ radiusTopLeft: 4, radiusTopRight: 4 }}
          tooltip={{
            title: false,
            render: (
              _event: unknown,
              { title, items: tipItems }: { title?: string; items: { name?: string; value?: string | number }[] },
            ) => {
              const cat = String(title ?? tipItems?.[0]?.name ?? "");
              const item = fundMap[cat];
              const wrapper = document.createElement("div");
              if (!item) return wrapper;
              const rows = item.funds
                .map(
                  (f) =>
                    `<div style="display:flex;justify-content:space-between;font-size:12px;line-height:22px;gap:12px"><span>${f.fundName}</span><span style="color:#999;white-space:nowrap">¥${Math.round(parseFloat(f.currentValue)).toLocaleString()}</span></div>`,
                )
                .join("");
              wrapper.innerHTML = `<div style="padding:4px 0;min-width:220px"><div style="font-weight:600;font-size:13px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #f0f0f0">${item.category}：¥${Math.round(item.amount).toLocaleString()}</div>${rows}</div>`;
              return wrapper;
            },
          }}
          maxColumnWidth={48}
          columnWidthRatio={0.4}
        />
      </div>
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
): ChartItem[] {
  const map = new Map<string, { amount: number; funds: ChartItem["funds"] }>();
  let totalAmount = 0;

  for (const d of details) {
    if (classifyFund(d) !== group) continue;
    const amount = parseFloat(d.currentValue);
    totalAmount += amount;
    const existing = map.get(d.level2Category) ?? { amount: 0, funds: [] };
    existing.amount += amount;
    existing.funds.push({ fundCode: d.fundCode, fundName: d.fundName, currentValue: d.currentValue });
    map.set(d.level2Category, existing);
  }

  return Array.from(map, ([name, { amount, funds }]) => ({
    category: name,
    amount: Math.round(amount * 100) / 100,
    ratio: totalAmount > 0 ? Math.round((amount / totalAmount) * 10000) / 10000 : 0,
    color: getLevel2Color(name),
    funds,
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
      children: <CategoryChart items={conservativeItems} total={conservativeTotal} />,
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
          className="allocation-inner-tabs"
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
              children: <CategoryChart items={coreItems} total={coreTotal} />,
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
              children: <CategoryChart items={satelliteItems} total={satelliteTotal} />,
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
      styles={{ body: { padding: "12px 16px", display: "flex", flexDirection: "column", height: "100%" } }}
    >
      <style jsx global>{`
        .allocation-tabs .ant-tabs,
        .allocation-tabs .ant-tabs-content-holder,
        .allocation-tabs .ant-tabs-content,
        .allocation-tabs .ant-tabs-tabpane-active,
        .allocation-inner-tabs,
        .allocation-inner-tabs .ant-tabs-content-holder,
        .allocation-inner-tabs .ant-tabs-content,
        .allocation-inner-tabs .ant-tabs-tabpane-active {
          height: 100%;
        }
        .allocation-tabs .ant-tabs-nav,
        .allocation-inner-tabs .ant-tabs-nav {
          margin-bottom: 8px;
        }
      `}</style>
      <div className="allocation-tabs" style={{ flex: 1, minHeight: 0 }}>
        <Tabs items={tabItems} />
      </div>
    </Card>
  );
}
