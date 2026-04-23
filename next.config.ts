import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@anthropic-ai/sdk"],
  // Include bundled markdown (e.g. /training/methods) in the standalone output
  outputFileTracingIncludes: {
    "/training/methods": ["./content/training/**/*"],
  },
};

export default nextConfig;
