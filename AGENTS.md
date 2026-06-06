# g-fund-agent

智能基金仓位管理系统。Turborepo monorepo，包含 Next.js 前端、NestJS 后端、LangGraph.js AI Agent。

## 技术栈

- **前端**：Next.js 15（App Router，TypeScript）
- **后端**：NestJS 11 + Fastify，PostgreSQL
- **AI**：LangGraph.js，支持 deepseek / moonshot(kimi) / minimax
- **MCP**：盈米基金（QIEMAN_MCP_URL）

## 项目结构

```
apps/web        Next.js 15 前端（App Router）
apps/api        NestJS 11 后端（Fastify adapter）
packages/types  共享类型 @g-fund/types
packages/db     数据库迁移 @g-fund/db
packages/ui     共享组件 @g-fund/ui
```

## 常用命令

```bash
pnpm dev              # 启动全部服务
pnpm build            # 构建全部包
pnpm typecheck        # 全局类型检查
docker compose up -d  # 启动 PostgreSQL
pnpm db:migrate       # 执行数据库迁移
```

## 核心功能

- 基金仓位管理（买入/卖出/清仓/盈亏计算）
- 每日操作日志
- AI 仓位健康分析（LangGraph.js，SSE 流式输出）
- 盈米 MCP 行情数据接入

## 开发规范

- 严格遵循模块边界：前端不直接查询数据库，Agent 节点不直接调用路由
- 类型共享通过 `@g-fund/types` 包统一管理
- 所有环境变量在 `.env` 中声明，通过 `@nestjs/config` 读取

## 文档索引

| 文档 | 路径 |
|------|------|
| 产品需求 | `docs/PRD.md` |
| 系统架构 | `docs/ARCHITECTURE.md` |
| 技术选型 | `docs/tech-stack.md` |
| 接口契约 | `docs/api-contract.md` |
| 数据库设计 | `docs/database.md` |
| UI 规范 | `docs/ui-rules.md` |
| 架构决策 | `docs/decisions/README.md` |
| 当前任务 | `docs/tasks/CURRENT.md` |
