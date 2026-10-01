# AUDIT 2026-10-01 — pycore Duplicate Definitions, Refactor Targets, Architecture History, Spec Gaps

Status: report only, no code changed.

Scope: `pycore/`, 1099 `.py` files, about 236k lines.

Method:
- A full AST scan for duplicate definitions, layering and spec-violation counts.
- Four read-only reviews:
  - architecture history from `docs_fix/`
  - speech/AI stack
  - transport/Laravel/relay/codesync
  - foundations/config/UI/misc

Corrections applied to the reviewer output:
- Subclassing `threading.Thread` is allowed by the spec. Only `Thread(target=)`, locks, executors and `threading.local` are violations.
- `pyfoundations/event_bus.py` is not dead. `pyapps/matrix/services/device_service.py:22` imports it.

## 1. Architecture History

Commit messages carry no information (`linux0.1`, `win0.0.1`). History is reconstructed from `docs_fix/`.

### 08-03 — Status cache and single-flight
- **Driver:** concurrent probes missed the cold cache together and stampeded.
- **Leftovers:**
  - The `local/*/status` compatibility routes remain (`callmodule/rpc_routes/route_names.py:56-60`).
  - The legacy `heartbeat_enabled` is still emitted next to `processor_enabled` (`pyctl/tts/word_tts_auto.py:102-103`, `sentence_audio_auto.py:167`), and the UI still reads it (`PcWordAudioPanel.tsx:34`).

### 08-09 — Persistent queue workers move from browser to pycore
- **Driver:** closing the UI stopped queue processing.
- **Leftover:** the dead shim `pyctl/translation/worker/base_laravel_worker.py`, which has no importers.

### 08-11 — TTS engine registry and atomic lease
- **Driver:** availability was decided in many places, and a start-then-register race existed.
- **Leftover:** engines are still module functions read through `getattr`; there is no real engine base class.

### 08-14 — Four-end endpoint centralization (`config/queue_center_contract.json`)
- **Driver:** route paths had no single source.
- **Status: incomplete.**
- Laravel path literals remain in:
  - `pyctl/tts/sentence_audio_full_sync.py:32`
  - `laravel_audio_worker.py:197,928,969`
  - `audio_resource_delivery.py:59`
  - `word_audio_service.py:50-51`
  - `word_audio_full_sync.py:26-27`
  - `word_audio_backend_progress.py:14`
  - `pyctl/assist/assist_settings.py:21`
  - `pyctl/corebook/engine.py:472`
  - `pyctl/audio_orchestration/orch_delivery.py:42-43`
- The stale v1 relay block is still in `config/queue_center_contract.json:220+`.

### 08-23 → 09-15 — Relay V2 (Laravel + Mercure), then A7A unification
- **Driver:** two Laravel relays, a hand-rolled SSE parser and per-thread HTTP sessions.
- **Leftover:** legacy `relay_v2` identifiers are kept for read compatibility (`relay_execution_ledger.py:17`, `relay_identity.py:29`).

### 09-27 — Team bug audit
- **Driver:** unauthenticated `:59000`, and `trigger_event` without an allowlist.
- **Leftover:** the coverage gaps in that audit's §6 remain unaudited.

### 09-30 — WS event transport
- **Driver:** SSE exhausted the browser's 6-connections-per-host limit.
- **Leftovers:**
  - SSE and WS coexist by design.
  - Web Locks leader election is still open.

### 09-30 — Relay Fabric V3
- **Driver:** interactive calls ran as durable jobs (p99 422 s).
- **Leftover: the V2 durable lane still runs in parallel.**
  - The `×4` backoff is still at `laravel_relay_agent_service.py:209-215`.
  - The claim loop is at `:245-292`.
  - Each operation still gets its own lease thread at `laravel_relay_operation_processor.py:190-222`.

### 09-30 — AI model manifest
- **Driver:** every domain kept its own engine table.
- **Leftover:** the OCR, STT and TTS tables now derive from the manifest, but the readiness rules are still duplicated (§3.2).

### Recurring root-cause classes
1. Polling and status stampedes.
2. Blocking calls on hot paths.
3. Multiple sources of truth: endpoints, engine tables, state flags.
4. Parallel transports and implementations.
5. Compatibility shims never removed after migrations.

## 2. Metrics

