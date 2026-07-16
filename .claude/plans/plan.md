# Vocabulary page -> pycore-manager (UI -> pycore -> laravel proxy)

## Goal
Surface the laravel-manager `#/vocabulary` page's endpoints in pycore-manager's
sidebar nav (middle slot), with UI talking to pycore and pycore proxying laravel
- matching the existing `word_audio_router.py` + `PcWordAudioPage` style. Full
tab-for-tab replica (user-approved scope). No commands run.

## Architecture decision (verified)
The shared `components/views/VocabularyLearning.tsx` (+ sub-components) import the
`api` singleton (hits laravel DIRECTLY) and shell hooks that pycore-manager does
NOT provide: `useToast` (`components/admin/Toast.tsx:242`) **throws** outside a
`ToastProvider`, `useAppState` needs `UnifiedAppContext`; `PcProviders.tsx` only
mounts PcLive/PcLaravelEndpoint/PcCapability/PcVideoExtract. Reusing the shared
component would crash. => Build a **fresh self-contained `PcVocabularyPage`** that
uses `pycoreApi` + local state (the `PcWordAudioPage` pattern: `L` label object,
guarded calls, no laravel-manager shell contexts).

## Backend - new proxy router (UI->pycore->laravel)
**New `pycore/callmodule/routers/local/vocabulary_router.py`** - prefix
`/api/local/vocabulary`, follows `word_audio_router.py`:
- `_laravel_base()` via `get_laravel_endpoint_manager().resolve() or ""` (try/except, never raises).
- `get_third_package_requests()` for HTTP; `ColorPrint.red(... + traceback.format_exc())` on error.
- Never raises -> `{success:False, error:...}` envelope.
- Module-private `_proxy(method, laravel_path, *, params=None, json_body=None)` helper
  (justified: 23 endpoints inlined would exceed the 800-line split rule; this is the
  scoped departure from the "inline per endpoint" norm, kept inside the one router file).
- `_VOCAB_TIMEOUT = 600` (laravel can be slow/unreachable - matches the word-audio batch timeout).

Endpoint map (pycore path -> laravel path):
- GET  `/translation/languages`      -> `/api/app_qy_v1/ai_tools/translation/languages`
- POST `/translation/translate`      -> `/api/app_qy_v1/ai_tools/translation/translate`
- POST `/tts/generate`               -> `/api/app_qy_v1/ai_tools/tts/generate`
- GET  `/tts-queue/stats`            -> `/api/app_qy_v1/ai_tools/tts/queue/stats`
- GET  `/tts-queue/items`            -> `/api/app_qy_v1/tts/queue/items`
- GET  `/assist/overview`            -> `/api/app_qy_v1/assist/overview`
- GET  `/assist/overview/items`      -> `/api/app_qy_v1/assist/overview/items`
- GET  `/libraries`                  -> `/api/app_qy_v1/vocabulary/libraries`
- GET  `/libraries/{id}/words`       -> `/api/app_qy_v1/vocabulary/libraries/{id}/words`
- DEL  `/libraries/{id}`             -> `/api/app_qy_v1/learning/libraries/{id}`
- POST `/cover/retry`                -> `/api/app_qy_v1/assist/cover/retry`
- GET  `/statistics`                 -> `/api/app_qy_v1/vocabulary/statistics`
- GET  `/language-breakdown`         -> `/api/app_qy_v1/vocabulary/language-breakdown`
- GET  `/dictionary/words`           -> `/api/app_qy_v1/dictionary/words`
- POST `/dictionary/words`           -> `/api/app_qy_v1/dictionary/words`
- PUT  `/dictionary/words/{md5}`     -> `/api/app_qy_v1/dictionary/words/{md5}`
- DEL  `/dictionary/words/{md5}`     -> `/api/app_qy_v1/dictionary/words/{md5}`
- POST `/dictionary/words/batch`     -> `/api/app_qy_v1/dictionary/words/batch`
- GET  `/dictionary/sentences`       -> `/api/app_qy_v1/dictionary/sentences`
- POST `/translation/queue/batch/add`-> `/api/app_qy_v1/ai_tools/translation/queue/batch/add`
- POST `/tts/queue/batch/query`      -> `/api/app_qy_v1/ai_tools/tts/queue/batch/query`
- POST `/validity/report`            -> `/api/app_qy_v1/vocabulary/validity/report`
- GET  `/tts/sentence-audio`         -> `/api/app_qy_v1/ai_tools/tts/sentence/audio`
- GET  `/storage-summary`            -> `/api/servermanager/v1/system/static-resources`

**Register (2 places):** export `vocabulary_router` in
`pycore/callmodule/routers/local/__init__.py` (import + `__all__`); import +
`app.include_router(vocabulary_router)` in `pycore/callmodule/app.py` (import block
lines 28-47 + mount block lines 112-122, alongside `word_audio_router`).

