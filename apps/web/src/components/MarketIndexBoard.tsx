"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Card, Skeleton, Typography, Tag, Space, Button, Drawer, Empty, Segmented, Modal, Checkbox, message, Tooltip as AntTooltip } from "antd";
import { SettingOutlined, ReloadOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { MarketIndexQuote, MarketIndexHistory } from "@g-fund/types";
import { DEFAULT_INDICES } from "@g-fund/types";
import { marketIndexApi } from "@/lib/api-client";

const { Text } = Typography;

const PROFIT_COLOR = "#ef4444";
const LOSS_COLOR = "#22c55e";
const POLL_INTERVAL_TRADING = 15_000;

interface MarketIndexBoardProps {
  loading?: boolean;
}

function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const time = now.getHours() * 100 + now.getMinutes();
  return (time >= 930 && time <= 1130) || (time >= 1300 && time <= 1500);
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function IndexCard({ quote, onClick }: { quote: MarketIndexQuote; onClick: () => void }) {
  const isUp = quote.changePct >= 0;
  const color = isUp ? PROFIT_COLOR : LOSS_COLOR;
  const changeAmount = quote.close * (quote.changePct / 100);

  return (
    <Card
      hoverable
      onClick={onClick}
      style={{ minWidth: 160, cursor: "pointer", flex: "0 0 auto", width: 175 }}
      styles={{ body: { padding: "10px 14px" } }}
    >
      <Space direction="vertical" size={2} style={{ width: "100%" }}>
        <Text strong style={{ fontSize: 13 }}>{quote.name}</Text>
        <Text strong style={{ fontSize: 20, color, lineHeight: 1.2 }}>
          {quote.close.toFixed(2)}
        </Text>
        <Space size={6}>
          <Text style={{ fontSize: 12, color }}>
            {isUp ? "+" : ""}{quote.changePct.toFixed(2)}%
          </Text>
          <Text style={{ fontSize: 11, color }}>
            {isUp ? "+" : ""}{changeAmount.toFixed(2)}
          </Text>
        </Space>
      </Space>
    </Card>
  );
}

function IndexDetailDrawer({
  open,
  onClose,
  quote,
}: {
  open: boolean;
  onClose: () => void;
  quote: MarketIndexQuote | null;
}) {
  const [history, setHistory] = useState<MarketIndexHistory[]>([]);
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !quote) return;
    setLoading(true);
    marketIndexApi
      .history(quote.indexCode, days)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [open, quote, days]);

  const chartData = [...history]
    .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
    .map((h) => ({
      date: h.tradeDate.slice(5),
      close: parseFloat(h.close),
    }));

  return (
    <Drawer
      title={quote?.name ?? "指数详情"}
      open={open}
      onClose={onClose}
      destroyOnHidden
    >
      {quote && (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <div>
            <Text strong style={{ fontSize: 28, color: quote.changePct >= 0 ? PROFIT_COLOR : LOSS_COLOR }}>
              {quote.close.toFixed(2)}
            </Text>
            <Text style={{ marginLeft: 12, color: quote.changePct >= 0 ? PROFIT_COLOR : LOSS_COLOR }}>
              {quote.changePct >= 0 ? "+" : ""}{quote.changePct.toFixed(2)}%
            </Text>
          </div>

          <Segmented
            value={days}
            onChange={(v) => setDays(v as number)}
            options={[
              { label: "近 1 周", value: 7 },
              { label: "近 1 月", value: 30 },
              { label: "近 1 年", value: 365 },
            ]}
          />

          {loading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : chartData.length === 0 ? (
            <Empty description="暂无历史数据，数据将在交易日自动积累" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={60} />
                <Tooltip
                  formatter={(v) => [Number(v).toFixed(2), "收盘"]}
                  labelFormatter={(l) => `日期: ${l}`}
                />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke={quote.changePct >= 0 ? PROFIT_COLOR : LOSS_COLOR}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          <div>
            <Text type="secondary">成交额: </Text>
            <Text>{(quote.turnover / 1e8).toFixed(2)} 亿</Text>
          </div>
        </Space>
      )}
    </Drawer>
  );
}

function WatchlistSettings({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    marketIndexApi
      .getWatchlist()
      .then((setting) => {
        if (setting) {
          setSelected(JSON.parse(setting.value));
        } else {
          setSelected(DEFAULT_INDICES.map((i) => i.code));
        }
      })
      .catch(() => setSelected(DEFAULT_INDICES.map((i) => i.code)));
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await marketIndexApi.setWatchlist(selected);
      onSaved();
      onClose();
    } catch {
      message.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="管理关注指数"
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      destroyOnHidden
    >
      <Space direction="vertical" style={{ width: "100%" }}>
        <Text type="secondary">选择要在大盘行情中展示的指数：</Text>
        <Checkbox.Group
          value={selected}
          onChange={(v) => setSelected(v as string[])}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          {DEFAULT_INDICES.map((idx) => (
            <Checkbox key={idx.code} value={idx.code}>
              {idx.name} ({idx.code})
            </Checkbox>
          ))}
        </Checkbox.Group>
      </Space>
    </Modal>
  );
}

export default function MarketIndexBoard({ loading: externalLoading }: MarketIndexBoardProps) {
  const [quotes, setQuotes] = useState<MarketIndexQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<MarketIndexQuote | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(isMarketOpen());
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const [messageApi, contextHolder] = message.useMessage();

  const loadQuotes = useCallback(async () => {
    try {
      const data = await marketIndexApi.realtime();
      if (data.length > 0) {
        setQuotes(data);
        setUpdatedAt(new Date());
      }
      // 静默归档，积累历史数据
      marketIndexApi.archive().catch(() => {});
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  useEffect(() => {
    const check = () => setMarketOpen(isMarketOpen());
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    clearInterval(timerRef.current);
    if (marketOpen) {
      timerRef.current = setInterval(loadQuotes, POLL_INTERVAL_TRADING);
    }
    return () => clearInterval(timerRef.current);
  }, [marketOpen, loadQuotes]);

  const isLoading = loading || externalLoading;

  if (isLoading) {
    return (
      <Card styles={{ body: { padding: "12px 16px" } }}>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} style={{ minWidth: 160, flex: "0 0 auto", width: 175 }}>
              <Skeleton active paragraph={false} />
            </Card>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card styles={{ body: { padding: "12px 16px" } }}>
      {contextHolder}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Space size={8}>
          <Text strong style={{ fontSize: 15 }}>大盘行情</Text>
          <AntTooltip title="实时展示主要市场指数行情。交易时段每 15 秒自动刷新，收盘后显示收盘价">
            <InfoCircleOutlined style={{ fontSize: 13, color: "#999" }} />
          </AntTooltip>
          {marketOpen && <Tag color="green">交易中</Tag>}
          {!marketOpen && <Tag color="default">已收盘</Tag>}
          {updatedAt && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {formatTime(updatedAt)} 更新
            </Text>
          )}
        </Space>
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined spin={loading} />}
            onClick={loadQuotes}
          />
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => setSettingsOpen(true)}
          />
        </Space>
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {quotes.length > 0 ? (
          quotes.map((q) => (
            <IndexCard
              key={q.indexCode}
              quote={q}
              onClick={() => {
                setSelectedQuote(q);
                setDrawerOpen(true);
              }}
            />
          ))
        ) : (
          <Card style={{ flex: 1 }}>
            <Text type="secondary">暂无行情数据，请稍后再试</Text>
          </Card>
        )}
      </div>

      <IndexDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        quote={selectedQuote}
      />

      <WatchlistSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={loadQuotes}
      />
    </Card>
  );
}
