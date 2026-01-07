# 任务: 账户余额接口 Redis 实例为空报错修复

状态: done
语言: 简体中文（zh-CN）
负责人:
目标: 修复账户余额相关接口在 Redis 实例为空时的报错问题。
范围:
- accountBalanceService 使用正确的数据存储实例
不在范围:
- 余额脚本逻辑调整
- WebSocket 连接问题处理
约束:
- 保持现有缓存行为不变

计划:
- [ ] 定位报错调用链与实例来源
- [ ] 修复引用并验证
- [ ] 更新文档记录

进展记录:
- 2025-12-26: 创建任务并开始处理
- 2025-12-26: accountBalanceService 改为使用 datastore

验收:
- /admin/accounts/balance/summary 不再因 Redis null 报错
