# Task: 主机运行源码 + Docker 化 Redis/MySQL/Nginx 方案

Status: done
Language: Simplified Chinese (zh-CN)
Owner: Codex
Goal: 提供“源码在宿主机运行、基础设施容器化”的部署步骤与注意事项。
Scope: Docker Compose 基础设施编排、宿主机应用连接配置、Nginx 反代方式。
Out of scope: 实际执行部署；TLS/证书自动化方案落地。
Constraints: 不改动运行逻辑；保持配置项与现有示例一致。

Plan:
- [ ] 汇总宿主机应用与容器化基础设施的连接方式
- [ ] 输出关键配置与注意事项
- [ ] 整理步骤清单

Progress Log:
- 2026-01-02: 创建任务并输出部署步骤清单。

Acceptance:
- 明确 MySQL/Redis 在 Docker 中的连接方式
- 明确 Nginx 反向代理到宿主机应用的方式
