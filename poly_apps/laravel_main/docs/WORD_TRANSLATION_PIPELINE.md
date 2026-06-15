# Word Translation Pipeline (AppQyV1)

End-to-end async pipeline that translates vocabulary words by reusing the shared
`global_tasks` + `workers` substrate. It has two enqueue sources, two
interchangeable consumers, and one write-back stage that the FE reads from.

```
                 enqueue                          consume (atomic claim)              write-back
  ┌─────────────────────────┐        ┌──────────────────────────────────┐   ┌────────────────────────────┐
  │ FE  POST queue/batch/add │ HIGH   │ pycore worker (Google)           │   │ WordTranslationTask        │
  │  (visible words, p=100)  ├──────► │  processor_types=[remote_        │   │ Processor.processResult    │
  └─────────────────────────┘        │  translation]                    │   │   → AppQyV1WordTranslation  │
  ┌─────────────────────────┐  LOW   │ OR                               ├──►│     Writeback::apply        │
  │ Auto-scan timer (p=0)    ├──────► │ Laravel AI self-filler           │   │   → tts_cache_{lang} row    │
  │  WordTranslationScanTask │        │  (laravel-internal-ai worker)    │   │     translations[target]=…  │
  └─────────────────────────┘        └──────────────────────────────────┘   └────────────────────────────┘
                                                                                          │
                                                                                          ▼
                                                  GET /vocabulary/libraries/{id}/words  +  POST queue/batch/status
```

## global_tasks row

| field            | value                                                            |
|------------------|------------------------------------------------------------------|
| `app_name`       | `AppQyV1`                                                        |
| `task_type`      | `word_translation` (dedicated; NOT `dictionary_explanation`)     |
| `execution_type` | `remote_translation`                                             |
| `priority`       | int, higher pulled first. Auto-scan = `0` (LOW), FE = `100` (HIGH) |
| `payload`        | `{ "words":[string], "language":"en", "target_language":"zh", "word_count":int }` |

## Worker result (POST `/api/worker/tasks/result`, `status="completed"`)

```json
{
  "result": {
    "translations": [ { "word": "hello", "translation": "你好" } ],
    "target_language": "zh",
    "provider": "google"
  }
}
```

## Write-back (`WordTranslationTaskProcessor` → `AppQyV1WordTranslationWriteback`)

For each `{word, translation}` it finds the dictionary row in
`tts_cache_{payload.language}` (`AppQyV1LangDictionaryModel`, by `md5(word)`),
creating a minimal row if missing, and writes **two shapes** so the whole read
side of the loop stays intact:

1. `translations[target_language] = translation` — flat map. Read by the FE
   status endpoint and counted by the statistics aggregate (`with_translation`).
2. `translations['word_translation']` gets a `[target_language, translation]`
   pair appended — the exact nested structure
   `AppQyV1VocabularyLibraryPublicController::getLibraryWords` decodes (it
   surfaces `$trans[1]` of every entry). This makes the translation appear in
   `GET /vocabulary/libraries/{id}/words` without changing that controller.

It also sets `has_translation = true` and `translation_provider = provider`.

## FE-facing endpoints (`custom.authenticate`, prefix `/api/app_qy_v1`)

### POST `/ai_tools/translation/queue/batch/add`
Body `{ words:[string], language, target_language }`. Per word:
- ensures a dictionary row exists (minimal create if missing);
- already has `translations[target_language]` → `already_translated` (skipped);
- already inside a PENDING `word_translation` task → that task is bumped to HIGH
  priority → `moved_to_front`;
- otherwise → collected and chunked (≤40 words/task) into new HIGH-priority
  `word_translation` tasks → `queued`.

Returns `{ results:[{word,status}], queued, skipped, moved }`.

### POST `/ai_tools/translation/queue/batch/status`
Body `{ words:[string], language, target_language }`. Returns
`{ results:[{word, has_translation:bool, translation:string|null}] }` read
directly from dictionary `translations[target_language]`.

