# Task: Linux 服务器 MySQL 部署方案（Docker vs 手工）

Status: done
Language: Simplified Chinese (zh-CN)
Owner: Codex
Goal: 输出 server 模式在 Linux + MySQL 场景下的部署方案（MySQL 容器化、源码不上传公有镜像）。
Scope: Docker Compose（含 MySQL/Redis）、手工部署流程、关键配置项、镜像构建与分发方式。
Out of scope: 具体环境搭建执行；生产监控/备份策略实现。
Constraints: 保持现有配置结构；不新增依赖。

Plan:
- [ ] 汇总现有部署方式与 MySQL 配置项
- [ ] 对比 Docker 与手工部署的优缺点
- [ ] 给出推荐方案与最小落地步骤

Progress Log:
- 2026-01-02: 创建任务并完成 Docker/手工部署对比与建议（含本地构建/私有分发）。

Acceptance:
- 输出 Docker 与手工部署方案的对比与推荐
- 覆盖 MySQL 连接与 schema 初始化要点
