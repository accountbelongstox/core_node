# Audio Orchestration (pycore)

Scope: pycore audio orchestration (tasks, sources, plan, resources, assembly, video, automatic queue, progress pushes), the audio lanes it feeds, the clip routes clients use, delivery of its output to Laravel, and the pycore-manager page.

Authority: code > config/*_contract.json > this document.

Related: wordnew / shared client composer `docs_fix/DESIGN_WORDNEW_CLIENT.md`; client clip scheduler hard rules `development-guides/WORDNEW_GUIDE.md` section 1; Laravel delivery outbox and audio queue Part2 / work leases `docs_fix/DESIGN_QUEUE_PIPELINE.md`; prompt-rewrite feed `docs_fix/DESIGN_AGENT_HISTORY.md`; pycore rules `development-guides/PYTHON_PYCORE.md`.

## 1. Components

| Layer | Files |
|---|---|
| pycore domain | `pycore/pyctl/audio_orchestration/`: `orch_service` (route-facing task service), `orch_store` (persistence, single task owner), `orch_sources` (source ids, sentence provider, output modes), `orch_contract` (defaults loader), `orch_plan` (pattern expansion, manifest state), `orch_generate` (run pipeline), `orch_resources` (resource resolution), `orch_promote` (lane Part1 fill), `orch_words` (word selection, virtual read), `orch_books` (Laravel books / sentences), `orch_auth` (Qy session, word groups), `orch_assembly` (ffmpeg gap, timeline, concat), `orch_video` / `orch_video_presets` (video render, presets), `orch_translations`, `orch_queue` (automatic queue), `orch_events` (pushes), `orch_files` (system probe, segment files, clip routes), `orch_delivery` (Laravel output kind), `orch_messages` (message codes) |
| pycore shared | `pyutils/tts/audio_queue_center.py`, `audio_queue_part1.py`, `audio_task_queue.py` (lane queues), `pyutils/tts/word_audio_cache.py`, `pyutils/tts/sentence_audio_cache.py`, `pyutils/tts/batch/kokoro_batch.py`, `pyutils/common/ffmpeg/` (`ffmpeg_scroll`, `ffmpeg_subtitle`, `ffmpeg_command`, `ffmpeg_models`), `pyfoundations/sentence_segmenter.py`, `pyfoundations/core_node_dirs.py` (`resolve_portable_path`, `portable_path`) |
| pycore routes | `callmodule/rpc_routes/local_audio_orchestration_routes.py`, `callmodule/rpc_routes/route_names.py` (`UI_AUDIO_ORCH_*`, paths from `config/pycore_rpc_contract.json`) |
| Contracts | `config/audio_orchestration_contract.json` (defaults, step types, `transfer`), `config/sentence_segmentation_contract.json`, `config/queue_center_contract.json` (`head_parts`, `audio_lane_state`, `work_leases`, Laravel endpoints), `config/pycore_relay_contract.json` (relay route policies) |
| UI | `poly_apps/pycore_laravel_wordnew_ui/apps/pycore-manager/pages/PcAudioOrchestrationPage.tsx` + `pages/audio-orchestration/`; API types `core/integrations/pycore/PycoreApiOrchestration*.ts`; locales `pc-locales/OrchLocales.ts` (`audioOrchestration.*`) |
| Laravel | `AppQyV1OrchAudioCtl`, `AppQyV1OrchAudioService`, `AppQyV1OrchIngestValidator`, `AppQyV1OrchAudioTaskModel`, `AppQyV1OrchAudioSegmentModel`; routes `routes/AppQyV1Router/AppQyV1OrchAudio.php`; messages `lang/{en,zh_CN}/audio_orchestration.php` |

## 2. Tasks and sources

- Sources (`orch_sources.ORCH_SOURCES`, returned by `tasks/list` as `sources`; the UI never hardcodes them):
  - `vocab_book` (default for a record without `source`): sentences from the Laravel book (`book.source_key`, `orch_books`).
  - `prompt_rewrite` (text source): inline `sentences` stored on the task, built by `build_text_sentences` from submitted text (shared segmenter, `speakable=True`).
- Everything after the sentence list (manifest, resources, assembly, delivery) is one pipeline for every source.
- Defaults come only from `config/audio_orchestration_contract.json` (pycore `orch_contract`, TS `core/contracts/AudioOrchestrationContract.ts`): `default_output_mode` `audio`, segmentation `count` / 1, pattern `words_new` (with `meaning: true`), `sentence_zh`, `sentence_en` x2, `max_step_times` 5, `default_word_mode` `new_only`, `default_new_only_max_read_count` 0, `default_virtual_batch` `default`. Step types `words_new`, `words_all`, `sentence_zh`, `sentence_en`; `words` (contract `legacy_step_types`) normalizes to `words_new` / `words_all` by `word_mode`.
- A book task defaults to the contract segmentation (`count` / 1: one book or chapter is one segment); choosing `minutes` defaults its value to 10 (`orch_service._DEFAULT_BOOK_SEGMENT_MINUTES`). A prompt task is always one segment (`count` 1; segmentation edits are ignored).
- `output_mode` `audio` or `video` (`orch_sources.ORCH_OUTPUT_MODES`, default from the contract). Audio segments are always produced (they are what Laravel receives); a video task also renders `segment_NNN.mp4`.
- `auto_generate` (default true) opts a task in or out of the automatic queue.
- `submit_text_task` / route `task/submit_text` `{source, items: [{text, language?}], name?, source_ref?, source_text?, generate?, output_mode?}`: creates a text task (pattern `sentence_en` or `sentence_zh` x1, `count` 1) that the queue generates; `generate: false` leaves a draft the queue does not start. Errors `ORCH_SOURCE_UNKNOWN`, `ORCH_TEXT_ITEMS_REQUIRED`. Caps `ORCH_TEXT_ITEM_CAP` 50, `ORCH_TEXT_CHARS_CAP` 8000.
- Retention: text tasks keep the newest `ORCH_TEXT_TASK_RETENTION` (200) per source; older records are deleted through `task_delete`.
- `task/create` creates `vocab_book` tasks; `task/update` ignores `book` on text tasks. Editing a plan field (`book`, `segment_mode`, `segment_value`, `pattern`, `word_mode`, `new_only_max_read_count`) resets the task to a never-started draft so the queue regenerates it.
- Orchestration routes never block: they answer from the local cache and run Laravel fetches as background jobs, so relay execution limits are never hit by a slow upstream. Relay needs no Qy or manager login.
- Word groups (Qy account): after login all default word groups load with their server-authoritative read-word records; the default group is selected initially and another group may be chosen as the baseline; the selection persists in pycore across refreshes. The session lives in pycore `auth.json`; `orch_auth` serves `auth/groups` and persists `auth/select_group` (`word_groups`, `word_group_id` in the auth record). Words-only-new uses the selected group when logged in, else the task-local virtual read set; the virtual read set is task-scoped and never written back to Laravel.

## 3. Persistence (`orch_store`)

- Data dir `get_app_data_dir()/audio_orchestration/`: `auth.json`, `books_cache.json`, `book_sentences/<key>.json`, `book_sentences_partial/`, `sync_state.json`, `system_status.json`, `tasks/<task_id>.json`, manifests, `output/<task_slug>/segment_NNN.mp3|mp4`, `video_presets.json`, `video_backgrounds/`.
- `_TaskStore` is the single owner of every task record (serialized owner thread; the authoritative copy is in memory, written through on each mutation; readers get snapshots). Field groups:

| Group | Fields | Writer |
|---|---|---|
| run (`TASK_RUN_FIELDS`) | status, progress, segments, generation_id, generation_started_at, generation_finished_at, plan_signature, virtual_read, cancel_requested, word_group_id, auto_retries | `commit_run(copy)` (throttled progress ticks refresh memory only; `flush_tasks`), `patch_run_fields` outside a run |
| config (`TASK_CONFIG_FIELDS`) | name, book, segment_mode, segment_value, pattern, word_mode, new_only_max_read_count, output_mode, video_preset, auto_generate, source_ref, source_text, sentences | `patch_task` (atomic) |
| log | events | `append_task_event` (atomic, capped 200), `clear_task_events` |

- `commit_run` writes only run fields and refreshes the run's copy with config edits and events made meanwhile. Read paths never mutate; interrupted runs are recovered once at startup by the queue.
- Task list (`tasks/list` → `page_tasks`): newest-first keyset pages keyed by the immutable `(created_at, task_id)` (`pyutils/common/keyset_cursor`), filtered by `source` and name `query`; list-sized records (no sentences, events, source_text, virtual_read); answer `{success, sources, counts, total, items, next_cursor, has_more}`. A task that changes between pages is neither skipped nor repeated; live changes reach the UI as pushes.
- Active tasks (`tasks/active` → `active_tasks`): running jobs plus every `generating` task, most recently updated first, at most `ACTIVE_TASKS_LIMIT` (50); `{success, items, total}`.

## 4. Run pipeline (`orch_generate`)

Phases (persisted as `progress.phase`, times in `progress.phase_times[phase] = {started_at, finished_at}`):

1. Manifest (`orch_plan.build_sentence_items`, `orch_words`): expand the pattern into ordered per-segment items and the unique word / sentence resource list (items carry the sentence `seq`); the virtual read is consumed once and persisted; the manifest is saved and a resumed run continues from it (`load_resume_state`).
2. Resources (`orch_resources.resolve_batch`):
   - batch cache scan: words via `word_audio_cache.find_cached_many` (in-memory `word_audio_cache_index`, loaded in full at boot), sentences via `sentence_cache_hits` / `sentence_audio_cache.lookup_many` (identity resolved once per batch);
   - misses become local Part1 tasks of their own lane owned by the task (`orch_promote.promote_missing_to_queue_head`, owner = task_id);
   - per chunk: `take_local` → generate → `settle_local`. Words: one Kokoro batch per chunk through the single entry `kokoro_batch.synthesize_words_to_cache` (`WORD_BATCH_CHUNK_SIZE` 200; no per-word synthesis). Sentences: central sentence cache → Laravel sentence audio → local synthesis (`resolve_sentence_audio`; Laravel downloads are stored into the central cache under the current sentence-engine identity);
   - `take_local` returns `{taken, inflight, absent}`: only locally owned copies are taken (`take_by_dedup_keys` never takes a Laravel work item); `inflight` items (a lane worker popped them, or another owner took them) are awaited by `_await_lane_settled` with no fixed deadline: the wait lasts while the generator shows progress and a key is resolved by the task itself once it stalls (`audio_queue_center.stalled_keys`, contract `work_leases.progress_stall_seconds`), the lane halts, or the task is cancelled; settled items are read from the cache (`delivered_by_lane` counts as synced); words the lane failed go back through the Kokoro batch;
   - `release_owner_queue` on cancel and delete.
3. Assembly: a segment is assembled the moment its last resource resolves (per-segment waiting sets); the final phase only catches the remainder. `orch_assembly`: 0.6 s gap clip, re-encoding concat, `segment.timeline = [{seq?, type: word|sentence, start_ms, end_ms}]` and `segment.duration_ms` (ffprobe; an unprobeable clip gives `timeline: []`). Segments carry `started_at` / `finished_at`; manifest resources carry `resolved_at`.
4. Video (video tasks): rendered per segment right after its audio.

Storage of audio: sentence audio lives only in the content-addressed `tts_sentence_cache` shared by every TTS entry point; word audio only in the unified `word_audio_cache` (`{word}@{provider}.mp3`, lower-cased word). Generated clips reach Laravel through the cache-level delivery kind `audio_cache.resource` (section 8).

Run fields: `generation_started_at` (kept on resume), `generation_finished_at` (set by the single terminal helper `_finish` on done / failed / cancel / crash). Message codes (`orch_messages`): progress carries `message_code` + `message_params`, events `code` + `params`; the UI localizes by code; no raw exception text is a param.

Sentence boundaries: every component uses the shared segmenter (`config/sentence_segmentation_contract.json`; adapters `pyfoundations/sentence_segmenter.py`, Laravel `App\Support\SentenceSegmenter`, UI `core/contracts/SentenceSegmenter.ts`; every adapter passes all contract vectors). No component splits sentences with its own regex. Timing estimates use the same contract (`estimate_seconds`, `sentence_gap_seconds`).

Translations (`orch_translations.complete`): before resources, each text-task sentence missing a language is translated once through the shared translator and stored on the task (`sentences[].languages`); a failed sentence keeps its one language and is counted in the run log.

Books (`orch_books`): Laravel `media/books` list and `media/books/{key}?grain=sentence` pages of 500 rows, 45 s timeout, 3 attempts per page, resumable partial, keyset `after_seq` + `after_id` when the server returns `next_after_seq` (page numbers otherwise). Sync jobs store a stable `error_code` + short `detail` + attempt time; a failure belongs to its attempt and clears on the next attempt; the books banner shows only the books-list job; per-book failures show on the book row with Retry.

## 5. Video

- Pipeline: `orch_video` builds cards from the segment audio and `timeline`; `pyutils/common/ffmpeg` lays out (`ffmpeg_scroll`), writes ASS (`ffmpeg_subtitle`, libass) and renders 1280x720 libx264 + aac (`ffmpeg_command`).
- Cards: a sentence card has an English and a Chinese line; a word card is a boxed chip with its short Chinese meaning (`orch_video.short_meaning`, offline ECDICT) underneath. Consecutive clips of one sentence or repeats of one word form one card. The spoken card sits on the focus line, played cards scroll away above, upcoming cards are visible below. Line states `upcoming`, `active`, `companion`, `past`. Scroll modes `step` and `smooth`. Languages `both` (default) / `en` / `zh`.
- Long unbreakable tokens get a `fit_scale` (`\fscx` / `\fscy`, floor `MIN_FIT_SCALE` 0.55, then hard wrap); CJK lines are never scaled.
- Presets (`orch_video_presets`, all values clamped by `sanitize`): `languages`, `fps`, `show_progress_bar`, `progress_color`, opacities, `layout{scroll_mode, scroll_seconds, focus_y, column_width, card_gap, line_gap}`, `sentence{...}`, `word{...}`, `background{kind color|image|video, color (#FFFFFF), path, dim}`. Built-in read-only presets Clean White (default), Night Study, Warm Paper; user presets in `video_presets.json` (max 50); one active preset; a task may pick `video_preset`. Fonts from a per-OS catalog. `background.path` is accepted only inside `video_backgrounds/` (filled by `video/background_import`, local UI only). `video/preview` renders one PNG frame from unsaved settings.
- A segment that cannot be rendered (no timeline, audio or manifest gone) is `skipped` with an error code; a failed video is not retried by the queue.

## 6. Automatic queue (`orch_queue`)

- Heartbeat tick every 5 s (`TICK_SECONDS`), immediate tick on create / edit, full scan every 12 ticks. Candidates in creation order; capacity one run per source (`MAX_CONCURRENT_PER_SOURCE` 1), so a book never blocks prompt tasks.

| Task | Action |
|---|---|
| never-started draft | generation (`new`) |
| `generating` without a job | resume from the manifest (`interrupted`) |
| finished video task with unrendered segments | video render (`videos`) |
| finished video task whose preset changed | video re-render (`rerender`) |
| failed only on `orch_segment_missing_items` / `orch_segment_no_audio` | generation again (`retry`) |
| cancelled, other failures, `auto_generate` false | never automatic |

- Retry: at most `MAX_AUTO_RETRIES` 3, after `RETRY_BACKOFF_SECONDS * 2^retries` (60 / 120 / 240 s), only for failures newer than `RETRY_WINDOW_SECONDS` (24 h); `auto_retries` is a run field; a retry keeps finished segments.
- Prerequisites, reported as `waiting` (`ffmpeg`, `sentences`): ffmpeg present; the sentence source ready (reading a book's sentences starts its sync).
- Queue state `idle / queued / waiting / running` lives in memory and is merged into summaries (`states_of` once per page); a state change is logged once and never for a task whose run is active. The manual `task/generate` route only forces a run ("Regenerate").
- The queue starts when the orchestration routes register (service start). Never call the route registration in a check: it starts real generations.

## 7. Progress and pushes

- Topic `audio_orchestration.tasks.changed` (`orch_events`, `BusSignals.AUDIO_ORCH_TASKS_CHANGED`, TS `PYCORE_EVENT_TOPICS.audioOrchestrationTasksChanged`), bridged THREAD_BUS → `thread_bus_routes` → HTTP event delivery → browser `pycoreEventBus`, and to relay devices. Payloads:
  - status transition `{task_id, source, status}` (create, generating, done / failed / draft, `deleted`; repeated statuses dropped);
  - progress delta `{task_id, source, status, progress}` with `progress` in the queue-center `progress_template` shape over the task's segments, at most once per `PROGRESS_MIN_INTERVAL_SECONDS` (1 s) per task.
- UI (`useOrchTaskListing`): a status push reloads the keyset page and the active strip; a progress push patches listed rows in place (rows never move while a task generates); an event gap (`watchEventGap`) reloads. `OrchTaskDetail` refreshes on the topic while its task runs.
- Per-task lane progress: `orch_service` merges per-lane owner counters (cached `_LANE_COUNTS_TTL_SECONDS` 2 s, one scan per lane; idle tasks cost nothing); manifest rows (`task/manifest_page`) carry their lane queue state and `resolved_at`. The task view embeds `PcAudioLaneQueueView` scoped to the task owner (`useAudioLaneOwnerViews`).
- Timing UI: `OrchRunTiming` (run start / finish / duration or live elapsed, per-phase durations, per-segment timing); lane tracker entries carry `queued_at`, `started_at`, `finished_at`.

## 8. Audio lanes (state-driven)

- Each lane (`word_audio`, `sentence_audio`) owns one whole-Queue = Part1 + Part2 (`config/queue_center_contract.json` `head_parts`). Part1 = pycore-local priority, filled only by orchestration misses and the pycore-manager manual promote (`ui/queue_center/promote_local_head`, accepts `owner`; also the client `generate:pycore` stage). Part2 = this node's Laravel work (work leases; `docs_fix/DESIGN_QUEUE_PIPELINE.md`). Every mutation and dedup is whole-Queue; the split is visualized read-only, actors never address a part.
- Part1 tracker (`audio_queue_part1`): `queued → processing → done | failed` with owners, provider, `settled_by`, times; owner API `take_local`, `settle_local`, `tracked_states`, `owner_counts`, `release_owner`. Whole-Queue dedup: a promoted item whose single copy is already queued (including a leased Laravel item) is claimed into Part1 instead of inserted, so it is generated and reported once; `release_owner` drops orphaned local copies and returns a claimed Laravel item to Part2.
- One ON transition (`pyctl/tts/audio_lane_activation.activate_audio_lane`), used by the Queue Center control, auto-start helpers and boot (`event_handlers._start_audio_lane_boot_chain`, which also loads the word-cache index): restore local Part1 items from the snapshot → release the worker's stale leases → claim a lease batch → drain. A lane whose persisted switch (assist capability) is OFF is never activated. Cache before remote: at startup the local lane snapshot loads before any remote access (`apply_assist_runtime` runs after the boot chain on the same thread); with Laravel offline the cached state still renders and drains.
- State (`pyctl/queue_center/audio_lane_state.py`): pycore owns the truth (switch, lifecycle, section contract, Part1 / Part2 / whole-Queue view, tracker, worker, outbox, leases). `AudioLaneStatePublisherThread` pushes `queue_center.audio_lane.changed` (coalesced 0.4 s; heartbeat every 5 s only while a lane works); RPC `ui/queue_center/audio_lane_state {owner?, item_limit?}` answers the same payload; `ui/task_center/set_queue_center_control` returns `lane_state`. Every queue mutation bumps a per-lane revision and signals THREAD_BUS; snapshot writes are debounced by a persister thread with a shutdown flush.
- UI: one lane-state store `apps/pycore-manager/api/AudioLaneStateStore.ts` (push, RPC on mount / reconnect, control response; instance + revision guard; slow poll only in relay mode); `components/PcAudioLaneQueueView.tsx` shared by both lanes and orchestration.

## 9. Clip routes for clients

Content-addressed lookup of the same central caches generation uses (`orch_files._resource_entries`, shared by lookup and bundle). Keys: `resource_id = sha256("kind:language:content")` (content = sentence content id or lower-case word), identical on pycore, Laravel and clients.

| Route | Method | Request | Answer |
|---|---|---|---|
| `ui/audio_orch/resource/lookup` | POST | `{items: [{kind: word\|sentence, language, text}]}` (max 500) | `{success, items: [{key, hit, bytes, path, meaning}]}` in request order; `path` = location relative to the WWW base (`core_node_dirs.portable_path`, forward slashes); `meaning` = short ECDICT gloss for English words |
| `ui/audio_orch/resource/bundle` | POST | same items (max contract `transfer.pycore_bundle_max_items`) | `application/x-core-node-clip-bundle`: per item a 4-byte big-endian header length, JSON header `{index, key, hit, bytes, sent, meaning}`, then the clip bytes when `sent`; the first hit is always sent, hits past `pycore_bundle_max_bytes` are `sent: false` and asked again; invalid request → JSON `ORCH_RESOURCE_BUNDLE_INVALID` |
| `ui/audio_orch/resource/file` | GET | `?kind=&language=&text=` | raw `audio/mpeg`, 404 on a miss, ETag / 304, `private, max-age=3600` |
| `ui/audio_orch/resource/chunk` | POST | `{kind, language, text, offset, length}` | base64 chunk (same reader as `task/file_chunk`) |

- Frame format and limits change only together with `config/audio_orchestration_contract.json` `transfer` and the TS parser `core/integrations/pycore/PycoreApiOrchestrationResources.ts` (`parseOrchResourceBundle`).
- Task files: `task/files` lists segment files by kind; `task/file_chunk {task_id, name, offset, length}` streams base64 chunks of at most 1 MiB with `eof`, `bytes`, `media_type`; only `segment_NNN.mp3|mp4` inside the task output folder is readable (`ORCH_FILE_NAME_INVALID`, `ORCH_FILE_NOT_FOUND`); `open_output` opens the folder on the pycore host (local UI only).
- Probe (from any tailnet machine; the `/pycore-api` mount makes callers loopback so K7 admits them):

```bash
B=https://<machine>.<tailnet>.ts.net/pycore-api/api
curl -s -o /dev/null -w "status %{http_code} %{time_total}s\n" $B/status
curl -s -o /dev/null -w "file %{http_code} %{time_total}s %{size_download}B\n" -H "X-Pycore-Client-ID: probe" \
  "$B/ui/audio_orch/resource/file?kind=word&language=en&text=apple"
curl -s -H "Content-Type: application/json" -H "X-Pycore-Client-ID: probe" -X POST -o bundle.bin \
  --data '{"items":[{"kind":"word","language":"en","text":"apple"}]}' $B/ui/audio_orch/resource/bundle
python3 - <<'EOF'
import json, struct
b = open("bundle.bin", "rb").read(); o = 0
while o < len(b):
    n = struct.unpack(">I", b[o:o+4])[0]; h = json.loads(b[o+4:o+4+n]); o += 4 + n
    o += h["bytes"] if h["sent"] else 0
    print(h["index"], h["hit"], h["sent"], h["bytes"], h["meaning"])
assert o == len(b)
EOF
```

## 10. Delivery to Laravel

- Outbox, server selection and diff semantics: `docs_fix/DESIGN_QUEUE_PIPELINE.md`. Data goes to the server selected in the UI (`endpoint_manager.selected_namespace()`); stored paths are re-rooted per host (`core_node_dirs.resolve_portable_path`).
- `audio_orch.output` (`orch_delivery.OrchDelivery`): finished task output (`done` / `failed` with at least one segment) of every source. Inventory = deliverable tasks keyed by task id + `meta_hash` (cached per output version), diffed by Laravel `POST /api/app_qy_v1/delivery/diff` kind `orch_output`; exactly the reported tasks are queued. Before re-sending, `_server_needs_output` asks the diff whether the server already holds the output. Per-task counts in `progress.output_delivery`; status panel `OrchDeliveryStatus.tsx`.
- Clips (words / sentences) go through the cache-level kind `audio_cache.resource` (`pyctl/tts/audio_resource_delivery.py`).
- Laravel ingest (`/api/app_qy_v1/orch_audio/ingest/*`, middleware `ServerIdentityHeader` + `client.key`):
  - `POST ingest/tasks` `{machine_id, tasks: [Task]}` (1..50): upsert by `task_key = sha256(machine_id + "\n" + task_id)[0:40]`; `meta_hash` equal → `unchanged`, else `updated`; optional fields are partial updates (absent key keeps the stored value, explicit `null` / `[]` clears); the declared `segments` list replaces the stored one; answer per task `{task_id, task_key, result, segments_missing}`; a task failing validation fails the request (422). `Task` = `{task_id, meta_hash, source, name?, language?, status, source_ref?, source_text? (<=200000), sentences? (<=5000), resources? (<=2000), segments?: [{index, sha256, bytes, duration_ms?, start?, end?, status?, started_at?, finished_at?, timeline?}], pattern?, created_at?, updated_at?, generation_started_at?, generation_finished_at?}`. pycore folds `generation_id` into `meta_hash`; `updated_at` is sent but excluded from it; book tasks put `book {source_key, title}` in `source_ref`; `sentences` / `resources` are omitted when not available locally.
  - `POST ingest/segment-audio` (offset-v1 resumable upload, query `machine_id, task_id, index` + offset-v1 fields): audio stored content-addressed at `/static/app_qy_v1/audio/orchestration/<sha[0:2]>/<sha>.mp3`; a segment is `ready` only when its stored sha256 equals the declared one; an already stored file answers `upload_complete: true, idempotent: true` on the first chunk. `AppQyV1OrchIngestValidator` checks the heavy arrays linearly; a task whose stored `meta_hash` equals the sent one skips deep validation.
  - Error codes: `ORCH_AUDIO_VALIDATION_FAILED` 422, `ORCH_AUDIO_TASK_NOT_FOUND` 404, `ORCH_AUDIO_SEGMENT_UNDECLARED` 409, `ORCH_AUDIO_SEGMENT_HASH_MISMATCH` 409 (re-send task metadata), `ORCH_AUDIO_UPLOAD_INVALID` 422, `ORCH_AUDIO_STORE_FAILED` 500. pycore: 2xx delivered, 409 re-send metadata then retry, 422 permanent for that payload, 5xx / network retry.
- Laravel read API (`auth:sanctum`, used by the wordnew Delivered view): `GET orch_audio/tasks?source=&q=&page=&per_page=` (newest `task_updated_at` first; `sources: [{id, count}]`), `GET orch_audio/tasks/{task_key}?sentence_page=&sentence_per_page=` (summary + `source_text`, `pattern`, segments with `timeline`, `playlist`, paged sentences and words with passive audio URLs via `AppQyV1AudioGateway`). Client-composed tasks (`orch_audio/client_tasks`, per user): `docs_fix/DESIGN_WORDNEW_CLIENT.md`.

## 11. Prompt-rewrite source

`agent_history.prompt.new` → `prompt_rewrite_watcher` → OpenRouter rewrite (source `agent_history_prompt_rewrite`) → `orch_service.submit_text_task(source="prompt_rewrite", source_text=<original prompt>)` when `prompt_rewrite_audio` is on → push `agent_history.prompt.rewritten` (`item.audio_task_id` set). Feed, config keys and UI: `docs_fix/DESIGN_AGENT_HISTORY.md`.

## 12. pycore-manager page

- Route `/pycore-manager/audio-orchestration[?source=<id>]` (`pcPages.tsx` entry `audio-orchestration`, `nav.audioOrchestration`); workspace `AudioOrchWorkspace.tsx`.
- Books / Prompts tabs (`OrchTaskTabs`) over keyset pages with search and per-source counts, plus the active strip; source badges from `orchSources.ts` (presentation only; ids from pycore).
- Book picker (per-book New Task, unique editable name from book + time), task editor (book dropdown, pattern steps with per-step word policy, preset "Words, Chinese, English x2"), login panel with the word-group baseline, shown for `vocab_book`.
- Output mode control (audio / video), automatic-generation switch, "Regenerate", queue state, run timing, lane progress, manifest drill-down, delivery status, segment files (play / download through `task/file_chunk` blobs, open folder), "Render videos", video preset panel with live preview, `OrchLiveStagePanel` (live client composition of a pycore task over the shared scheduler with the pycore channel only, object URLs, no ffmpeg), learning-video panel (`OrchLearningVideoPanel`, agent-history article video config).

## 13. Routes and relay policies

`ui/audio_orch/`: `books/list`, `book_sentences`, `auth/login|status|logout|groups|select_group`, `tasks/list`, `tasks/active`, `task/get|create|submit_text|update|delete|plan|generate|cancel|progress|files|manifest_page|render_video|file_chunk`, `system/status`, `open_output`, `resource/lookup|chunk|file|bundle`, `video/presets|preset_save|preset_delete|preset_activate|preview|background_import`. Relay policies (`config/pycore_relay_contract.json`): reads `general_read`; `book_sentences`, `video/preset_save|preset_activate` `general_write`; `video/preset_delete`, `task/render_video` `general_action`; `video/background_import` `denied`; routes without an entry take `default_profile` (`general_action`). Delivery status routes `ui/laravel_delivery/status` (`general_read`) and `ui/laravel_delivery/retry` (`general_write`).

## 14. Verification

- Read-only probe of real output: `scripts/pytools/aitools/audio_orch_monitor.py` (snapshot, `--watch`, `--inspect` task / video health, timeline sanity, sentence quality, frames; `--report`; `--json`); it reads task and manifest files and asks the running pycore only for the in-memory queue state.
- Segmenter: every adapter passes all vectors of `config/sentence_segmentation_contract.json`.
- Clip routes: section 9 probe.

## 15. Open items

- Word meaning reading is not implemented in pycore: the contract default pattern sets `meaning: true` on `words_new`, but `orch_service._normalize_pattern` keeps only `type` / `times` and `orch_plan.build_sentence_items` emits no meaning item. To implement: keep `meaning` in the pattern; after each word item emit `{kind: sentence, language: zh, text: short_meaning(ECDICT), meaning_of: word}` (skip empty meanings), resolved like sentences; `orch_video.build_cards` attaches `meaning_of` clips to the word card (as `shared/orchestration/orchStageLayout.ts` does); timeline entries carry `meaning_of`. The contract `step_options.meaning` text names this document.
- `orch_sources.task_output_mode` and `orch_service.submit_text_task` docstrings say the default output is `video`; the code default is the contract's `audio`.
- Word clip lookups on a Windows desktop pycore measured slow and erratic (single `resource/file` of a cached word 0.06-10.5 s; 1-word `lookup` ~0.6 s; 4-item bundle 6.8 s) while status and sentence lookups took ~45 ms (2026-10-01, desktop-1l9k06n). Suspects to profile: the `word_audio_cache_index` serialized owner (`_lookup` / `note_stored`) queueing behind TTS stores or `load_all`, `validate_mp3` per hit, `dictionary_service.translate` for meanings, `await_bus_task` contention in `_invoke_sync_handler`. Targets: cached word `file` / `lookup` <= 100 ms p95 with lanes idle and busy; 64-item bundle of cached clips <= 1.5 s.
- No Queue Center section for orchestration tasks: it needs `config/queue_center_contract.json` changed first with its Laravel / TypeScript / mcp-chrome adapters.
- Some orchestration strings are not i18n'd and `orch_generate._generate` is still ~400 lines.
- Laravel ingest segment rows removed by a re-declared plan leave their content-addressed files on disk (no garbage collection).
- Laravel `moveToHeadBatch` costs ~0.24 s per item; a bulk insert would make the generation-head path cheap.
