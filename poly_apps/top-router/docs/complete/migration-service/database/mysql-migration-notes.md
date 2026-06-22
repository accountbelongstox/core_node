# MySQL 迁移速记（扩展版）

> 目标：在保持 Redis/sqlite 兼容的同时，补充 MySQL 持久化（默认仍可用 Redis/sqlite）。

## Schema
- 路径：`db/mysql/schema.sql`（provider_accounts/groups、plans/subscriptions/orders/payments、clients/config_history、users、api_keys + usage 等）
- 如需更多表/索引（如 domain_events、audit_logs），请在此基础上补充，并记录与 fork 的差异。

## 脚本与命令
- 迁移/对账脚本：`scripts/migrate-redis-to-mysql.js`
  - dry-run（不写 MySQL，仅打印计划）：`node scripts/migrate-redis-to-mysql.js migrate --dry-run`
  - 默认迁移全部支持模块：`node scripts/migrate-redis-to-mysql.js migrate`
  - 仅迁移单类/组合：
    - `node scripts/migrate-redis-to-mysql.js migrate providers,account_groups`
    - `node scripts/migrate-redis-to-mysql.js migrate plans,subscriptions,orders,payments`
    - `node scripts/migrate-redis-to-mysql.js migrate clients`
    - `node scripts/migrate-redis-to-mysql.js migrate users`
    - `node scripts/migrate-redis-to-mysql.js migrate api_keys,usage`
  - 对账（计数比对）：`node scripts/migrate-redis-to-mysql.js reconcile`
- 依赖：脚本总是从 redis driver 读取，写入独立的 mysql 连接（`DATASTORE_PROVIDER=mysql` 配好即可；redis 连接也需可用）。
- 读写兼容冒烟（任选其一）：设置 `DATASTORE_PROVIDER=mysql` 后运行 `node scripts/test-datastore-compat.js` 验证基础 set/get/hash/zset。

## Dry-run / 对账 Checklist
1) 确认环境变量：
   - `DATASTORE_PROVIDER=mysql`
   - MySQL 连接参数（`DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`）
2) Dry-run 预检（不写入）：
   - `node scripts/migrate-redis-to-mysql.js migrate --dry-run`
   - 如需分模块：`node scripts/migrate-redis-to-mysql.js migrate providers,plans --dry-run`
3) 正式迁移（写入）：
   - `node scripts/migrate-redis-to-mysql.js migrate`
4) 对账：
   - `node scripts/migrate-redis-to-mysql.js reconcile`
5) 回滚（必要时）：
   - 切回 `DATASTORE_PROVIDER=redis` 或 sqlite
   - MySQL 表可按需 truncate（迁移前请先备份）

## 回滚/只读
- 迁移是“新增写入”，不删除 Redis 数据；回滚可直接切回 `DATASTORE_PROVIDER=redis` 或 sqlite。
- 如需清空 MySQL 已迁移数据，可 drop 相应表或 truncate；请先停写并备份。
- 建议先 dry-run + reconcile，再执行正式迁移；迁移后再跑 reconcile 确认计数一致。
- 只读模式：当前应用无独立只读开关；可保持 `DATASTORE_PROVIDER=redis` 运行，仅用 MySQL 做迁移验证。
- 如需硬性只读，建议使用 MySQL 只读账号或开启实例 `read_only`，确保写入被拒绝。

## 待补
- 若 fork 新增迁移或本项目扩展业务模块，需补充 schema 与对应迁移段。
- 可选：为 migrate/reconcile 增加 CI 选项或状态脚本（status-unified/manage 等）。
