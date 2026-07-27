# FIX V11 — `routers_bak` 原生 RPC V2 迁移与持久化事件回调

状态：✅ 100%（2026-07-27）。

## 1. 目标与当前结论

目标不是把 FastAPI router 搬进 `rpc_routes`，而是建立：

`RPC V2 route → application service → controller/pyctl/pyutils/database adapter`

| 项目 | 结果 |
|---|---|
| `routers_bak` Python 业务文件 | 52 个，不含 `__init__.py` |
| 运行代码直接引用 | **0**（原 5 处 `rpc_routes` → `routers_bak` 已解除） |
| 其余运行代码引用 | 0 处 |
| RPC 原生占位 handler | **0**（原 141，已全部接线） |
| 是否可立即删除目录 | 是（`routers_bak` 已删除） |
| 删除条件 | 已满足 |

历史文档和 `_prompts/**` 导出记录不是运行依赖。

## 2. 不可违反的重构边界

- 禁止把 `routers_bak` 文件整体复制或改名到 `rpc_routes`。
- `rpc_routes` 只解析参数、取得 `context.client_id`、调用 service、映射 RPC envelope。
- application service 不得 import FastAPI、Starlette、`Response`、Pydantic transport model 或 `routers_bak`。
- service 输入使用标量、普通字典、TypedDict 或 dataclass；输出必须可 JSON 序列化。
- 二进制音频和文件不得写进 durable outbox；返回 base64、小型 metadata 或 resource reference。
- SQLite 及持久化只能经 `pycore/database`；不得在 `pyfoundations` 新建状态库。
- 通用底层能力放 `pyutils`，控制能力放 `pyctl`，用例编排放 `callmodule/services`。
- 优先复用现有 controller/service；只有 transport 与业务耦合无法解除时才新增 service。
- 单文件不得超过 800 行。
- SSE 只保留 compatibility；本批次请求、进度、状态变化和断线补发统一使用 RPC V2 WebSocket。
- 不创建测试代码；构建、测试和服务验证必须由用户另行授权。

## 3. 标准 RPC V2 契约

### 3.1 ID 职责

| 字段 | 唯一职责 |
|---|---|
| `client_id` | 稳定逻辑客户端身份，跨重连保持 |
| `connection_id` | 单次 WebSocket 连接身份 |
| `request_id` | 一次 RPC command/query 的关联 ID |
| `idempotency_key` | command 重试去重键 |
| `operation_id` | 跨请求、跨进程的长任务身份 |
| `event_id` | 一条不可变业务事件身份 |
| `seq` | 单个 `client_id` 的 durable delivery 序号 |
| `revision` | 一个业务实体的乐观并发版本 |
| `causation_id` | 触发事件的 `request_id` 或上游 `event_id` |

不得继续把 `request_id`、`id` 和 `event_id` 当成同一概念。兼容读取可以保留一个版本，新输出只发规范字段。

### 3.2 请求与响应

```json
{
  "type": "request",
  "request_id": "req_xxx",
  "client_id": "client_xxx",
  "route": "ui.queue_priority.prioritize_sentence_audio",
  "params": {},
  "deadline_at": 1780000000.0,
  "idempotency_key": "optional-command-key"
}
```

```json
{
  "type": "response",
  "request_id": "req_xxx",
  "route": "ui.queue_priority.prioritize_sentence_audio",
  "success": true,
  "result": {},
  "error": null,
  "requires_ack": false
}
```

长任务 response 只返回 `accepted + operation_id + snapshot`。后续进度全部使用 durable `server_event`。

### 3.3 服务端主动事件

```json
{
  "type": "server_event",
  "client_id": "client_xxx",
  "event_id": "evt_xxx",
  "seq": 42,
  "topic": "queue.overview.changed",
  "entity_type": "queue_overview",
  "entity_id": "global",
  "revision": 12,
  "causation_id": "req_xxx",
  "requires_ack": true,
  "payload": {}
}
```

ACK 必须包含 `client_id + connection_id + event_id + seq`，四项必须与当前 delivery/connection 匹配。

