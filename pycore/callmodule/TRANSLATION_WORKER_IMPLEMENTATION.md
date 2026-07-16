# Translation Worker — Laravel worker-task pipeline

A pycore PyHeartbeat worker that pulls `remote_translation` tasks from the Laravel
backend, translates words with pycore's existing async `GoogleTranslator`, and
posts results back. Follows the same shape as the TTS queue poller
(`TTS_HEARTBEAT_IMPLEMENTATION.md`): a singleton service registered as a heartbeat
callback, toggled via the heartbeat management router.

---

## Shared contract (frontend ⇄ Laravel ⇄ this worker)

Laravel exposes (localhost, no auth), base URL `http://127.0.0.1:9000` by default:

| Method | Path | Body / Query |
| ------ | ---- | ------------ |
| POST | `/api/worker/register` | `{ worker_id, worker_name, processor_types:["remote_translation"], hostname, platform }` |
| POST | `/api/worker/heartbeat` | `{ worker_id }` |
| GET  | `/api/worker/tasks/pull` | `?worker_id=...` → `{ tasks:[ { task_id, app_name, task_type, execution_type, payload, timeout_seconds, priority } ] }` |
| POST | `/api/worker/tasks/result` | `{ task_id, worker_id, status:"completed"\|"failed", progress?, result?, error? }` |

**Translation task:**
`task_type="word_translation"`, `execution_type="remote_translation"`,
`payload = { words:[string], language:<source e.g. "en">, target_language:<e.g. "zh">, word_count:int }`.

**Success result (what this worker posts):**
```json
{ "translations": [ {"word": "...", "translation": "..."} ],
  "target_language": "zh",
  "provider": "google" }
```
with `status:"completed"`. Each `payload.words` entry is translated to
`payload.target_language`; the source language is auto-detected (`src="auto"`).
On per-task failure the worker posts `status:"failed"` with `error`.

> Backend / FE agents must keep these field names and the `provider:"google"`
> value in sync.

---

## Files

| Layer | File | Role |
| ----- | ---- | ---- |
| Service | `services/translation_worker_service.py` | `TranslationWorkerService` singleton + `get_translation_worker_service()`; `BingSeleniumTranslator` scaffold |
| Service export | `services/__init__.py` | exports the service + accessor + Bing scaffold |
| Config | `callmodule_config/config.py` | `LARAVEL_WORKER_API_URL`, `TRANSLATION_WORKER_INTERVAL`, `TRANSLATION_WORKER_ENABLED_ON_START` |
| Wiring (active path) | `event_handlers.py` → `_register_heartbeat_workers()` | registers the callback after `launcher.start()` (heartbeat running) on the `pycore_module_caller.py` path |
| Wiring (native_ui path) | `callmodule_main.py` → `_register_translation_worker()` | same registration for the `callmodule_main` entry |
| Router (existing) | `routers/management/heartbeat_router.py` | enable/disable/stats — now also mounted on the active launcher router list (`config.py`) |
| Reused | `pyutils/translator/google_translator.py` | async `GoogleTranslator` (translate_batch + on-disk cache) — NOT reimplemented |

Import layering respected: the service imports only `pyfoundations` (ColorPrint,
third_party `requests`), `pyutils` (GoogleTranslator) and `pyctl`
(`task_manager`) — all below `callmodule`. It never imports rpc_v2 or routers.

---

## Worker loop

`poll_once()` is the heartbeat callback (interval `TRANSLATION_WORKER_INTERVAL`,
default 12s). It stays light and never blocks the 1s heartbeat thread:

1. Ensure registration with Laravel (`/api/worker/register`); retried each tick
   until it succeeds (Laravel may be down at start). Stable hostname-based
   `worker_id` (`pycore-translate-<hostname>`). **Multi-instance:** when running
   more than one pycore on the same host, set `PYCORE_WORKER_INSTANCE` to a
   stable per-instance tag (e.g. the rpc port) — it is appended to the id
   (`pycore-translate-<hostname>-<tag>`) so Laravel's per-worker accounting
   (claims, heartbeats, counters) stays correct per process.
