import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@anthropic-ai/sdk", "ffmpeg-static", "fluent-ffmpeg", "mammoth"],
  // 把 ffmpeg-static binary 強制帶進 standalone output
  // 否則 Next.js standalone trace 只 copy JS files,binary 找不到 → ENOENT
  outputFileTracingIncludes: {
    "/api/admin/rag/whisper-upload/finalize/**": [
      "./node_modules/.pnpm/ffmpeg-static@*/node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffmpeg-static/ffmpeg",
    ],
  },
  async redirects() {
    return [];
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
