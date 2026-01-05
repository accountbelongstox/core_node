# 任务: Clients 账户列表复用方案

状态: 进行中
语言: 简体中文（zh-CN）
负责人: 待定
目标: 全面检查 /admin-next/admin/clients 的账户列表弹窗与后台“账户管理”差异，制定最大化复用方案。
范围:
- 账户列表与编辑弹窗的 UI/数据/API 差异梳理
- 复用策略与落地步骤
不在范围内:
- 立即实施全部改造
- 新增业务功能
约束:
- 兼容现有账号类型与管理端交互
- 保持 Admin 端现有路径与行为稳定

计划:
- [ ] 盘点 Accounts 视图在嵌入模式下的 UI 差异（桌面表格/移动卡片、列内容、按钮/操作）
- [ ] 对齐数据结构：补齐 client accounts 的字段（accountType、proxy、expiresAt、auth*、usage、rateLimitStatus 等）并统一平台命名
- [ ] 抽象账户 API 适配层：Accounts/AccountForm/CcrAccountForm/AccountExpiryEditModal/UsageModal 统一走 accountApi
- [ ] 明确功能开关：分组/绑定统计/使用详情等 client 不支持功能的隐藏或降级策略
- [ ] 清理冗余组件（如 ClientAccountEditModal）并确认嵌入布局强制使用桌面表格

进度日志:
- 2025-12-26: 开始梳理现有差异与复用路径。
- 2025-12-26: 完成差异梳理与复用方案草案。
- 2025-12-26: 嵌入列表改为 accountsStore Promise.all 获取并绑定 client 上下文。
- 2025-12-26: 列表接口改为透传 /admin/clients/:id/:segment -> client /admin/:segment。
- 2025-12-26: 聚合接口 /admin/clients/:id/accounts 改为按 segment 透传并包含 ccr。
- 2025-12-26: 对齐 /admin/ws/clients/:id/accounts 为 segment 透传聚合。
- 2025-12-26: 移除 query_accounts/collectAccountsInfo 相关实现并更新文档。
- 2025-12-26: AccountsView 嵌入提供 adminApi/buildAdminApiUrl，账户子组件改走注入。
- 2025-12-26: 补齐 /admin/clients/:id 透传余额/分组/测试/脚本等接口并支持本地流式测试。

验收:
- 形成完整复用方案（包含差异清单、适配策略、拆分步骤）
