# A7A5 Relay group coordination refactor

## Scope

Trace the pycore client group and UI group through Laravel on FrankenPHP. Record confirmed findings before implementation. Preserve persisted identities and authorization boundaries. Do not run tests, builds, deployment scripts, or services.

## Findings

### User confirmation

The user confirms that the Windows device belongs to the currently logged-in UI account. Ownership mismatch is no longer the working explanation. Continue tracing the same-account roster, request lifecycle, and cache; do not recommend transferring ownership or re-enrolling the healthy device.

1. `PycoreLaravelRelayTransport.ensurePair` emits `RELAY_DEVICE_ENROLLMENT_REQUIRED` locally when the shared roster has no preferred device. This error does not establish a failed Python enrollment or a failed Mercure subscription. The supplied Python log shows successful signed heartbeat and hub authorization requests. Laravel's roster filters by `owner_user_id`; visibility and authenticated UI identity must be traced alongside enrollment ownership.
2. `175_laravel_main_start.sh` already selects the FrankenPHP plane, and `93_install_frankenphp.sh` delegates to the shared installer pipeline. Existing Relay code already requests Mercure authorization. The reported symptom cannot establish that long-connection support is absent; inspect the generated hub configuration and both subscriber lifecycles before replacing transport.

3. Enrollment claim commits the device and credential but never calls the existing presence publisher. An already cached empty roster remains empty until a heartbeat or cache expiry, and connected UIs receive no registration event. Registration must use the same group roster/presence lifecycle as heartbeat.
4. The browser roster applies presence frames immediately, but an older in-flight HTTP snapshot can subsequently replace the entire map and erase that presence. Auth reset clears the map without immediately reconciling an active roster. The periodic reconciliation is disabled while SSE is connected even though the contract explicitly says history is not authoritative. These defects can retain an empty or stale group roster despite a healthy stream.
5. Every provider request forces another roster fetch on an empty result. The six agent-history providers share one missing group prerequisite, yet the transport does not preserve the shared negative-cache boundary. Empty ownership visibility must be reported accurately and reconciled centrally.
6. Python's Relay subscriber state callback only sets a boolean and signals a claim. It does not record connection state, so a successful authorization request is visible while the actual SSE lifecycle is invisible in the supplied log.
7. The internal HTTPS Mercure proxy omits the contract's stream close delay in both shell and PHP Caddy renderers. Domain proxies already use that policy; the remaining route must use it too.
8. Follow-up after the user's same-account confirmation: Relay HTTP uses `createFixedLaravelModuleConfig` and is pinned to `public_urls.laravel_api_origin`, but its roster and SSE lifecycle still subscribe to the unrelated shared Laravel endpoint change event. The stream also calls `resolveLaravelBaseURL()` at startup. A general API endpoint selection can therefore clear an in-flight Relay roster although the Relay coordinator did not change. The discarded request resolves normally, and `ensurePair` only fences auth-session changes, allowing the cleared map to be misreported as an empty group. Fixed Relay transport and its lifecycle must share the same coordinator boundary.
9. `Cache::remember` roster reads and heartbeat `Cache::put` writes are separate operations. An older read can overwrite the newer heartbeat snapshot. Since the browser already coalesces and bounds roster reads, query the authoritative device registry for these reconciliation reads and stop maintaining a second roster copy. This removes the empty-snapshot overwrite path across FrankenPHP workers.

### Follow-up implementation plan

Remove general endpoint-selection resets and resolution from the fixed Relay roster/stream. Retain auth-session fencing. Read the device registry directly for roster reconciliation, preserving owner/status/credential filters. Reject a roster read superseded by an auth transition rather than returning another session's empty map. Update the empty-group translation to describe visibility without assuming ownership mismatch or requiring re-enrollment.

## Architecture and implementation plan

Use the existing authenticated owner's device collection as the authorized pycore group and its owner topic as the UI group's shared subscription. Keep machine signing credentials separate from UI authentication. Laravel remains the authority for group membership; a device heartbeat must never grant another UI account access automatically. Preserve the existing shared Mercure transport, native FrankenPHP publisher, operation ledger, outbox, and private topics.

Centralize roster invalidation after enrollment commit, preserve events arriving during roster requests, reconcile on auth transitions and bounded intervals, and retain the shared empty-roster cache. Report an empty authorized group through Laravel's translated error boundary instead of asserting that Python needs enrollment. Record device and UI group scope using the same opaque owner-topic identifier, allowing logs and authenticated roster responses to distinguish ownership mismatch without exposing credentials.

