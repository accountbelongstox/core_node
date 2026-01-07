# Task: 生成 .env.server.example

Status: done
Language: Simplified Chinese (zh-CN)
Owner: Codex
Goal: 基于 .env.example 生成适用于宿主机部署的 .env.server.example。
Scope: .env.server.example 内容调整（MySQL/Redis 默认值）。
Out of scope: 实际部署执行；Nginx/证书配置变更。
Constraints: 保持变量结构与 .env.example 一致。

Plan:
- [ ] 复制 .env.example
- [ ] 调整 MySQL/Redis 默认值
- [ ] 归档任务

Progress Log:
- 2026-01-02: 创建任务并完成 .env.server.example。

Acceptance:
- .env.server.example 可直接用于宿主机部署配置
