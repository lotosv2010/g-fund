"use client";
import { useState } from "react";
import { Form, Input, InputNumber, Select, Button, DatePicker, message, Space } from "antd";
import type { CreateTransactionDto, FundListItem } from "@g-fund/types";
import dayjs from "dayjs";

interface TransactionFormProps {
  funds: FundListItem[];
  onSubmit: (dto: CreateTransactionDto) => Promise<void>;
}

export default function TransactionForm({ funds, onSubmit }: TransactionFormProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [txType, setTxType] = useState<"buy" | "sell">("buy");
  const [messageApi, contextHolder] = message.useMessage();

  async function handleFinish(values: Record<string, unknown>) {
    setSubmitting(true);
    try {
      await onSubmit({
        fundCode: values.fundCode as string,
        type: txType,
        amount: String(values.amount),
        shares: values.shares != null ? String(values.shares) : undefined,
        price: values.price != null ? String(values.price) : undefined,
        tradeDate: (values.tradeDate as dayjs.Dayjs).format("YYYY-MM-DD"),
        note: values.note as string | undefined,
      });
      messageApi.success(txType === "buy" ? "买入成功" : "卖出成功");
      form.resetFields();
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {contextHolder}
      <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={{ tradeDate: dayjs(), type: "buy" }}>
        <Form.Item name="type" label="交易类型" rules={[{ required: true }]}>
          <Select onChange={(v) => setTxType(v)}>
            <Select.Option value="buy">买入</Select.Option>
            <Select.Option value="sell">卖出</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="fundCode" label="基金" rules={[{ required: true, message: "请选择基金" }]}>
          <Select
            showSearch
            placeholder="选择基金"
            optionFilterProp="label"
            options={funds.map((f) => ({ value: f.code, label: `${f.code} ${f.name}` }))}
          />
        </Form.Item>
        <Form.Item name="amount" label="交易金额（元）" rules={[{ required: true, message: "请输入金额" }]}>
          <InputNumber min={0} precision={2} style={{ width: "100%" }} placeholder="0.00" />
        </Form.Item>
        <Form.Item name="shares" label="交易份额">
          <InputNumber min={0} precision={4} style={{ width: "100%" }} placeholder="可选" />
        </Form.Item>
        <Form.Item name="price" label="交易净值">
          <InputNumber min={0} precision={4} style={{ width: "100%" }} placeholder="可选" />
        </Form.Item>
        <Form.Item name="tradeDate" label="交易日期" rules={[{ required: true }]}>
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="note" label="备注">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {txType === "buy" ? "确认买入" : "确认卖出"}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </>
  );
}
