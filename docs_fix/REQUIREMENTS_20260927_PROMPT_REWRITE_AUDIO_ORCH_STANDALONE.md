# Prompt Rewrite + Standalone Audio Orchestration — Requirements

Date: 2026-09-27
Status: binding requirement list (design and implementation records are
appended below by each workstream as work proceeds)
Scope: `pycore` (audio orchestration, agent history, AI gateway / OpenRouter,
Kokoro batch TTS), `poly_apps/pycore_laravel_wordnew_ui` (pycore-manager:
`/pycore-manager/vocabulary`, `/pycore-manager/agent-history`, new
`/pycore-manager/audio-orchestration`), and `docs_fix`.

## 0. Global rules

- G1 Every component named below is shared and reused across all items.
  Duplicate definitions are forbidden; extend or upgrade the existing one.
- G2 Problems found are fixed by refactoring the underlying layer, not by
  local patches.
- G3 Scan `docs_fix` for related documents, derive the current behavior from
  the LATEST code and newest documents, correct stale documents, and point
  each topic to its authoritative document.
- G4 i18n for all UI strings; English code, comments, and logs; no tests.

## 1. Requirements (user directive, 2026-09-27)

- R1 **Generate time missing.** In `/pycore-manager/vocabulary` → task
  orchestration → Generate UI component, the generation time is not shown.
  Find the root cause (backend field not produced/persisted/propagated or UI
  not rendering) and show it (start, finish, duration per task/lane/item).
- R2 **Resource completion uses batch generation.** In the task editor's
  resource completion, word audio generation runs item by item. It must
  reuse the existing Kokoro batch generation path (no second batch
  implementation).
- R3 **Third OpenRouter source: prompt rewrite.** In
  `/pycore-manager/agent-history` → "OpenRouter request attempts", add a
  third library/source besides `agent_history_article` and
  `agent_history_translate`: prompt rewrite. Every new prompt detected by the
  Realtime prompt monitor is sent to OpenRouter with a preset system prompt
  that rewrites it into standard English and drops code blocks, replacing
  each with a short plain description of the code.
- R4 **Rewrite → audio immediately.** Each new rewrite is immediately
  submitted to the global audio orchestration library, orchestrated into
  audio, generated at once, and shown in Audio Orchestration.
- R5 **Standalone Audio Orchestration.** Strengthen Audio Orchestration and
  make it generic (source-agnostic: vocabulary books, prompt rewrites, future
  sources). Extract it into a standalone component and page with its own
  left-menu entry; remove it from the Vocabulary page menu.
- R6 **Documentation.** Record these requirements here; update related
  `docs_fix` documents to the new behavior.

## 2. Workstreams

- W1 (R1, R2): vocabulary orchestration generate timing + Kokoro batch reuse.
- W2 (R3, R4 backend): prompt rewrite service, OpenRouter source, audio
  orchestration submission, agent-history UI.
- W3 (R5, R4 UI): standalone generic Audio Orchestration page/component and
  menu entry; source-aware task display.

## 3. Implementation record

(Appended by each workstream.)

### W2 contract (audio orchestration source + submit API; agent-history rewrite feed)

Source ids (Python: `pycore/pyctl/audio_orchestration/orch_sources.py`,
`ORCH_SOURCES`; also returned by `tasks/list` as `sources` so the UI never
hardcodes them):

| id | meaning | sentence input |
| --- | --- | --- |
| `vocab_book` | vocabulary book task (default for every record without `source`) | Laravel book sentences via `book.source_key` |
| `prompt_rewrite` | agent-history prompt rewrite (R3/R4) | inline `sentences` stored in the task record |

Task record additions (`orch_store` task JSON, returned verbatim by
`task/get`):

- `source: str` — one of the ids above (missing → `vocab_book`).
- `source_ref: object` — opaque origin reference; for `prompt_rewrite`:
  `{prompt_id, tool, os_user, session_id, ts}`.
- `sentences: [{seq, language, text, languages: {<lang>: text}}]` — only on
  text-input tasks (same shape as the book sentence cache). `book` is absent
  on text-input tasks.

Routes (`route_names.py` / `local_audio_orchestration_routes.py`):

- NEW `ui/audio_orch/task/submit_text` (`UI_AUDIO_ORCH_TASK_SUBMIT_TEXT`)
  - request: `{source: str (required, a non-book id), items: [{text: str,
    language?: str = "en"}] (required, non-empty), name?: str,
    source_ref?: object, generate?: bool = true}`
  - each item text is split into sentences (`text_parsing.split_sentences`);
    the task uses pattern `[{type: "sentence_en", times: 1}]`,
    `segment_mode: "count"`, `segment_value: 1` (one mp3 per submission) and
    generates immediately through the normal sentence audio path
    (`orch_generate.start_generation`, `use_qy_account=false`).
  - response: `{success, task: <task record>, generation: {success,
    task_id, resumed, error?} | null}`; errors: `{success: false, error}` with
    `error` in `ORCH_SOURCE_UNKNOWN | ORCH_TEXT_ITEMS_REQUIRED`.
- `ui/audio_orch/tasks/list` — request `{source?: str}` filters by source;
  response adds `sources: [ids]`; every task summary adds `source`,
  `source_ref`, `input` (`"book" | "text"`).
- `ui/audio_orch/task/get`, `task/progress` — include `source` (progress
  response adds `source` and `source_ref`).
- `task/plan`, `task/generate`, `task/cancel`, `task/delete`,
  `task/manifest_page`, `task/files` work unchanged for text-input tasks.
  `task/create` always creates `vocab_book` tasks; `task/update` ignores
  `book` on text-input tasks.
- Retention: text-input tasks keep the newest `ORCH_TEXT_TASK_RETENTION`
  (200) per source; older task records are deleted through `task_delete`
  (generated mp3 output is not removed).

Agent-history rewrite feed:

