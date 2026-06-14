"use client";
import { Card, Empty, Skeleton, Typography } from "antd";
import { PieChartOutlined } from "@ant-design/icons";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { IndustryExposureResponse } from "@g-fund/types";
import { getLevel2Color } from "@/lib/asset-class-mapping";

const Pie = dynamic(() => import("@ant-design/charts").then((m) => m.Pie), { ssr: false });

const { Text } = Typography;

interface IndustryExposureCardProps {
  data: IndustryExposureResponse | null;
  loading: boolean;
}

export default function IndustryExposureCard({ data, loading }: IndustryExposureCardProps) {
  const chartData = useMemo(
    () =>
      (data?.items ?? []).map((item) => ({
        industry: item.industry,
        amount: item.amount,
        ratio: item.ratio,
      })),
    [data],
  );

  const colorMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const item of chartData) {
      m[item.industry] = getLevel2Color(item.industry);
    }
    return m;
  }, [chartData]);

  const colors = useMemo(() => chartData.map((d) => colorMap[d.industry]), [chartData, colorMap]);

  if (loading) {
    return (
      <Card title={<><PieChartOutlined /> 行业暴露</>} style={{ height: "100%" }}>
        <Skeleton active paragraph={{ rows: 5 }} />
      </Card>
    );
  }

  if (!data || chartData.length === 0) {
    return (
      <Card title={<><PieChartOutlined /> 行业暴露</>} style={{ height: "100%" }}>
        <Empty description="暂无持仓数据" />
      </Card>
    );
  }

  return (
    <Card
      title={<><PieChartOutlined /> 行业暴露</>}
      style={{ height: "100%" }}
      styles={{ body: { padding: "12px 16px", display: "flex", flexDirection: "column", height: "calc(100% - 56px)", overflow: "hidden" } }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        <Pie
          height={280}
          data={chartData}
          angleField="amount"
          colorField="industry"
          color={colors}
          radius={0.85}
          innerRadius={0.55}
          legend={{
            position: "bottom",
            layout: "flex",
            maxRows: 3,
          }}
          label={false}
          tooltip={{
            title: (d: { industry?: string }) => d.industry ?? "",
            items: [
              (d: { amount?: number; ratio?: number }) => ({
                name: "金额",
                value: `¥${Math.round(d.amount ?? 0).toLocaleString()}`,
              }),
              (d: { amount?: number; ratio?: number }) => ({
                name: "占比",
                value: `${((d.ratio ?? 0) * 100).toFixed(1)}%`,
              }),
            ],
          }}
          statistic={{
            title: {
              style: { fontSize: 12, color: "#666" },
              content: "总持仓",
            },
            content: {
              style: { fontSize: 14, fontWeight: 600 },
              content: `¥${Math.round(data.totalAmount / 10000).toLocaleString()}万`,
            },
          }}
        />
      </div>
      <div style={{ textAlign: "right", marginTop: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          合计：¥{Math.round(data.totalAmount).toLocaleString()}
        </Text>
      </div>
    </Card>
  );
}
