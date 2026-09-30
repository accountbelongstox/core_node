# Orchestration Video + Auto Queue + Delivery Refactor - Requirements and Design

Binding design for the 2026-09-30 directives. It supersedes the statements it
lists in section 2 in the earlier documents; those documents carry a pointer
back here. Rule for every item below: fix the foundation, no small patches.

## 0. Global rules

- `AGENTS.md`, `development-guides/PYTHON_PYCORE.md`, `development-guides/LARAVEL_GUIDE.md`.
  English code and logs, i18n for every UI string, no try/except in new pycore
  code, Windows + Linux compatible, no duplicated components (reuse or upgrade).
- Laravel is edited locally only and auto-synced (about 30 s); it is never booted
  locally. The Laravel side of every change here is verified on the server.
- Destructive data changes need the user's word; the dead-letter cleanup of
  section 3.4 was authorized explicitly and backed up first.

## 1. Directives (user, 2026-09-30)

| id | directive |
|---|---|
| D1 | The server selected in the UI is the single authority for where data goes; find why UI selection and pycore diverge and rebuild the layer, not patch it. |
| D2 | Investigate the dead letters; they may be history. Clean only what is truly unusable; keep the correct data. Write the cross-platform path mapping. |
| D3 | Uploads use progress detection, never timeouts, built on the project libraries. |
| D4 | The agent is full stack: the Laravel work is done too (the slow orchestration ingest). |
| D5 | Local pycore audio orchestration produces a 720p video: the current resources, sentences and words become scrolling video content. The played sentence keeps scrolling away above the focus line while the next one is already in the scroll area although not yet played. |
| D6 | UI-extensible video presets: fonts, scroll speed, scroll mode, background image / background video; default background white. Subtitles and words use different fonts and borders; make it look good. |
| D7 | Every orchestration task chooses audio or video, default video. |
| D8 | Under "Orchestration Tasks" use tabs, with a paginated list for prompts and one for books. |
| D9 | Sentences AND words are always shown bilingual (Chinese + English) unless the preset restricts to one language. |
| D10 | A prompt task is ONE segment by default; only books are cut into segments, because they are long. |
| D11 | Video and audio are generated automatically once the resources are ready, not by pressing a button. Extend the queue. |
| D12 | A queue / status writer must never overwrite progress the running generation thread just wrote: rebuild task persistence. |
| D13 | All of the above goes into the design requirements in `docs_fix` and the older documents are updated. |
| D14 | Watch the local prompt generation with a script, look at the real output, improve the code from it; generated audio and video play, download and open their folder in the web UI. |
| D15 | Sentences were cut wrongly at punctuation; prompt tasks lacked the Chinese translation; a long path broke instead of shrinking; the queue was unfair. Fix sentence splitting at the root with ONE shared library used by pycore, Laravel and the UI (a new technical solution, not patches), then return to pycore probing. |

## 2. Statements superseded

- `DESIGN_20260917_AUDIO_ORCHESTRATION.md`: generation started by the user; audio
  only output; segmentation defaults; a single flat task list.
- `REQUIREMENTS_20260926_AUDIO_ORCH_QUEUE_STATE_DRIVEN.md` section 5.5: an
  orchestration run is started by the UI.
- `REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE.md` W2 contract:
  `submit_text` starts generation immediately.
- `REQUIREMENTS_20260927_LARAVEL_DIFF_DELIVERY_REDIS_INDEX.md` W8: new items fan
  out to every reachable server; `base_url_for_namespace`; dead-lettering of
  missing files.

## 3. Delivery layer (D1 - D4)

### 3.1 Measured root causes

1. Failover crossed servers: `resolve()` adopted any healthy candidate, but two
   candidates can be two servers (two databases), so pycore produced data for a
   server the UI never selected.
2. New items fanned out to every reachable server; rows of an offline server
   stayed forever.
3. Head-of-line blocking: the oldest 25 due rows (of an offline server) filled
   the drain window every minute; each release was an fsynced write.
4. Route choice was alphabetical and treated "never probed" as reachable.
5. A read or write stall was recorded as "server unreachable", which now gates
   delivery.
