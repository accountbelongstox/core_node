# Dict-Lane Live Queue — Timer-Free Cached Queue Architecture

Date: 2026-09-22
Status: design (binding for implementation)
Scope: `poly_apps/laravel_main` (dict-lane queue bottom layer, timer task
decommission, realtime direct-emit), `pycore` (head-event dedup-key
resolution), `poly_apps/pycore_laravel_wordnew_ui` (contract/types),
`config/queue_center_contract.json`.

Companion documents (already implemented, remain valid):
`docs_fix/REQUIREMENTS_20260922_AUDIO_QUEUE_HEAD_PART1_PART2.md`,
`docs_fix/REQUIREMENTS_20260922_WORD_AUDIO_OFFLINE_QUEUE.md`.

## 1. Background and goal

Four AppQyV1 backlog lanes are today fed by Octane/FrankenPHP timer tasks
that poll the dictionary tables every 30–60s and enqueue `global_tasks`
rows:

| Timer task | Role | Lane | Interval |
|---|---|---|---|
| `appqyv1_word_validity_scan` | Producer | `word_validity` | 60s |
| `app_qy_v1_word_translation_scan_task` | Producer | `word_translation` | 60s |
| `app_qy_v1_dictionary_translation_task` | Producer | `dictionary_explanation` | 30s |
| `queue_center_audio_scan` | Producer | `word_audio` | 60s |
| `app_qy_v1_word_translation_filler_task` | Consumer (`laravel-internal-ai`) | `word_translation` | 45s |
| `global_task_maintenance_task` | Maintainer | `*` | 15s |
| `queue_head_notification_task` | Head-event poller | `word_audio`/`sentence_audio` | 2s |
| `realtime_outbox_publish_task` | Outbox poller | Mercure outbox | 1s |

This model has three structural defects:

- The backlog is DUPLICATED: the dictionary tables already ARE the backlog
  (`has_audio=false`, `has_translation=false`, `validity_checked_at IS
  NULL`); copying it into `global_tasks` adds a second, drifting truth and
  a capacity-bounded mirror (the 1600-row cap that hid the ~132k
  without-audio backlog from pycore).
- The polls are pure waste when no consumer is attached, and several of
  them are in `running_with_errors` on the dashboard.
- Head notifications and Mercure publication ride 1–2s pollers even though
  every event has a natural emit point (the mutating request itself).

Goal: the backend stops MAINTAINING these queues. Each lane becomes a
LIVE VIEW over its dictionary source query:

- **Real-time query, cached in memory.** The first consumer request for a
  lane runs the lane's source query once and caches the ordered item list
  in the long-lived FrankenPHP worker's memory; later requests read the
  cache, never the mass table.
- **DIFF before every serve.** A cheap ms-level probe of the SOURCE
  TABLE's length + last-write time (PostgreSQL `pg_stat_user_tables`
  write counters; fallback `COUNT(*)` + `MAX(updated_at)` — no filtered
  aggregate) decides per dictionary table: unchanged → serve the cached
  queue; changed → re-fetch the lane's ID list (one indexed id-only
  query) and minimally update the cached list (add new ids, drop
  vanished ids, keep order). Full rows materialize only for the page
  being served.
- **The cache has a queue head.** `moveToHead` (wordnew) updates the head
  of the in-memory lane queue and notifies pycore IMMEDIATELY (direct
  Mercure emit) — no 2s head poller.
- **Claims stay compatible.** When a worker pulls
  (`POST /api/worker/tasks/{taskType}/pull`), the lane materializes
  just-in-time `global_tasks` rows for the claimed page ONLY (same
  payload shapes the old producers used), so accept/result/write-back,
  receipts, and the UI drilldown keep working unchanged. Unclaimed
  backlog never touches `global_tasks`.
- **Event-driven realtime.** Outbox appends and head notifications publish
  to Mercure at emit time; the 1s/2s pollers are decommissioned (kept
  available as a disabled safety net).

## 2. Measured facts (code scan, 2026-09-22)

### 2.1 Lane source queries (all exist on `AppQyV1LangDictionaryModel`)

- `word_audio`: management filter `without_audio` =
  `has_audio=false OR has_audio IS NULL`
  (`AppQyV1VocabularyStatsController::dictionaryWords`,
  `MANAGEMENT_FILTER_KEYS`); items `{id, content, md5}`; paged
  `start/limit` (limit ≤ 1000) with `total`.
