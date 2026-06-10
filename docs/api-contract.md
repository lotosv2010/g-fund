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

### POST /positions/sync
一键同步：从 MCP 拉取最新公布净值并按 `份额 × 净值` 更新各基金市值（`funds.currentValue`）。

响应：
```json
{
  "total": 5,
  "succeeded": 4,
  "failed": 0,
  "skipped": 1,
  "syncedAt": "2026-06-10T08:30:00.000Z",
  "items": [
    {
      "fundCode": "110022",
      "fundName": "易方达消费行业",
      "status": "success",
      "oldValue": "50000.00",
      "newValue": "54397.16",
      "navUnit": "2.3100",
      "navDate": "2026-06-09"
    },
    {
      "fundCode": "001102",
      "fundName": "前海开源国家比较优势",
      "status": "skipped",
      "oldValue": "0.00",
      "navUnit": "1.5230",
      "navDate": "2026-06-09",
      "reason": "缺少份额或成本净值，无法计算市值"
    }
  ]
}
```

`status`：`success` 已更新；`skipped` 拿到净值但缺份额/成本无法折算市值；`failed` 工具调用或解析失败。MCP 未连接 / 无可用净值工具时全部 `failed`，HTTP 仍返回 200。

### GET /positions/sync/stream
SSE 流式同步，per-fund 推送进度。无需请求体，浏览器端用 `EventSource` 订阅即可。

事件格式（每条 `data:` 为一个 JSON）：
```
data: {"type":"started","total":5,"toolName":"fund_history_nav","codeArgName":"fundCode"}
data: {"type":"item","index":0,"total":5,"result":{"fundCode":"110022","fundName":"易方达消费行业","status":"success","oldValue":"50000.00","newValue":"54397.16","navUnit":"2.3100","navDate":"2026-06-09"}}
data: {"type":"item","index":1,"total":5,"result":{"fundCode":"001102","status":"skipped","reason":"缺少份额或成本净值，无法计算市值",...}}
data: {"type":"done","result":{"total":5,"succeeded":4,"failed":0,"skipped":1,"syncedAt":"2026-06-10T08:30:00.000Z","items":[...]}}
```

异常时推 `{"type":"error","message":"..."}` 后流终止；MCP 未连接 / 无净值工具时仍走 `started → item × N → done` 流程，全部 item 为 `failed`。

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
