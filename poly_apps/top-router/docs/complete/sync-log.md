# 同步与验证记录

## 2025-12-07
- 完成可插拔 datastore（Redis/SQLite）落地，新增 SQLite schema 与 setup 脚本；默认 Redis。
- 引入 WebSocket/Translation/VPN 框架（默认关闭），调整相关目录与配置示例。
- SQLite/Redis 兼容检查：`npm run test:datastore` 在两种模式下通过；SQLite 模式业务路由 smoke 通过。
- 数据迁移脚本 dry-run：`data-transfer export --sanitize` + `import --dry-run` 验证成功。
- 上游同步：`git pull origin main`（无冲突）。
- 配置向后兼容、基础检查（lint/test/test:datastore）、脱敏日志审阅完成。

