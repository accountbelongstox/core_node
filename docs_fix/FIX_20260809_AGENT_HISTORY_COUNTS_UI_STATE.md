# Agent History Provider Counts and UI Recovery

Source: `_prompts/队列中心.txt` and the Agent History page follow-up.

## Load-failure diagnosis

- The active Pycore service returned successful responses for Agent History status, session ID pages, prompt ID pages, session materialization, and prompt materialization. The TXT store header was valid (`459` sessions and `7993` prompts at diagnosis time).
- The remaining generic page error was isolated to frontend recovery state rather than the Agent History read routes. Restored page values and cached ID tables are now validated before reuse.

## Pycore

- Agent-history TXT extraction now remains enabled independently of the article-processing toggle and monitored-tool selection.
- The Agent History status route accepts the complete checked-tool list and returns every tool's session, prompt, AI-reply, total-history, processed, and pending counts in one response.
- Multi-tool statistics traverse the requested TXT session segments once, remain cached by TXT index revision and processing cursor, and never materialize full history in the browser.
- Prompt ID pages now carry the same lightweight store header as session ID pages so a restored Prompts tab has current tool/user filters and store metadata.
- Gemini discovery now includes current CLI chat files under `.gemini/tmp/<project>/chats/session-*.json` and `.jsonl`; dictionary-root conversation records are parsed through their `messages` list.
- Gemini checkpoint parsing now uses the shared `MAX_TURNS` limit instead of the invalid `self.MAX_TURNS` attribute. The read-only extraction probe checks up to 25 bounded sources so empty `logs.json` files do not hide valid sessions.
- Both local Gemini roots were inspected without exposing message bodies. Excluding Antigravity storage, no JSON/JSONL record currently contains a Gemini `user` role. A readable but empty source is therefore reported as an empty neutral probe instead of the parser error `sources found but no prompts parsed`; no prompt is fabricated.
- Local Agent discovery now reads OpenClaw agent sessions under `.openclaw/agents/<agent>/sessions/*.jsonl`. Message, tool-result, timestamp, model, and tool-name fields use the same generic parser; no synthetic project value is assigned.
- Extractor descriptors resolve physical paths centrally. The `C:\Users\mpc\.cursor` junction and its `D:\programing\Users\mpc\.cursor` target now collapse to one source instead of producing duplicate sessions.
- Cursor uses transcript JSONL as the primary source and reads `state.vscdb` only when transcripts are absent. One user entry becomes one prompt, and all unique assistant text blocks until the next user entry become one AI reply; tool-use events remain detail turns but do not inflate history-record totals.
- Cursor entries without timestamps receive stable source-order timestamps, and every extracted turn gets a unique fragment ID. This prevents multiple replies from sharing one cursor identity.
- Extractor schema revisions are persisted. Parser changes trigger one automatic source reparse after service restart even when source file mtimes and sizes did not change.
- Tool cursors are never reset. Every tool owns a persistent backfill cursor, live cursor, and backfill boundary. Newly discovered live batches preempt all backfill work across tools, while old backlog continues round-robin whenever no complete live batch is waiting.
- Agent History extraction now uses the same default 10-second interval as pipeline scheduling, so a newly saved prompt reaches the live priority lane without waiting for the former 60-second scan interval.
- Agent History article generation continues to use the shared `chat_once("openrouter", ...)` path for both Chinese generation and English generation. The shared OpenRouter rate guard remains `20` requests per minute and `1000` requests per UTC day across all runtimes using the same key budget.
- The shared AI usage JSON now keeps source-level and UTC-day rollups for request count, success/failure count, and latency. Existing retained records seed the rollup once, and subsequent pycore or Laravel writes preserve and update it.
- Source/day initialization, updates, migration rebuilds, and summaries are centralized in the shared `UsageRollup` primitive; Laravel uses its matching `AiUsageRollup` service for the cross-runtime JSON contract. Agent History does not duplicate rollup arithmetic.
- The shared rate limiter atomically checks and reserves a provider slot before dispatch enters the provider handler. Failed responses remain counted, and concurrent pycore calls cannot both pass the final OpenRouter `1000`-request daily slot.
- Agent History load data filters the shared AI usage store to `agent_history_article` and `agent_history_translate`; it does not create a separate request counter.
- The shared bounded JSON detail ring is aligned to `5000` entries in pycore and Laravel. The common usage reader filters provider and sources before applying Agent History's `400`-row UI limit, so unrelated AI calls cannot evict the visible request list prematurely.
- Agent History request history and load summaries use the existing JSON/text stores under the global local-data directory (`ai_usage_records.json`, `ai_rate_usage.json`, and `ai_calls.log`). No new SQLite table, operation-history query, or task database was added.
- The cursor-reset `article_start` route and its backfill implementation were removed. Enabling article processing continues from persisted per-tool cursors through the existing heartbeat.

