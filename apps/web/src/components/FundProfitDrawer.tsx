"use client";
import { useState, useEffect, useMemo } from "react";
import { Drawer, Table, Empty, Spin, Typography } from "antd";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import type { FundDailyPnl } from "@g-fund/types";
import type { ColumnsType } from "antd/es/table/interface";
import { dailySnapshotsApi } from "@/lib/api-client";

const { Text } = Typography;

const PROFIT_COLOR = "#dc2626";
const LOSS_COLOR = "#16a34a";

function PnlCell({ value, raw }: { value: string; raw?: number }) {
  const n = raw ?? parseFloat(value);
  const color = n > 0 ? PROFIT_COLOR : n < 0 ? LOSS_COLOR : "#6b7280";
  const prefix = n > 0 ? "+" : "";
  return <span style={{ color }}>{prefix}{value}</span>;
}

interface FundProfitDrawerProps {
  fundCode: string | null;
  fundName: string;
  open: boolean;
  onClose: () => void;
}

export default function FundProfitDrawer({ fundCode, fundName, open, onClose }: FundProfitDrawerProps) {
  const [data, setData] = useState<FundDailyPnl[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !fundCode) return;
    setLoading(true);
    dailySnapshotsApi
      .list()
      .then((snapshots) => {
        const rows: FundDailyPnl[] = [];
        for (const s of snapshots) {
          if (!s.positionsSnapshot) continue;
          const item = s.positionsSnapshot.find((p) => p.fundCode === fundCode);
          if (!item) continue;
          rows.push({
            snapshotDate: s.snapshotDate,
            fundCode: item.fundCode,
            fundName: item.fundName,
            pnlAmount: parseFloat(item.pnlAmount),
            pnlRate: parseFloat(item.pnlRate),
            costAmount: parseFloat(item.costAmount),
            currentValue: parseFloat(item.currentValue),
          });
        }
        rows.sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
        setData(rows);
      })
      .finally(() => setLoading(false));
  }, [open, fundCode]);

  const chartData = useMemo(
    () => data.map((d) => ({ date: d.snapshotDate.slice(5), pnl: d.pnlAmount })),
    [data],
  );

  const columns: ColumnsType<FundDailyPnl> = [
    { title: "日期", dataIndex: "snapshotDate", width: 110 },
    {
      title: "盈亏金额",
      dataIndex: "pnlAmount",
      width: 120,
      align: "right",
      render: (v: number) => <PnlCell value={`¥${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} raw={v} />,
    },
    {
      title: "盈亏率",
      dataIndex: "pnlRate",
      width: 100,
      align: "right",
      render: (v: number) => <PnlCell value={`${(v * 100).toFixed(2)}%`} raw={v} />,
    },
    {
      title: "成本金额",
      dataIndex: "costAmount",
      width: 120,
      align: "right",
      render: (v: number) => `¥${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    {
      title: "当前市值",
      dataIndex: "currentValue",
      width: 120,
      align: "right",
      render: (v: number) => `¥${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
  ];

  return (
    <Drawer
      title={`${fundName} — 收益明细`}
      open={open}
      onClose={onClose}
      size={720}
      destroyOnHidden
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: 80 }}><Spin /></div>
      ) : data.length === 0 ? (
        <Empty description="暂无快照数据" />
      ) : (
        <>
          <div style={{ background: "#fafafa", borderRadius: 8, padding: "16px 8px 16px 0", marginBottom: 24 }}>
            <ResponsiveContainer width="100%" height={Math.max(240, chartData.length * 32)}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid stroke="#f0f0f0" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  width={60}
                />
                <Tooltip
                  formatter={(val) => {
                    const n = Number(val ?? 0);
                    return [`${n >= 0 ? "+" : ""}¥${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, "盈亏"];
                  }}
                />
                <ReferenceLine x={0} stroke="#d9d9d9" />
                <Bar dataKey="pnl" radius={[0, 4, 4, 0]} barSize={20}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.pnl >= 0 ? PROFIT_COLOR : LOSS_COLOR} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <Table
            rowKey="snapshotDate"
            columns={columns}
            dataSource={data}
            pagination={{ pageSize: 15, showTotal: (t) => `共 ${t} 条` }}
            size="small"
            scroll={{ x: 600 }}
          />
        </>
      )}
    </Drawer>
  );
}