The user subsequently confirmed matching device ownership and UI account. Treat that as the task's ownership fact. No migration, automatic ownership reassignment, or global anonymous group access is needed. An authenticated production roster response remains unavailable, so runtime reproduction of the identified lifecycle race is not established.

## Official references

- https://frankenphp.dev/docs/mercure/ — embedded Mercure requires explicit configuration and provides SSE subscriptions and native publication.
- https://mercure.rocks/docs/hub/config — private subscriptions, CORS, heartbeat, and stream write duration.
- https://mercure.rocks/spec#reconciliation — reconnect history does not replace authoritative application state reconciliation.
- https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#streaming — delayed connection closure during proxy configuration changes.
- https://laravel.com/docs/13.x/cache — cache retrieval/storage and atomic locking are distinct mechanisms; `remember` is not a transactional roster update.
- https://frankenphp.dev/docs/worker/ — application state persists across requests in worker mode.

## Status

Source tracing completed for the reported admission path, device registration and ownership, shared UI roster and subscriber, Python subscriber, native publisher/outbox, and the 175/93 deployment chain. Implemented the confirmed lifecycle defects after recording them above:

- Enrollment now refreshes the shared roster and publishes presence after its transaction commits.
- Device descriptors and authenticated roster responses carry the same opaque `group_id`; Python logs it when its binding changes.
- Empty rosters carry a stable `RELAY_GROUP_EMPTY` code and a translated message describing account-scoped visibility. The transport preserves its typed not-paired error, status, and group diagnostics.
- UI snapshot merging preserves presence arriving during the request, clears null recommendations, reconciles active auth changes, and periodically reconciles even with an online SSE stream. Provider requests share the empty-roster refresh boundary.
- Python logs actual subscriber lifecycle states independently from successful HTTP authorization.
- Both Caddy renderers apply the existing stream-close policy to the internal HTTPS Mercure proxy.

The same-account follow-up removes unrelated shared-endpoint resets from the fixed Relay roster and SSE lifecycle. Roster callers now reject superseded auth generations. Laravel reconciliation reads the authoritative device registry directly; heartbeat and enrollment no longer maintain a competing cached roster. Existing cache entries are left to expire. Empty-group translations no longer advise changing accounts or re-enrolling the device.

## Pycore sentence-audio follow-up

10. The Windows sentence worker's full-sync mirror stages a local backlog, but `_process_task` sends a Laravel `processing` result before every synthesis. `WorkerResultDelivery` uses the 60-second result timeout and retries synchronously. When Laravel is offline, the first sentence finishes locally, then the next task blocks on this progress POST; the log therefore stops after one generated sentence. Terminal result delivery has the same blocking risk.
11. The durable audio outbox retains generated MP3s and retries domain/result delivery, but result POST failures can occupy the synthesis lane. Offline synthesis must never wait on progress or terminal HTTP delivery; the outbox is the online reconciliation path.
12. The configured diff `data_segment_limit` is 128 while the remote sentence backlog is 2,103. Full-sync pagination materializes only one local segment per changed diff and depends on a later revision to continue. A static pending queue can remain at one staged batch; full-sync intake must continue paging until the local segment capacity is filled.

## Pycore implementation plan

Set a short audio-worker result timeout and add a transport backoff gate shared by processing and terminal result posts. Synthesis continues from the local mirror and writes the durable audio outbox while Laravel is unavailable. On each successful diff/heartbeat reconnect, trigger the outbox drain before fetching fresh work. Extend full-sync page-data intake across all ordered IDs up to the local durable capacity, preserving Laravel queue order and queue-head promotions.

## Pycore implementation completed

- Audio workers now use a two-second result/claim timeout and a 30-second transport backoff gate. Failed processing or terminal result posts return immediately after the first failed attempt and cannot serialize the Qwen sentence lane.
- Full-sync durable segment capacity now follows the contract's 4096 ordered-ID window; the 128 value remains the per-page materialization size. The existing ordered diff loop fills all available pages before local dispatch.
- A successful queue-diff response invokes the audio worker reconnect hook, which kicks the lane's kind of the shared durable Laravel delivery outbox (`pycore/pyutils/laravel/delivery_outbox.py`, 2026-09-27) before admitting more work. Cached MP3s remain on the Windows pycore data disk until Laravel accepts the domain upload/result/history steps.
- The local queue continues to synthesize from its persisted mirror while Laravel is offline. When connectivity returns, normal diff reconciliation reorders the local head and the outbox retries cached uploads; queue-head changes still update both persistent segments and the in-process heap.

The observed `remote_en=590/2103` followed by no sentence progress is therefore explained by a blocked progress POST, not a Qwen synthesis limit. The corrected state machine is:

