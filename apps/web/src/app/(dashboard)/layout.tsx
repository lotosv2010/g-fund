"use client";

import { useEffect, useState } from "react";
import { Layout, Menu, Button, Tooltip } from "antd";
import {
  DashboardOutlined,
  FundOutlined,
  BarChartOutlined,
  FundProjectionScreenOutlined,
  OpenAIOutlined,
} from "@ant-design/icons";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import ChatDrawer from "@/components/ChatDrawer";

const { Sider, Content, Header } = Layout;

const menuItems = [
  { key: "/dashboard", icon: <DashboardOutlined />, label: "总览" },
  { key: "/funds", icon: <FundOutlined />, label: "基金列表" },
  { key: "/positions", icon: <BarChartOutlined />, label: "交易与持仓" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const openChatDrawer = useAppStore((s) => s.openChatDrawer);
  const toggleChatDrawer = useAppStore((s) => s.toggleChatDrawer);

  const [selectedKey, setSelectedKey] = useState("/dashboard");

  useEffect(() => {
    setSelectedKey(menuItems.find((item) => pathname.startsWith(item.key))?.key ?? "/dashboard");
  }, [pathname]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleChatDrawer();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleChatDrawer]);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        theme="light"
        breakpoint="lg"
        collapsedWidth={0}
        style={{ borderRight: "1px solid #f0f0f0", display: "flex", flexDirection: "column" }}
      >
        <div
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontWeight: 700,
            fontSize: 15,
            color: "#dc2626",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <FundProjectionScreenOutlined style={{ fontSize: 20 }} />
          <span>智能基金仓位管理</span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
          style={{ borderRight: 0, paddingTop: 8, flex: 1 }}
        />
        <div style={{ padding: "12px 16px", borderTop: "1px solid #f0f0f0" }}>
          <Tooltip title="AI 分析 (⌘K)" placement="right">
            <Button
              type="primary"
              icon={<OpenAIOutlined />}
              block
              onClick={openChatDrawer}
            >
              AI 分析
            </Button>
          </Tooltip>
        </div>
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#fff",
            padding: "0 24px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            height: 56,
          }}
        >
          <Tooltip title="AI 分析 (⌘K)">
            <Button
              type="text"
              icon={<OpenAIOutlined style={{ fontSize: 18 }} />}
              onClick={openChatDrawer}
            />
          </Tooltip>
        </Header>
        <Content style={{ padding: 24 }}>{children}</Content>
      </Layout>
      <ChatDrawer />
    </Layout>
  );
}
