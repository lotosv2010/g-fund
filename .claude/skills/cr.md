---
description: Code Review 检查清单。用法：/cr <文件路径>
---

# /cr — Code Review

## 使用方式

```
/cr apps/api/src/positions/positions.service.ts
```

完整流程走 `/feat` Phase 6，本命令用于快速单文件审查。

## 评分维度（满分 100）

| 维度 | 权重 |
|------|------|
| 正确性 | 25 |
| 可读性 | 20 |
| 可维护性 | 20 |
| 安全性 | 15 |
| 性能 | 10 |
| 测试覆盖 | 10 |

评级：≥90 ✅ / 75-89 🟡 / 60-74 🟠 / <60 🔴

完整量规见 `.claude/skills/feat/references/review-rubric.md`。

## 严重度

🔴 Critical（阻塞）/ 🟠 Major / 🟡 Minor / 🔵 Nitpick

**速查 Critical**：`any` / 空 catch / apps 间直接 import / 硬编码密钥 / SQL 注入

## 本项目重点检查

- 仓位买卖操作是否在单个 DB 事务中完成
- MCP 调用是否用 `Promise.allSettled` 并发
- SSE 连接是否在 `finally` 块中关闭
- SQL 是否全部参数化（`$1, $2`）
- 测试文件在 `tests/`，不散落 `src/`

## 输出格式

六维评分表 → 问题清单（按 🔴🟠🟡🔵 分组，每条附 `文件:行号` + Before/After）→ 亮点 ≥1 条
