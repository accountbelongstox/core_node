# Queue Timer Tasks → Realtime Query + In-Memory Diff Cache — Design & Progress

Date: 2026-09-22
Status: **SUPERSEDED** — implementation proceeded under
`docs_fix/DESIGN_20260922_DICT_LANE_LIVE_QUEUE.md` (binding design +
implementation record), which follows the operator's later directive
(retires `queue_center_audio_scan` and the head/outbox/maintenance pollers
via direct-emit + on-demand maintenance; this draft had kept them).
Scope: `poly_apps/laravel_main` (timer tasks, queue metrics, dictionary
scans), `pycore` (queue consumers), `poly_apps/pycore_laravel_wordnew_ui`
(pycore-manager surfaces).
Runtime note: Laravel timer tasks previously ran under Octane; the runtime
is now **FrankenPHP** (worker mode).

Companion documents (already implemented):
- `docs_fix/REQUIREMENTS_20260922_AUDIO_QUEUE_HEAD_PART1_PART2.md`
- `docs_fix/REQUIREMENTS_20260922_WORD_AUDIO_OFFLINE_QUEUE.md`

## 1. Completed groundwork (done before this refactor)

1. Queue library Part1/Part2 split + shared `audio_queue_center`
   (pycore), whole-Queue dedup, head-ticket contract.
2. Word-audio offline queue: startup full pull (`word_audio_full_sync`),
   whole-Queue snapshot cache (`audio_queue_cache`), `_local_source` claim
   tolerance, RPC `ui/queue_center/word_audio_full_sync`, pycore-manager UI
   full-sync status + manual action, contract `word_audio_full_sync` block.
3. Data alignment (2026-09-22): Laravel
   `AppQyV1AssistQueueMetrics::wordAudioCounts` by-language counts now use
   EXACTLY the `without_audio` management-filter definition
   (`has_audio = false OR has_audio IS NULL`); the stale
   `OR tts_status='pending'` clause (≈130k rows that already have audio)
   was removed. Vocabulary "No audio", Queue Center by-language, and
   pycore's full pull now share ONE definition (live-verified on
   api.si.12gm.com: en 101,201 / zh 30,880 / ja 103 / vi 34 / lo 4).
4. The `--word-audio-full-sync` CLI/env parameter was REMOVED: the startup
   full pull is governed ONLY by the persisted
   `word_tts_auto.full_sync_on_start` key (the same settings file the UI
   writes).

## 2. New binding requirements (user directive, 2026-09-22)

- R1 **No more timer-driven queue maintenance.** The backend stops
  maintaining queues via periodic scan tasks. Data is produced by REALTIME
  query on first access, then the resulting queue is MAINTAINED IN MEMORY;
  later reads return the in-memory queue instead of re-scanning the
  database.
- R2 **Diff-based cache maintenance.** First query caches the full result
  (e.g. 25,000 words). On the next access, DIFF the dictionary table first:
  no change → return the cached queue; changes → apply the MINIMAL diff to
  the in-memory cache (insert/remove/update only the changed rows).
- R3 **The in-memory queue has a head.** wordnew head-move notifications
  update the in-memory queue head FIRST, then notify pycore (the existing
  Part2 ticket flow).
- R4 **Convert ALL dictionary scans to this pattern**: has_audio,
  has_translation, valid words, invalid words.
- R5 **Disable these timer tasks** (and only these):
  - `appqyv1_word_validity_scan` (Producer, word_validity)
  - `app_qy_v1_word_translation_scan_task` (Producer, word_translation)
  - `app_qy_v1_dictionary_translation_task` (Producer,
    dictionary_explanation; a.k.a. the `appqyv1_ai_prompt_fanout` lane)
  - `app_qy_v1_word_translation_filler_task` (Consumer, word_translation →
    laravel-internal-ai)
  Tasks NOT listed here must keep running (e.g. `app_qy_v1_overview_warm_task`,
  `appqyv1_poster_collection`, `queue_center_audio_scan`,
  `queue_head_notification_task`, `realtime_outbox_publish_task`,
  `app_qy_v1_tts_lock_reclaim_task`, `codemartv1_ai_analysis`).
- R6 Where an API endpoint exists for the same data, the endpoint switches
  to the R1/R2 cache path and replaces the timer-task feed.
- R7 Update `pycore`, `laravel_main`, and the UI together; this is a
  standards-level underlying refactor (centralized shared classes, no
  patchwork), not spot fixes.
