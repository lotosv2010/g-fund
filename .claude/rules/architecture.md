# 架构约束

## 模块边界

- `apps/web` 只通过 HTTP API 与后端通信，不直接连接数据库
- `apps/api` 模块间只通过 Service 层调用，不跨模块直接引用 Controller/Repository
- `packages/types` 只包含类型定义，不含业务逻辑
- LangGraph Agent 节点（`agent/nodes/`）只接收状态输入，通过 McpService/数据库获取数据，不直接调用路由

## 禁止的依赖方向

```
web → api（HTTP）     ✓
api module → api module（Service 注入）   ✓
agent node → McpService / DB   ✓

web → DB             ✗ 禁止
api Controller → 另一个 Controller   ✗ 禁止
agent node → NestJS Route   ✗ 禁止
```

## 分层规则

| 层 | 职责 | 禁止 |
|----|------|------|
| Controller | 接收请求、校验入参、返回响应 | 业务逻辑、直接查询 DB |
| Service | 业务逻辑、DB 事务 | 直接访问 HTTP 上下文 |
| Agent Node | AI 推理步骤 | 修改持久化状态 |
| McpService | MCP 通信 | 业务规则判断 |
