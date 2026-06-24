# AI Prompt-Assist Translation Pipeline — canonical contract

**Status: 2026-06-24** · Design baseline; update this doc as a linked change when either side moves.

Cross-stack feature: non-English AI-tool prompts captured by the **AI Dev History** extractor are
auto-dispatched to **pycore** for English translation (code-filtered, 3 fluent variants, TTS audio),
and the result is dual-written to the **AI history center** (`dev_tool_history`) and a new
**daily short-sentence center** for the `wordnew` daily-reading view.

Spans: `poly_apps/laravel_main` (Laravel Octane :9000) · `pycore` (worker, RPC :59000) ·
`poly_apps/pycore_laravel_wordflow_ui` ends (`laravel-manager`, `pycore-manager`, `wordnew`) ·
`apps/mcp-chrome` (extension). All extracted/derived data is stored in **files, never a database**.

Related canonical docs: `development-guides/SENTENCE_AUDIO_GENERATION_PIPELINE.md`,
`poly_apps/laravel_main/docs/WORD_TRANSLATION_PIPELINE.md`.

## 1. Data flow

```
DevHistory extractor (10s timer)                       pycore TranslationWorker (PULL)
  prompts.json (lang-tagged via LanguageDetector)         claims remote_translation tasks
        │ non-English (zh/ja/ko), deduped, capped 25/run        │
        ▼                                                       ▼
  DevHistoryAssistService.scanAndEnqueue ──► global_tasks ──► _process_prompt_translation_task
     task_type=prompt_translation                                 code_filter.mask_code
     execution_type=remote_translation, capability=null           prompt_translate.translate_prompt (AI gateway)
                                                                   3 variants + cleaned + (best-effort) edge-TTS
        ┌──────────────── POST /api/worker/tasks/result ◄─────────┘  rate-exhausted → pause + 'failed' (re-pend)
        ▼
  PromptTranslationTaskProcessor  (result-trust: english required)
        ├──► AppQyV1DailySentenceService.ingestFromAssist  (writes audio mp3, returns served url)
        └──► DeveloperHistoryService.recordPromptTranslation  (prompt_translations.json + assist_state.json)
```

## 2. Canonical task contract (`prompt_translation`)

- **Enqueue** (`createTask`): `app_name=AppQyV1`, `task_type=prompt_translation`,
  `execution_type=remote_translation`, `capability=null` (MUST be null — the worker dispatches
  `capability=='ai_translate'` to the word path before checking task_type), `timeout=600`.
  Payload: `{ prompt_id, text, source_lang, want_audio:true, variants:3 }`.
- **Result** (flat or `{result:{…}}`): `{ prompt_id, detected_language, english, cleaned,
  variants:[3], audio_base64?, audio:{language,…}? }`. `validateResultShape` requires `english`.

## 3. Backend (laravel_main) — implemented

| File | Role |
|------|------|
| `app/Utils/LanguageDetector.php` | public Unicode zh/en/ja/ko detector (`detect`, `isNonEnglish`) |
| `app/Services/DeveloperHistory/DevHistoryAssistService.php` | scan+enqueue (deduped/capped), summary, recent |
| `app/Services/TaskProcessors/PromptTranslationTaskProcessor.php` | dual-write write-back (registered in `TaskManagerService`) |
| `app/Services/DeveloperHistory/DeveloperHistoryService.php` | `recordPromptTranslation`, `readStore/writeStore`, prompt `lang` tag + search/pagination, translations attached to `readPrompts` |
| `app/Apps/AppQyV1/AppQyV1Services/AppQyV1DailySentenceService.php` | file store under `laravel_db/daily_sentences` + audio bytes |
| `app/Http/Controllers/DevHistoryController.php` | `prompts` (q/page), `assist`, `assist/scan` |
| `app/Http/Controllers/AppQyV1DailySentenceController.php` | `list`, `recommend`, `audio/{id}` |
| `app/Services/TimerTasks/DeveloperHistoryExtractionTask.php` | 10s: extract → `scanAndEnqueue` |
| `routes/api.php` | `dev-history/{assist,assist/scan}` (local.only); `app_qy_v1/daily-sentences/{list,recommend,audio/{id}}` (public) |