## Translation-queue CONTROL plane (Phase-B contract, pycore-facing)

A control plane over the same `word_translation` `global_tasks` so the pycore
queue monitor can list, re-prioritize and inject work.

**Auth: NO-AUTH (no user token).** pycore is a server-side caller with no Sanctum
session, so these mirror the `/api/worker/*` approach: they live in a
`withoutMiddleware([EnsureFrontendRequestsAreStateful::class])` group (only the
Sanctum stateful boot is stripped) and carry **no** `custom.authenticate` /
`auth:sanctum`. They are reachable exactly like the worker pull endpoint. Prefix:
`/api/app_qy_v1/ai_tools/translation/queue`. (The FE `batch/add` + `batch/status`
endpoints above keep `custom.authenticate` — only the control plane is open.)

All three operate only on `app_name=AppQyV1`, `task_type=word_translation` rows.

### GET `/list?status=pending&limit=100`
`status` optional (`pending` | `processing` | `completed` | `failed`; empty =
all). `processing` and `completed` are treated as live sets
(`assigned`+`processing`, and `completed`+`completed_demo`). `limit` 1–1000
(default 100). Items ordered **priority desc, created_at asc**.

```json
{
  "summary": { "pending": 0, "processing": 0, "completed": 0, "failed": 0, "total": 0 },
  "items": [
    {
      "task_id": "task_…", "words": ["…"], "word_count": 2,
      "language": "english", "target_language": "chinese",
      "priority": 150, "status": "pending",
      "created_at": "2026-06-08T…+00:00", "age_seconds": 12,
      "assigned_to": null
    }
  ]
}
```

### POST `/priority`
Body `{ task_id, priority:int }`. Sets that task's priority, **clamped to
0…1000**. Returns `{ task_id, priority, status }`. 404 if the task is not a
`word_translation` task for `AppQyV1`.

### POST `/stack`
Body `{ words:[string], language, target_language, priority? }` (`priority`
optional, defaults to HIGH=100, clamped 0…1000). Dedups vs existing PENDING
`word_translation` tasks containing those words and bumps them to the given
priority (`moved_to_front`); enqueues the rest as new tasks at that priority
(`queued`); already-translated words are `skipped`. **Reuses the same enqueue
core (`stackWords`) as `batch/add`.** Returns
`{ moved, queued, skipped, task_ids }` (`task_ids` = every pending task touched —
both bumped and newly created).

## Real-time broadcast layer — Laravel Reverb (Phase-C contract)

On top of the reliable HTTP work transport, Laravel broadcasts queue events over
**Laravel Reverb** (Pusher protocol) so pycore workers react in **real time**
instead of 5s HTTP polling. The most important signal is `word.translated`: when
one worker (or the self-filler) finishes a word, **every other pycore worker
hears it and skips that word** ("one finished → others skip").

> Reverb is the **broadcast / signaling** layer only. The existing HTTP worker
> API (register / heartbeat / tasks/pull / tasks/result, atomic claim) **stays**
> as the reliable work transport — do **not** move atomic task-claiming onto
> Reverb. A broadcast is a best-effort hint; the dictionary row and the
> `global_tasks` status remain the source of truth.

### Channel + events

Driver: **Reverb** (Pusher protocol). Channel: **public** `translation-queue`.

| Event (`broadcastAs`) | Fired from | Payload |
|---|---|---|
| `task.queued`     | `AppQyV1TranslationQueueController::createWordTranslationTask` (every enqueue path: `batch/add`, control `stack`, query-bump) | `{ task_id, words:[str], language, target_language, priority }` |
| `task.priority`   | `AppQyV1TranslationQueueController::bumpTaskPriority` (move-to-front) and `controlPriority` (`/priority`) | `{ task_id, priority }` |
| `word.translated` | `AppQyV1WordTranslationWriteback::apply` — once per persisted word (KEY coordination signal) | `{ word, language, target_language, translation, provider }` |
| `task.completed`  | `AppQyV1WordTranslationWriteback::apply` — once when the batch is written back (`processed > 0`) | `{ task_id, target_language, word_count }` |

