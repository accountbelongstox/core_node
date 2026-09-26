# Audio Orchestration Requirements

> **Status (2026-09-26): partially superseded.** The current binding document
> for orchestration resources, lane queues, and error surfacing is
> `docs_fix/REQUIREMENTS_20260926_AUDIO_ORCH_QUEUE_STATE_DRIVEN.md`. Corrections to this file:
> - *Resource manifest and generation.* Missing **words** are not looked up on
>   Laravel one by one. They fill Part1 of the word_audio Queue and are
>   generated in Kokoro batches per language. Missing **sentences** fill Part1
>   of the sentence_audio Queue, then go Laravel lookup → local synthesis.
>   Each item is taken out of its lane queue before generation and settled
>   afterwards (one generator per item). Items a lane worker already holds
>   are awaited.
> - *Phases UI.* Per-task Part1/Part2/Queue views of both lanes are shown in
>   the task list; manifest rows carry their lane queue state.
> - *Actionable errors.* Book/sentence sync failures are stable `error_code`s
>   (translated in the UI), scoped to one attempt and one book. Raw
>   exception text is never shown.
> - *Relay reliability.* Still valid; orchestration routes stay non-blocking.
> - *UI location (2026-09-27).* Audio Orchestration is a standalone,
>   source-agnostic page `/pycore-manager/audio-orchestration`
>   (`pages/PcAudioOrchestrationPage.tsx` + `pages/audio-orchestration/`), no
>   longer a Vocabulary tab. See
>   `docs_fix/REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE.md`.
> - *Word batch + timing (2026-09-27, W1).* Every word (fresh misses AND
>   words a lane worker failed) is generated only through the shared
>   `kokoro_batch.synthesize_words_to_cache`; there is no per-word word
>   synthesis. Generation start/finish/duration, per-phase, per-segment,
>   per-lane-item and per-resource times are persisted and shown. See the W1
>   record in `REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE.md`.

## Relay reliability

- Restore responsive Relay transport and resolve `rpc_execution_timeout` on vocabulary status and orchestration requests.
- Relay does not require Qy or manager login. Device signatures, pairing leases, and Mercure transport authorization remain independent.
- Signed client requests use server time. Do not rotate working credentials to repair timing errors.

## Qy word groups

- After Qy App V1 login, load all available default word groups and pull their read-word (已读) records from the backend; read state is server-authoritative, never inferred locally.
- Select the default group initially and allow another group as the read/edit baseline for Words Only New.
- Persist the selection per account and Laravel endpoint, and retain it across refreshes.
- Qy login is required only for account word-group/read-word access.
- Reference the wordnew implementation: `poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/components/daily-reading/WordNewDailyReadingWordGroupsPanel.tsx` and `dailyReadingWordGroupStore.ts` (load groups, pull the roamed selection, default to the "Default Vocabulary Group", persist locally and roam to the account; "All Classical Packs" / "★ Pack" / "Enroll" enrollment UI).
- Word groups and the selected baseline are pycore-authoritative (the qy session lives in pycore `auth.json`): routes `ui/audio_orch/auth/groups` and `ui/audio_orch/auth/select_group` serve and persist them; the browser never needs its own copy.

## Central audio cache

- Sentence audio lives ONLY in the content-addressed `tts_sentence_cache` shared with every TTS entry point (`sentence_audio_cache`); orchestration looks it up with the same identity tuple `tts_orchestrator.synthesize` uses, and stores Laravel-downloaded clips into it under the current sentence-engine identity.
- Word audio lives ONLY in the unified `word_audio_cache` base (`{word}_{provider}.mp3`, any provider counts).
- Resource resolution is batch-first: one word-cache directory scan per language (`find_cached_many`) plus content-addressed sentence stats; Laravel and local generation run for cache misses only.

## Task sources (2026-09-27)

- Tasks are source-agnostic: `source` is `vocab_book` (default, Laravel book sentences) or a text-input source such as `prompt_rewrite` (inline `sentences` in the task record). `orch_sources.py` owns the ids and the sentence provider; manifest, resources, and assembly are one pipeline for all sources.
- Non-book sources submit through `orch_service.submit_text_task` / route `ui/audio_orch/task/submit_text` and generate immediately. Contract: `REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE.md` §3 "W2 contract".

