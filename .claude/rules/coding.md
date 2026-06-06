# 编码规范

## 通用

- 严格 TypeScript，禁止 `any`，用 `unknown` + 类型收窄替代
- 函数优先，类仅在 NestJS 装饰器场景使用
- 不写注释，除非隐藏约束或反直觉的实现原因
- 文件命名：`kebab-case.ts`，类命名：`PascalCase`

## 后端（NestJS）

- DTO 放在各模块目录下，用 `class-validator` 校验
- Service 方法返回明确类型，不返回 `Promise<any>`
- 数据库操作使用参数化查询，禁止字符串拼接 SQL
- 环境变量统一通过 `@nestjs/config` 的 `ConfigService` 读取

## 前端（Next.js）

- Server Component 优先，仅在需要交互时用 `"use client"`
- 状态管理用 Zustand，不引入 Redux
- API 调用统一封装在 `src/lib/api-client.ts`
- SSE 连接用原生 `EventSource`

## LangGraph Agent

- 每个节点函数签名：`(state: AnalysisState) => Promise<Partial<AnalysisState>>`
- MCP 批量调用用 `Promise.allSettled`，单个失败不中断整体
- 使用 `withStructuredOutput` + Zod schema 确保结构化输出可解析

## 命名约定

| 场景 | 规范 | 示例 |
|------|------|------|
| 文件 | kebab-case | `positions.service.ts` |
| 接口/类型 | PascalCase + I 前缀可选 | `Position`, `BuyDto` |
| 常量 | SCREAMING_SNAKE | `MAX_POSITION_WEIGHT` |
| 环境变量 | SCREAMING_SNAKE | `LLM_PROVIDER` |