## Pycore Manager UI

- Every checked Local Agent, Claude, Codex, Cursor, Gemini, Kimi, Antigravity, or Cline source displays its own simultaneous total-history, processed, pending, session, prompt, and AI-reply card.
- Per-tool counts refresh when the TXT store or article operation revision changes.
- Agent History restores the selected tab, filters, search, session/prompt pages, selected transcript, selected provider, monitored-tool view, live mode, and generated-record page after refresh.
- `/pycore-manager/agent-historyf` redirects to the canonical `/pycore-manager/agent-history` page.
- New visible strings are defined in the English and Chinese locale files.
- The live-state label no longer claims a 10-second polling interval because updates use the Pycore event connection.
- `Refresh now` queues forced extraction on the existing background worker and returns immediately; its completion event refreshes the visible page even when live updates are paused.
- Store timestamps are range-validated in Pycore and the UI. Invalid persisted values no longer satisfy the unchanged shortcut, and malformed browser page-table metadata is refreshed instead of displayed.
- The optional generation section is labeled `Article processing` so it is not confused with the always-on TXT extraction lifecycle.
- The article-pipeline description no longer hardcodes the default word threshold and now matches the configurable processing flow.
- The automatic-processing phase is derived separately from the last operation status: terminal completion now displays `Waiting for history` while automatic processing remains enabled.
- Reference and target language labels and values are fully localized instead of duplicating language codes in labels and hardcoding language names in the component.
- The raw batching threshold is labeled `Minimum source words` to describe its effect without implementation jargon.
- The configurable default value `200` now displays its localized `words` unit in the numeric field.
- The article configuration action now distinguishes `Save settings` from the `Settings saved` confirmation.
- The incorrect `Reprocess all history` action was removed; the UI exposes only continuous cursor-based processing and settings persistence.
- Tool selection is labeled `Tools included in article processing`; checked state no longer reads like a completed-processing status.
- The generic `agent` provider key is displayed consistently as `Local Agent`.
- The `claude` provider key is displayed as `Claude`, matching the Agent History page vocabulary.
- Ark CLI is a command-line tool rather than an agent. Its unused extractor and display mappings were removed; it is absent from the Agent History registry, article-processing sources, monitored-agent checklist, and restored monitored-tool state.
- Restored page numbers are normalized to finite positive integers before history requests, preventing malformed persisted UI state from producing an invalid page request after refresh.
- Persisted ID-page tables are reused only when their revision, total, and row IDs are valid; malformed recovery data now triggers a fresh metadata request instead of a generic history load failure.
- Agent History view state now uses the shared `PersistedStore` foundation as one normalized store. State is committed in the layout phase, and the first runtime-config hydration is prevented from resetting restored session/prompt pages.
- Prompt rows no longer display a project field; Local Agent history does not invent project metadata.
- The unrelated Local LLM engine strip was removed from Article processing. The page now identifies OpenRouter and the configured free-router model as the CN/EN processing engine.
- The OpenRouter panel shows shared daily/RPM quota load plus Agent History request totals, success/failure counts, and average latency for today and history.
- Today and History cards open a request list backed by the shared AI usage JSON. Selecting a request shows its CN/EN stage, status, provider, model, runtime, source, latency, timestamp, and error without loading article or audio bodies.
- The selected request period (`today` or `history`) is included in the existing Agent History persisted UI state and survives a page refresh.
- Pycore Manager UI persistence is now a two-copy model: every registered UI key is written to browser storage and mirrored to one revisioned JSON document under the global `.core_node/ui_state` directory. SQLite is not used.
- The shared frontend `RevisionedStorageReplica` owns snapshot comparison, first-write initialization, optimistic revision writes, and conflict application. Pycore Manager only registers its UI keys and supplies transport/reconnect events.
- Remote reads and writes are serialized inside the frontend replica. A second UI change cannot send the same stale base revision while the first save is still in flight, and reconnect reconciliation cannot race a pending save.
- Runtime queue snapshots are explicitly separated from UI-state keys, so a large queue cache cannot reject or bloat the UI backup document.
- The shared pycore `RevisionedJsonStore` composes the atomic JSON file primitive with schema, UTC update time, and revision conflict handling. The Pycore Manager controller only validates its key/value limits and serializes access through the existing worker foundation.
- `PcUiStateBackupGate` reconciles the backend JSON before any Pycore Manager route mounts. An offline first load keeps the browser copy; a later health recovery, HTTP reconnect, or backend-restart event reapplies the backend copy and reloads only when values differ.
- Browser writes emit one shared storage-change event. Registered Pycore Manager keys are mirrored as a complete snapshot, so deletion and cross-tab changes use the same path as ordinary page updates.
- Each online browser change also records a local pending base revision immediately. If the page refreshes before the debounced HTTP write starts, the next gate may replay that browser snapshot only when the backend still has the exact same revision; a revision mismatch discards the replay and applies the backend.
- A failed push or an explicit offline health/HTTP state clears the pending replay marker. Consequently offline edits remain useful in the current browser session, but pycore still wins when the backend reconnects as required.
- Agent History recovered runtime data is marked non-authoritative. The first mounted consumer always requests a fresh combined runtime exchange, preventing restored zero/initial counters from becoming the final post-refresh display.
- Code Sync and Local LLM runtime stores follow the same fresh-on-first-consumer rule instead of treating route-recovery cache entries as authoritative backend state.
- A recovered Agent History article configuration cannot overwrite restored checkbox state. Only a fresh authoritative runtime response may hydrate the processing-tool list, after which the backend configuration remains canonical.
- `VersionedSnapshotCache` is now the common bounded version/TTL base with per-key loading generations and leases. `StatusSnapshotCache` is its status-domain subclass and owns the existing global status singleton.
- The base supports caller-selected value copying and refresh consistency. UI status snapshots use deep copies plus stale-while-refresh; large read-only catalogs may retain immutable references, while revision-bearing ID pages use strict refresh and never pair stale rows with a new revision.
- The common base coalesces cold loaders, rejects superseded results, supports explicit invalidation, and evicts the oldest entry at its configured bound.
- Every loading generation owns a unique THREAD_BUS signal. Waiters retain that generation until release, so a later refresh cannot clear or consume an earlier completion notification.
- A request with any prior snapshot returns that snapshot immediately while one background refresh owns the key, including when the requested source version changed. Only a cold key waits, and it waits no longer than the current owner's remaining lease before reclaiming the key.
- An expired owner can be replaced without waiting for its loader to return. Its eventual result is marked superseded and cannot overwrite the replacement generation.
- Single and batch loaders must return dictionary snapshots. Loader exceptions, omitted batch keys, and invalid return values complete their generations with errors instead of leaving a key poisoned.
- The old public `get_cached/store` bypass was removed. Agent History multi-tool aggregation now enters through `get_many`, retaining one combined TXT traversal while enforcing generation ownership independently for every Agent key.
- Agent History owns one feature cache derived from `VersionedSnapshotCache`. The index catalog, prompt catalog, and bounded per-session event snapshots share that instance and the same file `mtime_ns:size` revision helper.
- Index and prompt revision markers are stored inside the catalog snapshot and ID-page routes read that marker from the same object as the returned rows, removing the previous separate-stat/catalog race.
- Session event cache hits no longer read or parse the session TXT first. The cached event list is treated as immutable and each collector copies only the event row it annotates with a tool key.
- The legacy mutable `_index_catalog_cache`, `_prompt_catalog_cache`, and unbounded `_SESSION_EVENTS_CACHE` implementations were removed.
- Agent History builds a lightweight per-tool source revision map from `state.txt`. The map records each agent's newest source modification time and hashes source IDs, sizes, mtimes, session IDs, and extractor schema; the state file's own `mtime:size` is the fast outer check.
- Claude, Codex, Cursor, and the other tool-card statistics use the shared cache with a version composed from that tool's source revision and processing cursors. An unchanged tool returns a deep-copied snapshot without traversing session TXT files; only the changed tool/cursor combination recomputes totals.
- The checked-tool extraction probe uses the same per-tool source revision cache, so reopening the page does not repeatedly parse each agent's newest large history source.
- The OpenRouter task/history portion is cached by UTC day plus `ai_usage_records.json` `mtime:size`. Its request ring and rollups reload only after that JSON changes or the UTC day rolls over.
- Live values remain outside the cache: current operation snapshot, processing phase/progress, extraction tick state, pipeline status, OpenRouter RPM/daily rate status, and configuration are read on every exchange.
- AI gateway aggregation is local-only. `gateway_status(refresh=True)` refreshes the local snapshot but does not probe provider `/models` or quota endpoints; live network checks remain in the dedicated AI Probe/Test routes.
- The explicit Test All provider route now also uses `VersionedSnapshotCache` in strict mode. Concurrent Test All calls share one live probe generation; single-provider Test and balance calls remain live and uncached.
- Mutable hot-path state was intentionally not merged into snapshot caching: provider rate/cooldown/key rotation, queue priority bumps, worker inflight leases, pipeline operations, and account balances retain their existing real-time ownership models.
- No fallback exception handler was added to `local_capability_status_routes.py`, and the former fixed wait was not increased. The ownership, lease, and stale behavior are resolved in the common cache layer.