| Item | Count | Note |
|---|---|---|
| Upward-layer imports | 0 | Layer direction is healthy |
| pyutils cross-domain imports | 9 | `common/relay_contract.py:15` and `relay_fabric_contract.py:12` import `codesync.textnorm`; `desktop` and `native_ui` import each other; `whisper_stt` imports `media_processing`; `desktop/tk_taskbar` imports `window` |
| pyutils importing `database` | several | `common/operation_*`, `laravel/delivery_outbox.py:66` |
| `try` blocks | 2166 | Spec says forbidden |
| Module-level `get_*()` accessors | 274 | Spec wants module instances |
| Real threading violations | small | `Thread(target=)` ×2 (`desktop/system_notification.py:96`, `frontend_launcher/process_output_capturer.py:21`); `threading.local` (`common/x11_display.py:49`); `ThreadPoolExecutor` (`tts/batch/batch_common.py:15,360`); locks (`codesync/push_receiver.py:60`, `codesync/workspace_exchange.py:121,401`, `pyheartbeat/heartbeat.py:46`, `tts/qwen/events.py:28`); per-thread HTTP ownership (`common/http_client.py:155-160`) |
| Package cycle | 1 | `pyheartbeat` ↔ `pythreadpool` (`pythreadpool/starters.py:55`) |
| Bare `print` in library code | few | `common/build_config_parser.py` (23), `python_env/runtime_policy.py` (9), `secret_manager.py`, `python_package_policy.py` |

## 3. Duplicate Definitions

### 3.1 Transport / Laravel / relay / codesync

**Six HTTP stacks talk to Laravel:**
- `common/laravel_http_transport.LaravelHttpSessions`
- `common/http_client.HttpClient`
- `common/http_progress_upload.HttpProgressClient`
- `laravel/client.LaravelClient`
- `laravel/relay_transport.LaravelRelayTransport`
- a raw session in `pyctl/relay/fabric/fabric_publisher.py:39,88`, which bypasses signing and recording

**Three Laravel base-URL sources**, so relay and workers can target different origins:
- `endpoint_manager.resolve()` (`:652`)
- `relay_transport.endpoint()` (`:51`)
- the env fallback `LARAVEL_WORKER_API_URL`

Thin re-wrappers of these:
- `_media_sync_helpers.resolve_laravel_base_url:78`
- `pyctl/tts/word_audio_service._laravel_base:177`
- `worker_base._sync_laravel_endpoint` / `_task_base_url`

**Seven hand-rolled exponential backoff loops**, although `pyfoundations/backoff_wait.py` exists:
- `relay_event_forwarder.py:152`
- `laravel_relay_agent_service.py:315,324`
- `laravel_relay_operation_processor.py:450,478`
- `fabric/fabric_agent.py:65`
- `mercure_client.py:186`
- `delivery_outbox.py:412`
- `codesync/push_sender.py:132`

**Three retry layers on one result POST:** `worker_result_delivery`, the `worker_base` 5xx breaker (`:1239-1263`) and `delivery_outbox`. `worker_result_delivery` (pyutils) also duck-types pyctl worker private fields, which is a hidden upward dependency.

**Two relay device heartbeats:** `laravel_relay_agent_service._heartbeat:518` and `fabric_grant.heartbeat:27`.

**Two SSE parsers:** `mercure_client.py:274-336` re-implements `pyfoundations/http_sse.SseEventDecoder`.

**Four error shorteners:** `laravel/client._short_err:126`, `worker_result_delivery.short_http_error:22`, `worker_base._short_err:298`, `common/http_client.redacted_http_error:275`.

**Five copies of the LAN-IP probe (UDP to 8.8.8.8):**
- `codesync/runtime.py:318`
- `codesync/client.py`
- `pyctl/runtime/global_config.py:142`
- `launcher/device_sync/network_cache.py:202`
- `launcher/device_sync/core/config.py:190`

**Nine timestamp helpers.** `_now_iso` appears at:
- `pyctl/terminal/terminal_state_repository.py:49`
- `terminal_scheduler.py:37`
- `pyctl/task_history/store.py:32`
- `archive.py:27`
- `common/operation_event_service.py:21`
- `common/task_history_repository.py:15`
- `database/repositories/state_rpc_repository.py:114`

`_utc_now` appears at `pyctl/queue_center/snapshot_service.py:93` and `rpc_v2/http/event_service.py:34`.

**SQLite open sequence (busy_timeout + WAL) in four copies:**
- `terminal_state_store`
- `laravel_delivery_repository:82-90`
- `audio_resource_repository:24-31`
- `state_repository:41-58`

