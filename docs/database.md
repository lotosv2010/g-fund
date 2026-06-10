# 数据库设计

## 表结构

### funds（基金信息）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | |
| code | VARCHAR(20) UNIQUE | 基金代码 |
| name | VARCHAR(100) | 基金名称 |
| type | VARCHAR(20) | 基金类型 |
| risk_level | SMALLINT | 风险等级（1-5） |
| category | VARCHAR(20) | 分类（all/longterm/watchlist） |
| sort_order | NUMERIC | 排序权重 |
| target_amount | NUMERIC(18,2) | 目标持仓金额 |
| target_ratio | NUMERIC(5,2) | 目标仓位比例（%） |
| valuation_percentile | NUMERIC(5,2) | 估值百分位（0-100） |
| phase | VARCHAR(20) | 估值阶段（low/normal/high） |
| priority | INTEGER | 定投优先级（越大越优先） |
| base_amount | NUMERIC(18,2) | 基础定投金额 |
| weekly_return | NUMERIC(8,4) | 周收益率 |
| monthly_return | NUMERIC(8,4) | 月收益率 |
| note | TEXT | 备注 |
| created_at / updated_at | TIMESTAMPTZ | |

### positions（持仓快照）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | |
| fund_code | VARCHAR(20) UNIQUE | 基金代码 |
| fund_name | VARCHAR(100) | 基金名称 |
| shares | NUMERIC(18,4) | 持有份额 |
| cost_price | NUMERIC(10,4) | 平均成本净值 |
| cost_amount | NUMERIC(18,2) | 总投入金额（元） |
| created_at / updated_at | TIMESTAMPTZ | |

### transactions（交易流水）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | |
| fund_code | VARCHAR(20) | |
| type | VARCHAR(4) | buy \| sell |
| amount | NUMERIC(18,2) | 交易金额 |
| shares | NUMERIC(18,4) | 交易份额 |
| price | NUMERIC(10,4) | 成交净值 |
| trade_date | DATE | |
| note | TEXT | 备注 |

### daily_logs（每日日志，一天一条）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | |
| log_date | DATE UNIQUE | |
| summary | TEXT | 操作摘要 |
| market_note | TEXT | 市场观察笔记 |

### analysis_records（AI 分析记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | |
| provider | VARCHAR(20) | LLM provider |
| input_snapshot | JSONB | 分析时的持仓快照 |
| result | JSONB | 分析结果 |

### daily_snapshots（每日资产快照）

> Dashboard 盈亏曲线数据源。每日定时任务或首次访问时生成。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | |
| snapshot_date | DATE UNIQUE | 快照日期 |
| total_cost | NUMERIC(18,2) | 总投入成本 |
| total_value | NUMERIC(18,2) | 总市值（当时净值 × 份额） |
| total_pnl | NUMERIC(18,2) | 总盈亏（total_value - total_cost） |
| pnl_ratio | NUMERIC(8,4) | 收益率（total_pnl / total_cost） |
| position_count | INTEGER | 当时持仓数量 |
| positions_snapshot | JSONB | 持仓明细快照（fund_code, shares, value, pnl） |

### fund_nav_history（基金历史净值）

> 用于计算收益率和反弹信号。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | |
| fund_code | VARCHAR(20) | 基金代码 |
| nav_date | DATE | 净值日期 |
| nav_unit | NUMERIC(10,4) | 单位净值 |
| created_at | TIMESTAMPTZ | |

## 仓位计算规则

**买入**
```
新均价 = (原成本金额 + 本次金额) / (原份额 + 本次份额)
新份额 = 原份额 + 本次份额
新成本金额 = 原成本金额 + 本次金额
```

**卖出**
```
新份额 = 原份额 - 卖出份额
新成本金额 = 新份额 × 原均价  （均价不变）
本次盈亏 = (卖出净值 - 均价) × 卖出份额
```

## 止盈止损规则

**止盈三档**
| 档位 | 收益率 | 信号 | 建议 |
|------|--------|------|------|
| 一档 | ≥25% | 🟢 绿色 | 建议止盈 |
| 二档 | ≥40% | 🟡 黄色 | 强烈建议止盈 |
| 三档 | ≥60% | 🔴 红色 | 必须止盈 |

**止损两档**
| 档位 | 亏损率 | 信号 | 建议 |
|------|--------|------|------|
| 一档 | ≥10% | 🟡 黄色 | 建议止损 |
| 二档 | ≥20% | 🔴 红色 | 必须止损 |

## 定投计算规则

**公式**：`最终金额 = T × P2 × P3 × P4`

| 系数 | 含义 | 计算规则 |
|------|------|----------|
| T | 基础定投金额 | funds.base_amount |
| P2 | 估值百分位系数 | ≤20%→2.0, ≤40%→1.5, ≤60%→1.0, ≤80%→0.5, >80%→0.2 |
| P3 | 阶段系数 | low→1.5, normal→1.0, high→0.5 |
| P4 | 优先级系数 | ≥3→1.5, ≥2→1.2, ≥1→1.0, <1→0.8 |

**限制**：
- 上限：T × 3.0（最高 3 倍）
- 下限：最终金额 < T × 0.10 时跳过（不定投）

## 索引策略

```sql
CREATE INDEX idx_transactions_fund_code ON transactions(fund_code);
CREATE INDEX idx_transactions_trade_date ON transactions(trade_date DESC);
CREATE INDEX idx_daily_logs_date ON daily_logs(log_date DESC);
CREATE INDEX idx_analysis_created ON analysis_records(created_at DESC);
CREATE INDEX idx_daily_snapshots_date ON daily_snapshots(snapshot_date DESC);
```
