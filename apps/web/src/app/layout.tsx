import type { Metadata } from "next";
import AntdProvider from "./antd-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "基金投资管理系统",
  description: "智能基金仓位管理与 AI 分析",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdProvider>{children}</AntdProvider>
      </body>
    </html>
  );
}
