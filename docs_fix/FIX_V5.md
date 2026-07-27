# FIX_V5 — 通用 operation service

来源：`docs/PYCORE_MANAGER_BUG_LIST-2.md` §16.3–16.4、§19.2（operation 部分）。日期：2026-07-27。
依赖：FIX_V4（SQLite store 已可用）。

## 目标

在 `callmodule/services` 提供通用 operation 生命周期，禁止各 feature 私自再造内存 deque / published 数组。

## 范围

新建：

```text
pycore/callmodule/services/operation_service.py
pycore/callmodule/services/operation_event_service.py
pycore/callmodule/rpc_routes/operation_routes.py
```

只做通用 API + 最小 snapshot RPC；不拆 Agent History 业务文件。

## 必须实现的 API

1. `create_operation()` — 先持久化 operation + 全部可确定 items，再允许 worker 执行。
2. `claim_next_item()` — lease owner / lease expiry，避免 heartbeat 重入。
3. `transition_item()` — 合法状态转换 + 乐观 revision。
4. `checkpoint_item()` — 阶段产物引用，重启从最近阶段恢复。
5. `append_event()` — 结构化 event；日志文字只作补充。
6. `complete_operation_if_terminal()` — 从 items 聚合总状态。
7. `recover_interrupted()` — 启动时恢复过期 lease。
8. `cancel_operation()` — 只写 `cancel_requested`。
9. `retry_item()` — 增加 attempt，保留历史 error。
10. retention 后台清理已完成 operation/event；运行中永不清理。

## 写入粒度

- stage 开始/完成/error/result 立即持久化。
- 连续百分比最多每 250–1000ms 合并一次。
- 大文本和音频写 app cache/data；DB 只存 hash/size/mime/路径/metadata。
- 文件：temp + atomic replace；DB checkpoint 仅在文件落盘成功后提交。

## RPC（最小）

| 类型 | 路由建议 | 行为 |
|---|---|---|
| Query | `ui.operation.snapshot` | 读本地 snapshot，快速返回 |
| Command | `ui.operation.cancel` / `retry_item` | 只持久化受理，返回 operation_id |

禁止在这些 handler 内跑 AI/TTS/HTTP。

## 完成标准

- 可用一个假 kind（如 `noop_demo`）创建 operation → claim → checkpoint → succeed，进程重启后状态仍在。
- snapshot RPC 不碰网络、不扫盘。

## 明确不做

Agent History 拆分（FIX_V6）、事件 SSE 重构（FIX_V7）、Laravel logs（FIX_V8）。
