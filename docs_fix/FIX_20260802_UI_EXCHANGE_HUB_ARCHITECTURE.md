# UI Exchange-Hub Architecture Rebuild (Queue Center v3)

Date: 2026-08-02

## Scope

This change follows `_prompts/队列中心.txt` and supersedes the relay architecture
(`pycore UI -> pycore -> Laravel`) with the exchange-hub architecture:
**pycore UI is the single orchestrator, data convergence point and task pump.**

## Architecture rules (binding)

1. **UI <-> Laravel**: all queue data, ID page tables, priority bumps, accepts,
   stats, dictionary, media and history travel directly from the browser to
   Laravel through the ONE centralized `LaravelAPI` library
   (`core/api-libs/laravel/`).
2. **UI <-> pycore**: all task dispatch (payloads), processor on/off, engine and
   worker state, local capabilities travel directly to pycore through the ONE
   centralized `PycoreApi` library (`core/api-libs/pycore/`).
3. **pycore -> Laravel has exactly ONE case left: uploading result data**
   (generated audio binaries, task result status). `pycore/pyutils/laravel/client.py`
   stays the single egress, but pull / claim / accept / heartbeat / any reads
   are removed.
4. **Processor enable semantics**: a UI toggle starts the UI's own pump loop
   (fetch page table -> dispatch -> wait for result -> refresh). Pycore never
   starts its own pull loop. Closing the UI stops the pump.
5. **Backend scan rule (continued)**: Laravel discovery timers only diff-scan
   and only persist ID page tables; real rows are materialized lazily per page
   on request. The ten rules from `FIX_20260731_QUEUE_CENTER_BLOCKING.md`
   (bug-fix-3 section) stay in force.

## Task pump data flow (sentence_audio example)

```
UI toggle ON
  -> 1. LaravelApi fetches diff ID page table (high-water cursor; IDs + status metadata only)
  -> 2. Page table stored in the frontend cache (core/tasks/DiffQueueContext,
        bounded by contract id_page_limit / id_limit), loaded directly from the
        local store on start and aligned by revision
  -> 3. On dispatch, materialize the current page's data segment via LaravelApi
        (<= data_segment_limit)
  -> 4. LaravelApi accept (claim guard against multi-instance double-processing)
  -> 5. PycoreApi dispatches the payload to pycore (in-memory only, never persisted)
  -> 6. pycore synthesizes, then LaravelClient uploads the result directly
        (audio + status); Laravel persists and returns audio_url
  -> 7. UI refreshes page status from Laravel, marks consumed IDs, compacts the
        data segment to ID + count metadata
Priority bump (wordnew missing audio): wordnew -> LaravelApi bump -> Laravel
  updates cursor/head page + websocket broadcast -> UI receives queue.changed,
  updates the page-table head and dispatches the head item immediately.
```

## Duplicate implementations merged (single definition rule)

UI side (4 Laravel clients -> 1):
- `apps/pycore-manager/api/PcLaravelApi.ts` -> migrated into `core/api-libs/laravel/`.
- `apps/laravel-manager/services/ApiManager.ts` + `api/LaravelManagerApi.ts`
  -> endpoint management absorbed by `LaravelEndpointManager`; domain methods merged.
- `apps/wordnew/api/WfNewApiTransport.ts` + `WfNewApiPaths.ts`
  -> transport re-pointed at core; wordnew mappers/types stay (domain layer),
  `WfNewApi` interface signatures unchanged (mock lock-step).
- Stray fetches (`daily-reading/dailyReadingApi.ts` etc.) -> core client.
- Endpoint management (3 copies: `config/api-endpoints.ts`, `ApiManager.ts`,
  `WfNewEndpoints`) -> ONE `LaravelEndpointManager`, persisted to localStorage
  (add/remove/switch/health selection survive reloads).

pycore side (mirror/proxy/pull removal):
- `pyctl/tts/laravel_audio_worker.py`, `pyctl/translation/worker/base_laravel_worker.py`:
  pull/heartbeat/identity loops removed; processing + result-upload kernels kept,
  driven by new RPC accept entries.
- `callmodule/rpc_routes/laravel_api_routes.py`: retired (proxy).
- `pyctl/queue_center/` Laravel-mirroring (`translation_monitor_service.py`,
  `assist_overview.py`, `overview_service.py` mirrors): removed; pycore reports
  only its own worker state.
- `pyutils/laravel/media_query_service.py`, `pyctl/laravel/log_mirror_service.py`:
  removed (UI reads Laravel directly).
- Kept (result-upload exemption): `pyctl/agent_history/pipeline/laravel_stage.py`,
  `pyctl/laravel/sync/media_sync_http.py`.

Contract:
- `core/api-libs/pycore/QueueCenterContract.ts` -> moved to `core/contracts/`
  (three-end shared contract, not pycore property).

## Bug fixes folded in

- `GET http://127.0.0.1:59000/` anomalous root-path calls: caller identified and fixed.
- Laravel endpoint edits persist to frontend local storage (single owner:
  `LaravelEndpointManager`).
- `/pycore-manager/agent-history` converted to Laravel-style diff scanning
  (ID pages + lazy materialization; no full loads).
- Frontend store loads the page table directly on start (restore revision/ID
  pages, then align incrementally; no cold full pull).
