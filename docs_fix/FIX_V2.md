# pycore-manager 深层重构修复清单

日期：2026-07-27。本文是独立执行文档，不追加或覆盖历史问题文档。结论来自当前工作区源码静态审计和用户提供的运行日志；未运行测试、构建、服务或验证命令。

> 核心结论：当前故障不是若干孤立小 bug，而是 package import、GUI 生命周期、长任务 RPC、事件恢复、任务持久化和 TTS capability 契约同时失去边界。修复必须先恢复最小可启动内核，再按 operation/snapshot/event 架构迁移，禁止继续用 timeout、轮询和内存 deque 掩盖问题。

---
## 0. 新增 P0：pycore 入口无法导入，Qt 图形服务未正常销毁

### 0.1 运行日志

```text
QDxgiVSyncService not destroyed in time
Traceback (most recent call last):
  File "D:\programing\core_node\pycore\pycore_module_caller.py", line 59, in <module>
    from pycore.callmodule.platform.startup_manager import refresh_startup_launcher
  File "D:\programing\core_node\pycore\__init__.py", line 75
    except ImportError:
    ^^^^^^
IndentationError: expected an indented block after 'try' statement on line 74
```

必须区分主故障和次生故障：

| 级别 | 现象 | 判断 |
|---|---|---|
| 主故障 | `pycore/__init__.py` 两个空 `try:` 后直接 `except ImportError` | 确定的 Python 语法错误，任何 `pycore.*` import 都可能失败 |
| 次生故障 | `QDxgiVSyncService not destroyed in time` | Qt/Windows 图形栈退出警告；仓库无该类实现，不能按普通 Python service 搜索并“补 destroy” |
| 架构根因 | `pycore/__init__.py` eager import 大量 `pyutils/device/video` 模块 | 导入一个 platform helper 也会加载无关多媒体/GUI 依赖，早期失败时形成半初始化资源 |

### 0.2 为什么 traceback 指向 `refresh_startup_launcher`，但它不是根因

`pycore_module_caller.py:59` 执行：

```python
from pycore.callmodule.platform.startup_manager import refresh_startup_launcher
```

Python 导入子模块前必须先执行 package 的 `pycore/__init__.py`。因此实际顺序是：

```text
pycore_module_caller import
  -> execute pycore/__init__.py
  -> parse empty try block
  -> IndentationError
  -> startup_manager body never completes import
  -> refresh_startup_launcher never executes
```

不能修改 `refresh_startup_launcher()` 的 try/except 来解决此问题；异常发生在该函数存在之前。

### 0.3 `pycore/__init__.py` 的确定问题

当前文件包含：

```python
# Optional imports
try:
except ImportError:
    pass

try:
except ImportError:
    pass
```

这是不可解析语法。除此之外还有结构问题：

1. package docstring 位于 imports 之后，已经失去模块 docstring 语义。
2. 文件顶部立即从 `pycore.pyutils` 导入编码器、frame 和 WebSocket manager。
3. 随后又 eager import device、ADB、video decoder/encoder、stream handler 等大批高层模块。
4. `startup_manager` 只需要 platform/startup 能力，却被迫承受完整多媒体依赖树。
5. 所谓 optional imports 已被删空但保留 try/except 骨架，说明近期删除/合并没有保持语法原子性。
6. `__all__` 与 eager imports 绑定，使 package facade 继续扩大 import-time blast radius。

### 0.4 立即恢复可启动基线

此阶段只恢复 import，不顺手加载或初始化任何服务：

1. 删除两个空 try/except；如果原 optional symbol 仍需要，恢复明确 import target，否则整段删除。
2. 把 module docstring 移到编码声明之后、所有 imports 之前。
3. `pycore/__init__.py` 只导出 `pyfoundations` 中无副作用的稳定 primitive，例如 `ColorPrint, THREAD_BUS, get_user_data_store`。
4. `pyutils/device/video/GUI` symbol 由调用方从所属模块显式导入，不再从顶层 package re-export。
5. 顶层 package import 禁止创建线程、Qt object、socket、GPU context、encoder、timer 或 subprocess。
6. optional dependency 只能在真正使用 feature 时延迟解析，并返回 feature-unavailable 结果；禁止 package import 时吞掉 ImportError。
7. `pycore_module_caller.py` 的环境路径准备保持在任何 pycore import 之前，但后续 imports 应按 `foundations -> launcher -> callmodule feature` 分层。
8. 单个高层 feature import 失败时，最小 health/diagnostic 入口仍应可启动并报告失败模块。

### 0.5 `QDxgiVSyncService` 的正确分析方向

静态搜索没有在仓库中找到 `QDxgiVSyncService`。它通常来自 Qt 在 Windows 上使用的内部 DXGI/vsync 基础设施，因此不要创建同名 Python class，也不要尝试直接调用一个不存在的 `destroy()`。

应先证明是哪条 eager import 链加载 Qt/PySide/webview：

1. 从 `pycore/__init__.py` 的 `pyutils`, device, video 和 WebSocket imports 开始建立 import graph。
2. 标出首次导入 PySide/QtWebEngine/Qt GUI 的模块。
3. 将这些 imports 移到 GUI owner 启动路径，而不是 package import 路径。
4. 在入口解析失败、配置失败、singleton 拒绝启动等 early-exit 路径中，Qt 应完全未被加载；这样不会产生 QDxgi teardown 警告。
5. 如果正常 GUI 关闭仍出现警告，再审计显式 shutdown 顺序，而不是先增加 sleep。

### 0.6 GUI 正常 shutdown 顺序

Qt/DXGI 资源必须由创建它们的 GUI thread 管理。目标顺序：

```text
stop new UI/render work
  -> stop timers, frame producers and callbacks
  -> close webviews/windows
  -> release media/graphics consumers
  -> process queued deleteLater callbacks while Qt loop is alive
  -> request QApplication quit
  -> join GUI thread with bounded deadline
  -> stop remaining pycore workers and THREAD_BUS
```

要求：

1. QApplication、window、webview 和 render timers 有明确 owner，不依赖解释器 GC。
2. 关闭必须幂等；正常退出、异常启动退出、singleton supersede 使用同一 coordinator。
3. 不在非 GUI thread 直接销毁 Qt object。
4. 不用固定 `sleep` 伪装资源已释放；等待条件应是 owner 状态或线程完成信号。
5. timeout 日志要列出仍存活的 GUI thread/window/timer，而不只打印 `not destroyed in time`。
6. import-time 语法错误不能进入 GUI shutdown，因为正确架构下那时 GUI 尚未创建。

### 0.7 此 P0 与 UI 长时间不加载的关系

这是比 RPC timeout 更早的阻断：pycore package 无法 import，RPC server、route registration、SSE、operation worker 都不会启动。浏览器只会看到连接失败、health probing、loading 或重连。修复顺序必须是：

1. 恢复 `pycore/__init__.py` 可解析。
2. 移除顶层 eager GUI/multimedia imports。
3. 确认最小 health/RPC bootstrap 不依赖 optional feature。
4. 再处理 Agent History 破损 import 和 inline long RPC。
5. 最后处理正常 shutdown 中仍存在的 QDxgi warning。

### 0.8 涉及文件

| 文件 | 修复职责 |
|---|---|
| `pycore/__init__.py` | 恢复语法，缩小顶层 facade，删除 import-time 高层依赖 |
| `pycore/pycore_module_caller.py` | 明确 bootstrap 层次和 early-exit coordinator |
| `pycore/callmodule/platform/startup_manager.py` | 保持纯 platform factory，不承担 package import 失败兜底 |
| Qt/native UI owner 模块 | 建立正常/异常/被 supersede 的统一 shutdown 顺序 |
| 首个引入 PySide/Qt 的 pyutils 模块 | 从 package import 路径迁到显式 GUI start 路径 |

### 0.9 完成标准

1. 导入 `pycore.callmodule.platform.startup_manager` 不触发 device/video/Qt 初始化。
2. package import 阶段没有 thread、window、DXGI、socket 或 model side effect。
3. 入口语法/配置错误时不会出现 QDxgi teardown warning。
4. 正常关闭时 GUI owner 在 event loop 停止前释放 window/webview/timer。
5. `refresh_startup_launcher` 的失败仍保持 best-effort，但不会掩盖 package/bootstrap 错误。

