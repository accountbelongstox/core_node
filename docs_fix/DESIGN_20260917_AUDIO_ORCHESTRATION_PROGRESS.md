# Audio Orchestration Implementation Progress

> **Status (2026-09-26):** historical record. The rows below describe the
> 2026-09-17 implementation. Later changes (`docs_fix/REQUIREMENTS_20260926_AUDIO_ORCH_QUEUE_STATE_DRIVEN.md` §6) replaced:
> - `orch_resources.resolve_audio` per resource → `resolve_batch` with
>   per-lane Part1 take/settle (Kokoro batch for words);
> - raw `str(exc)` sync errors → `error_code` + `detail` per attempt;
> - 2000-row sentence pages → 500-row keyset pages with retries and a
>   resumable partial;
> - the sentence Part1 fill, which previously only re-ranked already-queued
>   rows, now inserts local tasks.

Requirements backup: `DESIGN_20260917_AUDIO_ORCHESTRATION.md`.

| Work | State | Evidence |
| --- | --- | --- |
| Requirements and progress documents | Complete | Both documents created before development |
| Relay timeout diagnosis and repair | Complete (pending on-device verification) | Root cause: relay executes routes under `min(contract 50s, policy 15-30s)` (`pycore/pyutils/rpc_v2/execution.py:156-171`); slow handlers time out and are posted as `ledger.execution.unknown` (`pycore/pyctl/relay/laravel_relay_operation_processor.py:483-488`). All orchestration routes are now non-blocking (cache-first + background jobs in `orch_books.py`/`orch_service.py`); agent-history runtime uses the background snapshot (`pycore/pyctl/agent_history/ui_service.py:258`) |
| Qy groups and persistent baseline selection | Complete | `LaravelQyAccountAPI.groups`, `OrchAccountSession.wordGroups/selectWordGroup`, group baseline dropdown in `OrchLoginPanel.tsx`; `word_group_id` now reaches the task (`orch_generate.start_generation`) — previously a TypeError (5 args into a 4-param function) |
| Per-book task action and editable unique names | Complete | Per-item New Task button in `OrchBookPicker.tsx`, `newOrchTaskName` (book + timestamp + uuid), book dropdown in `OrchTaskEditor.tsx` |
| Per-step new/all word policies | Complete | `build_sentence_items` maps `words_new`/`words_all` to per-step modes (`orch_generate.py`), `select_words` accepts a per-step `word_mode` override (`orch_words.py`); legacy `words` defers to task-level `word_mode` |
| Manifest, resource reuse, synchronization, final generation | Complete | `_generate` rewritten manifest-first: phase 1 manifest (virtual-read consumed once, persisted), phase 2 per-resource resolve via `orch_resources.resolve_audio` (cache → Laravel → local TTS) + `synchronize_audio` outbox upload for generated clips, phase 3 ffmpeg assemble; `recover_deliveries()` resumed on generation start |
| Detailed persistent phase progress UI | Complete | `progress.phase` (manifest/resources/assemble/done) persisted on the task; `OrchTaskList` renders phase label + per-phase resource progress bar and cache/Laravel/generated/synced/missing counters; locales `phaseManifest/phaseResources/phaseAssemble/phaseDone/manifestSynced/wordsOnlyNew` added (`wordsOnlyNew` was referenced but missing) |
| Word-group dropdown empty after login | Complete | Root cause: groups were read from the BROWSER-side account store while the session lives on the pycore side (`auth.json`), so a pycore-restored session showed "logged in" with an empty dropdown. Groups are now pycore-authoritative: new routes `ui/audio_orch/auth/groups` + `auth/select_group` (`orch_service.auth_groups/auth_select_group`), `orch_store.update_auth` persists `word_groups`/`word_group_id` in the auth record, generation falls back to the stored baseline; missing locales `wordGroupBaseline/wordGroupHint/noWordGroups/groupsLoadFailed/defaultGroup` added; dead browser-side `LaravelQyAccountAPI.groups` / `OrchAccountSession.wordGroups/selectWordGroup` removed |
| Central cache + batch resolution | Complete | Sentence audio now uses ONLY the central content-addressed `tts_sentence_cache` (the `sentence_audio/<md5>` mirror in `orch_resources` deleted; Laravel downloads are stored into the central cache under the current sentence-engine identity via `sentence_audio_cache.store_result`); words keep the unified `word_audio_cache` base with new `find_cached_many` (one directory scan per language); generation phase 2 runs `orch_resources.resolve_batch` — batch local cache hits first, Laravel/generation only for misses |

No tests, builds, or services have been run for this work. Python files pass `py_compile`; UI changes are type-consistent with the existing `OrchTaskSummary.progress` shape. Runtime verification of the relay fix requires the on-device Windows pycore.