6. Stored payload / ledger paths were absolute paths of the OS that wrote them,
   but Windows (`D:\www`) and Linux (`/www/www`) share one data tree: the other OS
   saw a missing file. Ledger entries also pointed at retained outbox copies that
   are deleted after delivery.
7. `ingest/tasks` validated `segments.*.timeline.*` with wildcard rules that
   flatten the whole 3.5 MB body (tens of seconds); a client read timeout then
   re-posted the body and the retry queued behind the first on the advisory lock.
8. A batch delivery registered lease renewal for rows it never claimed; the first
   renewal of such a row raised "ownership changed" and aborted the whole upload.

### 3.2 Binding design

- Selected server: `endpoint_manager.selected_namespace()` (the stored UI choice).
  `target_namespaces()` is that server only. Failover moves between routes of the
  selected server only; another server that is up is never adopted.
- `route_for_namespace(ns)`: active route if it serves the server, else the
  fastest reachable route, else a bounded re-probe of routes unobserved or last
  probed more than `OFFLINE_REPROBE_SECONDS` ago; '' when none.
- Reachability: connect-level failures only (`laravel_server_unreachable`);
  ReadTimeout / WriteTimeout / 504 never mark a server offline.
- Scheduling: `deliverable_namespaces(kind)` = selected server (every server that
  holds rows for a `pinned` kind, i.e. queue lane rows) minus servers whose routes
  all failed. `ready` / `has_pending` / `next_attempt_at` are scoped by it, so an
  offline or unselected server cannot occupy the drain window. One watcher
  re-probes offline servers every `SERVER_WATCH_SECONDS`; its online edge hurries
  the rows, reconciles and resumes. Reconcile enqueues only for the selected
  server (manual reconcile of another server is still allowed).
- Rows of a server that is neither selected nor a pinned owner are parked (not
  attempted); status shows `selected`, `offline`, `parked` per server.
- `source_gone` outcome: a row whose local file vanished is dropped, not
  dead-lettered; the inventory only lists items that exist.
- A failure while the row's server is offline gives the attempt back and counts no
  metric.
- Uploads (D3): no response timer. Read timeout is None for uploading requests,
  a stalled transfer is detected by write progress (`HttpTransferProgress`,
  `http_transfer_contract`), a dead peer by TCP keepalive on the httpx transport
  (`HTTP_KEEPALIVE_*` constants). A retry of an orchestration output first asks
  the W7 diff whether the server already holds it complete, then re-sends only
  what is missing.
- Batch delivery claims rows first, then registers lease renewal for the claimed
  rows only, non-strict, so one lost lease never aborts the others.
- Cross-platform paths: `core_node_dirs.resolve_portable_path` re-roots a stored
  path from any known WWW base (`D:\www`, `/www/www`, `/www`) onto this host. It
  is applied on read in the delivery repository (`payload_path`) and the ledger
  repository (`path`). A ledger entry never points at a retained copy: publishing
  moves those bytes to `cache/audio_clips/<kind>/<sha[:2]>/<sha>.mp3` first.
- Laravel (D4): scalar fields use Laravel rules on a payload without the heavy
  arrays; `AppQyV1OrchIngestValidator` checks sentences / resources / segments /
  timelines linearly (6 MB, 100k timeline entries about 100 ms); a task whose
  stored `meta_hash` already equals the sent one skips deep validation; task and
  segment reads select only hash / ready columns.

### 3.3 Dead-letter investigation (2026-09-30, 18,825 rows)

They were not history. About 11,400 (61 percent) had a source file that exists on
this host under the mapped path; about 7,400 were retired-kind rows whose retained
copy was deleted. Classes: audio lane word / sentence and audio cache resource.

### 3.4 Cleanup performed (authorized)

Backup first (both sqlite files). Every recoverable clip was rescued into the
ledger (5,416 entries added or refreshed), then all 18,825 dead rows were
deleted (7,388 had no source), then 15,040 ledger entries whose file is gone
everywhere were dropped. Pending rows (19,196, including the parked rows of the
non-selected dev server) were kept. Rescued clips reach a server through the next
reconcile diff.

