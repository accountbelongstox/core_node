# 清单 — Qwen3-TTS 端口打印 / 内置 Web 页面 / 队列扩展 / WS 完成通知

Status: superseded by `PLAN_20260729_RPC_V2_EXTERNAL_HTTP_CLIENT.md`; retained as historical planning context only.

实现状态（2026-07-29）：A-F 已完成；G 为运行时验收项，按项目规则未执行构建、测试或服务验证。

来源需求（2026-07-29）：qwen3tts 启动后打印端口；内置 HTML 页面（浏览器打开端口即可调用合成、查看负载与队列）；qwen3tts 扩展出队列功能供 pycore 调用；队列完成的任务通过 WS 通知 pycore，再由 pycore 通知 UI。只列清单，不写代码。

涉及文件（现有）：
- 服务端：`pycore/tts_install_assets/qwen3tts_api_server.py`（独立 venv 子进程，无 pycore 依赖）
- 客户端：`pycore/pyutils/tts/qwen3tts_ws_client.py`、`qwen3tts_engine.py`
- 生命周期：`pycore/pyutils/tts/tts_service_manager.py`、`managed_service.py`
- pycore 事件总线：`pycore/pyutils/rpc_v2/server/`（durable server_event：client_id / event_id / seq / ACK / replay）
- UI：`poly_apps/pycore_laravel_wordflow_ui/core/api-libs/pycore/PycoreWs.ts`（subscribe(topic)）

## A. 启动端口打印

- [ ] A1. `main()` 已有 `_log("... starting on host:port ...")`，确认 managed_service 启动子进程时 stdout 未被吞掉，端口行始终出现在 pycore 控制台。
- [ ] A2. 端口实际绑定后再打印一行 machine-readable 行，如 `[api] QWEN3TTS_READY http://127.0.0.1:57210`（uvicorn 启动回调里打印，而不是 run() 之前），含 Web 页面入口提示。
- [ ] A3. 端口被占用/使用环境变量覆盖（`QWEN3TTS_PORT`）时打印实际生效值与来源。
- [ ] A4. pycore 侧 `tts_service_manager` 解析该行并记录到服务状态（供 UI "TTS 引擎"条显示端口/链接）。

## B. 内置 Web 页面（打开端口即用）

- [ ] B1. `GET /` 从 health JSON 改为返回单文件 HTML 页面（内联 JS/CSS，无外部依赖，standalone 脚本不能引入静态文件目录）；health 移到 `GET /health` 保留。
- [ ] B2. 页面功能-合成调用：文本输入、语言/说话人/格式（mp3|wav）选择 → 调 `POST /synthesize` 或 WS `synthesize` → 页面内 `<audio>` 播放与下载。
- [ ] B3. 页面功能-负载展示：轮询新增 `GET /status`：model_loaded、device、dtype、GPU 显存/利用率（复用 `_query_gpu_snapshot`）、`_estimate_max_parallel` 结果、已合成计数、平均耗时。
- [ ] B4. 页面功能-队列展示：轮询 `GET /queue/status`（见 C），显示 pending/running/done/failed 任务（job_id、文本摘要、说话人、提交时间、耗时、错误）。
- [ ] B5. 页面功能-队列提交：表单 → `POST /queue/submit` → 返回 job_id，列表实时刷新；支持取消（`POST /queue/cancel`）。
- [ ] B6. 页面可用性：只绑定 127.0.0.1（现状），页面注明；轮询间隔 2-3s，服务繁忙时降频。

## C. qwen3tts 队列功能（服务端扩展）

- [ ] C1. 队列模型：进程内 FIFO + 优先级字段；job = {job_id, text, language, speaker, instruct, format, priority, submitted_at, status, result/error, elapsed}；job_id 由调用方可传（幂等去重）或服务端生成。
- [ ] C2. 调度器：单消费者循环（asyncio task），按 `_estimate_max_parallel` 批量取同语言任务走 `generate_custom_voice` 批量路径；阻塞推理继续走 `asyncio.to_thread`，不卡事件循环（沿用本次 10054 修复的构架）。
- [ ] C3. 背压：`QWEN3TTS_QUEUE_MAX` 上限（默认如 200），满时拒绝并返回明确错误；单任务超时可配。
- [ ] C4. 新 WS ops（沿用 `{op,id,params}` 协议）：`queue_submit` → {job_id}（幂等：同 client_job_id 直接返回原 job）；`queue_status` → 队列+负载快照；`queue_cancel` → {cancelled}；保留现有 `synthesize`/`synthesize_batch`/`health`（内部改为"插队单任务"或保持直连，二选一并在文档定死）。
- [ ] C5. 新 HTTP 端点（供 Web 页面与调试）：`POST /queue/submit`、`GET /queue/status`、`POST /queue/cancel`、`GET /queue/result/{job_id}`（取音频，或 WS 推送 base64）。
- [ ] C6. 结果保留：完成的 job 结果（音频字节）内存保留 N 分钟或 M 条，可配；过期清理。
- [ ] C7. 崩溃语义：进程重启队列即丢（内存队列），提交方必须以"完成通知 + 超时重提交"为准；文档写明不持久化（或可选 SQLite 持久化，列入可选项）。