---
## 第二轮底层重构清单（2026-07-27）

### 12. 总结：禁止继续小修补

本轮四个症状属于同一个架构问题：长任务、任务状态、事件通知和 UI 生命周期混在一起。只替换 `Emma`、增加一次轮询、延长 RPC timeout 或把 `_events` 写进另一个 JSON，都不能解决断线、重启、重复执行和状态恢复。

目标边界必须固定为：

1. Laravel 是业务数据与 Laravel 自身日志的事实源。
2. pycore 是本地任务执行、任务进度、运行事件和 UI 工作状态的事实源。
3. RPC 只负责短请求、命令受理和快照查询，不同步执行 AI、TTS、全盘扫描或远端上传。
4. 事件只表达“实体的某个 revision 已变化”，不能充当事实源。
5. UI 每次启动先取 pycore 快照，再接收增量事件；断线后重新取快照即可恢复。
6. `localStorage` 只能保存无业务影响的显示偏好，不能保存任务、进度、结果、重试状态或控制面真值。

本轮已确认的 P0：

| 问题 | 当前证据 | 直接影响 |
|---|---|---|
| Agent History 服务文件已破损 | `agent_history_article_service.py:2` 是未完成的 `from ... import (`；`:5` 才出现 `from __future__`；`:237-238` 又有游离 import 片段 | 模块无法可靠导入，相关 RPC 路由可能根本未注册 |
| 开关和 Start RPC 同步执行 pipeline | `local_agent_history_routes.py:137-138,149-150` 在 handler 内等待 `tick_extract` 和 `tick_pipeline` | UI 请求会等待文件扫描、OpenRouter、TTS、Laravel 上传，表现为长时间不加载或 timeout |
| Qwen speaker 表与模型能力不一致 | `qwen3tts_api_server.py:77-87` 写入 `Emma/Sophia/Hina/Hyunwoo`；运行时仅支持 9 个官方 speaker | 任一非法 speaker 令整批 `generate_custom_voice` 抛错并返回 HTTP 500 |
| UI 日志和 pending 仍只在内存 | `AgentHistoryArticleService._events`、`_pending_cache`、`_pending_at` 都是实例字段 | pycore 重启后日志、当前步骤和待处理计数消失 |
| RPC timeout 仍可被重连无限延后 | `PycoreWs.ts` 入队时装 timer，但 `openSocket/onclose/welcome` 会反复 clear/re-arm | 连接抖动时 promise 仍可能远超调用方总 deadline |
| 广播事件没有可靠恢复语义 | SSE seq/ring、前端 `lastSeq`、callback 集合都是内存状态 | 页面刷新、pycore 重启、ring 越界、慢消费者时会静默丢事件 |

---

## 13. `synthesize_batch` HTTP 500：重做 speaker 能力契约

### 13.1 根因

`pycore/tts_install_assets/qwen3tts_api_server.py` 把 UI 的 `accent/gender` 直接映射为硬编码 speaker：

| 请求属性 | 当前映射 | 结果 |
|---|---|---|
| `en/us/female` | `Emma` | 当前 CustomVoice 模型不支持 |
| `en/uk/female` | `Sophia` | 当前 CustomVoice 模型不支持 |
| `ja/.../male` 或轮换项 | `Hina` | 当前模型不支持 |
| `ko/.../male` | `Hyunwoo` | 当前模型不支持 |

当前模型报告的 speaker 是 `Aiden, Dylan, Eric, Ono_Anna, Ryan, Serena, Sohee, Uncle_Fu, Vivian`。Qwen 官方 API 已提供 `model.get_supported_speakers()` 和 `model.get_supported_languages()`，因此不能继续维护一份与模型版本脱离的伪能力表。官方说明见：<https://github.com/QwenLM/Qwen3-TTS/blob/main/README.md>。

当前 batch 还有两个放大器：

1. 所有 speaker 一次传给 `generate_custom_voice`，一个非法值使整个 chunk 失败。
2. endpoint 最外层只返回 `{"error": ...}` HTTP 500，调用方拿不到具体失败 item、speaker 和可重试信息。

### 13.2 目标契约

新增运行时 capability 快照，至少包含：

```json
{
  "model_id": "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
  "model_kind": "custom_voice",
  "speakers": ["Aiden", "Dylan", "Eric", "Ono_Anna", "Ryan", "Serena", "Sohee", "Uncle_Fu", "Vivian"],
  "languages": ["Chinese", "English", "Japanese", "Korean", "German", "French", "Russian", "Portuguese", "Spanish", "Italian"],
  "loaded_at": "ISO-8601",
  "revision": "model-and-capability-hash"
}
```

`VariantSpec` 应从模糊属性改为明确字段：

```json
{
  "key": "item-1-en",
  "speaker_id": "Serena",
  "language": "English",
  "voice_preferences": {"gender": "female", "accent": "us"}
}
```

`speaker_id` 是真正传给模型的值；`voice_preferences` 只用于选择，不得伪装成模型保证的 accent。当前官方预设没有英语母语女声；如果产品坚持 female English，应由明确的 fallback policy 选择 `Serena` 或 `Vivian` 说英语，并在结果中返回 `fallback_applied=true`，不能生成不存在的 `Emma`。

### 13.3 服务端修复项

1. 在模型加载成功后调用 `get_supported_speakers()` 和 `get_supported_languages()`，保存标准大小写映射。
2. 增加 `GET /capabilities`；`GET /health` 只返回摘要和 capability revision，不返回另一份硬编码表。
3. 删除 `_VARIANT_SPEAKER_EN` 与 `_SPEAKER_PRESETS` 中不存在的 speaker。
4. 新增单一 `resolve_speaker(requested, preferences, capabilities, policy)`，单条和 batch 共用。
5. speaker 大小写只用于匹配，传给模型时使用 capability 返回的 canonical value。
6. 在调用 GPU 前完成全部输入验证；未知 speaker 返回 HTTP 422，而不是 500。
7. batch 先逐项解析，非法 item 直接形成失败 row；合法 item 才进入生成 chunk。
8. chunk 推理失败时降级为逐项执行，隔离单个异常；不得丢失其它成功结果。
9. 只有模型未加载、CUDA OOM、编码器故障等服务级错误才使用 HTTP 500。
10. 每个 row 返回 `key, ok, requested_speaker, resolved_speaker, fallback_applied, audio_base64, media_type, elapsed_ms, error`。
11. error 使用结构化对象：`code, message, retryable, supported_speakers`，不要让客户端解析错误字符串。
12. `format`、语言和 key 也要预验证；重复 key 返回 422，避免客户端错配结果。

### 13.4 pycore 客户端修复项

1. `qwen3tts_engine.py` 和 `qwen3tts_service.py` 共用一个 capability client 与 response parser，禁止各自定义第二份协议。
2. 结果必须按 `key` 合并，不能按数组下标假设服务端永远保持顺序。
3. 音频先写同目录临时文件，再 `os.replace` 到目标路径，避免中断留下半个 mp3。
4. `_LAST_SYNTH_ERROR` 保存结构化摘要；逐项失败要进入 operation item，而不是压成 `one or more variants failed`。
5. `Qwen3TtsService._start` 中 `venv_python` 的解析目前位于提前 `return True` 之后，存在未赋值路径；先恢复清晰的 `attach existing -> resolve venv -> launch -> wait healthy` 状态机。
6. Qwen 服务启动、模型加载和首批 warmup 都要更新 operation stage；不能只输出终端日志。

### 13.5 完成标准

1. 任意未知 speaker 只失败对应 item，并返回 422/结构化错误，不再出现整批无信息 500。
2. capability 来自已加载模型，不来自复制的常量。
3. UI 能显示实际 speaker、fallback 原因、音频结果和失败 item。
4. 更换 0.6B/1.7B 或本地模型后无需改代码中的 speaker 表。

---

