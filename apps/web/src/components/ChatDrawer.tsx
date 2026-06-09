"use client";

import { useRef, useEffect } from "react";
import { Drawer, Input, Button, Space, Typography, Flex, Collapse, Tag, Alert } from "antd";
import { SendOutlined, OpenAIOutlined, ToolOutlined, CheckCircleOutlined, BulbOutlined } from "@ant-design/icons";
import Markdown from "react-markdown";
import { useAppStore } from "@/store/useAppStore";
import { useChatStore } from "@/store/use-chat-store";
import type { ChatMessage } from "@g-fund/types";

const { Text } = Typography;

const SUGGESTIONS = [
  "分析我的仓位风险",
  "最近市场行情怎么样",
  "给出调仓建议",
];

export default function ChatDrawer() {
  const { chatDrawerOpen, closeChatDrawer } = useAppStore();
  const { messages, inputValue, isStreaming, setInputValue, sendMessage, abort } = useChatStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, isStreaming]);

  const handleClose = () => {
    abort();
    closeChatDrawer();
  };

  const handleSend = () => {
    sendMessage(inputValue);
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
      size={400}
      destroyOnClose
    >
      <Flex vertical style={{ height: "100%" }} gap={16}>
        <Flex vertical flex={1} ref={scrollRef} style={{ overflow: "auto" }}>
          {messages.length === 0 && (
            <Text type="secondary" style={{ textAlign: "center", paddingTop: 32 }}>
              发送消息开始对话
            </Text>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isStreaming &&
            !messages.some(
              (m) => m.kind === "thinking" || m.kind === "tool_call" || m.kind === "assistant",
            ) && (
              <Flex justify="center" style={{ padding: 16 }}>
                <Text type="secondary">AI 思考中...</Text>
              </Flex>
            )}
        </Flex>

        <Space wrap size={8}>
          {SUGGESTIONS.map((text) => (
            <Button
              key={text}
              size="small"
              type="default"
              disabled={isStreaming}
              onClick={() => sendMessage(text)}
            >
              {text}
            </Button>
          ))}
        </Space>

        <Flex gap={8}>
          <Input
            placeholder="输入消息..."
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
    </Drawer>
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
                <div style={{ whiteSpace: "pre-wrap", color: "#595959", fontSize: 13 }}>
                  {message.content}
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
        <div style={{ marginBottom: 8, lineHeight: 1.8 }}>
          {message.truncated && (
            <Tag color="warning" style={{ marginBottom: 8 }}>
              已达最大推理步数（部分结论）
            </Tag>
          )}
          <Markdown>{message.content}</Markdown>
        </div>
      );

    case "error":
      return (
        <Alert
          type="error"
          title={message.content}
          showIcon
          banner
          style={{ marginBottom: 8 }}
        />
      );
  }
}
