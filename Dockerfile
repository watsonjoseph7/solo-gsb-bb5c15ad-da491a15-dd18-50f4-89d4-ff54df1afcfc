# 合同条款重编号工作台 —— 单容器全栈镜像
FROM node:20-bookworm

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/workbench.db

WORKDIR /app

# 拷贝源码（依赖在容器首次启动时自动安装，见 docker-entrypoint.sh）
COPY package.json package-lock.json ./
COPY server ./server
COPY client ./client
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# SQLite 数据目录（可挂载卷持久化）
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
