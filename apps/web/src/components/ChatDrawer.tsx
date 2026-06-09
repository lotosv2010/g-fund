"use client";

import { useEffect, useRef, useState } from "react";
import {
  Drawer,
  Input,
  Button,
  Space,
  Typography,
  Flex,
  Collapse,
  Tag,
  Alert,
  List,
  Modal,
  Tooltip,
  Empty,
} from "antd";
import {
  SendOutlined,
  OpenAIOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  BulbOutlined,
  RadarChartOutlined,
  CalculatorOutlined,
  SafetyOutlined,
  PieChartOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  RocketOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import { useAppStore } from "@/store/useAppStore";
import { useChatStore } from "@/store/use-chat-store";
import type { ChatMessage } from "@g-fund/types";

const { Text } = Typography;

interface SuggestionItem {
  readonly key: string;
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly description: string;
  readonly prompt: string;
  readonly color: string;
  readonly bg: string;
}

interface SuggestionGroup {
  readonly title: string;
  readonly icon: React.ReactNode;
  readonly items: ReadonlyArray<SuggestionItem>;
}

const SUGGESTION_GROUPS: ReadonlyArray<SuggestionGroup> = [
  {
    title: "风险监控",
    icon: <SafetyOutlined style={{ color: "#cf1322" }} />,
    items: [
      {
        key: "monitor",
        icon: <RadarChartOutlined />,
        title: "今日监控",
        description: "扫描全部持仓，按 🔴/🟡/🟢 给出今日简报与处理优先级。",
        color: "#13c2c2",
        bg: "#e6fffb",
        prompt: "请扫描我当前所有持仓，按 🔴/🟡/🟢 信号给出今日监控简报，并指明需要立刻处理的基金。",
      },
      {
        key: "stop",
        icon: <SafetyOutlined />,
        title: "止盈止损扫描",
        description: "按 25/40/60% 与 10/20% 阈值给出明确赎回/加仓动作。",
        color: "#cf1322",
        bg: "#fff1f0",
        prompt: "对全部持仓按持有期止盈三档（25/40/60%）与止损两档（10/20%）规则给出明确操作建议，并输出本次需赎回/加仓的金额表。",
      },
      {
        key: "deep_loss",
        icon: <MedicineBoxOutlined />,
        title: "深度套牢诊断",
        description: "找出亏损 >20% 基金，给出反弹信号判定与触发价。",
        color: "#fa541c",
        bg: "#fff2e8",
        prompt: "找出亏损 >20% 的基金，结合估值分位与基本面给出补仓/止损/观望结论，观望需附触发价（连续 3 日 >1% 或周累计 >3%）。",
      },
    ],
  },
  {
    title: "定投策略",
    icon: <CalculatorOutlined style={{ color: "#1677ff" }} />,
    items: [
      {
        key: "dca_calc",
        icon: <CalculatorOutlined />,
        title: "下次定投预估",
        description: "按 T×P2×P3×P4 系数算出下个双周四的实际金额。",
        color: "#1677ff",
        bg: "#e6f4ff",
        prompt: "结合当前估值分位、周月趋势系数，计算下次双周四定投的实际金额（含上限 3 倍 / 下限 10% 归零），按基金分配。",
      },
      {
        key: "dca_priority",
        icon: <RocketOutlined />,
        title: "定投基金优先级",
        description: "按优先级 + 估值分位 + 阶段排序，列出本期定投候选。",
        color: "#2f54eb",
        bg: "#f0f5ff",
        prompt: "按 priority + 估值分位 + 阶段（phase）给所有定投候选基金排序，列出本期定投的前 3 名。",
      },
    ],
  },
  {
    title: "组合洞察",
    icon: <PieChartOutlined style={{ color: "#722ed1" }} />,
    items: [
      {
        key: "sector",
        icon: <PieChartOutlined />,
        title: "板块再平衡",
        description: "找出过度集中（>30%）方向，给出再平衡调仓金额。",
        color: "#722ed1",
        bg: "#f9f0ff",
        prompt: "分析当前持仓的板块/风格分布，找出过度集中的方向（>30%）并给出再平衡思路与具体调仓金额。",
      },
      {
        key: "diagnosis",
        icon: <MedicineBoxOutlined />,
        title: "基金深度诊断",
        description: "对风险最高的基金做估值/排名/评级综合分析。",
        color: "#fa8c16",
        bg: "#fff7e6",
        prompt: "对持仓里风险信号最高的一只基金做深度诊断（估值分位、同类排名、风险评级、操作建议）。",
      },
    ],
  },
];

export default function ChatDrawer() {
  const { chatDrawerOpen, closeChatDrawer } = useAppStore();
  const {
    sessions,
    activeSessionId,
    messages,
    inputValue,
    isStreaming,
    reconnectInfo,
    setInputValue,
    sendMessage,
    abort,
    loadSessions,
    newSession,
    selectSession,
    renameSession,
    deleteSession,
  } = useChatStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: number; title: string } | null>(null);
  const [renameInput, setRenameInput] = useState("");

  useEffect(() => {
    if (chatDrawerOpen) void loadSessions();
  }, [chatDrawerOpen, loadSessions]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, isStreaming]);

  const handleClose = () => {
    abort();
    closeChatDrawer();
  };

  const handleSend = () => {
    void sendMessage(inputValue);
  };

  const confirmDelete = (id: number, title: string) => {
    Modal.confirm({
      title: "删除该会话？",
      content: `「${title}」将被永久删除，且无法恢复。`,
      okType: "danger",
      okText: "删除",
      cancelText: "取消",
      onOk: () => deleteSession(id),
    });
  };

  const openRename = (id: number, title: string) => {
    setRenameTarget({ id, title });
    setRenameInput(title);
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    const value = renameInput.trim();
    if (!value || value === renameTarget.title) {
      setRenameTarget(null);
      return;
    }
    await renameSession(renameTarget.id, value);
    setRenameTarget(null);
  };

  return (
    <Drawer
      title={
        <Flex align="center" gap={8}>
          <OpenAIOutlined />
          <span>AI 分析</span>
        </Flex>
      }
      open={chatDrawerOpen}
      onClose={handleClose}
      width="min(960px, 90vw)"
      destroyOnClose
      styles={{ body: { padding: 0 } }}
    >
      <Flex style={{ height: "100%" }}>
        <SessionSidebar
          sessions={sessions}
          activeId={activeSessionId}
          onNew={newSession}
          onSelect={selectSession}
          onRename={openRename}
          onDelete={confirmDelete}
        />

        <Flex vertical flex={1} style={{ padding: 16, minWidth: 0 }} gap={12}>
          <Flex vertical flex={1} ref={scrollRef} style={{ overflow: "auto" }}>
            {messages.length === 0 ? (
              <SuggestionPanel
                disabled={isStreaming}
                onPick={(prompt) => void sendMessage(prompt)}
              />
            ) : (
              messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
            )}
            {isStreaming && <TypingIndicator messages={messages} />}
            {reconnectInfo && (
              <Alert
                type="warning"
                showIcon
                message={`连接中断，正在重连 (第 ${reconnectInfo.attempt} 次，${Math.round(
                  reconnectInfo.delayMs / 1000,
                )}s 后)`}
                style={{ marginTop: 8 }}
              />
            )}
          </Flex>

          <Flex gap={8}>
            <Input
              placeholder="输入消息或试试上方快捷指令..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPressEnter={handleSend}
              disabled={isStreaming}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              disabled={isStreaming || !inputValue.trim()}
            />
          </Flex>
        </Flex>
      </Flex>

      <Modal
        title="重命名会话"
        open={renameTarget != null}
        onCancel={() => setRenameTarget(null)}
        onOk={submitRename}
        okText="保存"
        cancelText="取消"
      >
        <Input
          value={renameInput}
          onChange={(e) => setRenameInput(e.target.value)}
          onPressEnter={submitRename}
          maxLength={120}
          autoFocus
        />
      </Modal>
    </Drawer>
  );
}