Events are `App\Events\TranslationTaskQueuedEvent`, `TranslationTaskPriorityEvent`,
`WordTranslatedEvent`, `TranslationTaskCompletedEvent`. They implement
**`ShouldBroadcastNow`** so the signal is sent **inline** (no queue worker needed,
even though `QUEUE_CONNECTION=database`). Every fire point wraps the broadcast in
a best-effort `try/catch` + `Log::warning` — **a broadcast failure never fails the
HTTP request or the write-back**.

> Pusher adds a `socket` field to every payload (its echo-back-suppression id).
> pycore can ignore it; only the keys above are part of the contract.

### Security note (public channel)

`translation-queue` is a **public** channel: pycore is a server-side consumer
with no Sanctum/user session, so a public channel avoids per-user channel auth
(no `channels.php` authorization callback is needed for it). The trade-off:
anyone who can reach the Reverb port and has the app key can subscribe. Payloads
therefore carry **only non-sensitive** translation data (words / translations /
language codes / task ids) — no user identifiers, tokens or secrets. In
production, restrict Reverb's port at the network layer and rotate
`REVERB_APP_KEY`/`REVERB_APP_SECRET`.

### Env vars (local defaults)

```dotenv
BROADCAST_CONNECTION=reverb
REVERB_APP_ID=task-system
REVERB_APP_KEY=reverb-key-…        # app key pycore must use to subscribe
REVERB_APP_SECRET=reverb-secret-…  # server secret (never shipped to clients)
REVERB_HOST=0.0.0.0                # bind/connect host
REVERB_PORT=8080
REVERB_SCHEME=http                 # ws (http) locally; wss (https) in prod
```

`config/broadcasting.php` already has the `reverb` connection (key/secret/app_id
+ host/port/scheme/useTLS from the `REVERB_*` envs); `config/reverb.php` holds the
server bind config.

### Running Reverb alongside Octane

Reverb runs as its **own long-lived process**, separate from Octane:

```bash
# terminal 1 — the app (Octane, pgsql mode, :9000)
php artisan octane:start --server=swoole --port=9000

# terminal 2 — the Reverb WebSocket server (:8080)
php artisan reverb:start --host=0.0.0.0 --port=8080
```

Broadcasting **from** Octane workers is fine: an Octane request/timer fires the
event, which `ShouldBroadcastNow` pushes over HTTP to the Reverb process, which
fans it out to subscribed WebSocket clients (pycore). Because the events are
`ShouldBroadcastNow`, **no `queue:work` is required** for broadcasts.

### What pycore-ws must match

`host=REVERB_HOST`, `port=REVERB_PORT`, `scheme=REVERB_SCHEME`,
`app key=REVERB_APP_KEY`, channel **`translation-queue`** (public), and the four
event names exactly: `task.queued`, `task.priority`, `word.translated`,
`task.completed`.

## Query-path priority bump (active word jumps the queue)

When the user **actively queries a single word** and it has **no translation for
their target/native language**, that word is stacked into the queue at
**ELEVATED priority (200)** — above batch-visible (100) and background (0) — so
the word on screen is translated first.

- Helper: `AppQyV1TranslationQueueController::bumpQueriedWord(word, language,
  target_language)` → `stackWords(..., PRIORITY_ELEVATED=200)`. Cheap and
  **non-blocking**: it dedups (bumps an existing pending task / skips an
  already-translated word, never piling duplicates) and swallows any error so the
  lookup response is never slowed or broken.
- A `target_language` request param is **required** for the bump to fire; it is a
  no-op when absent or equal to the source language, and when the word already has
  `translations[target]`.