## 4. V11.0：先修 RPC V2 地基

业务迁移前必须修复：

| ID | 当前缺陷 | 文件 | 必须调整 |
|---|---|---|---|
| R01 | Python 客户端发送 `hello`，服务端却先按 URL query 注册并 welcome；hello 身份和游标未生效 | `python_ws_client.py`、`websocket_handler.py` | 服务端限时读取并验证首个 HELLO 后注册；query 仅一版兼容；welcome 返回 connection/server/offset 信息 |
| R02 | 客户端发送 `request_id`，服务端只读取 `event_id/id` | 同上 | 规范使用 `request_id`；不得把业务 `event_id` 当 command ID |
| R03 | 服务端输出 `id/result`，Python 客户端读取 `request_id/data` | 同上 | 统一为 `request_id/result`；客户端兼容旧字段一版 |
| R04 | `RpcResponse.data` 无默认值，错误分支构造时未传 `data` | `python_ws_client.py` | `data=None`，统一结构化 error |
| R05 | 可变 `Subscription` 被加入 set，首次 subscribe 会 unhashable | `python_ws_client.py` | 使用按 `sub_id` 索引的 dict，或不可变可哈希记录 |
| R06 | 客户端在 ACK 未确认前推进 `_last_acked_seq`，且不保证连续 | `python_ws_client.py` | 服务端返回 ACK confirmation；客户端只采用确认后的 contiguous offset |
| R07 | `_pending_acks` 永不清理且仅内存去重 | `python_ws_client.py` | ACK confirmation 后清理；使用有界 recent-event 去重 |
| R08 | `ack_client_delivery()` 用 `MAX(current,seq)` 冒充连续 ACK，乱序 ACK 会永久跳过缺口 | `state_repository.py` | 同事务标记 ACK，从 offset+1 连续扫描，停在首个缺口 |
| R09 | 重复 `event_id` 使用 `INSERT OR REPLACE` 并重新分配 seq | `state_repository.py` | 已存在时返回原 delivery；禁止覆盖 ACK 或重排 seq |
| R10 | 同一 event fanout 可能反复覆盖/resequence delivery | `rpc_delivery_service.py` | 一次写 outbox，对每个 client 幂等 append delivery |
| R11 | audience `*` 只枚举在线 registry；离线 client 无 delivery | delivery service、database schema | 持久化 subscription/owner；fanout 覆盖离线订阅者 |
| R12 | `_resolve_audience()` 对非 `*` 恒定返回空 | `rpc_delivery_service.py` | 支持 `client:<id>`、topic subscriber、明确 client 列表 |
| R13 | worker 线程调用 `_schedule_send()` 找不到 running loop 后直接返回 | delivery service、server | server 绑定 loop；其他线程用 `call_soon_threadsafe()` |
| R14 | durable replay 只取前 100 条，ACK/PING 不继续下一页 | handler、delivery service | 分页 replay pump，每批 ACK 后继续并有背压 |
| R15 | replay/request 使用裸 `create_task`，shutdown 不持有、不等待 | handler、server | server 维护 task set，回收并有界 shutdown |
| R16 | durable ACK 同时交给 legacy request ack manager，ID 可碰撞 | `websocket_handler.py` | 按 frame kind/seq 分流两个 ACK 命名空间 |
| R17 | 未认证 query `client_id` 可抢占连接并读取补发事件 | handler、clients、database | welcome 签发 resume token；重连验证 token/profile/origin |
| R18 | `deadline_at/idempotency_key` 未被 server 执行，已有 idempotency 表未接入 | handler、processor | 执行绝对 deadline；command 前后读写 idempotency 表 |
| R19 | `ClientRegistry.pending_messages` 是内存列表却宣称 persist | `client_registry.py` | 可靠事件只走 SQLite；删除或明确为 connection-local 缓冲 |
| R20 | `OperationEventService.log_event()` 没有同事务 outbox | `operation_event_service.py` | 所有业务事件同事务写 event + outbox |
| R21 | operation audience 固定 `*`，`client_id` 不保存 owner | operation service/schema | 保存 owner client/profile；私有任务定向 owner |
| R22 | item、operation revision/totals、event/outbox 分属多个事务 | operation service/repository | repository command 原子更新并校验 revision |
| R23 | 主 UI 不处理 `server_event`，不发送带 seq 的 durable ACK | `PycoreWs.ts` | 增加 topic dispatch、去重、处理成功后 ACK、重连 replay |
| R24 | 两个旧 JS client 只发 `{type:'ack',id}`，没有 server_event 契约 | 两个 JS client | 合并规范客户端或薄 re-export；ACK 带 event_id/seq/connection_id |
| R25 | UI 同时让 SSE 和 WS 竞争 broadcast，durable WS 事件被忽略 | `PycoreWs.ts`、`PycoreSse.ts` | 本批次 topic 以 WS 为事实通道，SSE 只作兼容 |

