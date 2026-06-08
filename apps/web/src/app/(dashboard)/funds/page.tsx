"use client";
import { useState, useEffect, useCallback } from "react";
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
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { FundListItem, CreateFundDto, FundCategory } from "@g-fund/types";
import { FUND_CATEGORIES, FUND_CATEGORY_LABELS } from "@g-fund/types";
import { fundsApi } from "@/lib/api-client";

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
  const color = n > 0 ? "#16a34a" : n < 0 ? "#dc2626" : "#6b7280";
  const prefix = n > 0 ? "+" : "";
  return <span style={{ color }}>{prefix}{value}</span>;
}

const COLUMNS: ColumnsType<FundListItem> = [
  { title: "基金代码", dataIndex: "code", width: 100 },
  { title: "基金名称", dataIndex: "name", ellipsis: true },
  {
    title: "类型",
    dataIndex: "type",
    width: 100,
    render: (v) => v ?? "—",
  },
  {
    title: "风险等级",
    dataIndex: "riskLevel",
    width: 100,
    render: (v) =>
      v ? <Tag color={RISK_LABELS[v]?.color}>{RISK_LABELS[v]?.label}</Tag> : "—",
  },
  {
    title: "持仓金额",
    dataIndex: "costAmount",
    width: 120,
    align: "right",
    render: (v) => `¥${parseFloat(v).toLocaleString()}`,
  },
  {
    title: "当前市值",
    dataIndex: "currentValue",
    width: 120,
    align: "right",
    render: (v) => `¥${parseFloat(v).toLocaleString()}`,
  },
  {
    title: "持仓收益",
    dataIndex: "pnlAmount",
    width: 120,
    align: "right",
    render: (v) => <PnlCell value={`¥${parseFloat(v).toLocaleString()}`} />,
  },
  {
    title: "收益率",
    dataIndex: "pnlRate",
    width: 100,
    align: "right",
    render: (v) => <PnlCell value={`${(parseFloat(v) * 100).toFixed(2)}%`} />,
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
];

export default function FundsPage() {
  const [funds, setFunds] = useState<FundListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<FundCategory>("holding");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<CreateFundDto & { category: FundCategory }>();
  const [messageApi, contextHolder] = message.useMessage();

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

  const filteredFunds = funds.filter((f) => f.category === activeTab);

  const categoryCounts = FUND_CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat] = funds.filter((f) => f.category === cat).length;
      return acc;
    },
    {} as Record<FundCategory, number>,
  );

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

  const columns: ColumnsType<FundListItem> = [
    ...COLUMNS,
    {
      title: "操作",
      width: 80,
      fixed: "right",
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

  const tabItems = FUND_CATEGORIES.map((cat) => ({
    key: cat,
    label: `${FUND_CATEGORY_LABELS[cat]}（${categoryCounts[cat]}）`,
    children: (
      <Table
        rowKey="code"
        columns={columns}
        dataSource={filteredFunds}
        loading={loading}
        scroll={{ x: 1100 }}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 支` }}
        size="middle"
      />
    ),
  }));

  return (
    <>
      {contextHolder}
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
        </div>

        <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as FundCategory)} items={tabItems} />
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
