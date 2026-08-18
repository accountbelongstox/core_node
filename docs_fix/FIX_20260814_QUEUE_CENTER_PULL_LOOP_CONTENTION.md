# Queue Center Mutual Timeout — Pull-Loop Contention Root Cause and Warm-Cache Audit

Date: 2026-08-14

## Scope

Follow-up to `_prompts/队列中心.txt`, `FIX_20260731_QUEUE_CENTER_BLOCKING.md`,
and `FIX_20260802_UI_EXCHANGE_HUB_ARCHITECTURE.md`. Covers pycore / pycore UI /
laravel manager UI / laravel main / wordnew UI.

Symptom under investigation (production logs):

```
GET /api/queue-center/stream -> ERR (60199ms) Read timed out (read timeout=60)
[QueueCenterCache] realtime reconnect: Read timed out
GET /api/app_qy_v1/assist/overview -> ERR (8147ms) Read timed out (read timeout=8)
[QueueCenterCache] overview refresh failed
```

Reported behavior: when pycore connects, wordnew cannot connect; when wordnew
connects, pycore always times out.

## Root cause (bottom layer)

The dominant contention is NOT the pycore snapshot mirror and NOT the session
layer. It is pycore's heartbeat-driven typed pull loop competing for
`global_tasks` row locks and Octane workers.

Evidence chain:

1. `pycore/pyctl/runtime/event_handlers.py:62-66` registers pull callbacks on
   the shared heartbeat:

   ```
   ("translation_worker",   translation_worker_service.pull_once,   5s)
   ("tts_queue_poller",     laravel_word_audio_worker.pull_once,    1s)
   ("tts_sentence_worker",  laravel_sentence_audio_worker.pull_once, 1s)
   ```

2. `pycore/pyctl/laravel/worker_base.py:321 pull_once()` per tick performs
   `GET /api/worker/tasks/{task_type}/pull` plus one
   `POST /api/worker/tasks/{task_type}/accept` per staged task.

3. Laravel side `WorkerController::pullTasks`
   (`app/Http/Controllers/WorkerController.php:187`) claims tasks inside a
   `lockForUpdate` transaction (`TaskManagerService.php:272,294,351,402`), does
   a worker register/heartbeat upsert in the same request, and then runs the
   `pendingSignalsForType` aggregate (`TaskManagerService.php:490`).

4. wordnew's missing-audio bump path runs `lockForUpdate` priority
   transactions on the same `global_tasks` rows (`TaskManagerService.php:619`).

Result: with pycore processing enabled, two lanes pull every 1s and one lane
every 5s, each a locking transaction; wordnew's interactive requests contend
for the same rows and workers. One side being active starves the other — the
observed alternating timeouts.

`FIX_20260802` states "pull/heartbeat/identity loops removed", but the loops
were never removed: documentation/code drift. Under the v3 architecture pycore
must only consume tasks dispatched by the UI pump via
`ui/queue_center/accept_task`.

Migration gap: `poly_apps/pycore_laravel_wordnew_ui/core/tasks/QueuePump.ts:25`
implements only the `sentence_audio` lane (`const QUEUE_KEY = 'sentence_audio'`).
word_audio and word_translation pumps do not exist. Removing pycore pull loops
before adding those pumps would stop word-audio processing entirely.

Secondary facts:

- The `/api/queue-center/stream` line in the logs is a stale pycore `.pyc`
  process. No source reference remains; restart + clear `__pycache__` removes it.
- `/api/app_qy_v1/assist/overview` cold builds are heavy (per-language COUNT
  loops in `AppQyV1AssistQueueMetrics::sentenceCounts/dictionaryByLanguage`) and
  previously ran synchronously on HTTP workers.

## Round-1 changes already applied (this session)

Laravel:

- `AppQyV1AssistOverview.php`: split `buildOverviewSnapshot()`; added
  `overviewSnapshotFast()`; cache store selector.