- Hooked into the word-query paths (each now accepts an optional
  `target_language`):
  - `AppQyV1WordLookupController::lookup` — `GET /api/app_qy_v1/lookup`
    (`bumpUntranslatedQuery`).
  - `AppQyV1WordQueryController::checkWord` — `GET /api/app_qy_v1/word/{word}`,
    `ANY /api/app_qy_v1/qurey_word`.
  - `AppQyV1WordQueryController::wordExists` — `ANY /api/app_qy_v1/word_exists`.
  - `AppQyV1WordQueryController::queryWordEnhanced` (enhanced query path).

## Consumers (atomic claim — no double work)

Both pull through `TaskManagerService::pullAndAssignTasksForWorker`, which
assigns each task in a locked transaction, so a task is processed exactly once.

### Concurrency hardening (N racing workers)

- **Consistent lock order** — pull, `assignTask` and `submitResult` all lock the
  **worker row first, then task rows**. (`submitResult` used to lock task→worker
  while pull locked worker→tasks — a lock-ordering deadlock under concurrent
  workers on Postgres.)
- **Transaction retry** — the pull/assign/submit transactions run with
  `attempts=3`, so transient concurrency errors (SQLite `database is locked`
  under the single-writer model, Postgres deadlock/serialization failures) are
  retried instead of surfacing as HTTP 500 and losing a worker's result POST.
  pycore additionally retries the result POST itself (3 attempts) on 5xx.
- **Unknown worker/task on submit** → `false`/HTTP 409 (caller error, no retry)
  instead of an exception/500.

### Recovery — `GlobalTaskMaintenanceTask` (Octane timer, 15s)

The missing caller of the recovery half of `TaskManagerService`. Each tick:

1. `releaseTimedOutTasks()` — tasks whose `timeout_at` passed go back to
   `pending` for re-claim (a worker crash or a permanently lost result POST can
   no longer strand tasks in `assigned`; previously nothing called this and
   hundreds of tasks accumulated). The timed-out scope covers **both**
   worker-owned statuses (`assigned` AND `processing` — a worker that reported
   progress and then died used to leak its task forever). A `processing`
   progress report **extends the timeout lease** (`timeout_at += timeout_seconds`)
   so a live long-running task is never reclaimed mid-flight.
2. `cleanOfflineWorkers()` — workers silent past the heartbeat timeout are
   marked offline and their current task released.
3. Legacy fixup — pending `dictionary_explanation(_demo)` tasks still tagged
   `execution_type=remote_translation` are re-tagged to `remote_client` (see
   below).
4. Retention purge — terminal tasks age out (completed/completed_demo/cancelled
   after 7 days, failed after 30 days, measured from `updated_at`), capped at
   500 deletes per tick. Task rows are transient bookkeeping; the real output
   lives in the app tables (dictionary rows), so `global_tasks` no longer grows
   unbounded.

### Control endpoints (full lifecycle)

- `POST /api/worker/tasks/accept` `{task_id, worker_id}` — idempotent
  acknowledgment for the documented pull → accept → result flow (the browser
  dictionary worker calls it per task). Pull already claims atomically, so
  accepting a task you own succeeds, a still-pending task is claimed, and a
  task owned by another worker returns 409.
- `POST /api/task/{taskId}/cancel` — cancels pending/assigned/processing tasks
  (`status=cancelled`, worker revoked; the revoked worker's late result is
  rejected by the ownership check). Terminal tasks → 409.
- `GET /api/task/stats` now includes `cancelled` and is computed with one
  grouped query — the complete status vocabulary is
  `pending / assigned / processing / completed / completed_demo / failed / cancelled`,
  shared by the dashboard Global Tasks view and the pycore monitor.

### Task-type routing (dictionary_explanation is NOT remote_translation)

