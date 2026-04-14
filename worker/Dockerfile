FROM mcr.microsoft.com/playwright:v1.49.0-noble

WORKDIR /app

# 只複製 package 先，利用 docker layer cache
COPY package.json package-lock.json* ./
RUN npm install --production

# 複製 source
COPY src ./src

# 環境變數由 Zeabur 注入
ENV NODE_ENV=production
ENV TZ=Asia/Taipei

# 長駐 supervisor（啟動所有 job）
CMD ["node", "src/index.js"]