## 14. pycore UI 长时间不加载：RPC v2 与事件回调底层重构

### 14.1 立即恢复可启动基线

第一阶段只恢复正确边界，不添加新功能：

1. 修正 `agent_history_article_service.py` 的文件头；模块 docstring 必须在最前，`from __future__ import annotations` 紧随其后，所有 imports 在文件顶部完成。
2. 删除 `get_logs()` 内 `get_agent_history_tick_service` 的游离 import 残片，并通过顶层 import 或依赖注入解除 cycle。
3. `local_agent_history_routes.py` 的 config POST 和 start handler 只写命令/operation，立即返回 `operation_id`。
4. 删除 handler 内 `await _run(tick.tick_extract)` 与 `await _run(tick.tick_pipeline)`。
5. `get_status()` 不得同步全量 `collect_fragments()`；扫描结果由后台 worker 更新持久化 snapshot。
6. 启动时单个可选 feature 导入失败不能阻止 `ui.ping`、健康路由和其它 feature 注册；route builder 要记录 `feature_unavailable` 并继续启动。

### 14.2 RPC request/response 语义

把 route 分成三类，不再用一个默认 30 秒策略覆盖全部调用：

| 类型 | 用途 | 规则 |
|---|---|---|
| Query | 读快照、配置、列表 | 有绝对 deadline；可安全重发；不启动工作 |
| Command | start/cancel/retry/update setting | 只完成持久化受理；要求 idempotency key；快速返回 operation/revision |
| Stream | operation/log 增量 | 只走统一事件流；可从 seq 恢复 |

前端 `PendingCall` 增加 `createdAt, deadlineAt, attempts, idempotencyKey, retryPolicy`。timer 必须按 `deadlineAt - now` 安排；断线和 welcome 只能重发，不能重置 deadline。超过 deadline 后从 `pendingCalls` 删除并 reject，即使 socket 之后恢复也只把迟到响应交给 completion channel。

服务端要求：

1. 同一个 `client_id + idempotency_key + route` 只能受理一次 command。
2. command 的 RPC 完成只表示“已持久化并入队”，不表示任务完成。
3. sync route 如果包含文件扫描、HTTP、AI、TTS、subprocess 或大文件 IO，必须改成 command。
4. `RequestEventTable` 只处理短 RPC 生命周期；跨重启任务归 operation store，不再依赖 ACK inventory 假装任务持久化。
5. server response 返回 `request_id, operation_id, accepted_at, revision`，UI 可随后查询 operation。
6. error 统一为 `code, message, retryable, details, trace_id`。

### 14.3 统一事件流，删除 WS/SSE 竞争

当前 `PycoreWs.ts` 与 `PycoreSse.ts` 通过 `sseEventsActive` 布尔值决定谁 dispatch。这个模式在 SSE onopen/onerror 与 WS frame 交错时只能“尽量不重复”，不能保证不丢失。

推荐固定为：

1. WebSocket 只传 RPC request/response/ack。
2. SSE 是唯一 broadcast event transport。
3. SSE 不可用时 UI 退化为定时拉 snapshot；不要临时让 WS 发送另一份无共同 offset 的事件。
4. 如果必须保留 WS fallback，握手时由服务端明确选定 `event_transport`，两个 transport 必须共享同一个持久化 seq 与 ACK offset，禁止前端布尔抢占。

统一 event envelope：

```json
{
  "schema_version": 1,
  "event_id": "uuid",
  "seq": 18421,
  "topic": "operation.changed",
  "entity_type": "operation",
  "entity_id": "op_...",
  "revision": 17,
  "occurred_at": "ISO-8601",
  "trace_id": "trace_...",
  "payload": {"status": "running", "stage": "synthesizing_audio"}
}
```

事件持久化要求：

1. seq 与 event row 写入持久化 store 后才能发送。
2. SSE `since` 超过保留窗口时返回 `stream.reset_required`，包含 `oldest_seq/current_seq`；禁止静默从 ring 中间继续。
3. 慢消费者发生 queue overflow 时立即发送 reset 标志并关闭连接；不能继续发送更大 seq 让客户端误以为完整。
4. pycore 重启后 seq 继续单调增长，不能归零。
5. 快照响应包含 `snapshot_revision` 和 `event_seq`；UI 以该水位连接增量流，消除“先查询还是先订阅”的竞态。
6. 事件采用 at-least-once；客户端按 `event_id` 或 `seq` 去重。
7. 事件 payload 保持小，只携带定位与摘要；完整内容通过 snapshot/query 获取。

### 14.4 callback 执行模型

当前前端 `dispatch()` 在同一调用栈内 `Set.forEach(handler)`，没有 try/catch；一个 handler 抛错会中断后续 handler，async rejection 也无人处理。服务端 `RoutesManager.emit_event()` 对 coroutine 使用裸 `asyncio.create_task`，任务内部异常不会被外层 try 捕获。

重构要求：

1. 新建单一 `PycoreEventBus`，禁止页面直接操作 transport。
2. dispatch 前复制 handler snapshot，允许 callback 在执行中 unsubscribe。
3. 每个 callback 单独 try/catch；async callback 用 `Promise.resolve(...).catch(...)` 隔离。
4. callback 注册返回幂等 unsubscribe，并支持 `AbortSignal` 自动清理。
5. 同一 entity 的事件按 seq 串行应用；不同 entity 可并行。
6. callback 收到 typed envelope，不再只收到不可追踪的任意 `data`。
7. callback 失败写入前端诊断日志，包含 topic/entity/seq/handler name，但不得阻断 ACK 或其它订阅者。
8. 服务端 async handler task 必须保留引用、安装 done callback、记录 traceback，并在 shutdown 时有界等待或取消。
9. `statusHandlers` 使用相同隔离规则，避免一个连接状态监听器破坏全局连接状态发布。
10. React hook 统一通过 `usePycoreEntity(entityId)` 订阅 store；页面不再各自写 `setInterval + mounted ref + stale flag`。

### 14.5 连接与恢复状态机

前端 transport 状态改为显式枚举：

```text
idle -> connecting -> handshaking -> hydrating -> live
                     \-> degraded -> reconnecting
live -> suspended -> connecting
```

每次状态变化记录原因、attempt、next_retry_at 和 last_error。`isWsConnected()` 只代表 RPC ready；事件流 ready 与 snapshot hydrated 必须是独立状态，UI 不得把 socket open 当作数据已恢复。

---

## 15. Laravel 最后更新日志：Laravel -> pycore -> pycore UI

### 15.1 当前缺口

当前没有找到 Laravel 读取 `storage/logs` 并返回受限 tail 的内部 API。`LaravelClient` 只记录 pycore 发往 Laravel 的 HTTP 摘要；`laravel_http` 事件不是 Laravel 应用日志，也无法回答 Laravel 内部 exception、queue 或业务更新发生了什么。

UI 不应直接访问 Laravel 日志。完整链路必须是：

```text
Laravel bounded log API
  -> pycore LaravelLogMirrorService
  -> pycore persistent snapshot/event
  -> ui.laravel.logs_snapshot RPC
  -> pycore-manager global log panel
```

### 15.2 Laravel 侧

新增 `LaravelLogTailService` 和 internal controller，建议路由为 `GET /api/internal/pycore/logs/latest`。要求：

1. 只允许读取 Laravel 配置确定的 active log 文件，客户端不能传任意 path。
2. 支持 `cursor`、`limit`、`max_bytes`、`levels`；服务端强制上限，例如 200 entries/256 KiB。
3. 从文件尾部向前读取，不把整个 `laravel.log` 载入内存。
4. 识别 daily log rotation；cursor 至少包含 `file_id, byte_offset, mtime`。
5. 多行 exception/stack trace 组合为一个 entry，而不是每行一个伪日志。
6. 返回 `id, timestamp, level, channel, message, context, trace_id`。
7. 对 token、Authorization、cookie、API key、数据库密码和本机绝对路径执行脱敏。
8. 使用现有 pycore worker/internal auth middleware；若项目没有该 middleware，新增共享 secret/HMAC，禁止 no-auth 暴露日志。
9. 响应包含 `next_cursor, source_file_id, source_updated_at, truncated, has_more`。
10. Laravel 日志 channel 增加 pycore `trace_id/operation_id/item_id` context，便于跨服务关联。

