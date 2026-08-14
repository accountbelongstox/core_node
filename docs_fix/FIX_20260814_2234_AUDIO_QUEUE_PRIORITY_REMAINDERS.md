# Audio Queue Priority Remainders — Implemented Refactor

Date: 2026-08-14 22:34 +10:00 (audit), 2026-08-15 (implementation)

Status: Implemented; deferred items completed

## Scope and invariant

This refactor follows `_prompts/队列中心.txt` and the audit below. The
queue-order invariant is now enforced through one contract-derived ordering
predicate per end:

- `word_audio`, `sentence_audio`, and `article_audio` are all declared
  `ordering: queue_position` (non-fast-promotable) in
  `config/queue_center_contract.json` (schema 23).
- Every end resolves ordering from the shared contract — never from literal
  audio task-type lists:
  - Laravel: `QueueCenterContract::taskOrdering()`,
    `isQueuePositionOrdered()`, `queuePositionOrderedTaskTypes()`
    (`app/Support/QueueCenterContract.php`).
  - Pycore: `task_ordering()` / `is_queue_position_ordered()`
    (`pycore/pyutils/common/queue_center_contract.py`).
  - mcp-chrome: `taskTypeOrdering()` / `isQueuePositionOrderedTask()`
    (`utils/queue-center-contract.ts`).
  - Pycore UI / wordnew: `getGlobalTaskOrdering()` /
    `isGlobalTaskQueuePositionOrdered()` (`core/contracts/QueueCenterContract.ts`).
- TTS engine preference (`priority_profile`, `TTS_ENGINE_PRIORITY`) remains a
  separate valid concept and is untouched.

## Implemented changes

### Contract and four-end adapters (P0-1)

- `config/queue_center_contract.json`: `article_audio` gained
  `ordering: "queue_position"` and `fast_promotable: false`; every other task
  definition now explicitly declares `ordering: "priority"`; the follow-up
  contract cleanup advances schema 22 → 23.
- Task aliases and per-task claimants are contract data. Laravel, Pycore,
  mcp-chrome, and wordnew build validated alias-aware indexes and derive
  claimant task sets, queue-position task types/aliases, order values, and
  comparators from the same document. Duplicate aliases or missing/invalid
  ordering fail at adapter initialization.
- `QueueCenterContract::projectTask()` now drops `priority` for every
  queue-position-ordered type via the predicate (was an inline check).

### Laravel ordering and hot path

- `TaskManagerService`: task creation zeroes priority/interactive for
  queue-position-ordered types; creation logging, typed pulls, per-lane and
  shared fast-lane pulls, and `pendingSignalsForType` all use the contract
  predicate instead of `QueueCenterService::isSupportedQueue()` or the literal
  word/sentence pair.
- `GlobalTaskQueueQueries::pendingClaimCandidatesForExecutionType` builds the
  priority-neutral CASE with dynamic placeholders from the contract list.
- Global task summaries now select `queue_position`; priority aging excludes
  every contract-declared queue-position task type.
- `QueueSliceDiffService`: head-ID snapshots use the predicate; `markChanged`
  no longer rebuilds/invalidates metrics synchronously.
- `QueueCenterCacheStore`: moved from the file store (per-bump lock with a 5s
  block — the blocking behind the 210–216ms diff polls) to the database
  (PostgreSQL) cache store. `increment`/`initialize` are now atomic
  single-row statements with no lock-block; unchanged revisions answer from
  one indexed cache read, and stats refresh on the 2s metrics TTL. This is
  the fix for "diff is a millisecond-level lightweight compare; it signals a
  re-pull, never a stop".
- `TaskController::bump`: ordering-aware — queue-position-ordered tasks
  do not validate or consume numeric priority, move through the centralized
  Queue Center head-ticket service, and return `queue_position`;
  priority-ordered tasks keep the numeric bump.
- `AbstractTaskProcessor` resolves every subclass's semantic task roles through
  `QueueCenterContract::taskTypeKey()`; processor registration no longer owns
  a parallel wire-key catalog.
- Queue-head notification staging uses an atomic dirty revision. The interval
  publisher loads the actual contract-ordered database head only when the
  revision changes, eliminating both lock waits and stale-write races.

### Article audio and deferred Laravel consumer retirement (P0-2/P2)

- `AppQyV1UnifiedTTSQueueService::processPendingArticles` and its coordinator
  and model scanners were removed. The disabled-by-default Laravel timer now
  retains only its legacy word-audio compatibility path; article and sentence
  audio execute only through Queue Center claimants.
- Article-library and application article requests schedule through
  `AppQyV1ArticleSentenceAudioService` on the contract-owned `sentence_audio`
  queue and use a head ticket for interactive requests.
- The orphan `article_tts_generation` / `local_timer` producer was removed;
  `AppQyV1ArticleController` stores the Queue Center task ID and reads status
  from `GlobalTask`. The unused direct GlobalTask dual-write methods were also
  removed.
- `markRowPending`: no longer writes `tts_priority`; the
  `ARTICLE_PRIORITY_DEFAULT` constant is removed. Canonical rows carry no
  queue-order state.
- `AppQyV1TtsQueueQueries::resetFailedTts`: the `MAX(tts_priority)+1` front
  ticket and its table lock are removed; requeue is an idempotent plain
  reset. `lockTableForFrontTicket` remains for the non-audio word-image
  queue.
