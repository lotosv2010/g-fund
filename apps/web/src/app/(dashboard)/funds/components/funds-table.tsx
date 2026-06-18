"use client";

import { Table, Button, Space, Tag, Progress, Dropdown, Modal } from "antd";
import { EditOutlined, FundOutlined, MoreOutlined, DeleteOutlined } from "@ant-design/icons";
import {
  VALUATION_LEVEL_LABELS,
  type ValuationLevel,
} from "@g-fund/types";
import { useRouter } from "next/navigation";
import type { ColumnsType, SorterResult } from "antd/es/table/interface";
import type { FundListItem } from "@g-fund/types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { DragHandle } from "./drag-handle";
import { SortableRow } from "./sortable-row";
import { RISK_LABELS, FUND_TYPE_COLORS } from "../constants";

interface FundsTableProps {
  dataSource: FundListItem[];
  loading: boolean;
  isCustomSort: boolean;
  onDragEnd: (event: DragEndEvent) => void;
  onEdit: (record: FundListItem) => void;
  onDelete: (code: string) => void;
  onTableChange: (
    pagination: unknown,
    filters: unknown,
    sorter: SorterResult<FundListItem> | SorterResult<FundListItem>[],
  ) => void;
}

export function FundsTable({
  dataSource,
  loading,
  isCustomSort,
  onDragEnd,
  onEdit,
  onDelete,
  onTableChange,
}: FundsTableProps) {
  const router = useRouter();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const columns: ColumnsType<FundListItem> = [
    {
      title: "",
      width: 40,
      render: (_, record) => (isCustomSort ? null : <DragHandle id={record.code} />),
    },
    { title: "基金代码", dataIndex: "code", width: 100 },
    { title: "基金名称", dataIndex: "name", width: 220, ellipsis: true, sorter: true },
    { title: "类型", dataIndex: "type", width: 130, sorter: true, render: (v) => v ? <Tag color={FUND_TYPE_COLORS[v]}>{v}</Tag> : "—" },
    {
      title: "风险等级",
      dataIndex: "riskLevel",
      width: 100,
      sorter: (a, b) => (a.riskLevel ?? 0) - (b.riskLevel ?? 0),
      render: (v) =>
        v ? <Tag color={RISK_LABELS[v]?.color}>{RISK_LABELS[v]?.label}</Tag> : "—",
    },
    {
      title: "目标金额",
      dataIndex: "targetAmount",
      width: 120,
      align: "right",
      sorter: (a, b) => parseFloat(a.targetAmount) - parseFloat(b.targetAmount),
      render: (v) => `¥${parseFloat(v).toLocaleString()}`,
    },
    {
      title: "目标比例",
      dataIndex: "targetRatio",
      width: 100,
      align: "right",
      sorter: (a, b) => parseFloat(a.targetRatio) - parseFloat(b.targetRatio),
      render: (v) => `${v}%`,
    },
    {
      title: "定投金额",
      dataIndex: "baseAmount",
      width: 100,
      align: "right",
      sorter: (a, b) => parseFloat(a.baseAmount) - parseFloat(b.baseAmount),
      render: (v) => {
        const n = parseFloat(v);
        return n > 0 ? `¥${n.toLocaleString()}` : "—";
      },
    },
    {
      title: "优先级",
      dataIndex: "priority",
      width: 80,
      align: "center",
      sorter: (a, b) => a.priority - b.priority,
      render: (v) => {
        const labels: Record<number, string> = { 0: "低", 1: "普通", 2: "较高", 3: "高" };
        const colors: Record<number, string> = { 0: "default", 1: "blue", 2: "orange", 3: "red" };
        return <Tag color={colors[v] ?? "default"}>{labels[v] ?? v}</Tag>;
      },
    },
    {
      title: "估值水平",
      dataIndex: "valuationLevel",
      width: 90,
      align: "center",
      sorter: (a, b) => {
        const order = { low: 0, normal: 1, high: 2 };
        const la = order[(a.valuationLevel ?? a.phase) as ValuationLevel] ?? 1;
        const lb = order[(b.valuationLevel ?? b.phase) as ValuationLevel] ?? 1;
        return la - lb;
      },
      render: (v, record) => {
        const level = (v ?? record.phase) as ValuationLevel | null;
        return level ? (
          <Tag color={level === "low" ? "green" : level === "high" ? "red" : "blue"}>
            {VALUATION_LEVEL_LABELS[level]}
          </Tag>
        ) : "—";
      },
    },
    {
      title: "估值百分位",
      dataIndex: "valuationPercentile",
      width: 130,
      align: "center",
      sorter: (a, b) => (parseFloat(a.valuationPercentile ?? "0") || 0) - (parseFloat(b.valuationPercentile ?? "0") || 0),
      render: (v) => {
        if (v === null || v === undefined) return "—";
        const p = parseFloat(v);
        return (
          <Progress
            percent={p}
            size="small"
            strokeColor={p <= 30 ? "#52c41a" : p >= 70 ? "#ff4d4f" : "#1677ff"}
            format={(val) => `${val}%`}
          />
        );
      },
    },
    {
      title: "备注",
      dataIndex: "note",
      ellipsis: true,
      render: (v) => v ?? "—",
    },
    {
      title: "操作",
      width: 120,
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
          >
            编辑
          </Button>
          <Dropdown
            menu={{
              items: [
                { key: "diagnose", label: <span style={{ color: "#1677ff" }}>诊断</span>, icon: <FundOutlined style={{ color: "#1677ff" }} /> },
                { type: "divider" as const },
                { key: "delete", label: "删除", icon: <DeleteOutlined />, danger: true },
              ],
              onClick: ({ key }) => {
                if (key === "diagnose") {
                  router.push(`/funds/${record.code}`);
                } else if (key === "delete") {
                  Modal.confirm({
                    title: "确认删除该基金？",
                    okText: "删除",
                    okButtonProps: { danger: true },
                    cancelText: "取消",
                    onOk: () => onDelete(record.code),
                  });
                }
              },
            }}
            trigger={["click"]}
          >
            <Button type="link" size="small" icon={<MoreOutlined />} style={{ color: "#1677ff" }} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext
        items={dataSource.map((f) => f.code)}
        strategy={verticalListSortingStrategy}
        disabled={isCustomSort}
      >
        <Table
          rowKey="code"
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          scroll={{ x: 1530 }}
          pagination={{ pageSize: 50, showTotal: (t) => `共 ${t} 支` }}
          size="middle"
          onChange={onTableChange}
          components={{ body: { row: SortableRow } }}
        />
      </SortableContext>
    </DndContext>
  );
}