建议响应：

```json
{
  "success": true,
  "source_updated_at": "ISO-8601",
  "next_cursor": {"file_id": "laravel-2026-07-27", "offset": 812331},
  "entries": [],
  "truncated": false,
  "has_more": false
}
```

### 15.3 pycore 侧

新增 `LaravelLogMirrorService`，所有 Laravel HTTP 仍走 `get_laravel_client()`：

1. 后台按当前 active Laravel endpoint 拉增量，不在 UI RPC 内等待远端网络。
2. 保存每个 endpoint 的 cursor、last_success_at、last_attempt_at、error 和 bounded entries。
3. endpoint 切换时切换独立 cursor，禁止把 A 服务器 offset 用到 B 服务器。
4. 拉取成功后原子写 snapshot，再发布 `laravel.logs.changed` 失效通知。
5. 拉取失败时保留最后一次成功数据，并返回 `stale=true` 与明确错误。
6. `ui.laravel.logs_snapshot` 只读 pycore 本地快照，必须快速返回。
7. `ui.laravel.logs_refresh` 只受理 refresh command 并返回 operation id，不同步等待 Laravel。
8. 日志 retention 按条数和时间双重限制，不能写入 `user_data.json` 导致整文件不断重写。
9. pycore 自身 `laravel_http` request summary 与 Laravel application log 分开展示，但通过 trace id 可关联。

### 15.4 UI 侧

1. 日志状态放在 pycore-manager 顶层 provider，页面切换不销毁。
2. 初次进入读取缓存 snapshot，显示 `source endpoint, source_updated_at, fetched_at, stale`。
3. 收到 `laravel.logs.changed` 后按 revision 拉取新 snapshot，不把 event payload 直接当完整日志。
4. 支持 level、trace id、operation id 过滤。
5. Laravel 离线时继续显示最后快照，并明确标记 stale；禁止清空面板制造“没有错误”的假象。

---

## 16. pycore 持久化状态/进度底层架构

### 16.1 不再扩展 `user_data.json`

`pycore/pyfoundations/user_data_store.py` 适合低频配置：单线程拥有内存文档，修改任一 section 都会临时文件 + fsync + replace 整个 JSON。它不适合每个 item/stage/event 高频写入，也不支持索引、分页、事件 seq、lease 和多实体事务。

保留 `user_data.json` 的内容：语言、开关默认值、低频配置、兼容读取数据。

迁出 `user_data.json` 的内容：运行中任务、进度、事件日志、item 结果、重试、lease、Laravel log cursor、大型 published 数组。

### 16.2 存储选择

在 `pyfoundations` 新增独立 SQLite store，使用标准库 `sqlite3`、WAL、事务和单 owner thread；不得从 `pyfoundations` 导入 `pyutils/pyctl/callmodule`。数据库建议位于 app local data 目录，名称如 `pycore_state.sqlite3`。

最小 schema：

| 表 | 主字段 | 用途 |
|---|---|---|
| `operations` | `id, kind, scope, status, stage, revision, totals, timestamps, error_json, summary_json` | 一次可恢复工作 |
| `operation_items` | `id, operation_id, item_key, ordinal, status, stage, progress, attempts, input_json, checkpoint_json, result_json, error_json` | 每一个短文/音频/文件等 item |
| `operation_events` | `seq, event_id, operation_id, item_id, revision, level, event_type, message, payload_json, created_at` | 结构化事件与 UI 增量 |
| `ui_snapshots` | `profile_id, scope, schema_version, revision, state_json, updated_at` | 需要跨 UI 启动恢复的视图状态 |
| `consumer_offsets` | `consumer_id, stream, last_acked_seq, updated_at` | 可选的跨连接消费水位 |
| `remote_cursors` | `source_type, source_id, cursor_json, snapshot_json, revision, timestamps, error_json` | Laravel logs 等远端增量镜像 |

状态枚举固定为：

```text
queued -> running -> succeeded
queued/running -> cancel_requested -> cancelled
running -> retry_wait -> queued
running -> interrupted -> queued or failed
```

不能直接从 `running` 跳回 `queued` 而不记录原因；每次状态转换必须在事务内同时增加 revision 和写 event。

### 16.3 operation service

在 `callmodule/services` 增加通用 operation service：

1. `create_operation()` 先持久化 operation 和全部可确定 items，再允许 worker 执行。
2. `claim_next_item()` 使用 lease owner/lease expiry，避免 heartbeat 重入重复处理。
3. `transition_item()` 校验合法状态转换并乐观检查 revision。
4. `checkpoint_item()` 保存阶段产物引用，使重启后从最近阶段恢复。
5. `append_event()` 写结构化 event；日志文字只能作为补充，不得替代状态字段。
6. `complete_operation_if_terminal()` 从 items 聚合总状态，不由 UI 猜测。
7. `recover_interrupted()` 启动时将过期 lease 的 running item 标记 interrupted，再按 retry policy 恢复。
8. `cancel_operation()` 只写 cancel_requested；worker 在安全 checkpoint 响应取消。
9. `retry_item()` 增加 attempt 并保留历史 error，不覆盖诊断证据。
10. retention 后台清理 completed operation/event；运行中 operation 永不清理。

### 16.4 写入粒度与性能

1. stage 开始、stage 完成、error、result 必须立即持久化。
2. 连续百分比最多每 250-1000ms 合并一次，禁止每个 token fsync。
3. operation 总进度由 item 状态聚合；单 item 进度来自明确阶段权重，不显示伪造的匀速百分比。
4. event message 长度、payload 大小和 retention 必须有上限。
5. 大文本和音频写 app cache/data 文件，数据库只存 hash、大小、mime、绝对资源引用和结果 metadata。
6. 文件使用 temp + atomic replace；数据库 checkpoint 只能在文件落盘成功后提交。

### 16.5 UI state 的边界

“所有 UI 保存状态进度”不能解释为把每一个 React `useState` 都写入后端。按以下规则分类：

| 状态 | 保存位置 | 示例 |
|---|---|---|
| 任务事实 | pycore operation store | running stage、item 结果、错误、重试、音频路径 |
| 跨启动工作视图 | pycore `ui_snapshots` | 当前 operation、筛选器、选中 item、日志 cursor |
| 低频用户设置 | `user_data.json` 或 `ui_snapshots` | 默认语言、默认 engine、并发度 |
| 纯临时显示 | React 内存 | hover、临时 modal、未提交输入 |
| 浏览器连接身份 | browser/session storage | browser id、tab id；不能作为任务 owner |

`ui_snapshots` 使用 `profile_id + scope` 隔离，并带 `schema_version/revision`。更新使用 merge patch + expected revision，避免两个标签页互相覆盖。后端必须对白名单字段校验，禁止 UI 写任意 JSON 污染控制面。

---

## 17. Agent History 作为第一个 operation 迁移者

### 17.1 文件拆分

`agent_history_article_service.py` 已超过单一职责，且当前 merge 已破坏 import。不要在这个文件继续加字段；先扫描现有项目是否已有 operation/repository/stage runner，再拆为不超过 800 行的组件：

| 组件 | 职责 |
|---|---|
| `agent_history_pipeline/config.py` | 低频配置与兼容迁移 |
| `agent_history_pipeline/planner.py` | 收集 fragments、构建确定性 batch/item_key |
| `agent_history_pipeline/worker.py` | claim item、按 checkpoint 驱动 stage |
| `agent_history_pipeline/article_stages.py` | CN 生成、EN 翻译、结构校验 |
| `agent_history_pipeline/audio_stage.py` | TTS capability 选择、合成、音频 metadata |
| `agent_history_pipeline/laravel_stage.py` | 幂等上传与重试 |
| 通用 operation repository | 状态、item、events、snapshot；禁止 Agent History 私有再造 |

### 17.2 每个 item 的阶段

每个 raw batch 是一个稳定 item，`item_key` 使用 source fragment id 范围 + 内容 hash，确保重启和重新扫描不重复创建。阶段固定为：

