# AppQyV1 Word-Media Pipeline — Shared Contract v1

Canonical, single source of truth for the cross-stack "word media on-demand
resolution + assist queue + on-query prioritization" feature. The Laravel
backend (app `AppQyV1`) OWNS this contract; pycore, chrome-mcp, and the frontend
implement their ends against it. Do NOT rename routes / columns / payload keys.

This document reflects the REAL Laravel implementation (file paths below).

---

## 1. Paths (unified static tree, so `laravel_db` copies cleanly)

| Asset | On-disk location | Public serve URL |
|-------|------------------|------------------|
| Word images | `laravel_db/static/app_qy_v1/word_images/{lang}/word/{md5}.{ext}` | `/static/app_qy_v1/word_images/{lang}/word/{md5}.{ext}` |
| Word/sentence TTS audio | `laravel_db/static/app_qy_v1/audio/{lang}/{type}/{file}` (`type` in `word`, `sentence`) | `/api/app_qy_v1/ai_tools/tts/audio/{language}/{type}/{filename}` (and `/{speed}/` variant) |
| Sentence-library audio | `laravel_db/static/app_qy_v1/audio/sentence_sounds/{lang}/{file}` | `/static/app_qy_v1/sentence_sounds/{language}/{filename}` |

PathMapper helpers (the ONLY way to resolve these — never raw
`storage_path()` / `base_path()` / `env('*_PATH')` / concatenation):

- `PathMapper::getAppQyV1WordImagesDir($subPath)` → word-images base (static tree).
- `PathMapper::getAppQyV1AudioBaseDir($subPath)` → **NEW** canonical word/sentence-TTS
  audio base (`static/app_qy_v1/audio`). Write target == serve base (no split-brain).
- `PathMapper::getAppQyV1AudioDir()` / `getAppQyV1SentenceSoundsDir()` → derive from
  `getAppQyV1AudioBaseDir()` under `word_sounds` / `sentence_sounds`.

Phase-1 move: the TTS audio base moved from `laravel_db/tts_data/audio` to
`laravel_db/static/app_qy_v1/audio`. Stored `tts_files[].path` relative values
(`{lang}/{type}/{file}`) are UNCHANGED — only the physical base moved. Legacy
audio is idempotently COPIED (never moved/deleted) into the new tree at sys:init
by `AppQyV1AudioStaticMigrator` (sentinel-guarded, runs once).

---

## 2. DB columns — per-language dictionary table `{prefix}_tts_cache_{lang}`

Model `AppQyV1LangDictionaryModel`; table name via
`AppQyV1TableMaps::getDictionaryTableName($lang)`.

Existing translation columns: `translations` (json), `has_translation`,
`translation_provider`, `phonetic`, `us_phonetic`, `uk_phonetic`.

Existing image column: `image_files` (json), `image_provider`. (Image presence
is derived from `image_files` being non-empty — there is no `has_image` column.)

Existing TTS queue columns: `tts_status`, `tts_priority`, `tts_locked_at`,
`tts_locked_by`, `tts_attempts`, `tts_requested_at`, `tts_completed_at`,
`has_audio`, `tts_files` (json).

**NEW image queue columns** (migration
`database/migrations/AppQyV1_2026_06_20_000010_add_image_state_columns_to_dictionary_tables.php`,
mirrors the `tts_*` set; cross-DB safe; idempotent per-column guards; no-op down):

| Column | Type | Notes |
|--------|------|-------|
| `image_status` | string(20), nullable, indexed | `null` \| `pending` \| `processing` \| `completed` \| `failed` |
| `image_priority` | int, default 0, indexed | higher = sooner |
| `image_locked_at` | datetime, nullable | claim time |
| `image_locked_by` | string(100), nullable | processor identity |
| `image_attempts` | int, default 0 | retry bookkeeping |
| `image_requested_at` | datetime, nullable | first request time |
| `image_completed_at` | datetime, nullable | last success time |

`AppQyV1WordImageQueueService` PRIORITY constants: `PRIORITY_DEFAULT = 30`,
`PRIORITY_FRONT = 100`.

---

## 3. Endpoints

### 3.1 P2 — resolve word media (file-first; enqueue+pending on miss)

```
GET /api/app_qy_v1/word/{lang}/{word}/media
    ?target_language=zh        (optional)
```
No auth (public — same trust level as `words/public`). Controller
`AppQyV1WordMediaController::media` → `AppQyV1WordMediaService::resolve`.