- AI usage source id `agent_history_prompt_rewrite`; the OpenRouter attempts
  list sources come from runtime `ai_dashboard.sources`.
- Route `ui/agent_history/prompt_rewritten` (paged, same shape as
  `ui/agent_history/prompt_derived`); bus topic
  `agent_history.prompt.rewritten` with `{item}`; item fields: `id, tool,
  os_user, session_id, ts, time, source_text, derived_text (the rewrite),
  model, provider, derived_at, audio_task_id`.
- Config keys (section `agent_history_article`): `prompt_rewrite_en`
  (template, empty = built-in default), `prompt_rewrite_enabled` (default
  true), `prompt_rewrite_audio` (default true).

Push topics (both bridged THREAD_BUS → `thread_bus_routes` listener →
`http_event_delivery_service.publish_topic` → SSE record → browser
`pycoreEventBus.dispatch(topic, payload)`; no UI-side topic allowlist):

- `agent_history.prompt.rewritten` — `{item}`; emitted AFTER the audio submit,
  so `item.audio_task_id` is already set when audio is on.
- `audio_orchestration.tasks.changed` (`BusSignals.AUDIO_ORCH_TASKS_CHANGED`,
  TS `PYCORE_EVENT_TOPICS.audioOrchestrationTasksChanged`) — `{task_id,
  source, status}`; `status` also `"deleted"`. Owner: `orch_events.py`.

Differences from the lead-relayed W3 proposal (resolved with W3):

- Text-task content is `sentences: [{seq, language, text, languages}]`
  (book sentence shape), not `items: [{item_id, text, original, ...}]`;
  the original prompt is referenced via `source_ref.prompt_id` (full text in
  the agent-history rewrite feed). Per-sentence audio state: sentence_audio
  lane owner views (owner = task_id), as proposed.
- `audio_orchestration.tasks.changed` fires on status TRANSITIONS only
  (create, generating, draft/cancel, done/failed, interrupted, deleted), not
  on every progress save or on field-only `task/update`; live progress stays
  on `task/progress` polling of running tasks.

### W2 implementation record (R3 + R4 backend)

Flow: `agent_history.prompt.new` (heartbeat baseline + realtime monitor, one
choke point `_emit_prompt_new`) → `prompt_rewrite_watcher` (serialized worker,
newest 3 prompts/event, full text from the txt store) →
`ai.prompt_derive.rewrite_prompt_en` (system prompt + raw prompt through
`ai_free_text.free_text_chat`, the same OpenRouter client/quota guard/usage
log as `agent_history_translate`; source `agent_history_prompt_rewrite`) →
`orch_service.submit_text_task(source="prompt_rewrite")` (when
`prompt_rewrite_audio`) → `prompt_rewrite_cache` append → bus
`agent_history.prompt.rewritten`.

Shared abstractions (no copies):

- `pyctl/agent_history/prompt_transform_service.py` — `PromptTransformWatcher`
  (queue, cap, full-text read, cache, bus push, feature hook). Both the Linux
  EN derive feed (`prompt_derive_service.prompt_derive_watcher`, toast/sound
  hook) and the rewrite feed (`prompt_rewrite_service.prompt_rewrite_watcher`,
  audio-submit hook, both platforms, `prompt_rewrite_enabled` switch) are
  instances.
- `pyctl/agent_history/prompt_transform_cache.py` — `PromptTransformCache`
  with instances `prompt_derived_cache` (unchanged file/namespace) and
  `prompt_rewrite_cache` (`prompt_rewrite_cache.json`,
  `agent_history.prompt_rewritten`). Replaces the removed
  `prompt_derived_cache.py` module.
- `pyctl/ai/prompt_derive.py` — one `_transform` call/normalize path for
  `derive_prompt_en` and the new `rewrite_prompt_en`
  (`DEFAULT_PROMPT_REWRITE_EN_PROMPT`, config `prompt_rewrite_en`).
- `pyctl/agent_history/ai_sources.py` — all agent-history AI source ids;
  `OPENROUTER_ATTEMPT_SOURCES` feeds `ui_service._AI_USAGE_SOURCES` and runtime
  `ai_dashboard.sources` (TS no longer hardcodes source ids).
- `pipeline/config.py` — the save loop iterates `USER_CONFIG_KEYS` +
  `_INTERNAL_PATCH_KEYS` instead of a second hand-kept key list.
- `pyctl/audio_orchestration/orch_sources.py` — source ids + sentence
  provider; `orch_generate._generate` and `orch_service.task_plan` resolve
  sentences through it.

UI: `PcAgentHistoryAiPanel` (sources from runtime), new
`PcAgentHistoryPromptRewrite` (+ `usePromptRewrites` feed hook) rendered as a
child of `PcAgentHistoryPromptItem` (prompt list) and in
`PcAgentHistoryCachePanel`; rewrite + audio switches in
`PcAgentHistoryConfigPanel`; rewrite system prompt editable in the shared
`PcAiProviderPromptsEditor` (now a keyed field list); i18n in
`pc-locales/PcEnFeatures.ts` / `PcZhFeatures.ts`.

Known limits: the rewrite audio goes through the normal sentence path, which
includes the Laravel sentence-audio lookup and delivery outbox (prompt text
reaches the configured Laravel endpoint); retention prunes task records only,
mp3 output under `audio_orchestration/output/` is kept.

### W3 implementation record (R5 + R4 UI: standalone Audio Orchestration)

Root: `poly_apps/pycore_laravel_wordnew_ui/apps/pycore-manager/`.

- Page and menu: `pages/PcAudioOrchestrationPage.tsx`, registered in
  `pcPages.tsx` `PC_PAGES` (`audio-orchestration`, `nav.audioOrchestration`,
  lucide `AudioLines`). Route: `/pycore-manager/audio-orchestration[?source=<id>]`.