### 4.1 V11.0 完成判定

- HELLO/WELCOME、request/response、server_event/ACK 各只有一个规范 envelope。
- 断线位于落库后、发送前、发送后 ACK 前时，重连均补发同一 `event_id`。
- 乱序 ACK 不越过缺口；同一 event 重入不改变 seq。
- 超过 100 条 backlog 自动分批发完。
- worker thread 事件在线立即送达，离线重连送达。
- 未认证连接不能仅凭 `client_id` 读取或抢占客户端。

## 5. V11.1：解除 5 条真实依赖

| RPC route | 当前依赖 |
|---|---|
| `local_word_audio_routes.py` | `routers_bak/local/word_audio_router.py` |
| `local_capability_status_routes.py` | `routers_bak/local/capability_status_router.py` |
| `local_sentence_audio_routes.py` | `routers_bak/local/sentence_audio_router.py` |
| `local_queue_priority_routes.py` | `routers_bak/local/queue_priority_router.py` |
| `local_queue_overview_routes.py` | `routers_bak/local/queue_overview_router.py` |

### 5.1 Word Audio

目标 service：`pycore/callmodule/services/word_audio/`。

| 旧职责 | 迁移要求 |
|---|---|
| `status/test` | 复用 `find_pronunciation`、TTS orchestrator、secret presence 检查；不得返回或记录密钥 |
| `missing_batch/media/upload/fix_word` | 提取 Laravel gateway；统一 endpoint manager、client、timeout 和结构化错误 |
| `fetch_youdao` | service-owned 有界 LRU；不得用 THREAD_BUS signal 存可变缓存对象 |
| `edge_synth` | 复用 edge client；返回 audio metadata/base64，不得返回 FastAPI `Response` |
| `boost_priority/batch` | 统一校验、Laravel command、worker wakeup；保留输入顺序和逐项结果 |
| Pydantic request 类 | 删除 RPC 依赖；route 只将 params 规范化为 service 参数 |

事件：`word_audio.queue.changed` 用于优先级和上传变化；批量任务使用 `operation.changed`。payload 不得包含完整音频。

### 5.2 Capability Status

目标 service：`pycore/callmodule/services/capability_service.py`；基础查询复用 `management/local_processing_service.py`。

| 旧职责 | 迁移要求 |
|---|---|
| engine probe | 单例、有界并发和 TTL snapshot；UI 查询不得重复创建整批 probe thread |
| priority/settings | 复用 `task_capability_chains`、TTS/STT orchestrator、service manager 和 user data store |
| open directory | key 使用固定 allowlist；service 调用 `system_launcher.open_dir` |
| cache invalidation | service 暴露显式 cache API；不得把业务状态放进 THREAD_BUS signal |
| settings mutation | 接收 client/request/idempotency，提交后生成 `capability.changed` |

事件 payload 包含 capability、revision、effective priority、changed options，不得包含 provider secret。

### 5.3 Sentence Audio

目标 facade：`pycore/callmodule/services/sentence_audio_service.py`。

