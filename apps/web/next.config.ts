import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@g-fund/ui", "@g-fund/types", "antd", "@ant-design/icons", "rc-util", "rc-pagination", "rc-picker"],
  turbopack: {
    root: "../../",
  },
};

export default nextConfig;
