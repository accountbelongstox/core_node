# 任务: CCR API URL 规范化修复

状态: 已完成
语言: 简体中文（zh-CN）
负责人: 待定
目标: 修复 CCR Claude 转发路径重复拼接 /v1 导致 404 的问题。
范围:
- CCR 转发 URL 规范化逻辑
- CCR 账号表单提示说明
不在范围内:
- 上游服务配置调整
- 其他路由改造
约束:
- 不修改线上数据

计划:
- [x] 统一 CCR apiUrl 规范化并拼接 /v1/messages
- [x] 更新 CCR 账号表单提示

进度日志:
- 2025-12-25: 完成 CCR apiUrl 规范化与表单提示更新。

验收:
- apiUrl 支持 base 或 /v1/messages 形式，转发地址不再出现 /v1/v1/messages
