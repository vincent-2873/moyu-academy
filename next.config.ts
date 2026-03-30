import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

export default nextConfig;
