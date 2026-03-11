# 多API URL切换系统 - 架构设计指南 — 总结文档

对用户提供的 `<content>`（多API URL切换系统架构设计指南）的简明总结。

## 结构
- Markdown 指南：系统概述（高可用、故障转移、性能、多环境）→ 核心原理（多端点配置、优先级测试流程、连通性策略、持久化 localStorage）→ 三层架构（应用层/管理层/配置层）→ 实现步骤（5 步：配置、ApiManager、集成、初始化、UI）→ 最佳实践（优先级、超时、错误处理、安全）→ 案例（laravel_dashboard、wordflow-ai）→ 对比表与五层总结 → 参考实现与版本。

## 要点
- **多端点**：每端点含 id、url、protocol、port、priority、isLocal、description；按优先级排序后遍历测试。
- **连通性**：2xx–4xx 视为可用；超时约 1 秒；记录响应时间；用户选择 > 自动检测 > 配置优先级。
- **ApiManager**：initialize、checkEndpoint、autoDetect、setEndpoint、getCurrentBaseUrl；持久化 api_current_endpoint、api_auto_detected、api_user_modified。
- **推荐优先级**：本地(localhost) → 局域网主/备 → 云端 HTTPS；超时 1s、后台检查 60s、重试 3 次。

## 用途
为前端实现多 API 地址自动切换与高可用提供架构与实现指引，适用于企业内网、多环境及高可用场景；可参考 laravel_dashboard、wordflow-ai 的实现。