`SQLITE_BUSY_TIMEOUT_MS = 30000` is defined three times and hardcoded once. `sqlite_local.connect_writable` does not apply the PRAGMAs.

**Ad-hoc atomic writes** bypass `atomic_json_store`:
- `codesync/peer_config.py:146`
- `sync_settings.py:347`
- `runtime_prefs.py:86`
- `watcher.py:290`
- `common/pyservice_mode.py:73`
- `pyctl/task_history/archive.py:33`
- `common/user_data_store.py:209`
- `common/result_cache.py:77`
- `flat_text_store.py:73`
- `ffmpeg_runtime.py:62,92,148`
- `ffmpeg_subtitle.py:32`
- `secret_manager.py:243`

**CLI duplication.** `pyctl/pyservice_cli/__main__.py:46-74,142,259,282` duplicates `codesync/cli.py:45-98,204,227`, and the two have already drifted: one hardcodes `"/code-sync/ping"`, the other uses `routes.PING_PATH`.

**Two `/code-sync/*` servers:** `codesync/http_server.py` (a ThreadingHTTPServer with about 440 handler lines) and `callmodule/rpc_routes/code_sync_routes.py`.

**`codesync/runtime.py` hooks are dead indirection.** It re-wraps `get_machine_id:298`, `get_hardware_machine_id:308`, `get_core_node_root:335` and `get_app_data_dir:354` behind `configure()` hooks, but the only caller, `callmodule/config.py:178`, never passes them. `_ThreadBusProxy:35` is redundant, and a failed hook is swallowed with `except: pass`.

**Copied running-flag lifecycle:**
- `_begin_start` in `peer_mesh.py:108`, `push_sender.py:78` and `client.py:137`
- `_begin_stop` in `peer_mesh:116` and `client:166`
- the same pattern in `watcher.py` and `sse_receiver.py`

**Separate SSE journals/brokers:** `rpc_v2/http/event_service.SseEventJournal`, `rpc_v2/delivery.HttpEventDeliveryService`, `codesync/sse_transport.CodeSyncSseBroker`, `relay_event_forwarder`, `operation_event_service`.
- `operation_event_service` keeps a mutable module-global publisher (`:25`).
- Its `_broadcast:96` is an alias of `_notify_after_commit`.

**God class.** `pyctl/laravel/worker_base.py` (1263 lines, 51 methods) mixes:
- registration
- diff/full pull
- claim/accept/release
- local queue order
- cache priority
- result delivery
- the circuit breaker

### 3.2 Speech / AI stack

**Fifteen TTS engine modules repeat the same function set** (`available`, `disabled_reason`, `base_url`, `last_synth_error`, `is_model_loaded`, `unload_model`). `TTSEngineAdapter` (`tts/engine_registry.py:78-186`) reads them via `getattr`.
- melotts and voxcpm2 are line-for-line copies: `_extract_error` (`melotts_engine.py:104`, `voxcpm2_engine.py:122`), plus `_post_bytes`.
- `qwen/standalone_service.py:326 _json_error` and `qwen/client.py:656 _error_message` are further copies of `_extract_error`.
- chattts, cosyvoice, f5tts, fishspeech and gptsovits each build their own 30 s THREAD_BUS TTL health cache. `tts_service_manager._http_healthy:627` probes the manifest `health_paths` separately.
- There are two `base_url` conventions (`*_URL` vs `*_HOST`+`*_PORT`).
- `_ref_audio` is copied 3 times (`cosyvoice:83`, `f5tts:48`, `gptsovits:53`).

**Four HTTP stacks reach local servers:**
- raw urllib (melotts, voxcpm2, `llm/llm_engines.py:74,201`)
- requests + `http_progress_client`
- `HttpClient` (qwen only)
- a fourth error decoder

**Eight hand-written OpenAI-compatible clients** (groq, mistral, cerebras, nvidia, huggingface, zhipuai, github, `ai_chat._chat_openai:180`), although the `PROVIDERS[...]["client"] == "openai_compat"` dispatch exists.
- `ai_probe.py:236-465` has about 12 copy-paste `_probe_*` functions.
- `ai_chat.py:237-345` has the matching `_chat_*` functions.
- `DeepSeekClient` has no callers.