```text
queued
preparing_source
generating_reference_cn
validating_reference_cn
translating_target_en
validating_bilingual
resolving_tts_capability
synthesizing_audio
saving_local_result
uploading_laravel
completed
```

每个阶段记录：`started_at, finished_at, elapsed_ms, attempt, progress, input_ref, output_ref, error`。

必须保存的 checkpoint：

1. raw fragment ids、raw hash、word count。
2. `title_cn/reference_cn` 及 OpenRouter model/request metadata。
3. `title_en/article_en` 及 translation metadata。
4. TTS requested/resolved speaker、engine、format、音频 path/hash/bytes/duration。
5. 本地 record id。
6. Laravel idempotency key、article id、audio URL、upload attempt/error。

重启后如果 CN 已成功而 EN 未完成，只从 EN 继续；音频已原子落盘则禁止重复合成；Laravel 上传使用 record/item key 保证重复请求返回同一业务结果。

### 17.3 日志与进度

start command 在返回前必须持久化第一条事件，例如：

```text
Operation accepted: agent_history_backfill
Planned 42 items from 318 fragments
Item 3/42: generating reference article
Item 3/42: translating bilingual article
Item 3/42: synthesizing audio with Serena
Item 3/42: completed and uploaded
```

日志必须带 `operation_id, item_id, stage, attempt, trace_id`。当前 `_events: deque(maxlen=120)` 只能在迁移期作为 console mirror，不能继续给 UI 当数据源。

总体快照至少返回：

```json
{
  "operation": {"id": "op_...", "status": "running", "stage": "synthesizing_audio", "revision": 21},
  "counts": {"total": 42, "queued": 31, "running": 1, "succeeded": 9, "failed": 1},
  "current_items": [],
  "recent_events": [],
  "event_seq": 18421
}
```

### 17.4 Agent History UI

替换 `PcAgentHistoryConfigPanel`、`PcAgentHistoryLogPanel` 和 `PcAgentHistoryRecords` 的分散轮询：

1. ON/OFF 只改变 scheduler policy；Restart 创建新 operation，并要求确认是否复用已完成 checkpoint。
2. 页面加载调用一次 operation snapshot；不要分别每 4/8/10 秒请求 logs/records/config。
3. 总进度显示 item counts 与当前 stage，不只显示 `phase/pending/published`。
4. 每个 item 显示双语标题、中文短文、英文短文、各阶段时间、当前 TTS speaker、audio player、Laravel upload 状态和错误。
5. 失败 item 提供 retry command；retry 不重置其它成功 item。
6. UI 断开时 worker 继续；重新打开页面按 operation id/revision 恢复。
7. `PcAgentHistoryRecords.tsx` 的 `pc_agent_history_records_cache` 不再承担 stale-while-revalidate 事实源；历史记录来自 operation/result query。
8. event 只触发 store refresh；React component 不直接拼接 event 为最终列表。
9. 数据 stale 时显示 snapshot 时间和连接状态，禁止用空数组覆盖最后成功快照。

---

## 18. 所有 pycore UI 的迁移范围

统一 provider 放在 pycore-manager routes 之上，页面卸载不能销毁 operation store。建议迁移顺序：

| 顺序 | 页面/能力 | 当前风险 | 迁移目标 |
|---|---|---|---|
| 1 | Agent History | 内存日志、长 RPC、无 item 状态 | 完整 operation/item/event 首个实现 |
| 2 | Queue Center | 多处 poll、控制 intent 与运行态混合 | 控制 snapshot + worker operations |
| 3 | Video Extract | context/localStorage reattach | backend operation id + stage/checkpoint |
| 4 | Books/Content | 页面持有进度、localStorage 恢复 | 每本书/文件为 item |
| 5 | Sentence/Word Audio | worker 状态与 UI 设置分散 | queue item + engine/speaker/result |
| 6 | Code Sync | 页面本地 transfer 日志 | transfer operation + file items |
| 7 | AI/Translation | request 与长结果耦合 | accepted command + provider stage |
| 8 | Voice Subtitle/Media | 事件驱动但缺快照恢复 | durable session/queue snapshot |
| 9 | Laravel logs | 尚无完整链路 | remote mirror snapshot + event |

现有 `localStorage` 逐项分类迁移：

1. `PcAgentHistoryRecords` 记录缓存迁到 operation results。
2. Books/Video Extract 中声明“progress survives refresh”的数据迁到 operation store。
3. worker concurrency、engine 默认值迁到低频配置或 UI profile，不与运行进度混存。
4. tab、drawer、expanded tree 可保留本地；若要求跨浏览器一致，再迁到 `ui_snapshots`。
5. `browser_id/tab_id/pycore target` 仍是连接偏好，不得用于判断任务是否存在或归谁执行。

---

## 19. 建议文件清单与依赖边界

### 19.1 pyfoundations

建议新增：

```text
pycore/pyfoundations/state_store/__init__.py
pycore/pyfoundations/state_store/schema.py
pycore/pyfoundations/state_store/models.py
pycore/pyfoundations/state_store/repository.py
```

只依赖标准库与更低层 pyfoundations primitive。禁止导入 `pyutils`、`pyctl` 或 `callmodule`。

### 19.2 callmodule

建议新增或重构：

```text
pycore/callmodule/services/operation_service.py
pycore/callmodule/services/operation_event_service.py
pycore/callmodule/services/laravel_log_mirror_service.py
pycore/callmodule/services/agent_history_pipeline/
pycore/callmodule/rpc_routes/operation_routes.py
pycore/callmodule/rpc_routes/laravel_log_routes.py
```

`local_agent_history_routes.py` 只做参数校验与 service 调用，不直接碰 heartbeat、AI、TTS 或 Laravel HTTP。

### 19.3 RPC v2 前端

建议新增或重构：

```text
core/api-libs/pycore/PycoreRpcClient.ts
core/api-libs/pycore/PycoreEventStream.ts
core/api-libs/pycore/PycoreEventBus.ts
core/api-libs/pycore/PycoreOperationStore.ts
apps/pycore-manager/PcOperationContext.tsx
apps/pycore-manager/components/PcOperationProgress.tsx
apps/pycore-manager/components/PcOperationItems.tsx
```

`PycoreWs.ts` 最终只保留 transport/RPC；`PycoreSse.ts` 只保留 event stream；页面禁止直接 import 两者的底层 `subscribe/dispatch`。

### 19.4 Laravel

建议新增：

```text
poly_apps/laravel_main/app/Services/Pycore/LaravelLogTailService.php
poly_apps/laravel_main/app/Http/Controllers/Internal/PycoreLogController.php
poly_apps/laravel_main/routes/api.php
```

如项目已有 internal controller、auth middleware 或 log DTO，必须扫描并复用，不得创建平行体系。

---

## 20. 实施顺序

1. 修复两个确定的 Python import/启动状态机破损，使最小 RPC 健康面可加载。
2. 从 Agent History RPC handler 移除所有 inline tick/AI/TTS/HTTP。
3. 建立 SQLite state store、schema migration、operation repository 和合法状态转换。
4. Agent History 创建 operation/items，并把 CN、EN、TTS、本地保存、Laravel 上传改为 checkpoint stages。
5. Qwen 增加 runtime capabilities、speaker resolver、逐项 batch 结果。
6. 增加 operation snapshot RPC，Agent History UI 改为 snapshot-first。
7. 持久化事件 seq，完成 SSE reset/gap/at-least-once 语义和 callback 隔离。
8. 增加 Laravel bounded log API、pycore mirror 和全局 UI panel。
9. 按 §18 逐页迁移任务进度；删除各页面作为事实源的 localStorage/polling。
10. 最后删除兼容 `_events`、旧 published 数组、旧 article logs RPC 和重复 transport fallback。

任何阶段都不得先删除旧数据。兼容迁移应读取旧 `agent_history_article.cursor/published` 和 JSONL records，写入新的 completed operation/items；写入 migration marker 后再切换读取路径。迁移必须幂等，重复启动不能重复导入记录。

---

