# FIX V7 — 持久化状态、operation 事件与 durable delivery

状态：✅ 100%（2026-07-27）。V11 审计发现的协议与持久化回调缺口已在 V11.0 闭环。

## 1. 目标

建立 `pycore/database` 为唯一持久化层，支撑：

- operation / item / event 状态机
- durable outbox + per-client delivery + contiguous ACK
- RPC V2 `server_event` fanout 与断线补发

## 2. 地基（V4–V6 交付）

| 组件 | 路径 | 职责 |
|---|---|---|
| Schema | `database/schema/state_schema.py` | operations、items、events、outbox、deliveries、idempotency |
| Repository | `database/repositories/state_repository.py` | CRUD、事务、delivery append/ACK |
| Models | `database/models/state_models.py` | 持久化类型 |
| Operation service | `callmodule/services/operation_service.py` | 用例编排、event + outbox 同事务 |
| Delivery | `pyutils/rpc_v2/server/rpc_delivery_service.py` | fanout、replay、ACK 确认 |

## 3. V11 审计缺口 → 已修复

| 缺口 | 修复 |
|---|---|
| 乱序 ACK 用 `MAX(seq)` 冒充连续 | `_advance_contiguous_offset` 从 offset+1 扫描至首个缺口 |
| 重复 `event_id` 重排 seq | `_get_existing_delivery` 幂等返回原 delivery |
| fanout 覆盖/resequence | `append_client_delivery` 幂等；`list_durable_client_ids` 含离线 client |
| worker 线程无法 schedule send | `run_coroutine_threadsafe` + `fastapi_server.set_event_loop` |
| replay 仅 100 条 | `_deliver_durable_events` 分页 pump |
| durable ACK 与 request ACK 碰撞 | `websocket_handler` 按 `event_id+seq` 分流 |
| `OperationEventService` 无同事务 outbox | `log_event` 使用 `_outbox_spec` + `_insert_event` 单事务 |
| R17 resume token | `rpc_client_sessions` + welcome/hello `resume_token` |
| R18 deadline/idempotency | WS handler + `rpc_command_idempotency` |
| R21 owner fanout | `operations.owner_client_id` + `client:<id>` audience |
| R22 原子 revision | `commit_declare_items` / `commit_item_transition` |
| UI/JS 不处理 `server_event` | `PycoreWs.ts`、`ws_rpc_client.js`、`unified_rpc_client.js` |
| `pending_messages` 误导为持久化 | 标注 connection-local only |

## 4. 完成判定

- [x] SQLite 状态库经 `pycore/database` 单一入口
- [x] event 写入与 outbox fanout 同事务（operation service + operation_event_service）
- [x] per-client delivery seq 单调、ACK 连续、幂等 append
- [x] 离线 client 可补发；在线 worker 线程可投递
- [x] 主 UI 与 JS 客户端 durable ACK 契约对齐

## 5. 可选后续（不阻塞 V7/V11 关闭）

（无 — R17–R22 已于 2026-07-27 全面修复，见 FIX_V11 §11.8）
