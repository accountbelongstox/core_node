# 任务: 数据存储三驱动兼容冒烟清单

状态: 已完成
语言: 简体中文（zh-CN）
负责人: 待定
目标: 补充 redis/sqlite/mysql 三驱动的最小兼容验证清单。
范围:
- 数据存储基础兼容脚本
- 服务启动后的基础接口检查
不在范围内:
- 性能/压力测试
- 线上发布与回滚
约束:
- Redis 仍用于会话/限流/排行等功能（mysql 模式也需 Redis 可用）
- 用户管理使用 MySQL repo；非 mysql 模式需保持 MySQL 可用或跳过用户管理接口

计划:
- [ ] 归纳三驱动启动与脚本验证命令
- [ ] 列出每驱动的最小接口检查

进度日志:
- 2025-12-26: 输出三驱动兼容验证清单。

验收:
- 提供 redis/sqlite/mysql 的最小验证清单
- 标注必要依赖与注意事项

验证清单:

Redis
1) `DATASTORE_PROVIDER=redis`
2) `node scripts/test-datastore-compat.js`
3) 启动服务后请求 `/health`

SQLite
1) `DATASTORE_PROVIDER=sqlite`
2) `SQLITE_FILENAME=./data/relay.sqlite`（或自定义路径）
3) `node scripts/test-datastore-compat.js`
4) 启动服务后请求 `/health`

MySQL
1) `DATASTORE_PROVIDER=mysql` + `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`
2) `node scripts/test-datastore-compat.js`
3) `node scripts/migrate-redis-to-mysql.js reconcile`
4) 启动服务后请求 `/health`
