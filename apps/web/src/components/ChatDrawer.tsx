"use client";

import { Drawer, Input, Button, Space, Typography, Flex } from "antd";
import { SendOutlined, OpenAIOutlined } from "@ant-design/icons";
import { useAppStore } from "@/store/useAppStore";

const { Text } = Typography;

const SUGGESTIONS = [
  "分析我的仓位风险",
  "最近市场行情怎么样",
  "给出调仓建议",
];

export default function ChatDrawer() {
  const { chatDrawerOpen, closeChatDrawer } = useAppStore();

  return (
    <Drawer
      title={
        <Flex align="center" gap={8}>
          <OpenAIOutlined />
          <span>AI 分析</span>
        </Flex>
      }
      open={chatDrawerOpen}
      onClose={closeChatDrawer}
      width={400}
      destroyOnClose
    >
      <Flex vertical style={{ height: "100%" }} gap={16}>
        <Flex vertical flex={1} style={{ overflow: "auto" }}>
          <Text type="secondary" style={{ textAlign: "center", paddingTop: 32 }}>
            发送消息开始对话
          </Text>
        </Flex>

        <Space wrap size={8}>
          {SUGGESTIONS.map((text) => (
            <Button key={text} size="small" type="default">
              {text}
            </Button>
          ))}
        </Space>

        <Flex gap={8}>
          <Input placeholder="输入消息..." />
          <Button type="primary" icon={<SendOutlined />} />
        </Flex>
      </Flex>
    </Drawer>
  );
}
