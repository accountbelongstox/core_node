# 任务: 客户端在线状态恢复

状态: 完成
语言: 简体中文（zh-CN）
负责人: 待定
目标: 修复因状态字段缺失导致 Client 被判定离线的问题。
范围:
- 调整 Client 记录规范化逻辑，补全在线/连接状态
不在范围内:
- 变更 Client 调度优先级
- 修改能力上报逻辑
约束:
- 不影响已有 Client 记录字段

计划:
- [x] 规范化时补全 status/connectionStatus

进度日志:
- 2025-12-26: 补全 status/connectionStatus 逻辑，避免误判离线。

验收:
- 在线 Client 不再因缺失 connectionStatus 被过滤