- `AppQyV1AssistController::overview()`: fast cached path; degraded HTTP 200
  instead of 500.
- New `App/Services/TimerTasks/AppQyV1OverviewWarmTask.php` (20s auto-discovered
  Octane timer task).
- `config/octane.php`: cache row bytes 10000 -> 131072.
- `AppQyV1TranslationStreamController`: `session_write_close()` +
  `DB::disconnect()` in the SSE loop.

pycore:

- `snapshot_service.py`: `request_refresh()` is now a no-op; `get_snapshot()`
  no longer auto-refreshes remote slices and no longer starts the realtime
  thread.
- `event_handlers.py`: removed the `queue_center_snapshot_service.start()` call.

UI:

- `core/api-libs/laravel/LaravelAPI.ts`: added `getAssistOverview()`.
- `apps/pycore-manager/api/PcQueueCenterExchange.ts`: browser now reads Laravel
  directly (assist overview / translation queue / sentence queue) in parallel
  and only takes local worker state from pycore.

## Round-1 audit defects (verified against vendor sources)

A1. Warm task never refreshes (design broken).
`Cache::flexible()` (`vendor/laravel/framework/.../Cache/Repository.php:622`):
missing key -> computes synchronously; fresh window -> returns without
recompute; stale window -> `defer($refresh)`. Deferred callbacks run via the
HTTP kernel's `InvokeDeferredCallbacks` middleware or console command events.
An Octane tick is neither, so the scoped `DeferredCallbackCollection` is
flushed at operation end without invoking. The 20s tick (inside the 30s fresh
TTL) therefore always returns fresh without recomputing; after the 300s stale
TTL expires the key disappears and the next HTTP request blocks on a
synchronous build. Additionally `overviewSnapshotFast()` calls `flexible` as a
"best-effort warm", which blocks synchronously when the key is missing.
Fix direction: timer forces a synchronous rebuild (forget + build + put);
`overviewSnapshotFast()` must not call `flexible` at all.

A2. `overviewCacheStore()` always falls back to the file store.
`Laravel\Octane\Octane` has no `cache()` method (only `table()`); the probe
throws and is swallowed, so the Octane shared-memory store is never used. The
Octane provider already registers the driver via
`OctaneServiceProvider::registerCacheDriver()` (`Cache::extend('octane', ...)`,
Swoole binds the shared cache table). Use `Cache::store('octane')` directly
with a try/catch fallback to file.

A3. SSE `DB::disconnect()` disconnects the wrong connection.
`AppQyV1TranslationEventModel` uses the app connection
(`AppTablePrefixServiceProvider::getConnection(appKey)`), not the default one.
Either disconnect that named connection or drop the forced disconnect
(coroutine `usleep` already yields the worker).

A4. Dead code in pycore violates the no-duplicate-definition rule.
`_QueueCenterRealtimeThread`, `refresh_remote`, `refresh_if_due`,
`replay_realtime_events`, `QUEUE_CENTER_REMOTE_SLICES`, and the
`laravel_client` / websockets imports in `snapshot_service.py` are unreachable;
`event_handlers.py` keeps an unused `queue_center_snapshot_service` import.

Minor regression: the UI exchange no longer fetches
`/api/queue-center/overview`, so sectionContracts lose the
word_audio/sentence_audio queue metrics; `laravelSnapshotAgeS` is now always
null.

## Next-round fix plan (ordered)

1. Timer forces synchronous rebuild; `overviewSnapshotFast()` reads cache only
   (fixes A1).
2. `overviewCacheStore()` -> `Cache::store('octane')` with file fallback
   (fixes A2).
3. SSE: disconnect the model's app connection or remove the forced disconnect
   (fixes A3).
4. Delete pycore dead code and the unused import (fixes A4).
5. Main fix: implement word_audio (and word_translation) UI pumps in
   `core/tasks/`, then remove the pycore heartbeat pull loops so pycore only
   consumes `ui/queue_center/accept_task` dispatches (root cause; requires the
   pump migration first).
