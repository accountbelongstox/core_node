# FIX_V7 — RPC 语义 + 统一事件流 + callback 隔离

来源：`docs/PYCORE_MANAGER_BUG_LIST-2.md` §14.2–14.5。日期：2026-07-27。
依赖：建议在 FIX_V5 有 snapshot RPC 之后做；可与 FIX_V6 并行，但事件 envelope 字段需对齐 operation。

## 目标

1. RPC 分 Query / Command / Stream，绝对 deadline 不被重连重置。
2. WS 只传 RPC；SSE 是唯一 broadcast；禁止前端布尔抢占。
3. callback 隔离，单 handler 抛错不中断其它订阅者。

## A. RPC request/response

| 类型 | 规则 |
|---|---|
| Query | 有绝对 deadline；可安全重发；不启动工作 |
| Command | 只完成持久化受理；要 idempotency key；快速返回 operation/revision |
| Stream | 只走统一事件流；可从 seq 恢复 |

前端 `PendingCall` 增加：`createdAt, deadlineAt, attempts, idempotencyKey, retryPolicy`。
timer 按 `deadlineAt - now`；断线/welcome 只重发，不重置 deadline；超时从 `pendingCalls` 删除并 reject。

服务端：

1. 同一 `client_id + idempotency_key + route` 只受理一次 command。
2. command 完成 = 已持久化并入队，≠ 任务完成。
3. sync route 含扫描/HTTP/AI/TTS/subprocess/大文件 IO → 必须改成 command。
4. error 统一 `{code, message, retryable, details, trace_id}`。

主要文件：`PycoreWs.ts`、相关 RPC server handler；新建 `PycoreRpcClient.ts`（若扫描无等价物）。

## B. 统一事件流

固定：

1. WebSocket 只传 RPC request/response/ack。
2. SSE 是唯一 broadcast event transport。
3. SSE 不可用时 UI 退化为定时拉 snapshot；不要临时让 WS 发另一份无共同 offset 的事件。
4. 若保留 WS fallback：握手时服务端选定 `event_transport`，两 transport 共享同一持久化 seq 与 ACK offset。

envelope 字段见源文档 §14.3 JSON。持久化要求：

- seq 与 event row 写入 store 后才能发送。
- `since` 超过保留窗口 → `stream.reset_required`（含 oldest/current seq）；禁止静默从 ring 中间继续。
- 慢消费者 overflow → 立即 reset 并关连接。
- pycore 重启后 seq 继续单调增长。
- snapshot 含 `snapshot_revision` + `event_seq`。
- at-least-once；客户端按 `event_id`/`seq` 去重。

新建/重构：`PycoreEventStream.ts`、`PycoreEventBus.ts`；`PycoreSse.ts` 只保留 transport。

## C. callback 执行

1. 单一 `PycoreEventBus`；页面禁止直接操作 transport。
2. dispatch 前复制 handler snapshot；允许执行中 unsubscribe。
3. 每 callback 单独 try/catch；async 用 `Promise.resolve(...).catch(...)`。
4. 注册返回幂等 unsubscribe，支持 `AbortSignal`。
5. 同一 entity 按 seq 串行；不同 entity 可并行。
6. 服务端 `create_task` 必须保留引用、done callback、traceback、shutdown 有界等待。
7. React 统一 `usePycoreEntity(entityId)`；页面不再各自 `setInterval + mounted ref`。

## 连接状态机

```text
idle -> connecting -> handshaking -> hydrating -> live
                     \-> degraded -> reconnecting
live -> suspended -> connecting
```

`isWsConnected()` 只代表 RPC ready；事件流 ready 与 snapshot hydrated 必须是独立状态。

## 完成标准（对照 §21.1–21.2）

- RPC 总 deadline 不因重连重置；迟到 completion 不复活已 reject 的 promise。
- UI 断线期间任务继续；重连后不依赖丢失事件即可恢复（靠 snapshot）。
- event gap 有显式 `reset_required`。
- 一个 callback 抛错不影响其它 callback / ACK / snapshot store。

## 明确不做

Laravel logs（FIX_V8）；逐页业务迁移（§18）。
