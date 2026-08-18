# Queue Center Audio Head, Diff, and Bounded Consumer Refactor

Date: 2026-08-14
Status: Applied; four-end static audit complete; runtime verification pending

## Scope

This fix aligns the queue model across:

- Laravel main
- pycore
- pycore-manager UI and wordnew UI
- mcp-chrome

It covers word audio and sentence audio gateways, queue-head insertion,
bounded consumer slices, persistent diff cursors, progress metrics, coalesced
head notifications, and `sys:init` schema alignment.

The authoritative requirements remain in `_prompts/队列中心.txt`, whose total
numbered requirement count is 54.

## Required behavior

Audio tasks do not use `priority` for interactive ordering. A missing word or
sentence audio request must find its existing pending task and move it to the
physical queue head, or create the task and place it at the head when absent.
Laravel owns ordering through `global_tasks.queue_position`.

pycore and mcp-chrome consume only a bounded front slice. They keep already
claimed work running, even when Laravel changes the queue head. A queue diff
change triggers a new bounded remote-head pull; an unchanged diff keeps the
current local segment. Progress remains available as `completed/total`.

## End-to-end flow after the refactor

1. wordnew requests word or sentence audio through Laravel.
2. The unified audio gateway checks the canonical on-disk file first.
3. If the file exists, Laravel returns its URL without creating queue work.
4. If the file is missing, Queue Center deduplicates the live task and assigns
   a new monotonic `queue_position` through the PostgreSQL queue-head service.
5. Laravel advances the queue diff revision and stages one compact head event.
6. The interval notification task coalesces queued head changes before
   publishing them to online pycore and mcp-chrome consumers.
7. Each consumer polls the compact diff contract at the configured interval.
8. A changed revision causes a remote-first bounded pull. An unchanged
   revision leaves the existing local segment active.
9. Pulled records are persisted in bounded local data segments. The remote
   cursor is persisted only after a successful response and local staging;
   successful empty responses also acknowledge the cursor.
10. Tasks already processing continue to completion. Unstarted locally
    delivered tasks are released when a consumer stops or abandons a cycle.
11. Laravel receives processing and terminal results, updates the global task,
    and advances the diff revision after committed queue mutations.
12. The UIs render queue metrics and `completed/total` progress from the shared
    queue contract.

## Applied Laravel changes

### Unified word and sentence audio gateway

- `app/Apps/AppQyV1/AppQyV1Services/AppQyV1AudioGateway.php` is the shared
  entry point for word and sentence audio resolution.
- `AppQyV1UnifiedTTSQueueService::addSentenceTask()` delegates file lookup and
  queue-head insertion to the shared gateway.
- `AppQyV1UnifiedTTSQueueService::checkAudioExists()` now uses the same
  file-first sentence gateway without enqueueing, removing the legacy
  deterministic-path implementation.
- Legacy comments that described sentence tasks as synchronous or stateless
  were corrected. Sentence work is owned by Queue Center and `global_tasks`.

### Physical queue-head ordering

- `QueueHeadService` owns the monotonic per-task-type `queue_position` ticket.
- PostgreSQL advisory transaction locking serializes concurrent head moves.
- Audio pull and diff queries order by `queue_position`; they do not use
  `priority` as an audio ordering signal.
- `QueueCenterService::moveExistingTaskToHead()` centralizes legacy task-panel
  compatibility. The generic task bump endpoint now routes audio tasks to this
  method, so old callers cannot change audio priority.
- The existing-task path reuses the same coalesced head notification service as
  the normal audio gateway.

### Diff ownership and queue mutations

- `TaskManagerService` now advances `QueueSliceDiffService` after committed
  create, assignment, legacy accept, priority-ordered bump, cancel, retry,
  failure, retryable failure, completion, timeout, and offline-worker reclaim
  mutations.
- Terminal result diff advancement moved from `WorkerController` into
  `TaskManagerService`, covering both HTTP workers and internal Laravel
  submitters without duplicate controller increments.
- Queue Center cancel and retry wrappers delegate to the centralized task
  manager and no longer increment the same revision twice.
- Processing heartbeats extend leases and update progress without producing a
  false queue-head revision.

### Diff and progress API

- `QueueSliceDiffService` returns a compact revision, changed/cached state,
  bounded head IDs, consumer slice limit, poll interval, and queue progress.
- Progress includes completed, total, pending, assigned, processing, and failed
  counts. Only head IDs are materialized when the caller's cursor is stale.
- Worker pull responses include `queue_cursor` and progress together with the
  bounded task slice.

### Coalesced online notifications

- `QueueHeadNotificationService` stores compact per-queue head deltas.
- `QueueHeadNotificationTask` flushes them at the contract interval instead of
  sending one immediate notification per request.
- Repeated moves of the same task are collapsed by task ID, and the retained
  items remain ordered by `queue_position`.

### Schema and `sys:init`

- The shared contract includes `queue_position`, bounded consumer settings,
  diff delivery settings, and the head reserve.
- The global migration imports `App\Services\SafeMigrationHelper` correctly
  and adds `queue_position` plus the queue-order index without destructive
  rollback behavior.
- `GlobalTaskSystemInitializer` contains the same column and index definition,
  keeping `php artisan sys:init` aligned with the migration contract.

## Applied pycore changes

- `pycore/pyutils/common/diff_task_segments.py` remains the centralized,
  serialized owner of cursor metadata, ID pages, and bounded task data.
