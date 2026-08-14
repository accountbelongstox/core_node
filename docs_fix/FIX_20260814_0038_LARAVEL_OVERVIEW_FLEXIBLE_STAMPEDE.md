# Laravel Assist Overview — Cache::flexible Stampede and HTTP Worker Hijack

Date: 2026-08-14 (0038)

Status: Diagnosis complete, verified against vendored Laravel 12.59.0 /
Octane 2.17.3 source (the authoritative behavior definition). NO code changed
yet — this document is the fix list for the executor AI.

Source: runtime log reported by user, `FIX_20260813_LARAVEL_OCTANE_QUEUE_WORKER_STARVATION.md`,
`FIX_20260814_QUEUE_CENTER_PULL_LOOP_CONTENTION.md`, Laravel 12 official
documentation semantics (Octane workers/tasks/tick, `defer()`, cache atomic
locks), and the vendored framework source under `poly_apps/laravel_main/vendor/`.

## Incident

```
[laravel] GET /api/app_qy_v1/assist/overview -> ERR (8147ms)
    HTTPConnectionPool(host='43.163.112.77', port=9000): Read timed out. (read timeout=8)
[QueueCenterCache] overview refresh failed: ... Read timed out. (read timeout=8)
```

Reported behavior (same incident family as the two prior docs): when pycore
connects, WordNew cannot connect; when WordNew connects, pycore always times
out. The earlier pull-loop/SSE contention was already refactored; the overview
endpoint still dies. This document isolates the remaining bottom-layer cause.

## Verified framework mechanics (Laravel 12 / Octane source)

1. `Cache::flexible($key, [$fresh, $stale], $cb)`
   (`vendor/laravel/framework/src/Illuminate/Cache/Repository.php:622-662`):
   - **Miss (or fully expired): `return tap(value($callback), ...)` — the
     callback runs SYNCHRONOUSLY in the caller.** No lock is taken unless the
     optional 4th `$lock` argument is passed (it is not, anywhere in this
     codebase).
   - Fresh window: returns the cached value.
   - Stale window: registers `defer($refresh)`; the refresh is guarded by
     `$store->lock(...)->get($cb)` (one winner), and `putMany` writes with
     TTL `$ttl[1]` (the STALE ttl — 300s here).

2. `defer()` execution points (Laravel 12):
   - HTTP: global middleware `InvokeDeferredCallbacks::terminate()`
     (default global stack, `Configuration/Middleware.php:455`), invoked by
     Octane after EVERY response via `$gateway->terminate(...)`
     (`vendor/laravel/octane/src/Worker.php:104`). The callback runs
     **inside the same HTTP worker, after the response, before that worker
     accepts the next request**.
   - Console: `CommandFinished`; Queue: `JobAttempted`
     (`FoundationServiceProvider.php:211-223`).
   - **Octane tick/task-worker: NEVER.** `Worker::handleTick()`
     (`vendor/laravel/octane/src/Worker.php:165-177`) only dispatches
     `TickReceived`/`TickTerminated` on a sandbox and then `$sandbox->flush()`
     discards the scoped `DeferredCallbackCollection`. A `defer()` registered
     inside a timer task is silently dropped.

3. Octane runtime layout (`scripts/run_runtime.sh`, `config/octane.php`):
   - 4 HTTP workers (`WORKERS=4`), 4 task workers (`task_worker_num=4`).
   - The 1s tick timer lives in the MASTER process and dispatches an
     `octane-tick` task to a task worker
     (`vendor/laravel/octane/src/Swoole/Handlers/OnServerStart.php:40-43`).
     TimerTasks therefore run on task workers, HTTP workers are separate.
   - Swoole default `dispatch_mode=2`: a connection is pinned to one worker.
     The WordNew browser holds keep-alive connections (pinned); pycore opens
     one fresh TCP connection per request
     (`pycore/pyutils/laravel/client.py` — one `requests.Session` per call),
     so each pycore request lands on a pseudo-random worker.
   - Octane cache = Swoole table, `rows=1000`, `bytes=131072`
     (`config/octane.php`, `vendor/laravel/octane/bin/createSwooleCacheTable.php`).
     A serialized value larger than `bytes` makes `Table::set()` fail
     SILENTLY — the cache can never be written (hard cliff, see Risks).

