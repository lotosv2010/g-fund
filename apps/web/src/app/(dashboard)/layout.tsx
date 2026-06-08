"use client";
import { Layout, Menu } from "antd";
import {
  FundOutlined,
  BarChartOutlined,
  FileTextOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { usePathname, useRouter } from "next/navigation";

const { Sider, Content, Header } = Layout;

const menuItems = [
  { key: "/funds", icon: <FundOutlined />, label: "基金列表" },
  { key: "/positions", icon: <BarChartOutlined />, label: "持仓管理" },
  { key: "/daily-log", icon: <FileTextOutlined />, label: "每日日志" },
  { key: "/analysis", icon: <RobotOutlined />, label: "AI 分析" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        theme="light"
        breakpoint="lg"
        collapsedWidth={0}
        style={{ borderRight: "1px solid #f0f0f0" }}
      >
        <div
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 16,
            color: "#2563eb",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          基金管理
        </div>
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
          style={{ borderRight: 0, paddingTop: 8 }}
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
            height: 56,
          }}
        >
          <span style={{ color: "#6b7280", fontSize: 14 }}>智能基金仓位管理系统</span>
        </Header>
        <Content style={{ padding: 24 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