- Remote Laravel revisions are persisted per scope and task type in
  `remote_revisions`; local segment revisions remain separate.
- `pycore/pyctl/laravel/worker_base.py` reads the maximum in-memory and
  persisted cursor before polling Laravel.
- Pulls are bounded by free worker capacity and persistent segment capacity.
- A changed diff uses remote-first pulling. Cached local tasks fill only the
  remaining capacity.
- Successful empty pulls persist `queue_cursor`, preventing an unchanged empty
  queue from being treated as changed forever.
- A pulled task is staged before its remote cursor is acknowledged. If local
  dispatch is busy, its segment is released for later recovery rather than
  discarded.
- Audio ordering in the local segment uses `queue_position`; numeric task
  priority is ignored for word and sentence audio.
- Worker logs and runtime snapshots carry shared queue progress for
  `completed/total` rendering.

## Applied pycore UI and wordnew changes

- `PcQueueCenterExchange` reads Laravel-owned queue metrics directly while
  pycore supplies local worker and control state.
- A successful Queue Center overview now counts toward Laravel reachability.
- Queue Center overview failures populate the `queue_metrics` error channel,
  so degraded state is visible instead of being reported as healthy.
- Word and sentence section contracts receive pending, leased, processing,
  and live total metrics from the Laravel overview.
- wordnew missing-word and missing-sentence paths call Laravel queue-head
  APIs; they do not call pycore directly for task reordering.
- Sentence playback keeps bounded pollers and retries the Laravel audio gateway
  until the file becomes available.

## Applied mcp-chrome changes

- `DiffTaskSegmentStore` centrally owns bounded persistent cursor, ID-page,
  and task-data storage.
- Staging preserves already owned records and stops at the shared data segment
  limit instead of truncating active work.
- Remote Laravel revisions are persisted separately as `remoteRevision` and
  are preserved when local head or priority events update segment metadata.
- `WorkerApiClient` serializes pull operations, stages remote tasks before
  acknowledging `queue_cursor`, and restores the persisted cursor after a
  service-worker restart.
- Successful empty task slices also persist the remote revision.
- `SimpleWorkerBase` polls queue diff through a non-overlapping in-flight guard.
- A changed diff prefetches only the configured head reserve and never exceeds
  active batch capacity.
- Already processing tasks continue. Prefetched or otherwise undispatched
  records are released on stop and cycle cleanup.
- Audio task comparison uses `queue_position` and bypasses priority ordering.
- Shared progress from Laravel is aggregated and exposed to the popup/UI state.

## Defects found during the final static audit

| Defect | Resolution |
|---|---|
| Global queue-position migration referenced an invalid namespace | Corrected to `App\Services\SafeMigrationHelper` |
| Internal Laravel result submitters did not advance queue diff | Moved terminal diff ownership into `TaskManagerService` |
| Direct assign, accept, cancel, and retry paths could bypass diff | Centralized post-commit revision advancement |
| Controller and Queue Center wrappers could double-increment revisions | Removed duplicate outer increments |
| Successful empty pycore pulls never acknowledged the remote cursor | Persist cursor for empty and non-empty successful slices |
| pycore restart lost the Laravel diff cursor | Persist revisions in the shared segment store |
| mcp-chrome restart lost the Laravel diff cursor | Persist `remoteRevision` in extension local storage |
| mcp-chrome interval callbacks could overlap | Added a diff-poll in-flight guard |
| Queue Center overview success did not make Laravel reachable in the UI | Included the overview result in reachability computation |
| Queue Center overview rejection was not exposed to the UI | Added the `queue_metrics` error path |
| Legacy sentence existence checks bypassed the unified gateway | Routed file-only checks through `AppQyV1AudioGateway` |
| Legacy generic bump could still modify audio priority | Routed audio bump calls to physical queue-head insertion |

## Invariants for later changes

- `global_tasks` is the only distributed task source of truth.
- Laravel is the only owner of queue ordering and queue diff revisions.
- Audio interaction ordering is `queue_position`, never `priority`.
- Missing audio is file-first, then deduplicated queue-head insertion.
- Consumer pulls are typed, bounded, and capacity-aware.
- Diff payloads carry revisions and IDs; full task data is pulled only for a
  bounded slice.
- A remote cursor is acknowledged only after successful local persistence, or
  after a successful empty response.
- Changed queue heads do not cancel work already processing.
- Local segments retain owned work until terminal compaction or explicit
  release.
- Realtime head events are hints; the Laravel diff API remains the recovery
  contract.
- UI components consume centralized TypeScript models and do not call worker
  APIs directly.
- Laravel structural changes remain add-only and are applied through
  `sys:init`.

## Verification boundary

Per repository instructions, no tests, builds, services, migrations, Git
operations, or runtime verification commands were executed. The completed
work was checked by static call-chain analysis across Laravel main, pycore,
pycore UI/wordnew, and mcp-chrome.

Runtime verification should confirm:

- `sys:init` aligns `global_tasks.queue_position` and its ordering index.
- Missing word and sentence requests create or move the correct task to the
  queue head without changing audio priority.
- Diff polling remains cached while the head is unchanged and immediately
  causes a bounded pull after a head change.
- Empty pulls do not repeat the same changed revision.
- Restarted pycore and mcp-chrome consumers resume from persisted revisions.
- In-flight synthesis continues when a newer task is inserted at the head.
- The UIs show live queue metrics and `completed/total` progress.

