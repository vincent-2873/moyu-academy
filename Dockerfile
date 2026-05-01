# Dockerfile — Plan B (HANDOFF v11/v12)
# 取代 nixpacks build,直接 apt install ffmpeg(系統級)
# 解 Whisper 大檔 / mp4 影片 ffmpeg-static ENOENT 雙保險的最終方案
#
# Zeabur 優先用 Dockerfile,當 Dockerfile 存在時 nixpacks.toml 不生效

FROM node:20-bookworm-slim AS builder

# 系統 ffmpeg(Whisper 處理大檔 + 影片用)+ build 工具
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 啟用 corepack 拿 pnpm
RUN corepack enable

# 先 copy 鎖檔做 dep cache
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 再 copy source(讓上面 cache 在 source 變動時還能用)
COPY . .

# Next.js standalone build
# 提高 Node heap 到 4GB(content/training/ 有 525 .md,build trace 會 OOM @ 2GB default)
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm build


# ═══════════ Runtime stage ═══════════
FROM node:20-bookworm-slim AS runner

# Runtime 也要 ffmpeg(transcribe 是 runtime 行為)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 從 builder 抓 standalone output(Next.js 推薦的 minimal runtime)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# content/training 也要帶(ingest-local-training endpoint runtime 讀 fs)
COPY --from=builder /app/content ./content

EXPOSE 3000

# Next.js standalone 啟動方式
CMD ["node", "server.js"]
