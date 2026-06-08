"use client";

import { useEffect } from "react";
import { Modal, Form, InputNumber } from "antd";

interface SettingsModalProps {
  open: boolean;
  submitting: boolean;
  initialValue: number;
  onSubmit: (values: { targetTotalPosition: number }) => void;
  onCancel: () => void;
}

export function SettingsModal({
  open,
  submitting,
  initialValue,
  onSubmit,
  onCancel,
}: SettingsModalProps) {
  const [form] = Form.useForm<{ targetTotalPosition: number }>();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({ targetTotalPosition: initialValue });
    }
  }, [open, initialValue, form]);

  function handleCancel() {
    form.resetFields();
    onCancel();
  }

  return (
    <Modal
      title="编辑目标总仓位"
      open={open}
      onCancel={handleCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      okText="保存"
      cancelText="取消"
      width={400}
    >
      <Form form={form} layout="vertical" onFinish={onSubmit} style={{ marginTop: 16 }}>
        <Form.Item
          name="targetTotalPosition"
          label="目标总仓位金额（元）"
          rules={[{ required: true, message: "请输入目标总仓位金额" }]}
        >
          <InputNumber min={0} precision={2} style={{ width: "100%" }} placeholder="0.00" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
