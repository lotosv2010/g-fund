# 当前任务（CURRENT）

## Milestone 6：同步与历史会话

| ID | 任务 | 状态 | 估时 |
|----|------|------|------|
| T6.1.1 | 一键同步仓位（依据现有持仓 + 上一交易日数据更新净值/收益/持仓金额） | [x] | 1d |
| T6.1.2 | AI 回答 Markdown 美化（react-markdown + remark-gfm + rehype-highlight + 表格/代码主题） | [x] | 0.5d |
| T6.1.3 | AI 抽屉预设问题美化（卡片样式 + 图标 + 分组） | [x] | 0.25d |
| T6.1.4 | 历史会话 + 新建会话（chat_sessions / chat_messages 表 + 侧栏会话列表 + 切换/删除） | [x] | 1.5d |

## Milestone 7：止盈止损与定投

| ID | 任务 | 状态 | 估时 |
|----|------|------|------|
| T7.1.1 | funds 表字段扩展（valuation_percentile / phase / priority / target_amount / base_amount / weekly_return / monthly_return） | [x] | 0.5d |
| T7.1.2 | 止盈三档（25/40/60%）+ 止损两档（10/20%）规则引擎 | [x] | 1d |
| T7.1.3 | 深度套牢反弹信号检查（连续 3 日 >1% 或周累计 >3%） | [x] | 0.5d |
| T7.1.4 | 定投金额叠加算法（T × P2 × P3 × P4，上限 3 倍 / 下限 10% 归零） | [x] | 1d |

## Milestone 8：AI 体验增强

| ID | 任务 | 状态 | 估时 |
|----|------|------|------|
| T8.1.1 | 多轮上下文（后端 runAgent 接收 history 参数） | [x] | 0.5d |
| T8.1.2 | SSE 重连 / 错误恢复（指数退避 + 断点续传） | [x] | 0.5d |
| T8.1.3 | 分析结果持久化到 analysis_records + 历史查看入口 | [x] | 0.5d |
| T8.1.4 | AI 抽屉快捷指令（今日监控 / 定投计算 / 止盈止损 / 板块分析 / 基金诊断） | [x] | 0.5d |
| T8.1.5 | Cmd+K 全局唤起 AI 抽屉 | [x] | 0.25d |
| T8.1.6 | AI 会话 loading 动画（请求中 / 流式输出中无视觉反馈，需补充加载状态） | [x] | 0.25d |

## Milestone 9：Dashboard 增强

| ID | 任务 | 状态 | 估时 |
|----|------|------|------|
| T9.1.1 | 止盈止损速览卡片（🔴/🟡/🟢 信号 + 操作建议） | [x] | 0.5d |
| T9.1.2 | 下次定投预估卡片（双周四日期 + 预估金额） | [x] | 0.25d |
| T9.1.3 | 最近预警时间线（来源：stop_loss_records） | [x] | 0.5d |
| T9.1.4 | 基金诊断 / 单基金深度分析页 | [x] | 1d |

## Milestone 10：阶段判断与数据基础（P0）

> 目标：让"DCA 阶段 / 持有阶段"切换真正生效；接入实时盘中数据；为后续规则提供准确口径。

| ID | 任务 | 状态 | 估时 |
|----|------|------|------|
| T10.1.1 | funds.phase 语义拆分：拆为 valuation_level（low/normal/high）+ lifecycle_stage（dca/holding），迁移现有数据 | [x] | 0.5d |
| T10.1.2 | 阶段判断服务：持仓金额 / 目标金额 ≥ 80% → holding，否则 dca；提供 GET /funds/:code/stage 接口 | [x] | 0.5d |
| T10.1.3 | 阶段切换记录：funds 表新增 stage_changed_at；交易后自动重算并写 daily_logs | [x] | 0.5d |
| T10.1.4 | 接入天天基金盘中估值 API（estimate_nav / daily_return），新增 RealtimeQuoteService | [x] | 1d |
| T10.1.5 | fund_nav_history 增加 daily_return 字段；同步任务回填历史数据 | [x] | 0.5d |
| T10.1.6 | 基金资产类型字段扩展（asset_type：equity/bond/gold/qdii/index），用于例外规则匹配 | [x] | 0.25d |
| T10.1.7 | 市场指数表 market_index_history（沪深300/中证500 等），定时拉取 | [x] | 0.5d |

## Milestone 11：规则配置入库与界面（P1）

> 目标：阈值/系数从硬编码迁移到 DB；提供 UI 调整；支持单基金例外。

| ID | 任务 | 状态 | 估时 |
|----|------|------|------|
| T11.1.1 | DB：dca_rules 表（P0~P4 阈值与系数 + T1~T4 系数 + 上下限） | [ ] | 0.25d |
| T11.1.2 | DB：slp_rules 表（止盈三档 / 止损两档 / 深度套牢线 / 预警线） | [ ] | 0.25d |
| T11.1.3 | DB：fund_rule_overrides 表（fund_code、不止损、止损放宽、暂停调速、固定金额） | [ ] | 0.25d |
| T11.1.4 | DB：slp_signals_log 表（fund_code、type、level、triggered_at、pnl_rate、message、resolved） | [ ] | 0.25d |
| T11.1.5 | DB：dca_snapshots 表（plan_date、各基金 base/p0/p1/p2/p3/p4/T/final 明细、是否执行） | [ ] | 0.25d |
| T11.1.6 | DcaService / StopLossTakeProfitService 改为从 DB 读取规则，移除硬编码常量 | [ ] | 1d |
| T11.1.7 | 规则配置 UI：/settings/rules 页（DCA 系数表 + 止盈止损档位表，行内编辑） | [ ] | 1d |
| T11.1.8 | 单基金例外 UI：/funds/[code] 页加 "不止损 / 止损放宽 / 暂停调速 / 固定金额" 开关 | [ ] | 0.5d |
| T11.1.9 | app_settings 扩展 key=bullet_reserve（金额 + 上次触发日期） | [ ] | 0.25d |