**Seven `pyctl/ai` state modules** repeat `_state_dir`/`_load_index`/`_save_index`/`_trim`/list/delete/clear, byte-identical except for the log tag:
- `translate_history:30-131`
- `image_search_history:42-170`
- `speech_history:62-318`
- `ai_image_history:70-304`
- `ai_text_log`
- `ai_usage_log`
- `ai_rate_limits`

`_migrate_old_state` is copied 3 times. None of the modules uses `atomic_json_store`.

**Two probe record streams:** `ai_usage_log` (kind `probe`, written by `ai_probe.py:621`) and `ai_hub/probe_history.AiHubHistoryStore`.

**Engine selection helpers duplicated across four domains** (`llm_orchestrator.py:37-47`, `tts_status.py:47-87`, `stt_orchestrator.py:216-226`, `ocr_orchestrator.py:94-110`):
- `engine_available` / `best_engine`
- `_dist_version` ×4 (`tts_status:40`, `stt_orchestrator:130`, `ocr_orchestrator:81`, `pyctl/capabilities.py:62`)
- `_spec_available` ×3 (`ocr_orchestrator:72`, `capabilities:53`, `tts_engine_probe.py:66`), which duplicates `common/model_checks.module_present`

**Four status payload builders** emit the same shape: `tts_status._build_engine_status`, `stt_orchestrator._build_stt_status:240`, `llm_orchestrator.llm_status`, `ocr._build_ocr_status`. OCR does not use `EngineRegistry`, and `pyctl/capabilities._tts_engine_available` is a fifth TTS availability view.

**Two TTS readiness rule sets:** `tts_engine_probe.py` (`engine_installed`/`engine_unavailable_reason`) and `tts_boot_checks.py` (`_TTS_CHECKS`). The constants `_AZURE_SPEECH_PACKAGE`, `_AZURE_SPEECH_SECRETS` and `_OFFLINE_TTS_PREREQUISITE` are duplicated between them.

**Lane auto toggles.** `pyctl/tts/word_tts_auto.py` and `sentence_audio_auto.py` share one skeleton. `word_tts_auto` also imports `AUTO_TTS_CONCURRENCY_KEY` from the sentence module.

**Settings/action handlers.** `pyctl/tts/status_service.py:179-252` and `pyutils/llm/status_service.py:49-102` have the same `get_settings`/`post_settings`/`post_server_action`, yet sit in different layers.

**`tts_install_assets/*_api_server.py` duplicate helpers:**
- `_resolve_device` ×5 (melotts:70, voxcpm2:70, f5tts:47, chattts:117, qwen3tts:273)
- WAV/MP3 encoding ×5
- the `/health`, `/`, `/load` and `main()` pattern

`tts_server_common.py` only holds bootstrap and GPU-fraction code.

**Batch.** `tts/batch/chattts_batch` and `gptsovits_batch` share `_post_merged_wav`/`_synthesize_group`/`synthesize_words`. `parler_batch` shares `synthesize_words`. These files also reach into private engine members.

**STT:**
- `stt_orchestrator._transcribe_azure:352` re-implements `AzureSpeechRecognitionProvider` but skips quota marking.
- Whisper models are loaded in three places: `stt_orchestrator`, `whisper_provider` and `media_processing/subtitle_engine`.
- `pyctl/stt/test_service.py` is dead; `probe_service.py` is the live one and calls the private `sherpa_engine._get_tts()`.

**OCR:** there are three stacks. `ocr_processor.py` and `screenshot_processor.py` look dead, and `paddle_ocr.py` is dead.

**Three VRAM readers:** `chattts_api_server._free_vram_mb:87`, `qwen3tts_gpu.query_gpu_snapshot`, and `memory_gate.free_vram_bytes`.

### 3.3 Foundations / config / UI / misc

**Three `GlobalConfig` classes:**
- `pyutils/common/global_config.py` is dead.
- `pyctl/runtime/global_config.py:28` is the live one.
- `launcher/device_sync/core/config.py:51` belongs to device_sync and has a `get_global_config()` accessor at `:397`.

**Paths:**
- `app_config_path.py` re-implements `system_paths.get_system_cache_dir`/`get_app_config_dir` (`:283`, `:336`).
- `pygvar.py` aliases:
  - `ROOT_DIR` = `PROJECT_ROOT` = `PYCORE_ROOT_DIR`
  - `GLOBAL_VAR_DIR` (`:134`) = `GLOBAL_VARS_DIR` (`:164`)
  - `CACHE_DIR` vs `APP_CACHE_DIR`
  - `TMP_DIR` vs `APP_TEMP_DIR`