## Frontend - pycoreApi methods + types
**`core/api-libs/pycore/PycoreApi.ts`** - add a `// --- Vocabulary (pycore proxies laravel)` section
with one method per endpoint above (GET->`getJSON`, POST->`postJSON`, PUT->`putJSON`,
DEL->`deleteJSON`), mirroring the word-audio section's style (lines 1045-1082). Types
declared alongside (DictionaryWordRow, LibraryWordRow, VocabStatistics, AssistOverviewResponse,
TtsQueueStats, TranslationResponse, etc. - shapes from the laravel page, agent-confirmed).

## Frontend - new page + tabs (self-contained, no shell contexts)
**`apps/pycore-manager/pages/PcVocabularyPage.tsx`** - default export; tab bar shell
(`VocabSubTabBar`-style local tabs: Translate / Words / Libraries / Statistics / TTS Queue /
Learning Tasks) with `localStorage`-persisted active tab; lazy `Suspense` per tab. Uses
`pycoreApi.vocabulary.*`; local React state; `L` label object (en literals + zh comments);
guarded calls; never crashes when pycore offline.

Co-located sub-components (split to stay <800 lines each), under
`apps/pycore-manager/pages/vocabulary/`:
- `vocabTypes.ts` - shared row/response types + `L` labels.
- `VocabTranslateTab.tsx` - translate panel (source/target lang, detect, TTS generate + play).
- `VocabWordsTab.tsx` - dictionary words table: filter (language/validity/has-audio) + search
  + sort + paging + batch (delete/mark_valid/mark_invalid/requeue_tts) + per-word actions
  (requeue translation, validity report, sentence audio). Reuses the column-builder idiom.
- `VocabLibrariesTab.tsx` - libraries list by language + cover-retry + delete; opens detail modal.
- `VocabLibraryDetailModal.tsx` - paginated library words + stats.
- `VocabStatisticsTab.tsx` - summary totals + per-language breakdown table.
- `VocabTtsQueueTab.tsx` - TTS queue stats + paginated items by status/type.
- `VocabLearningTasksPanel.tsx` - learning tasks list (read-only-ish).
- `vocabColumns.tsx` - shared table column builders (dictionary / assist-queue / tts-queue).

Style: Tailwind + lucide-react icons; `pycoreApi` envelope `{success,error,...}` consumed
directly (no `APIResponse` wrapper, no BaseAPI); offline banner when pycore unreachable.

## Frontend - nav registration
**`apps/pycore-manager/pcPages.tsx`** - add `export const PcVocabularyPage = lazy(() => import('./pages/PcVocabularyPage'));`
near line 36; insert into `PC_PAGES` between `content` (line 56) and `ai` (line 60):
`{ id: 'vocabulary', labelKey: 'nav.vocabulary', Icon: BookOpen, Component: PcVocabularyPage }`
(`BookOpen` from lucide-react, added to the import list). No router edits (PcApp.tsx auto-generates).
**`pc-locales/en.ts` + `zh.ts`** - add `vocabulary: 'Vocabulary'` / `'词汇'` to the `nav` block.

## Files touched
- NEW `pycore/callmodule/routers/local/vocabulary_router.py`
- EDIT `pycore/callmodule/routers/local/__init__.py`
- EDIT `pycore/callmodule/app.py`
- EDIT `core/api-libs/pycore/PycoreApi.ts`
- NEW `apps/pycore-manager/pages/PcVocabularyPage.tsx`
- NEW `apps/pycore-manager/pages/vocabulary/*` (8 files)
- EDIT `apps/pycore-manager/pcPages.tsx`
- EDIT `apps/pycore-manager/pc-locales/en.ts`, `zh.ts`

## Rules honored
English code/comments/logs; no test code; no run/build/test; split >800-line files; imports
at file top; follow existing `word_audio_router.py` + `PcWordAudioPage` style; FE no
`import.meta.env` (config in JS). UI->pycore->laravel only - never `api` direct to laravel.

## Risks / notes
- Translate + TTS-queue tabs duplicate surfaces already in pycore-manager (AI page, Queue
  Center) - user accepted this by choosing full replica.
- Response shapes: pycore proxy is pure passthrough of laravel JSON, so FE consumes laravel's
  native shapes (agent-confirmed). No BaseAPI envelope.
- Auth: laravel vocabulary read/CRUD routes are public; translate/TTS-generate/library-delete
  need `auth:sanctum`. Proxy passes through; if laravel returns 401 the envelope surfaces it.
- Large build (~10 new FE files). Will implement in order: BE router -> register -> pycoreApi ->
  nav+locales -> page shell -> tabs.