`AppQyV1TranslationTaskService::createDictionaryExplanationTask` now creates its
tasks with `execution_type=remote_client` — the browser-side Bing dictionary
worker's processor type, the only consumer that understands its dict-shaped
`words` (`{word, md5, query_count}`) and `explanations` result. Tagging them
`remote_translation` handed them to the pycore Google worker (which crashed on
dict words) and the AI self-filler (which rejected them), burning their retries
while the real consumer never saw them. pycore additionally hardened its side:
unsupported `task_type`s are answered with `failed` (re-routes after the fixup)
and dict-shaped word entries are tolerated.

- **pycore worker** — registers with `processor_types ["remote_translation"]`,
  translates via Google, posts the result.
- **Laravel AI self-filler** — `AppQyV1WordTranslationFillerTask` (Octane timer,
  45s). Registers internal worker `laravel-internal-ai`
  (`processor_types ["remote_translation"]`), claims a small batch, translates
  each word via `AppQyV1TranslationService::translateWithFallback` (the
  configurable provider chain below), and submits the result through
  `TaskManagerService::submitResult`, which routes into the processor. The
  submitted `provider` label reflects whichever fallback link actually produced
  the translation (e.g. `openrouter`, `deepseek`, or `openrouter+google`).

## AI provider fallback chain (Laravel's own, server-independent)

Laravel may run on a server with weak/over-quota AI. To stay robust,
`AppQyV1TranslationService::translateWithFallback()` tries providers **in order**
and falls through on error / over-quota / down until one returns a usable
translation:

```
openrouter  ->  gemini  ->  deepseek  ->  google (pycore)
```

- The order is **configurable** via `config/AppQyV1.php` → `ai.fallback_chain`
  (env override `APPQYV1_AI_FALLBACK_CHAIN`, comma-separated). Allowed values:
  `openrouter`, `gemini`, `deepseek`, `google`.
- Per-provider model overrides: `ai.models.{openrouter|gemini|deepseek}`
  (envs `APPQYV1_AI_MODEL_*`); `null` = each client's own default.
- Providers with **no key configured are skipped** (never counted as a failure).
- The final **`google`** link delegates to **pycore** via
  `PycoreTranslatorUtil::translateSingle` (Google translate over RPC), so a
  translation still completes even when every direct LLM key is down. This is the
  hard robustness guarantee for weak servers.
- The atomic-claim worker model is unchanged — this only changes *how* a claimed
  task is translated.

### Keys / secret source
The AI clients read keys from the shared secret store
`<core_node>/.secret_keys/.secret_ignore/` via `GlobalSecretReader`
(resolved through `PathMapper::getCoreNodeDir()`), **not** from `.env` /
`config/services.php` (env is only a last-resort fallback). Current store holds
`OPENROUTER_API_KEY_1` (OpenRouter), `GOOGLE_API_KEY_2` (Gemini), and the
DeepSeek key under `OPENROUTER_API_KEY_2` (an `sk-…` DeepSeek key against
`api.deepseek.com`; `DeepSeekClient` now prefers `DEEPSEEK_API_KEY_1`/
`DEEPSEEK_API_KEY` and keeps `OPENROUTER_API_KEY_2` as a final fallback).

> OpenRouter note: the old pinned free model `tngtech/deepseek-r1t2-chimera:free`
> was retired upstream and now 404s. The default free model is OpenRouter's
> documented **Free Models Router** alias `openrouter/free`, plus an in-request
> `models[]` fallback array — so a single dead free model never fails the call.

## AI status endpoint

`GET /api/app_qy_v1/ai_tools/ai/status[?refresh=1]`
(`AppQyV1AIStatusController`, public health-style route, cached ~30s via
`config AppQyV1.ai.status_cache_ttl`; cache is best-effort and never breaks the
response). Returns a shape **aligned field-for-field with pycore's
`/api/local/ai/probe`** (`pycore.pyctl.ai.ai_probe`) so the desktop UI can
consume either source:

```json
{
  "providers": [
    {
      "name": "openrouter",
      "configured": true,
      "available": true,
      "key_masked": "sk-o…9d5e",
      "models": ["nvidia/nemotron-3.5-content-safety:free", "..."],
      "error": null,
      "latency_ms": 1121.3
    }
    // + gemini, deepseek
  ],
  "fallback_chain": ["openrouter", "gemini", "deepseek", "google"],
  "cached": false,
  "age_ms": 0
}
```

