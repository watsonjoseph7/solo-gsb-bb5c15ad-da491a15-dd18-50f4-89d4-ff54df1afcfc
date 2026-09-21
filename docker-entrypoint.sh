#!/bin/sh
# 容器首次运行：自动安装依赖 → 构建前后端 → 启动服务（建库由服务启动时完成）
set -e
cd /app

if [ ! -d node_modules ]; then
  echo "[entrypoint] 首次运行，安装依赖（npm install）..."
  # 构建需要 devDependencies（typescript/vite），即使 NODE_ENV=production 也要安装
  npm install --include=dev --no-audit --no-fund
fi

if [ ! -d server/dist ] || [ ! -d client/dist ]; then
  echo "[entrypoint] 构建 server 与 client..."
  npm run build
fi

echo "[entrypoint] 启动服务：http://localhost:${PORT:-3000}"
exec node server/dist/index.js
