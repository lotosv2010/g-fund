"use client";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, App } from "antd";
import zhCN from "antd/locale/zh_CN";

const theme = {
  token: {
    colorPrimary: "#2563eb",
    colorSuccess: "#16a34a",
    colorError: "#dc2626",
    colorTextSecondary: "#6b7280",
    colorBgLayout: "#f9fafb",
    borderRadius: 6,
  },
};

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider locale={zhCN} theme={theme}>
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
