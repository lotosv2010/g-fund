"use client";

import { useEffect } from "react";
import { Modal, Form, Input, InputNumber, Select } from "antd";
import type { FundListItem, CreateFundDto, FundCategory } from "@g-fund/types";
import { FUND_CATEGORIES, FUND_CATEGORY_LABELS } from "@g-fund/types";
import { RISK_LABELS, FUND_TYPE_OPTIONS } from "../constants";

interface FundFormModalProps {
  open: boolean;
  editingFund: FundListItem | null;
  submitting: boolean;
  defaultCategory: FundCategory;
  onSubmit: (values: CreateFundDto & { category: FundCategory }) => void;
  onCancel: () => void;
}

export function FundFormModal({
  open,
  editingFund,
  submitting,
  defaultCategory,
  onSubmit,
  onCancel,
}: FundFormModalProps) {
  const [form] = Form.useForm<CreateFundDto & { category: FundCategory }>();

  useEffect(() => {
    if (open && editingFund) {
      form.setFieldsValue({
        code: editingFund.code,
        name: editingFund.name,
        category: editingFund.category,
        type: editingFund.type ?? undefined,
        riskLevel: editingFund.riskLevel ?? undefined,
        targetRatio: editingFund.targetRatio ?? undefined,
        baseAmount: editingFund.baseAmount ?? undefined,
        priority: editingFund.priority ?? undefined,
        note: editingFund.note ?? undefined,
      });
    } else if (open) {
      form.setFieldsValue({ category: defaultCategory });
    }
  }, [open, editingFund, defaultCategory, form]);

  function handleCancel() {
    form.resetFields();
    onCancel();
  }

  return (
    <Modal
      title={editingFund ? "编辑基金" : "添加基金"}
      open={open}
      onCancel={handleCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      okText={editingFund ? "保存" : "添加"}
      cancelText="取消"
      width={520}
    >
      <Form form={form} layout="vertical" onFinish={onSubmit} style={{ marginTop: 16 }}>
        <Form.Item name="code" label="基金代码" rules={[{ required: true, message: "请输入基金代码" }]}>
          <Input placeholder="如 110022" maxLength={20} disabled={!!editingFund} />
        </Form.Item>
        <Form.Item name="name" label="基金名称" rules={[{ required: true, message: "请输入基金名称" }]}>
          <Input placeholder="如 易方达消费行业" maxLength={100} />
        </Form.Item>
        <Form.Item name="category" label="分类" rules={[{ required: true }]}>
          <Select>
            {FUND_CATEGORIES.map((cat) => (
              <Select.Option key={cat} value={cat}>
                {FUND_CATEGORY_LABELS[cat]}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="type" label="基金类型">
          <Select placeholder="请选择" allowClear>
            {FUND_TYPE_OPTIONS.map((t) => (
              <Select.Option key={t} value={t}>
                {t}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="riskLevel" label="风险等级">
          <Select placeholder="请选择" allowClear>
            {Object.entries(RISK_LABELS).map(([k, v]) => (
              <Select.Option key={k} value={Number(k)}>
                {v.label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="targetRatio" label="目标比例（%）" tooltip="占总仓位的目标占比，目标金额将自动计算">
          <InputNumber min={0} max={100} precision={2} style={{ width: "100%" }} placeholder="0.00" />
        </Form.Item>
        <Form.Item name="baseAmount" label="定投基础金额" tooltip="每期定投的基础金额，设为 0 或留空表示不定投">
          <InputNumber min={0} precision={2} style={{ width: "100%" }} placeholder="0.00" addonAfter="元" />
        </Form.Item>
        <Form.Item name="priority" label="定投优先级" tooltip="优先级越高，定投系数越大">
          <Select placeholder="请选择" allowClear>
            <Select.Option value={0}>0 - 低</Select.Option>
            <Select.Option value={1}>1 - 普通</Select.Option>
            <Select.Option value={2}>2 - 较高</Select.Option>
            <Select.Option value={3}>3 - 高</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="note" label="备注">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
