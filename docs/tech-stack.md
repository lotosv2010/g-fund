# 技术选型

| 层级 | 技术 | 版本 | 选型理由 |
|------|------|------|---------|
| 构建 | Turborepo + pnpm workspaces | turbo ^2 | 增量构建，多包管理 |
| 语言 | TypeScript | ^5.8 | 全栈类型安全 |
| 前端框架 | Next.js（App Router） | ^15 | Server Component、SSR |
| 后端框架 | NestJS + Fastify | ^11 | 模块化、DI、性能 |
| 数据库 | PostgreSQL | 16 | 关系型，JSONB 支持 |
| AI 框架 | LangGraph.js + LangChain | ^0.2 | 状态图、多 Provider |
| LLM | deepseek / moonshot / minimax | — | 国内可用，成本低 |
| MCP | 盈米基金 MCP | StreamableHTTP | 基金净值/行情数据 |
| 状态管理 | Zustand | ^5 | 轻量，React 友好 |
| 图表 | Recharts | ^2 | React 原生，轻量 |
| 监控 | LangSmith | — | LangGraph 原生集成 |

## MCP 配置

盈米基金 MCP 使用 StreamableHTTP 传输协议，配置存储在数据库 `app_settings` 表（key=`mcp_config`）。

### 标准 MCP 客户端配置格式

```json
{
  "mcpServers": {
    "qieman": {
      "url": "https://stargate.yingmi.com/mcp/v2",
      "headers": {
        "x-api-key": "85hC7jMkQB5HkIYP-MXkfg",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}
```

### 项目存储格式（McpConfig）

```json
[
  {
    "id": "default",
    "name": "盈米",
    "url": "https://stargate.yingmi.com/mcp/v2",
    "apiKey": "85hC7jMkQB5HkIYP-MXkfg",
    "enabled": true
  }
]
```

`apiKey` 在连接时映射为 `headers["X-Api-Key"]`，`Accept` header 由 MCP SDK 自动处理。
