# 任务: Clients 账户列表为空修复

状态: 进行中
语言: 简体中文（zh-CN）
负责人: 待定
目标: 修复 /admin-next/admin/clients 页面账户列表弹窗为空的问题，确保能展示客户端账户列表。
范围:
- 排查 WebSocket 查询账户链路
- 修复客户端账户收集逻辑
- 验证列表渲染
不在范围内:
- 账号数据清洗或迁移
- 其他管理端功能改造
约束:
- 保持现有接口与数据格式兼容

计划:
- [ ] 定位账户列表为空的根因
- [ ] 修复客户端账户收集与返回
- [ ] 验证弹窗展示结果

进度日志:
- 2025-12-26: 定位为 websocketClientService 账户服务 require 路径错误，已修复路径。
- 2025-12-26: 回滚 /admin/accounts 聚合，恢复 collectAccountsInfo 走各账户服务并补充 gemini-api。
- 2025-12-26: 移除 query_accounts/collectAccountsInfo，列表改走 /admin/:segment 透传。
- 2025-12-27: 修复 WS 本地请求 service 为空与 0.0.0.0 回环访问问题。
- 2025-12-27: 补齐 WS response payload 的 requestId，避免服务端匹配不到请求。
- 2025-12-27: 补齐嵌入模式 CCR 账户列表请求与 client 端透传路由。
- 2025-12-27: 删除未使用的 Clients.vue（避免与 admin/Clients.vue 重名混淆）。

验收:
- 账户列表弹窗能显示客户端账户数据
- WebSocket 查询账户返回非空（存在账户时）
