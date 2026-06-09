import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@g-fund/ui", "@g-fund/types", "antd", "@ant-design/icons", "rc-util", "rc-pagination", "rc-picker"],
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
};

export default nextConfig;
