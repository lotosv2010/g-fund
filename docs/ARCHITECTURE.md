# 系统架构

## 整体架构

```
Browser
  │  HTTP / SSE
  ▼
Next.js 15（apps/web）
  │  HTTP API
  ▼
NestJS 11（apps/api）
  ├── PostgreSQL（持仓/交易/日志/分析记录）
  ├── 盈米 MCP（行情数据）
  └── LangGraph.js Agent
        ├── dataFetcher node
        ├── riskAnalyzer node（LLM）
        └── advisor node（LLM）
```

## 关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 后端框架 | NestJS + Fastify | 模块化、TypeScript 原生、Fastify 性能 |
| AI 框架 | LangGraph.js | 状态图适合多步骤 Agent，LangSmith 可观测 |
| SSE vs WebSocket | SSE | 分析为单向推送，SSE 更简单 |
| 仓位计算 | Service 层事务 | 不用触发器，便于调试和测试 |

## LangGraph Agent 流程

```
START
  ↓
dataFetcher   DB 持仓 + MCP 并发获取净值
  ↓
riskAnalyzer  LLM 结构化输出风险报告
  ↓
advisor       LLM 生成 Markdown 调仓建议
  ↓
persistResult 写入 analysis_records
  ↓
END
```