## Laravel delivery of orchestrated output (2026-09-27)

- pycore side (W4, per-server diff since W8): `pyctl/audio_orchestration/orch_delivery.py` kind `audio_orch.output` on the shared durable Laravel delivery outbox (`pyutils/laravel/delivery_outbox.py`). Every Laravel server (namespace `server:<server_id>`) is completed on its own: on each online edge, endpoint switch and at startup the inventory (task id + `meta_hash`, cached per output version) is diffed by Laravel (`delivery/diff` kind `orch_output`) and exactly the reported tasks are queued for that server; a new output is queued for every reachable server when its run finishes. Legacy servers (no `server_id`) diff locally against their delivered state. Manifest clips are local audio cache clips: recorded in the clip ledger and delivered by the cache-level kind `audio_cache.resource` (`pyctl/tts/audio_resource_delivery.py`, diffed as `word_audio` / `sentence_audio`, W7 batch upload). Per-task counts: `progress.output_delivery` (tasks list / task get / progress); status panel on the Audio Orchestration page. Each assembled segment records `timeline` (per-clip `start_ms`/`end_ms`, sentence `seq`) and `duration_ms`; older segments send `timeline: []`.
- Finished tasks (metadata, sentences, final segment mp3s) of every source are delivered idempotently to Laravel `/api/app_qy_v1/orch_audio/ingest/*` (tasks → offset-v1 segment upload); which tasks/segments are still owed is answered by the Laravel diff `POST /api/app_qy_v1/delivery/diff` kind `orch_output` (the former `ingest/probe` was folded into it; `REQUIREMENTS_20260927_LARAVEL_DIFF_DELIVERY_REDIS_INDEX.md` "W7 contract"); wordnew reads `/api/app_qy_v1/orch_audio/tasks[/{id}]`. Keys: task `sha256(machine_id\ntask_id)[0:40]` + pycore `meta_hash`; segment (task, index, sha256); audio stored content-addressed under `/static/app_qy_v1/audio/orchestration/`. Contract: `REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE.md` "W5 contract".
- wordnew playback (R9): home card → `#/orch-audio` listing (source filter, paged) → `#/orch-audio/<task_key>` player (segment playlist + per-sentence resources on the shared `WordNewBookReaderPlayback` engine, highlight via the per-segment `timeline` (length estimate only as fallback), sentence pages loaded on demand, original prompt, word resources). Design: `apps/wordnew/docs/DESIGN.en.md` §7; record: "W6 implementation record".

## Book tasks

- Every Backend Books item has its own New Task action on the right.
- Creating a task selects that book and generates a unique editable name from the book name and formatted creation time.
- The task editor uses a book dropdown and permits switching books.

## Pattern steps

- The Add Step dropdown offers Words Only New, All Words, and the existing sentence steps.
- Remove the separate Word Selection control. Word policy belongs to each pattern step and preserves its ordering.
- Words Only New uses the selected Qy group when available, retaining the existing task-local fallback without Qy login.
- Existing task patterns remain readable through compatibility normalization.

## Resource manifest and generation

- Generate first collects the complete manifest of words and sentences for the selected book and pattern.
- Resolve each audio resource in order: existing Pycore cache, Laravel resource, then live Pycore TTS generation.
- Reuse the established cache keys, resource download, upload, and durable delivery mechanisms.
- Newly generated resources are published to every Laravel server through the shared delivery outbox (kind `audio_cache.resource`, which replaced `audio_orch.resource`); retries remain idempotent and preserve pending uploads.
- Final audio/video generation starts only after manifest collection and required resource completion.
- Show manifest collection, resource resolution/generation/synchronization, and final generation as separate phases with detailed steps, counts, progress bars, and actionable errors.
- Persist phase/progress data so refreshes and reconnects recover the active job.

## Constraints and acceptance

- Reuse shared components and services, keep code/logs/comments English, and put UI strings in i18n.
- Preserve task history, cached resources, working credentials, and upload records.
- Do not perform Git operations or create/run/modify tests. Do not run builds or services without a separate request.
- Maintain the accompanying `DESIGN_20260917_AUDIO_ORCHESTRATION_PROGRESS.md` as the implementation progress record.
- Completion requires code changes across UI, Pycore, and Laravel where needed; documentation alone is insufficient.