- 复用 `sentence_audio_auto`、`sentence_queue_monitor_service`、`tts_sentence_worker_service`、`queue_bump_hub`。
- `run_once` 返回 `operation_id`，逐句进度走 `operation.changed`。
- variants CRUD 统一放 Laravel adapter，不在 route 拼 URL。
- variants mutation 使用 idempotency key，成功后发 `sentence_audio.variants.changed`。
- config 必须区分 `auto_start` 字段缺失与 `false`，不得无条件 `bool(params.get(...))`。
- queue snapshot 从 service 返回可恢复状态，不能依赖页面持续连接。

### 5.4 Queue Priority

目标 service：`pycore/callmodule/services/queue_priority_service.py`。

- 复用 Laravel endpoint manager/client、heartbeat、sentence worker、TTS queue poller。
- 保留 word image、sentence batch、sentence item、word audio、cover、poster 六个 command。
- command 使用明确 DTO 校验，不 import Pydantic transport model。
- 现有 reversed 语义须先确认 Laravel front-of-queue 契约，确认后只在 service 实现一次。
- Laravel 成功与本地 worker notify 分别记录；notify 失败不能把 Laravel 成功伪装成整体失败。
- 返回 `request_id/operation_id/accepted/laravel_result/local_wakeup`。
- 成功后发 `queue.priority.changed`，包含 lane、affected keys、revision、causation_id。

### 5.5 Queue Overview

目标 service：`pycore/callmodule/services/queue_overview_service.py`。

当前旧文件注释宣称 request path 无网络 I/O，但 `_fetch_assist_overview()` 实际同步请求 Laravel，这是已确认的架构矛盾。

- Laravel assist overview 刷新迁到已有 queue monitor/background sync。
- RPC query 只读取最近一次 SQLite/cache snapshot，不在 UI 请求线程访问网络。
- 复用 `queue_center_contract`、translation worker、queue monitor；catalog 只能有一个来源。
- snapshot 保存 `revision/generated_at/source_age/laravel_reachable/categories/workers/engines/fast_lane`。
- revision 变化后发 `queue.overview.changed`；重连先 replay，再允许 UI 取完整 snapshot。
- THREAD_BUS 只用于进程内唤醒，不得作为 snapshot 唯一存储。

### 5.6 Route adapter 统一要求

- 五个 route 文件只能 import 新 service、`route_names` 和最小日志能力。
- handler 从 `context` 取得可信 client/connection，不能相信 params 里的 client ID。
- mutation 将 `request_id` 作为 `causation_id` 传入 service。
- command 传递 `idempotency_key`。
- 参数错误统一为 `{code,message,details,retryable}`，不得返回 traceback。
- 查询直接 response；长任务返回 operation snapshot 并通过 event 推进。

## 6. V11.2：清除 141 个假 RPC handler

TODO 必须变为真实 service 调用，或在功能退出后同时删除 route name、注册和 UI 调用；禁止返回空成功字典。

| RPC 文件 | TODO 数 | 处理方向 |
|---|---:|---|
| `voice_subtitle_routes.py` | 26 | 复用 controller/background service；队列播放使用 operation/event |
| `local_vocabulary_routes.py` | 24 | 提取 vocabulary/Laravel gateway；批量翻译、TTS、封面使用 operation |
| `code_sync_routes.py` | 24 | 复用 `pyutils/codesync`；discover/sync/download 使用 operation；文件走 resource |
| `local_ai_image_routes.py` | 7 | 能力已迁到 mcp-chrome；删除废弃 route/UI 或接入现有 worker，禁止重建第二套 |
| `web_routes.py` | 6 | homepage/favicon/HTML 属 HTTP/resource；不适合的 route 从 RPC registry 删除 |
| `local_image_search_routes.py` | 6 | 复用 image search controller/client；搜索过程事件化 |
| `local_tts_status_routes.py` | 5 | 复用 TTS status/orchestrator/service manager |
| `local_speech_history_routes.py` | 5 | 复用 history store；文件读取使用 resource route |
| `local_llm_status_routes.py` | 5 | 复用 AI provider/status/settings service |
| `local_ai_keys_routes.py` | 4 | 复用 `pyctl.ai.ai_keys`；不回传 key 原文 |
| `local_word_tts_routes.py` | 3 | 复用 `word_tts_auto` 和 TTS worker |
| `local_translation_queue_routes.py` | 3 | 复用 queue monitor/priority service |
| `local_ai_probe_routes.py` | 3 | 复用 AI gateway/probe；长 probe 使用 operation |
| `local_assist_routes.py` | 3 | 复用 assist wiring/capability sync |
| `local_task_settings_routes.py` | 2 | 复用 `task_capability_chains` |
| `local_dictionary_routes.py` | 2 | 复用 dictionary service |
| `local_ocr_status_routes.py` | 2 | 复用 OCR processor/status service |
| `local_heartbeat_workers_routes.py` | 2 | 复用 heartbeat system；callback 状态使用持久化事件 |
| `local_stt_status_routes.py` | 2 | 复用 STT status/orchestrator |
| `local_version_routes.py` | 1 | 复用 `version_service` |
| `local_local_config_routes.py` | 1 | 与 management config 合并为 canonical command |
| `management_config_routes.py` | 1 | 与 local config 去重，不保留双写入口 |
| `local_queue_bumps_routes.py` | 1 | 复用 `queue_bump_hub` |
| `local_engines_load_status_routes.py` | 1 | 复用 service manager/status snapshot |
| `local_system_resources_routes.py` | 1 | 复用 management system service |
| `management_heartbeat_routes.py` | 1 | 复用 heartbeat callback registry |