## 21. 完成标准（供修复 AI 自检，不新增测试代码）

### 21.1 启动与 RPC

1. 任一 feature import 失败时，`ui.ping` 与健康快照仍可用，并报告具体 unavailable feature。
2. 所有 UI command 在持久化受理后快速返回 operation id；没有 route 同步运行 AI/TTS/全盘扫描/Laravel 上传。
3. RPC 总 deadline 不因重连重置；迟到 completion 不复活已 reject 的 promise。

### 21.2 事件与恢复

1. UI 初次启动只依赖 pycore snapshot 就能重建当前任务、item、阶段、结果和错误。
2. UI 断线期间任务继续；重连后不依赖丢失事件即可恢复。
3. pycore 重启后 running item 进入 interrupted/recovery，已完成 checkpoint 不重复执行。
4. event ring/retention gap 有显式 reset_required，不静默跳过。
5. 一个 callback 抛错不影响其它 callback、连接 ACK 或 snapshot store。

### 21.3 Agent History

1. 点击 Auto process/Restart 后立即出现 operation 和 planned item 数。
2. 每个 item 可见 CN 生成、EN 翻译、音频合成、保存、上传的开始/结束/错误与结果。
3. 页面刷新、关闭再打开、浏览器新启动后仍能看到同一 operation 进度。
4. 单 item 失败可单独 retry，成功 item 不重复生成。
5. 双语正文和音频结果都关联到同一 item/record id。

### 21.4 Qwen

1. 不存在的 `Emma` 不再进入模型调用。
2. speaker 由 runtime capability 校验；实际 resolved speaker 对 UI 可见。
3. 单个 variant 错误不再导致其它 variant 一起 HTTP 500。

### 21.5 Laravel logs

1. UI 只通过 pycore 获取 Laravel 日志。
2. Laravel 不可达时显示最后成功快照、stale 时间和错误。
3. 日志 API 有认证、大小上限、cursor、rotation 处理和敏感字段脱敏。
4. pycore operation/item trace id 能关联 Laravel 日志。

达到以上标准后，才可以重新写“已修复”结论；不得再以“代码中存在某行补丁”替代端到端状态语义审计。

---

## 附录 C：原始调查报告全文（恢复自历史记录，细节最全版）

### C.1 pycore↔laravel "Loading overview…" 调查报告（pycore-laravel agent，最终版）

#### 完整请求链 UI → pycore → laravel

**UI 层**
- `poly_apps/pycore_laravel_wordflow_ui/apps/pycore-manager/pages/PcQueueOverviewPanel.tsx:42-49` — 当 `!data && hub.loading` 时渲染 `t('queueCenter.overview.loading')`（"Loading overview…"，`pc-locales/en.ts:410`）。`data` 仅来自 `hub.overview`，`loading` 仅来自 hub。
- `apps/pycore-manager/hooks/useQueueCenterHub.tsx:679-769` — `poll()` await `pycoreApi.getQueueCenterSnapshot()`；`loading` 初始为 `true`（第652行），只有 promise 落定或守卫提前返回才会清除。每 5s 轮询（`HUB_POLL_MS`，第40行）。

**FE → pycore 传输（WebSocket RPC v2，端口 59000，不是直接 HTTP 到 laravel）**
- `core/api-libs/pycore/PycoreApiLocal.ts:344-345` → `callRpc('ui.task_center.get_queue_center_snapshot', {})`（`PycoreRpcRoutes.ts:249`）。
- `core/api-libs/pycore/PycoreWs.ts:536-557` → `nativeCall`（243-268行）。默认超时 30s（`DEFAULT_RPC_TIMEOUT_MS`，第134行），**但计时器只在 `sendPendingCall` 里 `socket.send()` 之后才启动**（230-241、163-174行）。若 WS 未到 protocol-ready，请求条目停在 `pendingCalls` 且 `timer: null`（264-266行）——promise 永远无法落定。`ws.onclose` 时（506-509行）在途条目被清计时器并保留等待重发；只有 supersede(4000)/suspend 才会 reject（494-503行）。

**pycore 路由 + 处理器**
- `pycore/callmodule/rpc_routes/local_task_center_routes.py:32-35` — `get_queue_center_snapshot_handler` → `asyncio.to_thread(get_queue_center_snapshot)`，`sync=False`（async request_accepted/ack 流程）。注意：与兄弟 handler（48-51、60-63行）不同，它**没有 try/except**。
- `pycore/callmodule/controllers/local_processing/task_center_controller.py:1024` — `get_queue_center_snapshot()`。**第一条语句（第1036行）`request_id = str(int(time.time() * 1000))` 就会抛 NameError——整个文件没有 `import time`**（import 在33-73行；全文件 grep `import time` 零命中）。`time.monotonic()` 还在 170、203、207、247、552、585 行被使用。该文件是全新未提交文件（`git status` = `AM`；`git diff HEAD` 显示全部 1194 行均为新增）——从未成功运行过。
- 异常路径：`pycore/pyutils/rpc_v2/server/request_processor.py:68-78` 捕获 handler 异常并经 `ack_manager.notify_websocket_with_retry`（`ack_manager.py:75`）回送 in-band 错误响应，所以 FE promise 会 reject（错误为 `name 'time' is not defined`）。

**pycore → laravel 段（在 snapshot handler 内部）**
- `_fetch_assist_overview`（`task_center_controller.py:169-269`，在第1061行被 slice 调用）在请求路径上**同步 HTTP GET** `{base}/api/app_qy_v1/assist/overview`，超时 8s（`_ASSIST_OVERVIEW_TIMEOUT`，第106行），4s TTL 缓存（第105行），失败时回退 stale cache（258-269行）。
- HTTP 客户端：`pycore/callmodule/services/sync/laravel_client.py:167-235` — 默认超时 30s（第48行），回退 base `http://127.0.0.1:9000`（第43行）。异常全部上抛并由调用方捕获——无无限等待。
- Base URL：`get_laravel_endpoint_manager().get_active_base_url()`（`laravel_endpoint_manager.py:387-396`）— 零网络 I/O（缓存 winner 或存储的选择），但是 `@serialized_method`，会排在进行中的 `resolve()` 探测之后（有界：存储优先探测 12s+1次重试，或 ~6s 并行 sweep；344-377行）。
- Queue monitor：`queue_monitor_service.py:516` `get_snapshot(refresh=False)` — 走缓存，`@serialized_method`，owner 初始化 `timeout=90.0`（第139行）。

**laravel 侧（两个端点都是 NO-AUTH）**
- `GET /api/app_qy_v1/assist/overview` — `poly_apps/laravel_main/routes/AppQyV1Router/AppQyV1Assist.php:42`（组仅剥离 `EnsureFrontendRequestsAreStateful`，第23行）→ `AppQyV1AssistController::overview`（`app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1AITools/AppQyV1AssistController.php:474-506`）→ 缓存型 `overviewSnapshot`（30s TTL），`Throwable` → 500 JSON。无认证拦截。
- `GET /api/task-center/overview`（另一个 TaskCenter shell 经 `ServerManagerAPI.get` 直连 laravel，`core/api/modules/ServerManagerAPI.ts:553`）— `routes/api.php:260`，同在 `withoutMiddleware` 组（第233行）→ `TaskCenterController::overview`（`app/Http/Controllers/TaskCenterController.php:120`）。**不是**卡住面板所用的路径。

**Host/端口配置链** — 全链统一 9000；链中没有任何 :8000：
- FE：`LARAVEL_API_PORT = 9000`（`core/api-libs/pycore/pcLaravelPreparedEndpoints.ts:15`）；FE 自动注入 `http://{window.location.hostname}:9000` 候选（`PcLaravelEndpointContext.tsx:133`）。
- pycore：`Config.LARAVEL_WORKER_API_URL` 默认 `http://127.0.0.1:9000`（`pycore/callmodule/callmodule_config/config.py:105`）；endpoint 种子 `127.0.0.1:9000`、`100.101.149.39:9000`、`43.163.112.77:9000`、`100.106.85.16:9000`（`laravel_endpoint_manager.py:92-101`）；`localhost` 归一为 `127.0.0.1`（108-120行）；健康探测 `GET {base}/api/health`（第68行）。

