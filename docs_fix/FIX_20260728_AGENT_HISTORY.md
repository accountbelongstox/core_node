# FIX 2026-07-28 — Agent History pipeline, per-tool monitor, Daily Reading route

Source task: `docs_fix/origin/d.txt` (4 ends: pycore / pycore UI / wordnew UI / laravel_main).

## 1. pycore BUG — `pipeline tick error: name 'time' is not defined`

- Root cause: `pycore/pyfoundations/thread_bus/event_handler_registry.py` used
  `time.time_ns()` in `trigger_event(async_mode=True)` without importing `time`.
  Every `OperationService` change fires `operation.changed` with
  `async_mode=True` (`operation_service.py:85`), so each pipeline tick raised.
- Fix: added the missing `import time`. Verified the call chain
  `tick_pipeline → OperationService → THREAD_BUS.trigger_event(async)`.

## 2. Per-tool checkboxes + test extract (d.txt §2)

pycore:
- `agent_history_pipeline/config.py`: new `enabled_tools` (whitelist-normalized
  against `SUPPORTED_TOOLS`), per-tool `cursors`, `last_tool` rotation state,
  `get_tool_cursor` / `advance_tool_cursor` (forward-only).
- `generic_agent_extractor.py`: `tool()` now returns lowercase `agent` like
  every other extractor (was `Agent`, breaking filters).
- `agent_history_service.py`: new `test_extract(tool)` — read-only probe that
  parses the newest history source of one tool and returns its latest prompt.
- New RPC route `ui.agent_history.test_extract`
  (`route_names.py`, `local_agent_history_routes.py`).

pycore UI:
- New `PcAgentHistoryToolCheckboxes.tsx` — 9 tools (Agent, Claude, Codex,
  Cursor, Gemini, Kimi, Antigravity, Cline, Ark CLI). Checking saves
  `enabled_tools` and probes one message: green dot = extract ok, red = fail
  (error shown), amber pulse = testing.
- `PcAgentHistoryConfigPanel.tsx` hosts the checkboxes and persists them with
  every config save; new `onEnabledToolsChange` callback.
- `PycoreApiLocal.testAgentHistoryToolExtract` + `AgentHistoryTestExtractResponse`
  + `agentHistoryTestExtract` RPC route constant; `monitoredTools` locale keys.

## 2.1 Prompt history independent of Auto process

- `heartbeat_agent_history.py`: extract and pipeline heartbeats decoupled —
  extraction runs when the pipeline is enabled OR any tool is checked;
  `set_agent_history_callbacks_enabled(pipeline, extract)` new signature;
  `article_config_post` / `article_start` updated accordingly.
- `PcAgentHistoryPage.tsx`: prompt list defaults to the checked tools
  (case-insensitive) regardless of the Auto process toggle; the dropdown
  filter still overrides.

## 2.2 Bilingual visible by default; records reach wordnew

- `PcAgentHistoryRecords.tsx`: removed the `<details>/Show full text` gate —
  English + Chinese (Reference) blocks render inline by default; audio player
  unchanged.
- wordnew display gap fixed via §2.3 upload reliability below.

## 2.3 Upload to laravel + English Daily Reading + route

pycore:
- `worker.py`: new `_retry_pending_upload()` — one deferred record re-uploaded
  per tick from the saved local record + cached mp3 (no regeneration, no extra
  OpenRouter call). Previously a failed stage-5 upload stayed local forever.
- `laravel_stage.py`: truncate `reference_cn` (4800) / `article_text` (49000)
  to the validator limits (silent 422 was dropping uploads); `title_en` never
  falls back to the Chinese title (derives from the English body instead).
- `article_stages.py`: EN title fallback stays English.

laravel_main (`AppQyV1ArticleController.php`):
- `workerSubmit`: accepts `title_en`, stores `metadata.title_en`, and the
  `title` column is always the English title (no more `title_cn` fallback, so
  Daily Reading no longer shows Chinese as the English title).
- `workerRecent`: `title_en` prefers `metadata.title_en`.

wordnew UI:
- Routes already carry the id: `#/read-daily/<articleId>` (player page) and
  `#/book-reader/<sourceKey>` (read-along). Both are now reachable from home —
  see §2.4.

## 2.4 Player is a routed page, not a home modal

- `WfDailyReadingSection.tsx`: new `onPlayArticle` prop; the per-row
  "Play from this article" button uses it when provided.
- `WfNewHomeTab.tsx`: home passes `onPlayArticle` → sets hash
  `#/read-daily/<articleId>` and switches to the `daily-reading` tab; the
  tab's deep-link handler auto-starts the fullscreen player page.
  (The player console itself is unchanged; closing it returns the hash to
  `#/article/<sort>`.)

## 2.5 Queue: newest first + round-robin across AIs

- `agent_history_fragments.py`: fragments now carry the session `tool`;
  `collect_fragments(tool=...)` filters per tool (case-insensitive).
- `planner.py` rewritten: per-tool cursors; per-tool batches sorted
  newest-first (fresh prompts jump to the head of the queue); round-robin
  interleave starting after `last_tool` so every AI is processed evenly;
  fixed the item_key bug (`f["id"]` → `fragment_id`, plus tool in the hash)
  that caused `(operation_id, item_key)` UNIQUE collisions.
- `worker.py`: cursor advance + tool rotation via `_advance_cursor_for_input`;
  backfill resets per-tool cursors; `_process_item` returns whether the item
  completed so the active-op path also advances cursors (previously backfill
  items never moved the cursor, re-planning the same fragments).

## 2.6 Word Groups linkage panel

- New `WfDailyReadingWordGroupsPanel.tsx` on the player page (below the
  bilingual text): Default Vocabulary Group card (count + progress), all other
  Word Groups as chips, and the article's words badged
  played (green) / in-default-group-unplayed (amber) / new (neutral).
  Data: `wfNewApi.getWordGroups` + `getVocabulary(defaultGroup)` +
  `getSentenceWordTable(article_en)`; refresh on article change, on playback
  advance, and via a manual button. Locale keys added (en/zh).

## Notes / leftovers (not in scope)

- `pycore/callmodule/services/agent_history_article_service.py` (839 lines) is
  fully orphaned — the modular `agent_history_pipeline/` package replaced it.
  Safe to delete in a follow-up.
- `pycore/callmodule/app.py` and `callmodule_main.py` still import the deleted
  `callmodule/routers/` package; they are stale FastAPI entry points (RPC v2 is
  canonical) and were left untouched.
- Intermittent audio 404s in production need the deployed nginx to alias
  `/static/app_qy_v1/audio/` to `laravel_db/static/...` (no in-repo nginx
  config); dev (Octane) serving matches the write path.

## Verification

- `python -m py_compile` on every touched Python file: OK.
- `php -l` on `AppQyV1ArticleController.php`: OK.
- `npx tsc --noEmit`: no errors in any touched file (remaining errors are
  pre-existing in unrelated files).
