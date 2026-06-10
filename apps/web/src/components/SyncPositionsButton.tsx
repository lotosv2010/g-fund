"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Modal, Progress, Tag, message } from "antd";
import { SyncOutlined } from "@ant-design/icons";
import type { SyncPositionItemResult, SyncPositionsResult, SyncStreamEvent } from "@g-fund/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

interface SyncPositionsButtonProps {
  onDone?: (result: SyncPositionsResult) => void;
  size?: "small" | "middle" | "large";
  type?: "default" | "primary" | "link";
}

const STATUS_LABEL: Record<SyncPositionItemResult["status"], { text: string; color: string }> = {
  success: { text: "成功", color: "green" },
  skipped: { text: "跳过", color: "gold" },
  failed: { text: "失败", color: "red" },
};

export default function SyncPositionsButton({ onDone, size = "middle", type = "default" }: SyncPositionsButtonProps) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<SyncPositionItemResult[]>([]);
  const [done, setDone] = useState<SyncPositionsResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => () => esRef.current?.close(), []);

  function reset() {
    setItems([]);
    setDone(null);
    setErrorMsg(null);
    setTotal(0);
  }

  function handleClick() {
    reset();
    setOpen(true);
    setRunning(true);

    const es = new EventSource(`${BASE_URL}/positions/sync/stream`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as SyncStreamEvent;
        if (event.type === "started") {
          setTotal(event.total);
        } else if (event.type === "item") {
          setItems((prev) => [...prev, event.result]);
        } else if (event.type === "done") {
          setDone(event.result);
          setRunning(false);
          es.close();
          esRef.current = null;
          onDone?.(event.result);
          if (event.result.total === 0) {
            messageApi.info("当前没有持仓需要同步");
          } else {
            messageApi.success(`同步完成：成功 ${event.result.succeeded} / 共 ${event.result.total} 支`);
          }
        } else if (event.type === "error") {
          setErrorMsg(event.message);
          setRunning(false);
          es.close();
          esRef.current = null;
        }
      } catch {
        // ignore malformed event
      }
    };

    es.onerror = () => {
      if (esRef.current) {
        es.close();
        esRef.current = null;
        if (running) {
          setErrorMsg("连接中断");
          setRunning(false);
        }
      }
    };
  }

  function handleClose() {
    if (running) {
      esRef.current?.close();
      esRef.current = null;
      setRunning(false);
    }
    setOpen(false);
  }

  const finishedCount = items.length;
  const percent = total > 0 ? Math.round((finishedCount / total) * 100) : 0;
  const issues = items.filter((i) => i.status !== "success");

  return (
    <>
      {contextHolder}
      <Button icon={<SyncOutlined spin={running} />} loading={running && !open} onClick={handleClick} size={size} type={type}>
        一键同步
      </Button>
      <Modal
        title="一键同步持仓"
        open={open}
        onCancel={handleClose}
        footer={[
          <Button key="close" onClick={handleClose}>
            {running ? "取消" : "关闭"}
          </Button>,
        ]}
        width={560}
        maskClosable={!running}
      >
        {errorMsg ? (
          <div style={{ color: "#ff4d4f", padding: "16px 0" }}>同步失败：{errorMsg}</div>
        ) : (
          <>
            <Progress
              percent={percent}
              status={running ? "active" : done && done.failed > 0 ? "exception" : "success"}
              format={() => (total > 0 ? `${finishedCount} / ${total}` : "准备中…")}
            />
            {done && (
              <div style={{ marginTop: 12, color: "#666", fontSize: 13 }}>
                成功 {done.succeeded} · 跳过 {done.skipped} · 失败 {done.failed}
              </div>
            )}
            <div style={{ maxHeight: 360, overflowY: "auto", marginTop: 12 }}>
              {items.length === 0 && running && <div style={{ color: "#999", padding: "8px 0" }}>等待 MCP 返回净值…</div>}
              {(done ? items : items.slice().reverse()).map((it) => (
                <div key={it.fundCode} style={{ padding: "6px 0", borderBottom: "1px solid #f0f0f0", fontSize: 13 }}>
                  <Tag color={STATUS_LABEL[it.status].color}>{STATUS_LABEL[it.status].text}</Tag>
                  <span style={{ fontWeight: 500 }}>
                    {it.fundCode} {it.fundName}
                  </span>
                  {it.status === "success" && it.navUnit && (
                    <span style={{ color: "#666", marginLeft: 8 }}>
                      净值 {it.navUnit}
                      {it.navDate ? ` (${it.navDate})` : ""} → 市值 {it.newValue}
                    </span>
                  )}
                  {it.status !== "success" && it.reason && (
                    <div style={{ color: "#999", fontSize: 12, marginTop: 2, paddingLeft: 4 }}>{it.reason}</div>
                  )}
                </div>
              ))}
            </div>
            {done && issues.length > 0 && (
              <div style={{ marginTop: 8, color: "#999", fontSize: 12 }}>共 {issues.length} 支需要关注（已展示在上方）</div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