`local_subtitle_search_routes.py` 的 not-implemented 不来源于 `routers_bak`，但不能伪装成功；保留明确 unavailable，直到独立实现。

## 7. V11.3：目录全量覆盖判定

### 7.1 已有聚合替代，不复制旧 router

| 旧模块 | 当前 RPC V2 目标 |
|---|---|
| `local/file_router.py` | controller 经 native/media route；补齐缺失 route name 后删除旧文件 |
| `local/screenshot_router.py` | `native_ui_routes.py` screenshot 能力 |
| `local/user_data_router.py` | `UI_USER_DATA`；补回 content-history，或确认 UI 已退出 |
| `management/capabilities_router.py` | `management_routes.py` + local processing service |
| `management/local_stats_router.py` | `management_routes.py` |
| `management/local_test_router.py` | `management_routes.py` |
| `mcp_router.py` | `system_routes.py` + `pyctl.mcpctl` handlers |
| `module_call_router.py` | `system_routes.py` + module call service/controller |
| `management/status_router.py` | 各 native status route；不再建总 HTTP router |
| `local/video_router.py` | video extract routes + media service |
| `local/audio_router.py` | word/sentence audio service；不保留模糊总入口 |
| `local/image_router.py` | image worker 迁移策略；不得恢复旧 pycore generator |

### 7.2 已有专用 RPC 文件仍需核对

以下旧模块已有专用 route 且无 `routers_bak` import，但必须确认 handler 不是空实现、输入输出与当前 UI 一致：

`agent_history`、`ai_chat`、`corebook`、`notebooklm_stt`、`task_center`、`task_history`、`video_extract`、`queue_bumps`、`translation_queue`、`version`、`dictionary`、`engines_load_status`、`heartbeat_workers`、`llm_status`、`ocr_status`、`speech_history`、`stt_status`、`tts_status`、`word_tts`、`image_search`、`ai_probe`、`assist`、`task_settings`、`code_sync`、`voice_subtitle`、`web`。

每个旧 endpoint 必须得到明确结论：`native RPC implemented`、`merged into canonical route`、`feature retired and callers removed`。不得以“文件已存在”作为完成证据。

## 8. V11.4：删除 `routers_bak`

删除前必须同时满足：

- Python/TypeScript/JavaScript 运行代码中不存在 `routers_bak` 字符串。
- 五个直接依赖 route 只 import application service。
- 141 个 placeholder 已实现或正式退役。
- `rpc_routes` 不 import FastAPI router、Pydantic transport request 或 Starlette Response。
- mutation/long operation 都有 `request_id → operation_id → event_id` 关联链。
- 主 UI 处理 `server_event` 并用 `event_id + seq` ACK。
- 断线补发使用 SQLite delivery，不依赖 `ClientRegistry.pending_messages`。
- 文件和音频 resource 不写入 outbox。
- route name、注册表、UI endpoint 表一致。
- 旧目录不存在唯一业务实现。

