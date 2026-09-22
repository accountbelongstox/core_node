# Word Audio Offline Queue — Development Requirements

Date: 2026-09-22
Scope: `pycore` (queue library, word-audio worker, full-sync module, runtime
startup, queue-center RPC), `poly_apps/laravel_main` (dictionary listing
endpoint consumer contract), `poly_apps/pycore_laravel_wordnew_ui`
(pycore-manager app), `config/queue_center_contract.json`,
`scripts/shells/linux/common/pyservice_entry.sh`.
Runtime entry: `./pyservice.sh 1 --no-install` → `pycore/pycore_module_caller.py`.

This file is the binding requirement list. Implementation must follow it;
verification notes reference the measured facts below, not assumptions.

Companion document (prerequisite, already implemented):
`docs_fix/REQUIREMENTS_20260922_AUDIO_QUEUE_HEAD_PART1_PART2.md` — the
Queue = Part1 + Part2 split whose M3 entry (`promote_local_head`) this
feature uses to fill Part1 with the full without-audio word list.

## 1. Background and goal

pycore only ASSISTS Laravel in audio generation. Today the `word_audio` lane
mirrors only the `word_audio` global_tasks Laravel has already enqueued
(`QueueCenterAudioScanTask` is capacity-bounded, so the dictionary backlog
larger than the queue target is never fully fed). Consequences:

- When Laravel is offline, pycore drains the mirrored backlog and then idles,
  even though thousands of dictionary words still lack audio.
- A pycore restart with Laravel offline starts with an empty local queue.

Goal: pycore becomes self-sufficient for word audio.

- At startup, when the persisted **Word Audio** flag is ON, pycore pulls
  **ALL dictionary words without audio** from Laravel into the lane queue
  (Part1 fill — pycore self-driven, no Laravel queue mutation) and keeps
  generating while Laravel is offline; uploads resume through the existing
  durable `audio_delivery_outbox` when Laravel returns.
- The queue snapshot is cached locally; on restart pycore loads the queue
  from the cache WITHOUT any remote pull and starts generating immediately
  when Word Audio is Running.
- The UI flag and the pycore flag are the SAME persisted value: the UI may
  change it, pycore reads it directly from the settings file and never
  depends on the UI process.
- New `./pyservice 1 --no-install --word-audio-full-sync` parameter forces
  the startup full pull explicitly.
- When the flag is Running, the whole chain starts together: cache load →
  full pull → drain → word batch orchestration (GPU: batch default kokoro).

## 2. Measured facts (code scan, 2026-09-22)

### 2.1 Flag (single persisted value, sync already exists)

- Store: `user_data_store` section `assist_laravel`, `capabilities.tts`
  (`pycore/pyctl/assist/assist_settings.py`). `assist_capability_enabled("tts")`
  reads the persisted JSON directly (`config/user_data.json` via
  `pycore/pyutils/common/user_data_store.py`).
- Write path: UI toggle → RPC `ui/task_center/set_queue_center_control` →
  `pycore/pyctl/queue_center/task_center_service.py::set_queue_center_control`
  → `set_assist_capability("tts", enabled)` (the ONLY persistence entry).
- Read-back: pycore-manager polls the queue-center snapshot exchange
  (`apps/pycore-manager/hooks/useQueueCenterHub.tsx`, `exchange.assist`);
  the Word Audio section switch renders lifecycle 'on' as Running
  (`apps/pycore-manager/pages/PcQueueCenterPage.tsx`).
- Lane gate: `laravel_audio_worker.py::_is_enabled` →
  `assist_capability_enabled(self.ASSIST_CAPABILITY)`; the heartbeat
  callback `tts_queue_poller` is registered enabled per
  `assist_callback_states` (`pycore/pyctl/runtime/event_handlers.py`), so a
  Running flag already starts the periodic pull/drain loop.

### 2.2 Existing intake (covers only Laravel-enqueued tasks)

- The word lane is FULL_SYNC (`laravel_audio_worker.py`,
  `FULL_SYNC_ENABLED = True`): `_pull_once_full_sync`
  (`pycore/pyctl/laravel/worker_base.py:1087`) mirrors Laravel's pending
  `word_audio` global_tasks through `diff_task_segment_store` (persistent
  segment store, survives restart) and dispatches into the shared queue.
- This is a Part2 fill only and is bounded by what Laravel enqueued —
  NOT the full dictionary backlog.

### 2.3 Words-without-audio listing (exists on Laravel)

