# AppQyV1 Task Center Pipeline — Shared Contract v3

Canonical, single source of truth for the cross-stack **Task Center**: the set of
global task TYPES, the worker pull/result channel, the notify signal
(`pending_urgent` + long-poll), prioritization, and the chrome Task Center
worker's responsibilities. The Laravel backend (app `AppQyV1`) **OWNS** this
contract; pycore and chrome-mcp implement their ends against it. Do NOT rename
task types, routes, payload keys, or result keys.

Cross-references:
- `app/Apps/AppQyV1/docs/AppQyV1_WORD_MEDIA_PIPELINE.md` — the word_media /
  word_audio media-on-demand lanes and on-query prioritization this builds on.
- `docs/GLOBAL_TASK_SYSTEM_SETUP.md`, `docs/GLOBAL_TASK_SYSTEM_FILES.md`,
  `docs/WORD_TRANSLATION_PIPELINE.md` — the global_tasks + workers substrate.
- pycore-side Queue Center overview consumes `GET /api/app_qy_v1/assist/overview`
  (SHARED CONTRACT v2 shape, now extended — see §6).

---

## 1. The worker channel (existing substrate)

All work rides ONE table (`global_tasks`) and ONE worker registry (`workers`).
Routes (NO-AUTH; only Sanctum stateful boot stripped — see `routes/api.php`
`prefix('worker')` and `WorkerController`):

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/worker/register` | Register a worker + its `processor_types[]`. |
| POST | `/api/worker/heartbeat` | Keep-alive. Response now carries `pending_urgent` (§4). |
| GET  | `/api/worker/tasks/pull` | **Long-poll** atomic pull+assign. Response carries `pending_urgent` (§4). |
| POST | `/api/worker/tasks/accept` | Idempotent acknowledgment (pull already assigns). |
| POST | `/api/worker/tasks/result` | Submit `processing` / `completed` / `failed`. Routes to a processor (§3). |
| GET  | `/api/worker/list`, `/api/worker/stats` | Roster / counters. |

`pullAndAssignTasksForWorker` (in `app/Services/TaskManagerService.php`) iterates
the worker's `processor_types` and selects
`WHERE execution_type = <processorType> AND status='pending'
ORDER BY priority DESC, created_at ASC`, locking + assigning atomically.

Registered processor execution types (validated in `WorkerController::register`
and `TaskController::create`): `remote_compute, remote_ocr, remote_translation,
remote_video, remote_io, remote_client, remote_audio, remote_notebooklm,
remote_gemini`. (`remote_notebooklm` / `remote_gemini` added in v3 — see §2.)

---

## 2. Task types

Every task is `app_name='AppQyV1'`. `execution_type` is the worker LANE (which
processor_type pulls it); `task_type` is what the worker DISPATCHES on.

| task_type | execution_type | Worker | Payload | Result | Write-back |
|-----------|----------------|--------|---------|--------|------------|
| `word_translation` | `remote_translation` | pycore Google / Laravel self-filler | `{words:[{word,md5}], language, target_language?}` | `{translations:[{word,translation,phonetic?,…,image_base64?,audio_base64?}], target_language, provider, invalid_words?, region_redirect_words?}` | `WordTranslationTaskProcessor` → `AppQyV1WordTranslationWriteback::apply` |
| `word_media` | `remote_client` | chrome Bing-assist | same as word_translation (chrome fills translation + phonetics + sample images + pronunciation) | same shape | same write-back (fill-missing/idempotent) |
| `word_audio` | `remote_audio` | pycore local-TTS | `{words:[{word,md5}], language}` | `{translations:[{word,audio_base64}]}` | same write-back |
| **`notebooklm`** *(NEW v3)* | `remote_notebooklm` | chrome Task Center (`chrome_notebooklm`) | `{question\|source_text, notebook_url?, title?}` | `{result:{answer?, notebook_url?, provider:'notebooklm'}}` | `NotebookLmTaskProcessor` → row in `app_qy_v1_notebooklm_results` |
| **`gemini_image`** *(NEW v3)* | `remote_gemini` | chrome Task Center (`chrome_gemini_image`) | `{prompt, word, language, size?, md5?}` — **`word` + `language` REQUIRED for storage** (prompt-only = lane test, result dropped) | `{result:{image_base64, mime:'image/png', provider:'gemini'}}` | `WordGeminiImageTaskProcessor` → `AppQyV1WordTranslationWriteback::apply` (image_files; image is magic-byte validated, reported mime dropped) |

`word_media` STAYS on `remote_client`. `notebooklm` / `gemini_image` get their
OWN execution_types — the chrome side runs a SEPARATE worker per execution_type,
and pull assigns by execution_type with an atomic claim, so distinct lanes are
required or the NotebookLM/Gemini workers would claim `word_media` tasks (and
each other's) and starve them until timeout. Each worker dispatches by
`task_type` within its own lane.

---

## 3. Result write-back (processor registry)

`POST /api/worker/tasks/result` → `TaskManagerService::submitResult` →
`processTaskResultInTransaction` → `TaskProcessorRegistry::process`, which routes
to the first processor whose `canProcess($task)` matches
(`app/Services/TaskProcessors/`). Registered in
`TaskManagerService::getProcessorRegistry()`:

- `DictionaryTaskProcessor` — `dictionary_explanation[_demo]`.
- `WordTranslationTaskProcessor` — `word_translation` / `word_media` / `word_audio`.
- **`NotebookLmTaskProcessor`** *(NEW)* — `notebooklm`. Persists
  `{task_id,title,question,answer,notebook_url,provider}` to
  `app_qy_v1_notebooklm_results` (model `App\Models\AppQyV1NotebookLmResult`,
  migration `AppQyV1_2026_06_20_000201_create_app_qy_v1_notebooklm_results_table`).
  Accepts the artifact nested under `result.result` or flat. Never throws from
  the worker-result transaction.
- **`WordGeminiImageTaskProcessor`** *(NEW)* — `gemini_image`. Reshapes the single
  gemini image into the writeback's `translations[]` `image_base64` entry and
  calls `AppQyV1WordTranslationWriteback::apply`, so the image is decoded,
  magic-byte validated, written under `PathMapper::getAppQyV1WordImagesDir`, and
  recorded in `image_files` by the SAME fill-missing/idempotent code the Bing
  lane uses (no second image-writer). Word resolved from `payload.word` or
  `payload.words[0]`.

Idempotency: `submitResult` acknowledges re-delivered terminal-status results
WITHOUT reprocessing; the image/audio writeback is fill-missing (never clobbers
existing media), so concurrent Bing + gemini completion of the same word is safe.

---

## 4. Notify signal — `pending_urgent` + long-poll

`/api/worker/tasks/pull` is a **long-poll**: when the queue is momentarily empty
it waits up to `MAX_LONG_POLL_SECONDS` (20s, clamped) re-checking every 0.5s via a
cheap unlocked `COUNT`, and returns the instant a task appears
(`TaskManagerService::pullAndAssignTasksLongPoll`). The optional `wait` query
param (0–30s) overrides the budget; `wait=0` restores legacy immediate return.
The wait is COUNT polling, never a held DB lock.

Both the **pull** and **heartbeat** responses include:

```
"pending_urgent": <int>   // count of PENDING tasks with priority >= 100
                          // for THIS worker's processor_types
