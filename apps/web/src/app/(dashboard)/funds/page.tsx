"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Popconfirm,
  Typography,
  message,
  Tag,
  Tabs,
  Flex,
} from "antd";
import { PlusOutlined, HolderOutlined } from "@ant-design/icons";
import type { ColumnsType, SorterResult } from "antd/es/table/interface";
import type { FundListItem, CreateFundDto, FundCategory } from "@g-fund/types";
import { FUND_CATEGORIES, FUND_CATEGORY_LABELS } from "@g-fund/types";
import { fundsApi } from "@/lib/api-client";
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
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const { Title } = Typography;

const RISK_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "低风险", color: "green" },
  2: { label: "中低风险", color: "cyan" },
  3: { label: "中风险", color: "gold" },
  4: { label: "中高风险", color: "orange" },
  5: { label: "高风险", color: "red" },
};

function PnlCell({ value }: { value: string }) {
  const n = parseFloat(value);
  const color = n > 0 ? "#dc2626" : n < 0 ? "#16a34a" : "#6b7280";
  const prefix = n > 0 ? "+" : "";
  return <span style={{ color }}>{prefix}{value}</span>;
}

function DragHandle({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef } = useSortable({ id });
  return (
    <HolderOutlined
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ cursor: "grab", color: "#999", fontSize: 16 }}
    />
  );
}

function SortableRow(props: React.HTMLAttributes<HTMLTableRowElement> & { "data-row-key"?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props["data-row-key"] ?? "",
  });
  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { position: "relative" as const, zIndex: 9999, opacity: 0.8 } : {}),
  };
  return <tr {...props} ref={setNodeRef} style={style} {...attributes} {...listeners} />;
}

