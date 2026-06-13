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
| ADR-008 | AI 设置页面 + 动态 LLM 配置（DB 驱动，运行时生效） | Accepted |
| ADR-009 | 一键同步仓位 + Markdown 渲染美化 + 历史会话管理 | Accepted |
| ADR-010 | 止盈止损规则引擎 + 定投叠加算法 + Cron 双源数据同步 | Proposed |
| ADR-011 | AI 体验增强：多轮上下文 + SSE 重连 + 快捷指令 + 全局唤起 | Proposed |
| ADR-012 | Dashboard 增强：止盈止损速览 + 定投预估 + 预警时间线 + 基金诊断 | Proposed |
| ADR-013 | 基金信息自动补全：代码查询预填 + 一键批量同步 | Accepted |
| ADR-014 | 信息架构重构：预警/生命周期迁至 positions，诊断页收窄为基金画像 | Proposed |

---

## ADR-014：信息架构重构（funds / positions / 诊断页边界对齐）

**状态**：Proposed
**日期**：2026-06-13

### 背景

当前布局存在职责错位：
- funds 列表展示了「预警等级」和「生命周期」——这两者都是持仓运营数据，与持仓绑定而非与基金自身属性绑定
- 诊断页展示了「止盈止损分析」和「持仓详情」——这是持仓操作数据，放在以基金静态属性为主的诊断页语义不清
- positions 页缺少持仓维度的运营信号入口，用户需要在 funds 列表和诊断页之间跳转

### 决策

采用方案 B：完全迁移，无冗余展示。

1. **funds-table**：移除「预警等级」「生命周期」两列；columns 从 15 列减至 13 列
2. **诊断页 `/funds/[code]`**：移除「止盈止损分析」Card 和「持仓详情」Card；页面副标题改为「基金画像」；保留估值信息、定投建议、例外规则
3. **positions 行**：新增「预警等级」Tag 列（复用 SignalLevel 色系）、「生命周期」Tag 列；新增「信号」按钮，点击打开 `PositionSignalDrawer`
4. **新建 `PositionSignalDrawer`**：展示该基金的完整止盈止损信号列表（与原诊断页止盈止损 Card 内容一致）；不含定投建议和例外规则
5. **数据流**：positions/page.tsx 额外加载 `stopLossTakeProfitApi.list()` 和 `fundsApi.list()`，通过 fundCode join 后传给 PositionTable

### 影响

- 纯前端变更，无后端 / 数据库改动
- PositionTable 新增 props：`signals?: StopLossTakeProfitSignal[]`、`funds?: FundListItem[]`
- 用户查看持仓信号的路径：positions 页 → 行「信号」按钮 → 抽屉
- 诊断页入口保留，定位为「基金静态画像」（估值/定投/规则），不再展示持仓动态数据
