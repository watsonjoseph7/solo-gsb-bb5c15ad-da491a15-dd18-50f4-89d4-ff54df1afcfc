# 合同条款重编号工作台

粘贴合同纯文本 → 自动解析「第X条」标题与正文引用 → 标出缺失/重复编号 → 提交批量改号映射 → 逐处预览 → 原子应用 → 可撤销、可导出。

技术栈：React + TypeScript（Vite） · Node.js / Express · SQLite（better-sqlite3）

## 一条命令启动（Docker）

```bash
docker compose up --build
```

容器**首次运行**时会自动安装依赖、构建前后端、创建 SQLite 数据库，随后在 **http://localhost:3000** 提供服务（前端页面与 API 同端口）。

### 配置项（均为环境变量，可缺省）

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 服务监听端口 |
| `DB_PATH` | `/app/data/workbench.db` | SQLite 数据库文件路径 |

`docker-compose.yml` 已将 `/app/data` 挂载为命名卷，容器重建后文档与改号历史不丢失。

## 本地开发（不用 Docker）

要求 Node.js ≥ 20。

```bash
npm install        # 安装全部 workspace 依赖
npm run build      # 构建 server(tsc) 与 client(vite)
npm start          # http://localhost:3000
```

前后端分离热更新开发：

```bash
npm run dev -w server   # tsc --watch（另开终端 node server/dist/index.js）
npm run dev -w client   # Vite 开发服务器 :5173，/api 代理到 :3000
```

## 功能说明

### 解析规则

- 识别 `第X条`，X 支持阿拉伯数字（`第3条`、`第1.2条`）与中文数字（`第三条`、`第二十五条`），兼容全角数字。
- **标题**：行首（允许前导空白）出现的「第X条」；**引用**：其余位置的出现。
- 分析报告：标题清单、**重复编号**（同一编号多个标题，含行号）、**缺失编号**（标题序列断档，含 `1.2` 这类层级子序列）、**悬空引用**（引用了不存在的条款）。

### 批量改号

- 映射表逐行填写「旧编号 → 新编号」，源/目标均可写阿拉伯或中文数字（`3` 与 `三` 等价）。
- **单遍替换**实现，天然支持：
  - 交换：`1→2, 2→1`
  - 环形：`1→2, 2→3, 3→1`
  - 前缀相近编号：`1→2` 不会误伤 `第十条`（`10`）
- 改号后保持原文数字风格：中文标题改号后仍是中文（`第三条`→`第五条`）。
- **冲突拒绝写入**：若改号后任一编号将出现多个标题，整个映射被拒绝（HTTP 409），并列出冲突编号与行号；改号前已存在且未被映射触碰的重复仅提示、不阻断。
- 其他校验：源编号不存在、源/目标相同、映射内源或目标重复，均以 400 拒绝并说明行号。

### 预览 → 原子应用 → 撤销 → 导出

- **预览**：列出每一处将变更的位置（行号、标题/引用、旧→新、所在行上下文），不写库。
- **应用**：确认后在**单个 SQLite 事务**中同步更新全部标题与正文引用，并记录操作快照。
- **撤销**：一键回滚最近一次改号（可连续撤销多步）。
- **导出**：下载处理后的纯文本（`GET /api/documents/:id/export`）。

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/documents` | 文档列表 |
| `POST` | `/api/documents` | 新建文档 `{title, content}`，返回解析结果 |
| `GET` | `/api/documents/:id` | 文档 + 解析 + 命中位置 + 历史 |
| `DELETE` | `/api/documents/:id` | 删除文档 |
| `POST` | `/api/documents/:id/preview` | 预览 `{mapping:[{from,to}]}` → 逐处变更/冲突 |
| `POST` | `/api/documents/:id/apply` | 原子应用；冲突返回 `409` 及位置 |
| `POST` | `/api/documents/:id/undo` | 撤销最近一次改号 |
| `GET` | `/api/documents/:id/export` | 导出处理后文本 |

## 目录结构

```
├── Dockerfile / docker-compose.yml / docker-entrypoint.sh
├── package.json            # npm workspaces 根
├── server/                 # Express + SQLite
│   └── src/{index,db,routes,parser}.ts
└── client/                 # React + TS (Vite)
    └── src/{App,api,types,sampleText}.tsx? + components/
```

## 已知边界

- 「标题」按行首启发式判定；若正文某行恰好以「第X条」开头，会被视为标题。
- 中文数字支持 0–9999；层级编号（如 `1.2`）仅支持阿拉伯数字写法。
- 改号以「编号」为单位作用于该编号的全部出现；同一编号存在多个标题时，需先消除重复再单独调整。
