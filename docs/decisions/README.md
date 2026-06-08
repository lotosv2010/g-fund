# 架构决策记录（ADR）

ADR 记录重要的技术决策。格式：背景 → 决策 → 后果。

## 索引

| 编号 | 标题 | 状态 |
|------|------|------|
| ADR-001 | NestJS + Fastify 后端框架 | Accepted |
| ADR-002 | LangGraph.js 管理 AI 分析流程 | Accepted |
| ADR-003 | 仓位计算在 Service 层用事务处理 | Accepted |
| ADR-004 | 基金自选库（funds 表）+ drizzle-orm + antd 前端 | Accepted |
| ADR-005 | 导航结构重构：Dashboard + 合并页面 + AI 抽屉 | Accepted |

---


## ADR-001：使用 NestJS + Fastify 作为后端框架

**背景**：需要一个 TypeScript 友好、模块化的后端框架，同时对 SSE 流式输出有性能要求。

**决策**：选用 NestJS（依赖注入、装饰器、模块化）+ Fastify adapter（比 Express 性能更好）。

**后果**：需要在 NestJS 中通过 `reply.raw` 实现 SSE；学习成本略高于 Express。

---

## ADR-002：LangGraph.js 状态图管理 AI 分析流程

**背景**：AI 分析涉及多步骤（数据获取 → 风险分析 → 建议生成），需要状态管理和可观测性。

**决策**：使用 LangGraph.js StateGraph，配合 LangSmith 追踪每个节点执行情况。

**后果**：自动获得 LangSmith 可观测性；节点间状态传递需要明确类型定义。

---

## ADR-003：仓位计算在 Service 层用事务处理

**背景**：买入/卖出操作需同时写 transactions 和更新 positions，需保证原子性。

**决策**：在 PostgreSQL 事务中完成 INSERT + UPDATE，不使用数据库触发器。

**后果**：逻辑在代码层可调试、可测试；需要确保所有买卖路径都走事务。

---

## ADR-004：基金自选库（funds 表）+ drizzle-orm + Ant Design

**背景**：需要打通第一个端到端链路（DB → API → 前端），验证整体架构可用。选型需决定 ORM 方案和前端 UI 库。

**决策**：
- 新建 `funds` 表作为基金自选库（含持仓金额、目标金额、目标比例、持仓收益字段）
- ORM 选用 drizzle-orm（类型安全、轻量、与 pg 原生兼容，避免重型 ORM）
- 前端 UI 选用 Ant Design 5，通过 `@ant-design/nextjs-registry` 适配 App Router SSR
- 连接池通过 NestJS 全局 `DbModule`（`@Global()`）注入，各 Service 用 `@Inject(DB)` 取用

**后果**：drizzle-orm schema 在 `packages/db/src/schema.ts` 集中管理；所有模块共享同一 Pool 实例；antd 主题色与 UI 规范保持一致。

---

## ADR-005：导航结构重构 — Dashboard + 合并页面 + AI 抽屉

**背景**：原有 4 个平级菜单（基金列表、持仓管理、每日日志、AI 分析）存在以下问题：
- 持仓管理与每日日志天然耦合（交易产生日志），分开后用户需频繁切换页面
- AI 分析作为独立页面，打断操作流，且 Chat 形式更适合侧边抽屉而非全页
- 缺少 Dashboard 总览页，用户进入系统后无全局资产视图

**决策**：
1. 新增 Dashboard 作为默认着陆页（`/dashboard`），展示资产聚合、盈亏曲线、持仓分布
2. 合并「持仓管理」与「每日日志」为「交易与持仓」页面（`/positions`），内含 3 个 Tab：当前持仓、买入卖出、操作日志
3. AI 分析从路由页面改为右侧 Drawer（400px 宽），通过悬浮按钮 / Header 图标 / `Cmd+K` 快捷键全局唤起
4. 新增 `daily_snapshots` 表存储每日资产快照，为 Dashboard 盈亏曲线提供数据源

**后果**：
- 菜单从 4 项精简为 3 项（总览、基金列表、交易与持仓），信息架构更清晰
- AI 分析可从任何页面唤起，不再打断用户操作流
- 需新增 `daily_snapshots` 表及对应的快照生成逻辑（定时任务或懒生成）
- `positions` 页面复杂度上升，需用 Tab 组件做好分区
- ChatDrawer 需管理 SSE 连接生命周期（开/关时连接/断开）
