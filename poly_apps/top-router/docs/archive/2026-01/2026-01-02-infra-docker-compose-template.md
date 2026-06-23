# Task: 生成 infra/docker-compose.yml 与 infra/nginx.conf 模板

Status: done
Language: Simplified Chinese (zh-CN)
Owner: Codex
Goal: 输出“宿主机运行源码 + Docker 化 MySQL/Redis/Nginx + Certbot”模板文件。
Scope: infra/docker-compose.yml、infra/nginx.conf、说明事项。
Out of scope: 实际部署执行；证书申请交互流程实现。
Constraints: 保持现有配置结构；不新增依赖。

Plan:
- [ ] 生成 MySQL/Redis/Nginx/Certbot Compose 模板
- [ ] 生成可用的 Nginx 配置模板
- [ ] 更新文档记录

Progress Log:
- 2026-01-02: 创建任务并完成模板文件。

Acceptance:
- infra/docker-compose.yml 可用于基础设施容器化
- infra/nginx.conf 支持 HTTPS + 自动续期