2. Send `/api/worker/heartbeat`.
3. GET `/api/worker/tasks/pull?worker_id=...`.
4. **Every pulled task is dispatched** to a background thread via the pyctl
   desktop `TaskManager` (`get_task_manager().execute_task`, like
   `VideoExtractController`) — a pulled task is already atomically CLAIMED, so
   skipping one would strand it in `assigned` until Laravel's timeout release.
   The background job:
   - rejects tasks with an unsupported `task_type` (anything other than
     `word_translation`) by POSTing `failed` with a clear error, so the task
     re-routes to its real consumer instead of leaking;
   - normalizes `payload.words` (`_normalize_words`): plain strings per the
     contract, but dict entries (`{"word": …}` / `{"content": …}`) from other
     producers on the same substrate are tolerated by extracting the word field
     (this used to crash with `'dict' object has no attribute 'strip'`);
   - translates → `payload.target_language` with
     `GoogleTranslator.translate_batch` (auto source), builds `translations`,
     and POSTs `/api/worker/tasks/result`.
5. **Result POST is retried** (3 attempts, 0.5s/1.5s backoff) on connection
   errors and HTTP 5xx — a transient backend error (e.g. SQLite "database is
   locked" surfacing as 500) no longer loses the result. 4xx is not retried;
   409 means the task was reassigned (another worker owns it now). If all
   attempts fail, Laravel's `GlobalTaskMaintenanceTask` timer releases the task
   back to `pending` at `timeout_at` and another worker re-claims it.

All logging uses `ColorPrint`; `requests` is obtained via
`get_third_package_requests()`.

---

## Config key for the Laravel base URL

`Config.LARAVEL_WORKER_API_URL` in `callmodule_config/config.py`, env-overridable
with `LARAVEL_WORKER_API_URL` (default `http://127.0.0.1:9000`). Related env keys:
`TRANSLATION_WORKER_INTERVAL` (default 12), `TRANSLATION_WORKER_ENABLED_ON_START`
(default `1`).

---

## Enable / disable (default ENABLED)

Registered **enabled on start** so the pipeline runs out of the box. Toggle at
runtime via the heartbeat management router (callback name `translation_worker`):

```bash
curl -X POST http://localhost:59000/api/heartbeat/disable/translation_worker
curl -X POST http://localhost:59000/api/heartbeat/enable/translation_worker
curl      http://localhost:59000/api/heartbeat/status/translation_worker
```

Set `TRANSLATION_WORKER_ENABLED_ON_START=0` to start it paused instead.

---

## Bing via Selenium (documented provider — TODO)

`BingSeleniumTranslator` in `translation_worker_service.py` is a **scaffold only**:
the intended `translate(text, target)` interface with a NOT-IMPLEMENTED body that
raises `"Bing via Selenium — TODO"`. Google stays the active default
(`provider="google"`).

Why a browser: Bing Translator has no stable token-less REST endpoint; its web
client mints a short-lived per-session token. Driving a headless Selenium
WebDriver lets the page acquire the token and perform the request; we read the
translated DOM back. **No selenium dependency is added to the active path** —
selenium would be imported lazily only when Bing is selected. Plug-in point:
`TranslationWorkerService._translate_words()` (branch on a provider flag, set the
result `provider` to `"bing"`). See the class docstring for the full approach.

---

## Translation Queue Monitor + control proxy (companion to the worker)

`services/queue_monitor_service.py` — `QueueMonitorService` (singleton). Where the
worker *processes* tasks, the monitor lets the pycore UI **view and steer** Laravel's
translation queue, and lets pycore **perceive qyApp-driven priority changes in real
time** (HTTP polling as the fallback/reconciler; **Phase C pushes the same signal over
WebSocket** — see "Phase C: real-time Reverb WS client" below).

### Shared backend (reuses the worker's discovery)

The monitor does **not** re-implement base-URL discovery. It holds the
`TranslationWorkerService` singleton and reads its **current** `api_url` live on
every call, so monitor + worker always talk to the same Laravel
(`Config.LARAVEL_WORKER_API_URL`, candidate list incl. `http://127.0.0.1:9000`).
A worker reconnect is reflected in the monitor immediately.

### Laravel queue API (server-side, mirrors `/api/worker/*`, no user token)

| Method | Path | Body / Query |
| ------ | ---- | ------------ |
| GET  | `/api/app_qy_v1/ai_tools/translation/queue/list` | `?status=pending&limit=100` → `{ summary:{pending,processing,completed,failed,total}, items:[ {task_id, words, word_count, language, target_language, priority, status, created_at, age_seconds, assigned_to} ] }` |
| POST | `/api/app_qy_v1/ai_tools/translation/queue/priority` | `{ task_id, priority }` |
| POST | `/api/app_qy_v1/ai_tools/translation/queue/stack` | `{ words, language, target_language, priority? }` |

Both wrapped (`{ success, data:{...} }`) and bare (`{ summary, items }`) list shapes
are accepted (same tolerance as the worker's pull).

### Monitor loop (PyHeartbeat callback `translation_queue_monitor`, ~5s, ENABLED by default)

`poll_once()` is light + **exception-safe** (never raises into the heartbeat thread):
GET the queue list → cache the snapshot → run **priority-bump detection**.

- **Bump detection:** each task's `priority` is diffed against the previous snapshot.
  A task whose priority **increased** is flagged `recently_bumped` for a TTL
  (`Config.TRANSLATION_QUEUE_BUMP_TTL_SECONDS`, default **30s**) and a concise line is
  logged — `queue: task A priority 0->100`. No bump on first-sight; lowering priority
  does not flag. Expired flags (and flags for tasks no longer queued) are pruned.
- **Quiet when unreachable:** one concise notice (e.g. queue routes not yet deployed),
  then silence until it recovers — same style as the worker.

### rpc_v2 routes — `routers/local/translation_queue_router.py` (prefix `/api/local/translation/queue`)

| Method | Path | Returns |
| ------ | ---- | ------- |
| GET  | `` (`?refresh=1`) | cached snapshot: `{ summary, items:[ {…, recently_bumped:bool} ], laravel_reachable:bool, age_ms:float }`. `refresh=1` forces a fresh poll first. |
| POST | `/priority` | `{ task_id, priority }` → proxied to Laravel; envelope `{ success, status, data }`. |
| POST | `/stack` | `{ words, language, target_language, priority? }` → proxied to Laravel; same envelope. |
| GET  | `/tasks/{task_id}` | Proxy Laravel `GET /api/task/{taskId}/status` (falls back to `/detail` on miss). Envelope: `{ success, task?, error?, laravel_reachable }`. |

Verify (always hit the **pycore proxy** — it uses the UI-selected Laravel base from
`LaravelEndpointManager`, which may differ from bare `http://127.0.0.1:9000`):

```bash
curl "http://localhost:59000/api/local/translation/queue/tasks/task_<uuid>"
curl "http://localhost:59000/api/local/task-center/tasks/task_<uuid>/detail"
curl "http://localhost:59000/api/heartbeat/status/translation_queue_monitor"
# -> includes base_url + laravel_reachable
```

Wired into `config.py` (active launcher) + `callmodule_main.py` (native_ui path) +
`routers/local/__init__.py`, following the `ai_probe_router` / `video_extract_router`
pattern. The router does no networking itself — it delegates to the service singleton.

### Enable / disable (default ENABLED)

```bash
curl -X POST http://localhost:59000/api/heartbeat/disable/translation_queue_monitor
curl -X POST http://localhost:59000/api/heartbeat/enable/translation_queue_monitor
curl      http://localhost:59000/api/heartbeat/status/translation_queue_monitor
```

Set `TRANSLATION_QUEUE_MONITOR_ENABLED_ON_START=0` to start it paused;
`TRANSLATION_QUEUE_MONITOR_INTERVAL` (default 5) and
`TRANSLATION_QUEUE_BUMP_TTL_SECONDS` (default 30) are env-overridable.

### Priority-sync (how bumped words get processed first)

Two complementary parts, **no duplicated task processing**:
1. **Laravel orders the worker's pull** by `priority desc`, so a bumped task is handed
   to the worker before lower-priority tasks on the next pull (`_pull_tasks()` relies on
   that order and does not re-sort locally — see the note in its docstring).
2. **The monitor surfaces the bump to the UI** (`recently_bumped`) in real time.

### Import layering

`queue_monitor_service.py` imports only `pyfoundations` (ColorPrint, third_party
`requests`) and the **sibling** `translation_worker_service` (same layer). It never
imports rpc_v2 or callmodule routers (no upward layer import).

---

## Phase C: real-time Reverb WS client (replaces the 5s poll as the primary signal)

`services/translation_ws_client_service.py` — `TranslationWsClient` (singleton).
A **WebSocket client** that connects to Laravel's **Reverb** server (Pusher
protocol over WS) and receives translation-queue events in **real time**, so the
UI reflects queue changes instantly and multiple pycores skip already-translated
words. The queue monitor's HTTP poll is **kept** as the slower fallback/reconciler
(the safety net if the WS drops) — it is no longer the primary path.

### Which WS library (rpc_v2's) and how it is reused

pycore's **rpc_v2 WS server** (`/rpc/ws`, the FE live-log channel) runs on FastAPI
+ `uvicorn[standard]`, whose WebSocket layer is the third-party **`websockets`**
package. `websockets` is declared in `pyfoundations/third_party.py`'s
`DEPENDENCY_MAP` (`"websockets": "websockets"`) and accessed via
`get_third_package_websockets()`. The WS client **reuses that exact dependency** as
the **client transport**, using its **synchronous client API**
(`websockets.sync.client.connect`) so the recv loop runs on a plain background
thread (no asyncio loop), matching the worker/monitor threading model.

### Reverb connection (from Laravel `REVERB_*`)

| Reverb env | pycore config (env-overridable) | default |
| ---------- | ------------------------------- | ------- |
| `REVERB_HOST` | `TRANSLATION_REVERB_HOST` | `127.0.0.1` (dial; `0.0.0.0` is mapped to loopback) |
| `REVERB_PORT` | `TRANSLATION_REVERB_PORT` | `8080` |
| `REVERB_SCHEME` | `TRANSLATION_REVERB_SCHEME` | `http` → WS scheme `ws` (`https`→`wss`) |
| `REVERB_APP_KEY` | `TRANSLATION_REVERB_APP_KEY` | last-seen dev key (**rotates on reverb restart — keep in sync**) |
| (channel) | `TRANSLATION_REVERB_CHANNEL` | `translation-queue` (public) |

WS URL form: `ws://<host>:<port>/app/<app_key>?protocol=7&client=pycore&version=1.0`.

### Pusher handshake + subscribe flow

1. Connect to the URL above.
2. Receive `pusher:connection_established` (its `data` is a JSON **string**).
3. Send `{"event":"pusher:subscribe","data":{"channel":"translation-queue"}}`
   (public channel → no auth signature).
4. Receive `pusher_internal:subscription_succeeded`, then channel events.
5. Reply to `pusher:ping` with `pusher:pong` to keep the link alive.

Each frame is JSON `{ event, data, channel? }` where **`data` is itself a JSON
string** (parsed again). Laravel may namespace events (`App\Events\TaskQueued`),
so matching collapses the name to a canonical token (strip PHP namespace, drop
`.`/`_`, lowercase) → `task.queued` / `App\Events\TaskQueued` / `TaskQueued` all
match `taskqueued`.

### Event handlers (4) → where each wires

| Event | Handler | Effect |
| ----- | ------- | ------ |
| `task.queued` `{task_id, words[], language, target_language, priority}` | `QueueMonitorService.apply_task_queued` | insert/update the task in the cached snapshot **instantly** (+ bump-detection) |
| `task.priority` `{task_id, priority}` | `QueueMonitorService.apply_task_priority` | update priority live; a rise is flagged `recently_bumped` (reuses bump logic) |
| `word.translated` `{word, language, target_language, translation, provider}` | `TranslationWorkerService.mark_words_done` | **word-level coordination** (below) |
| `task.completed` `{task_id, target_language, word_count}` | `QueueMonitorService.apply_task_completed` | mark the task completed in the snapshot |

### Word-level coordination — "if one pycore succeeds, others skip"

Two layers de-duplicate work across **N pycores**:

1. **Laravel atomic task claim** — `/api/worker/tasks/pull` hands a task to exactly
   one worker, so two workers never take the **same task** (primary guarantee).
2. **WS word-completion broadcast** — the same **word** may appear in **different
   tasks** on **different pycores**. On `word.translated`, the WS client calls
   `mark_words_done([word], src, dst, ttl)`, adding it to the worker's short-TTL
   **done-words set** (keyed by `(source_lang, target_lang, word)`, TTL
   `TRANSLATION_WS_WORD_TTL_SECONDS`, default **120s**). Before translating,
   `_process_task` calls `partition_words(...)` to split a task's words into
   *to-translate* vs *already-done*; already-done words are **skipped** and reported
   in the result as `{"word":..., "translation":"", "already_done": true}` so
   Laravel's write-back stays **idempotent**. The worker also marks **its own**
   just-finished words, so they dedup later tasks on the same instance.

This means **N pycores run safely**: task-level claim prevents duplicate tasks;
word-level broadcast prevents duplicate words across tasks/instances.

### `ws_connected` in the snapshot (additive, backward-compatible)

The WS client reports its live connection status via
`QueueMonitorService.set_ws_connected(bool)`. `GET /api/local/translation/queue`
now includes an **additive** `ws_connected: bool` field (all existing fields
unchanged), so the UI can show whether real-time updates are flowing.

### Threading / supervisor + enable / disable (default ENABLED)

The recv loop runs on a **dedicated daemon thread** with **auto-reconnect** and
**quiet-retry** logging (one `connected` / `disconnected` / `unreachable` line, not
a stack every retry). The PyHeartbeat callback `translation_ws_client` is a **light
supervisor** (`supervise`, interval `TRANSLATION_WS_SUPERVISOR_INTERVAL`, ~5s) that
only ensures the thread is alive — it does **no network I/O** on the heartbeat
thread. Toggle at runtime:

```bash
curl -X POST http://localhost:59000/api/heartbeat/disable/translation_ws_client
curl -X POST http://localhost:59000/api/heartbeat/enable/translation_ws_client
curl      http://localhost:59000/api/heartbeat/status/translation_ws_client
```

Set `TRANSLATION_WS_ENABLED_ON_START=0` to start it paused.

### Files (Phase C)

| Layer | File | Role |
| ----- | ---- | ---- |
| Service | `services/translation_ws_client_service.py` | `TranslationWsClient` singleton + `get_translation_ws_client()` |
| Service export | `services/__init__.py` | exports the client + accessor |
| Service (extended) | `services/translation_worker_service.py` | `mark_words_done` / `partition_words` / `done_words_count` + skip logic in `_process_task` |
| Service (extended) | `services/queue_monitor_service.py` | `set_ws_connected` + `apply_task_queued/priority/completed` + `ws_connected` snapshot field |
| Config | `callmodule_config/config.py` | `TRANSLATION_REVERB_{HOST,PORT,SCHEME,APP_KEY,CHANNEL}`, `TRANSLATION_WS_ENABLED_ON_START`, `TRANSLATION_WS_SUPERVISOR_INTERVAL`, `TRANSLATION_WS_WORD_TTL_SECONDS` |
| Wiring | `callmodule_main.py` → `_register_translation_ws_client()` | registers the `translation_ws_client` heartbeat callback (ENABLED by default) |

### Import layering

`translation_ws_client_service.py` imports only `pyfoundations` (ColorPrint,
third_party `get_third_package_websockets`) and the **sibling** services
(`queue_monitor_service`, `translation_worker_service`) — same layer. It never
imports rpc_v2 or callmodule routers (no upward layer import). The `websockets`
sync-client symbols are imported lazily inside the recv loop, after
`get_third_package_websockets()` has ensured the package — the pycore convention.

### What `laravel-reverb` must match

- **Port** `8080` (or set `TRANSLATION_REVERB_PORT`).
- **App key** — `TRANSLATION_REVERB_APP_KEY` must equal Laravel's current
  `REVERB_APP_KEY` (it rotates each reverb restart), else the subscribe is refused.
- **Channel** — public `translation-queue`.
- **Events / payloads** — `task.queued` `{task_id, words[], language,
  target_language, priority}`, `task.priority` `{task_id, priority}`,
  `word.translated` `{word, language, target_language, translation, provider}`,
  `task.completed` `{task_id, target_language, word_count}`. Bare or
  `App\Events\*` class-name forms both accepted; `data` sent as a Pusher JSON string.

---

## Task Center aggregate (`/api/local/task-center`)

`routers/local/task_center_router.py` — **one** read-only endpoint that aggregates
pycore's task layers into a single poll, **symmetric with laravel_main's
`GET /api/task-center/overview`** (Octane timer = scheduler layer; global_tasks +
workers = queue layer). pycore's mirror of those two layers:

| laravel_main layer | pycore equivalent | source singleton |
| ------------------ | ----------------- | ---------------- |
| Octane timer (scheduler) | **PyHeartbeat callbacks** | `get_heartbeat_system().get_stats()` |
| global_tasks records | **pyctl TaskManager** (local task records) | `get_task_manager()` |
| queue + workers | **remote-queue view** (pycore's perspective on Laravel's queue) | `get_queue_monitor_service().get_snapshot(refresh=False)` + `get_translation_worker_service().get_status()` |

### Shape — `GET /api/local/task-center`

```jsonc
{
  "scheduler": {                       // PyHeartbeat = pycore's scheduler layer
    "heartbeat": { "total_ticks": 0, "uptime": 0.0, "running": true, /* ... */ },
    "callbacks": [ { "name": "...", "enabled": true, "interval": 5,
                     "run_count": 0, "queue_role": "consumer" } ]
  },
  "local_tasks": {                     // pyctl TaskManager = local task records
    "recent": [ /* up to 20 task dicts (newest first) */ ],
    "counts": { "pending": 0, "processing": 0, "completed": 0, "failed": 0 }
  },
  "remote_queue": {                    // pycore's view of Laravel's global queue
    "laravel_reachable": false, "ws_connected": false,
    "summary": { /* pending/processing/completed/failed/total */ }, "age_ms": 0.0,
    "worker": { "worker_id": "...", "registered": false,
                "inflight_tasks": 0, "done_words_cached": 0 }
  },
  "timestamp": "2026-06-11T00:00:00+00:00"
}
```

### Callback → queue-role map (mirror of laravel_main's `TIMER_QUEUE_ROLES`)

| Heartbeat callback | `queue_role` |
| ------------------ | ------------ |
| `translation_worker` | `consumer` |
| `translation_queue_monitor` | `monitor` |
| `translation_ws_client` | `signal` |
| `tts_queue_poller` | `consumer` |
| (any other callback) | `null` (pure scheduled job, no queue role) |

The router does **no network I/O** — all sections come from in-process singletons
(the remote-queue section reads the monitor's **cached** snapshot, never a forced
refresh). It is the composition layer, not a replacement: detail/control endpoints
stay at `/api/heartbeat/*`, `/voice-subtitle/*`, `/api/local/translation/queue/*`.

### Per-task detail proxies (Laravel global_tasks)

| Method | Path | Laravel upstream | Returns |
| ------ | ---- | ---------------- | ------- |
| GET | `/api/local/translation/queue/tasks/{task_id}` | `GET /api/task/{id}/status` (+ `/detail` fallback) | `{ success, task?, error?, laravel_reachable }` |
| GET | `/api/local/task-center/tasks/{task_id}/detail` | `GET /api/task/{id}/detail` (+ `/status` fallback) | same envelope; may include `bundle` (events + phase) |

Both delegate to `QueueMonitorService` and share `resolve_laravel_base_url()` with
the translation worker — the same base URL the worker uses for pull/result.

Wired into `config.py` + `callmodule_main.py` + `routers/local/__init__.py`,
exactly like `translation_queue_router`.
