"use client";

import { Table, Button, Space, Popconfirm, Tag, Progress } from "antd";
import { EditOutlined, FundOutlined } from "@ant-design/icons";
import {
  VALUATION_LEVEL_LABELS,
  ASSET_TYPE_LABELS,
  type ValuationLevel,
  type AssetType,
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
import { RISK_LABELS } from "../constants";

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
    { title: "类型", dataIndex: "type", width: 100, render: (v) => v ?? "—" },
    {
      title: "风险等级",
      dataIndex: "riskLevel",
      width: 100,
      render: (v) =>
        v ? <Tag color={RISK_LABELS[v]?.color}>{RISK_LABELS[v]?.label}</Tag> : "—",
    },
    {
      title: "目标金额",
      dataIndex: "targetAmount",
      width: 120,
      align: "right",
      render: (v) => `¥${parseFloat(v).toLocaleString()}`,
    },
    {
      title: "目标比例",
      dataIndex: "targetRatio",
      width: 100,
      align: "right",
      render: (v) => `${v}%`,
    },
    {
      title: "定投金额",
      dataIndex: "baseAmount",
      width: 100,
      align: "right",
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
      title: "资产类型",
      dataIndex: "assetType",
      width: 90,
      align: "center",
      render: (v) => {
        const type = (v ?? "equity") as AssetType;
        const colors: Record<AssetType, string> = {
          equity: "blue",
          bond: "geekblue",
          gold: "gold",
          qdii: "magenta",
          index: "cyan",
        };
        return <Tag color={colors[type]}>{ASSET_TYPE_LABELS[type]}</Tag>;
      },
    },
    {
      title: "估值百分位",
      dataIndex: "valuationPercentile",
      width: 100,
      align: "center",
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
      width: 200,
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<FundOutlined />}
            onClick={() => router.push(`/funds/${record.code}`)}
          >
            诊断
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该基金？"
            onConfirm={() => onDelete(record.code)}
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
          >
            <Button type="link" danger size="small">
              删除
            </Button>
          </Popconfirm>
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
          scroll={{ x: 1600 }}
          pagination={{ pageSize: 50, showTotal: (t) => `共 ${t} 支` }}
          size="middle"
          onChange={onTableChange}
          components={{ body: { row: SortableRow } }}
        />
      </SortableContext>
    </DndContext>
  );
}
