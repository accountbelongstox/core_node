# FIX_V8 — Laravel 日志镜像链（Laravel → pycore → UI）

来源：`docs/PYCORE_MANAGER_BUG_LIST-2.md` §15。日期：2026-07-27。
依赖：FIX_V4（`remote_cursors` / snapshot）；建议 FIX_V7 事件总线可用后再接 `laravel.logs.changed`。

## 目标

UI 不直连 Laravel 日志。完整链路：

```text
Laravel bounded log API
  → pycore LaravelLogMirrorService
  → pycore persistent snapshot/event
  → ui.laravel.logs_snapshot RPC
  → pycore-manager global log panel
```

## A. Laravel

新建（先扫描复用现有 internal controller / auth / DTO）：

```text
poly_apps/laravel_main/app/Services/Pycore/LaravelLogTailService.php
poly_apps/laravel_main/app/Http/Controllers/Internal/PycoreLogController.php
```

路由建议：`GET /api/internal/pycore/logs/latest`。

要求：

1. 只读配置确定的 active log 文件；客户端不能传任意 path。
2. 支持 `cursor/limit/max_bytes/levels`；服务端强制上限（如 200 entries / 256 KiB）。
3. 从文件尾部向前读；识别 daily rotation；cursor 含 `file_id, byte_offset, mtime`。
4. 多行 exception 合成一个 entry。
5. 返回 `id, timestamp, level, channel, message, context, trace_id`。
6. 对 token/Authorization/cookie/API key/DB 密码/本机绝对路径脱敏。
7. 使用现有 pycore worker/internal auth；禁止 no-auth 暴露日志。
8. 响应含 `next_cursor, source_file_id, source_updated_at, truncated, has_more`。
9. 日志 channel 增加 pycore `trace_id/operation_id/item_id` context。

## B. pycore

新建：`laravel_log_mirror_service.py` + `laravel_log_routes.py`。

1. 后台按当前 active Laravel endpoint 拉增量；不在 UI RPC 内等远程网络。
2. 每 endpoint 独立 cursor / last_success / error / bounded entries。
3. 拉成功后原子写 snapshot，再发 `laravel.logs.changed` 失效通知。
4. 失败保留上次成功数据，返回 `stale=true`。
5. `ui.laravel.logs_snapshot` 只读本地快照，必须快速返回。
6. `ui.laravel.logs_refresh` 只受理 command 并返回 operation id。
7. retention 按条数+时间；不得写入 `user_data.json`。
8. pycore 自身 `laravel_http` 摘要与 Laravel application log 分开展示，可用 trace id 关联。

## C. UI

1. 日志状态放 pycore-manager 顶层 provider；页面切换不销毁。
2. 初次进入读缓存 snapshot，显示 endpoint / source_updated_at / fetched_at / stale。
3. 收到 `laravel.logs.changed` 按 revision 拉新 snapshot；不用 event payload 当完整日志。
4. 支持 level / trace id / operation id 过滤。
5. Laravel 离线时继续显示最后快照并标 stale；禁止清空面板制造“没有错误”假象。

## 完成标准（对照 §21.5）

- UI 只通过 pycore 获取 Laravel 日志。
- Laravel 不可达时显示最后成功快照 + stale + 错误。
- API 有认证、大小上限、cursor、rotation、脱敏。

## 明确不做

删除旧 `laravel_http` 事件；改 Agent History 业务。
