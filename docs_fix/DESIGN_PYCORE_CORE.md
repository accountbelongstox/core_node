# pycore Core Runtime

Scope: the pycore process kernel: layering, RPC kernel and route contract, events, idempotency, HTTP client, keyset lists, status snapshots, startup, persistent workers, restart, repository sync and terminal window control.

Authority: code > config/*_contract.json > this document.

## 1. Binding spec and layering

- `development-guides/PYTHON_PYCORE.md` is the binding spec: code rules, the one-way layer order (pyapps > callmodule > pyctl > pylauncher > pyheartbeat > pythreadpool > pyutils > database > pyfoundations), threading rules and the canonical-primitives table. This document does not restate it; extend a listed primitive, never re-implement it.
- Shared objects are module instances; state lives on THREAD_BUS owner threads (`init_serialized_owner` + `@serialized_method`, `await_bus_task` / `start_bus_task` in `pyfoundations/serialized_worker.py`).
- asyncio exists only in the RPC server loop. The loop never blocks: synchronous route handlers, SQLite, the event journal owner and file I/O run off-loop.
- SQLite connections come from `database/adapters/sqlite_local.py`: WAL and `busy_timeout` 30000 ms (`SQLITE_BUSY_TIMEOUT_MS`).

## 2. RPC kernel

| Part | Owner |
|---|---|
| HTTP server (FastAPI + uvicorn, middleware, protocol routes, `/api/{route_path}` dispatch) | `pyutils/rpc/server.py` `HttpServer` |
| Transport-neutral execution (param decoding, one multipart parser, idempotent dispatch, result encoding, relay execution) | `pyutils/rpc/execution.py` `rpc_execution_kernel` |
| Route table and invocation | `pyutils/rpc/dispatcher.py` `HttpDispatcher` |
| Event socket | `pyutils/rpc/http/ws_event_service.py` |
| Loopback / LAN gate (K7) | `pyutils/common/local_rpc_guard.py`, `pyutils/rpc/http/local_rpc_middleware.py` |
| UI presence leases | `pyutils/rpc/ui_presence.py` |
| Route registrars | `callmodule/rpc_routes/register_http_routes.py` (`HTTP_ROUTE_REGISTRARS`) |

Rules:
- One route table serves local HTTP and the relay (`execute_relay_async`; relay policy per route in `config/pycore_relay_contract.json`, see `DESIGN_RELAY.md`).
- Routes are slash paths below `/api`, methods GET or POST only. Coroutine handlers run on the loop; synchronous handlers run on a THREAD_BUS `RpcRouteThread`. A handler receives `(params, request_id, context)` truncated to its positional arity.
- A route `timeout` wraps the call in `asyncio.wait_for`. Relay execution is bounded by the smallest of contract `execution_timeout_seconds`, the policy timeout and the route timeout.
- Responses: a dict is JSON (`X-Request-ID` always set); `None` is 204; a Response-like object passes through. Errors are `{"success": false, "error": {"code", "message"}, "route", "request_id"}` (`route_not_found` 404, `method_not_allowed` 405, `internal_error` 500).
- Request context carries `transport`, `request_id`, `client_id` (`X-Pycore-Client-ID`), `browser_id` (`X-Pycore-Browser-ID`), `remote_addr`, headers and the request.
- `_HttpProtocolMiddleware` owns request logging for every HTTP scope (routes, routers, static mounts, preflight): a green `[HttpServer] Received METHOD path` line and a gray `METHOD path -> status (ms)` line. It adds `Access-Control-Allow-Private-Network: true` only for an allowed dashboard origin.
- Bind and auth (K7, contract `service_contract.json#client_key_auth.local_rpc`): loopback bind by default; the `rpcLanBind` system setting (`pyservice config system set --key rpcLanBind --value true`) admits LAN binding. A loopback caller needs a loopback `Host` and, for browsers, an allowed origin; a non-loopback caller needs a valid K3 client-key signature. CORS origins come from the contract, never `*`. See `DESIGN_AUTH_IDENTITY.md`.

### Route contract

- `config/pycore_rpc_contract.json` is the single source of `api_prefix` (`/api`), `protocol_routes` (`status`, `info`, `routes`, `client-id`, `ws`), `routes` (typed client key -> `{path, method}`; key = path segments without `ui`, camelCase) and `keyset_page`.
- `pyfoundations/rpc_route_contract.py` (stdlib only) loads it. `pyfoundations/network_constants.py` derives `HTTP_API_PREFIX` and `HTTP_{CLIENT_ID,STATUS,INFO,ROUTES,WS}_PATH`; `callmodule/rpc_routes/route_names.py` derives every RPC path. No path literals in code.
- Boot drift check: `register_http_routes()` runs every registrar, then `report_contract_drift()` compares registered routes (minus protocol paths) with the contract. Any unregistered contract route, uncontracted handler or method mismatch raises `RuntimeError` and fails startup.
- The UI derives its route table and methods from the same JSON (`PycoreHttpRoutes.ts`), so a removed route fails `tsc`. See `DESIGN_UI.md`.

## 3. Events

- One process journal: `pyfoundations/event_journal.py` `event_journal` (THREAD_BUS-owned), built on stdlib-only `pyfoundations/event_records.py` (`EventRecordJournal`, `poll_journal`, `journal_state`). Standalone subprocesses (qwen server) path-load `event_records` and run their own journal.
- Publish from any thread: `publish_topic(topic, payload, audience="*", event_id=...)`, `publish_log` (console-log sink, topic `pycore_log`). Taps (`add_tap`) observe each publish on the publisher thread (the relay forwarder); a tap failure is reported and never blocks publishing. THREAD_BUS events become topics through `HttpServer.register_thread_bus_listener`.
- Records: `{instance_id, event_id, seq, topic, payload, audience, metadata, created_at}`. Retention: at most 5000 records and 3600 s (`SSE_EVENT_JOURNAL_MAX`, `SSE_EVENT_MAX_AGE_SECONDS`). Audience is `*` or `client:<client_id>`.
- Client identity: `POST /api/client-id {browser_id}` returns `{client_id, instance_id}`; the UI keeps one id per browser and sends it on every request.
- The only transport is the WebSocket `/api/ws`. Frames are JSON keyed by `op`:
  - client: first frame `hello {client_id, since_seq, topics, leases}` within 10 s, then `subscribe {topics}`, `lease {name, held}`, `ack {seq}`, `ping`;
  - server: `state` (cursor state incl. `replay_lost`, `cursor_ahead`), `events {records}` (batches of at most 200), `pong`, `error`.
  - Limits: 256 topics, 16 leases, 128-char names; ping 20 s. Leases feed `ui_presence`.
- The loop never waits on the journal owner: views use the `*_async` journal methods; `/api/info` reads `seq` off the loop.
- A server restart (new `instance_id`) or `replay_lost` triggers one bounded reconcile in the client; otherwise clients resume from their persisted cursor.

## 4. Idempotency

- `pyutils/common/idempotent_jobs.py` `IdempotentJobs` is the one mechanism. The RPC surface owns one table, `rpc_jobs = IdempotentJobs("rpc")` in `pyutils/rpc/execution.py`.
- `RpcExecutionKernel.dispatch` runs a call that carries `client_task_id` once per key `client scope | route | client_task_id`. Client scope is `relay:<user_id>:<pairing_id>` or `http:<client_id|browser_id|remote_addr>`.
- Concurrent repeats attach to the in-flight run (900 s attach timeout); later repeats replay the cached success with `idempotent_replay: true`. Failures are not cached. TTL 600 s, at most 1000 entries.
- Each entry stores a SHA-256 fingerprint of the canonical params (upload parts by filename, type and size). A repeat with a different fingerprint returns 409 `client_task_id_payload_mismatch`.

## 5. HTTP client

`pyutils/common/http_client.py` is the only HTTP connection owner in pycore.
- `http_connection_pools` (`HttpConnectionPools`): process-wide httpx pools (64 connections, 32 keep-alive, TCP keepalive socket options), one per proxy policy; loopback always bypasses environment proxies. `HttpClient` instances (`http_client` default) hold defaults only.
- Errors: the `HttpError` family (`HttpConnectError`, `HttpTimeoutError`, `HttpConnectTimeout`, `HttpReadTimeout`, `HttpProtocolError`, `HttpStatusError`); `redacted_http_error` for logs.
- Every request with a body declares its response profile (`response=`; contract `queue_center_contract.json#http_transfer.response_profiles`); a bodied request without one raises `ValueError`:
  - `control` (default for bodiless requests): caller `timeout` seconds or `(connect, read)`, else the client default; a hung server cannot block the caller.
  - `upload`: stall-driven. Connect bound `connect_timeout_seconds` (15), write stall bound `idle_timeout_seconds` (30), unbounded response wait guarded by TCP keepalive. `timeout=(connect, reply)` caps the reply for a peer that must answer within a bound.
  - long response `llm` / `tts` / `image`: small body, long backend computation; read bound is the caller's or `response_wait_seconds` (600 / 900 / 600).
- Upload progress: bodies stream in contract `chunk_bytes` (clamped by `maximum_chunk_bytes`); phases `uploading`, `awaiting_receipt`, `received`, `rejected` reach `progress_callback` and every `transfer_observer()` scope. One `[http upload]` gray line per real upload. `HttpTransferProgress` is the shared stall clock.
- Laravel requests go through `pyutils/laravel/endpoint_manager.py` and `client.py` on top of this client (`DESIGN_LARAVEL_PLATFORM.md`).

## 6. Keyset-cursor lists

- Every pycore list route uses `pyutils/common/keyset_cursor.py`; no offset paging.
- Shape (`pycore_rpc_contract.json#keyset_page`): request `{cursor, limit}`, response `{items, next_cursor, has_more}`; `limit_default` 20, `limit_max` 200; newest first by `(sort_key, row_id)`; `next_cursor` is null on the last page. The contract lists the routes (`queueCenterEventPage`, `taskHistoryGetRecentLocalTasks`, `audioOrchTasksList`, `aiProbeUsage`, `speechHistoryHistory`, `translateHistory`, `imageSearchHistory`, `aiImageImageHistory`, `aiHubHistory`, `subtitleSearchHistory`).
- Cursor: opaque base64url of `[sort_key, row_id]`; an unreadable cursor is reported and served as the first page.
- API: `keyset_request(params)`, `keyset_page(rows, after, limit, key)` for in-memory / JSON-index rows, `keyset_where(after, sort_col, id_col)` + `keyset_result(rows, limit, key)` for SQLite (`ORDER BY sort DESC, id DESC LIMIT limit + 1`).

## 7. Status snapshots and capability single-flight

- `pyutils/common/status_snapshot_cache.py`: `VersionedSnapshotCache` (shared single-flight base) and the `status_snapshot_cache` instance. Defaults: TTL 30 s, load lease 120 s, 256 entries; system resources 1 s; TTS per-engine rows 300 s (`TTS_ENGINE_STATUS_TTL_SECONDS`).
- Single-flight: each load owns a generation, lease, completion signal and waiter count on the cache owner thread. A fresh entry returns at once; an expired entry returns matching stale data while one owner refreshes; cold callers wait only for the remaining lease, after which a new generation may take over; a superseded generation never overwrites the current entry; versioned callers never get another version's snapshot. `get`, `get_many` and `get_background` share these rules; `invalidate` / `invalidate_prefix` drop entries.
- Local status reads return bounded snapshots and never wait behind engine lifecycle work, queue writes, external probes or full-list materialization. Examples: managed-service (TTS) settings are an immutable snapshot read without entering the lifecycle owner (`pyutils/common/managed_service.py`); `ui/voice_subtitle/get_monitor_status` returns clipboard and screenshot monitor state in one read. `ui/user_data/get_system_settings` reads the in-memory user-data map uncached.
- Capability exchange: `ui/capability_status/status` (`capabilityStatusStatus`) is the one UI read; it returns the capability blocks plus `tts`, `stt`, `ocr` and `ai_gateway` from the shared snapshots (`pyctl/desktop/capability_service.get_capability_status`). `local/{tts,stt,ocr,ai}/status` reuse the same snapshots. The UI holds one in-flight request in a shared store.
- Probes: normal reads use installed/known state. `refresh=true` rebuilds snapshots; for TTS it runs health/readiness checks; `gateway_status(refresh=true)` stays local (no provider or quota network calls). Live provider probes belong to `pyctl/ai/probe_service.py` (`aiProbe*` routes; one startup probe cached for the process lifetime). Key, cooldown, TTS settings and TTS server changes invalidate the affected snapshots.

## 8. Startup

- One service entry: `pycore/pycore_module_caller.py`, launched by `pyservice.sh` / `pyservice.ps1` after the shell prerequisite steps. One CLI: `pycore/pyservice_cli.py`.
- Boot order: desktop session env and Xlib auth hook, shared cache env, `console_log_journal.install()` (all output journaled before further imports), provider registration, `build_launcher_config()` (`pyctl/runtime/launcher_composition.py`: warms `user_data_store`, applies the saved language), `ServiceLauncher.start()` (singleton, then `heartbeat`, `rpc`, Windows `ui`, `tray`), `register_event_handlers()`, auto-start launcher self-heal, tray menu update, signal handlers, dev reload watcher.
- RPC init callback: `register_http_routes()` (drift check) then `start_rpc_runtime()` (terminal backup scheduler, Laravel-request and queue-bump bridges into the journal).
- Singleton: `app_id=pycore_module_caller`, ports 59100-59199, `shutdown_existing=True`: a newer instance supersedes the running one. A yielding or superseded instance exits with code 3 so `pyservice` keeps the shared UI dev server running.
- HTTP port `pycore_backend` (59000) from `config/service_contract.json`. Service mode `PYCORE_SERVICE_MODE` / `--service-mode`: `1` local-ui, `2` relay-ui (persisted in `pyservice_mode.json`).
- A missing model never blocks startup; the TTS runtime profile pins on a background task. `--tts-selfcheck` runs the batch self-check synchronously before any service starts.

## 9. Persistent workers

- Scheduler: `pyheartbeat/heartbeat.py` `heartbeat_system`, one 1 s tick thread, interval callbacks via a tick counter, log identity `[Scheduler]`.
- `pyctl/runtime/event_handlers.register_runtime_workers()` is idempotent; each `_run_runtime_step` reports its failure and never blocks the other steps. It registers the queue worker callbacks from the lane registry (`pyctl/queue_center/lane_registry.LANE_REGISTRY`: translation, word audio, sentence audio) disabled, then runs the audio-lane boot chain on a background thread (cache restore first, then `apply_assist_runtime`), the relay agent (relay-ui mode), Queue Center snapshot, audio-lane state, Laravel delivery, agent history, AI startup probe, AI rate reset, persisted system settings and TTS engine startup report.
- Persisted switches decide which callbacks are enabled; processing continues while no UI is open. The UI only toggles switches and binds the endpoint.
- Lane gate (`pyctl/assist/assist_settings.py`): a lane is live only while the stored `assist_laravel.enabled` and its capability are both true; an absent section means OFF, except the notebook default (`PYCORE_ASSIST_DEFAULT_ON=1`, contract `notebook_defaults`) while nothing is stored.
- Workers compose `pyctl/laravel/worker_base.BaseLaravelWorkerService` (typed pull / accept / result against the active `laravel_endpoint_manager` endpoint). Claiming, leases, segments and delivery are specified in `DESIGN_QUEUE_PIPELINE.md`.
- A running task keeps its Laravel lease alive: `pyctl/laravel/worker/handler_worker.py` posts `processing` without a progress field every `lease/3` seconds (clamped 15-120 s) until the task ends, so long tasks are not reassigned into a 409.
- An unreachable Laravel never stops local work: the diff mirror round backs off per endpoint and keeps processing the local mirror (`pyctl/laravel/worker/task_puller.sync_mirror`); an endpoint change bypasses the old endpoint's backoff. Already-claimed tasks submit results to the endpoint they came from.

## 10. Restart model

- Restart = graceful THREAD_BUS shutdown, then process-image replacement. Triggers: the tray (`app.restart` event, built-in handler in `pylauncher/service_starters.py`) and the dev reload watcher both call `THREAD_BUS.request_restart()`.
- After `main()` returns, `pycore_module_caller.py` never unwinds the interpreter (Qt/Tk teardown on the wrong thread): restart calls `pyutils/common/process_restart.restart_current_process()`, otherwise `os._exit(0)` (or 3 when superseded).
- `restart_current_process`: `os.execv` on Linux; on Windows a new process (console inherited when a console exists, detached otherwise) that waits for the parent PID (`PYCORE_RESTART_PARENT_PID`) before singleton initialization. Arguments are preserved, so `--no-reload` survives.
- Dev reload (`pyutils/common/dev_reload.py`, on by default; off with `--no-reload`, `PYCORE_NO_RELOAD=1` or `PYCORE_RELOAD=0`): stdlib mtime polling of pycore `.py` files and shared contract JSON; every changed source is compiled first, and while one has a syntax error the running backend stays up.
- Persisted state (user data, journals on disk, queue segments, endpoint cache) survives; the in-memory event journal does not, which clients detect by `instance_id`.
- Host side (nothing slow before the RPC bind, background service units, tray): `DESIGN_SHELL_HOSTS.md` section 11.

## 11. Repository sync (gitsync)

- Repositories sync with the `gitsync` command: `scripts/linuxenvs/gitsync.sh` and `scripts/winenvs/gitsync.ps1` (also `dd.sh gitsync`, `dd.ps1 gitsync`). One implementation per platform: `scripts/shells/linux/common/git_sync_common.sh` (`git_sync_run`) and `scripts/shells/win/win_common/GitSyncCommon.ps1` (`Invoke-GitSyncRun`).
- Usage: `gitsync [--dry-run] [description...]` (PowerShell `-DryRun`). The description joins into the commit message with spaces turned into `-`; without one, an interactive terminal gets 3 s to start typing it.
- Steps (idempotent, safe to re-run after any interruption):
  1. resolve the repo root without a literal path (`CORE_NODE_PROJECT_ROOT`, `CORE_NODE_ROOT_DIR`, the script location, `git rev-parse`; the root must contain `dd.sh`) and `cd` there;
  2. point `origin` at the `github=` SSH URL from `scripts/git/git_remotes.conf` (never Gitee), only when it differs;
  3. wait for git lock files (`index.lock`, `HEAD.lock`, `ORIG_HEAD.lock`, branch lock); remove one unchanged for 60 s;
  4. stop on an unfinished rebase/cherry-pick/revert or unresolved conflicts; conclude a merge whose conflicts are resolved;
  5. `git add .`; commit only when something is staged, message `<systemname><version>[VM]<YYYY-MM-DD-HH-MM-SS>[-description]` (systemname from `/etc/os-release`, e.g. `debian13`, bare `kali`; version from root `package.json`);
  6. `git pull --no-rebase origin main`; on failure or conflict print the conflicted paths and the next manual step, never push, never auto-resolve, never force;
  7. `git push origin main`.
- `--dry-run` prints every command it would run and executes no git write.
- Code Sync (`pycore/pyutils/codesync`) is retired and frozen; not started by default; not updated.

## 12. Terminal window control

- Platform backend chosen once in `pyutils/window/terminal_platform.py` (`windows_terminal_backend`, `linux_terminal_backend`, otherwise `UnsupportedTerminalBackend`), all on the shared `TerminalWindowBackend` (`pyutils/window/terminal_backend.py`: scroll modes `page_up` / `page_down` / `bottom`, history directions `up` / `down`). Linux X11/Xwayland/GNOME/portal mechanics and terminal backup are in `DESIGN_SHELL_HOSTS.md` sections 11.4 and 12.
- Every focus-sensitive action first resolves the current window and rectangle, raises it (Windows: temporary topmost, restored when pycore set it) and physically clicks it.
- State: `APP_DATA_DIR/terminal_windows/state.sqlite3` (`database/repositories/terminal_state_store.py`), keys `terminal.<n>.*` with a monotonic `next_number`; a terminal keeps its number while its identity (`window_id`, `native_id`, `app`, `class_name`, `process_id`) is live. Drafts and logs (sources `input`, `enter`, `schedule`) are per terminal. Full buffer captures are plain text under `APP_DATA_DIR/tcap`; screenshots are demand-leased (`terminal_screenshot_cache.py`).
- Routes: the contract `terminal*` keys (`ui/terminal/...`; `content` and `screenshot` are GET, `image/upload` is multipart). Native failures return stable error codes the UI maps through i18n.

## 13. Verification

```bash
cd /www/programing/core_node
python -c "import pycore.pycore_module_caller"
python -c "from pycore.pyutils.rpc.server import HttpServer; from pycore.callmodule.rpc_routes.register_http_routes import register_http_routes; s=HttpServer(); register_http_routes(s)"
python -m pycore.pyservice_cli config system get --key rpcLanBind
```

The second command prints the registered route count and raises on contract drift.

## Open items

- `pyutils/common/rpc_route_contract.py` is an unreferenced duplicate of `pyfoundations/rpc_route_contract.py`; delete it.
- `callmodule/rpc_routes/machine_receive_routes.py` and `pyctl/desktop/machine_receive_service.py` are unreferenced; delete them.
- `pyfoundations/event_journal.py` docstring still names SSE views, and the journal retention constants are named `SSE_EVENT_*` in `network_constants.py`; rename to journal terms.
- Response profiles (`control` / `upload` / `llm` / `tts` / `image`) are landing in `http_client.py` and `queue_center_contract.json` (uncommitted at writing); the `http_client` row of `PYTHON_PYCORE.md` still reads "bodies are stall-driven, never a fixed deadline" and may only be updated on user request.
