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
  // 強制 browser 不 cache HTML(每次 revalidate),解 Vincent 反映「需手動清 cache」
  // 但保留 _next/static/* immutable cache(hashed 檔名安全)
  async headers() {
    return [
      {
        // match 所有 HTML page + API route, 排除 _next static / images / favicon
        source: "/((?!_next/static|_next/image|favicon|robots|sitemap).*)",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
};

export default nextConfig;
