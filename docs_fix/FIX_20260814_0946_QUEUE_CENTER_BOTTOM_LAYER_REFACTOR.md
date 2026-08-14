# Queue Center Bottom-Layer Refactor — Per-Language UNION ALL Metrics + Snapshot Contract Completion

Date: 2026-08-14 09:46
Status: Applied (code refactor complete; runtime verification pending user-run)

## Relationship to prior documents

- `FIX_20260814_0038_LARAVEL_OVERVIEW_FLEXIBLE_STAMPEDE.md` — the diagnosis (findings F1–F5).
- Round 3 (another AI, recorded in `FIX_20260814_QUEUE_CENTER_PULL_LOOP_CONTENTION.md`) applied F1/F2/F4-probe
  (fast cache read + warm task + octane-store probe) and cleaned the pycore/UI ends.
- **This document is round 4**: the bottom-layer refactor that makes the warm builds cheap (F3),
  completes the snapshot contract for `/assist/pending` + `/assist/status` (F5), and removes the last
  `Cache::flexible` usages from the AppQyV1 HTTP surface.

## Verified state before this round (ground-truth re-scan)

| Item | State |
|---|---|
| `overviewSnapshotFast()` pure read + degraded shell | done (round 3) |
| `AppQyV1OverviewWarmTask` direct `warmOverviewSnapshot()` | done (round 3) |
| Dead `flexible` branch in `overviewSnapshot(bool)` | still present, zero callers |
| `buildOverviewSnapshot()` cost | **still ~300+ SQL round-trips** (per-language loops + per-table `hasTable`) |
| `pendingSnapshot()` | still `flexible` **without** a lock on the HTTP path; its build (`statistics()` + `assistLeasedCount()`) was **~400+ round-trips** |
| `AppQyV1CoverGenerationTask` warm of pending snapshot | silently no-op inside Octane tick (deferred callbacks never run in tick context) |
| Octane cache silent-write cliff | unguarded (`OctaneStore::put()` returns `false` past the Swoole-table row size) |
| pycore / pycore-manager UI / wordnew / LaravelAPI | already aligned (queue-center overview + assist overview reads, Reverb push); zero pycore references to assist endpoints |

## Root defect addressed in this round

The per-language aggregate pattern itself: `foreach (32 languages) { hasTable(); COUNT(*); }`.
Every snapshot build paid ~1 round-trip for table introspection + 1–5 round-trips for counts **per
language per metric lane**, so a single build cost 300–400+ sequential SQL round-trips. Moving the
build into the Octane tick (round 3) without shrinking it would have starved the 1s
`RealtimeOutboxPublishTask` on the same sequential tick pipeline.

## Changes (Laravel backend)

### 1. New centralized helper — `app/Apps/AppQyV1/AppQyV1Services/AppQyV1PerLanguageMetrics.php`

Single source for per-language aggregate sweeps:

- `filterExistingTables($connection, $langToTable)` — ONE `information_schema.tables` query for the
  whole table set (replaces ~32 `hasTable()` calls per sweep).
- `columnsOfTables()` / `requireColumns()` / `filterTablesByColumns()` — ONE
  `information_schema.columns` query for column-existence gating (replaces per-table `hasColumn`;
  preserves the "skip not-yet-migrated language" contract of the old try/catch loops).
- `countByLanguage($connection, $langToTable, $whereSql, $bindings)` — ONE `UNION ALL` query,
  one single-scan branch per language table; zero counts are omitted (old behavior).
- `metricsByLanguage(..., $selectSql, ...)` — multi-metric conditional aggregates
  (`COUNT(*) FILTER (WHERE ...)`, `COALESCE(SUM(...),0)`) so each branch still scans its table once.

Table names always come from `AppQyV1TableMaps` / the prefix builder and are double-quoted; all
filter values are bindings. Scan work is unchanged — only round-trips drop — and the existing
queue-scan indexes (`AppQyV1_2026_07_31_000001_add_queue_scan_indexes`) serve the branches.

### 2. Rewired sweeps (exact same predicates, constant round-trips)

| Site | Before | After |
|---|---|---|
| `AppQyV1AssistQueueMetrics::dictionaryByLanguage()` + 3 lanes | ~32 hasTable + 32 COUNT per lane (×3) | 1 listing + 1 UNION ALL per lane |
| `AppQyV1AssistQueueMetrics::sentenceCounts()` | 32 hasTable + 32 COUNT + samples | 1 listing + 1 UNION ALL + samples only for languages with pending rows |
| `AppQyV1SentenceAudioService::leasedCount(null)` | 32 hasTable + 32 COUNT | 1 listing + 1 UNION ALL (single-language path unchanged semantics) |
| `AppQyV1SentenceAudioService::pendingCount(null)` | 32 hasTable + 32 COUNT | 1 listing + 1 UNION ALL |
| `AppQyV1DictionaryTTSCoordinator::statistics()` | ~64 hasTable/hasColumn + ~320 COUNT/SUM | 2 listings + 1 column listing + 2 UNION ALL (dict + articles) |
| `AppQyV1DictionaryTTSCoordinator::assistLeasedCount()` | ~64 hasTable + 64 COUNT | 2 listings + 2 UNION ALL |
| `AppQyV1AssistQueueItems::categoryItemsFromSentenceAudio()` | 32 hasTable per drill-down | 1 listing (bounded per-language row SELECTs unchanged) |

