# 当前任务（CURRENT）


## Milestone 14：AI Agent 工具集扩充（P2）

> 目标：把规则与实时数据暴露给 AI，让回答有据可依，消除 prompt 与代码两处维护。

| ID | 任务 | 状态 | 估时 |
|----|------|------|------|
| T14.1.1 | Tool: getDcaPlan（返回本期定投计划，含 P0~P4 / T 系数明细） | [x] | 0.5d |
| T14.1.2 | Tool: getStopLossSignals（当前所有触发 / 接近触发的信号） | [x] | 0.25d |
| T14.1.3 | Tool: getRebalanceSuggestion（实际占比 vs target_ratio 偏差报告） | [x] | 0.5d |
| T14.1.4 | Tool: getDeepLossDiagnosis（亏损>20% 基金的 A/B/C 决策上下文） | [x] | 0.5d |
| T14.1.5 | Tool: getRealtimeQuote（天天基金盘中估值 + daily_return） | [x] | 0.25d |
| T14.1.6 | Tool: getRules（返回 dca_rules / slp_rules 当前生效配置） | [x] | 0.25d |
| T14.1.7 | Tool: getFundStage（单基金阶段：dca / holding + 进度） | [x] | 0.25d |
| T14.1.8 | prompt.ts 改造：移除硬编码规则文本，改为引导调用 getRules；强化 A/B/C 输出约束 | [x] | 0.5d |
| T14.1.9 | LangSmith trace metadata：节点级 fundCode / phase / signal 上报 | [x] | 0.25d |


## Milestone 15：UI 完善与可视化（P2）

| ID | 任务 | 状态 | 估时 |
|----|------|------|------|
| T16.1.1 | Dashboard 新增"阶段进度"卡（持仓金额/目标 80% 进度条 + dca/holding 标签） | [ ] | 0.5d |
| T16.1.2 | StopLossTakeProfitCard 升级为四态预警 + 距下一档差距 | [ ] | 0.5d |
| T16.1.3 | DcaEstimateCard 展开 P0~P4 / T 各系数明细（折叠面板 / hover 提示） | [ ] | 0.5d |
| T16.1.4 | Funds 列表新增列：当前阶段 / 当前预警等级 | [ ] | 0.25d |
| T16.1.5 | /funds/[code] 详情展示当前所处档位 + 距离下一档差距 | [ ] | 0.5d |
| T16.1.6 | AlertTimeline 切换数据源到 slp_signals_log（历史信号） | [ ] | 0.5d |
| T16.1.7 | 定投执行状态：本期 dca_snapshots 标记"已执行 / 待执行"+ 一键标记按钮 | [ ] | 0.5d |

## Milestone 17：大盘指数实时看板（P1）

> 目标：Dashboard 顶部新增大盘看板，覆盖上证 / 深证 / 沪深300 / 创业板 / 科创50 / 北证50 等核心指数，提供实时点位、涨跌幅、成交额；同时为 P1 当日大盘 / P2 近 1 周趋势 / 子弹仓触发提供数据源。

| ID | 任务 | 状态 | 估时 |
|----|------|------|------|
| T18.1.1 | 数据源调研与选型：新浪财经 / 腾讯财经 / 东方财富免费行情 API（无需鉴权，CORS 通过后端代理） | [ ] | 0.25d |
| T18.1.2 | DB：market_index_history 表（index_code、name、close、change_pct、turnover、trade_date、updated_at） | [ ] | 0.25d |
| T18.1.3 | 后端 MarketIndexService：实时报价拉取（默认 6 大指数：sh000001/sz399001/sh000300/sz399006/sh000688/bj899050）+ 失败回退缓存 | [ ] | 0.5d |
| T18.1.4 | 接口：GET /market/indices（实时点位列表）+ GET /market/indices/:code/history（近 N 天走势） | [ ] | 0.5d |
| T18.1.5 | 调度：交易日 9:30~15:00 每 30s 刷新，盘后归档当日收盘到 market_index_history | [ ] | 0.5d |
| T18.1.6 | 前端 MarketIndexBoard 卡片：顶部横向滚动卡片组，展示点位 / 涨跌幅 / 涨跌额 / 迷你走势线（近 1 日分时） | [ ] | 0.75d |
| T18.1.7 | 大盘单卡详情抽屉：点击展开近 1 周 / 1 月 / 1 年走势 + 与持仓相关性 | [ ] | 0.75d |
| T18.1.8 | 接入规则引擎：P1 当日大盘 / P2 近 1 周趋势 / 子弹仓沪深 300 单周 -8% 触发条件改用此服务 | [ ] | 0.5d |
| T18.1.9 | 用户自定义关注指数：app_settings 存 watchlist_indices，UI 加配置入口（增删指数代码） | [ ] | 0.5d |
| T18.1.10 | 非交易时段降级：周末 / 节假日 / 收盘后展示昨收数据并标注"已收盘"，避免无效轮询 | [ ] | 0.25d |

## Milestone 18：清理与测试（P3）

| ID | 任务 | 状态 | 估时 |
|----|------|------|------|
| T17.1.1 | 删除已废弃的 apps/api/src/analysis 模块（analysis_records 表已 drop） | [ ] | 0.25d |
| T17.1.2 | 合并 AlertTimeline 与 StopLossTakeProfitCard 重叠逻辑 | [ ] | 0.25d |
| T17.1.3 | 移除 funds.weeklyReturn / monthlyReturn 静态字段（改为实时计算或缓存） | [ ] | 0.25d |
| T17.1.4 | 单测：DCA 系数计算（P0~P4 / T / 上下限 / 例外规则） | [ ] | 1d |
| T17.1.5 | 单测：止盈止损（三档 / 两档 / 反弹 / 深度套牢 A/B/C） | [ ] | 1d |
| T17.1.6 | 单测：阶段判断（边界 79.9% / 80% / 80.1%） | [ ] | 0.25d |
| T17.1.7 | 集成测试：定投全流程（真实 PostgreSQL，禁止 mock） | [ ] | 1d |
| T17.1.8 | 集成测试：止盈止损全流程 + 信号去重 | [ ] | 0.5d |
