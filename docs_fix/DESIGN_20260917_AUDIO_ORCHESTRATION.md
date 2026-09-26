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
- Newly generated resources synchronize to Laravel; retries remain idempotent and preserve pending uploads.
- Final audio/video generation starts only after manifest collection and required resource completion.
- Show manifest collection, resource resolution/generation/synchronization, and final generation as separate phases with detailed steps, counts, progress bars, and actionable errors.
- Persist phase/progress data so refreshes and reconnects recover the active job.

## Constraints and acceptance

- Reuse shared components and services, keep code/logs/comments English, and put UI strings in i18n.
- Preserve task history, cached resources, working credentials, and upload records.
- Do not perform Git operations or create/run/modify tests. Do not run builds or services without a separate request.
- Maintain the accompanying `DESIGN_20260917_AUDIO_ORCHESTRATION_PROGRESS.md` as the implementation progress record.
- Completion requires code changes across UI, Pycore, and Laravel where needed; documentation alone is insufficient.
