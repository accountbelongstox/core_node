# FIX V7：RPC v2 WebSocket、事件流与 callback 重构

## 1. 目标

统一 RPC v2 为请求、响应和服务端主动事件共用的全双工 WebSocket。事件按 client_id + event_id 定址，seq 排序，ACK 后推进，重连重放；callback 支持多订阅并隔离异常。这是底层重构，不是延长 timeout。

## 2. 已知客户端 BUG

- ws_rpc_client.js 在 onopen 就标 connected，早于 welcome。
- ACK 只有 type/id，缺 client/connection/event/seq。
- 单 event 只能一个 handler，异常和 rejected promise 未隔离。
- unified_rpc_client.js 无绝对 deadline，promise 可永久 pending。
- ws_rpc_client.js、unified_rpc_client.js、PycoreWs.ts 的 ID/reconnect/ACK/ready 不同。
- PycoreWs.ts 重连时重置 timer，实际延长 deadline。
- 无可复用 Python WS client 供 Qwen。

## 3. 已知服务端 BUG

- ClientRegistry.pending_messages 只是内存 list，重启即丢。
- send_pending_messages 先 clear 再确认发送，失败消息丢失。
- safe_send 与 disconnect/socket replacement 竞态。
- broadcast_event 同时走 WS/SSE，无 per-client durable ownership，可能重复乱序。
- broadcast loop 绑定首个 WS/SSE lifecycle，早期/跨 loop 事件可能丢。
- SSE seq/ring/cursor 都在内存。
- RequestEventTable/callback lifecycle 在内存。
- 无公共 notify_client(client_id, event_id, ...)。
- async callback task 未统一持有、观察、隔离。

## 4. 传输决策

WS 是所有新增 call/event 的 canonical transport。SSE 只兼容：不加新功能，不生成独立 seq/source，暂时适配同一 durable stream，V9 后删除。HTTP 只可保留明确的静态 bootstrap/health，不能用于 Qwen synthesis 或 durable progress。

## 5. 身份

- client_id：跨连接稳定逻辑客户端。
- connection_id：服务端接受的一次 WS。
- request_id：request/response 关联。
- event_id：不可变服务端事件。
- seq：单 client 投递顺序。
- causation_id：原因请求/事件。
- idempotency_key：命令去重。
- server_instance_id：进程 epoch 诊断。

socket address/fd/session 不是 client identity。

## 6. 握手

client hello：type、protocol_version=2、client_id、last_acked_seq、capabilities。

server welcome：type、version、client_id、connection_id、server_instance_id、current_seq、replay_from。

校验 welcome 后才 ready。版本、认证、client 冲突用稳定 close/error code。

## 7. 请求语义

request 含 request_id、client_id、route、params、idempotency_key（写操作）、绝对 deadline_at。重连不得重置 deadline。服务端执行前拒绝 expired。

客户端每 request_id 只有一个 pending，硬绝对 timer；终止断线 reject 不可 replay 的请求；只重试声明为 idempotent/replayable 的 route；重复 terminal response 只 settle 一次。timeout 是 unknown outcome，写命令重试前查 idempotency/status。

## 8. 主动事件与 ACK

server_event 字段：

~~~text
type, client_id, event_id, seq, topic, entity_id,
revision, causation_id, requires_ack, payload
~~~

ACK 字段：

~~~text
type, client_id, connection_id, event_id, seq
~~~

ACK 只接受当前 client/connection 的已知 delivery；重复 ACK 幂等；offset 只跨连续已 ACK prefix 前进，有 gap 继续可 replay。

## 9. durable delivery

1. 业务事务同时写 state、domain event、outbox、audience。
2. dispatcher claim committed outbox。
3. per-client delivery 分配稳定 seq。
4. 在线则 notify_client 当前 connection。
5. 离线/发送失败保持 pending。
6. client 按 event_id dedup/apply 后 ACK。
7. repository 标 ACK 并推进 contiguous offset。
8. reconnect 重放 last ACK 之后未确认、未过期 delivery。

语义是 at-least-once，不宣称 exactly-once。

V4 database 是真相源。ClientRegistry 只管 live connection、subscription、per-connection send lock，不管 durable pending。

## 10. 服务端 API

提供等价接口：

- notify_client(client_id, topic, payload, event_id, causation_id, entity_id, revision)
- notify_clients(client_ids, ...)
- publish_topic(topic, audience, ...)
- ack_event(client_id, connection_id, event_id, seq)
- replay_unacked(client_id, after_seq, limit)
- get_client_offset(client_id)

socket replacement 原子注册新 connection，旧 session 标 superseded；写入按 connection 串行；发送前复核 ownership；close/send error 只标 undelivered，不先删除。

## 11. callback 架构

浏览器/Python 均使用 topic → Set(subscription)。subscription 含 callback、可选 filter、AbortSignal。

- 迭代前 snapshot；
- 每个同步异常单独捕获；
- 每个 promise/task 都观察；
- 一个失败只进 error hook，不阻止其他 handler；
- unsubscribe 幂等；
- reconnect 恢复订阅但不倍增；
- wildcard/prefix 优先级明确；
- 事件被接纳/dedup 后 ACK，不是收到 bytes 就 ACK；
- server task 持有到完成，done callback 消费异常。

## 12. 客户端合并

提取唯一 codec/state machine：

- 新增 pycore/pyutils/rpc_v2/client/python_ws_client.py；
- browser core 统一 ws_rpc_client、unified_rpc_client、PycoreWs，或让后者只做薄 wrapper；
- 唯一 ID、handshake、deadline、backoff、ACK queue、callback registry；
- wrapper 不得自建 cursor。

## 13. 顺序、背压、保留

seq 只保证单 client 顺序；entity revision 防 stale snapshot。replay batch/live queue 有界；慢 client 留 durable pending，不阻塞 dispatcher。定义 retry/backoff/dead-letter/expiry。retention 不删未过期 offset 需要的事件。payload 有上限，binary 用 artifact。指标含 outbox lag、pending/failure、reconnect、replay、callback error、ACK latency。

## 14. 实施顺序

1. V4 delivery 表/仓储。
2. codec/validation/identity/state machine。
3. notify/ACK/replay。
4. ClientRegistry 只保留 live ownership。
5. Python WS client。
6. browser client 合并。
7. FastAPIRPCServer 事件切 durable outbox。
8. SSE 暂适配同一 stream。
9. 迁移 Qwen、Agent History、Laravel。
10. 删除 memory pending/ring/重复 seq/fire-and-forget callback。

## 15. 验收

- 无 matching request 时服务端可用 client_id + event_id 主动通知。
- commit 后 send 前重启仍可 replay。
- send 后 ACK 前断线，重放同 event_id，逻辑只应用一次。
- socket replacement 失败不丢 delivery。
- 两 callback 都运行，一个 throw/reject 不影响另一个。
- 重连中 request 仍按原 deadline 只 reject 一次。
- welcome 前不 ready。
- Qwen Python client 使用相同 handshake/ACK/replay/deadline。
- 活动功能不依赖内存 pending 或 SSE cursor。