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
| ADR-006 | AI 功能体系：双源数据 + 止盈止损 + 定投提醒 + 定时同步 | Accepted |
| ADR-007 | AI Agent 实现方案：LangChain deep agent + MCP tools | Accepted |

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

---

## ADR-006：AI 功能体系 — 双源数据 + 止盈止损 + 定投提醒 + 定时同步

**背景**：基础数据层（funds/positions/transactions/daily-logs/daily-snapshots）已就绪，Agent 和 MCP 模块为 placeholder。需要设计完整的 AI 功能体系，覆盖实时监控、止盈止损预警、定投提醒、数据同步等场景。参考 portfolio-monitor skill 的规则体系（止盈止损规则、DCA 策略、报告模板）。

**决策**：

1. **双源数据架构**：天天基金 API（盘中实时，用于"今日"列）+ 盈米 MCP（T+1，用于历史分析和盈亏计算），通过 `MarketDataService` 统一抽象
2. **止盈止损规则引擎**：定投期只调速不卖；持有期三档止盈（25%/40%/60%）+ 两档止损（10%/20%）；深度套牢必须给出明确建议（补仓/止损/观望）
3. **定投金额叠加算法**：实际金额 = 基准金额 × T 系数 × P2 系数 × P3 系数 × P4 系数，上限 3 倍，下限 10% 归零
4. **LangGraph 主图扩展为 6 节点**：`dataFetcher → stopLossChecker → dcaCalculator → riskAnalyzer → advisor → reportGenerator`
5. **定时任务调度**（`@nestjs/schedule`）：
   - 每日 14:00 交易日 → 持仓监控报告
   - 双周四 14:30 → 定投执行提醒
   - 每日 16:30 → T+1 数据同步入库
   - 每日 17:00 → 估值分位同步
6. **数据库扩展**：新增 `stop_loss_records`、`dca_records`、`alert_configs` 三张表；`funds` 表增加 `valuation_percentile`、`weekly_return`、`monthly_return`、`phase`、`priority`、`target_amount`、`base_amount` 字段

**后果**：

- 需实现 `market-data` 模块封装天天基金 API + 盈米 MCP 双源
- 需实现 `scheduler` 模块管理 4 个 Cron Job
- LangGraph 节点从 3 个扩展到 6 个，状态类型需同步扩展
- 止盈止损规则硬编码在代码中，未来可通过 `alert_configs` 表实现可配置
- 天天基金 API 为公开接口，无认证但有请求频率限制，需做并发控制
- 交易日判断需维护节假日表或接入外部 API
- 实现预估 4 周：基础设施 1 周 → 核心分析 1 周 → 定时任务 3 天 → 前端集成 1 周

**详细设计**：见 `docs/decisions/AI-FEATURE-DESIGN.md`

---

## ADR-007：AI Agent 实现方案 — LangChain deep agent + MCP tools

**背景**：ADR-006 设计了 6 节点 StateGraph（dataFetcher → stopLoss → dcaCalc → riskAnalyzer → advisor → reportGen），但实际实现时需权衡两种路径：手写节点编排 vs LangChain deep agent。用户明确要求使用 LangChain deep agent 模式。

**备选方案**：

| 方案 | 技术路径 | 优点 | 缺点 |
|------|---------|------|------|
| A：手写 StateGraph | `new StateGraph()` + 6 个 `addNode` + 显式边 | 流程确定性强、可精确控制执行顺序 | 代码量大、扩展新分析维度需改图结构 |
| B：createReactAgent | `createReactAgent` + MCP tools 注入 | 代码精简、agent 自主编排、扩展只需加 tool | agent 调用顺序不确定、需精心设计 system prompt |
| C：混合方案 | createReactAgent + 部分硬编码边（如 dataFetcher 必须先执行） | 兼顾灵活性和确定性 | 复杂度高于 B，收益不明显 |

**决策**：采用方案 B — `createReactAgent`。

核心设计：

```
┌─────────────────────────────────────────────┐
│              createReactAgent                │
│  system prompt: 分析规则 + 报告模板          │
│  tools: [mcpGetFundDetail, mcpGetNavHistory, │
│          getPortfolioSummary, calcStopLoss,  │
│          calcDcaAmount, ...]                 │
│  checkpointer: MemorySaver (可选)            │
└──────────────────┬──────────────────────────┘
                   │ agent 自主编排 tool 调用
                   ▼
            SSE 流式输出到前端
```

1. **MCP tools 适配层**：`McpService` 封装盈米 MCP SSE 客户端，暴露结构化方法；`AgentToolsService` 将这些方法转为 LangChain `DynamicStructuredTool`（Zod schema 约束入参/出参）
2. **LLM 工厂**：`LlmFactory` 根据 `LLM_PROVIDER` 环境变量返回 `ChatOpenAI`（deepseek/moonshot）或 `ChatGoogleGenerativeAI`（minimax），统一 `baseUrl + apiKey` 配置
3. **System prompt**：内置止盈止损规则、定投系数算法、报告模板格式，指导 agent 分析方法论
4. **SSE 流式**：`AnalysisController` 暴露 `GET /analysis/stream?query=xxx`，使用 `agent.stream()` 逐步推送 token/tool 调用/result
5. **持久化**：分析完成写入 `analysis_records` 表（provider + inputSnapshot + result）

**后果**：

- 代码量大幅减少（约 4 个核心文件 vs 原设计 6+ 个节点文件）
- agent 调用顺序由 LLM 决定，需通过 system prompt 约束关键顺序（如"先获取持仓数据再分析"）
- 新增分析维度只需添加 tool + 更新 system prompt，无需改图结构
- MCP SSE 客户端需处理连接生命周期（connect/reconnect/disconnect）
- `@langchain/openai` 已安装，deepseek/moonshot 通过 OpenAI 兼容接口接入
