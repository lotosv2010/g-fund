# 系统架构

## 整体架构

```
Browser
  │  HTTP / SSE
  ▼
Next.js 15（apps/web）
  ├── Dashboard（资产总览）
  ├── 基金列表（CRUD）
  ├── 交易与持仓（持仓 + 交易 + 日志）
  └── AI 抽屉（SSE 流式 Chat）
  │  HTTP API
  ▼
NestJS 11（apps/api）
  ├── PostgreSQL（持仓/交易/日志/快照/分析记录）
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

## 前端架构

### 路由结构

```
/                    → redirect → /dashboard
/dashboard           → 资产总览（聚合统计 + 图表）
/funds               → 基金自选库 CRUD
/positions           → 交易与持仓（Tab: 当前持仓 / 买入卖出 / 操作日志）
```

> AI 分析不作为路由，以右侧 Drawer 形式全局可用。

### 页面组件映射

| 页面 | 核心组件 | 数据来源 |
|------|---------|---------|
| Dashboard | StatCards, PnLChart, PositionPie, RecentTrades | positions + transactions + daily_snapshots |
| 基金列表 | FundTable, FundFormModal | funds API |
| 交易与持仓 | PositionTable, TransactionForm, TradeLog | positions + transactions |
| AI 抽屉 | ChatDrawer, MessageBubble, SuggestionChips | SSE → analysis API |

### AI 抽屉架构

```
┌──────────────────────────────┐
│ 页面内容（全宽）                │
│                               │
│                    ┌──────────┤
│                    │ AI 抽屉   │
│                    │ Chat UI  │
│                    │ 400px    │
│                    └──────────┤
│  [AI 悬浮按钮]                 │
└──────────────────────────────┘
```

- 抽屉宽度 400px，可拖拽调整
- SSE 连接在 Drawer 关闭时断开，打开时重连
- 对话历史存储在前端 Zustand store，刷新丢失（不持久化）

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