Response:
```json
{ "success": true,
  "data": {
    "word": "...", "md5": "...", "language": "en",
    "image_url": "/static/app_qy_v1/word_images/en/word/<md5>.png | null",
    "audio_url": "/api/app_qy_v1/ai_tools/tts/audio/en/word/<file>.mp3 | null",
    "image_status": "ready | pending | none",
    "audio_status": "ready | pending | none",
    "translations": ["..."],
    "explanation": "... | null",
    "phonetic": "... | null", "us_phonetic": "... | null", "uk_phonetic": "... | null"
  } }
```
FILE-FIRST: `image_url` / `audio_url` are non-null ONLY when the file is on disk.
On a miss the word is enqueued (image queue + TTS queue) and a `word_media`
global task is ensured/bumped to the FRONT; the relevant status becomes
`pending`. The active query bumps the word to the FRONT of every queue layer.

### 3.2 P2 — smart image serve ("request by word, not filename")

```
GET /static/app_qy_v1/word_images/{lang}/{word}      (word, NOT md5.ext)
```
Controller `AppQyV1WordImageController::serveByWord`. `{word}` is a single
no-slash segment, so it never shadows the 3-segment md5 path. File-first: `302`
redirect to the resolved md5 file URL when ready; on a miss it enqueues + bumps
the `word_media` task and returns a 1×1 transparent PNG with HTTP `202`
(`X-Word-Image-Status: pending`).

The existing md5-path route stays UNCHANGED and keeps working:
```
GET /static/app_qy_v1/word_images/{path}             (e.g. en/word/<md5>.png)
```

### 3.3 P3 — image enqueue

```
POST /api/app_qy_v1/ai_tools/word_image/queue/add
Body: { "words": [ { "word": "...", "language": "en" } ], "priority"?: "front" }
```
No auth. Controller `AppQyV1WordImageQueueController::add` →
`AppQyV1WordImageQueueService::addBatch`. `priority: "front"` (or `beginning` /
`high`) moves each word to the head (`image_priority = 100`); otherwise queued at
`image_priority = 30`. Per-word result `status`:
`already_available | moved_to_front | queued`.

### 3.4 P3 — audio enqueue (REUSE existing)

```
POST /api/app_qy_v1/ai_tools/tts/queue/batch/add     (AppQyV1UnifiedTTSQueueService)
```
Not duplicated. Same add semantics (`PRIORITY_FRONT = 100`,
`moved_to_front` / `queued` / `already_available`).

---

## 4. Worker / assist channel (shared with pycore + chrome-mcp)

Words missing media become global tasks pulled via the EXISTING worker channel:

```
GET  /api/worker/tasks/pull     ?worker_id=...&limit=...
POST /api/worker/tasks/result   { task_id, worker_id, status, result, error? }
```

Tasks are pulled `WHERE execution_type = <worker processor type> ORDER BY priority DESC`.

### 4.1 TWO assist lanes (one task type each)

| task_type | execution_type | Worker | Created when the word is missing | Fills |
|-----------|----------------|--------|----------------------------------|-------|
| **`word_media`** | **`remote_client`** | chrome Bing-assist | IMAGE **or** TRANSLATION | translation + phonetics + sample images + pronunciation (Bing fills all three) |
| **`word_audio`** | **`remote_audio`** | pycore local-TTS | AUDIO | pronunciation audio |

`remote_audio` is a first-class worker/execution type:
`GlobalTask::EXECUTION_REMOTE_AUDIO = 'remote_audio'`, accepted by the worker
register validation (`WorkerController` processor_types `in:`) and the task
create validation (`TaskController` execution_type `in:`).

A word missing ALL THREE legitimately gets BOTH tasks (intended redundancy):
chrome fills everything, pycore fills audio. The write-back is fill-missing /
idempotent so concurrent completion is safe. A new query bumps BOTH tasks'
priority to the front. Tasks are deduped per type (a word already owned by a
pending task of that type is only bumped, never duplicated). Created/bumped by
`AppQyV1WordMediaService::ensureWordMediaTask(..., $needsChrome, $needsAudio)`.

### 4.1b Real pronunciation source chain (pre-fetch before TTS)

Before either lane's TTS fallback runs, a missing `word_audio` is first tried
against a chain of REAL (non-synthetic) pronunciation sources — a
native-speaker / dictionary recording is strictly preferred over TTS
synthesis, which is now the LAST resort rather than the only path:

- **pycore** (`pycore/pyutils/external_apis/word_audio_client.py`,
  `find_pronunciation(word, lang)`): **Free Dictionary API -> Cambridge
  Dictionary -> Forvo**, in that order. Called synchronously at the top of the
  `word_audio` / `remote_audio` worker's `_process_audio_task`
  (`translation_worker_service.py`) — a source hit sets the result's `engine`
  to the source's provider name (`free_dictionary_api` | `cambridge_dictionary`
  | `forvo`) instead of a TTS engine name; only a full miss falls through to
  the existing `_synthesize_word_audio()` -> `tts_orchestrator` path,
  unchanged.
- **Laravel** (`app/Services/WordAudio/WordAudioClient.php`,
  `findPronunciation($word, $langCode)`): **Free Dictionary API -> Forvo
  only** — deliberately NO Cambridge Dictionary source. Cambridge has no
  public REST API; producing its audio needs fetching + HTML-parsing the
  dictionary page, a technique reserved for pycore only so the PHP client
  stays a clean REST-API-only chain. Wired synchronously into
  `AppQyV1WordMediaService::resolve()`'s `!$hasAudio` branch via the private
  `fetchRealPronunciation()` helper: on a hit the bytes are persisted
  immediately through the existing
  `AppQyV1DictionaryTTSCoordinator::storeWordAudioBytes` (fill-missing,
  MP3-magic-validated), so the SAME response already reflects
  `audio_status:'ready'`; only a miss falls through to the existing
  `enqueueTts()` + `word_audio` global-task path, unchanged.

The two provider label strings that exist on both sides
(`free_dictionary_api`, `forvo`) are shared verbatim, so pycore and Laravel
record identical `translation_provider` / `engine` values for the same
source. Forvo is the OFFICIAL PAID API (`apifree.forvo.com`) on both sides,
gated behind a `FORVO_API_KEY` secret (`get_secret_key_indexed` /
`AiSecretLoader::getIndexed`) — silently skipped with zero network calls when
the key is absent, with a 401/403 circuit breaker latch on both sides.

Deliberately excluded on BOTH sides, everywhere: **YouGlish** (video-embed
widget, no downloadable/cacheable audio file, ToS forbids scraping it) and any
**Forvo scraping / anti-bot-bypass** path for Forvo's free web tier (that tier
is protected by anti-scraping checks and must not be circumvented — Forvo is
used ONLY through its official paid API, never scraped).

### 4.2 Payload + result shape (identical for both lanes)

- Task payload:
  ```json
  { "words": [ { "word": "...", "md5": "..." } ],
    "language": "en", "target_language"?: "zh", "word_count": 1 }
  ```
- Result (same shape as `word_translation`):
  ```json
  { "translations": [ { "word": "...", "translation"?: "...",
        "phonetic"?, "us_phonetic"?, "uk_phonetic"?,
        "image_base64"?: [ {base64, mime?} ] | string[],  // sample images (bytes)
        "audio_base64"?: "<raw base64 string>" } ],         // pronunciation (bytes)
    "invalid_words"?: [ {word, md5} | "word" ],             // objects OR bare strings
    "region_redirect_words"?: [ {word, md5} | "word" ],     // objects OR bare strings
    "provider": "bing" | "pycore" | ... }
  ```

`image_base64` is the chrome ARRAY form `[{base64, mime?}]` (bare `string[]` also
accepted by `normalizeImageBase64`). `audio_base64` is a raw base64 string.
`invalid_words` / `region_redirect_words` are accepted as ARRAYS OF OBJECTS
`{word, md5}` (the chrome Bing worker form) OR bare strings — `apply()` reads
`$entry['word']` when an object, the value itself when a string.

AUDIO and IMAGES are BASE64/BINARY ONLY — the source media URLs are NOT fetchable
server-side, so the worker captures the bytes in-page. No server-side URL fetch
anywhere.

The result routes `TaskManagerService::submitResult` →
`WordTranslationTaskProcessor` (its `canProcess` accepts `word_translation`,
`word_media` AND `word_audio`) → `AppQyV1WordTranslationWriteback::apply`, which:
- persists `translation` (flat map + nested `word_translation` pairs),
- fill-missing phonetics,
- decodes/validates/stores `image_base64` as LOCAL files → `image_files`
  (and flips `image_status='completed'`),