```

(`TaskManagerService::countUrgentPending` / `workerProcessorTypes`.) A non-zero
value tells the worker to pull immediately / poll faster. Because a resolve or
library-words query bumps missing-media tasks to **priority 100**, a fresh
user-visible request raises `pending_urgent` and is picked up promptly.

Worker guidance: long-poll the pull; between pulls, heartbeat — if
`pending_urgent > 0`, pull again right away instead of idling.

---

## 5. Prioritization

`global_tasks.priority` (higher = sooner; pull orders `priority DESC`):

- Front-of-queue bump = **100** (`AppQyV1WordMediaService::TASK_PRIORITY_FRONT`).
- Backfill enqueue default = 30; manual enqueue default = 50.
- Resolve endpoint (`AppQyV1WordMediaController::media` →
  `AppQyV1WordMediaService::resolve` / `bumpQueriedWord`) bumps a queried word's
  pending media tasks to 100.
- **Vocabulary library words** (`AppQyV1VocabularyLibraryPublicController::getLibraryWords`
  → `bumpPageMediaToFront`) bumps every page word lacking image/audio to 100 —
  so opening `…/wordnew#/library/3?page=1&view=table` prioritizes that library's
  missing-media words. (Verified present; capped at 50 words/page.)

`pending_urgent` (§4) counts exactly these priority≥100 pending tasks.

---

## 6. Overview (Queue Center / Task Center display)

`GET /api/app_qy_v1/assist/overview` → `AppQyV1AssistService::overviewSnapshot`
(cached 30s, `?fresh=1` bypass). `categories[]` now ALSO includes:

