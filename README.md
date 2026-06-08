# g-fund-agent

智能基金仓位管理系统，帮助个人投资者管理基金持仓、记录每日操作，并通过 AI 分析仓位健康度。

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动数据库
docker compose up -d

# 执行数据库迁移
pnpm db:migrate

# 启动开发服务
pnpm dev
```

访问：
- 前端：http://localhost:3000
- API：http://localhost:4000
- Swagger：http://localhost:4000/docs

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 15 + React 19 + antd 5 |
| 后端 | NestJS 11 + Fastify + PostgreSQL |
| AI Agent | LangGraph.js + 盈米 MCP |
| 构建 | Turborepo + pnpm workspaces |
| 监控 | LangSmith |

## 目录结构

```
apps/web         前端应用
apps/api         后端 API
packages/types   共享类型
packages/db      数据库 Schema
packages/ui      共享组件
docs/            项目文档
.claude/         Claude Code 配置
```

详细文档见 `docs/`。