`statistics()` lock predicates (`applyLiveLockPredicate` / `applyClaimableLockPredicate`) are
expressed as SQL fragments with identical semantics; the builder methods remain the canonical
version for the claim paths (comment in code keeps them in sync).

### 3. Snapshot contract completion — `AppQyV1AssistOverview.php`

- Deleted the dead `overviewSnapshot(bool $fresh)` `flexible` branch (zero callers). Controller
  `?fresh=1` now calls `warmOverviewSnapshot()` directly.
- `pendingSnapshot(false)` is now a **pure cache read** with a degraded zero-shaped shell on cold
  cache (same contract as the overview snapshot); `pendingSnapshot(true)` → `warmPendingSnapshot()`
  (synchronous build + store, explicit refresh only).
- New `warmPendingSnapshot()` publishes the pending snapshot; **no `Cache::flexible` remains
  anywhere in AppQyV1** (verified by grep). The two remaining app-wide `flexible` usages
  (`LaravelCodeLastModifiedService`, `TaskManagerService::getTaskStats`) already pass the `$lock`
  parameter — the documented correct pattern — and have cheap builds.
- New `putShared()` guard: checks the `put()` return value and logs `payload_bytes` on rejection,
  surfacing the Octane Swoole-table row-size cliff instead of failing silently (F4 guard).
- Removed now-unused `OVERVIEW_TTL` / `PENDING_SNAPSHOT_TTL` flexible-window constants.

### 4. Timer alignment

- `AppQyV1OverviewWarmTask::exec()` (20s) now warms **both** snapshots, each in its own try/catch,
  with a `duration_ms` warning budget (≥1000ms) on the overview build.
- Removed the stale `pendingSnapshot(false)` "warm" from `AppQyV1CoverGenerationTask` (a no-op read
  under the new contract; its `flexible` warm never ran inside Octane ticks anyway).

## Resulting query budgets

| Build | Before | After |
|---|---|---|
| Overview snapshot | ~300+ round-trips | ~15 (3 dict lanes + sentence count + sentence lease + ~10 grouped aggregates + bounded samples) |
| Pending snapshot | ~400+ round-trips | ~10 (2 statistics UNION ALL + 2 lease UNION ALL + listings + grouped cover/poster/translation) |
| Tick pipeline impact | multi-second blocking every 20s | sub-second; 1s `RealtimeOutboxPublishTask` no longer starved |

## Laravel 12 / Octane cross-check (unchanged from diagnosis, re-verified)

- `Cache::flexible` stale refresh is a `defer()` callback → only runs via HTTP terminate /
  `CommandFinished` / `JobAttempted` — never in `Worker::handleTick()`; hence direct `put()` in the
  warm task and pure reads on HTTP workers.
- `OctaneStore` is shared across workers only when `octane.cacheTable` is bound (Swoole runtime);
  the round-3 probe (`app()->bound('octane.cacheTable')` → file-store fallback) matches
  `OctaneServiceProvider` / `OnWorkerStart` vendor logic.
- PG `COUNT(*) FILTER (WHERE ...)` is standard SQL supported by the pgsql grammar via raw select.

## Ends

- **pycore**: no code change needed — zero references to assist endpoints (verified); consumes
  queue-center events + Reverb.
- **pycore-manager UI** (`PcQueueCenterExchange.ts`), **wordnew** (`WordNewQueueRuntime.ts`),
  **laravel manager UI** (`LaravelAPI.ts`/`LaravelRealtime.ts`): unchanged — all read the
  cache-backed endpoints and already tolerate the `cached`/`stale` degraded shell (SHARED CONTRACT v2).

## Verification plan (user-run)

1. `php artisan octane:start` runtime; watch for `Overview snapshot warm exceeded budget` warnings —
   `duration_ms` should now be well under 1000ms.
2. `GET /api/app_qy_v1/assist/overview` and `/assist/pending` + `/assist/status` respond in <200ms
   once warmed; cold cache returns the degraded shell with `stale: true`.
3. `?fresh=1` on either endpoint rebuilds synchronously and republishes.
4. Concurrent pycore + wordnew + dashboard polling shows no 8s read timeouts and no mutual stalls.
5. No `[Assist] snapshot cache write rejected by store` errors (would indicate the payload outgrew
   the Swoole table row size — then move the snapshot keys to the database cache store).
