# 系统架构

## 整体架构

```
Browser
  │  HTTP / SSE
  ▼
Next.js 15（apps/web）
  ├── Dashboard（资产总览）
  ├── 基金列表（CRUD + 诊断）
  ├── 交易与持仓（持仓 + 交易 + 日志 + 快照）
  ├── 设置（AI/MCP 配置 + 规则管理）
  └── AI 抽屉（SSE 流式 Chat）
  │  HTTP API
  ▼
NestJS 11（apps/api）— 16 个功能模块
  ├── PostgreSQL（持仓/交易/日志/快照/规则/信号）
  ├── 盈米 MCP（基金行情/净值/资产分类）
  ├── stock-api（大盘指数实时行情 + K 线）
  ├── 天天基金（盘中估值 fallback）
  ├── 蛋卷基金（指数估值百分位）
  └── DeepAgent（deepagents 库 + 工具模式）
        ├── DB 工具：getPortfolioSummary, getTransactions
        ├── 领域工具：getDcaPlan, getStopLossSignals, getRebalanceSuggestion, ...
        └── MCP 工具：动态发现的盈米基金工具
```

## 关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 后端框架 | NestJS + Fastify | 模块化、TypeScript 原生、Fastify 性能 |
| AI 框架 | deepagents（基于 LangChain） | 工具模式更灵活，LLM 自主决定调用顺序 |
| SSE vs WebSocket | SSE | 分析为单向推送，SSE 更简单 |
| 仓位计算 | Service 层事务 | 不用触发器，便于调试和测试 |
| 指数行情 | stock-api | 零依赖、多数据源自动兜底（腾讯→新浪→东财） |

## 前端架构

### 路由结构

```
/                    → redirect → /dashboard
/dashboard           → 资产总览（聚合统计 + 图表 + 止盈止损 + 定投估算）
/funds               → 基金自选库 CRUD（全部/长持/观察）
/funds/[code]        → 基金诊断（信号 + 定投计划 + 估值 + 规则覆盖）
/positions           → 交易与持仓（Tab: 当前持仓 / 交易记录 / 操作日志）
/settings/ai         → AI 提供商 + MCP 服务器管理
/settings/rules      → 定投规则 + 止盈止损规则配置
```

> AI 分析不作为路由，以右侧 Drawer 形式全局可用。

### 页面组件映射

| 页面 | 核心组件 | 数据来源 |
|------|---------|---------|
| Dashboard | MarketIndexBoard, StatCards, PnLChart, StopLossTakeProfitCard, DcaEstimateCard | positions + market-index + SLP + DCA |
| 基金列表 | FundTable, FundFormModal | funds API |
| 基金诊断 | DcaEstimateCard, StopLossTakeProfitCard, RuleOverrides | fund-specific DCA + SLP + rules |
| 交易与持仓 | PositionTable, TransactionForm, SyncPositionsButton | positions + transactions + snapshots |
| AI 抽屉 | ChatDrawer, MessageBubble, SuggestionChips | SSE → chat API |

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
- 对话历史持久化在 PostgreSQL（chat_sessions / chat_messages）

## AI Agent 架构

Agent 基于 `deepagents` 库，采用工具模式（非节点图）：

```
用户消息
  ↓
DeepAgent（LLM + System Prompt）
  ↓ 自主决定工具调用顺序
  ├── getPortfolioSummary()    → DB 持仓概览
  ├── getTransactions()        → DB 交易记录
  ├── MCP 动态工具             → 盈米基金行情/净值
  ├── getDcaPlan()             → 定投计划计算
  ├── getStopLossSignals()     → 止盈止损信号
  ├── getRebalanceSuggestion() → 再平衡建议
  ├── getDeepLossDiagnosis()   → 深度套牢决策
  ├── getRealtimeQuote()       → 天天基金盘中估值
  ├── getRules()               → 规则配置
  └── getFundStage()           → 生命周期阶段
  ↓
Markdown 分析报告（SSE 流式输出）
```

- 工具调用上限：10 次
- 递归上限：50 轮
- 历史上限：20 轮
- MCP 工具调用带 TTL 缓存（交易时段 30s / 非交易 5min）

## 数据源

| 数据源 | 用途 | 接入方式 |
|--------|------|---------|
| 盈米 MCP | 基金净值、资产分类、交易限额 | MCP 协议（HTTP） |
| stock-api | 大盘指数实时行情、K 线 | npm 包直接调用 |
| 天天基金 | 盘中估值（MCP fallback） | JSONP API |
| 蛋卷基金 | 指数估值百分位 | REST API |
| PostgreSQL | 持仓/交易/规则/快照/日志 | Drizzle ORM |