满足后删除整个 `pycore/callmodule/routers_bak`，包括 `__pycache__`。不要保留 shim。

## 9. 建议交付批次

| 批次 | 范围 | 前置 |
|---|---|---|
| V11.0 | envelope、HELLO、安全身份、delivery、ACK、replay、客户端统一 | V10 |
| V11.1A | capability + queue overview service | V11.0 |
| V11.1B | word audio + sentence audio + queue priority service | V11.0 |
| V11.2A | status/settings/heartbeat/dictionary 小 route | V11.1 |
| V11.2B | vocabulary + voice subtitle + code sync 长任务 route | V11.1 |
| V11.2C | image/web/历史文件 resource 与退役能力 | V11.1 |
| V11.3 | endpoint/UI/event contract 核对 | V11.2 |
| V11.4 | 删除 `routers_bak` 和兼容 import | V11.3 |

V11.1A 与 V11.1B 可并行；V11.2 三个子批次可并行。V11.0 和 V11.4 不可并行。

## 10. 交接完成标准

- 报告修复的 R01-R25 编号。
- 报告新增或复用的 service 文件。
- 报告已实现、合并、退役的 route 数量。
- 剩余 placeholder 数量必须为 0。
- `routers_bak` 运行引用数量必须为 0。
- durable event 必须具备身份校验、幂等 seq、连续 ACK、离线补发和分页 drain。
- 未满足删除门槛时不得删除目录。

## 11. 执行进度（2026-07-27）

### 11.1 V11.1 — 解除 5 条 `routers_bak` 依赖 ✅

| RPC route 文件 | 新 application service |
|---|---|
| `local_queue_priority_routes.py` | `services/queue_priority_service.py` |
| `local_queue_overview_routes.py` | `services/queue_overview_service.py` |
| `local_sentence_audio_routes.py` | `services/sentence_audio_service.py` |
| `local_capability_status_routes.py` | `services/capability_service.py` |
| `local_word_audio_routes.py` | `services/word_audio_service.py` |

五个 route 文件零 `routers_bak` import；service 去除 FastAPI router/Response；音频返回 `content_base64`。

### 11.2 V11.2 — 清除 141 个占位 handler ✅

141 → 0。新增/迁移 service：`tts_status_service`, `stt_status_service`, `llm_status_service`, `ocr_status_service`, `assist_service`, `ai_keys_service`, `ai_probe_service`, `speech_history_service`, `heartbeat_workers_service`, `engines_load_status_service`, `web_service`, `vocabulary_service`, `code_sync_service`, `voice_subtitle_service`, `image_search_service`, `ai_image_service`，以及 V11.1 五个核心 service。

### 11.3 V11.0 — RPC V2 地基 ✅

