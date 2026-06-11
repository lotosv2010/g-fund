"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card, Col, Row, Typography, Tag, Descriptions, Statistic, Button,
  Space, Skeleton, message, Divider, Progress, Alert, Switch, InputNumber,
} from "antd";
import {
  ArrowLeftOutlined, FundOutlined, SafetyOutlined,
  ScheduleOutlined, DollarOutlined,
  CheckCircleOutlined, ControlOutlined,
} from "@ant-design/icons";
import type {
  FundListItem, StopLossTakeProfitSignal, DcaCalculation,
  FundRuleOverride, FundRuleOverrideType,
} from "@g-fund/types";
import {
  FUND_PHASE_LABELS, VALUATION_LEVEL_LABELS, LIFECYCLE_STAGE_LABELS,
  ASSET_TYPE_LABELS, FUND_RULE_OVERRIDE_TYPES, FUND_RULE_OVERRIDE_LABELS,
} from "@g-fund/types";
import { fundsApi, stopLossTakeProfitApi, dcaApi, rulesApi } from "@/lib/api-client";

const { Title, Text } = Typography;

export default function FundDiagnosisPage() {
  const params = useParams();
  const router = useRouter();
  const fundCode = params.code as string;

  const [fund, setFund] = useState<FundListItem | null>(null);
  const [signal, setSignal] = useState<StopLossTakeProfitSignal[]>([]);
  const [dca, setDca] = useState<DcaCalculation | null>(null);
  const [overrides, setOverrides] = useState<FundRuleOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [fundData, signalData, dcaData, overridesData] = await Promise.allSettled([
        fundsApi.get(fundCode),
        stopLossTakeProfitApi.get(fundCode),
        dcaApi.calculateByFund(fundCode),
        rulesApi.getFundOverrides(fundCode),
      ]);

      if (fundData.status === "fulfilled") setFund(fundData.value);
      if (signalData.status === "fulfilled") setSignal(signalData.value);
      if (dcaData.status === "fulfilled") setDca(dcaData.value);
      if (overridesData.status === "fulfilled") setOverrides(overridesData.value);
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fundCode, messageApi]);

  useEffect(() => { loadData(); }, [loadData]);

  function getOverride(type: FundRuleOverrideType): FundRuleOverride | undefined {
    return overrides.find((o) => o.overrideType === type);
  }

  async function handleOverrideChange(type: FundRuleOverrideType, enabled: boolean, value?: number | null) {
    try {
      const result = await rulesApi.setFundOverride(fundCode, type, enabled, value);
      setOverrides((prev) => {
        const idx = prev.findIndex((o) => o.overrideType === type);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = result;
          return next;
        }
        return [...prev, result];
      });
      messageApi.success("已更新");
    } catch (e) {
      messageApi.error((e as Error).message ?? "更新失败");
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  if (!fund) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          message="基金不存在"
          description={`未找到代码为 ${fundCode} 的基金`}
          action={
            <Button onClick={() => router.push("/funds")}>返回列表</Button>
          }
        />
      </div>
    );
  }

  const pnlRate = parseFloat(fund.pnlRate);
  const pnlRatePercent = pnlRate * 100;
  const isProfit = pnlRate >= 0;

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Card styles={{ body: { padding: "12px 24px" } }}>
          <Row gutter={[16, 12]} align="middle">
            <Col flex="none">
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => router.push("/funds")}
                size="small"
              />
            </Col>
            <Col flex="auto">
              <Space size={8} wrap>
                <Title level={4} style={{ margin: 0 }}>{fund.name}</Title>
                <Tag>{fund.code}</Tag>
                <Tag color={fund.category === "longterm" ? "blue" : "default"}>
                  {fund.category === "longterm" ? "长期" : "关注"}
                </Tag>
                {fund.type && <Tag>{fund.type}</Tag>}
                {fund.riskLevel && (
                  <Tag color={fund.riskLevel >= 4 ? "red" : fund.riskLevel >= 3 ? "orange" : "green"}>
                    风险 {fund.riskLevel}
                  </Tag>
                )}
                {(() => {
                  const level = fund.valuationLevel ?? fund.phase;
                  return level ? (
                    <Tag color={level === "low" ? "green" : level === "high" ? "red" : "blue"}>
                      {VALUATION_LEVEL_LABELS[level]}
                    </Tag>
                  ) : null;
                })()}
                <Tag color={fund.lifecycleStage === "holding" ? "purple" : "cyan"}>
                  {LIFECYCLE_STAGE_LABELS[fund.lifecycleStage]}
                </Tag>
                <Tag>{ASSET_TYPE_LABELS[fund.assetType]}</Tag>
              </Space>
            </Col>
            <Col xs={24} md={6} style={{ textAlign: "right" }}>
              <Statistic
                title="当前收益"
                value={pnlRatePercent}
                precision={2}
                suffix="%"
                valueStyle={{ color: isProfit ? "#dc2626" : "#16a34a", fontSize: 20 }}
              />
            </Col>
          </Row>
          {fund.note && <Text type="secondary" style={{ fontSize: 12 }}>{fund.note}</Text>}
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={<><SafetyOutlined /> 止盈止损分析</>} style={{ height: "100%" }}>
              {signal.length === 0 ? (
                <Text type="secondary">暂无信号，持仓收益在安全区间</Text>
              ) : (
                <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="成本价">¥{signal[0].costPrice}</Descriptions.Item>
                    <Descriptions.Item label="当前价">¥{signal[0].currentPrice}</Descriptions.Item>
                    <Descriptions.Item label="收益率">
                      <Text style={{ color: isProfit ? "#dc2626" : "#16a34a", fontWeight: 600 }}>
                        {(parseFloat(signal[0].pnlRate) * 100).toFixed(2)}%
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="信号数">
                      <Tag>{signal.length} 个</Tag>
                    </Descriptions.Item>
                  </Descriptions>

                  <Divider style={{ margin: "8px 0" }} />

                  {signal.map((s, i) => (
                    <Alert
                      key={i}
                      type={s.level === "red" ? "error" : s.level === "yellow" ? "warning" : "info"}
                      message={
                        <Space>
                          <Tag color={s.signalType === "take_profit" ? "green" : "red"}>
                            {s.signalType === "take_profit" ? "止盈" : "止损"}
                          </Tag>
                          {s.message}
                        </Space>
                      }
                      description={`阈值：${s.threshold}`}
                      showIcon
                      style={{ marginBottom: i < signal.length - 1 ? 0 : undefined }}
                    />
                  ))}
                </Space>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title={<><ScheduleOutlined /> 定投建议</>} style={{ height: "100%" }}>
              {!dca ? (
                <Text type="secondary">未配置定投基础金额，请在基金编辑中设置</Text>
              ) : (
                <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="基础金额">
                      ¥{dca.baseAmount}
                    </Descriptions.Item>
                    <Descriptions.Item label="估值百分位">
                      {dca.valuationPercentile ?? "—"}%
                    </Descriptions.Item>
                    <Descriptions.Item label="阶段">
                      {dca.phase ? FUND_PHASE_LABELS[dca.phase] : "—"}
                    </Descriptions.Item>
                    <Descriptions.Item label="优先级">
                      {dca.priority}
                    </Descriptions.Item>
                  </Descriptions>

                  <Divider style={{ margin: "8px 0" }} />

                  <div>
                    <Text strong>系数计算：</Text>
                    <Space style={{ marginTop: 8 }} wrap>
                      <Tag color={dca.p0 === 0 ? "red" : undefined}>P0={dca.p0}x</Tag>
                      <Tag color={dca.p1 === 0 ? "orange" : dca.p1 > 1 ? "green" : undefined}>P1={dca.p1}x</Tag>
                      <Tag>P2={dca.p2}x</Tag>
                      <Tag>P3={dca.p3}x</Tag>
                      <Tag>P4={dca.p4}x</Tag>
                      <Tag color={dca.tFactor > 1 ? "green" : dca.tFactor < 1 ? "orange" : undefined}>T={dca.tFactor}x</Tag>
                    </Space>
                  </div>

                  <div>
                    <Text strong>最终金额：</Text>
                    {dca.skipped ? (
                      <Tag color="warning" style={{ marginLeft: 8 }}>
                        跳过 - {dca.skipReason}
                      </Tag>
                    ) : (
                      <Statistic
                        value={parseFloat(dca.finalAmount)}
                        prefix="¥"
                        precision={2}
                        valueStyle={{ fontSize: 20 }}
                      />
                    )}
                  </div>

                  {dca.bulletReserveAmount && dca.bulletReserveAmount > 0 && (
                    <Alert
                      type="warning"
                      message={`子弹仓触发：额外加投 ¥${dca.bulletReserveAmount.toFixed(2)}`}
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}

                  {dca.rebalanceAdjustment && (
                    <Tag color="blue" style={{ marginTop: 8 }}>
                      季度再平衡调整：优先级 {dca.rebalanceAdjustment > 0 ? "+" : ""}{dca.rebalanceAdjustment}
                    </Tag>
                  )}
                </Space>
              )}
            </Card>
          </Col>
        </Row>

        <Card title={<><FundOutlined /> 估值信息</>}>
          <Descriptions column={3} size="small">
            <Descriptions.Item label="估值百分位">
              {fund.valuationPercentile !== null ? (
                <Space>
                  <Progress
                    type="circle"
                    percent={parseFloat(fund.valuationPercentile)}
                    size={48}
                    strokeColor={
                      parseFloat(fund.valuationPercentile) <= 30
                        ? "#52c41a"
                        : parseFloat(fund.valuationPercentile) >= 70
                          ? "#ff4d4f"
                          : "#1677ff"
                    }
                    format={(p) => `${p}%`}
                  />
                </Space>
              ) : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="估值水平">
              {(() => {
                const level = fund.valuationLevel ?? fund.phase;
                return level ? (
                  <Tag color={level === "low" ? "green" : level === "high" ? "red" : "blue"}>
                    {VALUATION_LEVEL_LABELS[level]}
                  </Tag>
                ) : "—";
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="优先级">
              <Tag>{fund.priority}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="周收益率">
              {fund.weeklyReturn !== null ? (
                <Text style={{ color: parseFloat(fund.weeklyReturn) >= 0 ? "#dc2626" : "#16a34a" }}>
                  {parseFloat(fund.weeklyReturn) >= 0 ? "+" : ""}
                  {(parseFloat(fund.weeklyReturn) * 100).toFixed(2)}%
                </Text>
              ) : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="月收益率">
              {fund.monthlyReturn !== null ? (
                <Text style={{ color: parseFloat(fund.monthlyReturn) >= 0 ? "#dc2626" : "#16a34a" }}>
                  {parseFloat(fund.monthlyReturn) >= 0 ? "+" : ""}
                  {(parseFloat(fund.monthlyReturn) * 100).toFixed(2)}%
                </Text>
              ) : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="目标仓位">
              {fund.targetRatio ? `${fund.targetRatio}%` : "—"}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title={<><DollarOutlined /> 持仓详情</>}>
          <Descriptions column={3} size="small">
            <Descriptions.Item label="持有份额">
              {fund.hasPosition ? parseFloat(fund.currentValue).toLocaleString() : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="成本金额">
              ¥{parseFloat(fund.costAmount).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="当前市值">
              ¥{parseFloat(fund.currentValue).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="盈亏金额">
              <Text style={{ color: isProfit ? "#dc2626" : "#16a34a", fontWeight: 600 }}>
                {isProfit ? "+" : ""}¥{parseFloat(fund.pnlAmount).toLocaleString()}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="收益率">
              <Text style={{ color: isProfit ? "#dc2626" : "#16a34a", fontWeight: 600 }}>
                {isProfit ? "+" : ""}{pnlRatePercent.toFixed(2)}%
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="目标金额">
              {fund.targetAmount ? `¥${parseFloat(fund.targetAmount).toLocaleString()}` : "—"}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title={<><ControlOutlined /> 例外规则</>}>
          <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 16 }}>
            为该基金设置特殊规则，覆盖全局配置
          </Text>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {FUND_RULE_OVERRIDE_TYPES.map((type) => {
              const override = getOverride(type);
              const enabled = override?.enabled ?? false;
              const showValue = type === "relaxed_stop_loss" || type === "fixed_amount";

              return (
                <div key={type}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Space>
                      <Switch
                        checked={enabled}
                        onChange={(v) => handleOverrideChange(type, v, override?.value)}
                      />
                      <Text strong>{FUND_RULE_OVERRIDE_LABELS[type]}</Text>
                    </Space>
                    {enabled && !showValue && (
                      <Tag color="orange">已启用</Tag>
                    )}
                  </div>
                  {enabled && showValue && (
                    <div style={{ marginTop: 8, paddingLeft: 44 }}>
                      {type === "relaxed_stop_loss" ? (
                        <Space>
                          <Text type="secondary">止损阈值：</Text>
                          <InputNumber
                            size="small"
                            min={-1} max={0} step={0.01}
                            value={override?.value ?? -0.15}
                            onChange={(v) => v !== null && handleOverrideChange(type, true, v)}
                            addonAfter="%"
                            style={{ width: 120 }}
                          />
                        </Space>
                      ) : type === "fixed_amount" ? (
                        <Space>
                          <Text type="secondary">固定金额：</Text>
                          <InputNumber
                            size="small"
                            min={0} step={100}
                            value={override?.value ?? 0}
                            onChange={(v) => v !== null && handleOverrideChange(type, true, v)}
                            addonAfter="元"
                            style={{ width: 140 }}
                          />
                        </Space>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </Space>
        </Card>
      </Space>
    </>
  );
}