## Verification boundary

Per repository instructions, no tests, builds, or services were run. Read-only route and local history-schema diagnostics were used; no processing jobs were started.

## Static execution walkthrough

- Empty state: the runtime exchange returns the configured OpenRouter model, a `0/1000` daily budget, empty source rollups, and an empty task list without creating a database record.
- Legacy JSON: a file without `source_stats` is rebuilt once from its retained entries through `UsageRollup`, then atomically saved in the same global data directory.
- Chinese request: `chat_once` atomically reserves one shared OpenRouter slot, dispatches the request, appends one `agent_history_article` JSON entry, increments total and UTC-day rollups, and appends the existing text log.
- English request: the same path records `agent_history_translate`; one completed article therefore consumes and displays two OpenRouter requests.
- Provider failure: the reserved slot remains consumed, the failed JSON task retains its latency/error, and the Today/History panels increment the failed count.
- Quota boundary: at `1000` daily slots the acquire call fails before provider dispatch, the UI displays the paused state, and no phantom provider task is appended.
- UTC rollover: the shared daily quota and Today summary read the new UTC bucket, while the History summary and bounded detail ring remain available.
- Laravel write: `AiUsageRollup` preserves the same `source_stats` contract and updates the shared JSON without discarding pycore rollups.
- UI refresh: runtime recovery restores the last dashboard snapshot immediately; the fresh combined exchange updates quota, summaries, and tasks, while `taskPeriod` restores the Today/History selection.
- Live update: operation events debounce a fresh runtime exchange; task identity uses timestamp/source/model/runtime and therefore remains stable when a newer request is inserted first.
- Detail drilldown: Today/History filters the bounded JSON task list, and selecting a row materializes only its existing metadata and error in the modal.
- First backend initialization: the gate reads a missing remote document, sends the complete registered browser snapshot with `initialize_only`, and stores revision `1`; a simultaneous initializer receives a conflict and applies the already-created backend document.
- Normal UI change: `StorageManager` persists the value locally, emits the common change event, and records its pending base revision; the replica sends the complete snapshot and advances to the returned revision.
- Immediate browser refresh: when a pending marker matches the backend revision, the gate first commits the newer browser snapshot, then mounts lazy pages. When no replay is pending, it applies the backend document before page stores construct.
- Offline startup: the initial remote read rejects, the gate keeps the browser values and mounts the UI; no empty remote document is fabricated.
- Backend reconnect: health, HTTP, or restart notification starts one coalesced reconciliation. Matching state performs no reload; different state replaces registered browser keys and reloads, making pycore authoritative.
- Concurrent write: a stale base revision returns the current backend document without writing. The frontend applies that conflict document and reloads instead of overwriting newer backend state.
- Runtime refresh: restored Agent History counts paint as a temporary recovery snapshot only; the first consumer fetches sessions, prompts, article operation, and AI load data again and marks the response authoritative.
- Tool cache hit: pycore stats `state.txt`, finds the same outer file revision, reuses the per-tool revision map, matches source revision plus processing cursors, and returns the cached card snapshot without reading session transcripts.
- One-agent update: extraction rewrites `state.txt`; the outer source-map cache rebuilds once. Only the changed agent receives a new source hash, while unchanged agents continue matching their existing versioned snapshots.
- Processing-cursor update: source files stay unchanged but the affected tool's cursor component changes, so processed/pending counts recompute while unrelated tool-card cache entries remain valid.
- Concurrent cold cache miss: the first request claims generation N; matching requests wait on N's unique signal and receive deep copies of the same completed snapshot instead of repeating aggregation.
- Slow cold load: waiters stop waiting when generation N's lease expires, reclaim as generation N+1, and ignore N if it eventually returns. No cache-owned fixed-wait `TimeoutError` escapes to the RPC controller.
- Stale refresh: the owner starts a background refresh and every concurrent caller immediately receives the previous snapshot. When the refresh completes, only the still-current generation publishes the replacement.
- Version race: an Agent source change creates a new per-tool version. A stale card remains available during recomputation, and an older batch finishing afterward is rejected instead of overwriting the new tool snapshot.
- Strict catalog refresh: an `index.txt` or `prompts.txt` revision change performs one synchronous catalog rebuild; matching callers wait on that generation, so the response revision and ID rows always describe the same file version.
- Session cache hit: an unchanged session file returns parsed events without reopening its TXT body. A changed `mtime_ns:size` claims a strict new generation and replaces only that session entry.
- AI capability refresh: the capability route rebuilds provider status from registry, cooldown, rate, key, and cached quota state only. Explicit AI Probe/Test remains the sole route that performs live provider probes.
- Concurrent Test All: one request runs `probe_all`; later requests wait on its unique generation signal and receive the same result. A forced refresh invalidates the retained entry before claiming a live generation.
- OpenRouter history hit: unchanged usage-file `mtime:size` returns cached tasks and rollups, then merges a freshly read RPM/daily rate status into the response.
- Real-time operation update: `runtime_get` always reads the operation service directly, so cache hits never freeze synthesizing-audio progress, totals, failures, or the current phase.
