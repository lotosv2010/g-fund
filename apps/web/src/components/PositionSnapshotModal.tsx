"use client";
import { Modal, Form, InputNumber, Select } from "antd";
import { useEffect, useMemo } from "react";
import type { FundListItem, UpsertPositionDto } from "@g-fund/types";

interface PositionSnapshotModalProps {
  open: boolean;
  funds: FundListItem[];
  defaultFundCode?: string;
  defaultCostAmount?: string;
  defaultCostPrice?: string;
  submitting?: boolean;
  onSubmit: (dto: UpsertPositionDto) => Promise<void> | void;
  onCancel: () => void;
}

interface FormValues {
  fundCode: string;
  costAmount: number;
  costPrice: number;
}

export default function PositionSnapshotModal({
  open,
  funds,
  defaultFundCode,
  defaultCostAmount,
  defaultCostPrice,
  submitting,
  onSubmit,
  onCancel,
}: PositionSnapshotModalProps) {
  const [form] = Form.useForm<FormValues>();
  const isEdit = !!defaultFundCode;

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      fundCode: defaultFundCode ?? "",
      costAmount: defaultCostAmount ? Number(defaultCostAmount) : undefined,
      costPrice: defaultCostPrice ? Number(defaultCostPrice) : undefined,
    });
  }, [open, defaultFundCode, defaultCostAmount, defaultCostPrice, form]);

  const fundOptions = useMemo(
    () => funds.map((f) => ({ label: `${f.code} ${f.name}`, value: f.code })),
    [funds],
  );

  async function handleOk() {
    const values = await form.validateFields();
    await onSubmit({
      fundCode: values.fundCode,
      costAmount: String(values.costAmount),
      costPrice: String(values.costPrice),
    });
    form.resetFields();
  }

  function handleCancel() {
    form.resetFields();
    onCancel();
  }

  return (
    <Modal
      title={isEdit ? `修正持仓 — ${defaultFundCode}` : "建仓快照"}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={submitting}
      okText="保存"
      cancelText="取消"
      destroyOnClose
      width={480}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="fundCode" label="基金" rules={[{ required: true, message: "请选择基金" }]}>
          <Select
            showSearch
            placeholder="选择基金"
            options={fundOptions}
            disabled={isEdit}
            filterOption={(input, opt) =>
              (opt?.label as string).toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item
          name="costAmount"
          label="持仓金额（元）"
          rules={[{ required: true, message: "请输入持仓金额" }]}
        >
          <InputNumber min={0.01} precision={2} style={{ width: "100%" }} placeholder="0.00" />
        </Form.Item>
        <Form.Item
          name="costPrice"
          label="成本净值"
          rules={[{ required: true, message: "请输入成本净值" }]}
          tooltip="持仓金额 ÷ 成本净值 = 份额，用于一键同步按净值计算市值"
        >
          <InputNumber min={0.0001} precision={4} style={{ width: "100%" }} placeholder="0.0000" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