6. UI exchange: also fetch `/api/queue-center/overview` to restore queue
   metrics in sectionContracts.

## Laravel 12 official documentation cross-check

Verified against the live official pages (laravel.com/docs/12.x). These quotes
confirm the audit defects and rule out the session-lock hypothesis.

### Cache — `Cache::flexible` (stale-while-revalidate)

> "If a request is made during the stale period, the stale value is served to
> the user, and a deferred function is registered to refresh the cached value
> **after the response is sent to the user**. If a request is made after the
> second value, the cache is considered expired, and the value is
> **recalculated immediately**, which may result in a slower response."

Confirms A1: the stale-window refresh depends on the post-response deferred
mechanism; after the stale TTL the rebuild is synchronous and blocking.

### Helpers — Deferred Functions

> "Deferred functions allow you to defer the execution of a closure until
> after the HTTP response has been sent... by default, deferred functions will
> only be executed if the **HTTP response, Artisan command, or queued job**
> from which defer is invoked completes successfully."

Confirms A1 (second half): an Octane tick is none of the three supported
execution contexts, so the deferred refresh registered by `Cache::flexible`
inside `AppQyV1OverviewWarmTask` never runs.

### Session — Session Blocking

> "**By default, Laravel allows requests using the same session to execute
> concurrently.**" (blocking is opt-in via `->block($lockSeconds, $waitSeconds)`)

Rules out the session-lock hypothesis: Laravel 12 does not serialize
same-session requests by default, and the no-auth worker/control routes strip
`EnsureFrontendRequestsAreStateful`, so no session is even started. The
`session_write_close()` added to the SSE controller is harmless redundancy.
The root cause remains the pull-loop `lockForUpdate` contention on
`global_tasks`.

### Octane — Ticks and Intervals / The Octane Cache / Cache Intervals

> - `Octane::tick('simple-ticker', fn () => ...)->seconds(10)` (Swoole only).
> - "`Cache::store('octane')->put('framework', 'Laravel', 30);` ... powered by
>   Swoole tables. **All data stored in the cache is available to all workers**
>   on the server."
> - "`Cache::store('octane')->interval('random', function () { ... }, seconds: 5);`
>   — these caches are **automatically refreshed at the specified interval**."

Confirms A2 and provides the official best-fit replacement for the warm task:
the Octane **interval cache** auto-refreshes on a registered interval (driven
by the Swoole tick), so the overview snapshot can be registered as an interval
cache in a service provider `boot()` instead of the broken TimerTask +
`flexible` combination. Caveat: interval caches only refresh under the Swoole
runtime, so the non-Octane fallback path must keep a degraded response.

### Responses — `eventStream` / `StreamedEvent`

> `return response()->eventStream(function () { ... yield new StreamedEvent(
> event: 'update', data: ...); });`

The project's `App\Utils\SseStreamResponse::make()` matches the official usage;
no change needed.

### Octane — max_execution_time / worker count

> "By default, Laravel Octane sets a maximum execution time of 30 seconds...
> the maximum number of seconds that an incoming request is allowed to execute
> before being terminated."

The SSE controller's `max_exec - 5` lifetime clamp matches this semantic.
Worker count defaults to CPU cores; `--task-workers` only sizes the
`Octane::concurrently()` pool, unrelated to the HTTP pull contention.

## Round 3 — rescan after the other AI's follow-up (2026-08-14)

### New context: "Queue Center stream failed: HTTP 404"

The other AI deleted `Route::get('stream', ...)` from the
`/api/queue-center` group (and the TaskController stream route). The running
pycore process still executes stale `__pycache__` bytecode that polls the
removed SSE endpoint, so its error changed from "Read timed out" to "HTTP
404". Current source no longer calls `/api/queue-center/stream`; a pycore
restart plus `pycore/**/__pycache__` cleanup resolves the 404.

