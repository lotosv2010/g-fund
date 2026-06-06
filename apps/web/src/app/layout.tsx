import type { Metadata } from "next";

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
      <body>{children}</body>
    </html>
  );
}
