"use client";
import { Card, Typography, Skeleton, Empty, Row, Col, Space, Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import type { PositionListItem, BenchmarkComparisonResponse } from "@g-fund/types";
import { useMemo } from "react";

const { Text, Title } = Typography;

const COLORS = ["#2563eb", "#16a34a", "#ea580c", "#7c3aed", "#db2777", "#0891b2"];

interface ReturnAttributionCardProps {
  positions: PositionListItem[];
  benchmark: BenchmarkComparisonResponse | null;
  loading: boolean;
}

interface AttributionItem {
  name: string;
  value: number;
  color: string;
}

interface FundContribution {
  fundCode: string;
  fundName: string;
  displayName: string;
  contribution: number;
}

export default function ReturnAttributionCard({ positions, benchmark, loading }: ReturnAttributionCardProps) {
  const attribution = useMemo(() => {
    if (positions.length === 0) return null;

    const safeNum = (v: unknown) => {
      const n = typeof v === "string" ? parseFloat(v) : Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const totalCost = positions.reduce((sum, p) => sum + safeNum(p.costAmount), 0);
    const totalValue = positions.reduce((sum, p) => sum + safeNum(p.currentValue), 0);
    const totalPnl = totalValue - totalCost;
    const totalReturn = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    // 计算基准收益
    let benchmarkReturn = 0;
    if (benchmark && benchmark.points.length >= 2) {
      const first = benchmark.points[0];
      const last = benchmark.points[benchmark.points.length - 1];
      benchmarkReturn = ((last.benchmarkCumReturn ?? 0) - (first.benchmarkCumReturn ?? 0)) * 100;
    }

    const excessReturn = totalReturn - benchmarkReturn;

    // 按基金类型分组，如果只有一类则按基金名称分组
    const typeGroups = new Map<string, { cost: number; value: number }>();
    for (const pos of positions) {
      const type = pos.type || null;
      if (type) {
        const group = typeGroups.get(type) ?? { cost: 0, value: 0 };
        group.cost += safeNum(pos.costAmount);
        group.value += safeNum(pos.currentValue);
        typeGroups.set(type, group);
      }
    }

    // type 不足 2 种时，尝试按 category 分组
    if (typeGroups.size <= 1) {
      typeGroups.clear();
      for (const pos of positions) {
        const cat = pos.category || '其他';
        const group = typeGroups.get(cat) ?? { cost: 0, value: 0 };
        group.cost += safeNum(pos.costAmount);
        group.value += safeNum(pos.currentValue);
        typeGroups.set(cat, group);
      }
    }

    // category 也不足 2 种时，按基金名称分组
    let useFundName = typeGroups.size <= 1;
    if (useFundName) {
      typeGroups.clear();
      for (const pos of positions) {
        const name = pos.fundName.length > 6 ? pos.fundName.slice(0, 6) + "..." : pos.fundName;
        typeGroups.set(name, {
          cost: safeNum(pos.costAmount),
          value: safeNum(pos.currentValue),
        });
      }
    }

    // 计算各类型贡献
    const typeContributions: AttributionItem[] = [];
    for (const [name, group] of typeGroups) {
      const typePnl = group.value - group.cost;
      const contribution = totalCost > 0 ? (typePnl / totalCost) * 100 : 0;
      typeContributions.push({
        name,
        value: Math.round(contribution * 100) / 100,
        color: COLORS[typeContributions.length % COLORS.length],
      });
    }

    // 按贡献绝对值排序
    typeContributions.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    // 按基金计算贡献
    const fundContributions: FundContribution[] = positions
      .map((pos) => {
        const cost = safeNum(pos.costAmount);
        const value = safeNum(pos.currentValue);
        const pnl = value - cost;
        const contribution = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
        return {
          fundCode: pos.fundCode,
          fundName: pos.fundName,
          displayName: pos.fundName.length > 6 ? pos.fundName.slice(0, 6) + "..." : pos.fundName,
          contribution: Math.round(contribution * 100) / 100,
        };
      })
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, 5);

    return {
      totalReturn: Math.round(totalReturn * 100) / 100,
      benchmarkReturn: Math.round(benchmarkReturn * 100) / 100,
      excessReturn: Math.round(excessReturn * 100) / 100,
      typeContributions,
      fundContributions,
    };
  }, [positions, benchmark]);

  if (loading) {
    return (
      <Card title={<span>收益归因分析 <Tooltip title="分析组合收益的来源构成。超额收益 = 组合收益率 - 基准收益率。展示各资产类型和 Top 5 基金对总收益的贡献度"><InfoCircleOutlined style={{ fontSize: 13, color: "#999" }} /></Tooltip></span>} style={{ height: "100%" }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  if (!attribution) {
    return (
      <Card title={<span>收益归因分析 <Tooltip title="分析组合收益的来源构成。超额收益 = 组合收益率 - 基准收益率。展示各资产类型和 Top 5 基金对总收益的贡献度"><InfoCircleOutlined style={{ fontSize: 13, color: "#999" }} /></Tooltip></span>} style={{ height: "100%" }}>
        <Empty description="暂无持仓数据" />
      </Card>
    );
  }

  return (
    <Card title={<span>收益归因分析 <Tooltip title="分析组合收益的来源构成。超额收益 = 组合收益率 - 基准收益率。展示各资产类型和 Top 5 基金对总收益的贡献度"><InfoCircleOutlined style={{ fontSize: 13, color: "#999" }} /></Tooltip></span>}>
      <Row gutter={[24, 16]}>
        <Col span={24}>
          <Space size="large">
            <div>
              <Text type="secondary">组合收益</Text>
              <div>
                <Title
                  level={4}
                  style={{
                    margin: 0,
                    color: attribution.totalReturn >= 0 ? "#dc2626" : "#16a34a",
                  }}
                >
                  {attribution.totalReturn >= 0 ? "+" : ""}{attribution.totalReturn.toFixed(2)}%
                </Title>
              </div>
            </div>
            <div>
              <Text type="secondary">基准收益</Text>
              <div>
                <Title
                  level={4}
                  style={{
                    margin: 0,
                    color: attribution.benchmarkReturn >= 0 ? "#dc2626" : "#16a34a",
                  }}
                >
                  {attribution.benchmarkReturn >= 0 ? "+" : ""}{attribution.benchmarkReturn.toFixed(2)}%
                </Title>
              </div>
            </div>
            <div>
              <Text type="secondary">超额收益</Text>
              <div>
                <Title
                  level={4}
                  style={{
                    margin: 0,
                    color: attribution.excessReturn >= 0 ? "#1677ff" : "#ff4d4f",
                  }}
                >
                  {attribution.excessReturn >= 0 ? "+" : ""}{attribution.excessReturn.toFixed(2)}%
                </Title>
              </div>
            </div>
          </Space>
        </Col>
        <Col xs={24} lg={12}>
          <Text strong style={{ marginBottom: 12, display: "block" }}>资产类型贡献</Text>
          {attribution.typeContributions.length === 0 ? (
            <Empty description="暂无收益差异" style={{ padding: "40px 0" }} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={attribution.typeContributions}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name} ${value >= 0 ? "+" : ""}${value.toFixed(1)}%`}
                >
                  {attribution.typeContributions.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value) => [`${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}%`, "贡献"]}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Col>
        <Col xs={24} lg={12}>
          <Text strong style={{ marginBottom: 12, display: "block" }}>Top 5 基金贡献</Text>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={attribution.fundContributions} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => `${v}%`} />
              <YAxis
                type="category"
                dataKey="displayName"
                width={70}
                tick={{ fontSize: 12 }}
              />
              <RechartsTooltip
                formatter={(value, name, props) => {
                  const item = props.payload as FundContribution;
                  return [`${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}%`, item.fundName];
                }}
              />
              <Bar
                dataKey="contribution"
                fill="#1677ff"
                radius={[0, 4, 4, 0]}
                label={{
                  position: "right",
                  formatter: (v) => `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(1)}%`,
                  fontSize: 11,
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </Col>
      </Row>
    </Card>
  );
}
