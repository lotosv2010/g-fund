"use client";

import { useEffect, useState, useCallback } from "react";
import { Layout, Menu, Button, Tooltip, Badge } from "antd";
import {
  DashboardOutlined,
  FundOutlined,
  BarChartOutlined,
  FundProjectionScreenOutlined,
  SettingOutlined,
  OpenAIOutlined,
  ControlOutlined,
  BellOutlined,
} from "@ant-design/icons";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import ChatDrawer from "@/components/ChatDrawer";
import AnomalyDrawer from "@/components/AnomalyDrawer";
import { dashboardApi } from "@/lib/api-client";
import type { AnomalyAlert } from "@g-fund/types";

const { Sider, Content, Header } = Layout;

const menuItems = [
  { key: "/dashboard", icon: <DashboardOutlined />, label: "总览" },
  {
    key: "fund-group",
    label: "基金管理",
    icon: <FundOutlined />,
    children: [
      { key: "/funds", icon: <FundOutlined />, label: "基金列表" },
      { key: "/positions", icon: <BarChartOutlined />, label: "交易与持仓" },
    ],
  },
  {
    key: "settings-group",
    label: "系统设置",
    icon: <SettingOutlined />,
    children: [
      { key: "/settings/ai", icon: <SettingOutlined />, label: "AI 设置" },
      { key: "/settings/rules", icon: <ControlOutlined />, label: "规则配置" },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const openChatDrawer = useAppStore((s) => s.openChatDrawer);
  const toggleChatDrawer = useAppStore((s) => s.toggleChatDrawer);

  const [anomalyOpen, setAnomalyOpen] = useState(false);
  const [anomalyAlerts, setAnomalyAlerts] = useState<AnomalyAlert[]>([]);

  const loadAnomalies = useCallback(async () => {
    try {
      const res = await dashboardApi.anomalies();
      setAnomalyAlerts(res.alerts);
    } catch {
      // silently ignore
    }
  }, []);

  const flatKeys = menuItems.flatMap((item) =>
    Array.isArray(item.children) ? item.children.map((c) => c.key) : [item.key],
  );

  const [selectedKey, setSelectedKey] = useState("/dashboard");

  useEffect(() => {
    setSelectedKey(flatKeys.find((key) => pathname.startsWith(key)) ?? "/dashboard");
  }, [pathname]);

  useEffect(() => {
    loadAnomalies();
  }, [loadAnomalies]);

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
    <Layout style={{ height: "100vh", overflow: "hidden" }}>
      <Sider
        theme="light"
        breakpoint="lg"
        collapsedWidth={0}
        style={{ borderRight: "1px solid #f0f0f0", display: "flex", flexDirection: "column", overflow: "auto" }}
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
            color: "#1677ff",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <FundProjectionScreenOutlined style={{ fontSize: 20 }} />
          <span>智能基金仓位管理</span>
        </div>
        <Menu
          mode="inline"
          defaultOpenKeys={["fund-group", "settings-group"]}
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
          style={{ borderRight: 0, paddingTop: 8, flex: 1 }}
        />
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
          <Tooltip title="异动提示">
            <Badge count={anomalyAlerts.length} size="small" offset={[-2, 2]}>
              <Button
                type="text"
                icon={<BellOutlined style={{ fontSize: 18 }} />}
                onClick={() => setAnomalyOpen(true)}
              />
            </Badge>
          </Tooltip>
          <Tooltip title="AI 分析 (⌘K)">
            <Button
              type="text"
              icon={<OpenAIOutlined style={{ fontSize: 18 }} />}
              onClick={() => openChatDrawer()}
            />
          </Tooltip>
        </Header>
        <Content style={{ padding: 24, overflow: "auto" }}>{children}</Content>
      </Layout>
      <ChatDrawer />
      <AnomalyDrawer
        open={anomalyOpen}
        onClose={() => setAnomalyOpen(false)}
        alerts={anomalyAlerts}
      />
    </Layout>
  );
}