- `word_translation`: `untranslatedRows(lang, limit)` —
  `has_translation=false AND is_valid=true`, `query_count DESC`.
- `word_validity`: `pendingValidityPageIds` / `pendingValidityScanRows` —
  `validity_checked_at IS NULL`, `query_count DESC, id`.
- `dictionary_explanation`: `DiffQueueFeederTaskAbstract::rowsForPendingPage`
  over the dict table + `pendingTranslationRows(lang, ids, true)` —
  `has_translation=false AND is_valid=true`.

### 2.2 Claim path (unchanged by this refactor)

`WorkerController::pullTasks` →
`TaskManagerService::pullAndAssignTasksForWorker($workerId, $limit,
$taskType)` — one transaction, typed claim by `task_type`, capability
match in PHP. Results return through `submitResult` →
`WordTranslationTaskProcessor` etc. → dictionary write-back.

### 2.3 Head + realtime (to become direct-emit)

- `QueueCenterService::moveToHead`/`moveToHeadBatch` (wordnew via
  `AppQyV1AudioGateway`) → `QueueHeadNotificationService::record(queue)`
  → `queue_head_notification_task` (2s) → `flush()` →
  `AppQyV1TranslationEventModel::emit({queue}_head)`.
- `AppQyV1TranslationEventModel::emit` appends to the outbox table
  (after-commit); `realtime_outbox_publish_task` (1s) →
  `RealtimeOutboxPublisher::publishPending()` → Mercure. The outbox table
  stays as the durable record + failure retry; only the POLLER goes.
- `realtime_outbox_publish_task` also runs
  `RelayDeviceService::expirePresence()`; relay presence expiry moves to
  `RelayMaintenanceTask` (30s, already running).

### 2.4 pycore consumption of head events

`pycore/pyctl/queue_center/snapshot_service.py::apply_head_event` →
`worker.set_cached_task_head(task_id, queue_position)` →
`AudioTaskQueue.move_to_head`. After the word-audio full-sync change the
local queue is fed by `_local_source` tasks (`word-full-<md5>`), so a
Laravel-side `task_id` no longer matches; resolution must be by the
event's dedup identity (`language`+`md5`/`content_id`), falling back to
`task_id`.

### 2.5 Maintenance without a poller

`GlobalTaskMaintenanceTask` is the only caller of
`releaseTimedOutTasks()` / `cleanOfflineWorkers()` (lease recovery). The
recovery stays but becomes on-demand: a throttled `maintainOnDemand()`
runs inside the worker pull path (at most once per 15s per process via a
cache check) — recovery happens exactly when consumers are active.

## 3. Core concepts (binding definitions)

- **Lane = live view.** A dict lane is defined ONLY by its source query
  over the dictionary tables. The lane's "queue" is the cached, ordered
  result of that query. Nothing is enqueued ahead of a consumer.
- **One signature, minimal diff.** The diff probe compares the SOURCE
  TABLE's length and last-write time — never a filtered aggregate —
  using the fastest metadata the database supports (ms-level):
  PostgreSQL → `pg_stat_user_tables` (`n_live_tup` table length +
  `n_tup_ins`/`n_tup_upd`/`n_tup_del` cumulative write counters, one
  stats-view read); fallback (other drivers / stats unavailable) →
  `COUNT(*)` + `MAX(updated_at)` on the table. The signature is per
  dictionary TABLE (language), shared by every lane reading that table.
  Per lane+language the cache stores `{signature, ids[], items{}}`.
  Every serve first probes the table signature; unchanged → serve the
  cached queue; changed → re-fetch ONLY the lane's id list (id +
  ordering key, one indexed query) and minimally diff it against the
  cached list in PHP (add new ids, drop vanished ids, keep order).
  Row materialization (full columns) is bounded to the served page.
- **Memory-first, restart-safe.** The lane cache lives in a process
  static (FrankenPHP worker memory) and is mirrored to the database cache
  store (`QueueCenterCacheStore`) as a JSON snapshot, so a worker restart
  restores without a mass re-query; a stale snapshot is corrected by the
  next signature probe. Multiple workers converge because the source of
  truth is the dictionary table and the signature probe.