## 4. Orchestration video (D5 - D9)

### 4.1 Pipeline

`segment_XXX.mp3` (delivered to Laravel, unchanged contract) is assembled first;
a video task then renders `segment_XXX.mp4` from the same audio and `timeline`.
Layers: shared ffmpeg library (`pyutils/common/ffmpeg`): `ffmpeg_scroll` (layout),
`ffmpeg_subtitle` (ASS writer), `ffmpeg_command` (canvas + preview), models;
`pyctl/audio_orchestration`: `orch_video` (cards, render, preview),
`orch_video_presets` (schema, store, fonts, backgrounds).
Video is fixed 720p (1280x720), libx264 + aac, progress bar optional.

### 4.2 Scrolling cards

- A card is a group of lines shown together: a sentence card has an English line
  and a Chinese line; a word card has the word (a boxed "chip") and its Chinese
  meaning underneath in a different font. Consecutive clips of one sentence, or
  repeats of one word, form one card; each line keeps the playback spans of the
  clips that speak it.
- Cards are stacked in one virtual column; the viewport offset follows playback so
  the card being spoken sits on the focus line, played cards keep scrolling away
  above it and cards not yet spoken are already visible below it.
- Line states: `upcoming`, `active` (this line is being spoken), `companion` (its
  card is in progress but another line speaks), `past`. Each state has its own
  colour and opacity.
- Scroll modes: `step` (the card glides to the focus line just before it is
  spoken, then holds; `scroll_seconds`) and `smooth` (never stops).
- Rendering is libass: one ASS event per visible line per time slice between two
  breakpoints (a playback boundary or a scroll keyframe), moving linearly.
  Wrapping is done by the layout (explicit line breaks, conservative width
  estimate) so heights are deterministic.
- Bilingual (D9): sentence text from the sentence record (`languages.en/zh`) found
  by the manifest `seq`, else by text; word meaning from the offline ECDICT
  dictionary (`dictionary_service.translate`). `languages` = `both` (default) /
  `en` / `zh`. A sentence without a translation shows the one language it has.
- Translations of prompt tasks: `orch_translations.complete` translates each
  sentence into the language it lacks (English to Simplified Chinese, Chinese to
  English) through the shared translator, once, before resources are resolved;
  the result is stored on the task (`sentences[].languages`) so nothing is
  translated twice, a failed sentence keeps its one language and is counted in
  the run log, and a sentence that already has both is untouched.
- Long tokens: a token that cannot wrap (a path, a URL, a hash) is never cut in
  the middle; the layout gives its line a `fit_scale` (font scaled down, emitted
  as `\fscx` / `\fscy` in the ASS event) so it fits `column_width`. The scale has a
  floor (`MIN_FIT_SCALE` 0.55, text stays readable); a token still wider at the
  floor falls back to the layout's hard wrap. CJK lines are never scaled.

### 4.3 Presets

Settings document (all clamped by `sanitize`): `languages`, `fps`,
`show_progress_bar`, `progress_color`, `opacity_upcoming`, `opacity_past`,
`layout{scroll_mode, scroll_seconds, focus_y, column_width, card_gap, line_gap}`,
`sentence{font_en, font_zh, size_en, size_zh, bold, text, active, outline_color,
outline}`, `word{font_en, font_zh, size_en, size_zh, bold, text, active, box,
box_active, box_padding, meaning, meaning_active}`,
`background{kind color|image|video, color (default #FFFFFF), path, dim}`.
Sentences are outlined text (serif by default); words are opaque boxed chips (sans
by default). Built-in read-only presets: Clean White (default), Night Study, Warm
Paper; user presets in `video_presets.json` (max 50); one active preset; a task may
pick its own (`video_preset`). Fonts come from a per-OS catalog (Windows font
files, Linux `/usr/share/fonts`); libass is given the fonts directory.
Backgrounds: image or looping video scaled to cover, dimmed by a veil.
Security: `background.path` is accepted only inside the managed folder
(`video_backgrounds/`, filled by `background_import`), so a preset can never make
ffmpeg read an arbitrary file. Preview: one PNG frame from the current unsaved
settings on sample content.