- `GET /api/app_qy_v1/dictionary/words?language=<lang>&filter=without_audio&start=&limit=`
  (`AppQyV1VocabularyStatsController::dictionaryWords`; `limit` ≤ 1000;
  response `{ total, start, limit, items: [{ id, content, md5, has_audio, ... }] }`;
  filter key `without_audio` exists in
  `AppQyV1LangDictionaryModel::MANAGEMENT_FILTER_KEYS`; default language
  `english`).
- Language list source: `GET /api/app_qy_v1/vocabulary/language-breakdown`
  (`AppQyV1VocabularyStatsController::languageBreakdown`).
- pycore consumes only `id` / `content` / `md5` / `has_audio`.

### 2.4 Report path for locally sourced words (exists)

- `pycore/pyctl/tts/laravel_audio_worker_execution.py::encode_word_report_task_id(dict_row_id, language)`
  (line 80) encodes `dict_row_id*1000 + 1*100 + langIndex`, matching
  `AppQyV1DictionaryTTSCoordinator::encodeTaskId`. The domain report
  (`POST /api/app_qy_v1/ai_tools/tts/worker/report`) needs only
  `dict_row_id` — the dictionary row `id` from 2.3 covers it.
- Durable upload on failure/offline: `audio_delivery_outbox`
  (`pycore/pyutils/tts/audio_delivery_outbox.py`), flushed on Laravel
  online (`_on_laravel_online`) and at worker init.

### 2.5 Queue library and caches

- Shared queue: `pycore/pyutils/tts/audio_queue_center.py`
  (`audio_queue_center`, globally shared instance). M3
  `promote_local_head(lane, items)` fills Part1 directly with whole-Queue
  dedup; items are `{language, text, content_id?, md5?}`.
- Local per-word MP3 cache: `pycore/pyutils/tts/word_audio_cache.py`
  (`find_cached_many` honored before synthesis; dir
  `get_app_cache_dir()/word_audio`). Hydration keeps cached words queued —
  their Laravel delivery is still pending.
- GPU/kokoro batch default: already pinned in
  `pycore/pyutils/tts/runtime_profile.py` — GPU plan `word_batch: (kokoro,)`,
  `word: (edge, kokoro)`; `pin_runtime_profile()` runs at pycore startup.

### 2.6 Startup parameter plumbing

- `scripts/shells/linux/common/pyservice_entry.sh`: flag parsing while-loop
  (lines 428–447), `PY_ARGS` build (line 639), usage text (`print_usage`).
- `pycore/pycore_module_caller.py` `__main__` argparse (lines 221–269);
  precedent: `--tts-selfcheck` → env `TTS_STARTUP_SELFCHECK=1`.

## 3. Core concepts (binding definitions)

- **One flag.** The Word Audio flag IS `assist_laravel.capabilities.tts` in
  the persisted user-data store. The UI may change it (existing RPC); pycore
  reads the same file directly; no second flag, no UI dependency.
- **Full pull = pycore self-driven Part1 fill.** Pulling the without-audio
  dictionary listing into the queue is a pycore-local operation: it fills
  Part1 through M3 `promote_local_head` and NEVER mutates Laravel's queue
  (no head ticket, no enqueue call). Whole-Queue dedup applies: a word
  already queued (either part) keeps its single copy.
- **Queue cache = whole-Queue snapshot.** The persisted snapshot covers the
  ENTIRE Queue (Part1 + Part2 as one ordered list) plus the INTERNAL Part1
  membership set, so a restart restores exact order and part assignment.
  The split stays internal — the cache file format is the library's own
  concern.
- **Cache-first boot.** Startup order is fixed: (a) restore the queue from
  the local cache, (b) when the flag is ON, run the full pull (background),
  (c) request a drain. Laravel being unreachable changes nothing: the
  cache-restored queue still drains.
- **Local tasks never claim remotely.** Full-pull tasks carry a
  `_local_source` marker: just-in-time claim is skipped, delivery goes
  through the domain report (`encode_word_report_task_id`) and the outbox.
- **Running means everything starts.** With the flag ON, cache load, full
  pull, drain, and the word batch orchestration (GPU → kokoro, already
  pinned) start together; no extra user action is needed after a restart.

## 4. Public surface additions

- `AudioQueueCenter` (library-internal, M5-adjacent):
  `restore_from_cache(lane)` — one-shot boot restore from the cache file;
  `persist_snapshot(lane, source)` — whole-Queue snapshot write.
  Both are INTERNAL persistence hooks, not actor-facing API.
- New pyctl module `word_audio_full_sync` (singleton `word_audio_full_sync`):
  `run_full_sync(base_url="")` — idempotent background full pull;
  `get_status()` — `{running, last_sync_at, last_result, languages, pulled,
  remaining}` for the UI snapshot.
- New RPC `ui/queue_center/word_audio_full_sync` — trigger an on-demand
  full pull (same entry as startup) and return the status block.