## Root cause derivation

Endpoint chain: `GET /api/app_qy_v1/assist/overview`
→ `AppQyV1AssistController::overview()`
(`app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1AITools/AppQyV1AssistController.php:468`)
→ `AppQyV1AssistOverview::overviewSnapshotFast()`
(`app/Apps/AppQyV1/AppQyV1Services/AppQyV1AssistOverview.php`).

### Bug A — the "fast" path synchronously builds on a cold cache

`overviewSnapshotFast()` docblock claims: "Never blocks on a cold aggregate
build — the Octane timer warms it every 20s." But on a cache miss it calls
`$cache->flexible(KEY, [30, 300], fn () => $this->buildOverviewSnapshot())`
as a "best-effort background warm". Per mechanic (1), a miss executes the
build **synchronously inside the HTTP request** — the exact thing the
docblock says never happens.

### Bug B — the authoritative warmer is a no-op in the stale window

`AppQyV1OverviewWarmTask` (`app/Services/TimerTasks/AppQyV1OverviewWarmTask.php`,
20s interval, task worker) calls `overviewSnapshot(false)` → `flexible`.
In the 30–300s stale window `flexible` only registers `defer($refresh)`,
which per mechanic (2) is **discarded in the tick context**. The warmer only
really rebuilds after full 300s expiry — and by then an HTTP request usually
wins the race and builds synchronously (Bug A).

### Bug C — stale-window deferred rebuild hijacks an HTTP worker

In the 30–300s window every HTTP request returns stale data instantly BUT
schedules the deferred refresh; post-response, the lock winner's worker is
busy for the FULL rebuild duration. Roughly every 30s, one of the four HTTP
workers disappears for B seconds (B = build time).

### Bug D — build cost makes B >= 8s deterministic

`buildOverviewSnapshot()`
(`app/Apps/AppQyV1/AppQyV1Services/AppQyV1AssistQueueMetrics.php`) issues
~300+ SQL statements per build:

- `dictionaryByLanguage()` (line 377) × 3 lanes (word_translation,
  word_media, word_audio) × ~32 per-language tables
  (`config/edge_tts.php lang_code_mapping`) × (`hasTable()` + `COUNT(*)`) ≈ 192
- `sentenceCounts()` (line 409): ~32 × (hasTable + COUNT on
  `has_audio=false`) + per-language samples, plus
  `AppQyV1SentenceAudioService::leasedCount(null)` (line 691) sweeping all
  ~32 sentence tables again ≈ 100+
- ~10 grouped aggregates on `global_tasks` / `assist_requests` / workers /
  covers / posters.

The COUNTs hit non-covering columns (`has_translation`, `has_audio`,
`tts_status`) on per-language tables → PostgreSQL sequential scans. On the
production VPS a full build exceeding pycore's 8s read timeout
(`pycore/pyctl/queue_center/snapshot_service.py`,
`QUEUE_CENTER_REMOTE_TIMEOUT_SECONDS = 8`) is deterministic, not incidental.

### Failure timeline (one full cycle)

- t in [0,30s): cache fresh — all reads fast.
- t in [30s,300s): Bug C — ~every 30s one HTTP worker is hijacked for B s by
  a post-response rebuild; the 20s warmer does nothing (Bug B).
- t >= 300s: cache expired — Bug A — the first requester (and, lacking any
  lock, EVERY concurrent requester on the other workers) rebuilds
  synchronously → up to 4/4 workers busy for B s → total API stall
  (stampede). pycore times out at 8s and retries, feeding the stampede.

### Why the "mutual exclusion" mirage

