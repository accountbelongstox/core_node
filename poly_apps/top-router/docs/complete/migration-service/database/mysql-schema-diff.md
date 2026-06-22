# MySQL Schema 差异清单（基于 fork/database/migrations）

> 目的：列出 fork 中的表/索引，标注在本项目 `db/mysql/schema.sql` 的对齐情况，便于后续评审与扩展。  
> 参考来源：`/Users/wangxin/Documents/WangXinProjects/ai-projects/claude-relay-service/database/migrations/001_provider_accounts.sql`、`002_core_entities.sql`

## 对齐概览（当前状态）
- `db/mysql/schema.sql` 已包含 fork 迁移中的全部表与字段（含 JSON 字段、索引），为 **全量对齐** 版本。
- 当前暂无 schema 差异；若 fork 后续新增迁移，再补充此表。

## 表/索引对齐清单（按模块）

### Provider 账户/分组（已对齐）
- `provider_accounts`：`id` + `provider_type` 复合主键，`status`，`data JSON`，`created_at/updated_at`，索引 `(provider_type, updated_at)`
- `provider_account_groups`：`id`，`provider_type`，`name`，`strategy`，`config JSON`，索引 `(provider_type)`
- `provider_group_members`：`group_id` + `provider_account_id` 主键，`provider_type`，`weight`，外键到 `provider_account_groups(id)`
- `provider_account_status_history`：自增 `id`，`provider_account_id/provider_type/status`，`payload JSON`，`recorded_at`，索引 `(provider_account_id, recorded_at)`

### 核心计费/订阅/订单（已对齐）
- `plans`：`id`，`name/description`，`currency/price`，`data JSON`，`created_at/updated_at`
- `subscriptions`：`id`，`user_id`，`status`，`plan_id`，`billing_cycle`，`data JSON`，索引 `(user_id, updated_at)`
- `orders`：`id`，`user_id`，可选 `subscription_id/plan_id`，`status`，`data JSON`，索引 `(user_id, created_at)`
- `payments`：`id`，`order_id/user_id/subscription_id`，`provider/method/status`，`amount/currency`，`provider_transaction_id` 等，`data JSON`，`completed_at`，索引 `(user_id, created_at)`、`(order_id, created_at)`

### 客户端配置/事件（已对齐）
- `client_config_history`：`id`，`client_id`，`version`，`applied_at`，`operator`，`requires_restart`，`summary`，`encrypted_applied_config/changes`，`created_at`，索引 `(client_id, applied_at)`
- `clients`：`id`，`name`，`status`，`is_active`，`data JSON`，索引 `(status, updated_at)`
- `domain_events`：自增 `id`，`entity_type/entity_id`，`event_type`，`payload/metadata JSON`，`created_at`，索引 `(entity_type, entity_id, created_at)`
- `admin_audit_logs`：自增 `id`，`admin_id/username`，`action`，`target_type/id`，`metadata JSON`，`ip_address`，`created_at`，索引 `(admin_id, created_at)`

### API Keys 与 Usage（已对齐）
- `api_keys`：`id`，`hashed_key`，`user_id`，`status`，`data JSON`，`created_at/updated_at`，索引 `(user_id)`、`(hashed_key)`
- `api_key_usage_daily`：`api_key_id` + `usage_date` 主键，字段 `requests/tokens/input_tokens/output_tokens/cache_*/*long_context*/ephemeral*` 等，`created_at/updated_at`
- `api_key_usage_monthly`：同上，主键 `api_key_id + usage_month`
- `subscription_usage_daily`：`subscription_id + usage_date` 主键，`requests/input_tokens/output_tokens/total_tokens/cost`，`created_at/updated_at`
- `subscription_usage_monthly`：`subscription_id + usage_month` 主键，类似字段

## 待决策/后续
- 若 fork 新增迁移文件或本项目扩展业务模块，需在此补充差异项与采纳决定。
- 迁移脚本是否扩展以覆盖新增表（目前可仅用于 api_keys/usage），是否需要可选开关与对账逻辑。