### What the other AI changed (kept)

- `OctaneTimerService`: per-task `Cache::store('file')->lock('octane_timer:task:...')`
  lease so duplicate timers cannot double-execute a task; schedule tick now
  `->withoutOverlapping()`.
- mcp-chrome `SimpleWorkerBase.ts`: long-poll replaced by immediate pull +
  `max(1s, pollWait ?? 5s)` fallback reconciliation loop.
- pycore `snapshot_service.py`: `_QueueCenterRealtimeThread` rewritten from
  SSE to a shared Reverb WebSocket consumer; queue/priority events now call
  `worker.request_pull()` (coalesced immediate pull via `_pull_guard`);
  `queue_center_snapshot_service.start()` re-enabled in `event_handlers.py`.
- `config/reverb.php`: configurable allowed origins.

### Fixes applied this round (bottom-up, per the ordered list)

1. **A1 fixed** — `AppQyV1AssistOverview::warmOverviewSnapshot()` added:
   synchronous `buildOverviewSnapshot()` + `put()`. `overviewSnapshot(true)`
   delegates to it; `AppQyV1OverviewWarmTask::exec()` calls it instead of
   `Cache::flexible`. `overviewSnapshot(false)` keeps `flexible` (only
   reachable from HTTP requests, where the deferred refresh is valid).
2. **A2 fixed** — `overviewCacheStore()` now probes
   `app()->bound('octane.cacheTable')` and returns `Cache::store('octane')`
   (shared Swoole table) or falls back to the file store. The non-existent
   `Octane::cache()` probe and the unused Octane facade import are gone.
3. **Fast path hardened** — `overviewSnapshotFast()` no longer invokes
   `Cache::flexible` at all; on a cold cache it returns the degraded shell
   and leaves warming to the 20s Octane timer.
4. **A3 superseded** — the other AI removed the translation-stream route
   entirely; the SSE controller is unrouted (inert). No fix needed.
5. **A4 fixed** — pycore `snapshot_service.py` dead mirror code removed:
   `refresh_remote`, `refresh_if_due`, `_normalize_overview/_sentence_queue/
   _translation_queue`, `_claim_refresh/_finish_refresh`,
   `QUEUE_CENTER_REMOTE_SLICES`, `QUEUE_CENTER_REFRESH_SIGNAL`,
   `QUEUE_CENTER_REFRESH_INTERVAL_SECONDS`, and unused imports
   (`start_bus_task`, `Tuple`, `List`). Kept live: the WebSocket realtime
   thread, `/api/queue-center/events` replay (route exists at api.php:367),
   `apply_priority_event`, `_publish_changed`, local-state snapshot.
6. **Main contention reduced** — pycore heartbeat fallback intervals for the
   two audio lanes raised 1s -> 5s (translation already 5s). The fast path
   is event-driven (`request_pull()` on Reverb events), so the fallback only
   matters when realtime is down; this matches the mcp-chrome design the
   other AI adopted. Idle `lockForUpdate` pressure on `global_tasks` drops
   5x without losing responsiveness.
7. **UI queue metrics restored** — `PcQueueCenterExchange.read()` now also
   fetches `laravelApi.getQueueCenterOverview()` in parallel and patches
   `sectionContracts[word_audio|sentence_audio].queue` (QueueCenterControlMetrics
   shape) from the direct Laravel response.

### Design note: why not the Octane interval cache

The official `Cache::store('octane')->interval(...)` auto-refresh only runs
under the Swoole runtime. This project also supports a non-Swoole fallback
(`schedule:work` drives `OctaneTimerService::tick()`), so the warm TimerTask
+ forced rebuild was kept; it works identically on both runtimes.

## Verification boundary

Per project instructions, no tests, builds, services, migrations, or runtime
verification commands were executed. All findings above are static, verified
against vendor/framework source (Cache `flexible`, Octane service provider,
Octane facade) and the project call chain.
