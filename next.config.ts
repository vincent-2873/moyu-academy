import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@anthropic-ai/sdk"],
  // Include bundled markdown (e.g. /training/methods) in the standalone output
  outputFileTracingIncludes: {
    "/training/methods": ["./content/training/**/*"],
  },
  // 路由重整 — spec v1 4 主場(/home /work /learn /account) 取代 /me /today /checkin
  async redirects() {
    return [
      { source: "/me", destination: "/work", permanent: false },
      { source: "/today", destination: "/home", permanent: false },
      { source: "/checkin", destination: "/home", permanent: false },
    ];
  },
};

export default nextConfig;