**Three task models:**
- `pyfoundations/tasks.py:31-50` (with the accessor `get_global_task_queue()` at `:372`)
- `pyctl/desktop/task_manager.py:36-52`
- `common/zip_task_queue.py:22`

**Two shortcut managers:** `pyfoundations/shortcut_manager.py` and `pyutils/desktop/shortcut_manager.py` (569 lines).

**Port helpers.** Kill-by-port exists three times: `common/port_utils.py:101`, `native_ui/step9_frontend/port_killer.py:17-179`, `flutter_dev_tools/utils/port_manager.py:55-353`. `wait_for_port_release` exists twice, and `is_port_available` duplicates `is_port_in_use`.

**native_ui type duplicates:**
- `WindowState`: `step1_config/config.py:25`, `step5_main_ui/pyside6/config.py:14`, and an unrelated class at `pyside6/window_state.py:26`
- `TrayBackend`: `platform_adapter.py:66` and `tray_config.py:47`
- `TrayMenuItem`: `tray_config.py:56` and `tkinter_system_tray.py:86`
- `create_default_tray_menu`: three copies

**Provider seams.** `pyfoundations/service_launcher_provider.py` and `app_launcher.py:25-49` repeat the same pattern. `pylauncher/app_executable_launcher.py:196` uses an accessor.

**`AppFinder()` is built three times**, at `launcher.py:124`, `window_launcher.py:401` and `menu.py:43`.

**`__init__.py` rule violations:**
- `database/__init__.py` (PEP 562 lazy `__getattr__`)
- `native_ui/step7_managers/__init__.py` (stale `__all__`)

**Lazy-import shim.** `database/exports.py:20-66` wraps imports in try/ImportError with None placeholders.

**God modules:**
- `pyfoundations/system_paths.py` (1045 lines): agent paths at `:63-210`, disk probing at `:561-830`
- `pyutils/launcher/app_finder.py` (1025 lines): static tables at `:30-330`, Chrome logic at `:732-946`
- `pyctl/audio_orchestration/orch_service.py` (1092) and `orch_generate.py` (1083)
- `agent_history_service.py` (974)
- `isolated_venv.py` (950)
- `pyutils/laravel/delivery_outbox.py` (1514)

## 4. Suspected Dead Code (deletion requires user approval)

**Verified to have no importers:**
- `pyutils/mcp/**` (about 3500 lines; it appears only as strings in `scripts/fixes/*`)
- `pyutils/launcher/device_sync/**` (about 4000 lines; reachable only through its own `__main__`/.bat; `launcher.py:76` keeps a no-op stub)
- `pyutils/common/global_config.py`
- `pyctl/stt/test_service.py`
- `pyctl/translation/worker/base_laravel_worker.py`

**Reported dead by the reviewer, not individually re-verified:**
- `pyutils/video_stream/**`
- `translator/romanization.py`, `phonetic.py`
- `window/unified_detector.py`, `integrated_analyzer.py`
- `image_tools/icon_analyzer.py`, `image_enhancer.py`, `png_matcher.py`
- `pyctl/desktop/video_processor.py`
- `pyctl/mcpctl/global_state.py`
- `common/endpoint_scoped_cache.py`, `common/speech_config.py`
- native_ui `step7_managers/file_monitor.py`, `step8_utils/resize_handles.py`, `image_converter.py`, `tkinter/styled_widgets.py`
- `flutter_dev_tools/config/routes_config.py`, `utils/update_to_english.py`
- `ensure_library/quick_test_ffmpeg.py`, `verify_pyside6_fix.py`
- `device/adb_exceptions.py`
- `paddle_ocr.py`, `ocr_processor.py`, `screenshot_processor.py`
- the `DeepSeekClient` class
- `database/example_usage.py`
- `pycore/__main__.py` (points to the missing `py_auto/`)
- non-ASCII notes under `native_ui/`

**Needs a closer check:**
- `pyfoundations/stdio_utils.py`, `speech_queue_ops.py`, `heartbeat/thread.py`
- `control/coordinate_mapper.py`, `clipboard/clipboard_sync.py`, `external_apis/movie_poster_client.py`
- several database models (these may be loaded through the table registry)

About 50 `if __name__ == "__main__"` demo blocks remain inside library modules.

## 5. Refactor Plan (ordered by risk)

