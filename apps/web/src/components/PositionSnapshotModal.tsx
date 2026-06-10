"use client";
import { Modal, Form, InputNumber, Select, Typography, Spin } from "antd";
import { useEffect, useMemo, useState, useCallback } from "react";
import type { FundListItem, UpsertPositionDto } from "@g-fund/types";
import { positionsApi } from "@/lib/api-client";

const { Text } = Typography;

interface PositionSnapshotModalProps {
  open: boolean;
  funds: FundListItem[];
  defaultFundCode?: string;
  defaultCurrentValue?: string;
  defaultPnlAmount?: string;
  submitting?: boolean;
  onSubmit: (dto: UpsertPositionDto) => Promise<void> | void;
  onCancel: () => void;
}

interface FormValues {
  fundCode: string;
  currentValue: number;
  pnlAmount: number;
  navUnit?: number;
}

export default function PositionSnapshotModal({
  open,
  funds,
  defaultFundCode,
  defaultCurrentValue,
  defaultPnlAmount,
  submitting,
  onSubmit,
  onCancel,
}: PositionSnapshotModalProps) {
  const [form] = Form.useForm<FormValues>();
  const isEdit = !!defaultFundCode;
  const [navLoading, setNavLoading] = useState(false);
  const [navError, setNavError] = useState(false);

  const fetchNav = useCallback(async (fundCode: string) => {
    setNavLoading(true);
    setNavError(false);
    try {
      const nav = await positionsApi.fetchNav(fundCode);
      form.setFieldsValue({ navUnit: parseFloat(nav.navUnit) });
    } catch {
      setNavError(true);
    } finally {
      setNavLoading(false);
    }
  }, [form]);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      fundCode: defaultFundCode ?? "",
      currentValue: defaultCurrentValue ? Number(defaultCurrentValue) : undefined,
      pnlAmount: defaultPnlAmount ? Number(defaultPnlAmount) : undefined,
    });
    if (defaultFundCode) {
      fetchNav(defaultFundCode);
    }
  }, [open, defaultFundCode, defaultCurrentValue, defaultPnlAmount, form, fetchNav]);

  const fundOptions = useMemo(
    () => funds.map((f) => ({ label: `${f.code} ${f.name}`, value: f.code })),
    [funds],
  );

  const currentValue = Form.useWatch("currentValue", form);
  const pnlAmount = Form.useWatch("pnlAmount", form);
  const navUnit = Form.useWatch("navUnit", form);

  // 本金 = 持有金额 - 持有收益
  const costAmount = currentValue != null && pnlAmount != null
    ? currentValue - pnlAmount
    : null;
  const shares = currentValue != null && navUnit != null && navUnit > 0
    ? currentValue / navUnit
    : null;
  const costPrice = shares != null && shares > 0 && costAmount != null
    ? costAmount / shares
    : null;
  const pnlRate = costAmount != null && costAmount > 0 && pnlAmount != null
    ? pnlAmount / costAmount
    : null;

  async function handleOk() {
    const values = await form.validateFields();
    const ca = values.currentValue - values.pnlAmount; // 本金
    const s = values.currentValue / (values.navUnit ?? 1); // 份额
    const cp = ca / s; // 成本净值
    await onSubmit({
      fundCode: values.fundCode,
      costAmount: ca.toFixed(2),
      costPrice: cp.toFixed(4),
      currentValue: values.currentValue.toFixed(2),
      shares: s.toFixed(4),
    });
    form.resetFields();
  }

  function handleCancel() {
    form.resetFields();
    onCancel();
  }

  function handleFundChange(fundCode: string) {
    form.setFieldsValue({ navUnit: undefined });
    fetchNav(fundCode);
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
      destroyOnHidden
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
            onChange={handleFundChange}
          />
        </Form.Item>
        <Form.Item
          name="currentValue"
          label="持有金额（元）"
          rules={[{ required: true, message: "请输入持有金额" }]}
          tooltip="当前持有的市值，即现在值多少钱"
        >
          <InputNumber min={0.01} precision={2} style={{ width: "100%" }} placeholder="如 9500.00" />
        </Form.Item>
        <Form.Item
          name="pnlAmount"
          label="持有收益（元）"
          rules={[{ required: true, message: "请输入持有收益" }]}
          tooltip="当前盈亏，正数为盈利，负数为亏损"
        >
          <InputNumber precision={2} style={{ width: "100%" }} placeholder="如 -500.00（亏损）或 800.00（盈利）" />
        </Form.Item>
        <Form.Item
          name="navUnit"
          label="基金净值"
          tooltip="自动获取当前净值，也可手动修改"
        >
          {navLoading ? (
            <Spin size="small" />
          ) : (
            <InputNumber
              min={0.0001}
              precision={4}
              style={{ width: "100%" }}
              placeholder={navError ? "自动获取失败，请手动输入" : "0.0000"}
              status={navError ? "error" : undefined}
            />
          )}
        </Form.Item>
        {costAmount != null && costAmount > 0 && (
          <div style={{ padding: "8px 12px", background: "#fafafa", borderRadius: 6, marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>计算结果：</Text>
            <div style={{ marginTop: 4, display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>本金（成本）</Text>
                <div>
                  <Text strong>{costAmount.toFixed(2)} 元</Text>
                </div>
              </div>
              {shares != null && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>持有份额</Text>
                  <div>
                    <Text strong>{shares.toFixed(2)}</Text>
                  </div>
                </div>
              )}
              {costPrice != null && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>成本净值</Text>
                  <div>
                    <Text strong>{costPrice.toFixed(4)}</Text>
                  </div>
                </div>
              )}
              {pnlRate != null && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>盈亏率</Text>
                  <div>
                    <Text
                      strong
                      style={{
                        color: pnlRate > 0 ? "#dc2626" : pnlRate < 0 ? "#16a34a" : "#6b7280",
                      }}
                    >
                      {pnlRate > 0 ? "+" : ""}{(pnlRate * 100).toFixed(2)}%
                    </Text>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Form>
    </Modal>
  );
}
