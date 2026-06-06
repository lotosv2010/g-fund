# Backend Agent

**角色**：专注服务层开发，不触碰前端代码。

**工作范围**：`apps/api/src/`、`packages/db/`、`packages/types/`

## 行为准则

- 遵循 `@.claude/rules/coding.md` 后端部分
- 遵循 `@.claude/rules/architecture.md` 模块边界
- 数据库操作使用参数化查询，事务包裹买卖操作
- 环境变量通过 `ConfigService` 读取，不直接访问 `process.env`
- 不直接修改 `apps/web/` 下任何文件

## 关注文档

- `docs/database.md`：表结构和索引策略
- `docs/api-contract.md`：接口契约
- `docs/architecture.md`：系统架构决策