### Phase 1 — low-risk mechanical
- Delete the dead code after approval.
- Move `codesync/textnorm.py` to pyfoundations.
- Add one `utc_now_iso()` in pyfoundations.
- Add `database/adapters/sqlite_local.open_wal_connection()`, which owns `SQLITE_BUSY_TIMEOUT_MS`.
- Use `atomic_json_store` for every atomic write.
- Add one LAN-IP probe in pyfoundations.
- Add a `RunningFlagMixin` in `serialized_worker`.
- Remove the dead hooks and `_ThreadBusProxy` from `codesync/runtime.py`.
- `pyservice_cli` delegates its codesync subcommands to `codesync.cli`.

### Phase 2 — medium
- Add `JsonIndexStore` in `pyutils/common` for the seven `pyctl/ai` state modules and the ai_hub history.
- Replace the eight OpenAI-compatible clients with `openai_compat` entries in `ai_keys.PROVIDERS`.
- Add `EngineRegistry.available()/best()`, `model_checks.dist_version()` and a shared `build_engine_panel()`. Move OCR onto `EngineRegistry`.
- Add `LaneAutoConfig` in `pyctl/tts`.
- Add `ManagedServiceFacade` settings/actions, and move the LLM status service to pyctl.
- Make `backoff_wait` the only backoff (with `reset()`/`next_delay()`).
- Finish endpoint centralization and remove the stale v1 relay contract block.
- Extend `tts_server_common`, and add `merged_http_batch` to `batch_common`.

### Phase 3 — high-risk (live traffic)
- Make `laravel_endpoint_manager.resolve()` the only Laravel URL authority, behind one HTTP session provider.
- Split `worker_base` into registration / puller / claim ledger / local order / `WorkerResultChannel`.
- Add a TTS `HttpServerEngine` base, with the manifest `ModelEntry` as the only readiness source.
- Set a retirement window for the relay V2 durable lane and its heartbeat.
- Route the STT Azure and Whisper paths through one provider each.

### Phase 4 — separate sweeps
- try/except
- `get_*()` → module instances
- the `__init__.py` fixes
- the remaining threading violations and the pyheartbeat/pythreadpool cycle
- splitting the god modules

## 6. Spec Gaps (`development-guides/PYTHON_PYCORE.md`)

1. **The layer table does not match the tree.**
   - `pygvar` is listed as second layer, but it lives at `pyfoundations/pygvar.py`.
   - `pythreadpool` is missing, and it forms a cycle with `pyheartbeat`.
   - `pyapps` lives at the repo root, not under pycore.
2. **§6 Heartbeat is outdated.** The required `pyfoundations/heartbeat/registry.py` does not exist; the real scheduler is `pyheartbeat/heartbeat.py`.
3. **The try/except rule contradicts itself and is unenforceable.**
   - "FORBIDDEN" is immediately followed by "unless absolutely necessary".
   - "report errors with ColorPrint, not raise" conflicts with "let it propagate".
   - There are 2166 try blocks in practice.
   - Proposal: define the allowed boundaries (external I/O, third-party calls, subprocess, HTTP handler top level), require context logging, and forbid `except: pass`.
4. **Is `pyutils` → `database` allowed?** The two are the same layer, and outbox/operation services need persistence. Either allow it explicitly or require pyctl to inject repositories.
5. **The singleton rule has no exception clause** for heavy lazy initialization or parameterized instances (for example `get_peer_config(port)`). The role of `SerializedSingletonProvider` is undefined.
6. **The threading rule is incomplete.**
   - `threading.get_ident`, per-thread HTTP connection ownership and asyncio are not covered.
   - The exemption covers only `tts_install_assets`; stdlib-only bootstraps (`codesync_boot.py`, `notebook_boot.py`) need the same exemption.
7. **There is no canonical-primitives table**: time, atomic write, backoff, HTTP client, SQLite connection, LAN IP, endpoint resolution and JSON index store, each with one mandated implementation. Its absence is the direct cause of the duplication in §3.
8. **There is no endpoint rule.** Laravel paths should come only from `config/*_contract.json`, with no literals in code.
9. **There is no compatibility-shim lifecycle rule.** Re-exports, alias routes and legacy flags need a removal condition or deadline.
10. **There is no dead/demo code rule**: no `__main__` demo blocks in library modules, one-off scripts belong in `scripts/`, and no non-ASCII note files in pycore.
11. **Naming:** callmodule is described as "RPC v2" routing; the `rpc_v2` package name is itself a version-number legacy.