### 4.4 Task fields and defaults

- `output_mode` `video` (default, also for older tasks) or `audio`. Audio segments
  are always produced; the video is additional. Delivery to Laravel still sends
  the audio segments (no contract change; delivering the video is not in scope).
- Prompt tasks (D10): always `count` 1 (`segment_value` 1); segmentation edits are
  ignored. Book tasks: default `minutes` / 10, so a short book is one segment.
- `auto_generate` (default true) opts a task out of the queue.

## 5. Automatic queue (D11)

`orch_queue` (heartbeat tick every 5 s, immediate tick on create / edit, full scan
every 60 s). Fairness: candidates are taken in creation order and the run capacity
is ONE run PER SOURCE (`MAX_CONCURRENT_PER_SOURCE`), so a running book never blocks
prompt tasks and a queue of prompts never waits behind a book; inside a source the
oldest task goes first. Candidate rules:

| task | queue action |
|---|---|
| never-started draft (created, or reset by a plan edit) | generation |
| status `generating` without a job (previous process) | resume from the manifest |
| finished video task with segments never rendered | video render |
| finished video task whose preset was edited | video re-render (force) |
| failed task whose failed segments all ended for a missing resource (`ORCH_MSG_SEGMENT_MISSING_ITEMS`, `ORCH_MSG_SEGMENT_NO_AUDIO`) | generation again (`retry`) |
| cancelled task, a failure of any other kind, `auto_generate` false | never automatic |

Auto-retry: at most `MAX_AUTO_RETRIES` (3) per task, waiting
`RETRY_BACKOFF_SECONDS * 2^retries` (60 s, 120 s, 240 s) after the last finish,
only for failures newer than `RETRY_WINDOW_SECONDS` (24 h), so old history is not
revived and a real error (ffmpeg failure, bad plan) is left for the user. The
counter (`auto_retries`) is a run field written by the queue through the run
writer, and a started retry keeps the finished segments (resume from manifest).