- R8 This design doc lands in `docs_fix` BEFORE development starts.

## 3. Current state inventory (observed 2026-09-22)

Timer tasks (FrankenPHP runtime) relevant to the refactor:

| Task | Role | Target | State |
|---|---|---|---|
| `appqyv1_word_validity_scan` | Producer | word_validity | running_with_errors → DISABLE (R5) |
| `app_qy_v1_word_translation_scan_task` | Producer | word_translation | running_with_errors → DISABLE (R5) |
| `app_qy_v1_dictionary_translation_task` (`appqyv1_ai_prompt_fanout`) | Producer | dictionary_explanation | running_with_errors → DISABLE (R5) |
| `app_qy_v1_word_translation_filler_task` | Consumer | word_translation | disabled already → keep DISABLED (R5) |
| `global_task_maintenance_task` | Maintainer | * | keep (not listed) |
| `app_qy_v1_overview_warm_task` | — | — | keep |
| `queue_center_audio_scan` | Producer | word/sentence_audio | keep (not listed); word-audio backlog is now covered by pycore's full pull |
| `queue_head_notification_task` | realtime head tickets | — | keep (feeds R3) |

Existing pieces the refactor reuses:
- `AppQyV1LangDictionaryModel::managementFilter` (`without_audio` etc.) —
  the canonical filter definitions.
- `diff_task_segment_store` (pycore) — precedent for cursor/diff paging.
- Queue head realtime path: wordnew → Laravel `QueueHeadNotificationTask`
  → Mercure/diff → pycore (`apply_head_ticket`, Part2).

## 4. Target design (draft for review before development)

### 4.1 Laravel: shared in-memory query cache service

New centralized service (working name `DictionaryQueueCacheService`):
one class, one instance per scan kind (validity / translation /
explanation / audio), owning:

- **Full load**: first access runs the realtime query (the SAME filter
  SQL the timer scans use today), stores the ordered id/row list in
  memory.
- **Diff probe**: each later access first runs a CHEAP diff query —
  `COUNT(*)` + `MAX(id)` + `MAX(updated_at)`-style fingerprint per table;
  unchanged fingerprint → serve memory; changed → fetch only the delta
  (new ids above high-water + explicit invalidation set) and patch the
  in-memory queue minimally.
- **Head operations**: `moveToHead(ids...)` mutates the in-memory order
  and then drives the existing pycore notification (R3); the DB queue
  position remains the durable fallback.
- **FrankenPHP constraint**: worker memory is per-process. The design must
  pin down whether the cache is per-worker (acceptable drift, diff probes
  keep it convergent) or backed by a single shared store (APCu/shared
  memory) — DECIDE before implementation; default proposal: per-worker
  memory + fingerprint diff on every read, so any worker converges on
  first touch after a change.

### 4.2 Endpoint switch-over (R6)

Every API endpoint that today reads timer-task-fed queue tables switches
to `DictionaryQueueCacheService`:
- validity (valid/invalid), translation (with/without), explanation
  (dictionary_translation), audio (with/without — the `without_audio`
  path aligned in §1.3).

### 4.3 Task disablement (R5)

Disable exactly the R5-listed timer tasks in the task registry/config;
leave their classes in place (consumer contract docs updated). No other
task is touched.

### 4.4 pycore / UI

- pycore: consumers keep reading via the existing endpoints/diff; no
  contract change expected. The word_audio lane is already self-sufficient
  (full pull + queue cache).
- UI: same surfaces, same shapes; the Queue Center cards keep rendering
  from the exchange snapshot (now served from the memory cache).

## 5. Progress log

- 2026-09-22: §1 groundwork completed and verified (see companion docs).
- 2026-09-22: this design document created. Development NOT started —
  awaiting design confirmation (§6).

## 6. Open questions (need decision before/while developing)

1. FrankenPHP worker topology: how many workers serve API traffic? If
   >1, confirm the per-worker-memory + fingerprint-diff proposal (§4.1)
   is acceptable, or require a shared memory store.
2. Confirm the R5 disable list verbatim (four tasks above); in particular
   whether `queue_center_audio_scan` should also be retired once the
   memory-cache path covers word/sentence audio backlog (currently NOT
   disabled per instructions).
3. Diff fingerprint columns: confirm `updated_at` (or equivalent) exists
   and is maintained on every per-language dictionary table; otherwise the
   diff probe needs a write-path dirty marker.
