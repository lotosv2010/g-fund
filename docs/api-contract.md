# 前后端接口契约

Base URL：`http://localhost:4000/api`

## 仓位管理

### GET /positions
返回全部持仓（含 MCP 实时净值）

响应：
```json
[
  {
    "fundCode": "110022",
    "fundName": "易方达消费行业",
    "shares": 23548.12,
    "costPrice": 2.1234,
    "costAmount": 50000,
    "currentNav": 2.31,
    "currentValue": 54397.16,
    "pnlAmount": 4397.16,
    "pnlRate": 0.0879,
    "weight": 0.23
  }
]
```

### POST /positions/buy
```json
{
  "fundCode": "110022",
  "fundName": "易方达消费行业",
  "amount": 10000,
  "price": 2.1234,
  "tradeDate": "2026-06-06",
  "note": "定投"
}
```

### POST /positions/sell
```json
{
  "fundCode": "110022",
  "shares": 1000,
  "price": 2.31,
  "tradeDate": "2026-06-06",
  "note": ""
}
```

### DELETE /positions/:fundCode
清仓，自动生成 sell 记录。

## 交易记录

### GET /transactions
查询参数：`fundCode`、`startDate`、`endDate`、`limit`（默认50）

## 每日日志

### GET /daily-logs
查询参数：`limit`（默认30）

### GET /daily-logs/:date
日期格式：`YYYY-MM-DD`

### PUT /daily-logs/:date
```json
{
  "summary": "买入消费基金",
  "marketNote": "市场震荡，继续持有"
}
```

## AI 分析

### POST /analysis/run
触发分析，SSE 流式返回进度。

SSE 事件格式：
```
data: {"step":"fetch_data","status":"done","message":"已获取5支基金净值"}
data: {"step":"risk_analysis","status":"running"}
data: {"step":"advice","status":"done","result":{...}}
data: {"step":"complete","analysisId":42}
```

### GET /analysis/history
查询参数：`limit`（默认10）

### GET /analysis/:id
返回单次分析完整结果。