- decodes/stores `audio_base64` via `AppQyV1DictionaryTTSCoordinator::storeWordAudioBytes`
  (flips `has_audio` + `tts_status='completed'`),
- flags `invalid_words` / `region_redirect_words` as `is_valid=false` placeholders.

It NEVER early-returns when a translation already exists — image/audio are filled
independently (fill-missing).

A direct-push twin (no global-task round-trip), same writeback:
```
POST /api/app_qy_v1/ai_tools/translation/queue/submit-bing
```

---

## 5. On-query prioritization (bump to FRONT)

Any single-word / page lookup bumps the queried word to the FRONT of every queue
layer when it lacks IMAGE **or** AUDIO **or** TRANSLATION. Driven by
`AppQyV1WordMediaService::bumpQueriedWord` (cheap, non-blocking, swallows its own
failures):

- `global_tasks.priority` → `100` (ensure + bump the pending `word_media` AND/OR
  `word_audio` task — only the lane(s) whose resource is missing).
- dictionary `image_priority` → `100` (via `AppQyV1WordImageQueueService`).
- dictionary `tts_priority` → `100` (via `AppQyV1UnifiedTTSQueueService` `beginning`).

Wired into:
- `AppQyV1WordQueryController::bumpUntranslatedQuery` (now also bumps media), which
  is called from `wordExists`, `queryWordEnhanced`, `checkWord`, `searchWords`
  (exact term only), `publicWordLookup`.
- `AppQyV1VocabularyLibraryPublicController::getLibraryWords` (page words missing
  image/audio, capped at 50).
- `AppQyV1WordMediaController::media` and the smart image-serve route.

---

## 6. Files (Laravel backend)

Created:
- `app/Apps/AppQyV1/Utils/AppQyV1AudioStaticMigrator.php`
- `database/migrations/AppQyV1_2026_06_20_000010_add_image_state_columns_to_dictionary_tables.php`
- `app/Apps/AppQyV1/AppQyV1Services/AppQyV1WordImageQueueService.php`
- `app/Apps/AppQyV1/AppQyV1Services/AppQyV1WordMediaService.php`
- `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1WordQurey/AppQyV1WordMediaController.php`
- `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1AITools/AppQyV1WordImageQueueController.php`
- `app/Services/WordAudio/WordAudioClient.php` (real pronunciation source chain; see §4.1b)
- `app/Apps/AppQyV1/docs/AppQyV1_WORD_MEDIA_PIPELINE.md` (this doc)

Modified:
- `app/Providers/PathMapper.php` (`getAppQyV1AudioBaseDir` + repointed audio helpers)
- `app/Services/EdgeTTS/EdgeTTSService.php`, `app/Apps/AppQyV1/Utils/AppQyV1AITools/AppQyV1TTSService.php` (audio base → static tree)
- `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Vocabulary/AppQyV1VocabularyLibraryPublicController.php` (audio reader + page bump)
- `app/Apps/AppQyV1/Utils/AppQyV1SystemInit/AppQyV1ExternalStorageManager.php` (create static audio dirs)
- `app/Apps/AppQyV1/Utils/AppQyV1Initializer.php` (sys:init: ensureDirectoryStructure + audio migrator)
- `app/Apps/AppQyV1/AppQyV1Models/AppQyV1LangDictionaryModel.php` (image_* fillable + casts)
- `app/Apps/AppQyV1/AppQyV1Services/AppQyV1WordTranslationWriteback.php` (image_status completion)
- `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1AITools/AppQyV1WordImageController.php` (serveByWord)
- `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1WordQurey/AppQyV1WordQueryController.php` (media bump in lookups)
- `app/Apps/AppQyV1/AppQyV1Services/AppQyV1WordMediaService.php` (two-lane word_media/word_audio task creation)
- `app/Services/TaskProcessors/WordTranslationTaskProcessor.php` (accept word_media + word_audio)
- `app/Models/GlobalTask.php` (EXECUTION_REMOTE_AUDIO constant)
- `app/Http/Controllers/WorkerController.php` (register processor_types `in:` adds remote_audio)
- `app/Http/Controllers/TaskController.php` (create execution_type `in:` adds remote_audio)
- `routes/static.php`, `routes/AppQyV1Router/AppQyV1Words.php`, `routes/AppQyV1Router/AppQyV1AITools.php`