export default function FundsPage() {
  const [funds, setFunds] = useState<FundListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<FundCategory>("holding");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"ascend" | "descend" | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<CreateFundDto & { category: FundCategory }>();
  const [messageApi, contextHolder] = message.useMessage();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fundsApi.list();
      setFunds(data);
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => { load(); }, [load]);

  const isCustomSort = sortField !== null && sortOrder !== null;

  const categoryFunds = useMemo(() => {
    let list = funds.filter((f) => f.category === activeTab);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.name.toLowerCase().includes(q) || f.code.includes(q));
    }

    if (isCustomSort && sortField) {
      const dir = sortOrder === "ascend" ? 1 : -1;
      list = [...list].sort((a, b) => {
        const va = a[sortField as keyof FundListItem];
        const vb = b[sortField as keyof FundListItem];
        if (typeof va === "string" && typeof vb === "string") {
          return dir * va.localeCompare(vb);
        }
        return dir * (Number(va) - Number(vb));
      });
    }

    return list;
  }, [funds, activeTab, search, sortField, sortOrder, isCustomSort]);

  const categoryCounts = useMemo(() => {
    const counts: Record<FundCategory, number> = { holding: 0, longterm: 0, watchlist: 0 };
    for (const f of funds) {
      if (!search || f.name.toLowerCase().includes(search.toLowerCase()) || f.code.includes(search)) {
        counts[f.category]++;
      }
    }
    return counts;
  }, [funds, search]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categoryFunds.findIndex((f) => f.code === active.id);
    const newIndex = categoryFunds.findIndex((f) => f.code === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(categoryFunds, oldIndex, newIndex);
    const updated = funds.map((f) => {
      const idx = reordered.findIndex((r) => r.code === f.code);
      return idx !== -1 ? { ...f, sortOrder: idx } : f;
    });
    setFunds(updated);

    try {
      await fundsApi.reorder(reordered.map((f, i) => ({ code: f.code, sortOrder: i })));
      messageApi.success("排序已更新");
      load();
    } catch (e) {
      messageApi.error((e as Error).message);
      load();
    }
  }

  async function handleCreate(values: CreateFundDto & { category: FundCategory }) {
    setSubmitting(true);
    try {
      await fundsApi.create({
        ...values,
        category: values.category ?? activeTab,
        costAmount: values.costAmount ? String(values.costAmount) : undefined,
        currentValue: values.currentValue ? String(values.currentValue) : undefined,
        targetAmount: values.targetAmount ? String(values.targetAmount) : undefined,
        targetRatio: values.targetRatio ? String(values.targetRatio) : undefined,
      });
      messageApi.success("添加成功");
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(code: string) {
    try {
      await fundsApi.remove(code);
      messageApi.success("删除成功");
      load();
    } catch (e) {
      messageApi.error((e as Error).message);
    }
  }

  const sortableColumns: ColumnsType<FundListItem> = [
    {
      title: "",
      width: 40,
      render: (_, record) => isCustomSort ? null : <DragHandle id={record.code} />,
    },
    { title: "基金代码", dataIndex: "code", width: 100 },
    { title: "基金名称", dataIndex: "name", ellipsis: true, sorter: true },
    { title: "类型", dataIndex: "type", width: 100, render: (v) => v ?? "—" },
    {
      title: "风险等级", dataIndex: "riskLevel", width: 100,
      render: (v) => v ? <Tag color={RISK_LABELS[v]?.color}>{RISK_LABELS[v]?.label}</Tag> : "—",
    },
    {
      title: "持仓金额", dataIndex: "costAmount", width: 120, align: "right", sorter: true,
      render: (v) => `¥${parseFloat(v).toLocaleString()}`,
    },
    {
      title: "当前市值", dataIndex: "currentValue", width: 120, align: "right", sorter: true,
      render: (v) => `¥${parseFloat(v).toLocaleString()}`,
    },
    {
      title: "持仓收益", dataIndex: "pnlAmount", width: 120, align: "right", sorter: true,
      render: (v) => <PnlCell value={`¥${parseFloat(v).toLocaleString()}`} />,
    },
    {
      title: "收益率", dataIndex: "pnlRate", width: 100, align: "right", sorter: true,
      render: (v) => <PnlCell value={`${(parseFloat(v) * 100).toFixed(2)}%`} />,
    },
    {
      title: "目标金额", dataIndex: "targetAmount", width: 120, align: "right",
      render: (v) => `¥${parseFloat(v).toLocaleString()}`,
    },
    {
      title: "目标比例", dataIndex: "targetRatio", width: 100, align: "right",
      render: (v) => `${v}%`,
    },
    {
      title: "操作", width: 80, fixed: "right",
      render: (_, record) => (
        <Popconfirm
          title="确认删除该基金？"
          onConfirm={() => handleDelete(record.code)}
          okText="删除"
          okButtonProps={{ danger: true }}
          cancelText="取消"
        >
          <Button type="link" danger size="small">删除</Button>
        </Popconfirm>
      ),
    },
  ];

  function handleTableChange(_pagination: unknown, _filters: unknown, sorter: SorterResult<FundListItem> | SorterResult<FundListItem>[]) {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    if (s.field && s.order) {
      setSortField(s.field as string);
      setSortOrder(s.order);
    } else {
      setSortField(null);
      setSortOrder(null);
    }
  }

  const tableContent = (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={categoryFunds.map((f) => f.code)} strategy={verticalListSortingStrategy} disabled={isCustomSort}>
        <Table
          rowKey="code"
          columns={sortableColumns}
          dataSource={categoryFunds}
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 50, showTotal: (t) => `共 ${t} 支` }}
          size="middle"
          onChange={handleTableChange}
          components={{ body: { row: SortableRow } }}
        />
      </SortableContext>
    </DndContext>
  );

  const tabItems = FUND_CATEGORIES.map((cat) => ({
    key: cat,
    label: `${FUND_CATEGORY_LABELS[cat]}（${categoryCounts[cat]}）`,
    children: tableContent,
  }));

  return (
    <>
      {contextHolder}
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
        <Flex justify="space-between" align="center">
          <Title level={4} style={{ margin: 0 }}>基金列表</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.setFieldsValue({ category: activeTab });
              setModalOpen(true);
            }}
          >
            添加基金
          </Button>
        </Flex>

        <Input.Search
          value={search}
          placeholder="搜索基金名称或代码"
          allowClear
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          style={{ maxWidth: 320 }}
        />

        <Tabs activeKey={activeTab} onChange={(key) => { setActiveTab(key as FundCategory); setSortField(null); setSortOrder(null); }} items={tabItems} />
      </Space>

      <Modal
        title="添加基金"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText="添加"
        cancelText="取消"
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item name="code" label="基金代码" rules={[{ required: true, message: "请输入基金代码" }]}>
            <Input placeholder="如 110022" maxLength={20} />
          </Form.Item>
          <Form.Item name="name" label="基金名称" rules={[{ required: true, message: "请输入基金名称" }]}>
            <Input placeholder="如 易方达消费行业" maxLength={100} />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}>
            <Select>
              {FUND_CATEGORIES.map((cat) => (
                <Select.Option key={cat} value={cat}>{FUND_CATEGORY_LABELS[cat]}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="type" label="基金类型">
            <Select placeholder="请选择" allowClear>
              {["股票型", "混合型", "债券型", "货币型", "指数型"].map((t) => (
                <Select.Option key={t} value={t}>{t}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="riskLevel" label="风险等级">
            <Select placeholder="请选择" allowClear>
              {Object.entries(RISK_LABELS).map(([k, v]) => (
                <Select.Option key={k} value={Number(k)}>{v.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="costAmount" label="持仓金额（元）">
            <InputNumber min={0} precision={2} style={{ width: "100%" }} placeholder="0.00" />
          </Form.Item>
          <Form.Item name="currentValue" label="当前市值（元）">
            <InputNumber min={0} precision={2} style={{ width: "100%" }} placeholder="0.00" />
          </Form.Item>
          <Form.Item name="targetAmount" label="目标金额（元）">
            <InputNumber min={0} precision={2} style={{ width: "100%" }} placeholder="0.00" />
          </Form.Item>
          <Form.Item name="targetRatio" label="目标比例（%）">
            <InputNumber min={0} max={100} precision={2} style={{ width: "100%" }} placeholder="0.00" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
