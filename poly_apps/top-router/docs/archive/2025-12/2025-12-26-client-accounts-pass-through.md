# 任务: Client 账户列表透传

状态: 已完成
语言: 简体中文（zh-CN）
负责人: 待定
目标: WebSocket 客户端收到 accounts 请求后，直接调用本地 /admin/accounts 并透传返回。
范围:
- 新增 /admin/accounts 聚合接口
- WebSocket query_accounts 走 /admin/accounts 透传
不在范围内:
- 前端页面逻辑改造
- 账户字段结构调整
约束:
- 不新增文件
- 仅做透传/聚合，不额外加工字段

计划:
- [ ] 增加 /admin/accounts 聚合接口
- [ ] WebSocket query_accounts 改为调用 /admin/accounts
- [ ] 验证返回结构与 server 端一致

进度日志:
- 2025-12-26: 新增 /admin/accounts 聚合接口并让 query_accounts 走本地透传。
- 2025-12-26: 按最新方向回滚 /admin/accounts 透传方案，任务取消。

验收:
- /admin/accounts 返回 accounts 列表
- query_accounts 通过 /admin/accounts 返回数据