Swoole pins the browser's keep-alive connections to fixed workers; pycore's
per-request connections roam. Which client starves depends on which worker is
currently hijacked by Bug A/C — pinned WordNew connections die when their
worker is hijacked ("WordNew cannot connect"), roaming pycore requests die
when they land on the hijacked worker ("pycore always times out"). It is
worker-hijack roulette, not a client conflict.

## Risks / secondary findings

- **Octane cache 128 KB cliff**: the serialized overview snapshot is
  currently estimated at 10–30 KB (fits), but if it ever exceeds
  `octane.cache.bytes`, `Table::set()` fails silently and EVERY request
  synchronously builds forever. No guard exists today.
- `/api/queue-center/overview` (`QueueCenterService::stats()`, line 515)
  uses `Cache::remember` on the database store with a 30s TTL — one grouped
  query on miss; acceptable, but shares the same "cheap read" contract and
  must stay synchronous-build-free in the request path.
- pycore `refresh_remote()` fetches 4 slices SEQUENTIALLY with 8s timeouts
  (`QUEUE_CENTER_REMOTE_SLICES`); one poisoned slice costs the whole cycle.

## Fix list (executor AI — bottom-up, per LARAVEL_GUIDE §5: HTTP endpoints
must be cheap; heavy work belongs to Octane task workers)

F1. `app/Apps/AppQyV1/AppQyV1Services/AppQyV1AssistOverview.php`
    `overviewSnapshotFast()`: make it a PURE cache read. On miss/expired,
    return the existing degraded `$empty` shell immediately and DO NOT call
    `flexible` (delete the "best-effort background warm" block). Make the
    code match its own docblock.

F2. `app/Services/TimerTasks/AppQyV1OverviewWarmTask.php` `exec()`: warm by
    DIRECT write, never via `flexible`/`defer`:
    `$cache->put(OVERVIEW_SNAPSHOT_KEY, $service->buildOverviewSnapshot(), OVERVIEW_STALE_TTL)`.
    Keep interval (15–20s) << TTL (300s) so the cache never legitimately
    expires. Add a `duration_ms` log line per warm.

F3. `app/Apps/AppQyV1/AppQyV1Services/AppQyV1AssistQueueMetrics.php`: slim
    `buildOverviewSnapshot()` — collapse the per-language sweeps
    (`dictionaryByLanguage`, `sentenceCounts`, `leasedCount(null)`) into ONE
    `UNION ALL` aggregate per lane (or a maintained counter table), and move
    sample rows to the existing `/overview/items` lazy endpoint. Target:
    build < 1s on production data.

F4. `config/octane.php` / `AppQyV1AssistOverview::overviewCacheStore()`:
    remove the 128 KB silent-failure cliff — either move the snapshot key to
    the database cache store (default `CACHE_STORE=database`), or detect a
    failed `put` (Octane store returns false) and log it. Do both if cheap.

F5. Defense in depth: where `flexible` remains in request-serving code
    (`pendingSnapshot`, etc.), pass the `$lock` parameter or wrap the builder
    in `Cache::lock(...)->block(0, ...)` so a miss can never stampede
    multiple workers.

F6. `pycore/pyctl/queue_center/snapshot_service.py` `refresh_remote()`:
    fetch the 4 `QUEUE_CENTER_REMOTE_SLICES` concurrently (bounded threads)
    so one slow slice cannot consume the whole 32s budget. Do this LAST —
    after F1–F3 the slices should all be sub-second.

## Verification plan (post-fix)

- Warm task log shows `duration_ms` < 1000ms every cycle.
- `[laravel] GET /api/app_qy_v1/assist/overview -> 200` consistently < 200ms,
  including immediately after a cold start (degraded shell) — never an 8s
  read timeout.
- While pycore polls, WordNew UI loads concurrently without stalls (no worker
  hijack); while WordNew polls, pycore slices never time out.
- `Log::info('[QueueCenter] overview accessed', ...)` `cached=true` on all
  non-cold reads; `overview_degraded` appears only before the first warm.
