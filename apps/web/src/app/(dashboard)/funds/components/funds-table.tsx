"use client";

import { Table, Button, Space, Popconfirm, Tag } from "antd";
import { EditOutlined } from "@ant-design/icons";
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
      title: "备注",
      dataIndex: "note",
      ellipsis: true,
      render: (v) => v ?? "—",
    },
    {
      title: "操作",
      width: 160,
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
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 50, showTotal: (t) => `共 ${t} 支` }}
          size="middle"
          onChange={onTableChange}
          components={{ body: { row: SortableRow } }}
        />
      </SortableContext>
    </DndContext>
  );
}