`Laravel full ordered diff -> Windows durable mirror -> local Qwen synthesis -> retained MP3/outbox -> reconnect diff -> upload/result/history -> remove local delivery record`

The remote task remains fenced by the existing just-in-time claim when reachable; when unreachable, local synthesis proceeds and the durable outbox preserves the result until the coordinator is available.

No tests, builds, verification commands, service starts/restarts, deployment scripts, or Git operations were executed. The browser page could not be retrieved through the web reader; no authenticated production roster response was available. The source-level races are addressed; their occurrence in the reported production session and the live result after rollout remain unverified. Caddy template edits require normal configuration convergence to become active.

## Sentence text observability follow-up

13. The sentence lane emitted synthesis lifecycle events and queue counters, but did not print the actual sentence text. This made it impossible to distinguish a stalled Laravel delivery call from a Qwen generation stall using the Windows console alone.
14. The sentence lane now prints a normalized single-line `Generating sentence` record immediately before synthesis, including the task identifier, queue position, and sentence text. The record is emitted before any progress HTTP call so it remains visible when Laravel is offline.

## Runtime evidence follow-up

15. The reported `remote_en=378/1713` and `sync[sentence_audio] ... order=489` lines prove that the remote diff is being read, but no `Generating sentence` line proves that the local sentence heap is not dispatching a task. The full-sync intake currently suppresses another mirror refresh after sync capability is enabled, so the dispatch path can observe stale or already-delivered segment state indefinitely.
16. Repeated `qwen3tts: starting` / `ready` messages are lifecycle churn, not sentence progress. Engine startup is being requested by readiness probing and synthesis admission without a single-flight lease; concurrent probes/recovery paths can restart the same managed service repeatedly.
17. History uploads are currently retried from more than one outbox transition path. Without an idempotency key covering `(delivery_id, operation)`, each retry can produce another history submission even when the prior request was durably accepted.
18. Progress/result delivery and audio upload use the same request-style timeout contract. This conflicts with the required long-lived FrankenPHP transport: timeout values must be removed from the upload/result path, while reconnect detection and background retry must be driven by connection failure rather than a fixed deadline.

## Runtime correction applied

19. Full-sync intake now refreshes the remote diff on every cycle, including after sync capability is established, and then dispatches the persisted local segment. This closes the stale-mirror path that produced queue counters without a local `Generating sentence` event.
20. Audio processing progress is now local-only; Qwen chunk progress and stage transitions no longer issue synchronous Laravel POSTs. Article uploads and audio result/upload requests run in background delivery paths and use natural response completion (`no_timeout`) while retry state remains durable.
21. A Laravel `writeback_pending` response is a durable idempotent receipt. The agent-history article-audio delivery (kind `agent_history.article_audio` of the shared Laravel delivery outbox since 2026-09-27) marks that step accepted locally and waits for FrankenPHP's asynchronous writeback instead of re-uploading the same bytes every scheduler tick. Local history already replaces duplicate `record_id` entries atomically.
22. New runtime evidence showed `sync[sentence_audio] ... order=489` without any synthesis log. The local full-sync path now reports recovered/processed counts explicitly, and the Qwen server lane limit is raised to the shared server recommendation (three in-flight sentences) so parallel local generation is observable and effective.
23. The latest runtime still had no sentence text because persisted rows were marked delivered before local admission. Full-sync pending reads are now replayable until the heap accepts the task, and sentence admission prints the text as an additional boundary log.
24. Upload progress now includes an explicit reason (`sentence_audio_delivery`, `word_audio_delivery`, or `agent_history_audio_rebuild`) in both console and HTTP recorder entries, so each transfer can be traced to its producer.
25. Source comparison with Laravel `QueueCenterController::pageData` found the blocking defect: Laravel returns materialized rows under `data.items`, while Python only read `data.tasks`. Every page therefore staged zero rows (`+0`) despite an ordered list of 489 IDs. Python now accepts the canonical `items` field and retains `tasks` as a legacy alias.
26. The contract audit found that `items` is canonical for queue page-data while `tasks` is canonical only for the worker pull and task-list snapshots. These response shapes are intentionally different and must not be normalized by guessing at call sites; the adapter now documents and handles both exact shapes.
27. Upload progress previously had no producer/reason field even though three independent upload lanes share the same endpoint family. The progress contract now carries the reason through console and HTTP recorder entries, and agent-history replacement receipts are treated as asynchronous durable acceptance to prevent scheduler re-submission.
28. Runtime inspection confirmed that `Queued sentence` logs were emitted during full-sync admission, not during synthesis, creating dense output. Those admission logs are removed; only the Qwen processing boundary prints sentence text.
29. Qwen chunk progress was incorrectly projected onto the global 0-100 task percentage, although full-sync consumers process an open-ended ordered backlog. The global stage is now stable during synthesis; only changed Qwen chunk counters are printed and retained as local metadata.
30. The required semantics are distinct: `progress` is the Laravel full-queue completion (`completed/total`), while `qwen_progress`/`chunks` is the current synthesis operation's internal chunk counter. Sentence logs now render the full queue progress and task ID separately; Qwen gray lines append only changed chunk values.
31. Unchanged diff probes were previously logged once per heartbeat, creating noise. Workers now keep a per-task-type diff state and print only the initial state or a true/false state transition, including the number of checks since the previous transition and the lifetime check count. No fixed sampling interval is used.
32. A replayable full-sync read must still mark a row delivered after admission. Leaving every pending read unmarked caused completed word tasks to be re-enqueued while their outbox result was pending, producing duplicate upload requests. The sweep now clears stale marks once per process, then restores normal delivered marking.
33. Full-sync mirror lines (`sync[task_type] +staged -vanished order= reorder=`) were printed on every diff round even when nothing changed. The counter names now live in the constant center (`QUEUE_CENTER_DIFF_SYNC_LOG_KEYS`), and each worker keeps the last emitted values per task type; the line is printed only when at least one counter changes.
34. Item 32 removed the re-enqueue path, but duplicate `word_audio_delivery` uploads persisted: distinct outbox records (retried attempts or duplicated backend rows for the same dict word) produce identical `(endpoint, params, bytes)` transfers and were uploaded in parallel by the outbox drain. `LaravelProgressUploader` now treats an identical transfer as the same logical delivery — a concurrent duplicate awaits the in-flight leader, and a duplicate inside the contract's `http_transfer.dedup_window_seconds` (300s) reuses the durable receipt without re-POSTing. Suppressed duplicates are logged as `deduplicated`.

