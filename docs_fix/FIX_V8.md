# FIX V8：Laravel 最后更新日志镜像

## 1. 目标

Pycore 从 Laravel 获取最后更新日志，持久镜像并返回 UI。Laravel 或 UI 暂时断开时保留最后成功数据、cursor、刷新进度和错误。

## 2. 前置

使用 V4 repository、V5 operation、V7 WS events。禁止页面 SQLite 或浏览器 cursor。

## 3. Laravel 契约

版本化 endpoint 返回有界 page：

- source/stream；
- opaque next_cursor；
- source revision/monotonic identity；
- UTC source timestamp；
- ordered records；
- has_more、server_time、contract_version。

record 有 stable source_record_id、level/type、summary、安全 details、occurred_at、可选 entity reference。cursor 对 Pycore 不透明；若暂时无 cursor，用文档化稳定复合键，不能只用 timestamp。

## 4. 镜像数据

持久化 last successful cursor/revision、mirrored records 或 latest summary、last attempt/success、fetch status/operation_id、structured error、contract version。records 和新 cursor 同事务；持久化前不前进 cursor。

## 5. refresh operation

stage：initialize、load_cursor、request_page、validate_contract、persist_page、continue_or_finalize、publish_snapshot。

事件：laravel.logs.refresh.started、page.received、page.persisted、refresh.progress/completed/failed、snapshot.updated。只放安全摘要/cursor hash，不放 token、cookie、敏感正文。

## 6. RPC routes

- laravel.logs.snapshot：立即返回最后持久快照和 freshness/error。
- laravel.logs.refresh：幂等启动/加入刷新。
- laravel.logs.status：operation snapshot。
- laravel.logs.records：有界 cursor 分页。
- laravel.logs.cancel：按能力取消。

初次加载不能无限等待 Laravel；旧快照立即返回，active refresh 单独显示。

## 7. Laravel client

集中 base URL/auth/TLS/timeout/retry/error mapping；使用 connect/read/overall 绝对 deadline；仅幂等 page read 有界退避+jitter；检测 cursor 不前进；校验 size/version/id/order/time；区分 401/403、contract mismatch、timeout、invalid JSON、5xx；脱敏 credential/headers/stack/sensitive fields。

## 8. freshness

snapshot 明确 fresh/stale/refreshing/unavailable、source revision/cursor、last success/attempt、age、last_error、active operation。Laravel 宕机时返回 stale last success，不用空成功覆盖。Pycore 重启从 durable cursor 继续。

## 9. UI

显示 last success、source update、freshness、count、refresh progress、failure。V7 snapshot.updated 按 revision 刷新。manual refresh 使用 idempotency，明确 join/reject/supersede，不能堆积 job。

## 10. 验收

- Pycore 重启后仍返回最后成功日志。
- Laravel 宕机返回 stale + error，不返回假空数据。
- cursor 与 records 原子前进。
- 重复 page 不重复记录。
- UI 看到 page/record progress 和终态。
- 重连重放 snapshot update。
- event 无 Laravel secret/敏感正文。