- `notebooklm` (handler `chrome`) — `AppQyV1AssistService::notebookLmCounts`.
- `gemini_image` (handler `chrome`) — `AppQyV1AssistService::geminiImageCounts`.

Each is a pure global-task category (pending/processing/leased/total + sample)
from `globalTaskStatusCounts(<task_type>)`, alongside the existing
word_translation / word_image / word_audio / sentence_audio / subtitle_lang /
book_lang / cover / poster categories.

---

## 7. Manual enqueue (operator / admin)

`POST /api/app_qy_v1/ai_tools/task/enqueue` — NO-AUTH control plane (same trust
level as the translation-queue control plane and `/api/worker/*`).
`AppQyV1TaskEnqueueController::enqueue`.

Body: `{ task_type, payload?, priority?, timeout_seconds?, max_retries? }`.
`execution_type` is FIXED per `task_type` (the caller cannot mis-route):

| task_type | execution_type |
|-----------|----------------|
| `notebooklm` | `remote_notebooklm` |
| `gemini_image` | `remote_gemini` |
| `word_media` | `remote_client` |
| `word_audio` | `remote_audio` |
| `word_translation` | `remote_translation` |

Minimal payload guards (HARD requirements only — the enqueue is deliberately
permissive): `notebooklm` requires `question`/`source_text`; `gemini_image`
requires `prompt`; `word_*` require `language`. NOTE for `gemini_image`: `prompt`
is the only hard requirement so a lane test can be enqueued, but `word` +
`language` SHOULD also be supplied — the write-back attaches the image to the
dictionary row for `word`, so a prompt-only task's result is dropped (the
processor logs and skips it). Default priority 50 (use 100 to jump to the front).
Returns the created `task_id`.

OPTIONAL future routing: `AppQyV1WordImageQueueService` / `WordMediaService` MAY
create a `gemini_image` task instead of (or in addition to) `word_media` when an
operator prefers Gemini for missing images — gate behind a setting; the DEFAULT
keeps `word_media`. Not enabled by default; the manual enqueue is the supported
path today.

---

## 8. Chrome Task Center responsibilities

The chrome side runs a SEPARATE worker per processor type (never one worker
spanning multiple lanes), because pull assigns by execution_type with an atomic
claim — a shared lane would let one feature's worker claim and starve another's:

- Bing-assist worker: `processor_types: ['remote_translation', 'remote_client']`
  (word_translation + word_media).
- NotebookLM worker: `processor_types: ['remote_notebooklm']`.
- Gemini-image worker: `processor_types: ['remote_gemini']`.

Each worker:

1. Long-polls `GET /api/worker/tasks/pull`; reacts to `pending_urgent`.
2. Dispatches by `task_type` within its own lane:
   - `word_media` → Bing dictionary scrape (translation + phonetics + images +
     audio), captured in-page as base64 (Bing media URLs are not fetchable
     server-side).
   - `notebooklm` → `chrome_notebooklm` MCP tool; returns `{answer, notebook_url}`.
   - `gemini_image` → `chrome_gemini_image` MCP tool; returns `{image_base64,
     mime, provider:'gemini'}`.
3. POSTs `{task_id, worker_id, status:'completed', result:{…}}` to
   `/api/worker/tasks/result`.

All media/images are **base64-only** end to end — there is NO server-side
URL fetch for word media (§ WORD_MEDIA_PIPELINE).

---

## 9. Files

- `app/Http/Controllers/WorkerController.php` — pull (long-poll + pending_urgent), heartbeat (pending_urgent).
- `app/Services/TaskManagerService.php` — long-poll, countUrgentPending, processor registration.
- `app/Services/TaskProcessors/NotebookLmTaskProcessor.php` *(NEW)*.
- `app/Services/TaskProcessors/WordGeminiImageTaskProcessor.php` *(NEW)*.
- `app/Models/AppQyV1NotebookLmResult.php` *(NEW)*.
- `database/migrations/AppQyV1_2026_06_20_000201_create_app_qy_v1_notebooklm_results_table.php` *(NEW)*.
- `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1AITools/AppQyV1TaskEnqueueController.php` *(NEW)*.
- `routes/AppQyV1Router/AppQyV1AITools.php` — `task/enqueue` route.
- `app/Apps/AppQyV1/AppQyV1Services/AppQyV1AssistService.php` — notebookLmCounts / geminiImageCounts + overview categories.
- `app/Apps/AppQyV1/AppQyV1Services/AppQyV1WordTranslationWriteback.php` — reused image storage (gemini_image).
- `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Vocabulary/AppQyV1VocabularyLibraryPublicController.php` — library-words priority bump (verified).
