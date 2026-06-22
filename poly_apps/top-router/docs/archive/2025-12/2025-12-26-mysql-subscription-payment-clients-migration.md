# 任务: MySQL 订阅/支付/Clients 迁移与冒烟

状态: 已完成
语言: 简体中文（zh-CN）
负责人: 待定
目标: 在 MySQL 模式下让订阅/支付/Clients 数据读写落表，保持 Redis/SQLite 兼容。
范围:
- subscriptionService/paymentService/clientService 的 MySQL 读写
- 执行 Redis → MySQL 迁移与 reconcile
- 订阅/支付/Clients 管理接口冒烟
不在范围内:
- 支付沙箱联调与回调验签
- WS/VPN 运行稳定性验证
约束:
- 不影响 Redis/SQLite 现有逻辑

计划:
- [x] 补齐订阅/支付/Clients MySQL 读写路径
- [x] 迁移与对账（plans/subscriptions/orders/payments/clients）
- [x] 管理端接口冒烟并修复异常

进度日志:
- 2025-12-26: 完成 MySQL 读写切换与迁移。
- 2025-12-26: reconcile 与接口冒烟完成，修复 config history LIMIT 参数问题。

验收:
- MySQL 模式下订阅/支付/Clients 读写正常
- 迁移与对账完成，结果记录
- 管理端相关接口冒烟通过