- Folder move: `pages/vocabulary/orchestration/*` → `pages/audio-orchestration/*`.
  `VocabAudioOrchTab.tsx` was renamed to `AudioOrchWorkspace.tsx`, the reusable
  source-agnostic workspace (`sourceFilter` and `onSourceFilterChange` props).
- The Vocabulary page no longer has the tab. `VOCAB_TABS` dropped `audio-orch`
  and `vocabularyPage.tabs.audioOrch`. Old links `/pycore-manager/vocabulary?tab=audio-orch`
  redirect through `PC_LEGACY_TAB_REDIRECTS` (`pcPages.tsx`), which
  `components/PcLegacyTabRedirect.tsx` applies to generated routes in
  `PcApp.tsx`. The agent-history shortcut now links to the new route.
- i18n: the orchestration labels (`OrchLocales.ts`, `ORCH_L`) moved from
  `vocabularyPage.orchestration.*` to the top-level `audioOrchestration.*` pc
  namespace. New keys: `pageTitle`, `pageSubtitle`, `sourceFilter`,
  `sourceAll`, `sourceVocabBook`, `sourcePromptRewrite`, `sourceItems` and
  `noSourceItems`, plus `nav.audioOrchestration` (en/zh).
- Sources (W2 contract):
  - API types in `core/integrations/pycore/PycoreApiOrchestration.ts`:
    `OrchTaskSource`, `OrchTaskInput`, `OrchTextSentence`, plus
    `source`/`input`/`source_ref`/`sentences` on the tasks.
    `orchTasksList(source?)` returns `sources`.
  - `pages/audio-orchestration/orchSources.ts` holds the presentation only
    (label, icon, badge per known id, with a generic fallback). The source
    list comes from pycore's `sources`, and book vs text comes from the task's
    `input`.
  - `OrchTaskList` shows a source badge on every row. It shows book, segment
    and word-mode details and the Edit/Regenerate editor only for book-input
    tasks. Lane progress, manifest counters, files and the log stay shared.
  - `OrchSourceDetail.tsx` is the source-specific detail slot. For
    text-input tasks it lists the inline sentences and `source_ref`. Book
    tasks get none.
  - The workspace renders the login panel, book picker and editor only when
    the filter is `all` or `vocab_book`.
- Live updates: the workspace subscribes to W2's
  `audio_orchestration.tasks.changed` push
  (`PYCORE_EVENT_TOPICS.audioOrchestrationTasksChanged`). It fires on status
  transitions of every source, including a freshly submitted prompt_rewrite
  task, and triggers a debounced task-list reload. Generation progress then
  uses the existing running-task poll and the owner lane views
  (`useAudioLaneOwnerViews`).
- Docs updated: `DESIGN_20260917_AUDIO_ORCHESTRATION.md`,
  `DESIGN_20260917_AUDIO_ORCHESTRATION_PROGRESS.md`,
  `REQUIREMENTS_20260926_AUDIO_ORCH_QUEUE_STATE_DRIVEN.md`,
  `TASK_20260919_AGENT_HISTORY_UI_OPENROUTER_VOCAB_AUDIO.md`.

### W1 implementation record (R1 generate time + R2 Kokoro batch reuse)

R1 root cause: generation time was never produced. `orch_generate._generate`
persisted only `status` / `progress` / `events` and `orch_store.save_task`
only bumped `updated_at`; no start/finish field existed on the task, the
segments, the manifest resources or the lane tracker entries, so nothing
could be returned, typed or rendered. Fixed at the producer:

- `orch_generate`: `generation_started_at` (kept on resume) and
  `generation_finished_at` (cleared per run, set by the single terminal
  helper `_finish` on done / failed / cancel / crash / sync or ffmpeg
  failure); `_progress` records `progress.phase_times[phase] = {started_at,
  finished_at}` on every phase change; segments carry assembly
  `started_at` / `finished_at` (kept on resume); manifest `resource_meta`
  carries `resolved_at`.
- `orch_service`: task summaries and `task/progress` return the two run
  fields; manifest rows return `resolved_at`.
- `pyutils/tts/audio_queue_center`: lane tracker entries carry `queued_at`,
  `started_at` (owner take or lane pop) and `finished_at` (settle), exported
  in every owner / lane view.
- UI: types (`OrchTiming`, `OrchGenerationPhase`, run/segment/manifest
  fields in `PycoreApiOrchestration.ts`; tracker times in
  `QueueCenterTypes.ts`); new `pages/audio-orchestration/OrchRunTiming.tsx`
  (run start / finish / duration or live elapsed + per-phase durations in
  every task row; per-segment timing in the task detail); manifest rows show
  the resolve time; `PcAudioLaneQueueView` owner items show the item duration
  with queued/started/finished tooltip. Shared formatters `formatElapsed` /
  `spanSeconds` in `utils/pcFormat.ts` replace the duplicate local
  `formatDuration` of `PcSentenceQueuePanel` and `PcWordAudioQueueModal`;
  phase labels are one map `ORCH_PHASE_LABELS` (`orchShared.ts`). Locale keys:
  `audioOrchestration.runStarted|runFinished|runDuration|runElapsed|segmentTiming|resolvedAt`,
  `queueCenter.audioLane.queuedAt|startedAt|finishedAt` (en/zh).

R2: the word_audio lane (`laravel_audio_worker_execution._prepare_word_batch`)
and orchestration (`orch_resources.resolve_batch._word_batch`) each carried
their own copy of "Kokoro batch → validate → store in word_audio_cache".
Orchestration also still generated words one by one: words a lane worker
already held and then failed (or timed out) fell back to per-item
`resolve_audio` (Laravel lookup + single-word `tts_orchestrator.synthesize`).