interface SessionSidebarProps {
  readonly sessions: ReadonlyArray<{ id: number; title: string; updatedAt: string }>;
  readonly activeId: number | null;
  readonly onNew: () => Promise<void> | void;
  readonly onSelect: (id: number) => Promise<void> | void;
  readonly onRename: (id: number, title: string) => void;
  readonly onDelete: (id: number, title: string) => void;
}

function SessionSidebar({ sessions, activeId, onNew, onSelect, onRename, onDelete }: SessionSidebarProps) {
  return (
    <Flex
      vertical
      style={{
        width: 240,
        borderRight: "1px solid #f0f0f0",
        background: "#fafafa",
        flexShrink: 0,
      }}
    >
      <Flex align="center" justify="space-between" style={{ padding: "12px 12px 8px" }}>
        <Flex align="center" gap={6}>
          <HistoryOutlined />
          <Text strong>会话</Text>
        </Flex>
        <Tooltip title="新建会话">
          <Button size="small" icon={<PlusOutlined />} onClick={() => void onNew()} />
        </Tooltip>
      </Flex>
      <div style={{ flex: 1, overflow: "auto", padding: "0 4px 12px" }}>
        {sessions.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<Text type="secondary">暂无历史会话</Text>}
            style={{ marginTop: 24 }}
          />
        ) : (
          <List
            dataSource={[...sessions]}
            split={false}
            renderItem={(s) => {
              const active = s.id === activeId;
              return (
                <List.Item
                  key={s.id}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 6,
                    margin: "2px 4px",
                    background: active ? "#e6f4ff" : "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => void onSelect(s.id)}
                >
                  <Flex align="center" justify="space-between" style={{ width: "100%" }} gap={4}>
                    <Text
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: active ? "#1677ff" : undefined,
                      }}
                    >
                      {s.title}
                    </Text>
                    <Space size={0} onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="重命名">
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => onRename(s.id, s.title)}
                        />
                      </Tooltip>
                      <Tooltip title="删除">
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => onDelete(s.id, s.title)}
                        />
                      </Tooltip>
                    </Space>
                  </Flex>
                </List.Item>
              );
            }}
          />
        )}
      </div>
    </Flex>
  );
}

