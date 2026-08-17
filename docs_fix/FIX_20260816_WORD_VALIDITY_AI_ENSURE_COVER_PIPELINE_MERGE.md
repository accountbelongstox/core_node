# 2026-08-16 — Word-validity AI verification alignment + cover pipeline merge

Scope: align apps/mcp-chrome APIs with poly_apps/laravel_main, extend `sys:init`
word-validity coverage, verify every unchecked word once via the mcp-chrome
DeepSeek web lane (marker `ai_ensure`), and merge the duplicated cover-submit
implementations. Contract-first: `config/queue_center_contract.json` bumped to
schema_version 24 with a new top-level `word_validity` block
(`batch_size: 150`, `default_languages: ["en"]`, `source_marker: "ai_ensure"`,
`idle_poll_seconds: 60`) consumed by all four adapters.

## Contract (single source)

- `config/queue_center_contract.json`: new `word_validity` block; schema 23 → 24.
- Laravel `app/Support/QueueCenterContract.php`: `wordValidity()`,
  `wordValidityBatchSize()`, `wordValiditySourceMarker()` accessors.
- mcp-chrome `utils/queue-center-contract.ts`: exports `WORD_VALIDITY_CONFIG`.

## Laravel (poly_apps/laravel_main)

- `AppQyV1LangDictionaryModel::pendingValidityQuery` (runner `/validity/pending`)
  and `::pendingValidityScanRows` (background scan) now select ALL unchecked
  words (`validity_checked_at IS NULL`) — the `has_translation=false` restriction
  is gone: every word is verified once; translations are still written
  fill-missing in the same pass (existing translations are never overwritten).
- `AppQyV1WordValidityScanTask`: batch size from the contract (150);
  `isEnabled()` default true (idle-safe: no backlog → no-op, per-language
  pile-up guard unchanged).
- `DiffQueueFeederTaskAbstract::rowsForPendingPage`: optional `$discoverLimit`
  so contract-owned batch sizes are not shrunk by the generic 128-row
  data-segment clamp (validity scan passes 150).
- `AppQyV1WordValidityQueueService::pendingPage`: pull limit clamped to the
  contract batch size instead of `data_segment_limit`.
- `WordValidityTaskProcessor` + `AppQyV1VocabularyValidityController::report`:
  default validity source is the contract marker `ai_ensure`.
- `InitializeApps` (`sys:init`): new "Word validity coverage" step after the
  dictionary summary — per-language unchecked counts via `validitySummary()`;
  reports "all verified (idle)" when nothing is left.

## mcp-chrome (apps/mcp-chrome)

- `word-validity-runner-service.ts`: batch limit = contract `batch_size` (150,
  no longer clamped to the 128-row data segment); report source =
  `ai_ensure`; **idle mode** — when every selected language is drained the
  runner stays alive and re-polls `/validity/pending` every
  `idle_poll_seconds` without touching the DeepSeek tab (watchdog churn gone);
  only classification rounds count toward MAX_ROUNDS. Status gained `idle`.
- `utils/task-center-types.ts`: `ValidityStatus.idle` added.
- `services/assist-image-api.ts`: rewritten on `BaseApiClient` (shared
  timeout/retry/ApiError convention); exported function signatures unchanged,
  so `submit-outbox` replay and both image workers are untouched.
- NEW `entrypoints/background/services/assist-cover-pipeline.ts`: the shared
  cover/poster submit-outcome policy (ok → submitted; invalid/not_found →
  terminal release; transient → durable outbox) plus `submitLibraryCover`
  (magic-bytes validation + submit + policy). Both `gemini-image-worker-service`
  and `media-image-worker-service` now call it — the two duplicated
  `processAssistCover` implementations are merged.
- `web-search-service.ts`: removed the deprecated `searchBookCoverUrl` alias
  (no callers remained).

## Cover lanes audit (book poster / vocabulary cover)

Verified end-to-end against the contract: popup capability switches
(`chrome_capability_switches.image` / `.gemini_image`) → `task-center-listener`
→ `mediaImageProcessor` / `geminiImageProcessor` → assist claim → search/Gemini
generation → `/assist/submit` write-back. Backend seeding
(`AppQyV1CoverGenerationTask::seedMissingCovers`, `poster_status` default
'pending') and the claim/submit/release protocol are intact; the worker-side
hardening above (shared pipeline + retried client) is the fix for lost/failed
回传.

## pycore UI (poly_apps/pycore_laravel_wordnew_ui)

- NEW `core/integrations/laravel/wordValidity.ts`: single `isWordRowValid` /
  `wordValidityDisplay` implementation shared by every UI app (exported from
  `core/integrations/laravel/index.ts`).
- `LaravelTypes.ts`: `VocabDictionaryWordRow.is_valid` / `VocabLibraryWordRow.is_valid`
  widened to `boolean | string`; `BooksAPI.ts` `DictionaryWordRow.is_valid` /
  `is_valid_value` widened (`boolean | string | null`).
- laravel-manager: `VocabularyWordsModel` delegates to the shared core helpers;
  `dictionaryColumns.tsx`, `WordDetail.tsx`, `WordDetailModal.tsx`,
  `WordsManagerPanel.tsx`, `VocabularyLibraryDetail.tsx` render/branch through
  the string-tolerant normalizer (the `ai_ensure` source marker is displayed
  instead of a bare Yes when present).
- pycore-manager `VocabWordsTab.tsx`: uses the shared normalizer.

## Verification

- `php -l` clean on all touched PHP files.
- mcp-chrome `vue-tsc --noEmit`: 57 pre-existing errors, zero in touched files.
- wordnew_ui `tsc --noEmit`: only pre-existing errors (the
  `VocabularyLearning.tsx` `id: number|string` mismatch predates this change —
  `VocabularyStatisticsWordRow` has an `[key: string]: any` index signature, so
  the widened `is_valid` is assignable).
