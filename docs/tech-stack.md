# 技术选型

| 层级 | 技术 | 版本 | 选型理由 |
|------|------|------|---------|
| 构建 | Turborepo + pnpm workspaces | turbo ^2 | 增量构建，多包管理 |
| 语言 | TypeScript | ^5.8 | 全栈类型安全 |
| 前端框架 | Next.js（App Router） | ^15 | Server Component、SSR |
| 后端框架 | NestJS + Fastify | ^11 | 模块化、DI、性能 |
| 数据库 | PostgreSQL | 16 | 关系型，JSONB 支持 |
| AI 框架 | LangGraph.js + LangChain | ^0.2 | 状态图、多 Provider |
| LLM | deepseek / moonshot / minimax | — | 国内可用，成本低 |
| MCP | 盈米基金 MCP | — | 基金净值/行情数据 |
| 状态管理 | Zustand | ^5 | 轻量，React 友好 |
| 图表 | Recharts | ^2 | React 原生，轻量 |
| 监控 | LangSmith | — | LangGraph 原生集成 |