interface SuggestionPanelProps {
  readonly disabled: boolean;
  readonly onPick: (prompt: string) => void;
}

function SuggestionPanel({ disabled, onPick }: SuggestionPanelProps) {
  return (
    <Flex vertical gap={20} style={{ padding: "16px 4px" }}>
      <Flex align="center" gap={8}>
        <RocketOutlined style={{ color: "#1677ff" }} />
        <Text strong>试试这些常用场景</Text>
      </Flex>
      {SUGGESTION_GROUPS.map((group) => (
        <div key={group.title}>
          <Flex align="center" gap={6} style={{ marginBottom: 10 }}>
            {group.icon}
            <Text type="secondary" style={{ fontSize: 13 }}>
              {group.title}
            </Text>
          </Flex>
          <Flex gap={10} wrap>
            {group.items.map((item) => (
              <button
                key={item.key}
                type="button"
                disabled={disabled}
                onClick={() => onPick(item.prompt)}
                className="suggestion-card"
                style={
                  {
                    "--sc-color": item.color,
                    "--sc-bg": item.bg,
                  } as React.CSSProperties
                }
              >
                <span className="suggestion-card__icon">{item.icon}</span>
                <span className="suggestion-card__body">
                  <span className="suggestion-card__title">{item.title}</span>
                  <span className="suggestion-card__desc">{item.description}</span>
                </span>
              </button>
            ))}
          </Flex>
        </div>
      ))}
    </Flex>
  );
}

function TypingIndicator({ messages }: { messages: ReadonlyArray<ChatMessage> }) {
  const last = messages[messages.length - 1];
  const label = (() => {
    if (!last || last.kind === "user") return "AI 思考中";
    if (last.kind === "thinking") return "AI 思考中";
    if (last.kind === "tool_call") return `调用 ${last.tool} 中`;
    if (last.kind === "tool_result") return "整理结果中";
    return "生成回答中";
  })();
  return (
    <Flex align="center" gap={8} style={{ padding: "8px 4px" }}>
      <LoadingOutlined spin style={{ color: "#1677ff" }} />
      <Text type="secondary" style={{ fontSize: 13 }}>
        {label}
      </Text>
      <span className="typing-dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
    </Flex>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  switch (message.kind) {
    case "user":
      return (
        <Flex justify="end" style={{ marginBottom: 8 }}>
          <div
            style={{
              background: "#e6f4ff",
              borderRadius: 8,
              padding: "8px 12px",
              maxWidth: "80%",
            }}
          >
            {message.content}
          </div>
        </Flex>
      );

    case "tool_call":
      return (
        <Collapse
          size="small"
          style={{ marginBottom: 8 }}
          items={[
            {
              key: "1",
              label: (
                <Flex align="center" gap={6}>
                  <ToolOutlined />
                  <Tag color="blue">{message.tool}</Tag>
                  <Text type="secondary">调用中...</Text>
                </Flex>
              ),
              children: (
                <Text code style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {message.content}
                </Text>
              ),
            },
          ]}
        />
      );

    case "thinking":
      return (
        <Collapse
          size="small"
          defaultActiveKey={["1"]}
          style={{ marginBottom: 8, background: "#fafafa" }}
          items={[
            {
              key: "1",
              label: (
                <Flex align="center" gap={6}>
                  <BulbOutlined style={{ color: "#faad14" }} />
                  <Text type="secondary">AI 思考</Text>
                </Flex>
              ),
              children: (
                <div className="ai-markdown ai-markdown--thinking">
                  <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {message.content}
                  </Markdown>
                </div>
              ),
            },
          ]}
        />
      );

    case "tool_result":
      return (
        <Collapse
          size="small"
          style={{ marginBottom: 8 }}
          items={[
            {
              key: "1",
              label: (
                <Flex align="center" gap={6}>
                  <CheckCircleOutlined style={{ color: "#52c41a" }} />
                  <Tag color="green">{message.tool}</Tag>
                  <Text type="secondary">完成</Text>
                </Flex>
              ),
              children: (
                <Text code style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {message.content}
                </Text>
              ),
            },
          ]}
        />
      );

    case "assistant":
      return (
        <div className="ai-markdown" style={{ marginBottom: 8, lineHeight: 1.7 }}>
          {message.truncated && (
            <Tag color="warning" style={{ marginBottom: 8 }}>
              已达最大推理步数（部分结论）
            </Tag>
          )}
          <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {message.content}
          </Markdown>
        </div>
      );

    case "error":
      return (
        <Alert
          type="error"
          message={message.content}
          showIcon
          banner
          style={{ marginBottom: 8 }}
        />
      );
  }
}