#### 根因排序

**#1 — 当前工作区确定性硬伤：新文件 `task_center_controller.py` 缺 `import time`。**
每次 `ui.task_center.get_queue_center_snapshot` RPC 在第1036行即抛 NameError（`_capture_slice` 第552行、`_fetch_assist_overview` 第170行同样会抛）。pycore 跑这份代码时 overview 数据永远到不了 UI。证据：imports 33-73 行无 `time`；`git status` 为 `AM`。修复：文件顶部加 `import time`。注意：仅此 bug 时面板会在首个往返后变为 "unavailable"/显示错误，而不是永远转圈——永远转圈需要 #2。

**#2 — 产生"永远转圈"的机制：`nativeCall` 在实际发送前没有超时，且 hub 守卫有洞。**
- `PycoreWs.ts:264-266`：条目入队时 `timer: null`，发送后才装计时器（第240行）。WS 未 ready（pycore 宕/重启、握手未完成、`setPycoreActive(false)` 挂起）时 promise **永不落定**——无超时无 reject。
- `useQueueCenterHub.tsx:683-700`：当 `!isWsConnected()` 且 `pycoreHealth.up === null`（冷启动首个健康判定前、以及 3s `ui.ping` 探测窗口内，`PycoreHealth.ts:145`）且无退避（`offlineRetryAtRef.current === 0`）时，三个守卫全部落空 → 第702行设 `loading: true` → await 一个永远发不出的 RPC → `loading` 永远为 true → "Loading overview…" 永久转圈。后续 silent 轮询提前返回，不会碰这个悬挂 promise。
- 断连时同样：`PycoreWs.ts:506-509` 清掉已发未答调用的计时器并保留等重发；后端若一直不回来，这些调用无限悬挂。
- 修复：入队即装超时（或 `!connected` 时立即 reject）；守卫上把 `!isWsConnected()` 一律视为不可调用。

**#3 — snapshot 请求路径上的 laravel I/O：选定端点死掉但被丢包时每次轮询拖满 8s。**
`_fetch_assist_overview` 阻塞 RPC 线程至多 8s（`task_center_controller.py:104-106, 204-206`）；选了不可达的远端如 `43.163.112.77:9000`（被过滤而非拒绝）会打满 8s。叠加 serialized endpoint-manager/monitor 调用与 5s 轮询，UI 退化为 stale cache + "Laravel live sync paused" 横幅。有界（不是挂死），但这是修掉 #1/#2 后"数据不流动"的那部分。stale-cache 回退（258-269行）为此设计且有效。

**#4 — Host（而非端口）不匹配风险。**
端口全链一致 9000。现实风险：(a) 从另一台机器浏览 UI 会注入 `http://{该机}:9000`，而 laravel 可能只绑 127.0.0.1；(b) `Config.LARAVEL_WORKER_API_URL`（静态，默认 127.0.0.1:9000）可能与 endpoint manager 探测出的 winner 分叉——面板显示 `workerMismatch` 横幅（`useQueueCenterHub.tsx:866-870`、`PcQueueOverviewPanel.tsx:100-108`）。两者都不挂 UI，但会干扰诊断。

**已排除：** laravel 认证/中间件（两端点按设计 NO-AUTH）；SSE 误当请求/响应（RPC 响应走 WS，SSE 仅事件）；`requests` 无界等待（超时就绪：3/6/8/12/30s）；laravel `TaskCenterController` 路径（是另一个消费者，非卡住面板）。

**建议首步：** 给 `task_center_controller.py` 加 `import time`；在 `PycoreWs.ts` 入队时即装超时（或 `!connected` 直接 reject）；重启 pycore 后观察 `[QueueCenter] Slice ...` 日志（controller 577-588行）与 `[laravel] GET /api/app_qy_v1/assist/overview -> ...`（`laravel_client.py:208-214`）验证全链。

### C.2 任务中心调查报告（task-center-state agent，最终版）

#### ON/OFF toggle 完整链路与断点

链路：UI 开关 → WS RPC → pycore 控制器 →（断）→ 永远不到 Laravel。

- UI 开关：`PcQueueCenterPage.tsx:39-53`（QcSectionSwitch，busy 时 disabled）；runToggle L182-193 管理 busyScope，finally 清除。overview 卡和 translation 卡共用同一个 toggleAssistTranslation（L214-222，用于 L313-341）。
- Hub：`useQueueCenterHub.tsx:808-837` setControl——先写乐观 controlIntent（L810-818）→ pycoreApi.setQueueCenterControl → await poll(false) → finally 删除 intent（L829-836）。失败无回滚、无开关专属错误提示。
- API 层：`PycoreApiLocal.ts:346-361` → RPC 路由 `ui.task_center.set_queue_center_control`（`PycoreRpcRoutes.ts:250`），WS 默认 30 秒超时（`PycoreWs.ts:134`），超时 reject（`PycoreWs.ts:168-173`）。
- pycore RPC handler：`local_task_center_routes.py:37-53`。
- pycore 控制器：`task_center_controller.py:1116-1163` set_queue_center_control——intent 记入进程内存字典 `_CONTROL_INTENTS`（L93；`_record_control_intent` L365-382，pycore 重启即丢）；只应用本地效果：`assist_config()`（L133-144 → save_assist_settings 写 pycore user_data.json 的 assist_laravel 段，`pyctl/assist/assist_settings.py:92-112` + `apply_assist_runtime`，`assist_capability_sync.py:45-78`）和 `apply_word_auto_start`/`apply_sentence_auto_start`（`word_tts_auto.py:127-166`、`sentence_audio_auto.py:182-207`）切换 PyHeartbeat 回调；无条件返回 success:True（word/sentence 分支连 assist_config 返回值都丢弃，L1144-1154）；此路径无任何发往 Laravel 的 HTTP 写调用（该文件 `get_laravel_client()` 仅用于 GET 读取，L204）。
- 断点 A（主断点）：pycore 不转发。Laravel `POST /api/task-center/settings`（`TaskCenterController.php:95-117`，路由 `routes/api.php:262-263`）全仓库（py/ts/tsx）零调用，是孤儿端点。
- 断点 B：`laravel_translation_enabled/paused/graceful_stop` 只被 `TaskCenterController.php:404-407` 自己读回展示；无任何 worker/timer/controller 消费——死状态。
- 断点 C：`AppQyV1AssistController` 的开关门是 `env('APPQYV1_ASSIST_ENABLED', true)`（`AppQyV1AssistService.php:51-54`）静态环境变量，与任务中心开关无关；`AppQyV1TranslationQueueController` 全部端点不读任何 ON/OFF，永远入队。
- 回传：无 SSE/推送到 manager UI；唯一通道是 hub 每 5000ms 轮询 `ui.task_center.get_queue_center_snapshot`（`useQueueCenterHub.tsx:40, 775-781`）→ pycore `get_queue_center_snapshot`（`task_center_controller.py:1024-1113`）→ `_control_state`（L592-680）→ `_build_section_contracts/_toggle_fields`（L683-744）。UI `parseBackendContract`（`useQueueCenterHub.tsx:182-233`）只要后端 contracts 存在就一律采用（L307-309），乐观 intent 形同虚设。Laravel→pycore 走带 TTL 的缓存监视器（assist overview TTL 4s/超时 8s，`task_center_controller.py:104-107, 169-210`）；Reverb 广播只面向 worker 客户端。

#### 状态不共享的原因

