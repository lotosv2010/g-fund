"use client";
import { useState, useEffect } from "react";
import { Form, Input, InputNumber, Select, Button, DatePicker, message, Space } from "antd";
import type { CreateTransactionDto, FundListItem } from "@g-fund/types";
import dayjs from "dayjs";

interface TransactionFormProps {
  funds: FundListItem[];
  onSubmit: (dto: CreateTransactionDto) => Promise<void>;
  defaultFundCode?: string;
  defaultType?: "buy" | "sell";
  availableShares?: number;
  positions?: Array<{ fundCode: string; shares: string }>;
}

export default function TransactionForm({ funds, onSubmit, defaultFundCode, defaultType, availableShares, positions }: TransactionFormProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [txType, setTxType] = useState<"buy" | "sell">(defaultType ?? "buy");
  const [selectedFundCode, setSelectedFundCode] = useState<string>(defaultFundCode ?? "");
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const values: Record<string, unknown> = { tradeDate: dayjs() };
    if (defaultFundCode) {
      values.fundCode = defaultFundCode;
      setSelectedFundCode(defaultFundCode);
    }
    if (defaultType) values.type = defaultType;
    form.setFieldsValue(values);
    if (defaultType) setTxType(defaultType);
  }, [defaultFundCode, defaultType, form]);

  useEffect(() => {
    form.setFieldsValue({ amount: undefined, shares: undefined, price: undefined });
  }, [txType, form]);

  const currentShares = availableShares ?? (positions && selectedFundCode
    ? parseFloat(positions.find((p) => p.fundCode === selectedFundCode)?.shares ?? "0")
    : 0);

  async function handleFinish(values: Record<string, unknown>) {
    setSubmitting(true);
    try {
      const shares = values.shares != null ? parseFloat(String(values.shares)) : undefined;
      const price = values.price != null ? parseFloat(String(values.price)) : undefined;
      const amount = txType === "buy"
        ? String(values.amount)
        : shares != null
          ? (shares * (price ?? 0)).toFixed(2)
          : "0";

      await onSubmit({
        fundCode: values.fundCode as string,
        type: txType,
        amount,
        shares: shares != null ? String(shares) : undefined,
        price: price != null ? String(price) : undefined,
        tradeDate: (values.tradeDate as dayjs.Dayjs).format("YYYY-MM-DD"),
        note: values.note as string | undefined,
      });
      messageApi.success(txType === "buy" ? "买入已提交，待确认" : "卖出已提交，待确认");
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
            disabled={!!defaultFundCode}
            options={funds.map((f) => ({ value: f.code, label: `${f.code} ${f.name}` }))}
            onChange={(v) => setSelectedFundCode(v)}
          />
        </Form.Item>
        {txType === "buy" ? (
          <>
            <Form.Item name="amount" label="交易金额（元）" rules={[{ required: true, message: "请输入金额" }]}>
              <InputNumber min={0} precision={2} style={{ width: "100%" }} placeholder="0.00" />
            </Form.Item>
            <Form.Item name="price" label="交易净值">
              <InputNumber min={0} precision={4} style={{ width: "100%" }} placeholder="可选" />
            </Form.Item>
          </>
        ) : (
          <>
            <Form.Item name="shares" label="卖出份额" rules={[{ required: true, message: "请输入份额" }]}>
              <InputNumber min={0} precision={4} style={{ width: "100%" }} placeholder="0.0000" />
            </Form.Item>
            {currentShares > 0 && (
              <div style={{ marginTop: -16, marginBottom: 16 }}>
                <Space size="small">
                  <Button
                    size="small"
                    onClick={() => form.setFieldsValue({ shares: currentShares })}
                  >
                    全部
                  </Button>
                  <Button
                    size="small"
                    onClick={() => form.setFieldsValue({ shares: +(currentShares / 2).toFixed(4) })}
                  >
                    1/2
                  </Button>
                  <Button
                    size="small"
                    onClick={() => form.setFieldsValue({ shares: +(currentShares / 3).toFixed(4) })}
                  >
                    1/3
                  </Button>
                  <Button
                    size="small"
                    onClick={() => form.setFieldsValue({ shares: +(currentShares / 4).toFixed(4) })}
                  >
                    1/4
                  </Button>
                  <Button
                    size="small"
                    onClick={() => form.setFieldsValue({ shares: +(currentShares / 5).toFixed(4) })}
                  >
                    1/5
                  </Button>
                </Space>
              </div>
            )}
            <Form.Item name="price" label="交易净值">
              <InputNumber min={0} precision={4} style={{ width: "100%" }} placeholder="可选" />
            </Form.Item>
          </>
        )}
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
