# TTS Queue Management – Frontend/Backend Contract

## How the dashboard talks to the backend

- **API**: `GET /api/app_qy_v1/ai_tools/tts/queue/stats`
- **Frontend**: `VocabularyLearning.tsx` → `api.appQyV1.getTTSQueueStats()` (no auth, no cache).
- **Backend route**: `poly_apps/laravel_main/routes/AppQyV1Router/AppQyV1AITools.php`  
  `Route::get('/queue/stats', [AppQyV1TTSQueueController::class, 'getStatistics']);`  
  (under prefix `app_qy_v1/ai_tools/tts`, no auth middleware.)
- **Controller**: `App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TTSQueueController::getStatistics()`
- **Service**: `App\Apps\AppQyV1\AppQyV1Services\AppQyV1UnifiedTTSQueueService::getStatistics()`  
  Controller then merges in `recent_logs` and `logs_count` via `addLogsToResponse()`.

---

## Response shape the backend must return

The API must return JSON like:

```json
{
  "success": true,
  "data": {
    "by_status": {
      "pending": 0,
      "processing": 0,
      "completed": 0,
      "failed": 0
    },
    "by_type": {
      "word": 0,
      "sentence": 0,
      "article": 0
    },
    "total": 0,
    "current_concurrent": 0,
    "total_success": 0,
    "total_retries": 0,
    "recent_logs": [],
    "logs_count": 0
  }
}
```

### Field usage on the UI

| Field | UI usage |
|-------|----------|
| `data.by_status.pending` | Status Statistics – Pending |
| `data.by_status.processing` | Status Statistics – Processing |
| `data.by_status.completed` | Status Statistics – Completed |
| `data.by_status.failed` | Status Statistics – Failed |
| `data.total` | Status Statistics – Total |
| `data.by_type.word` | Type Statistics – Word |
| `data.by_type.sentence` | Type Statistics – Sentence |
| `data.by_type.article` | Type Statistics – Article |
| `data.current_concurrent` | Additional Information – Current Concurrent |
| `data.total_success` | Additional Information – Total Success (fallback: `by_status.completed`) |
| `data.total_retries` | Additional Information – Total Retries |
| `data.recent_logs` | Recent Logs table (array of log objects) |
| `data.logs_count` | Recent Logs title count |

### Shape of each item in `recent_logs`

The frontend expects each element to have:

| Field | Type | UI |
|-------|------|-----|
| `id` | number | ID column |
| `content_text` | string | Content column |
| `task_type` | string | Type column (word / sentence / article) |
| `language` | string | Language column |
| `status` | string | Status column (pending / processing / completed / failed) |
| `priority` | number | Priority column |
| `retry_count` | number | Retries column |
| `requested_at` | string (ISO8601) | Time column |
| `started_at` | string (ISO8601) | Time column |
| `completed_at` | string (ISO8601) | Time column |
| `error_message` | string (optional) | Shown in extra row when present |

---

## Backend implementation (laravel_main)

- **Statistics**: `AppQyV1UnifiedTTSQueueService::getStatistics()`  
  Returns `by_status`, `by_type`, `total`, `current_concurrent` (from `EdgeTTSService::getConcurrentCount()`), `total_success` (= completed count), `total_retries` (sum of `retry_count`). Cached 10 seconds.
- **Logs**: `AppQyV1UnifiedTTSQueueService::getRecentLogs($limit)`  
  Returns `{ total, limit, logs }`. Each log: `id`, `task_type`, `content_text` (truncated 50 chars), `language`, `status`, `priority`, `retry_count`, `error_message`, `audio_path`, `requested_at`, `started_at`, `completed_at`, `created_at`, `updated_at` (ISO8601).
- **Controller**: `AppQyV1TTSQueueController::getStatistics()`  
  Calls `getStatistics()` then `addLogsToResponse($stats, 100)`, which merges `recent_logs` and `logs_count` into the same `data` object.

So the backend already returns the structure above; the dashboard uses `response.data` as `queueStats` and reads all fields listed in this document.

---

## Worker queue lanes (pycore / mpc-chrome / ai)

The TTS Queue tab also polls **`GET /api/app_qy_v1/assist/overview`** (SHARED CONTRACT v2, no auth) for GlobalTask + assist lanes that pycore and mpc-chrome drain:

| Category key | Label | Typical handler |
|--------------|-------|-----------------|
| `word_translation` | Word Translation | pycore / chrome race |
| `word_image` | Word Image | pycore / chrome |
| `word_audio` | Word Audio | pycore |
| `sentence_audio` | Sentence Audio | pycore / chrome |
| `cover` | Vocabulary Cover | pycore |
| `poster` | Media Poster | pycore |
| `notebooklm` / `gemini_image` / `gemini_chat` | Chrome Task Center | chrome |
| `subtitle_lang` / `book_lang` | Add-language assist | ai |

Drill-down: **`GET /api/app_qy_v1/assist/overview/items?category=&status=&start=&limit=`**

Frontend: `VocabAssistQueuesPanel` + `api.books.getAssistOverview()` / `getAssistCategoryItems()`.