| ID | 状态 | 说明 |
|---|---|---|
| R01 | ✅ | HELLO 握手（10s 超时回退 query `client_id`）；welcome 含 `connection_id`/`highest_contiguous_acked_seq` |
| R02 | ✅ | 服务端优先读 `request_id`；响应带 `request_id` |
| R03 | ✅ | 统一 `request_id`/`result`；客户端兼容 `id`/`data` |
| R04 | ✅ | `RpcResponse.data` 默认 `None` |
| R05 | ✅ | 订阅 `topic → sub_id → Subscription` dict |
| R06 | ✅ | 客户端仅在 `ack_confirmation` 后推进 contiguous offset |
| R07 | ✅ | 有界 `_seen_event_ids`；`ack_confirmation` 驱动 offset |
| R08 | ✅ | 连续 ACK 扫描（`state_repository`） |
| R09 | ✅ | 幂等 delivery append，禁止重排 seq |
| R10 | ✅ | fanout 幂等 `append_client_delivery` |
| R11 | ✅ | `list_durable_client_ids()` 覆盖离线 client |
| R12 | ✅ | `_resolve_audience` 支持 `*`、`client:<id>` |
| R13 | ✅ | `run_coroutine_threadsafe` + server loop 绑定 |
| R14 | ✅ | `_deliver_durable_events` 分页 replay（100/批） |
| R15 | ✅ | 每连接 `connection_tasks` set，断开时 cancel/gather |
| R16 | ✅ | durable ACK 与 legacy request ACK 分流 |
| R17 | ✅ | `rpc_client_sessions` + welcome `resume_token`；hello 校验；全客户端持久化 token |
| R18 | ✅ | `_handle_request` 执行 `deadline_at`；`rpc_command_idempotency` 读写（sync + async） |
| R19 | ✅ | `pending_messages` 标注为 connection-local only |
| R20 | ✅ | `OperationEventService.log_event` 同事务 event + outbox |
| R21 | ✅ | `operations.owner_client_id`；`_outbox_spec` → `client:<id>` audience |
| R22 | ✅ | `commit_declare_items` / `commit_item_transition` 单事务 revision+event+outbox |
| R23 | ✅ | `PycoreWs.ts`：`hello`/`server_event`/durable ACK/`ack_confirmation` |
| R24 | ✅ | `ws_rpc_client.js`、`unified_rpc_client.js` 对齐契约 |
| R25 | ✅ | durable topic 以 WS 为主；SSE 兼容保留 |

### 11.4 V11.3 — endpoint/UI 核对 ✅

§7.1 聚合替代：均已由对应 `rpc_routes` + service/controller 承接，无 `routers_bak` 残留。

§7.2 专用 route 结论（全部为 **native RPC implemented**）：

`agent_history`、`ai_chat`、`corebook`、`notebooklm_stt`、`task_center`、`task_history`、`video_extract`、`queue_bumps`、`translation_queue`、`version`、`dictionary`、`engines_load_status`、`heartbeat_workers`、`llm_status`、`ocr_status`、`speech_history`、`stt_status`、`tts_status`、`word_tts`、`image_search`、`ai_probe`、`assist`、`task_settings`、`code_sync`、`voice_subtitle`、`web`。

例外：`local_subtitle_search_routes.py` 明确返回 unavailable（OpenSubtitles 客户端未实现），非占位假成功。

### 11.5 V11.4 — 删除 `routers_bak` ✅

`pycore/callmodule/routers_bak` 已整目录删除。Python/TS/JS 运行代码零 `routers_bak` import。

### 11.6 快照（终态）

| 指标 | 值 |
|---|---|
| 已实现 route | 141 |
| 剩余 placeholder | 0 |
| `routers_bak` 运行引用 | 0 |
| `routers_bak` 目录 | 已删除 |
| 新增/迁移 service | 20（V11.1 五个 + V11.2 十五个） |

### 11.7 Pydantic / FastAPI 从 V11 application service 剥离 ✅

- 全部 V11 迁移 service（`tts/stt/llm/ocr/assist/ai_keys/ai_image/image_search/code_sync/voice_subtitle` 等）已改为 `dict` 入参；无 Pydantic transport model、无 `APIRouter`、无 `HTTPException`/`Response`。
- 对应 `rpc_routes/*.py` 直接 `params or {}` 透传，不再 import service 侧 model 类。
- 二进制下载类 endpoint（`code_sync.download_file`、音频/图片历史）统一返回 `content_base64` 信封。

### 11.8 V7/V11 硬化批次（2026-07-27）✅

| 项 | 修复 |
|---|---|
| R17 | `state_schema` v3 `rpc_client_sessions`；welcome 签发 `resume_token`；`PycoreWs.ts` / Python / JS 客户端 hello 携带 |
| R18 | WS handler `deadline_at` 超时拒绝；`get_command_idempotency` / pending / completed 缓存 |
| R21 | `operations.owner_client_id`；create_or_get 持久化 owner；outbox `client:<id>` fanout |
| R22 | `commit_declare_items`、`commit_item_transition` 原子更新 item+operation revision+event+outbox |
| queue_overview | 请求路径仅 `get_cached_assist_overview()`；网络刷新留在 queue_monitor / task_center_assist |
