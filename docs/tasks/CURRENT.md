# 当前任务（CURRENT）

## 当前焦点

Milestone 1 数据层 + Milestone 2 AI Agent + Milestone 3 前端已完成。下一步：Milestone 2 扩展（Cron 定时任务）或 T1.3.4 ChatDrawer。

**ADR-007**：使用 LangChain deep agent（`createDeepAgent` from `deepagents`）替代手写 StateGraph。

## Milestone 1：基础数据层

| ID | 任务 | 状态 | 估时 |
|----|------|------|------|
| T1.1.1 | packages/types 共享类型定义 | [x] | 0.5d |
| T1.1.2 | packages/db 连接池实现 | [x] | 0.5d |
| T1.1.3 | NestJS positions 模块实现 | [x] | 1d |
| T1.1.4 | NestJS transactions 模块实现 | [x] | 0.5d |
| T1.1.5 | NestJS daily-logs 模块实现 | [x] | 0.5d |
| T1.1.6 | NestJS daily-snapshots 模块实现（新增） | [x] | 0.5d |

## Milestone 2：AI Agent（ADR-007 deep agent）

| ID | 任务 | 状态 | 估时 |
|----|------|------|------|
| T1.2.1 | McpService — 盈米 MCP SSE 客户端封装 | [x] | 0.5d |
| T1.2.2 | LLM 工厂 + AgentToolsService | [x] | 0.5d |
| T1.2.3 | createDeepAgent + system prompt + SSE 流式 | [x] | 1d |
| T1.2.4 | AnalysisModule — Controller + Service + 注册 | [x] | 0.5d |

## Milestone 3：前端（按新导航结构）

| ID | 任务 | 状态 | 估时 |
|----|------|------|------|
| T1.3.1 | 导航重构：侧边栏菜单调整 + 路由重定向 | [x] | 0.5d |
| T1.3.2 | Dashboard 总览页（StatCards + PnLChart + PositionPie + RecentTrades） | [x] | 1.5d |
| T1.3.3 | 交易与持仓页（Tab 结构：持仓 / 交易 / 日志 / 投资日记） | [x] | 1.5d |
| T1.3.4 | ChatDrawer AI 抽屉（SSE 流式 Chat + 全局唤起） | [ ] | 1.5d |

## Milestone 4：基金列表端到端

| ID | 任务 | 状态 | 估时 |
|----|------|------|------|
| T1.4.1 | packages/db 连接池（drizzle-orm）+ 002_funds.sql 迁移 | [x] | 0.5d |
| T1.4.2 | @g-fund/types Fund 类型（Fund/FundListItem/CreateFundDto/UpdateFundDto） | [x] | 0.25d |
| T1.4.3 | NestJS main.ts + AppModule + DbModule + FundsModule（CRUD） | [x] | 1d |
| T1.4.4 | 前端 antd + Dashboard Layout + api-client + 基金列表页 | [x] | 1d |
