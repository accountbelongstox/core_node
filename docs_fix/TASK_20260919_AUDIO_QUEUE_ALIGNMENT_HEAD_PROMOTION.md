# Audio Queue Alignment and Queue-Head Promotion — Development Requirements

Date: 2026-09-19
Scope: `poly_apps/laravel_main` (queue center, audio scan, gateways), `pycore` (audio workers, audio orchestration), `config/queue_center_contract.json`.

This file is the binding requirement list. Implementation must follow it; verification notes reference the measured facts below, not assumptions.

## 1. Measured facts (local machine, 2026-09-19)

Database probes ran through `php artisan tinker` on the running local deploy (frankenphp + PostgreSQL already up; do not restart services).

### 1.1 `remote_en=678/1879` is a queue-center window, not the real backlog

`[SentenceAudioWorker] remote_en=678/1879` is rendered by
`pycore/pyctl/tts/laravel_audio_worker_state.py::_remote_language_tier_label()`
from the pull response `progress.language_tiers.en`, computed in
`poly_apps/laravel_main/app/Services/QueueCenter/QueueCenterMetricsService.php::languageTiers()`.

- `total` = ALL rows of `global_tasks` with `task_type='sentence_audio'` and `payload.language='en'` (any status: pending/assigned/processing/completed/failed).
- `completed` = rows in status `completed`/`completed_demo`.
- It is NOT "sentences remaining". It is the en-tier slice of whatever the scan has ever enqueued.

Local measurement (`main` connection, `global_tasks`):

```
sentence_audio  en:  completed 637, failed 1201, pending 0     (total 1838)
sentence_audio  zh:  completed 3658, failed 2079, pending 527, assigned 3
word_audio      en:  completed 15092, failed 9780, pending 233, assigned 6
word_audio      zh:  completed 2698, failed 2561, pending 209, assigned 33
```

Source tables (`appqyv1` connection):

```
app_qy_v1_sentences_en: total 143392, has_audio=false 136991
app_qy_v1_sentences_zh: total 45264,  has_audio=false 35746
```

So ~137k English sentences still need audio while the queue-center window
holds only 1838 en rows with ZERO pending. Hence "full-sync mirror ready but
no dispatchable tasks": the remote mirror is correct — the window really has
no live en rows.

### 1.2 Why the window is so small — two stalls in `QueueCenterAudioScanTask`

`app/Services/TimerTasks/QueueCenterAudioScanTask.php` (60s timer):

1. **Queue-wide capacity gate blocks the priority tier.**
   `hasQueueCapacity(QUEUE_SENTENCE_AUDIO, SENTENCE_BACKLOG_TARGET=400)` counts
   live tasks of the whole task type, all languages. zh pending = 527 ≥ 400,
   so `scanSentences()` sets `$hasCapacity=false` and skips loading/enqueueing
   for EVERY language, including en — even though contract
   `language_priority=["en"]` makes en the tier that must finish first.
   Measured: scan catalog `sentence_audio:en:app_qy_v1_sentences_en` has
   `page_count=719` (the whole table discovered) but `consumed_page=16`.

2. **Failed rows are terminal and never resurface.**
   `enqueue()` dedups only against LIVE statuses
   (`findLiveByDedupKey` + `idx_global_tasks_live_group_key`), so failed rows
   do not block a re-enqueue — but the scan's diff catalog consumes a page
   after its enqueue pass (`diffIds->consume`) and never revisits those IDs.
   A row whose task failed (retry budget exhausted, e.g. engine offline) stays
   `has_audio=false` in the source table forever with no live task. en shows
   1201 failed / 0 pending locally — the backlog silently died.

### 1.3 `5570/29177 音频项` is a different universe

The pycore-manager vocabulary UI ("音频编排补齐资源 5570/29177 音频项") reads
pycore audio-orchestration manifests (`pycore/pyctl/audio_orchestration/`):
each task expands a book's words+sentences into `resources`; counters are
`cache_hits + laravel_hits + generated + synced` (resolved) over ALL manifest
resources (missing = unresolved). 29177 is the full learning-material
universe; 1879 is the Laravel scan window. They can never match until the
queue actually covers the missing set — that is the alignment goal, via the
head-promotion contract below (pycore promotes what it still needs).

## 2. Verified existing queue-head promotion chain (do not rebuild)

Laravel:

- `POST /api/queue-center/queues/{queue}/head` →
  `QueueCenterController::moveToHead` → `QueueCenterService::moveToHead`:
  enqueue-or-move by `dedup_key` (`group_key`); a live duplicate is moved, not
  re-inserted; an absent item is created once. `QueueHeadService::
  moveTaskToHead` assigns a monotonic `queue_position` head ticket, promotes
  the diff catalog head (`DiffIdPageCatalog::moveToHead`), and marks the
  queue slice changed (`QueueSliceDiffService::markChanged`).
- Notification: `QueueHeadNotificationService::record()` →
  `QueueHeadNotificationTask` (~2s) → `AppQyV1TranslationEventModel::emit()`
  Mercure event `{queue}_head` (batch collapses to the current head item; the
  full order still propagates via the diff `ordered_task_ids` sync).
- wordnew UI entry: `AppQyV1WordMediaController` /
  `AppQyV1SentenceAudioController` → `AppQyV1AudioGateway::requestWord /
  requestSentence` (`enqueueMissing=true, moveToHead=true`) — a missing
  resource requested by the UI is enqueued-or-moved to head whether or not
  pycore is online (Laravel always keeps its own authoritative order).