- **Just-in-time materialization.** `global_tasks` rows for a dict lane
  exist ONLY for pages a worker actually claimed (plus wordnew head
  tickets for `word_audio`/`sentence_audio`, which are the Part2 fill
  path of the Part1/Part2 contract and stay). Payload shapes are
  byte-identical to the old producers'.
- **Head is part of the lane cache.** Each lane cache owns a monotonic
  head ticket list; head items are served/materialized first. A wordnew
  head move updates the cached head and emits `{queue}_head` immediately.
- **Emit at the source.** Every Mercure event is published in the same
  request that created it (after-commit). The outbox table remains the
  durable journal; failed publishes are retried by the next emit and by
  the (disabled-by-default) publisher task if an operator re-enables it.

## 4. Public surface

### 4.1 New library `App\Services\QueueCenter\DictLane\`

- `DictLaneCatalog` — static lane definitions:
  `key`, `task_type`, `languages()` (dictionary service catalog),
  `tableFor(lang)` (source dictionary table),
  `laneFilter(query)` (the lane's WHERE scope),
  `idListQuery(lang)` (ordered ids + ordering key, run only when the
  table signature changed),
  `materialize(lang, ids)` (page rows), `payloadFor(taskType, rows)`
  (legacy producer payload shape), `dedupKey(row)`.
  Lanes: `word_audio`, `word_translation`, `word_validity`,
  `dictionary_explanation` (`dictionary_explanation_demo` shares the
  `dictionary_explanation` lane).
- `DictLaneTableProbe` — the ms-level table signature reader (§3):
  `pg_stat_user_tables` on PostgreSQL, `COUNT(*)` + `MAX(updated_at)`
  fallback; one probe per table per serve, shared by all lanes.
- `DictLaneQueueCenter` — the shared service (container singleton):
  - `counts(taskType): array{lang:int}` — signature-probe counts for the
    metrics/UI surfaces.
  - `page(taskType, lang, start, limit): array{total, items}` — cached
    id-list slice + bounded materialization (backs
    `dictionaryWords?filter=without_audio` and any lane-backed filter).
  - `ensureMaterialized(taskType, limit): int` — pop head/front items
    without a live `global_tasks` row (group_key dedup) and create the
    just-in-time claim rows; called from `WorkerController::pullTasks`
    before the atomic claim.
  - `moveToHead(taskType, dedupKey, payload)` — update the cached head,
    keep the global-tasks head ticket for the audio queues (Part2 fill
    path), emit `{queue}_head` directly.
  - Snapshot persistence: load once per process, save debounced after
    diffs/head moves.

### 4.2 Rewired endpoints (wire shapes UNCHANGED)

- `POST /api/worker/tasks/{taskType}/pull`: for dict-lane task types,
  `DictLaneQueueCenter::ensureMaterialized()` runs before
  `pullAndAssignTasksForWorker`; the response shape is untouched.
- `GET /api/app_qy_v1/dictionary/words?filter=without_audio`: served from
  the `word_audio` lane cache (same `{total, start, limit, items}`
  contract pycore's full sync consumes).
- `POST /api/queue-center/queues/{queue}/head(/batch)`: updates the lane
  head and emits immediately; response unchanged.

### 4.3 Timer task disposition

Removed (replaced by the live-view lane; class files deleted):

- `AppQyV1WordValidityScanTask`
- `AppQyV1WordTranslationScanTask`
- `AppQyV1DictionaryTranslationTask`
- `AppQyV1WordTranslationFillerTask`
- `QueueCenterAudioScanTask`
- `AppQyV1WordMediaScanTask` (already disabled; lane model replaces it)
- `AppQyV1TTSGenerationTask`, `AppQyV1TtsLockReclaimTask` (legacy TTS
  queue, superseded by the queue-center audio lane + pycore full sync)

Disabled by default (`isEnabled()` false, class kept as operator safety
net), with the reason in the docblock:

- `QueueHeadNotificationTask` — replaced by direct-emit at `record()`.
- `RealtimeOutboxPublishTask` — replaced by direct publish at emit time;
  `RelayDeviceService::expirePresence()` moves to `RelayMaintenanceTask`.
- `GlobalTaskMaintenanceTask` — replaced by throttled on-demand
  maintenance in the pull path (`DictLaneMaintenance::onPull()`).
- `AppQyV1AiPromptFanoutTask`, `AppQyV1OverviewWarmTask`,
  `AppQyV1PosterCollectionTask`, `AppQyV1PresenceSweepTask`,
  `CodeMartV1AIAnalysisTask` — `running_with_errors` on the dashboard;
  disabled per operator request. NOT deleted (out of this refactor's
  scope); each keeps its user-data setting to re-enable.

Everything not listed here keeps its current state.

## 5. Requirements

- R1 `DictLaneCatalog` + `DictLaneTableProbe` + `DictLaneQueueCenter`
  implemented per §3/§4.1; process-static memory +
  `QueueCenterCacheStore` JSON snapshot; diff = ms-level table probe
  (length + write counters / `MAX(updated_at)`) → id-list re-fetch only
  on change → PHP minimal diff.
- R2 `WorkerController::pullTasks` calls `ensureMaterialized` for dict
  lanes; payloads identical to the deleted producers (translation:
  `words/language/target_language/word_count`, timeout
  `min(600, 60+3*n)`, priority/retry as before; validity:
  `remote_validity` execution type, `target_language=zh`).
- R3 `AppQyV1VocabularyStatsController::dictionaryWords` serves the
  lane-backed listing filters (`without_audio` — the claim lane — plus the
  view-only lanes `without_translation` / `valid` / `invalid`, filters
  byte-identical to `managementFilter`) from `DictLaneQueueCenter::page`
  when no search/sort narrowing applies; response contract unchanged.
- R4 Head: `QueueHeadNotificationService::record()` emits the
  `{queue}_head` event immediately (same payload as today's `flush()`);
  the poller task disabled. `QueueCenterService::moveToHead` also records
  the head in the lane cache.
- R5 Realtime: `AppQyV1TranslationEventModel::emit`/`emitOnce` trigger
  `RealtimeOutboxPublisher::publishPending()` right after the
  after-commit append (best-effort, failures stay journaled);
  `RelayMaintenanceTask` takes over `expirePresence()`;
  `realtime_outbox_publish_task` disabled.
- R6 On-demand maintenance: throttled (≥15s) `releaseTimedOutTasks()` +
  `cleanOfflineWorkers()` + `PriorityAgeService::ageTasksPriority()` run
  from the pull path; `global_task_maintenance_task` disabled (terminal
  purge/stale-expire move to an artisan command for manual runs).
- R7 Task disposition per §4.3; dashboard shows the removed tasks gone
  and the disabled ones `disabled`.
- R8 pycore: `snapshot_service.apply_head_event` resolves the target by
  dedup identity (`language`+`md5`/`content_id`) first, `task_id`
  fallback, so wordnew head moves reorder the full-sync-fed
  (`_local_source`) word_audio queue.
- R9 Contract: `config/queue_center_contract.json` gains a
  `dict_lane_queue` block (lanes, filters, signature fields, materialize
  limits, direct-emit note); `schema_version` 34 → 35.
- R10 UI: queue-center surfaces read lane backlogs from the metrics that
  now come from `DictLaneQueueCenter::counts` (Laravel overview +
  pycore exchange); no wire-shape changes, i18n labels only where a
  visible text changes.

## 6. Acceptance criteria

1. With the timer tasks removed/disabled, a pycore/chrome worker pull for
   `word_translation` still receives tasks (materialized just-in-time)
   and result write-back still lands in the dictionary.
2. `dictionary/words?filter=without_audio` returns identical totals to
   the raw query (en ~101k) while repeated pycore full-sync pages hit the
   cache, not the mass table (one signature probe per page).
3. A dictionary change (word translated / audio uploaded / validity
   checked) flips the signature; the next serve reflects it without any
   scanner run.
4. wordnew "move to head" updates the lane head and pycore receives the
   `{queue}_head` Mercure event in the same second (no poller lag);
   pycore reorders its full-sync-fed local queue by dedup identity.
5. Dashboard: the §4.3 removed tasks absent; disabled ones `disabled`;
   no other task changes state.
6. With Laravel idle (no consumers), ZERO lane queries run (no
   producers); with consumers active, per-serve cost is one signature
   probe (+ id-list re-fetch only on change).

## 7. Non-goals

- `sentence_audio` stays `global_tasks`-backed (its producers are media
  resolve hooks, not dict scans); only its head notification becomes
  direct-emit.
- No change to the relay device/claim protocol beyond moving presence
  expiry into the existing relay maintenance slice.
- No new dependencies, no test files.

## 8. Implementation record (filled after development)

Implemented 2026-09-22 against R1–R10. This document supersedes the
disposition in `REQUIREMENTS_20260922_QUEUE_TIMER_REALTIME_CACHE_REFACTOR.md`
(a draft that kept `queue_center_audio_scan` and the infra pollers); the
operator's later directive — the dashboard dump listing the tasks to retire —
is what §4.3 records.

### Laravel (`poly_apps/laravel_main`)

- New library `app/Services/QueueCenter/DictLane/` (R1):
  - `DictLaneTableProbe` — ms-level table signature: PostgreSQL
    `pg_stat_user_tables` (n_live_tup + n_tup_ins/upd/del), fallback
    `COUNT(*)` + `MAX(updated_at)`; a per-language dirty counter
    (bumped from `AppQyV1LangDictionaryModel::forgetMetricsCache`) is folded
    into the signature so same-request writes are visible immediately.
  - `DictLaneCatalog` — the four lane definitions (source filters, ordering
    `query_count DESC, id ASC`, batch sizes, legacy payload/execution/
    timeout/priority specs). `laneRows` streams a base-query cursor (no
    Eloquent hydration — 233k-row en table verified under memory limits).
  - `DictLaneQueueCenter` — process-static lane cache + debounced JSON
    snapshot in `QueueCenterCacheStore`; `page()`, `counts()`,
    `ensureMaterialized()` (pile-up guards + inflight reservations with
    15-min TTL), `noteHeadMove()`, `noteDictionaryWrite()`.
  - `DictLaneMaintenance` — on-demand pull-path maintenance (15s throttle:
    releaseTimedOutTasks / cleanOfflineWorkers / priority aging; hourly slow
    slice: terminal purge, never-assigned expiry, legacy retag, stale worker
    purge, zero-byte audio 5% roll).
- R2: `WorkerController::pullTasks` materializes dict lanes before the
  atomic claim and runs `DictLaneMaintenance::onPull` for every lane.
- R3: `AppQyV1VocabularyStatsController::dictionaryWords` serves
  `without_audio` (the word_audio claim lane) and the view-only lanes
  `without_translation` / `valid` / `invalid` (filters byte-identical to
  `managementFilter` — totals verified equal on the dev DB: 110,306 /
  233,612 / 0 for en) from the lane cache when no search/sort narrowing
  applies; full rows materialize for the requested page only.
- R4: `QueueHeadNotificationService::record()` emits `{queue}_head`
  immediately (extracted shared `emitHeadEvent`; `flush()` kept for the
  disabled safety-net poller). `QueueCenterService::moveToHead` also moves
  the item to the cached lane head (`noteHeadMove`).
- R5: `AppQyV1TranslationEventModel::appendAfterCommit` and
  `AppQyV1SocialEventModel::emit` call
  `RealtimeOutboxPublisher::publishPending()` right after the outbox
  append; `RelayMaintenanceTask` took over `RelayDeviceService::
  expirePresence()` + `publishRelay()`.
- R6: on-demand maintenance per `DictLaneMaintenance` above (the artisan
  command variant was dropped — the hourly slow slice covers it).
- R7 task disposition:
  - DELETED: `AppQyV1WordValidityScanTask`, `AppQyV1WordTranslationScanTask`,
    `AppQyV1DictionaryTranslationTask`, `AppQyV1WordTranslationFillerTask`,
    `QueueCenterAudioScanTask`, `AppQyV1WordMediaScanTask`,
    `AppQyV1TTSGenerationTask`, `AppQyV1TtsLockReclaimTask` (no remaining
    references; composer classmap regenerated).
  - DISABLED by default (user-data safety-net setting in the docblock):
    `QueueHeadNotificationTask` (`queue_center_head_notification_poller`),
    `RealtimeOutboxPublishTask` (`realtime_outbox_publish_poller`),
    `GlobalTaskMaintenanceTask` (`global_task_maintenance_poller`),
    `AppQyV1AiPromptFanoutTask` (`appqyv1_ai_prompt_fanout`),
    `AppQyV1OverviewWarmTask` (`appqyv1_overview_warm`),
    `AppQyV1PresenceSweepTask` (`appqyv1_presence_sweep`),
    `AppQyV1PosterCollectionTask` (default flipped to false),
    `CodeMartV1AIAnalysisTask` (default flipped to false).
  - `TaskCenterSummaryService::TIMER_QUEUE_ROLES` updated: the retired
    producer/consumer entries removed (their roles now live in the pull
    path, not in timer tasks); `verify_timer_system.php` checks the new
    DictLane classes.
- R11: assist overview/pending snapshots (`/assist/overview`,
  `/assist/pending`, `/assist/status`) no longer depend on the retired
  `AppQyV1OverviewWarmTask`. `AppQyV1AssistOverview::serveSnapshot()`
  serves the shared snapshot while it is younger than
  `OVERVIEW_FRESH_TTL` (30s); the first request past that window rebuilds
  synchronously under a short rebuild lock (concurrent requests keep the
  last good snapshot), a failed rebuild falls back to the stale snapshot,
  and only a never-built key returns the degraded shell. `?fresh=1` still
  forces `warmOverviewSnapshot()` / `warmPendingSnapshot()`. Aggregate
  counts stay on the single-round-trip UNION ALL COUNT queries
  (`AppQyV1AssistQueueMetrics`) — they are deliberately NOT routed through
  the lane row cache, which exists to serve row data, not counts.

### pycore

- R8: `AudioTaskQueue.move_to_head_by_dedup_key` (new, whole-Queue
  semantics, part rank preserved); `audio_queue_center.apply_head_ticket`
  resolves task_id first, dedup identity fallback;
  `laravel_audio_worker.set_cached_task_head` accepts the optional
  `dedup_key`; `snapshot_service.apply_head_event` computes the canonical
  key via the ONE contract helper `audio_dedup_key` and passes it through —
  wordnew head moves now reorder the full-pull-fed (`_local_source`)
  word_audio queue.

### Contract

- R9: `config/queue_center_contract.json` `dict_lane_queue` block (lanes,
  probe, direct-emit, retired tasks); `schema_version` 34 → 35.

### UI

- R10: no wire-shape changes; the laravel-manager Task Center renders
  `queue_role` only when present (absent rows for retired timers need no UI
  change). Lane backlog numbers come from the existing real-time metrics
  (`AppQyV1AssistQueueMetrics`, already dictionary-derived).

### Verification (dev DB, 2026-09-22)

- `php -l` zero errors on every new/changed PHP file; composer autoload
  regenerated; `php artisan route:list` boots clean.
- Live tinker smoke: pg_stat probe `pg:233627:...` (sub-ms); first
  `word_audio` serve builds the 233,612-row en cache in ~2.0s; second serve
  **1.4ms** (probe only, zero table reads); dirty bump → one re-fetch
  (~2.0s) → back to 1.5ms; snapshot persisted to the DB cache store.
- `ensureMaterialized`: pile-up guard holds with legacy live tasks
  (created=0), materializes legacy-shaped tasks once free
  (`dictionary_explanation`: 10 words/task, `remote_client`, timeout 90s,
  priority 50; `word_translation`: 40 words, `remote_translation`,
  `target_language=zh` — verified against a pre-existing producer task's
  payload), inflight skip prevents cross-call duplicates, guard re-engages
  at the per-language cap. Smoke tasks cancelled after verification except
  two legitimately materialized en dictionary tasks.
- `py_compile` zero errors on all changed pycore files; contract JSON
  parses at schema_version 35.
- R11 smoke: cold `overviewSnapshotFast()` rebuilt in 387ms (13 categories,
  `cached=false`), warm hit 0.1ms; `pendingSnapshot()` correctly fell back
  to the degraded shell on the dev DB because the stale dev schema lacks
  `tts_status` (migration
  `AppQyV1_2026_06_12_000010_add_tts_state_columns_to_canonical_tables`
  not applied there) — pre-existing schema drift, not a regression.
- Not verified here (needs the running deploy): FrankenPHP worker memory
  footprint with all four lanes warm (per-lane+lang lite lists are
  ~10–25MB on a 233k-row table), end-to-end chrome/pycore pull against the
  rewired endpoint, Mercure direct-emit latency.