Prerequisites (reported as `waiting`): ffmpeg present; the sentence source ready
(a book's sentences cached: reading them starts the sync). Inside a run every
segment is assembled, and for a video task rendered, the moment ALL of its own
resources are resolved (waiting sets per segment), not after the whole task; the
final phase only catches the remainder. Editing a plan field (`book`, segment
fields, `pattern`, `word_mode`, `new_only_max_read_count`) resets the task to a
never-started draft so the queue regenerates it. The queue state (`idle / queued /
waiting / running`, waiting reasons, reason) is in memory and merged into task
summaries; a state change is written to the task log once and never for a task
whose run is active. The manual generate route only forces a run.
Not done here: a Queue Center section for orchestration (it needs the cross-end
`queue_center_contract.json` changed first, with its Laravel / TypeScript /
mcp-chrome adapters).

## 6. Task persistence (D12)

Root cause: one JSON file per task that any thread could load, edit and write back
whole; the run kept a long-lived copy, so the last writer erased the other's
changes. Design: `orch_store._TaskStore` is the single owner (serialized owner
thread); the authoritative record is in memory, written through on each mutation;
readers get snapshots. Fields are owned:

| group | fields | writer API |
|---|---|---|
| run | status, progress, segments, generation_id, generation_started_at, generation_finished_at, plan_signature, virtual_read, cancel_requested, word_group_id | `commit_run(copy)` (a throttled progress tick only refreshes progress in memory; `flush_tasks`) |
| config | name, book, segment_mode, segment_value, pattern, word_mode, new_only_max_read_count, output_mode, video_preset, auto_generate, source_ref, source_text, sentences | `patch_task` (atomic) |
| log | events | `append_task_event` (atomic, capped 200), `clear_task_events` |

`commit_run` writes only run fields and refreshes the run's copy with config edits
and events made meanwhile. Read paths no longer mutate: the old read-time
"generating without a job becomes failed" recovery is gone; interrupted tasks are
recovered once at startup by the queue. `page_tasks` returns a list-sized page
(no sentences, events, timelines) with per-source totals.

## 7. Sentence segmentation - one library for pycore, Laravel and the UI (D15)

### 7.1 Root cause

Every component cut text with its own rule: pycore `split_sentences` and the TTS
chunker (regex on `. ! ?`), the orchestration prompt splitter, Laravel
`AppQyV1VocabularyDocumentController::splitSentences` (dropped the terminals),
`AppQyV1ArticleTextParser::extractSentences` (cut at every comma, semicolon,
question mark and dot between non-digits), `ItToolsV1TextCtl` (counted `[.!?]+`),
and in the UI `WordNewArticlePlaybackHighlighter` and `BookStats` (regexes). Each cut
decimals, IPs, file names (`pycore-lead.md`), abbreviations (`Dr.`, `e.g.`),
initials and quoted or bracketed endings, and each disagreed with the others, so a
sentence had different boundaries in the queue, the store, the reader and the video.
Regex patches cannot fix this; a boundary needs context (what follows the
punctuation and what precedes it).

### 7.2 New solution: a scanner driven by one contract

`config/sentence_segmentation_contract.json` is the single source (same pattern as
`queue_center_contract.json`): terminals, ellipsis, period-like characters, native
CJK terminals, closers (quotes and brackets), openers, CJK ranges, abbreviation
list, block markers (list bullets, numbered items, quote and heading markers),
long-sentence clause breaks, speakable thresholds, timing constants, and the test
vectors (57: split, clean, speakable and timing vectors). Three thin adapters read
it and run the SAME algorithm; each must pass every vector:

| end | adapter |
|---|---|
| pycore | `pycore/pyfoundations/sentence_segmenter.py` (`sentence_segmenter`); also loaded by path by the standalone TTS servers |
| Laravel | `App\Support\SentenceSegmenter` (static; reads `config/` next to the repo root, like `QueueCenterContract`) |
| UI | `core/contracts/SentenceSegmenter.ts` (`sentenceSegmenter`, imports the JSON) |

Algorithm: text is cut into blocks (a blank line, a list, numbered, quote or
heading line is a hard break; a heading is its own block), then a character
scanner finds runs of terminals plus closers. A run ends a sentence when a
whitespace, the end or a CJK character follows it, or when a native CJK terminal is
in the run. It does NOT end one when: the next word starts lowercase after a
period-like run; the token before a single dot is an abbreviation, a one-letter
initial, a dotted abbreviation (`e.g.`, `U.S.`) or a lone 1-2 digit number
(`1.`); or no whitespace follows (`3.5`, `127.0.0.1`, `a.md`). A sentence is a
slice of the input with whitespace collapsed; nothing is rewritten and terminals
are kept. Options: `speakable` (drop fragments and code-like text, clean markdown
markers and emphasis), `min_chars`, `max_chars` (cut a long sentence at clause
breaks, then spaces, then by code points), `max_sentences`. `estimate_seconds(text,
language)` and `sentence_gap_seconds` are the shared timing model (2.5 English
words per second, 4.5 CJK characters per second, 1 s gap).

### 7.3 Consumers

- pycore: `text_parsing.split_sentences` (segments first, then normalizes
  punctuation per sentence so CJK terminals survive), `orch_sources.build_text_sentences`
  (`speakable=True`, replaces the private cleaner / speakable helpers),
  `orch_books.estimate_sentence_seconds` (shared timing), and the TTS chunker
  `tts_text_chunking` (the segmenter cuts with `max_chars=hard_limit`; the chunker only
  packs sentences to `soft_limit`). Standalone servers get the module and the
  contract as staged siblings (`tts_service_manager._sync_sentence_segmenter`, both
  files are in the managed code identity of qwen3tts, fishspeech, melotts and
  voxcpm2); a checkout resolves them from `pyfoundations/` and `config/`.
- Laravel: `AppQyV1VocabularyDocumentController` (min 10 characters, 10000
  sentences), `AppQyV1ArticleTextParser::extractSentences` (the segmenter cuts,
  `isSentenceValid` / `modifySentence` stay the learning policy of that consumer),
  `ItToolsV1TextCtl` (sentence count).
- UI: `BookStats.roughBookTextStats`, `WordNewArticlePlaybackHighlighter.segment`.
- Not consumers: the mcp-chrome text chunker and tampermonkey scripts (a
  different purpose: page chunking, no sentence semantics).

### 7.4 Rules for the future

No component may cut text into sentences on its own. A rule changes in the JSON
first, with a vector, and all three adapters must pass. Laravel sentence ids
(`MediaIngestService::computeSentenceId`, sha1 of the normalized text) now see the
sentences WITH their terminal punctuation, the same text pycore and the books
produce, so document sentences can merge with book and subtitle sentences; a
document extracted before this change is idempotent per slot (existing links are
skipped), so re-extracting an old document adds only slots it did not have.

## 8. UI and RPC contract

- `ui/audio_orch/tasks/list` `{source, page, page_size, query}` -> `{tasks, total,
  page, page_size, counts{vocab_book, prompt_rewrite}, sources}` (two tabs, page
  size 20). Summaries add `output_mode`, `video_preset`, `auto_generate`, `queue`,
  `videos_done`, `videos_failed`.
- New routes: `task/render_video`, `video/presets`, `video/preset_save`,
  `video/preset_delete`, `video/preset_activate`, `video/preview`,
  `video/background_import`. Relay policies (`config/pycore_relay_contract.json`):
  reads `general_read`, save / activate `general_write`, delete / render
  `general_action`, `background_import` `denied` (local UI only).
- Play, download, open folder (D14): `task/files` lists a task's segment files by
  kind with sizes; `task/file_chunk` `{task_id, name, offset, length}` streams one
  file as base64 chunks of at most 1 MiB with `eof`, `bytes`, `media_type` (the RPC
  server has no raw-byte responses); only `segment_NNN.mp3|mp4` inside the task
  output folder is readable (any other name, a traversal, or a file outside the
  folder is `ORCH_FILE_NAME_INVALID`; a missing file is `ORCH_FILE_NOT_FOUND`).
  The UI assembles the chunks into a Blob for the audio / video player and for the
  download; `open_output` opens the folder on the pycore host (local UI only).
- List speed: the task list reads summaries only; lane counts of a running task are
  cached for a few seconds (one scan per lane), an idle task costs no lane hop, and
  the queue states of a page come from one `states_of` call.
- Monitor (D14): `scripts/pytools/aitools/audio_orch_monitor.py` is a read-only
  probe of what pycore really produced: snapshot / `--watch` / `--inspect` (task
  and video health, timeline sanity, sentence quality, extracted frames) /
  `--report` (statistics and failure causes) / `--json`; it reads the task and
  manifest files and asks the running pycore only for the in-memory queue state,
  so a queued or waiting task is not reported as stuck.
- New message codes: `orch_segment_video_rendering|done|failed|skipped`,
  `orch_queue_queued|waiting`, error codes `ORCH_VIDEO_*`.
- UI (pycore-manager, audio orchestration page): Books / Prompts tabs with server
  pagination and search; Audio / Video selector (default video); book defaults
  minutes / 10, prompts show no segmentation; queue state and an automatic
  generation switch, the old button is "Regenerate"; per-segment video status,
  file list by kind, "Render videos"; a video preset panel with all settings,
  built-in / user presets, background import and a live preview.

## 9. Acceptance criteria

1. Delivery: new data and reconcile go to the selected server only; an offline
   server costs one bounded probe per interval, not per row; missing files never
   dead-letter; a path written on one OS opens on the other.
2. Uploads never fail on a slow response alone; a retried orchestration output is
   not re-sent when the server already has it.
3. A video task produces `segment_XXX.mp4` (1280x720 h264 + aac) with bilingual
   scrolling cards synchronised to the audio; presets change the look; the default
   canvas is white; word chips and sentence captions differ in font and border.
4. A new task starts by itself when its prerequisites are met; a segment is
   rendered as soon as its own resources are ready; nothing needs the button.
5. Editing a task, the queue writing state, and a running generation never erase
   one another's data.
6. Books and Prompts appear as two paginated tabs; prompts are one segment.
7. Prompt tasks show every sentence in English and Chinese; a long path scales down
   instead of breaking; a book run never delays prompt tasks; a resource failure is
   retried by itself with a backoff and a cap.
8. Sentence boundaries are identical in pycore, Laravel and the UI: every adapter
   passes all vectors of `sentence_segmentation_contract.json`, and none of them
   splits inside `3.5`, `127.0.0.1`, `file.md`, `Dr.`, `e.g.` or an initial.
9. A generated audio / video plays, downloads and opens its folder from the web UI.

## 10. Implementation record (2026-09-30)

pycore delivery: `endpoint_manager`, `delivery_outbox`, `laravel_delivery_repository`,
`audio_resource_repository`, `audio_resource_delivery`, `laravel_audio_delivery`,
`core_node_dirs`, `client`, `laravel_http_transport`, `http_progress_upload`,
`network_constants`, `orch_delivery`, `background_jobs`.
pycore orchestration: `orch_store` (task store), `orch_sources`, `orch_messages`,
`orch_video`, `orch_video_presets`, `orch_queue`, `orch_generate`, `orch_service`,
`local_audio_orchestration_routes`, `route_names`; shared ffmpeg library:
`ffmpeg_scroll` (new), `ffmpeg_models`, `ffmpeg_subtitle`, `ffmpeg_command`.
Contract: `config/pycore_relay_contract.json` (7 route policies).
Laravel: `AppQyV1OrchAudioCtl`, `AppQyV1OrchAudioService`,
`AppQyV1OrchIngestValidator` (new), `AppQyV1OrchAudioTaskModel`,
`AppQyV1OrchAudioSegmentModel`.
UI: pycore-manager audio orchestration page, endpoint / type / locale modules.
Sentence segmentation: `config/sentence_segmentation_contract.json`,
`pyfoundations/sentence_segmenter.py`, `App\Support\SentenceSegmenter`,
`core/contracts/SentenceSegmenter.ts` and the consumers of section 7.3 (pycore
`text_parsing`, `orch_sources`, `orch_books`, `tts_text_chunking`,
`tts_service_manager`; Laravel document controller, article parser, ItTools text
statistics; UI `BookStats`, `WordNewArticlePlaybackHighlighter`). Also
`orch_translations` (new) and `scripts/pytools/aitools/audio_orch_monitor.py` (new).

### Verification status

Isolated probes (temporary databases, no services, no route registration):
delivery scheduling and offline handling, upload / reachability rules, portable
paths, task store concurrency and pagination, task defaults and edits, queue
decisions, segment assembly with real ffmpeg (mp3 + 1280x720 mp4), preset security,
preview frames rendered and inspected; fair queue and auto-retry decisions;
translations with a stubbed translator; fit scale in the ASS output; file chunk
streaming and its refusals. Sentence segmentation: 57 / 57 shared vectors pass in
each of the Python, PHP and TypeScript adapters, `php -l` and `tsc --noEmit` are
clean, and the TTS chunker was run from a staged copy (module + segmenter +
contract in one folder, nothing else on the path). Not verified live: the running
pycore has the code of its last restart only; the Laravel changes await the
server; the UI is not built or run.

### Operational notes

- The queue starts when the orchestration routes register (service start). Never
  call the route registration in a check: it starts real generations.
- Existing tasks: a task that was generated before video output existed (no
  stored `output_mode`) is migrated on load to `audio`, so a restart never renders
  the whole history. Switching such a task to video makes the queue render its
  videos ("videos" rule); `auto_generate` false opts a task out.
- A segment that cannot be rendered (no timeline, audio file gone, manifest gone)
  is marked `skipped` with an error code, and a failed video is never retried by
  the queue: both keep the "videos" rule from selecting the task in a loop.
- The 2,616 parked rows of the non-selected server are delivered when that server
  is selected.