- `AppQyV1ArticleLibraryModel::pendingSentenceAudioRowsByIds` materializes in
  stable scanner-cursor ID order. The unused reverse-time article scanner was
  removed, so no model method exposes a second article scan order.
- `formatArticleRow` / `formatLogRow`: audio `priority` removed from public
  shapes; queue order lives on the linked GlobalTask `queue_position`.
- Runtime model fillables/casts and all active reads/writes of `tts_priority`
  are removed. A forward add-only migration adds FIFO scan indexes ending in
  stable `id` order. Historical migrations and physical compatibility columns
  remain untouched as required by the Laravel additive-migration policy.

### Pycore

- `diff_task_segments._task_order` consults `is_queue_position_ordered`
  instead of the literal `("word_audio", "sentence_audio")` pair, so
  `article_audio` buffered through the shared store orders by
  `queue_position`.
- Laravel audio workers derive their typed pull/accept sets from
  `task_types_for_claimant("pycore", capability)`. The shared Laravel worker
  base keeps contract discovery pure and rotates only the first type of each
  actual pull cycle, so diff probes cannot advance the fairness cursor and a
  full word backlog cannot starve `article_audio`.
- Qwen3-TTS standalone queue (`qwen3tts_queue.py`) is now pure FIFO: the
  deque preserves receipt order, and batching consumes only a contiguous
  same-language prefix. Queue Center decides which Laravel job is submitted
  first, so no second priority authority or same-language leapfrog exists.
- `qwen/engine.py::synthesize_queued` and
  `pyctl/tts/qwen/operation_service.py` no longer forward a job priority.
- The standalone `POST /queue/submit` request schema rejects the removed
  `priority` field instead of silently retaining a compatibility authority.

### mcp-chrome

- `SimpleWorkerBase.compareTasks` uses `isQueuePositionOrderedTask`.
- Multi-type typed pulls rotate their first task type in the shared worker
  base, preventing a full earlier contract type from starving later claimant
  types such as `article_audio`.
- The adapter now exports contract-derived control names and validates task
  ordering/aliases; claimant task sets include per-task overrides.
- `UnifiedTaskCenter.vue`: the queue-position chip is chosen by task
  ordering (a zero tail position no longer falls through to priority), and
  `priority_desc` sorting orders queue-position-ordered rows by
  `queue_position`.
- The shared popup fast-tier presenter rejects every queue-position task
  through the contract predicate, even when a legacy row carries stale fast
  fields.
- `TaskDetailModal.vue`: pending queue-position-ordered tasks can also bump
  (backend moves them by head ticket).
- `task-history-store.ts` persists `queue_position` and clears priority/fast
  metadata for queue-position records.

### Pycore UI / wordnew

- `ServerManagerAPI.bumpTaskToFront`: response shape is ordering-aware
  (`queue_position?` / `priority?`).
- `TaskCenterState.moveTaskToFront`: ordering-aware optimistic update — audio
  rows update `queue_position` and are never marked fast; the wholesale
  priority re-sort of the task list is removed.
- `QueuePanel`: bump sends no numeric priority, reports the head ticket for
  audio, ascending/descending order sorting uses the contract order value,
  and the detail card displays the contract-owned ordering field.
- TTS drill-down panels display queue position for queue-position task types;
  the related English and Chinese labels, status/type cards, descriptions, and
  empty states are sourced from the Laravel Manager and Pycore Manager locale
  catalogs. Audio task aliases used by request DTOs are exported from the
  shared contract adapter instead of repeated literal unions.

## Compatibility intentionally retained

- `use_server_binary_assist` remains only for still-active legacy EdgeTTS and
  voice-subtitle compatibility paths. It no longer gates or enables any local
  Laravel article consumer.
- Historical `tts_priority` columns and old `article_tts_generation` locale
  labels remain for additive-schema and historical-record compatibility; no
  current producer, scanner, ordering path, or public audio shape uses them.

## Acceptance criteria status

- No audio task type is ordered, promoted, retried, scanned, transported, or
  displayed by `priority`/`tts_priority` on the refactored paths. (Done)
- `article_audio`, `word_audio`, and `sentence_audio` share one
  contract-derived ordering predicate across all four ends. (Done)
- Moving an audio task to the head changes only `queue_position`. (Done)
- Pycore and mcp-chrome preserve Laravel's claimed order in bounded local
  FIFO segments; the Qwen deque no longer creates a second order. (Done)
- TTS engine preference and non-audio task priorities unchanged. (Done)

## Verification note

The completed pass used static source inspection only. Per project rules no
tests, builds, services, compilers, linters, database operations, or Git
commands were run. The earlier syntax checks recorded before this follow-up do
not cover every follow-up edit.

---

# Original audit (2026-08-14 22:34) — for reference

The audit found one systemic gap: `article_audio` lived in the shared
`remote_audio` lane but the contract recognized only `word_audio` and
`sentence_audio` as queue-position queues, so every generic component legally
fell back to `priority` for article audio. Its location tables and the
confirmed non-defects (engine selection order, non-audio task priorities,
shutdown/event/thread/UI priorities, generic DTO unions) remain valid as
written; the P0/P1 items are implemented as described above.
