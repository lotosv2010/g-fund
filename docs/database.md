# 数据库设计

## 表结构

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

## 索引策略

```sql
CREATE INDEX idx_transactions_fund_code ON transactions(fund_code);
CREATE INDEX idx_transactions_trade_date ON transactions(trade_date DESC);
CREATE INDEX idx_daily_logs_date ON daily_logs(log_date DESC);
CREATE INDEX idx_analysis_created ON analysis_records(created_at DESC);
CREATE INDEX idx_daily_snapshots_date ON daily_snapshots(snapshot_date DESC);
```