- pycore notifications are memory-only; pycore only processes and uploads results.
- On PycoreApi connect, the UI syncs configuration with pycore exactly once
  (replaces periodic polling).

## Execution order

0. This document (done first; updated as work proceeds).
1. `core/api-libs/laravel/` library (LaravelApi / LaravelRoutes /
   LaravelEndpointManager / LaravelRealtime / LaravelTypes).
2. Migrate UI consumers to the core library; delete duplicates.
3. Move QueueCenterContract to `core/contracts/`.
4. QueuePump + persistent page-table cache + connect-time config sync.
5. agent-history diff scanning.
6. pycore slimming + 59000 root-call fix.
7. Laravel feeder conformance check + pump read endpoints (id-pages, page
   data, accept).

## Progress log

- 2026-08-02: Document created. Implementation started.
- 2026-08-02: Execution order items 1-7 implemented (all static-verified, no runtime
  verification per repo rules):
  1. `core/api-libs/laravel/` library in place; consumers migrated; tsc clean.
  2. UI consumers switched to the core library; duplicate Laravel clients removed;
     final broken imports (`App.tsx`, `ServerManager.tsx`, `Settings.tsx`,
     `AppQyV1.ts`) re-pointed to core (`ApiManager` / transport `APICache` /
     `HtmlErrorEvents` / `LoginRequestBridge`).
  3. `QueueCenterContract.ts` moved to `core/contracts/`; all importers updated;
     pycore barrel re-exports from the new location.
  4. `core/tasks/QueuePump.ts` (sentence_audio pump singleton) + persistent
     page-table cache in `DiffQueueContext` (localStorage snapshot on start,
     cursor/revision incremental align, bounded by contract limits); connect-time
     config sync exactly once per pycore connect in `useQueueCenterHub.tsx`.
  5. `/pycore-manager/agent-history` converted to diff scanning against pycore-local
     stores: new RPC id-pages/page endpoints (`ui/agent_history/session_id_pages`,
     `session_page`, `prompt_id_pages`, `prompt_page`, `article_record_id_pages`,
     `article_record_page`) + `AgentHistoryPageTableStore` (localStorage,
     revision-aligned); old full-load endpoints kept registered but unused by the page.
  6. pycore slimmed to compute-only: pull/heartbeat/identity loops removed from
     `base_laravel_worker.py` / `worker.py` / `laravel_audio_worker.py`; generic RPC
     accept entry `ui/queue_center/accept_task` added; proxy routes
     (`laravel_api_routes.py`), Laravel mirrors (`translation_monitor_service.py`,
     `assist_overview.py`, `overview_service.py`, log mirror, media query, SSE client,
     queue monitors), priority routes (`local_queue_priority_routes.py`,
     `priority_service.py`, word-audio boost proxy) and the vocabulary passthrough
     proxy (`pyctl/vocabulary/`, `local_vocabulary_routes.py`, 25 `UI_VOCABULARY_*`
     route names) all deleted; 59000 root-path caller fixed (PySide6 webview fallback
     now targets `/pyapi/status`); task-history Laravel merge removed from
     `task_history/archive.py` (pure-local now); agent-history `article_audio` Laravel
     fetch retired (UI plays `audio_url` directly via `laravelMediaUrl`); stale
     pull-loop config/constants removed from `callmodule_config.py` /
     `service_config.py`.
  7. Laravel feeders verified conforming to the ten scan rules (no changes needed);
     pump read endpoints added: `GET /api/queue-center/queues/{queue}/id-pages`
     (high-water cursor + realtime revision + head_ids), `GET .../page-data?ids[]=`
     (lazy, <= data_segment_limit); accept via existing atomic
     `POST /api/worker/tasks/{taskType}/accept` (409 = foreign owner); result upload
     endpoints now return `audio_url`; bump path fixed to always promote the head
     ID page + broadcast `queue.changed`.
- 2026-08-02: Integration reconciliation after parallel workstreams: pump re-pointed
  from provisional sentence-specific paths to the real generic queue-center
  endpoints; pycore dispatch aligned to `ui/queue_center/accept_task`
  (`{task, laravel_endpoint?}`); cover/poster priority repointed to purpose-built
  Laravel endpoints (`assist/cover/retry`, `assist/poster/priority`) per rule 1;
  dead pycore route constants and the laravel-log-mirror UI pages removed.
- 2026-08-02: Realtime wired without new dependencies: `LaravelRealtime.ts`
  (native EventSource against the public `GET /api/queue-center/stream` SSE,
  cursor-tracked manual reconnect) feeds `queue.changed`/`sentence.priority` into
  `sentenceAudioQueuePump.notifyQueueChanged` (head touch + immediate dispatch);
  5s idle poll kept as fallback.
- Remaining laravel_client call sites in pycore are all conforming: result uploads
  (worker reports, fix-word, missing-batch, media ingest, corebook) or compute
  inputs intrinsic to processing (fix-word media download, STT audio fetch,
  media-sync pipeline). `pyctl/laravel/media_service.py` kept (content upload +
  enrich command workflow, not a UI proxy).
- Not runtime-verified (per repo rules, no services/tests were started): pump cycle
  against live Laravel/pycore, SSE reconnect behavior, Reverb broadcast delivery.
  Manual verification steps in the master plan section 四 apply.