pycore:

- Realtime: `pycore/pyctl/queue_center/snapshot_service.py::apply_head_event`
  → `worker.set_cached_task_head(task_id, queue_position)` →
  `AudioTaskQueue.move_to_head` + `diff_task_segment_store.move_to_head`,
  then `request_pull(prefer_remote=True)`.
- Diff fallback: full-sync lanes poll `queue_center_queue_diff`; a changed
  revision carrying `ordered_task_ids` re-ranks the local heap
  (`AudioTaskQueue.reorder`).
- Local ordering: `AudioTaskQueue` is a heap keyed by
  `(language_tier_rank, -queue_position, seq)`; `pop()` always takes the
  head (stack-from-head semantics). `push` refreshes an existing key in
  place — no duplicate insertion. `accept_task` dedups via `contains()`.

The chain is intact. Gaps to close are below.

## 3. Development requirements

### R1 — Per-language scan capacity gate (fix the en stall)

In `QueueCenterAudioScanTask::scanSentences()` / `scanWords()` the backlog
probe must be per language: a language whose live count is below the backlog
target keeps being fed even when another language of the same task type is
saturated. Add a language-scoped variant of
`GlobalTaskQueueQueries::hasBacklogAtLeast` (filter on
`lower(trim(payload->>'language'))`) and evaluate it inside the per-language
loop. Keep the queue-wide probe as the global safety cap.

### R2 — Failed-task resurfacing sweep

Add a bounded re-enqueue path in `QueueCenterAudioScanTask`: per tick and per
language, pick up to N (default 50) `global_tasks` rows in status `failed`
whose dedup identity has no live task AND whose source row still lacks audio
(word: `pendingTtsRowsByIds` semantics; sentence: `has_audio=false`), and
re-create them as fresh pending tasks (new row, normal queue position; do NOT
mutate the failed rows). This makes the window converge on the true missing
set instead of dying on transient engine failures. Failures caused by invalid
payloads stay failed because the source row filter rejects them on
re-enqueue validation.

### R3 — Batch head-promotion endpoint (collaboration, race-safe)

Single-item `POST queues/{queue}/head` exists. Add a batch variant so one
client call promotes a whole word/sentence set:

- Contract: add `queue_center_queue_head_batch`:
  `POST /api/queue-center/queues/{queue}/head/batch`,
  body `{ items: [{ dedup_key, payload? }, ...] }` (bounded by contract
  task limit), response per-item `{ dedup_key, ok, task_id, created,
  head_action, queue_position }`.
- Semantics = `QueueCenterService::moveToHead` per item: live duplicate →
  move to head (monotonic tickets preserve submission order); absent →
  create once at head; never a second live row for one dedup key. Laravel and
  pycore calling it concurrently is safe (unique live index + locked head
  tickets), which is the required race behavior.
- Head notification: one `record()` per queue after the batch (not per item).

### R4 — pycore orchestration self-promotion

- New client helper (pycore, e.g. `pycore/pyutils/laravel/queue_head_client.py`)
  wrapping `queue_center_queue_head` / `queue_center_queue_head_batch`
  through the existing `laravel_client` gateway (timeouts + logs + offline
  tolerance; failures degrade to local-only ordering).
- `pycore/pyctl/audio_orchestration`: when resolving a task's resources,
  compute the missing set first, then
  1. promote the missing words/sentences on Laravel via the batch head
     endpoint (dedup keys: `word_audio` → `{lang}:{md5}`,
     `sentence_audio` → `{lang}:{content_id}`), so ANY online worker
     (this machine or a peer) takes them next;
  2. apply the same head order to the local lane queues
     (`set_cached_task_head`-equivalent) so this pycore generates missing
     resources first instead of walking the backlog in catalog order.
- Promotion never inserts a duplicate into the local heap or the Laravel
  queue: local `AudioTaskQueue.contains()`/`move_to_head` semantics and the
  Laravel live-dedup contract are the guards.

### R5 — Number alignment / observability

- The pycore-manager vocabulary page must label both counters with their
  scope so the values stop looking contradictory: orchestration counter =
  manifest resources (resolved/total); queue-center counter = live window.
  Where the queue window is shown next to the manifest counter, add the
  queue's live counts (pending/assigned/processing) from
  `QueueCenterMetricsService::liveQueue` instead of the all-status window
  totals.
- No attempt to make the two totals numerically equal by construction; they
  converge operationally once R1/R2 feed the queue and R4 promotes the
  manifest's missing set.

## 4. Acceptance checks

1. With zh pending ≥ 400, one scan tick still enqueues en sentence tasks
   (R1) — verify via `global_tasks` insert log/`created` counts.
2. A `failed` sentence_audio row whose source still has `has_audio=false`
   gets a fresh pending task within one tick (R2).
3. `POST /api/queue-center/queues/sentence_audio/head/batch` with an
   existing live dedup key returns `created=false, head_action=moved_to_head`
   and exactly one live row remains for that key (R3); concurrent calls from
   two clients leave one live row.
4. Orchestrating a book with missing audio issues one batch head call per
   lane before generation, and the local worker's next pops are the missing
   items (R4) — check worker log order.
5. Vocabulary UI shows scoped labels; no raw window total presented as the
   backlog size (R5).