## 4. pycore — implemented

| File | Role |
|------|------|
| `pyutils/translator/code_filter.py` | mask/unmask fenced/inline/indented code (regex; pygments optional) |
| `pyutils/translator/prompt_translate.py` | code-aware AI translate → `{english,cleaned,variants,exhausted}` |
| `callmodule/services/translation_worker_service.py` | `_process_prompt_translation_task` + `_prompt_ai_pause*` (rate pause) |

No new pip deps: code filter is pure-regex; translation reuses the shared AI gateway
(`pyctl.ai.generate_text`); audio reuses the existing edge-TTS path. `pyservice.sh` therefore needs
no new installer for this feature. (If `lingua-language-detector` is later wanted for pycore-side
detection, add an `iniscripts/install_*.sh` delegator + `third_party.py` DEPENDENCY_MAP entry.)

Rate-limit pause: shared store `<core_node>/.data/.ai_state/ai_rate_usage.json` already drives the
gateway; on `No AI provider available` the worker sets `_prompt_ai_pause_until` and re-pends the task.

## 5. UI — implemented

- **laravel-manager** DevHistory: server-side prompt **search + pagination**; prompts language-tagged;
  English **translation shown inline** with audio. Task Center: new **Assist Distribution** tab
  (`AssistDistributionPanel`) — status counts + recent tasks + manual scan.
- Shared API modules: `DevHistoryAPI` (q/page/assist), `DailySentenceAPI`.
- **DailyReading** component (`components/views/DailyReading.tsx`) — recommendation + audio + 3 variants
  + history; consumes `api.dailySentences`.

## 6. Remaining wiring (follow-ups)

1. **wordnew mount**: import `DailyReading` into `apps/wordnew/WfNewApp.tsx` and add a nav/dock entry
   (the component is self-contained and calls `api.dailySentences`). wordnew's `wordflow` end already
   targets Laravel :9000.
2. **pycore-manager assist records**: add an `assistRecords` tab to
   `apps/pycore-manager/pages/PcQueueCenterPage.tsx` + `PycoreApi.getAssistRecords`
   (`/pyapi/api/local/assist/records`). Assist tasks already flow through the shared recent-tasks ring,
   so this can read the existing recent feed filtered by `task_type=prompt_translation` until a
   dedicated pycore endpoint is added.
3. **mcp-chrome web-translate** (BLOCKED): the extension build currently has **4 unresolved git
   merge-conflict markers** (`bing-dictionary-worker-service.ts`, `task-center/SimpleWorkerBase.ts`,
   `init-processors.ts`, `TaskDetailModal.vue`) — resolve those first. Then add two web-operation tools
   `tools/browser/gemini-web.ts` + `chatgpt-web.ts` (clone `gemini-image.ts`/`notebooklm.ts`) with paired
   `inject-scripts/*-helper.js`, and retarget `web-ai-translate-worker-service.ts` (currently DeepSeek)
   to drive the Gemini/ChatGPT web pages instead of an AI API. The popup task-center is already mounted
   (App.vue "Tasks" tab) — the old "unmounted" note is stale.

## 7. Reuse map (do NOT reinvent)

| Need | Already exists — reuse |
|------|------------------------|
| AI rate/quota + pause | shared `.data/.ai_state/ai_rate_usage.json` (pycore `ai_rate_limits.py` ≡ Laravel `AiRateLimiter.php`) |
| TTS audio | `pyutils/tts/tts_orchestrator` (edge → sherpa → melotts), worker `_synthesize_word_audio` |
| Task substrate | `global_tasks` PULL (`/api/worker/{register,tasks/pull,tasks/result}`) + `TaskProcessorRegistry` |
| File-store conventions | `PathMapper::getLaravelDatabaseDir(...)`, atomic temp+rename writes |
| Language codes | `AppQyV1TranslationService::LANGUAGES` (en/zh/ja/ko) |