- New single entry `pyutils/tts/batch/kokoro_batch.synthesize_words_to_cache`
  (one Kokoro batch, validation, unified cache store under
  `runtime_profile.WORD_BATCH_ENGINE`, per-word `{ok, audio_path, scratch,
  provider, error}`); both callers now use it.
- `resolve_batch`: lane-held words are re-checked in one cache lookup
  (`find_cached_many`); the rest go through the same `_word_batch` in
  `WORD_BATCH_CHUNK_SIZE` chunks and are settled on the tracker.
- `resolve_audio` became `resolve_sentence_audio` (sentence-only; the word
  branches and the per-word Laravel word fetch were removed).

Not run: no builds, tests, services or type checks (only a `py_compile`
syntax check of the edited Python files).

## 4. Requirements round 2 (user directive, 2026-09-27)

- R7 **Idempotent Laravel upload of orchestration audio.** Prompt-rewrite
  (and every other source's) orchestration audio is uploaded to Laravel
  idempotently (stable content/task keys; re-upload never duplicates).
  Laravel may be offline at any time: uploads queue durably, and when
  Laravel comes back online the full history not yet delivered is
  backfilled automatically. Delivery state is visible in pycore-manager.
- R8 **One delivery mechanism for all of pycore.** Every similar
  "deliver to Laravel with retry/outbox/backfill" feature in pycore (audio
  lane delivery outbox, worker result delivery, progress upload, agent
  history article publish, full syncs, etc.) is merged into one shared,
  refactored delivery layer; duplicates are removed, not wrapped.
- R9 **wordnew playback.** The wordnew app gets a home entry, a listing
  (display) page, and a player page for orchestrated audio. The player shows
  the related resources on the same page (source text/sentences, original
  prompt, word/sentence resources) and supports orchestrated playback
  (playlist/sequence, repeat, speed) of those resources. Reuse existing
  wordnew players/components (e.g. Walkman, daily-reading) instead of
  new duplicates.
- R10 Search `docs_fix` design documents and wordnew code first; record the
  design and implementation here and in the related documents.

### Round-2 workstreams

- W4 (R7, R8 pycore): unified delivery layer, orchestration output upload,
  reconnect backfill, pycore-manager delivery status.
- W5 (R7 Laravel): idempotent ingest + listing/detail/stream API for
  orchestrated audio in `poly_apps/laravel_main`; owns the "W5 contract".
- W6 (R9): wordnew home entry, listing page, player page.

### W5 contract (Laravel orchestrated-audio ingest + read API)

Base: `/api/app_qy_v1/orch_audio` (`routes/AppQyV1Router/AppQyV1OrchAudio.php`).
Envelope: success `{success: true, data, message, code}`; error
`{success: false, error, message, error_code, data, code}` (HTTP status in
`code`). JSON bodies except the audio upload.

Auth:

- Ingest (`ingest/*`): machine/worker trust level, identical to the existing
  pycore deliveries `ai_tools/article/worker/*` and `ai_tools/tts/sentence/report`
  (no user login). Every ingest call carries `machine_id` =
  `pycore.pyutils.laravel.identity.get_pycore_machine_id()`; W4 sends through
  `laravel_client` (default identity headers on).
- Read (`tasks*`): `auth:sanctum` (wordnew bearer token). Audio files are
  public static URLs (content-addressed, see below) so `<audio>` needs no token.

Identity and idempotency keys:

- Task key: `task_key = sha256(machine_id + "\n" + task_id)[0:40]` (hex, 40).
  It is the public `id` in every read response. One row per (machine_id,
  task_id); re-sending updates in place.
- Task content: `meta_hash` (required, pycore-computed, opaque, <= 128
  chars; e.g. sha256 of pycore's canonical task JSON). Same hash → `unchanged`
  (no write); different hash → `updated` in place.
- Segment: (`task_key`, `index`) with declared `sha256` of the final segment
  mp3. Audio is stored content-addressed:
  `PathMapper::getAppQyV1AudioBaseDir('orchestration/<sha[0:2]>/<sha>.mp3')`,
  URL `/static/app_qy_v1/audio/orchestration/<sha[0:2]>/<sha>.mp3` (existing
  static audio route, HTTP Range supported). Identical bytes are stored once;
  changed bytes get a new URL; the segment is `ready` only when its stored
  sha256 equals the declared one.
- Per-sentence clips are NOT uploaded here: the sentence audio already reaches
  the Laravel sentence library through the existing sentence-audio delivery;
  detail resolves it passively (no queueing).

Delivery order per task: (1) `ingest/tasks` (declares segments) → (2)
`ingest/segment-audio` for each index in `segments_missing`. Backfill: call
`ingest/probe` with many tasks, then send only what it reports missing.

1. `POST ingest/probe` — "which of these do you still need?" (REMOVED 2026-09-27 by W7: folded into `POST /api/app_qy_v1/delivery/diff` kind `orch_output`, same per-task fields; see `REQUIREMENTS_20260927_LARAVEL_DIFF_DELIVERY_REDIS_INDEX.md` "W7 contract")
   - request `{machine_id, tasks: [{task_id, meta_hash, segments?: [{index,
     sha256}]}]}` (1..500 tasks)
   - response `data: {tasks: [{task_id, task_key, meta_current: bool,
     segments_missing: [index]}]}`; `meta_current=false` when the task is
     unknown or the stored `meta_hash` differs; `segments_missing` lists the
     probed indexes whose stored audio sha256 differs (all probed indexes for
     an unknown task).
2. `POST ingest/tasks` — batch upsert of task metadata
   - request `{machine_id, tasks: [Task]}` (1..50). `Task`:
     `{task_id (<=128), meta_hash, source (<=32, W2 ids), name?, language?,
     status (<=32), source_ref?: object, source_text?: str (original prompt /
     source text, <=200000), sentences?: [{seq, language, text, languages?:
     {lang: text}}] (<=5000), resources?: [{kind: "word"|"sentence", text,
     language}] (<=2000; words/sentences the task used), segments?:
     [{index, sha256 (64 hex), bytes, duration_ms?, start?, end? (sentence
     positions), status?, started_at?, finished_at?, timeline?: [{seq?, type:
     "word"|"sentence", start_ms, end_ms}] (item offsets inside the mp3)}],
     pattern?: array, created_at?,
     updated_at?, generation_started_at?, generation_finished_at?}`.
     Timestamps: epoch seconds (float) or ISO-8601. pycore folds
     `generation_id` into `meta_hash`; book tasks put `book {source_key,
     title}` in `source_ref`; manifest `segment_items` map to `resources`.
   - The declared `segments` list replaces the stored one (indexes absent
     from it are removed; files are kept).
   - Optional fields are partial updates: an ABSENT key keeps the stored
     value (e.g. `source_text` sent only on the first delivery survives later
     updates; absent `segments` keeps the declared segments); an explicit
     `null` / `[]` clears it.
   - response `data: {tasks: [{task_id, task_key, result:
     "created"|"updated"|"unchanged", segments_missing: [index]}],
     created, updated, unchanged}`. A task that fails validation fails the
     whole request (422, nothing written).
3. `POST ingest/segment-audio` — resumable segment upload, the existing
   offset-v1 protocol (`pycore.pyutils.laravel.progress_upload.
   LaravelProgressUploader.upload(path, content, params=...)`).
   - query params: `machine_id, task_id, index` + offset-v1 fields
     (`upload_protocol=offset-v1, upload_offset, upload_length,
     audio_sha256, chunk_sha256`); body = raw chunk
     (`application/octet-stream`).
   - response `data: {upload_protocol, transfer_id, offset, total_bytes,
     progress, upload_complete, accepted, idempotent, busy, retry_after_ms}`;
     on completion also `{task_key, index, audio_url, ready: true}`.
   - Already stored (segment ready with the same sha256, or the content file
     already exists) → the first chunk returns `upload_complete: true,
     offset: upload_length, idempotent: true` without writing.

Read API:

4. `GET tasks?source=&q=&page=1&per_page=20` (per_page <= 100; `q` matches
   name) → `data: {items: [Summary], total, page, per_page, sources: [{id,
   count}]}`, newest `task_updated_at` first. `Summary`: `{id, task_id,
   source, name, language, status, source_ref, preview_text (first sentence,
   else source_text, <= 500 chars), sentence_count,
   segment_count, segments_ready, duration_ms, audio_url (first ready
   segment or null), created_at, updated_at, generation_started_at,
   generation_finished_at, received_at}` (times ISO-8601).
5. `GET tasks/{id}?sentence_page=1&sentence_per_page=200` (per_page <= 500)
   → `data: {task: Summary + {source_text (original prompt), pattern},
   segments: [{index, start, end (sentence positions), status, ready,
   audio_url, bytes, duration_ms, timeline ([] when pycore sent none),
   started_at, finished_at}],
   playlist: [{index, audio_url, duration_ms}] (ready segments in order),
   sentences: {items: [{seq, language, text, languages, audio_url,
   audio_ready}], total, page, per_page}, words: [{word, language,
   audio_url, audio_status}]}`. Sentence/word audio is resolved passively
   through `AppQyV1AudioGateway` (file-first, never enqueues).

Error codes (`error_code`):

| code | HTTP | meaning |
| --- | --- | --- |
| `ORCH_AUDIO_VALIDATION_FAILED` | 422 | request shape invalid (`data.errors`) |
| `ORCH_AUDIO_TASK_NOT_FOUND` | 404 | unknown task (read) or upload before `ingest/tasks` |
| `ORCH_AUDIO_SEGMENT_UNDECLARED` | 409 | upload index not declared by the stored task |
| `ORCH_AUDIO_SEGMENT_HASH_MISMATCH` | 409 | upload `audio_sha256` != declared sha256 → resend `ingest/tasks` |
| `ORCH_AUDIO_UPLOAD_INVALID` | 422 | offset-v1 chunk rejected (offset/hash/size) |
| `ORCH_AUDIO_STORE_FAILED` | 500 | completed upload could not be stored |

Retry semantics for W4: 2xx = delivered; 409 = re-send task metadata then
retry; 422 = permanent for that payload (log, do not loop); 5xx / network =
retry with backoff (idempotent).

### W5 implementation record (R7 Laravel)

Root: `poly_apps/laravel_main`.

- Why new tables (not articles / daily-reading documents): an orchestration
  task has N segment mp3s, a sentence list and a per-machine identity; the
  article model is one text + one audio per content hash and would force
  segment fan-out into fake articles. New add-only migrations
  `AppQyV1_2026_09_27_000001/000002` (`orch_audio_tasks` unique
  `task_key` and (`machine_id`, `task_id`); `orch_audio_segments` unique
  (`task_key`, `segment_index`)), models `AppQyV1OrchAudioTaskModel` /
  `AppQyV1OrchAudioSegmentModel`. Applied only by `sys:init`.
- Service `AppQyV1Services/AppQyV1OrchAudioService.php` (probe, batch
  upsert, segment chunk receive, list, detail). Reuses:
  `AppQyV1DurableOffsetUploadService` (offset-v1; upgraded with
  `promoteCompleted` = move spool to final path, and `alreadyStoredReceipt`
  for the idempotent short-circuit), `AppQyV1AudioGateway` passive
  `requestSentence` / `requestWord` (no enqueue) for sentence/word links,
  `PathMapper::getAppQyV1AudioBaseDir` + the existing
  `/static/app_qy_v1/audio/{path}` route for streaming (Range via
  `StaticFileController::respondFile`).
- Controller `AppQyV1Controllers/AppQyV1OrchAudio/AppQyV1OrchAudioCtl.php`;
  routes `routes/AppQyV1Router/AppQyV1OrchAudio.php` (required from
  `routes/api.php`); endpoints listed in `AppQyV1ApiInfo.php`; messages in
  `lang/{en,zh_CN}/audio_orchestration.php` (`orch_audio_*`).
- Docs: `DESIGN_20260917_AUDIO_ORCHESTRATION.md` "Laravel delivery of
  orchestrated output".

Risks / limits:

- Ingest has no cryptographic machine auth (same as every current pycore →
  Laravel delivery). `pycore.client` / `RelayDeviceIdentity` cannot be used:
  its registration route `api/relay/machine/register` no longer exists, so no
  secret is ever claimed; the new relay signature needs owner enrollment.
  When Queue Center machine auth lands, add its middleware to the ingest group.
- Segment rows removed by a re-declared plan leave their content-addressed
  files on disk (shared by hash; no garbage collection).
- Detail sentence audio is batched: `AppQyV1SentenceAudioLookupTrait::
  resolvePassiveBatch` (exposed as `AppQyV1AudioGateway::
  resolveSentencesPassive`) runs one `rowsByContentIds` query per language
  and one disk check per sentence (the row's cached `audio` path, else the
  canonical `<lang>/<content_id>.mp3`). Unlike single `resolve`, it does not
  scan the non-mp3 extensions for rows without a cached path, and it does
  not reconcile the row cache.
- Contract round 2 (W4/W6 input): added `preview_text`, `pattern`, per-segment
  `timeline`; kept `page/per_page`, `duration_ms`, meta-hash idempotency
  (W4's `generation_id` folds into `meta_hash`); no delete/tombstone endpoint.
- Upsert is a partial update per optional field (absent key keeps the stored
  value) so W4's first-delivery-only `source_text` is never wiped.
- Not run: migrations, services, tests; only `php -l` syntax checks.

### W6 implementation record (R9 wordnew playback)

Root: `poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/`. Design:
`docs/DESIGN.en.md` §7 (zh mirror §7).

- Entry and routes: home labs card `orch-audio` (new shared
  `components/WfNewHomeLabCard.tsx` replaces the four inline lab cards; the
  labs header is now i18n). Tab `orch-audio` in `routing/WordNewHashRoutes.ts`:
  `#/orch-audio[?source=&page=]` (listing), `#/orch-audio/<task_key>` (player);
  `orchAudioHash` / `parseOrchAudioHash` / `navigateToOrchAudio`. The hash
  rule for tabs owning sub-paths is one function, `itemRouteTab` (daily-reading
  and orch-audio), used by `hooks/useWfNewAppState.ts` for both parse and
  write-back; `dailyReadingHash` / `dailyReadingArticleId` now use the same
  generic helpers. Rendered in `WfNewApp.tsx` via
  `components/orch-audio/WordNewOrchAudioRoute.tsx`.
- API (W5 contract, sanctum): `WfNewApiPaths.orchAudioTasks` /
  `orchAudioTask`; `api/methods/orchAudio.ts` (`getOrchAudioPage`,
  `getOrchAudioDetail` = summary, segments, words and sentence page 1;
  `getOrchAudioSentencePage` = one more sentence page, same endpoint with
  `sentence_page=N&sentence_per_page=200`; contract unchanged); mock `api/methods/mockOrchAudio.ts`; types
  `api/types/orchAudio.ts`. Segment `start`/`end` are sentence positions;
  `duration_ms` → seconds; `source_text` → original prompt.
- Listing `WordNewOrchAudioListPage.tsx`: source chips from `sources`
  (`{id,count}`; known ids `vocab_book`/`prompt_rewrite` labelled via i18n,
  unknown ids generic), paged by the new shared `components/WfNewPager.tsx`
  (extracted from `WfNewContentListPage`, which now uses it), login prompt.
- Player `WordNewOrchAudioPlayerPage.tsx` + `useOrchAudioPlayback.ts` +
  `WordNewOrchAudioTransport.tsx` + `orchAudioModel.ts`. No second player:
  segment mp3s and per-sentence resources are both verse lists played by the
  existing `services/WordNewBookReaderPlayback.ts` (upgraded with an
  `onTimeUpdate` hook). Modes segments/sentences, repeat off/all/one
  (`repeatOne` + `goNextChapter` wrap), speed, prev/next, per-sentence replay,
  sentence repeats, words-before (`readWordCardsForSentence`), translation lines.
  Highlight (by sentence position): sentence mode = active verse; segment mode
  = the per-segment `timeline` (authoritative; the latest sentence entry that
  has started, so word clips keep their sentence lit; `seq` mapped to a
  position, else range start + entry index). The length-weighted
  `WordNewArticlePlaybackHighlighter.segmentSentences` estimate (new, shared
  with `segment`) is only the fallback for segments without a timeline (W4 is
  to send it from pycore).
- Lazy sentence pages (`useOrchAudioSentencePages.ts`): the player opens on
  sentence page 1 and fetches other pages on demand, deduplicated per page:
  (a) sentence mode walks pages through the engine's existing page advance
  (`loadVerses` / `getPage` / `getLastPage`, as the book reader does for
  pages); the next page is prefetched 20 sentences before the page end;
  (b) segment mode loads the active segment's position range and the next
  segment's range; a segment jump loads its range before playing; (c) the
  sentence list loads the next page when its end sentinel scrolls into view and
  offers a button for a gap before a jumped-to page. The sentinel is the
  existing home-content IntersectionObserver, extracted as
  `hooks/useWfNewLoadMoreSentinel.ts` and used by `WfNewHomeContent` and the
  player (no new paging helper; wordnew had no accumulate-pages hook). Same-page resources: original prompt, segment strip,
  task `words` (`playWordClip`, now exported), current-sentence words
  (`WordNewDailyReadingCurrentSentenceWords` + `getSentenceWordTable`), sentence
  rows (`WordNewBookReaderVerseRow`).
- Refactors: `hooks/useWordNewSentenceAudioCells.ts` extracted from
  `pages/WfNewBookReader.tsx` (cell status seeding, sentence-audio polling,
  retry, queue-head move, URL resolve) and used by both the book reader and the
  player; `utils/WordNewTimeFormat.formatClockTime` replaces the daily-reading
  overlay's local `fmtTime`.
- i18n: `orchAudio.*`, `home.orchAudioTitle|orchAudioDesc`, `home.labsHeader`
  in `locales/en_a.ts` / `zh_a.ts` (ja/ko fall back to English). Settings key
  `WORDNEW_ORCH_AUDIO_PLAYER`.

Risks / limits:

- Segments without a ready mp3 are disabled in the strip; if reached by
  auto-advance the engine reads the segment text with browser speech.
- Sentence rows without `audio_url` are polled through the book reader's
  sentence-audio scheduler, which moves them to Laravel's sentence queue head
  (active, unlike the passive detail lookup).
- Segments delivered without `timeline` fall back to the estimate (vocab_book
  segments also contain word clips, so drift is larger there); unloaded
  sentences in the range count with weight 1.
- A segment verse whose pages are not loaded yet carries the item preview as
  its text (only used for the speech fallback and read-aloud live region).
- Not run: builds, type checks, tests, services.

### W4 implementation record (R7 + R8 pycore)

> Superseded in part by W8 (`REQUIREMENTS_20260927_LARAVEL_DIFF_DELIVERY_REDIS_INDEX.md`
> "W8 implementation record"): delivery state is namespaced per Laravel
> server, kind backfills / domain markers / receipts no longer decide
> delivery (Laravel's diff does), the legacy audio outbox import was
> removed, and nothing starts at import (`pyctl/laravel/delivery_service.py`).

One delivery layer: `pycore/pyutils/laravel/delivery_outbox.py`
(`laravel_delivery_outbox`), the upgrade of the former
`pyutils/tts/audio_delivery_outbox.py` (deleted).

- Store: one SQLite record store `APP_CONFIG_DIR/laravel_delivery_outbox.sqlite3`
  (WAL, survives restarts). Row = `delivery_id` (idempotency key), `kind`,
  optional `identity` (rows sharing it transfer the payload once), optional
  retained payload copy (`payload_path`/`payload_sha256` under
  `<cache>/laravel_delivery/<kind>/`), `identity_delivered` +
  `identity_receipt`, ordered per-kind `steps`, process-aware lease, attempts,
  `retry_at`, `last_error`, `dead_letter`. Receipts (tombstones) per identity
  or per delivery (kind policy) make re-enqueue and backfill no-ops; per-kind
  metrics rows (`delivered`, `failures`, last success/failure).
  The legacy audio outbox (sqlite or json) is imported once (lane `word` /
  `sentence` / `orchestration` → kind `audio_lane.word` /
  `audio_lane.sentence` / `audio_orch.resource`, `domain_*` → identity
  fields, `result_accepted`/`history_recorded` → `steps`). Old files are left
  in place (not deleted).
- Kinds: `DeliveryKind(name, deliver(row, owner) -> {status: done|retry|
  dead_letter}, backfill?, on_delivered?, ready?, permanent_error?, steps,
  parallel, batch_limit, retry_initial/max_seconds, receipts)`, registered by
  each feature's shared instance.
- Scheduler: one drain per kind (bus task; atomic begin/end on the outbox
  owner thread so an enqueue never strands a row), batches deduped by
  identity, bounded parallelism, exponential backoff, waits for the next
  `retry_at` or a wake kick. Exceptions = retry (or dead letter when the
  kind's `permanent_error` says so).
- Online edge (no new poller): `laravel_endpoint_manager.note_reachability`
  is fed by every `laravel_client` request (response not 502/503/504 =
  reachable; timeout/unreachable error = offline) and every health probe.
  An unknown/offline → online transition republishes `LARAVEL_ONLINE_SIGNAL`
  and triggers `LARAVEL_ONLINE_EVENT`; the outbox resets backoff of all
  waiting rows, runs every kind's backfill and restarts the drains. A kind
  registered while Laravel is already reachable backfills at registration.
  `worker_base` no longer publishes its own online signal.
- Status: routes `ui/laravel_delivery/status` (`{kinds: {kind: stats},
  laravel_online_at, laravel_base_url}`) and `ui/laravel_delivery/retry`
  (`{kind?, backfill?}`: dead letters → pending, optional backfill, kick).
  Replaces `ui/queue_center/retry_audio_delivery`.

Migrated features (kind → handler):

| kind | handler | enqueue | backfill |
| --- | --- | --- | --- |
| `audio_lane.word`, `audio_lane.sentence` | `pyctl/tts/laravel_audio_delivery.py` (domain report → global result → local history; receipts per identity) | lane worker after synthesis | — (Laravel queue owns history) |
| `audio_orch.resource` | `pyctl/audio_orchestration/orch_delivery.py` (sentence report / word fill-missing upload) | `orch_delivery.synchronize_audio` during generation | — |
| `audio_orch.output` (R7, new) | `orch_delivery._deliver_output` → W5 `ingest/tasks` then `ingest/segment-audio` (offset-v1) for `segments_missing`; 422 = dead letter; receipts per delivery | end of every run (`done`/`failed` with ≥1 segment) | every task in `orch_store` without a receipt (full history, pre-feature tasks included) |
| `agent_history.article` | `pyctl/agent_history/pipeline/delivery.py` (full submit) | after the local record is saved; after a rebuild of a not-yet-uploaded record | `article_records.pending_uploads()` |
| `agent_history.article_audio` | same module (audio replacement) | after a rebuild of an uploaded record | `article_records.pending_rebuild_uploads()` |

R7 wire mapping (W5 contract): `task_id`, `source`, `name`, `language`,
`status`, `source_ref` (+ `book {source_key, title}` for book tasks),
`source_text` (new optional task field set by `submit_text_task(...,
source_text)`; prompt rewrite passes the original prompt), `sentences`
(first 5000), `resources` (unique manifest word/sentence items, first 2000),
`segments [{index, sha256, bytes, start, end, status, started_at,
finished_at, duration_ms, timeline}]` (null fields omitted), `pattern`,
timestamps; `meta_hash` = sha256 of the canonical
payload + `generation_id`. Output row key = task id + generation id + finished
segment files (index/size/mtime); a changed or deleted task supersedes its
old row. `ingest/probe` is not used (local receipts already skip delivered
history; the upsert answers `segments_missing`).

Segment timeline (lead request): `orch_generate` now records, at assembly,
`segment.timeline = [{seq?, type: word|sentence, start_ms, end_ms}]` (clip
offsets in concat order clip, gap, clip ...; each clip and the gap file
probed once per run via `ffprobe_client`; any unprobeable clip → `[]`) and
`segment.duration_ms` (probe of the assembled mp3); both survive resume.
Manifest items carry the sentence `seq`. Segments assembled before this
change are not re-assembled and send `timeline: []`. Both fields are part of
the payload and therefore of `meta_hash`. TS: `OrchSegment.duration_ms|timeline`.

Removed duplicates: `AudioDeliveryOutbox` / `AudioDeliveryExecutor`
(pyutils/tts), the per-lane drain loop / outbox signal / identity dedup /
retry constants in `laravel_audio_worker_execution.py`, the orchestration
recovery poller (`orch_resources._recover_deliveries`, `recover_deliveries`,
`pending_delivery_counts`, `_deliver*`), the agent-history upload tick
(`_piggyback_upload_tick`, `_drain_*_uploads`, `_UPLOAD_TICK_RUNNING`) and
the per-record retry/backoff fields in `article_records`
(`_delivery_retry_at`, `_mark_delivery_failed`, `_reset_delivery_state`,
`_delivery_priority`, `mark_upload_failed`, `mark_rebuild_upload_failed`,
unused `mark_rebuild_upload_received`).

Audited, kept (not outboxes): `worker_result_delivery.py` (typed result POST
primitive used by the audio handler; persistent retry is Laravel's lease
release), `progress_upload.py` (offset-v1 transport used by the handlers),
audio full syncs (`*_full_sync.py`, Laravel → pycore pulls),
`audio_queue_cache` / `audio_lane_state` (queue snapshot, status push),
`pyctl/laravel/sync/*` (user-triggered media sync), relay device events
(live, deliberately fire-and-forget), `rpc_event_outbox` (browser SSE, not
Laravel), codesync push (peer-to-peer).

UI: `components/PcDeliveryOutboxStatus.tsx` (renamed from
`PcAudioDeliveryOutboxStatus`, generic per kind: pending, per-stage counts,
dead letters, delivered, last error, retry) used by the word/sentence panels
and by `pages/audio-orchestration/OrchDeliveryStatus.tsx`
(`OrchDeliveryPanel`: online state + `audio_orch.output` /
`audio_orch.resource`; `OrchTaskOutputDelivery`: per-task
`progress.output_delivery`). Types `LaravelDeliveryKindStatus`,
`LaravelDeliveryStatus`, `LaravelDeliveryOwnerCounts`; API
`laravelDeliveryStatus` / `retryLaravelDelivery`; i18n
`queueCenter.deliveryOutbox.{delivered,lastError,laravelOnlineAt,
laravelOffline,stages.*,kinds.*,taskOutput}` (en/zh).

Behavior differences:

- Audio lanes: the per-poll `_on_laravel_online` now only kicks the drain;
  backoff reset happens on the real offline → online edge and at worker
  init (before: every successful diff poll reset the backoff). Worker status
  `delivery_outbox` is the generic stats shape (`by_stage.payload|result|
  history` replaces `pending_domain_upload|pending_result|pending_history`).
- Audio lane exceptions no longer abort the drain batch; the row is retried.
- Agent history: retry/backoff (2 s → 300 s) lives in the outbox; drains
  are immediate on enqueue instead of one record per heartbeat tick; the
  heartbeat upload callback now backfills + kicks. Old per-record
  `*_attempts/_not_before/_last_error` fields are ignored.
- Orchestration clips: no 5 s recovery poll; drained on enqueue / edge.

Risks: the store scans all rows per query (same as the old audio outbox;
receipts grow with delivered identities); `laravel_client` now hops to the
endpoint-manager owner thread once per request; book tasks with more than
5000 sentences send only the first 5000; historical prompt-rewrite tasks
have no `source_text`; `cached_task_sentences` may start a book sentence
sync when the cache is missing.

Walkthrough fixes (static trace of the final code):

- Upload payload: `sentences` / `resources` are omitted (not `[]`) when not
  available locally, so W5's partial-update rule keeps Laravel's copy;
  `updated_at` is sent but excluded from `meta_hash`.
- Backfills (`audio_orch.output`, `agent_history.*`) enqueue with
  `only_new=True`: existing rows are not rewritten every heartbeat.
- Online edge only for configured Laravel endpoints (the same client also
  reaches e.g. the OCR bridge); a kind registered before any Laravel call
  triggers one `resolve()` probe so startup backfill never waits for an
  unrelated request.
- `config/pycore_relay_contract.json`: `ui/laravel_delivery/status`
  (general_read) and `ui/laravel_delivery/retry` (general_write), otherwise
  the relay default policy denies them on the remote Audio Orchestration
  page; the panel load failure is caught. Device and coordinator must deploy
  the same contract file (contract digest).

Not run: builds, type checks, tests, services (only `py_compile` and an
AST name check of the edited Python files). Note: the component rename was
done with `git mv`, so that rename is staged in the index.