## Milestone 12：DCA 规则引擎补全（P1）

> 目标：补齐 P0/P1/P2/T 系数与季度再平衡，让定投计算与文档一致。

| ID | 任务 | 状态 | 估时 |
|----|------|------|------|
| T12.1.1 | 双周四判断：is_biweekly_thursday(锚点 2026-05-28)，前后端共用同一 API（GET /dca/next-date） | [ ] | 0.25d |
| T12.1.2 | P0 QDII 申购检查：调用 BatchGetFundTradeLimit，canAllot=false 强制归零 | [ ] | 0.5d |
| T12.1.3 | P1 当日大盘检查：>+2% 暂缓 / <-2% 加仓 / 连续 3 日推迟后强制执行 | [ ] | 0.5d |
| T12.1.4 | P2 近 1 周大盘趋势：累计涨>5% × 0.5 / 跌>5% × 1.3 | [ ] | 0.5d |
| T12.1.5 | P3 单基金近 1 月：>20%×0 / >10%×0.5 / <-10%×1.5 / <-5%×1.3 | [ ] | 0.5d |
| T12.1.6 | T1~T4 优先级系数：低估+大缺口×1.2 / 接近止盈×0.5 / 超配×0 | [ ] | 0.5d |
| T12.1.7 | 子弹仓机制：沪深300 单周跌>-8% 触发一次性加投，下月补充 | [ ] | 0.5d |
| T12.1.8 | 季度再平衡：3/6/9/12 月第一个定投日，偏差>5% 调整 priority | [ ] | 0.75d |
| T12.1.9 | 例外规则：纯债不调速 / 黄金止损放宽 -15% / 低估指数基金不止损 | [ ] | 0.5d |
| T12.1.10 | dca_snapshots 写入：每次计算后留痕，含各系数明细与最终金额 | [ ] | 0.25d |

## Milestone 13：止盈止损规则引擎补全（P1）

> 目标：实现深度套牢 A/B/C 决策、四态预警、实时数据驱动。

| ID | 任务 | 状态 | 估时 |
|----|------|------|------|
| T13.1.1 | 阶段感知：仅 holding 阶段触发止盈止损；dca 阶段只输出预警不输出操作 | [ ] | 0.25d |
| T13.1.2 | 预警线四态：🔴接近止盈(>20%) / 🟡接近止损(>-8%) / 🔵低估(<30%) / 🟢正常 | [ ] | 0.5d |
| T13.1.3 | 反弹判定改用实时数据：连续 3 个交易日 daily_return>1% OR 周累计>3% | [ ] | 0.5d |
| T13.1.4 | 深度套牢决策（亏损>20%）：A 补仓 / B 观望 / C 止损 三选一硬性输出 | [ ] | 1d |
| T13.1.5 | 观望升级规则：连续 5 个交易日观望且继续下跌 → 升级止损或维持并给止损触发价 | [ ] | 0.5d |
| T13.1.6 | 信号去重与历史：写入 slp_signals_log，相同档位 24h 内不重复推送 | [ ] | 0.5d |
| T13.1.7 | 估值分位条件分流：亏损≥20% + 估值>30% → 赎回50%；估值<30% → 加仓 | [ ] | 0.25d |
| T13.1.8 | 接近档位提示：距离下一档差距百分比，前端展示 | [ ] | 0.25d |

## Milestone 14：AI Agent 工具集扩充（P2）

> 目标：把规则与实时数据暴露给 AI，让回答有据可依，消除 prompt 与代码两处维护。

| ID | 任务 | 状态 | 估时 |
|----|------|------|------|
| T14.1.1 | Tool: getDcaPlan（返回本期定投计划，含 P0~P4 / T 系数明细） | [ ] | 0.5d |
| T14.1.2 | Tool: getStopLossSignals（当前所有触发 / 接近触发的信号） | [ ] | 0.25d |
| T14.1.3 | Tool: getRebalanceSuggestion（实际占比 vs target_ratio 偏差报告） | [ ] | 0.5d |
| T14.1.4 | Tool: getDeepLossDiagnosis（亏损>20% 基金的 A/B/C 决策上下文） | [ ] | 0.5d |
| T14.1.5 | Tool: getRealtimeQuote（天天基金盘中估值 + daily_return） | [ ] | 0.25d |
| T14.1.6 | Tool: getRules（返回 dca_rules / slp_rules 当前生效配置） | [ ] | 0.25d |
| T14.1.7 | Tool: getFundStage（单基金阶段：dca / holding + 进度） | [ ] | 0.25d |
| T14.1.8 | prompt.ts 改造：移除硬编码规则文本，改为引导调用 getRules；强化 A/B/C 输出约束 | [ ] | 0.5d |
| T14.1.9 | LangSmith trace metadata：节点级 fundCode / phase / signal 上报 | [ ] | 0.25d |


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
| T17.1.9 | 文档合并：止盈止损规则.md + DCA策略指南.md 操作清单合并为统一推送动作表 | [ ] | 0.25d |
