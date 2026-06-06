# Tests

测试目录，按应用模块组织。

## 目录结构

```
tests/
├── api/          # NestJS 后端集成测试
│   ├── positions.spec.ts
│   ├── transactions.spec.ts
│   └── daily-logs.spec.ts
├── agent/        # LangGraph Agent 单元测试
│   └── graph.spec.ts
└── e2e/          # 端到端测试
```

## 测试策略

- Service 层：单元测试，覆盖仓位计算边界条件
- Controller 层：集成测试，验证 HTTP 请求/响应格式
- Agent 节点：单元测试，mock LLM 和 MCP 调用
- 数据库：使用真实 PostgreSQL（测试库），不 mock