- New env `WORD_AUDIO_FULL_SYNC=1` — set by the new pyservice/argparse flag;
  forces the startup full pull even when the persisted
  `word_tts_auto.full_sync_on_start` key is false.
- New persisted key `word_tts_auto.full_sync_on_start` (bool, default true) —
  the startup full-pull preference read directly by pycore.

## 5. Requirements

- R1 Queue cache: `pycore/pyutils/tts/audio_queue_cache.py` persists the
  whole-Queue snapshot to `get_app_cache_dir()/audio_queue/<lane>_queue.json`
  (atomic tmp+replace write). Snapshot = ordered task list + Part1 key set +
  `saved_at` + `source` (`full_sync|laravel_diff|local_promote`).
- R2 `audio_queue_center` gains `restore_from_cache` / `persist_snapshot`;
  restore happens once at boot before any remote intake; persist runs after
  full pull, Laravel intake (M1/M2), local promote (M3), and drain-cycle
  completion boundaries.
- R3 Full sync (`pycore/pyctl/tts/word_audio_full_sync.py`): per-language
  paging (`limit=1000`, `start += count` until `total`) of
  `dictionary/words?filter=without_audio`; languages from
  `language-breakdown`, fallback to contract word_audio languages, final
  fallback `english`. Laravel unreachable → skip silently (cache keeps the
  lane alive). Fill via `promote_local_head` (Part1), then persist the
  snapshot with `source=full_sync`.
- R4 Full-pull task payload: `{task_id: "word-full-<md5>", word, content,
  language, md5, dict_row_id: <row id>, task_type: "word_audio",
  _laravel_base_url, _local_source: "full_sync"}`.
- R5 Claim tolerance: `_local_source` tasks skip the remote just-in-time
  claim; the domain report + outbox handle delivery.
- R6 Startup chain (`event_handlers.py`, after `apply_assist_runtime`):
  flag ON → `restore_from_cache("word_audio")`; then full pull when
  `WORD_AUDIO_FULL_SYNC=1` OR `word_tts_auto.full_sync_on_start` is true
  (background bus task); then `request_pull`. Flag OFF → none of this runs.
- R7 New parameter: `--word-audio-full-sync` in `pyservice_entry.sh`
  (parse + usage) and `pycore_module_caller.py` (argparse → env
  `WORD_AUDIO_FULL_SYNC=1`).
- R8 RPC `ui/queue_center/word_audio_full_sync` + registration; controller
  runs the same full-sync entry and returns the status block.
- R9 Snapshot surface: `snapshot_service.py` word_audio section carries a
  `full_sync` status block so the UI renders it from the existing exchange.
- R10 UI (pycore-manager Queue Center, Word Audio section): show full-sync
  status (last sync, pulled count, remaining) and a manual "Sync full word
  list" action wired to R8; i18n en/zh. The section continues to render the
  shared flag as Running/Off exactly as today.
- R11 Laravel doc comments only: `dictionaryWords` and
  `QueueCenterAudioScanTask` note the pycore full-pull consumer contract
  (read-only listing, Part1 fill, report via `encodeTaskId`). No behavior
  change.
- R12 `config/queue_center_contract.json`: `word_audio_full_sync` block
  (endpoint, language source, cache file, env flag) and schema_version
  32 → 33.
- R13 Orchestration: no engine change (kokoro batch pin exists); the word
  batch orchestration lane starts with the Running flag through the
  existing enable flow; UI surfaces the shared state.

## 6. Acceptance criteria

1. Flag ON + Laravel online at boot: queue restores from cache, full pull
   fills Part1 with every without-audio word (deduped against the whole
   Queue), snapshot persisted, drain starts, orchestration lane starts.
2. Flag ON + Laravel offline at boot: queue restores from cache and drains
   with no errors; synthesized audio stages into the outbox; on Laravel
   online the outbox flushes and progress advances.
3. Flag OFF at boot: no cache restore, no full pull, no drain start.
4. `./pyservice 1 --no-install --word-audio-full-sync` passes the flag to
   the worker (env `WORD_AUDIO_FULL_SYNC=1`) and forces the startup pull.
5. UI toggle changes the same persisted flag pycore reads; the Queue Center
   page shows the full-sync status block and the manual sync action works.
6. A word already present in the queue is never duplicated by a full pull;
   Part1 members keep their front position.

## 7. Non-goals

- No Laravel queue mutation from pycore (no enqueue, no head push).
- No new flag stores, no new dependencies, no test files.
- No change to the sentence_audio lane's intake contract.

## 8. Implementation record (filled after development)

(To be completed with the files changed and verification results.)