## Transport timeout refactor follow-up

35. Fixed per-request deadlines (`no_timeout`, the 2s claim accept, the 15s pull) conflicted with the long-lived FrankenPHP transport: uploads either waited forever on a dead peer or failed mid-transfer on a slow one. The client's `activity_timeout` mode is now the ONE progress-driven timeout for all worker/upload traffic: connect must finish within `connect_timeout_seconds`, and any socket stall beyond `idle_timeout_seconds` fails, but a transfer that keeps making progress never times out (urllib3 applies the read value per socket operation). `no_timeout`, `RESULT_HTTP_TIMEOUT`, and `PULL_HTTP_TIMEOUT_SECONDS` are removed; uploads, result posts, claim accept, release, pulls, and the agent-history submit all pass `http_transfer_contract()`. This supersedes item 20's `no_timeout` wording.
36. Log prefixes carried two `+N.NNs` values. The first (service uptime anchored at `PYSERVICE_STARTED_MONOTONIC`) now renders through the shared `format_duration_hms` in `pyfoundations/pybasecommon/color_print.py` as `HH:MM:SS`; the second (per-line print delta injected by `ColorPrint._message_with_elapsed`) is unchanged.

## Endpoint duplication audit follow-up

37. `/api/worker/tasks/{type}/accept` vs `/result`: functionally overlapping BY DESIGN — `TaskManagerService::submitCompletedResult` contains the same pending-claim branch as `acceptTask`, so result alone completes everything accept does. The pycore just-in-time accept is kept as the early drop for gone/foreign-owned rows BEFORE synthesis; removing it would waste synthesis on 409-bound tasks.
38. The repeated identical word upload (`100.00% (11232/11232 bytes)` in a loop) was rooted server-side: `WordTranslationTaskProcessor::processResult` re-derived the dict row from the worker-supplied word/md5 pair, and any identity drift zeroed `stored_count`, tripping the result-trust downgrade (`empty_store`) and re-queuing a word whose audio was already persisted by the domain report. The word_audio trust check now reads the enqueue-time dict linkage (`dict_row_id`/`dict_language` on the task) first and falls back to the md5 scan. Upload progress lines now carry the producer identity (`task_id=`/`content_id=`/...) so any future repeat is attributable from the console alone.
39. Upload endpoint sharing: all pycore lanes already go through the single `LaravelProgressUploader`; server-side word and sentence reports share `AppQyV1DurableOffsetUploadService`. The agent-history replace-audio lane keeps its own marker-file implementation because its completion semantics differ (deferred publish with `writeback_pending` receipts instead of synchronous completion); only the spool-write core overlaps and is left as-is.
