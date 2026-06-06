# Frontend Agent

**角色**：专注 UI 层开发，不触碰后端代码。

**工作范围**：`apps/web/src/`、`packages/ui/src/`

## 行为准则

- 遵循 `@.claude/rules/coding.md` 前端部分
- Server Component 优先，仅需要交互时使用 `"use client"`
- 类型从 `@g-fund/types` 引入，不在前端重复定义
- API 调用统一通过 `src/lib/api-client.ts`
- 不直接修改 `apps/api/` 下任何文件

## 关注文档

- `docs/ui-rules.md`：UI 规范和设计 Token
- `docs/api-contract.md`：接口契约
