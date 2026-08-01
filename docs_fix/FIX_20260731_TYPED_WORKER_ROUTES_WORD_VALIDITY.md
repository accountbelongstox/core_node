# 2026-07-31 — Part 2 progress: typed worker routes (2.6) + word validity & translation (2.4)

Scope: `_prompts/队列中心.txt` sections 2.6 and 2.4 (with the clarification at
lines 39-42: validity and translation are ONE feature — DeepSeek batch returns
both; Laravel marks validity and fills missing translations).

## 2.6 — Type-scoped worker task routes

`/api/worker/tasks/{taskType}/{action}` replaces the generic
`tasks/pull|accept|result` (removed). `{taskType}` must be a
`config/queue_center_contract.json` `task_types[].key`.

- Laravel (`poly_apps/laravel_main`)
  - `routes/api.php`: typed routes; `register`/`heartbeat`/`list`/`stats` stay worker-level.
  - `WorkerController.php`: path type validated against the contract (404);
    accept/result compare the stored task type (422 on mismatch);
    pull response signals are type-scoped (`pending_urgent`/`pending_fast`).
  - `TaskManagerService.php`: `pullAndAssignTasksForWorker` /
    `pullAndAssignTasksLongPoll` accept `?string $taskType` — single locked
    `task_type` query (any lane incl. fast tier, capability-filtered in PHP,
    over-fetch idiom); new `countUrgentPendingForType` /
    `countFastPendingForType`. Untyped default keeps the internal filler task
    and heartbeat working.
- pycore
  - `base_laravel_worker.py`: `_effective_task_types()` hook (PRIMARY LAST —
    it holds the long-poll budget, earlier types quick-polled wait=0);
    `_pull_tasks` merges per-type pulls; pull-time `task_id -> task_type`
    registry (bounded 1000) routes `_post_result` to the typed URL — zero
    handler call-site changes.
  - `worker.py` (translation): types per live toggle
    `[prompt_translation, subtitle_search, stt…, word_translation]`.
  - `laravel_audio_worker.py`: `[*EXTRA_TASK_TYPES, QUEUE_KEY]`
    (word worker covers `word_audio` + `article_audio`).
  - `scripts/python_clients/translation_worker_client.py`: typed URLs.
- mcp-chrome
  - `utils/api-paths.ts`: `workerTaskPath(taskType, action)` builder.
  - `WorkerApiClient.ts`: `pullTasks(taskType,…)` / `acceptTask(taskType,…)` /
    `submitResult(taskType,…)`.
  - `SimpleWorkerBase.ts`: abstract `pullTaskTypes`; `pullTasksAcrossTypes`
    merge (primary holds the wait); `currentTaskType` tracking so subclass
    submit call sites are unchanged; outbox `worker_result` records carry
    `taskType` (pre-typed records dropped terminally).
  - 10 worker services declare their types; bing dictionary service migrated
    (own `pullTasksAcrossTypes`, 9 call sites).
- pycore UI / wordnew UI: no direct worker-API usage (grep-verified) — no change.

Verification: `php -l` all touched PHP; `py_compile` all touched Python;
`vue-tsc --noEmit` shows zero errors in touched files (remaining output is
pre-existing, unrelated).

Deployment note: server and all workers must roll out together — old generic
paths are gone (404).

## 2.4 — Word validity + translation as one feature (DeepSeek web batch)

Existing pieces reused (no duplication): `word_validity` task type +
`remote_validity` lane, `word-validity-classifier.ts` prompt/parser (already
supports `{word, translation}`), DeepSeek default provider
(`getValidityProvider`), `/vocabulary/validity/report` (already writes
translations via the canonical write-back), dict columns `is_valid` /
`validity_checked_at` (idempotent sys:init migrations already present — all
words start "undefined": `validity_checked_at IS NULL`).

Changes:

- Chrome task-lane worker (`word-validity-web-worker-service.ts`): passes
  `payload.target_language` (default `zh`) to the classifier, so the DeepSeek
  batch returns verdict + translation in one pass; valid entries carry
  `translation` into the submitted result.
- Laravel scan (`AppQyV1WordValidityScanTask`): payload now carries
  `target_language: 'zh'`.
- Laravel write-back (`WordValidityTaskProcessor`): valid entries with a
  translation go through the canonical
  `AppQyV1WordTranslationWriteback::apply()` — fill-missing only (existing
  translations never overwritten), rows also marked valid; outcome adds
  `translations_filled`.
- Language multi-select (default EN):
  - `AiProviderSettings.ts`: `get/setValidityLanguages()` (new
    `VALIDITY_LANGUAGES` key, migrates the legacy single-language value);
    single-language accessors removed.
  - Runner (`word-validity-runner-service.ts`): drains the whole selection
    round-robin; a language with an empty pending page is marked drained; run
    completes when all selected languages are drained. Status exposes
    `languages`.
  - `AiWebProviderSettings.vue`: language buttons are toggles (min one
    language); custom code input adds to the selection.
  - i18n `validityWordLanguageHint` updated in en / zh_CN / zh_TW / de / ko / ja.

Selection rule unchanged: `has_translation=false AND validity_checked_at IS
NULL`, `query_count DESC`, 200/batch, one in-flight batch per language — only
new missing items are computed, never re-checked.
