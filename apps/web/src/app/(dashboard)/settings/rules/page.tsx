"use client";

import { useEffect, useState } from "react";
import {
  Card, Button, App, InputNumber, Table, Space, Typography, Divider, Tag, DatePicker,
} from "antd";
import dayjs from "dayjs";
import { SaveOutlined, UndoOutlined } from "@ant-design/icons";
import type { DcaRules, SlpRules, ValuationLevel, SignalLevel } from "@g-fund/types";
import { DEFAULT_DCA_RULES, DEFAULT_SLP_RULES, VALUATION_LEVEL_LABELS } from "@g-fund/types";
import { rulesApi } from "@/lib/api-client";

const { Text } = Typography;

const SIGNAL_LEVEL_COLORS: Record<SignalLevel, string> = {
  green: "green",
  blue: "blue",
  yellow: "gold",
  red: "red",
};

const SIGNAL_LEVEL_NAMES: Record<SignalLevel, string> = {
  green: "正常",
  blue: "低估",
  yellow: "接近止损",
  red: "接近止盈",
};

export default function RulesSettingsPage() {
  const { message } = App.useApp();
  const [dcaRules, setDcaRules] = useState<DcaRules>(DEFAULT_DCA_RULES);
  const [slpRules, setSlpRules] = useState<SlpRules>(DEFAULT_SLP_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      rulesApi.getDca().catch(() => DEFAULT_DCA_RULES),
      rulesApi.getSlp().catch(() => DEFAULT_SLP_RULES),
    ]).then(([dca, slp]) => {
      setDcaRules(dca);
      setSlpRules(slp);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await Promise.all([rulesApi.setDca(dcaRules), rulesApi.setSlp(slpRules)]);
      message.success("规则已保存");
    } catch (e) {
      message.error((e as Error).message ?? "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetDca() {
    try {
      const rules = await rulesApi.resetDca();
      setDcaRules(rules);
      message.success("定投规则已恢复默认");
    } catch (e) {
      message.error((e as Error).message ?? "重置失败");
    }
  }

  async function handleResetSlp() {
    try {
      const rules = await rulesApi.resetSlp();
      setSlpRules(rules);
      message.success("止盈止损规则已恢复默认");
    } catch (e) {
      message.error((e as Error).message ?? "重置失败");
    }
  }

  function updateP2(index: number, field: "max" | "multiplier", value: number) {
    setDcaRules((prev) => {
      const next = { ...prev, valuationPercentiles: [...prev.valuationPercentiles] };
      next.valuationPercentiles[index] = { ...next.valuationPercentiles[index], [field]: value };
      return next;
    });
  }

  function updateP3(level: ValuationLevel, value: number) {
    setDcaRules((prev) => ({
      ...prev,
      valuationLevelMultipliers: { ...prev.valuationLevelMultipliers, [level]: value },
    }));
  }

  function updateP4(index: number, field: "minPriority" | "multiplier", value: number) {
    setDcaRules((prev) => {
      const next = { ...prev, priorityMultipliers: [...prev.priorityMultipliers] };
      next.priorityMultipliers[index] = { ...next.priorityMultipliers[index], [field]: value };
      return next;
    });
  }

  function updateTakeProfit(index: number, value: number) {
    setSlpRules((prev) => {
      const next = { ...prev, takeProfitTiers: [...prev.takeProfitTiers] };
      next.takeProfitTiers[index] = { ...next.takeProfitTiers[index], threshold: value };
      return next;
    });
  }

  function updateStopLoss(index: number, value: number) {
    setSlpRules((prev) => {
      const next = { ...prev, stopLossTiers: [...prev.stopLossTiers] };
      next.stopLossTiers[index] = { ...next.stopLossTiers[index], threshold: value };
      return next;
    });
  }

  return (
    <div style={{ maxWidth: 680 }}>
      {/* DCA 定投规则 */}
      <Card
        title="DCA 定投系数"
        loading={loading}
        variant="borderless"
        style={{ marginBottom: 16 }}
        extra={
          <Button size="small" icon={<UndoOutlined />} onClick={handleResetDca}>
            恢复默认
          </Button>
        }
      >
        <Text strong style={{ fontSize: 13 }}>P2 估值百分位系数</Text>
        <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
          估值百分位 ≤ 对应值时使用该系数，越低估越加倍
        </Text>
        <Table
          size="small"
          pagination={false}
          dataSource={dcaRules.valuationPercentiles.map((r, i) => ({ ...r, key: i }))}
          columns={[
            {
              title: "百分位 ≤",
              dataIndex: "max",
              width: 120,
              render: (v: number, _: unknown, i: number) => (
                <InputNumber
                  size="small"
                  min={0} max={100}
                  value={v}
                  onChange={(val) => val !== null && updateP2(i, "max", val)}
                  addonAfter="%"
                  style={{ width: "100%" }}
                />
              ),
            },
            {
              title: "系数",
              dataIndex: "multiplier",
              width: 120,
              render: (v: number, _: unknown, i: number) => (
                <InputNumber
                  size="small"
                  min={0} max={10} step={0.1}
                  value={v}
                  onChange={(val) => val !== null && updateP2(i, "multiplier", val)}
                  addonAfter="x"
                  style={{ width: "100%" }}
                />
              ),
            },
          ]}
        />

        <Divider style={{ margin: "16px 0 12px" }} />
        <Text strong style={{ fontSize: 13 }}>P3 估值水平系数</Text>
        <div style={{ display: "flex", gap: 16, marginTop: 8, marginBottom: 16 }}>
          {(["low", "normal", "high"] as ValuationLevel[]).map((level) => (
            <Space key={level} orientation="vertical" size={2} style={{ flex: 1 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{VALUATION_LEVEL_LABELS[level]}</Text>
              <InputNumber
                size="small"
                min={0} max={10} step={0.1}
                value={dcaRules.valuationLevelMultipliers[level]}
                onChange={(v) => v !== null && updateP3(level, v)}
                addonAfter="x"
                style={{ width: "100%" }}
              />
            </Space>
          ))}
        </div>

        <Divider style={{ margin: "16px 0 12px" }} />
        <Text strong style={{ fontSize: 13 }}>P4 优先级系数</Text>
        <Table
          size="small"
          pagination={false}
          dataSource={dcaRules.priorityMultipliers.map((r, i) => ({ ...r, key: i }))}
          columns={[
            {
              title: "优先级 ≥",
              dataIndex: "minPriority",
              width: 120,
              render: (v: number, _: unknown, i: number) => (
                <InputNumber
                  size="small"
                  min={0} max={10}
                  value={v}
                  onChange={(val) => val !== null && updateP4(i, "minPriority", val)}
                  style={{ width: "100%" }}
                />
              ),
            },
            {
              title: "系数",
              dataIndex: "multiplier",
              width: 120,
              render: (v: number, _: unknown, i: number) => (
                <InputNumber
                  size="small"
                  min={0} max={10} step={0.1}
                  value={v}
                  onChange={(val) => val !== null && updateP4(i, "multiplier", val)}
                  addonAfter="x"
                  style={{ width: "100%" }}
                />
              ),
            },
          ]}
        />

        <Divider style={{ margin: "16px 0 12px" }} />
        <Text strong style={{ fontSize: 13 }}>P1 当日大盘检查</Text>
        <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
          沪深300涨跌幅超过阈值时暂缓或加仓
        </Text>
        <div style={{ display: "flex", gap: 16, marginTop: 8, marginBottom: 16 }}>
          <Space orientation="vertical" size={2} style={{ flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>暂缓阈值（涨 &gt;）</Text>
            <InputNumber
              min={0} max={10} step={0.5}
              value={dcaRules.p1Thresholds.up}
              onChange={(v) => v !== null && setDcaRules((prev) => ({
                ...prev,
                p1Thresholds: { ...prev.p1Thresholds, up: v },
              }))}
              addonAfter="%"
              style={{ width: "100%" }}
            />
          </Space>
          <Space orientation="vertical" size={2} style={{ flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>加仓阈值（跌 &lt;）</Text>
            <InputNumber
              min={-10} max={0} step={0.5}
              value={dcaRules.p1Thresholds.down}
              onChange={(v) => v !== null && setDcaRules((prev) => ({
                ...prev,
                p1Thresholds: { ...prev.p1Thresholds, down: v },
              }))}
              addonAfter="%"
              style={{ width: "100%" }}
            />
          </Space>
        </div>

        <Divider style={{ margin: "16px 0 12px" }} />
        <Text strong style={{ fontSize: 13 }}>T 因子大盘趋势</Text>
        <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
          沪深300近1周累计涨跌幅超过阈值时调整定投倍数
        </Text>
        <div style={{ display: "flex", gap: 16, marginTop: 8, marginBottom: 16 }}>
          <Space orientation="vertical" size={2} style={{ flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>牛市阈值（累计涨 &gt;）</Text>
            <InputNumber
              min={0} max={30} step={1}
              value={dcaRules.tFactorThresholds.bullMarket}
              onChange={(v) => v !== null && setDcaRules((prev) => ({
                ...prev,
                tFactorThresholds: { ...prev.tFactorThresholds, bullMarket: v },
              }))}
              addonAfter="%"
              style={{ width: "100%" }}
            />
          </Space>
          <Space orientation="vertical" size={2} style={{ flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>熊市阈值（累计跌 &gt;）</Text>
            <InputNumber
              min={0} max={30} step={1}
              value={dcaRules.tFactorThresholds.bearMarket}
              onChange={(v) => v !== null && setDcaRules((prev) => ({
                ...prev,
                tFactorThresholds: { ...prev.tFactorThresholds, bearMarket: v },
              }))}
              addonAfter="%"
              style={{ width: "100%" }}
            />
          </Space>
        </div>

        <Divider style={{ margin: "16px 0 12px" }} />
        <Text strong style={{ fontSize: 13 }}>双周四锚点</Text>
        <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
          定投周期的起始日期，每14天一轮（必须为周四）
        </Text>
        <DatePicker
          style={{ width: "100%", marginTop: 8, marginBottom: 16 }}
          value={dayjs(dcaRules.biweeklyAnchorDate)}
          onChange={(d) => {
            if (d) {
              setDcaRules((prev) => ({
                ...prev,
                biweeklyAnchorDate: d.format("YYYY-MM-DD"),
              }));
            }
          }}
          allowClear={false}
        />

        <Divider style={{ margin: "16px 0 12px" }} />
        <Text strong style={{ fontSize: 13 }}>上下限</Text>
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          <Space orientation="vertical" size={2} style={{ flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>上限倍数</Text>
            <InputNumber
              min={1} max={10} step={0.5}
              value={dcaRules.maxMultiplier}
              onChange={(v) => v !== null && setDcaRules((prev) => ({ ...prev, maxMultiplier: v }))}
              addonAfter="x"
              style={{ width: "100%" }}
            />
          </Space>
          <Space orientation="vertical" size={2} style={{ flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>下限阈值</Text>
            <InputNumber
              min={0} max={1} step={0.01}
              value={dcaRules.minThreshold}
              onChange={(v) => v !== null && setDcaRules((prev) => ({ ...prev, minThreshold: v }))}
              addonAfter="%"
              style={{ width: "100%" }}
            />
          </Space>
        </div>
      </Card>

      {/* 止盈止损规则 */}
      <Card
        title="止盈止损档位"
        loading={loading}
        variant="borderless"
        style={{ marginBottom: 16 }}
        extra={
          <Button size="small" icon={<UndoOutlined />} onClick={handleResetSlp}>
            恢复默认
          </Button>
        }
      >
        <Text strong style={{ fontSize: 13 }}>止盈档位</Text>
        <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
          收益率达到阈值时触发止盈信号
        </Text>
        <Table
          size="small"
          pagination={false}
          dataSource={slpRules.takeProfitTiers.map((r, i) => ({ ...r, key: i }))}
          columns={[
            {
              title: "档位",
              dataIndex: "level",
              width: 80,
              render: (v: SignalLevel) => (
                <Tag color={SIGNAL_LEVEL_COLORS[v]}>{SIGNAL_LEVEL_NAMES[v]}</Tag>
              ),
            },
            {
              title: "收益率 ≥",
              dataIndex: "threshold",
              width: 140,
              render: (v: number, _: unknown, i: number) => (
                <InputNumber
                  size="small"
                  min={0} max={5} step={0.01}
                  value={v}
                  onChange={(val) => val !== null && updateTakeProfit(i, val)}
                  addonAfter="%"
                  style={{ width: "100%" }}
                />
              ),
            },
          ]}
        />

        <Divider style={{ margin: "16px 0 12px" }} />
        <Text strong style={{ fontSize: 13 }}>止损档位</Text>
        <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
          亏损率达到阈值时触发止损信号
        </Text>
        <Table
          size="small"
          pagination={false}
          dataSource={slpRules.stopLossTiers.map((r, i) => ({ ...r, key: i }))}
          columns={[
            {
              title: "档位",
              dataIndex: "level",
              width: 80,
              render: (v: SignalLevel) => (
                <Tag color={SIGNAL_LEVEL_COLORS[v]}>{SIGNAL_LEVEL_NAMES[v]}</Tag>
              ),
            },
            {
              title: "亏损率 ≤",
              dataIndex: "threshold",
              width: 140,
              render: (v: number, _: unknown, i: number) => (
                <InputNumber
                  size="small"
                  min={-5} max={0} step={0.01}
                  value={v}
                  onChange={(val) => val !== null && updateStopLoss(i, val)}
                  addonAfter="%"
                  style={{ width: "100%" }}
                />
              ),
            },
          ]}
        />

        <Divider style={{ margin: "16px 0 12px" }} />
        <Text strong style={{ fontSize: 13 }}>反弹信号</Text>
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          <Space orientation="vertical" size={2} style={{ flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>连续涨幅天数</Text>
            <InputNumber
              min={1} max={30}
              value={slpRules.reboundDaily.days}
              onChange={(v) => v !== null && setSlpRules((prev) => ({
                ...prev,
                reboundDaily: { ...prev.reboundDaily, days: v },
              }))}
              addonAfter="天"
              style={{ width: "100%" }}
            />
          </Space>
          <Space orientation="vertical" size={2} style={{ flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>日涨幅阈值</Text>
            <InputNumber
              min={0} max={1} step={0.005}
              value={slpRules.reboundDaily.threshold}
              onChange={(v) => v !== null && setSlpRules((prev) => ({
                ...prev,
                reboundDaily: { ...prev.reboundDaily, threshold: v },
              }))}
              addonAfter="%"
              style={{ width: "100%" }}
            />
          </Space>
          <Space orientation="vertical" size={2} style={{ flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>周累计阈值</Text>
            <InputNumber
              min={0} max={1} step={0.005}
              value={slpRules.reboundWeekly.threshold}
              onChange={(v) => v !== null && setSlpRules((prev) => ({
                ...prev,
                reboundWeekly: { ...prev.reboundWeekly, threshold: v },
              }))}
              addonAfter="%"
              style={{ width: "100%" }}
            />
          </Space>
        </div>
      </Card>

      <Button
        type="primary"
        icon={<SaveOutlined />}
        loading={saving}
        onClick={handleSave}
        size="large"
      >
        保存规则
      </Button>
    </div>
  );
}
