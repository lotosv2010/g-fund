# 当前任务（CURRENT）

## REQ-013：基金信息自动补全 + 一键同步

**进度**：5/5 完成 ✅

### Milestone 1：后端能力

- [x] T13.1.1 后端 `fetchFundInfo`：调天天基金 API 获取 name/type/riskLevel
- [x] T13.1.2 后端 `GET /funds/:code/preview` 接口
- [x] T13.1.3 后端 `POST /funds/sync-info` 批量补全接口

### Milestone 2：前端

- [x] T13.2.1 添加基金表单：代码输入失焦自动查询并预填字段
- [x] T13.2.2 列表页新增「同步基金信息」按钮 + 结果展示