## D. WS 完成通知（qwen3tts → pycore）

- [ ] D1. 服务端新增订阅通道：WS op `subscribe_events`（或独立路径 `/ws/events`），连接保持长开，任务状态变化时服务端主动推 `{type:'event', event:'queue.job.completed'|'queue.job.failed', job_id, client_job_id, ok, elapsed_ms, error?, audio_base64?|result_url}`。
- [ ] D2. 事件带单调 seq + job 状态终态可查：订阅者断线重连后用 `GET /queue/status?since_seq=` 补齐漏掉的事件（轻量 replay，不做完整 durable）。
- [ ] D3. pycore 侧新增 `qwen3tts_events_listener`（放 `pycore/pyutils/tts/`，跟随 tts_service_manager 生命周期启停）：长连 `subscribe_events`，断线指数退避重连，收到事件后按 client_job_id 唤醒等待中的调用方。
- [ ] D4. pycore 调用面改造：`qwen3tts_ws_client` 增加 `queue_submit_and_wait(client_job_id, timeout)`：提交 → 等监听器推送完成 → 取结果；保留现有直连 synthesize 作为小任务快路径。
- [ ] D5. 线程模型遵守 pycore 规则：监听器线程与等待方通过 THREAD_BUS/serialized worker 通信，不共享裸属性。

## E. pycore → UI 通知（RPC v2）

- [ ] E1. pycore 收到 D 的完成事件后，经 RPC v2 总线广播 durable server_event，新增 topic（如 `tts.qwen3tts.job.completed` / `tts.qwen3tts.queue.changed`），走 client_id/event_id/seq/ACK/replay 标准（参照 `queue.overview.changed`）。
- [ ] E2. UI `PycoreWs.ts` 的 `DURABLE_WS_TOPICS` 加入新 topic；Queue Center / TTS 面板 `subscribe()` 后局部刷新（队列条数、任务状态、toast），不整页刷新。
- [ ] E3. UI 展示：队列深度、运行中 job、最近完成/失败（错误文本直达面板，不只控制台）。
- [ ] E4. pycore 离线/tts 服务未启动时 UI 显示明确状态（复用本次修复后的 isWsConnected 统一在线判定）。

## F. 配置与文档

- [ ] F1. 新环境变量写入服务端 docstring 与 `development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md`：`QWEN3TTS_QUEUE_MAX`、`QWEN3TTS_QUEUE_RESULT_TTL_S`、`QWEN3TTS_TASK_TIMEOUT_S`。
- [ ] F2. `config/queue_center_contract.json` 如需展示新 topic/控件则同步更新并保持 schema_version 对齐。
- [ ] F3. 更新 `docs/NCORE_MCP_STDIO_GUIDE.txt` 或对应指南中 qwen3tts 能力描述（端口、Web 页面、队列 API、事件 topic）。
- [ ] F4. AGENTS.md 相关约定（RPC v2 WebSocket 为唯一全双工事件通道、SSE 仅兼容）在实现中遵守，无需修改。

## G. 验收

- [ ] G1. 启动 qwen3tts 后控制台出现 `QWEN3TTS_READY http://127.0.0.1:57210`。
- [ ] G2. 浏览器打开 `http://127.0.0.1:57210/` 可合成并播放，可看到 GPU 负载与队列列表。
- [ ] G3. pycore 提交 10 个排队任务 → 全部收到 WS 完成通知 → UI 面板实时出现完成记录；中途杀服务重启，调用方按超时重提交语义恢复。
- [ ] G4. 高负载时 /health 与 Web 页面依然秒开（事件循环不被推理阻塞，回归本次 10054 修复）。
- [ ] G5. `python -m py_compile` 全部改动文件通过；UI `npx tsc --noEmit` 改动文件无新增错误。