- 两套互不相通的存储：唯一事实源 = pycore user_data.json（assist_laravel/word_tts_auto/sentence_audio_auto 段）+ 易失的 `_CONTROL_INTENTS`（`task_center_controller.py:93`）；Laravel 另有一份 UserConfigService JSON 文件（`app/Services/UserConfig/UserConfigService.php:13, 81-145`），无人写入、只有 TaskCenterController 自己读。DB workers 表（`Worker.php` + 迁移 `2026_07_24_000002_add_mcp_chrome_fields_to_workers_table.php`）只存注册/心跳/capabilities，没有任何 ON/OFF 字段，在线状态由 `last_heartbeat_at` 120 秒超时推导（`Worker.php:68, 108-115, 166-170`）。
- `QueueCenterHubProvider` 只挂在 `PcQueueCenterPage.tsx:394`；页面之外 `useQueueCenterHub()` 得到 defaultHub（`useQueueCenterHub.tsx:629-657`），其 setControl 是静默空操作（L656），contracts 全 off。
- 跨区副作用加剧"不一致"观感：assist_translation 总开关通过 apply_assist_runtime 翻动所有能力通道；word/sentence 开关又写同一个 assist_laravel.capabilities 映射（`word_tts_auto.py:139-142`）——动一个开关改其他分区状态。
- `TaskCenterState.ts`（全读过）不含任何 ON/OFF 状态，只管 recent tasks/翻译队列/句子并发；pending 标志全部 finally 清除（L160-163, L213-216, L279-282）不会永久卡；唯一不共享的是 `localStorage('pc_sentence_worker_concurrency')`（L286，按浏览器本地）。

#### pycore 是否把控制状态写入 laravel？

否。没有任何代码调用 `POST /api/task-center/settings`（`routes/api.php:262-263` 孤儿）；pycore 开关路径只写本地 user_data.json + 进程内存 + PyHeartbeat 回调。workers 表无开关字段，pycore 只通过 worker 注册/心跳接口写心跳（与 ON/OFF 无关）。Laravel 侧 `laravel_translation_*` 键自出生起无人写、无人真正消费。

#### 开关"卡住"的根因（按可能性排序）

1. **starting 生命周期炼狱**：`_resolve_lifecycle`（`task_center_controller.py:385-399`）——requested 与运行信号不一致即 starting；而 heartbeat 切换静默失败（`assist_capability_sync.py:24-28` 回调未注册仅打黄字日志；`word_tts_auto.py:150-157`、`sentence_audio_auto.py:198-205` 吞异常），后端仍返回 success，UI 永远停在琥珀色 starting（渲染 `PcQueueCenterPage.tsx:83-93`）。
2. **契约语义让 OFF 后仍显示 ON**：`_toggle_fields` L740 `enabled = running OR configured`——OFF 已记录但 heartbeat 没真停时开关视觉弹回 ON。
3. **每次尝试冻结 30 秒、无回滚**：busy 期间开关 disabled；RPC 30 秒才 reject（`PycoreWs.ts:134, 168-173`），轮询失败还有最长 30s 退避（`useQueueCenterHub.tsx:754-756`）；超时后 intent 被丢弃（L829-836），下一次成功轮询把开关弹回后端契约 → 用户看到卡住/弹回。
4. **intent 易失**：`_CONTROL_INTENTS` 是进程内存（`task_center_controller.py:93`），pycore 重启后 requested 丢失，回退到持久化 auto_start（L612-621）→ 刚切的状态看似回退。
5. **开关不到 Laravel**：Laravel 定时器/env 门/chrome 客户端无视 UI 开关继续跑，OFF 后任务仍继续，与卡住无法区分。

修复方向：(a) pycore set_queue_center_control 转发 Laravel POST /api/task-center/settings，或删 Laravel 死配置、明确 pycore 为唯一控制面；(b) heartbeat 切换失败进入 RPC 响应（不再无条件 success）；(c) 开关用更短专用超时 + 失败显式报错并重新拉取；(d) `_CONTROL_INTENTS` 持久化或删除，以持久化配置为唯一事实源。

### C.3 主会话直接验证补充（内联调查记录）

- **RPC 分发模型**：`websocket_handler.py:115-127` 非控制消息 `asyncio.create_task` 派发；sync 路由（ui.ping）走 `_handle_sync_request`(:344-411) 内联 `asyncio.to_thread`。默认 executor 被长任务（poll_and_process、serialized 30s 等待）占满时，连 ping 的 to_thread 都排队 >3s → `ui.ping failed (attempt 1/2)`。
- **`apply_auto_start` 同步重工作**（30s RPC 超时直接原因）：
  - `word_tts_auto.py:159-163` — `apply_auto_start(enabled=True)` 在 RPC 线程内同步 `get_tts_queue_poller_service().poll_and_process()`（claim + 整批 TTS 合成），随后 `get_status()` → `_laravel_queue_summary()`（:57-68）→ `fetch_queue_summary()` 又是一次 laravel HTTP（不可达端点再拖 30s）。
  - `sentence_audio_auto.py:212-217` — 同样同步 `worker.poll_and_process()`；:218-221 引擎预热已在线程里（正确写法参照）。
- **TranslationSSE 阻塞点**：`translation_ws_client_service.py:344-355` `word_audio.priority` 分支在 SSE 事件路由里同步 `worker.poll_and_process()`，而 `_dispatch_sse`(:433) 是 `@serialized_method` 跑在 `translation.sse_client.state` owner 线程上 → owner 被 TTS 批次占满 >30s → `supervise()`(:606-622) 每次心跳都抛 `Serialized operation timed out: translation.sse_client.state.<uuid>`。
- **`/edge-tts … -> 404` 字符串源头**：`tts_engine_policy.py:402` `format_tts_synth_command` 生成的**展示用**命令串（含 `--write-media C:\...\assist_tts_*.mp3`）被某处误当 URL path 传给 `get_laravel_client().get()`；`laravel_client.py:145-155` `_is_full_url` 只看 http(s) 前缀，任何字符串都拼到 base 后发出去 → laravel 无此路由 → 404。（后续修复已确认 caller 为 `completed_task_archive._resource_string`，见"修复状态"表 §6。）
- **Agent History 404 write≠serve 实证**：`AppQyV1ArticleController.php:636` 写盘 `PathMapper::getAppQyV1AudioDir('agent_history/'.$lang)` → `PathMapper.php:749-754` 解析为 `static/app_qy_v1/audio/word_sounds/agent_history/…`；而 `:754` 返回 URL `/static/app_qy_v1/audio/agent_history/…`（少 `word_sounds/`）→ `routes/static.php:68` catch-all 按 URL 找盘必 404。
- **wordnew 推送链已通**：`AppQyV1ArticleController.php:667` emit `article.published` → laravel SSE → `translation_ws_client_service.py:361-362` → THREAD_BUS → `thread_bus_routes.py:68` WS 广播 → `WfDailyReadingSection.tsx:75-83` 订阅 + 12s 轮询兜底（`WfNewApiPaths.ts:84` 拉 `worker/recent`）。
- **TTS 策略现状**：`tts_engine_policy.py:26-37` 句链 `qwen3tts` 打头、edge 垫底；词链 `edge` 打头、排除 `qwen3tts`；`:38-42` agent_history 强制本地引擎。GPU gate `_apply_sentence_gpu_gate`（`tts_orchestrator.py:109-116`）在 qwen3tts 不可用时降级。单词乱码文本（"UôS"/"Hagaba"）来自 probe 样本。
- **laravel 现有优先级端点（wordnew 可直接用）**：`translation/queue/priority` + `/stack`（`AppQyV1AITools.php:168-169`，no-auth 控制面）、`tts/sentence/bump` + `/bump-batch`（:102-103）、`tts/queue/add-at-position`（:203）；事件 `word_audio.priority` emit 于 `AppQyV1WordMediaController.php:226,283`、`AppQyV1TTSQueueController.php:373`；pycore SSE 路由 `sentencepriority`/`wordaudiopriority` 已实现重排唤醒（`translation_ws_client_service.py:341-355`）。
- **短文↔文章路由现状**：短文 `routes/api.php:343-347`（daily-sentences list/recommend/audio）；文章 `AppQyV1AITools.php:114-117`（no-auth：task/{id}、worker/submit、worker/recent）+ `:206-210`（auth：submit、preview、backfill-library）。sys:init = `app/Console/Commands/InitializeApps.php`（signature `sys:init`），幂等骨架 `AppQyV1InitializationMarkerManager` + `SafeMigrationHelper` + marker 文件（参照 `.migrated_to_mapwebpath`，`AppQyV1SystemInitComplianceCtl.php:44`）。