Keys are masked `first4…last4` (same `…` ellipsis as pycore); full secrets are
never returned. `available` is a live list-models probe per provider.

## pycore assists on dev machines (separate work)

On a developer machine, **pycore** (running on the dev box) also consumes the
same `word_translation` queue via its Google worker and assists when the server's
AI is weak. That cooperation is orthogonal to this fallback chain: Laravel's
chain above is **complete on its own** (it does not depend on pycore being up —
pycore is only the optional `google` final link). The two consumers never
double-process a task because both pull through the same atomic
`TaskManagerService::pullAndAssignTasksForWorker` claim.

## Auto-scan (background, no FE)

`AppQyV1WordTranslationScanTask` (Octane timer, 60s) scans every language
dictionary that has data and enqueues `word_translation` tasks at LOW priority
(`0`) for untranslated words, capped per language to avoid pile-up. The legacy
`AppQyV1DictionaryTranslationTask` (dictionary_explanation) is left untouched.

### Language mapping fix
`AppQyV1TableMaps::getAllWordTables()` now enumerates the full supported language
code list (`edge_tts.lang_code_mapping`) instead of a hardcoded `en/ja/vi/lo`
subset, and `AppQyV1DictionaryService::getLanguageCode()` /
`getLanguageNameFromCode()` fall back to the canonical 80+ language table. This
fixes the case where a code such as `en` (or any unlisted code/name) failed to
resolve to its dictionary, so scanning now works for all available languages.

## Files

- `app/Services/TaskProcessors/WordTranslationTaskProcessor.php`
- `app/Apps/AppQyV1/AppQyV1Services/AppQyV1WordTranslationWriteback.php` (fires
  `word.translated` + `task.completed`)
- `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1AITools/AppQyV1TranslationQueueController.php`
  (fires `task.queued` + `task.priority`)
- Reverb broadcast events: `app/Events/TranslationTaskQueuedEvent.php`,
  `app/Events/TranslationTaskPriorityEvent.php`,
  `app/Events/WordTranslatedEvent.php`,
  `app/Events/TranslationTaskCompletedEvent.php`
- Reverb config: `config/reverb.php`, `config/broadcasting.php` (`reverb`
  connection), `REVERB_*` + `BROADCAST_CONNECTION=reverb` in `.env`
- `app/Services/TimerTasks/AppQyV1WordTranslationFillerTask.php`
- `app/Services/TimerTasks/AppQyV1WordTranslationScanTask.php`
- Fallback chain: `app/Apps/AppQyV1/Utils/AppQyV1AITools/AppQyV1TranslationService.php`
  (`translateWithFallback`, `probeProviders`)
- AI clients (+ `probe()` / `hasApiKey()`): `app/Services/OpenRouterClient.php`,
  `app/Services/GeminiClient.php`, `app/Services/DeepSeekClient.php`
- Pycore Google final link: `app/CallPycoreUtils/PycoreTranslatorUtil.php`
- Status endpoint: `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1AITools/AppQyV1AIStatusController.php`
- Config: `config/AppQyV1.php` (`ai.fallback_chain`, `ai.models`, `ai.status_cache_ttl`)
- Registry wiring: `app/Services/TaskManagerService.php`
- Routes: `routes/AppQyV1Router/AppQyV1AITools.php` (FE `custom.authenticate`
  group + the no-auth control-plane `withoutMiddleware` group)
- Control plane + query bump: `AppQyV1TranslationQueueController`
  (`controlList`, `controlPriority`, `controlStack`, shared `stackWords`,
  `bumpQueriedWord`)
- Query-bump call sites:
  `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1WordQurey/AppQyV1WordLookupController.php`,
  `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1WordQurey/AppQyV1WordQueryController.php`
