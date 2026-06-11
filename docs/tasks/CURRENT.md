# 当前任务（CURRENT）


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
