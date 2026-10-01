# PROGRESS 2026-10-01 — pycore Root-Level Refactor

Source audit: `docs_fix/AUDIT_20261001_PYCORE_DUPLICATION_REFACTOR.md`.

User directive (2026-10-01):
1. Merge rpc_v2 into `rpc` and delete the old code.
2. Merge relay into one relay with no version number.
3. Correct the spec clauses.
4. Clean up and merge duplicate implementations.
5. Refactor at the root with a changed technical approach, not patches.
6. Then write this progress document.

## Phase 0 — done by the coordinator

**rpc rename.** `pycore/pyutils/rpc_v2` became `pycore/pyutils/rpc`.
- All `rpc_v2` / `RPC v2` / `RpcV2` identifiers were renamed in pycore, pyapps, the Laravel `CallPycoreUtils`, scripts, pyservice.ps1/sh, and `config/pycore_relay_contract.json`. 103 files changed.
- The dead legacy `rpc` metadata entry was removed from `pythreadpool/registry.py`; the surviving service key is `rpc`.
- Out of scope: `ncore` (the Node runtime) keeps its own `rpc`/`rpc_v2`.

**Spec rewrite.** `development-guides/PYTHON_PYCORE.md` now has:
- a corrected layer table (pygvar in pyfoundations; pythreadpool, pyheartbeat and pylauncher placed; pyutils may depend on database)
- try/except allowed only at boundaries
- the singleton exception clauses
- a complete threading rule
- the canonical primitives table
- bans on version numbers in names, on compatibility shims, and on demo/dead code
- the single-relay rule

**New canonical primitives:**
- `pyfoundations/time_utils.py`
- `pyfoundations/net_probe.py`
- `pyfoundations/text_eol.py`, which replaces `pyutils/codesync/textnorm.py` (deleted); importers were updated
- `pyfoundations/backoff_wait.Backoff`
- `database/adapters/sqlite_local.open_wal_connection` and `SQLITE_BUSY_TIMEOUT_MS`

**Incident.** A background gitsync job auto-committed a mid-rename state. In that commit 63 CRLF files had been rewritten as LF. Their CRLF endings were restored against the parent commit.

## Phase 1 — parallel workstreams

### A. Relay unification

**Design.** One relay, plain names. Every call is a hub-native frame (UI -> Laravel `owner_frames` -> request topic -> device -> response topic). Laravel is control plane only: enrollment, pairing, roster, grant/token minting, route policy, rate limit, admission, telemetry. Delivery guarantee (`read` / `idempotent_write` / `at_most_once_action`) is the route-profile key `delivery`, enforced on the device: memory cache for duplicates, durable `relay_execution_ledger` (keyed by operation id, byte-exact result replay, `execution_unknown` on interrupted actions) for non-read. Offline device fails fast (`device_offline` 503). Long actions (`ack: true` profile, today `terminal_integration`) get an `ack` frame then the `result` frame. Large bodies go through the blob store by `b.ref` both ways (no durable-lane fallback). One device heartbeat returns the grant (bootstrap fix: grant is issued without a live stream). One owner grant covers owner-events and response topics (one UI hub connection).

**pycore.** New `pyctl/relay/`: `relay_agent` (enrollment + heartbeat control thread, lifecycle), `relay_state`, `relay_frames`, `relay_grant`, `relay_reader`, `relay_publisher` (via `laravel_client`), `relay_worker`, `relay_events` (journal tap + device events, `Backoff`). `pyutils/laravel/relay_transport.relay_transport` (endpoint = `laravel_endpoint_manager.resolve()`, device signing, blob up/download). `pyutils/laravel/mercure_client` (moved from `common`, now `laravel_client` + `SseEventDecoder` + `Backoff`). `relay_contract` rewritten for the single contract. Callers updated: `pyctl/runtime/event_handlers.py`, `queue_center/snapshot_service.py` (import path), `pyutils/rpc/execution.py` (log key `delivery`). Legacy identity file reader removed (`pycore_relay_v2_identity.json` is no longer read; assumption: all devices already migrated to `pycore_relay_identity.json`).

**Contract.** `config/pycore_relay_contract.json` is the only relay contract (frame envelope version 1, protocol_version 1, `delivery` per profile, `errors`, `hub_profile`, `capability_providers`). `pycore_relay_fabric_contract.json` deleted; relay block removed from `queue_center_contract.json` (readers moved to the relay contract in Laravel and UI).

**Laravel.** `RelayContract` (merged reader), `RelayFrameService`, `RelayStore` (redis prefix and connection `relay`), merged `RelayOwnerCtl`/`RelayDeviceCtl`, operation-independent `RelayBlobService`, new table key `RELAY_LEDGER` with additive migration; operation service/model/claim/lease/poll routes removed.

**UI.** `RelayTransport` + `LaravelRelayStream` (one hub connection) + `RelayDelivery` + `RelayPairing` + `LaravelRelayTelemetry` + `PcRelayStats`; shared `core/tasks/Backoff.ts`; `RelayContract.ts` single reader with `RELAY_CONTRACT_DIGEST`.

**Verification.** Python: py_compile of all touched files; `import pycore.pyctl.relay.relay_agent` and `snapshot_service` import clean; frame decode/validate/size checks run offline. PHP: `php -l`. UI: `tsc --noEmit` clean except the dead files below and an unrelated `PycoreApiTransport.ts` error from another workstream.

**Deleted dead files.** A deleted them after the classifier allowed it:
- 9 Laravel relay files: `RelayFabricService`, `RelayOperationService`, `RelayOperationEventService`, `RelayFabricContract`, `RelayHubService`, `RelayAuthorizationService`, `RelayFabricCtl`, `RelayOperationModel`, `RelayHubPublisher`.
- 7 UI files: the fabric/durable transports, the operation events, the fabric telemetry, `RelayFabricContract.ts` and `PcFabricStats.tsx`.

**Pending deletion (user decision):**
- `poly_apps/laravel_main/database/migrations/global_RelayV3_2026_09_30_000001_create_relay_fabric_ledger_table.php`, which is now a no-op. The applied `RelayV2`/`RelayV3` migration filenames are otherwise kept, because renaming them would re-run them.
- The empty `pycore/pyctl/relay/fabric/` directory (pycache only).

Dead after this change, in D1's scope: `database/repositories/state_repository.py:413 migrate_operation_kind`.

**Re-audit regression fixed:** relay requests that carry a body (device control posts, blob chunks, hub frame publish) used a fixed total timeout; they now use progress stall detection.

**Coordinator follow-ups:**
- Offline execution: answered in the merge audit. Fail-fast `device_offline` replaces it by user choice.
- Per-operation progress: no route emits progress today, so the wire has only `ack`/`result`. This is an open design item.
- UI blob upload stall detection: handed to F.

**Verify on the live Laravel server.** Run `sys:init` (new `global_relay_ledger`); `php artisan route:list` for `/api/relay/*` (grant, frames, stats, device/heartbeat, device/response-blobs); Redis db 3 reachable as connection `relay` (old `relay_fabric:*` keys orphan and expire); Mercure JWT scopes (owner token spans owner-events + response topics, device publish token scoped to response topics, device request topic now also carries `relay.credential.revoked`); contract digest changed, so every device and UI build must be redeployed together (flag day); old applied `RelayV2`/`RelayV3` migration filenames kept (renaming would re-run them).

**Open items.** handlers can adopt `relay_progress.report(request_id, phase, done, total, byte_count)` for done/total detail (none do yet; the heartbeat covers liveness); the UI treats frames lost during a stream outage as a timeout; `laravel_endpoint_manager.resolve()` is now the grant origin authority, so the server's `mercure_hub` public URL must share the resolved origin; I staged two index-only git changes by mistake (`git rm --cached` of the fabric contract, by me and the Laravel fork's `git mv`), harmless to the auto-commit.

**Still-valid open items carried over from the deleted V3 status audit.** (1) The unified relay has never run end to end on Windows: acceptance is p50 <= 0.6 s and p95 <= 1.2 s for `/status`, then a quiet period before any rollback path is dropped. (2) Owner routes are not authenticated per user (`RelayOwnerResolver` returns the public owner, so the roster read is unauthenticated); decide separately. (3) The device-side share of the old 8 s latency is unconfirmed until relay stats show real traffic. (4) The V3 design doc (`DESIGN_20260930_RELAY_FABRIC_V3_HUB_NATIVE_RPC.md`) is superseded on lanes, contract file, topics and cutover: there is one relay, no durable lane, no capability negotiation, rollback is a normal deploy. Offline queueing is intentionally gone (fail-fast `device_offline`); long work uses `ack` frames with `max_deadline_seconds` 180. (5) Migration files `global_RelayV2_2026_08_23_000005_create_relay_operations_table.php` and the empty `global_RelayV3_2026_09_30_000001_create_relay_fabric_ledger_table.php` plus the `RELAY_OPERATIONS` key in `GlobalTablesMap` are obsolete and left in place for the user to remove together (deleting was denied); never drop the existing tables.

**Liveness (progress frames).** Frame kinds are `ack`, `progress`, `result`. `progress` carries `p: {phase, done, total, bytes}` (status 102, empty body). The device registry `pyutils/common/relay_progress.py` tracks running relayed operations; `RelayProgressThread` emits a heartbeat progress frame for every operation silent for `progress_min_interval_seconds` (2 s), and handlers may enrich it with `relay_progress.report(request_id, ...)`. The UI waiter (`RelayTransport.ts`) treats any frame as liveness and fails an admitted call only after `stall_window_seconds` (30 s) of silence (`ack_timeout_seconds` before the first frame on `ack_required` routes); the admission-time deadline no longer bounds the wait. A result finished after the admission deadline is now still published. Laravel is untouched (device publishes straight to the hub). Device execution is still capped by the kernel (`execution_timeout_seconds`, route timeout). Contract: `stall_window_seconds` must span at least three progress intervals.

**Merge audit (A).** Dates from `git log -1`.

| merged-into | variants removed | newest-source | capabilities ported | dropped and why |
|---|---|---|---|---|
| Single frame path (`RelayFrameService`, `relay_worker`, `RelayTransport.ts`) | durable lane: `RelayOperationService` (09-17), claim/lease/poll routes, `laravel_relay_operation_processor`, `PycoreLaravelRelayTransport.ts` (09-30) vs fast lane (09-30) | fast lane | execution ledger (dedupe, byte-exact replay, `execution_unknown`), owner rate limit, request dedupe, telemetry/ledger table, blob store for large bodies (both directions), owner events outbox, per-route timeout/delivery policy | queued-for-offline execution: replaced by fail-fast `device_offline` (the user wants no deferred execution). Lease renew, recovery claim, claim epochs/fencing: only needed by a server-side job queue, replaced by device-side ledger keyed by operation id. `owner_pending_operations` cap (`owner_pending_limit`): no queue exists; load is bounded by `owner_frames_per_minute` and device `device_max_concurrent_requests` / overload verdict. Operation cancel/status routes: no server-side operation rows. The old OperationService wrote no separate audit rows beyond operation state and outbox; per-call audit is the telemetry ledger. Per-operation progress: now ported as the `progress` frame kind (see Liveness below) |
| `relay_agent` control thread, one heartbeat returning the grant | `laravel_relay_agent_service._heartbeat`, `fabric_grant.heartbeat` loop (both 09-30) | fabric | capabilities/contract digest, online withdrawal at stop, stream_connected, active_requests, grant_version, presence event publishing, enrollment and re-enrollment, conflict hint, Backoff | V2 heartbeat-only payload; first-grant gating on a live stream (bug, fixed) |
| `config/pycore_relay_contract.json` (+ PHP and TS single readers) | V2 contract, fabric contract, queue_center `relay` block (10-01) | fabric for frames/limits, V2 for signing/routes | signing and digest profiles, route policies, events, terminal limits, hub token ttl, capability providers, errors | lease/claim/operation-state/transition sections and `claim_generation_profile`: lane deleted |
| `RelayContract`, `RelayFrameService`, `RelayOwnerCtl`/`RelayDeviceCtl`, `RelayBlobService` | `RelayFabricContract/Service/Ctl/Store`, `RelayOperationService/EventService/Model`, `RelayHubService`, `RelayAuthorizationService`, `RelayHubPublisher` | fabric (09-30) | grant, admission, presence, ledger drain, stats, blob quota and chunk logic, pairing/roster/enrollment unchanged | generation-bound blob checks (no operations); `device_hub_authorization`/`owner_hub_authorization` (merged into grants) |
| UI `RelayTransport` + `LaravelRelayStream` | polling transport, fabric transport (both 09-30) | fabric | grant rotation, stream reconnect, pairing recovery retry, read coalescing/429 backoff, telemetry, stats panel, timeouts via deadline, blob upload/download | polling, cancel, durable fallback, `response_too_large` fallback (device uses blob refs), retry of any admitted call (at-most-once must not auto-retry) |
| `mercure_client` using `SseEventDecoder` | hand-rolled parser (09-20), session-per-subscriber | `SseEventDecoder` | resume headers, cursor, retry hint, token refresh, size cap, content-type check | redirect following (forbidden by hub profile); swallowed callback errors (spec) |
| `Backoff` | 7 loops: forwarder, agent x2, processor x2, fabric agent, mercure | `backoff_wait` (10-01) | min/max cadence, reset after stable connection | x4 recovery cadence (lane gone) |
| `relay_publisher` via `laravel_client` | raw session in `fabric_publisher` | fabric | 401/403 re-grant retry, 2 attempts, scoped token, stall-driven timeout (`activity_timeout`) | per-thread keep-alive session (shared pool) |

### B. Laravel transport, HTTP stack, workers
**HTTP stack.** `pyutils/common/http_client.py` is now the only HTTP connection owner.
- `HttpConnectionPools` (module instance `http_connection_pools`) owns one thread-safe httpx pool per proxy policy. Loopback always bypasses proxies, and TCP keepalive is set. This replaces the per-thread maps keyed by `threading.get_ident`.
- `HttpClient` instances are cheap defaults objects: base URL, timeout, headers, `trust_env`. The shared instance is `http_client`.
- Public method names stay stable. `request()` gained `form`, `files`, `stream`, `follow_redirects` and `progress_callback`; `put`/`delete`/`head` were added.
- Uploads (a body of at least the contract `chunk_bytes`, or of unknown length) are progress-driven automatically from `http_transfer_contract()`: connect is bounded, write stalls are bounded by `idle_timeout_seconds`, the response wait is unbounded and TCP keepalive detects a dead peer; a caller `timeout` only replaces the connect bound. Small control bodies (pull, heartbeat, claim, result) and bodiless requests use the normal read timeout (`laravel_client` default: the contract's connect and idle values), so a live but hung server cannot block a thread. Progress of any body reaches `progress_callback` and every `transfer_observer`.
- The `activity_timeout` parameter is gone from `http_client` and `laravel_client`. Its arguments were removed repo-wide, including in other workstreams' files: `pyctl/tts/laravel_audio_worker_reporting.py`, `pyctl/tts/word_audio_service.py`, `pyctl/audio_orchestration/orch_delivery.py`, `pyctl/agent_history/pipeline/laravel_stage.py`, `pyctl/relay/relay_publisher.py`, `pyutils/laravel/relay_transport.py`.
- `HttpResponse` buffers or streams: `iter_bytes`, `iter_lines`, `raise_for_status`, `http_version`.
- Canonical errors: `HttpError(OSError)` and its subclasses `HttpConnectError`, `HttpTimeoutError`, `HttpConnectTimeout`, `HttpReadTimeout`, `HttpProtocolError`, `HttpStatusError`.
- `redacted_http_error` is the one error shortener. `laravel/client._short_err`, `worker_result_delivery.short_http_error` and `worker_base._short_err` are deleted.
- TCP keepalive values come from `http_transfer.keepalive_*` in `config/queue_center_contract.json`; the `HTTP_KEEPALIVE_*` constants in `pyfoundations/network_constants.py` were removed. No Laravel code reads these keys (the only reader, `app/Support/HttpTransfer.php`, is unreferenced and pending deletion).
- `HttpTransferProgress` (stall clock) and `transfer_observer()` (a contextvar scope that replaces `transfer_scope`) also live in this module.
- Deleted: `laravel_http_transport.py` and `http_progress_upload.py`. The remaining callers (openrouter, `local_assist_routes`) were migrated.

**Laravel request path.** `laravel_client` stays the only Laravel request path (signing, recording, reachability, `laravel_failure` classification by exception type).
- It now runs on `http_client`.
- `build_url` is public, and `get_stream` and the env fallback base were removed.
- `http_recorder` was reduced to its used surface.

**Base URL.** `laravel_endpoint_manager.resolve()` / `get_active_base_url()` is the only authority, and only the manager imports `LARAVEL_WORKER_API_URL` (as a catalog seed). Deleted: `resolve_laravel_base_url`, `worker_base._sync_laravel_endpoint`, worker constructor URLs and `_candidates`.

**Results.** New `pyutils/laravel/worker_results.py`:
- Typed `WorkerResult` and `ResultPostOutcome`.
- `worker_result_channel.post` makes a single attempt.
- `submit` is durable: outbox kind `worker_result`. The immediate drain is the first attempt, and outbox backoff is the only retry.
- Settle listeners are registered per worker; there is no duck-typing.
- Deleted `worker_result_delivery.py` and its inline retries. The backend breaker now lives in the channel (3 consecutive HTTP 5xx results pause the worker's intake for 120 s; any accepted result resets it). Status reports `result_backlog` and `circuit_open`.

**Worker split.** `pyctl/laravel/worker_base.py` is now a thin composer over `pyctl/laravel/worker/{host (Protocol), registration, claim_ledger, task_claims, task_puller}.py`.
- The `_pull_once` hook became `run_pull_cycle`.
- Translation handlers call `_submit_result` for terminal results and `_post_result` for pings.
- Audio worker files got minimal updates; C was notified.

**Compute tasks (Laravel never calls pycore).**
- `pyctl/laravel/worker/handler_worker.LaravelHandlerWorker` was extracted from the translation worker: inflight dedup (now checked before the lease keep-alive starts), TaskManager dispatch, the lease keep-alive ping, and a handler table `handler(payload, task) -> result`, where a raised exception reports `failed` and terminal results go through the outbox. `TranslationWorkerService` now subclasses it.
- `pyctl/laravel/compute_worker.laravel_compute_worker` pulls the contract task types claimed by pycore on `remote_compute`/`remote_ocr`. Those are `ocr_recognize` and `tts_synthesize`; `text_translation` and `ai_status` were removed from the contract because keyed AI stays in Laravel's gateway.
- Handlers are in `pyctl/laravel/compute_handlers.py`: C's service entries `recognize_ocr` and `synthesize_speech`, the image size limit and the 100-byte audio check (Laravel dedups by group_key, so no client_task_id). C's `translation/worker/handlers/compute.py` was folded into it.
- The worker register refresh is a third of the contract `limits.worker_heartbeat_ttl_seconds`.
- The lane registry has a `compute` lane (heartbeat callback `compute_worker`, always on, not a user toggle).

**Version skew.** A typed route answering 404 marks that task type unsupported for that Laravel server. The 404 is recognized by `error_code: LARAVEL_TASK_TYPE_UNSUPPORTED`; the legacy English text "Unknown task type" / "Unknown queue" is also accepted and is kept only while live servers predate the code.
- The type is skipped in diff and pull while the others continue, and is re-probed with `Backoff` (5 min doubling to 60 min). The code is logged once.
- The set lives in a THREAD_BUS state owner (`UnsupportedTaskTypes`).
- It is cleared on a fresh worker registration and on an endpoint change, so a newly deployed Laravel is used at once.
- `unsupported_task_types` appears in worker status. Other HTTP failures raise as before.

**Compute class.** `worker/registration.detect_compute_identity()` detects the compute class once, through `CUDADetector`; this is detection only. Every register/heartbeat and pull body carries `compute_class` (`gpu` | `cpu_only`), `gpu_name` and `gpu_vram_mb`. Diff and page-data reads add `worker_id` and `compute_class`, so Laravel can list only the tasks it offers to this pycore. An accept answered 409 drops the task locally. Field names were proposed to workstream I (the Laravel scheduler side).

**Outbox split.** The 1539-line `pyutils/laravel/delivery_outbox.py` god module is now a 201-line composer (`laravel_delivery_outbox`: lifecycle, register, enqueue, producer and operator API) over `pyutils/laravel/delivery/`:
- `model.py`: the row/kind/namespace contract docs, constants, `DeliveryKind`, `make_delivery_id`, `make_item_key`, `retry_delay` and namespace helpers.
- `store.py`: one state owner for rows, kinds, receipts, metrics and drain flags. It keeps `put` and `end_drain` ordered on one thread, and owns payload retention.
- `breaker.py`: the server-error drain pause.
- `scheduler.py`: drains, claim/deliver/settle and the offline watcher.
- `reconciler.py`: the per-server inventory diff and the online/switch edges.
- `status.py`: counters and the overview.

Behaviour is unchanged and there is no re-export shim. Importers of the constants and helpers (the C/D2 delivery kinds, `worker_results`) import from `delivery.model` / `delivery.store`. Tested against a temp DB: a done row was delivered with its step marked, a 5xx retry counted a failure and stayed pending, and stats and status were complete.

**Endpoints.** Paths moved into the `config/queue_center_contract.json` endpoints: `laravel_health`, `media_ingest`, `media_ingest_clip`, `media_subtitles`, `assist_requests` (`media_enrich` was added, then deleted along with the uncalled `media_service.enrich`).

**Backoff.**
- New `Backoff.delay_for(attempt)` (a small extension to pyfoundations).
- The outbox `retry_delay` and the diff-recovery window use `Backoff`.

**Sync cleanup.**
- Removed the unused v1/v2 payload paths (`model_version`, `build_payload`, `build_book_payload_v2`, `derive_sentences`).
- `*_v3` renamed to plain names; the two chunked ingest loops were merged into `ingest_chunked`.
- `_media_sync_helpers` renamed to `media_sync_helpers`, and the media_sync facade re-exports were removed.

**Deleted dead code.** `translation/worker/base_laravel_worker.py`, `handlers/ai_translate.py`, `bing_selenium.py`.

**Sweep across the scope.**
- Internal try/except removed; boundaries narrowed and reported.
- `datetime.now` replaced with `utc_now_iso`.
- corebook and list-cache writes go through `atomic_json_store`; outbox payload copies use `atomic_write_bytes`.
- Scope files made ASCII-only; CRLF endings preserved.

**Merge audit (B).** Newest-source dates are the pre-session history (last commit before 2026-10-01).

| merged-into | variants removed | newest-source | capabilities ported | dropped + why |
|---|---|---|---|---|
| `common/http_client.py` (`HttpConnectionPools`, `HttpClient`, `HttpResponse`) | `http_progress_upload.HttpProgressClient` (2026-09-30), `laravel_http_transport.LaravelHttpSessions` (2026-09-30), old http.client `HttpClient` (2026-09-27) | HttpProgressClient (uploads), LaravelHttpSessions (pooling) | Progress mode on every upload (connect bound, write-stall idle bound, unbounded response wait, TCP keepalive); upload and receive progress phases; transfer scope as contextvar `transfer_observer`; stall clock `HttpTransferProgress`; contract chunk size with `maximum_chunk_bytes` clamp; `[http upload]` closing log; env proxy handling plus loopback bypass; `http_version` and transport tag | Per-thread sessions (forbidden by the spec); conversion into requests exceptions (replaced by the `HttpError` family); unused `auth` kwarg; THREAD_BUS `http.transfer.*` signals (no readers). Neither stack negotiated HTTP/2 or HTTP/3. Deliberate change: the `[http upload]` line prints only for real uploads (a body of at least `chunk_bytes`, or more than one chunk sent), because the old progress client carried only real uploads and every Laravel JSON POST now uses this path; progress publishing and observers are unchanged |
| `common/http_client.redacted_http_error` | `laravel/client._short_err` (2026-09-30), `worker_result_delivery.short_http_error` (2026-09-27), `worker_base._short_err` (2026-09-27) | redacted variant (no URLs in logs) | Friendly categories (refused / not resolvable / unreachable / closed / connect or read timed out); class plus first line otherwise | URL-bearing raw text (can leak keys) |
| `laravel_endpoint_manager.resolve()` / `get_active_base_url()` | `resolve_laravel_base_url` (2026-09-22), `worker_base._sync_laravel_endpoint` (2026-09-27), `client._FALLBACK_BASE` (2026-09-30) | endpoint_manager (2026-09-30) | Caller override; worker re-registration on base change; env URL stays the first catalog seed; probing and reachability unchanged | Worker `_candidates` (only logged); fallback-on-exception (resolve never raises) |
| `delivery_outbox` + `laravel/worker_results.py` | `worker_result_delivery` retries (2026-09-27), `worker_base` 5xx breaker (2026-09-27) | delivery_outbox (2026-09-30) | Immediate first attempt, then per-row backoff; 409/404/4xx terminal handling with segment consume and ledger forget (409 settles any transition); `RESULT_TASK_TYPE` fallback and its log; `LOG_ACCEPTED_RESULTS`; ping skip on shutdown or a known-offline server. Breaker in two places: (a) outbox drain pause with `Backoff` (15 s doubling to 300 s) after 3 consecutive `server_error` outcomes, closed by any delivered row, so the outbox no longer hammers a failing Laravel; (b) worker intake pause of 120 s after 3 consecutive 5xx results (`circuit_open`) | Inline 0.5/1.5 s retries and the segment `defer` (superseded by durable outbox retry) |
| `worker_base.py` composer + `worker/{host,registration,claim_ledger,task_claims,task_puller,handler_worker}.py` | 1263-line `BaseLaravelWorkerService` (2026-09-27); translation-worker dispatch/keep-alive (2026-09-27) | only version | Registration throttle and accept-404 self-heal; diff mirror (bootstrap cursors, ordered diff, page-data, reorder, log dedup); bounded claim-pull with type rotation and head reserve; just-in-time claim with offline snapshot; release on immediate stop; staged dispatch; priority/head events; bounded ledger; pull guard; inflight dedup, TaskManager rows and lease keep-alive (now in `LaravelHandlerWorker`) | Page-data `tasks` alias (compat shim); constructor URL and `_candidates` (single URL authority); the fixed 30 s diff-recovery window became `Backoff`; the duplicate keep-alive thread on a duplicate dispatch (a bug) |
| `media_sync.ingest_chunked` | `_ingest_book_chunked_v3`, `_ingest_subtitle_chunked_v3` (2026-09-20) | same date | Book/document `source_type`; subtitle `segments` with `chapters` on the first chunk; per-chunk progress and errors | none |
| `build_book_payload` / `build_subtitle_payload` (v3, renamed) | v1 `build_book_payload`, v2 `build_book_payload_v2`, v1 subtitle `build_payload` + `derive_sentences`, v2 `_ingest_book_chunked`, `model_version` 1/2 (2026-09-20/22) | v3 builders | v3 is a superset | v1/v2 wire models: no callers; Laravel ingests v3 only |

**Verification (B).** py_compile and import checks pass for every touched module.
- Local HTTP tests: query, JSON/form/multipart POST, streaming lines, refused connection, a 409 result classified as rejected.
- Upload timing with idle 1 s and connect 2 s:
  - a stalled 20 MB upload failed after 1.2 s (`WriteTimeout`);
  - a slow-but-progressing 1.5 MB upload finished after 7.8 s;
  - a response sent 3 s after the body succeeded.
- Breakers: the outbox pause went 15 s, then 30 s, then closed; the worker intake breaker opened and reset.
- Compute worker: completed, failed and unknown-type paths submit correctly.
- Version skew (stub returning 404 for one type): one log line, the other type keeps pulling, `unsupported_task_types` shown, a 500 still raises.
- Upload log: a small JSON POST prints no line; a 600 KB upload prints it.

**Audit fixes (B).**
- #6: small control posts are bounded by the read timeout, while uploads stay stall-driven. Tested: a hung server on a small JSON POST timed out after 1.8 s; a 200 KB upload whose reply came 4 s later succeeded.
- #11: `TaskPuller._recover` skips staged tasks whose terminal result still waits in the outbox. Result rows carry `group_key = <worker_id>:<task_id>`, and the outbox exposes `pending_group_keys`. The breaker counts only terminal result posts, not progress pings.
- #13: the keepalive doc claim is corrected.

**Open items (B).**
- `pyutils/document_processing.build_book_chapters_v3` naming is outside B's scope.
- `_result_backlog` counts all workers' rows of the shared `worker_result` kind.


### C. Speech / AI stack

**Engine core.** `pyutils/common/engine_registry.py`:
- `EngineAdapter(name, category)` reads its manifest `ModelEntry` and provides `probe()`, `available()` (boot mask included) and `status_row()`.
- `EngineRegistry` adds `available()`, `best()`, `priority()` and `panel()`.
- `build_engine_panel()` builds the one panel shape for TTS, STT, LLM and OCR: `{success, best, active, available_count, engines[{name, available, note, boot, priority, version?, ...domain fields}], ...extras}`. The shape was sent to F.
- `model_checks.dist_version()` replaces four `_dist_version` copies and three `_spec_available` copies.

**TTS (`pyutils/tts`).**
- `tts_engine.py` defines `TTSEngine`, `HttpServerEngine`, `IsolatedVenvServerEngine` and `SerializedModelEngine`. All 16 engines are subclasses with module instances; the registry calls methods, not `getattr`.
- `HttpServerEngine` has one base-URL rule (`{P}_URL`, else `{P}_HOST`/`{P}_PORT`) and one 30 s THREAD_BUS health cache over the manifest `health_paths`, which also drives `tts_service_manager`.
- `tts_http.py` holds one HTTP path on `http_client` and one error decoder.
- `ModelEntry` gained `packages`, `install_markers`, `secrets`, `staging_env` and `installer`, and is the only readiness source. `tts_engine_probe.py`, `tts_boot_checks.py` and `serialized_model_engine.py` are deleted.
- Splits: `tts_service_manager` → plus `tts_server_launch.py` and `tts_server_ownership.py`; `audio_queue_center` → plus `audio_queue_model.py`, `audio_queue_part1.py` and `audio_queue_persistence.py`.
- `batch_common` has `merged_http_batch` and `run_synthesize_words`. Its `ThreadPoolExecutor`, private reach-ins and `__main__` blocks are gone, as is the qwen `events.py` lock.
- `pyctl/capabilities.py` has no duplicate TTS view.

**TTS servers (`tts_install_assets/tts_server_common.py`).**
- It provides `resolve_device`, `encode_wav`/`encode_mp3`/`encode_audio`, `nvidia_smi_query`/`nvidia_smi_free_mb` (the one standalone VRAM reader), `add_lifecycle_routes` (`/health`, `/`, `/load`), `run_server`, `env_int`/`env_float` and `EngineImports`.
- With `EngineImports`, every server stays up when its engine import or load fails and reports `load_error` on `/health` and `/load`.
- The wire contract is unchanged.

**AI providers.**
- `ai_keys.PROVIDERS` declares `client` (`openai_compat` / `gemini` / `anthropic`), `base_url_default` and `compat`/`image_api` quirks.
- There is one `OpenAICompatClient` (on `http_client`), one `AnthropicClient`, one probe and one chat dispatch.
- Deleted: the groq, mistral, cerebras, nvidia, huggingface, zhipuai, github, cloudflare, spark, cohere, deepseek (`DeepSeekClient`) and openrouter packages, `gemini_manager.py`, `pyctl/ai/ai_compat_helpers.py`, and three openrouter `scripts/examples` files.

**AI state.**
- `pyutils/common/json_index_store.JsonIndexStore` (atomic saves, trim with blob cleanup, seed migration) backs the translate, image-search, speech, ai-image and usage histories, plus the hub history (`ai_hub_history.json`).
- `pyctl/ai/ai_state.ai_state_dir()` replaces three `_migrate_old_state` copies.
- `_record_probe` is the single probe record point; it writes both the usage ledger (`kind=probe`) and the hub history.

**STT / LLM / OCR.**
- STT engines are classes. `whisper_stt` and Azure STT are merged into `pyutils/stt`, which removes the cross-domain import; `pyutils/azure_speech` is deleted.
- One Whisper cache: `pyutils/common/whisper_models.py`.
- OCR moved onto `EngineRegistry`.
- LLM uses `http_client`, and its disabled reasons are coded and i18n'd (`model_server_not_running`, `model_server_unreachable`). The LLM status service moved to `pyctl/llm/status_service.py`.
- `ManagedServiceFacade` gained `settings_view`, `update_settings`, `server_action` and `managed_service_facades.for_category()`.
- Deleted: `paddle_ocr.py`, `ocr_processor.py`, `screenshot_processor.py`, `pyctl/stt/test_service.py`, `whisper_transcribe_runner.py`, `whisper_venv.py` and `media_processing/ffmpeg_ops.py`.

**pyctl/tts and audio_orchestration.**
- `pyctl/tts/lane_auto.LaneAutoConfig`, with the instances `word_audio_auto` and `sentence_audio_auto`, replaces `word_tts_auto.py` and `sentence_audio_auto.py` (both deleted).
- `heartbeat_enabled` is removed; `PcWordAudioPanel.tsx` and `PycoreQueueTypes.ts` are updated.
- 14 `audio_*`/`orch_*` endpoints were added to `config/queue_center_contract.json`. No Laravel path literals remain, and `_laravel_base` is deleted.
- Splits: `orch_service` → `orch_auth` + `orch_files`; `orch_generate` → `orch_plan` + `orch_assembly`; `laravel_audio_worker` → plus the `_engine` and `_reporting` mixins.
- B's worker_base API is adopted.
- `laravel_audio_delivery` marks "result endpoint unavailable" retries with `server_error` when the HTTP status is >= 500, which feeds the outbox breaker.

**Merge audit** (dates are `git log -1 605d08b25`, the pre-session history).

| merged-into | variants removed | newest-source | capabilities ported | dropped + why |
|---|---|---|---|---|
| `HttpServerEngine` health (one cache) | `tts_service_manager._http_healthy`; the 30 s caches in chattts, cosyvoice, f5tts, fishspeech and gptsovits | service_manager 10-01, fishspeech 10-01, others 09-27 | managed probe: (1 s, 2 s) timeouts, status <500, stop on an unreachable peer, otherwise try the next path; chattts `model_loaded` and qwen ok probes; per-engine availability rules: cosyvoice `/docs` then `/inference_sft`, f5tts 2xx + ok + synth_ready, fishspeech 2xx + non-empty body with a strict synth_ready; config checked uncached | none |
| `tts_http` on `http_client` | melotts/voxcpm2 `_post_bytes`/`_extract_error`, qwen `_error_message`, standalone `_json_error`, fishspeech `_parse_http_error` | 09-27 | one decoder (error/detail/message); RIFF-header WAV detection; mp3 conversion with tempo | fixed total upload timeouts (`MELOTTS_`/`VOXCPM2_HTTP_TIMEOUT_S`, 120/180/300 s): uploads are progress-driven |
| `ref_audio` / base URL | 3× `_ref_audio`; the `*_URL` and `*_HOST`+`*_PORT` conventions | 09-27 | same env semantics; both conventions accepted | none |
| `ModelEntry` readiness | `tts_engine_probe`, `tts_boot_checks` | 10-01 / 09-30 | every install rule and reason; per-engine reason order (melotts/voxcpm2 self-contained first, fishspeech exact order); deferred vs blocked (streamelements secret first, strict bark/parler block); one coded `tts_not_installed` reason ("Not installed - run {installer}") | the per-engine literal texts, replaced by the coded i18n reason |
| external-server-installed rule | n/a | service_manager 10-01 | restored to chattts only (`external_server_ok`) | an unintended generalisation to every server, reverted |
| `IsolatedVenvServerEngine.probe` | qwen/melotts/voxcpm2 `available()` | 09-27 | availability is the venv only, as before | none |
| `batch_common` | merged-wav copies in chattts/gptsovits batch, per-word fallback | 09-30 | per-word error catching; 4-worker parallel mp3 encode via `map_bus_tasks` | `ThreadPoolExecutor` (spec §5) |
| Azure TTS quota | `azure_speech_client` quota marking (deleted with `pyutils/azure_speech`) | 09-27 | mark on quota/exceed/usage limit/429 cancellations and clear on success; new `tts_quota_exhausted` reason (en/zh); availability respects the block | none |
| `audio_queue_center` split, `memory_gate` VRAM, `managed_service*` | none | 10-01 / 09-30 | methods moved verbatim; `memory_gate` was already the single reader; errors now narrow and reported | silent error swallowing (spec) |
| `OpenAICompatClient` + `PROVIDERS` quirks | groq, mistral, nvidia, cerebras, zhipuai, huggingface, github, cloudflare, spark, cohere, deepseek, old compat client | openrouter 09-30; others 09-18..09-20 | base-URL overrides (GITHUB_MODELS_BASE_URL, OPENAI_BASE_URL); GitHub Accept/X-GitHub-Api-Version headers; OpenRouter HTTP-Referer/X-Title headers; catalog URL/shape; gpt- filter; free-first ordering; static catalogs; HF whoami; Cloudflare envelope and missing-creds message; GitHub 401/403 hints; per-provider sampling defaults; OpenRouter aliases; reasoning-content fallback | DeepSeek SDK retries: the gateway already rotates keys, cools down and falls back, so retries would double-spend free quota |
| same (OpenRouter) | `openrouter_client.py`, `chat_session.py` | 09-30 | multi-key rotation, Referer/X-Title, free-model auto-pick, aliases, vision, image-modality chat | streaming and `ChatSession` callbacks: their only callers were the deleted example scripts; multi-turn chat is still available via `chat_once(messages)` |
| same (Cohere) | native v1 chat client | 09-20 | catalog via native `/v1/models` | native `chat_history` conversion: native v1 dropped system messages, and the Compatibility API keeps them |
| `AnthropicClient` | inline Anthropic code in `ai_chat`, `ai_probe` and `ai_gateway_vision` | 09-30 | models, messages, system, image blocks | none |
| `ai_probe` / `ai_chat` dispatch | ~12 `_probe_*`, ~13 `_chat_*`, `ai_compat_helpers` | 09-30 | all quirks above; catalog fallback | the catalog fallback no longer fires on 401/403, because a bad key showed as available |
| `JsonIndexStore` + `ai_state_dir` | 7× `_state_dir`/`_load`/`_save`/`_trim`, 3× `_migrate_old_state` | 09-22 | same file format; `.ai_state` and `ai_rate_usage.json` migrations; legacy fallback dir; blob trim | the rate-usage read-only fallback is now `AI_LEGACY_DIR` instead of the APP_DATA root (edge case) |
| hub history | `AiHubHistoryStore` | 10-01 | one-time seed; the section is dropped only after a successful write | an unread per-section revision counter |
| `stt/azure_provider` | `stt_orchestrator._transcribe_azure`, `azure_speech/stt_provider` | 09-30 | en→en-US / zh→zh-CN mapping; NoMatch returns ""; Canceled raises; the key is re-read on every call; quota mark/clear | none. The Azure TTS quota marking from `azure_speech_client` is assigned to C1 |
| `common/whisper_models` | orchestrator cache, `whisper_provider._model`, `subtitle_engine.load_faster_whisper`, `whisper_transcribe_runner`, `whisper_venv` | 09-30 | runtime device/compute keys; GPU→CPU int8 fallback; NVIDIA DLL dirs; fp16=False; VAD, SRT resume and word timestamps in `transcribe_to_srt_faster` | runner and venv had zero callers, and the in-process path is the newest. The provider's large/turbo pick predates the tier policy |
| `pyctl/stt/probe_service` | `test_service` (untracked, recovered from its .pyc) | 09-30 | similarity, recognized, bytes, tts_engine fields; word-profile sample; ffmpeg transcode; error result | the 0.6 similarity success threshold; the newest rule is a non-empty transcript |
| `ManagedServiceFacade` settings/actions | `pyctl/tts/status_service` and `pyutils/llm/status_service` handlers | 09-22 | every server_*/llm_* key; synth_timeout_s; edge_cooldown_s; enable/start/stop actions; per-engine cache invalidation | only the "Unknown engine" text changed |
| OCR `EngineRegistry` | `_ENGINE_SPECS`; paddle_ocr, ocr_processor, screenshot_processor | 09-30 | version, aliases, boot checks; EasyOCR readers cached per language set | the PaddleOCR stack: zero importers and not in the manifest |
| `media_processor` | `ffmpeg_ops` | n/a | every op was already present | zero importers |
| `lane_auto.LaneAutoConfig` | `word_tts_auto`, `sentence_audio_auto` | sentence 09-27 | concurrency key and recommendation; persisted concurrency + speaker restore; live apply; assist capability; lane activation; qwen warm-up; all status fields | `heartbeat_enabled` (legacy, per directive) |
| orch / worker splits | `orch_service`, `orch_generate`, `laravel_audio_worker` monoliths | 605d08b25 | AST-identical except narrowed excepts | 6 pass-through wrappers |
| `tts_server_common` | 5× `_resolve_device`, 2 VRAM readers, 4 encoders, 5 `main()` functions, per-server lifecycle routes | qwen3tts 10-01 | per-server env names, VRAM floor and GPU index; Windows/POSIX nvidia-smi paths; multi-GPU; PCM16 clip; health shapes; qwen bind/banner | none |

**Regressions found and fixed in the re-audit.**
- Usage `kind=probe` records are restored; the UI AiUsagePanel and the Laravel AiProbe read them.
- Provider sampling defaults, aliases, auth hints and the Cloudflare missing-creds message are restored.
- The hub migration order is fixed: the old section is dropped only after the write succeeds.
- `azure_provider` no longer triggers the SDK install at import.
- The `lane_auto` concurrency parse accepts the old `int()` inputs again.
- The `ValueError` catch in the qwen warm-up is restored.
- `accept_task` now uses `active_base_url()`.
- Fixed total timeouts are removed from body-carrying requests (orchestration login, sentence-words, LLM chat, image and Anthropic calls), which now use progress-driven transfers.
- voxcpm2 import failures are reported on `/health` again, and all servers now do this.
- The `sherpa` manifest import failure is fixed: `tts_engine` registers `tts_manifest` before it builds any engine.
- voxcpm2 rejects non-integer values for integer settings again.
- The "healthy external server counts as installed" rule is limited to chattts again.

**Shell-install audit** (spec §6). Python no longer downloads, installs or builds anything in C. New coded reasons name the shell step from `ModelEntry.installer`:
- `model_install_required` ("{model}: {item} missing - run {installer}")
- `tts_not_installed`
- `tts_model_weights_missing`

| finding | fix | missing shell step |
|---|---|---|
| gptsovits NLTK self-heal and torchcodec DLL copy at launch | they only check and report; missing data blocks the start and names the step | none (137/Step54 provision both) |
| bark/parler `from_pretrained(model_id)` | `local_files_only=True` | verify that 141/Step59 and 181/Step60 fetch the weights and the Bark speaker presets |
| voxcpm2 repo-id fallback in the launcher and the server | only the local dir; missing weights → no start + `tts_model_weights_missing` | Docker image has no weights step (no `model.sh`) |
| cosyvoice `--model_dir` repo id | requires `staging/pretrained_models/<name>` | 133/Step52 need a weights download |
| melotts/f5tts servers download weights on first load; g2p_en runs `nltk.download` | `tts_server_common` forces `HF_HUB_OFFLINE`/`TRANSFORMERS_OFFLINE`/`HF_DATASETS_OFFLINE` and refuses `nltk.download`; a `load_error` names the step | 139/Step55: MeloTTS + BERT weights, full NLTK set, no swallowed errors; 135/Step53: the F5-TTS checkpoint + vocos vocoder |
| qwen3tts/chattts server repo-id fallback | `resolve_local_weights`; `/health` pre-checks | none |
| `whisper_models` downloads | local snapshot / `.pt` only | none (151/Step11, 127/Step42) |
| `easyocr.Reader` downloads | `download_enabled=False` + presence gate | 125/Step46: detector/recognizer weights |
| CnOCR/CnSTD init downloads and pip installs | `cnocr_models_present()` gate; `module_present` before getters | no CnOCR/CnSTD weights step on either platform |
| Azure SDK, Windows OCR and Vosk getters could pip-install | `module_present()` checked first | Azure Speech SDK has no Windows step |
| installer texts ("auto-builds via ensure_venv", "let HF Hub download") | every entry names its real `Step*.ps1` / `*.sh` | none |
| D1 (pyfoundations): `init_third_party_cnocr`, `ensure_cnocr_models`/`ensure_cnstd_models`, `init_ocr_models_from_hf`, `hf_download_*`, the cnocr/windows_ocr/speechsdk getter installs, `_lazy_import` auto-install | not changed (outside C) | D1 to resolve |

The missing steps were sent to shell-linux-installs and shell-windows-installs.

**Docker.** `scripts/shells/docker_compose/tts/voxcpm2/Dockerfile` now copies `tts_server_common.py`. The voxcpm2 `compose.yml` mounts `pyfoundations` and `service_contract.json`, as melotts does. Open: voxcpm2 has no `model.sh`, and the melotts/voxcpm2 containers lack `sentence_segmenter.py` (this predates the session).

**Missing-model degradation.** Missing models never block pycore. This matches 605d08b25; no C path regressed to aborting.

Simulated offline with empty directories (`CORE_NODE_CACHE_DIR`, `HF_HOME`, `XDG_CACHE_HOME`, `WHISPER_CACHE_DIR`, `VOSK_MODEL_DIR`, `VOXCPM2_MODEL`, `QWEN3TTS_MODEL_DIR`) and `CUDA_VISIBLE_DEVICES=`:
- **Startup:** `import pycore.pycore_module_caller` succeeds, and `register_http_routes` registers 315 routes with no contract drift; no route registration depends on a model.
- **Panels:** missing engines show as unavailable with coded reasons that name the installer step (`tts_not_installed`, `tts_model_weights_missing`, `model_install_required`, `model_server_unreachable`, `model_platform_unsupported`). `ai_hub boot_service.verify_all()` returns ready/deferred/blocked verdicts for 58 entries and raises nothing.
- **Requests:**
  - TTS `synthesize_engine` returns False, and `tts_test` returns `{success: false, error}`.
  - OCR `ocr_test`/`extract_text` return the installer-named error.
  - LLM `chat` returns `{success: false, tried}`.
  - STT `transcribe` raises the typed `ManagedServiceUnavailable` (a `RuntimeError`), which every caller catches: `probe_service`, `audio_processor` and the worker STT handler.
- **Startup steps:** `model_boot`, `restore_word_audio`, `restore_sentence_audio` and the audio-lane boot chain run through `event_handlers._run_runtime_step`, which isolates failures. The runtime profile pins in a bus task (CPU mode without CUDA). `pylauncher/service_starters` has no model warm-up.
- **Model loading:** happens lazily on first use only (`whisper_models`, OCR readers, the TTS `SerializedModelEngine`, managed servers); a failure there is reported, not fatal.
- **Sent to foundations:**
  - module-level getters (`edge_tts`, `PIL`, `numpy`) must return None when an offline auto-install fails;
  - the installing getters (cnocr, windows_ocr, speechsdk, `_lazy_import`, HF CLI) must only check presence;
  - `CUDADetector` must never raise.

**Runtime-behaviour decisions** (user constraint: no runtime changes to model logic except the shell-install rule, missing-model degradation and progress-driven body requests; genuine bug fixes are kept). The baseline is 605d08b25.

| outcome | items |
|---|---|
| kept as structure | engine classes, registry and panels; `tts_http`; `ModelEntry` readiness; the `tts_service_manager`/`audio_queue_center` splits; IsolatedVenvServerEngine semantics (venv ready, 3 s `/health`); the `runtime_profile` instance; qwen events RunningFlag/Backoff (same 1-30 s doubling); one coded `tts_not_installed` reason (same conditions, deferred/blocked states unchanged; the text names the installer); batch encode with 4 workers in input order via `map_bus_tasks`; the one compat client, data-driven `PROVIDERS`, `AnthropicClient`, `JsonIndexStore`/`ai_state_dir`, hub history file + seed; one Whisper cache module, the OCR registry, the facade, the pyctl LLM status move; `lane_auto`, the orch/worker splits, contract endpoints (same URLs), `orch_store` atomic writes; `tts_server_common` helpers; coded LLM reasons (i18n) |
| fix kept (bug) | 401/403 no longer triggers catalog fallback (rejected keys showed as available); Cohere on the Compatibility API (native `chat_history` dropped system messages); probe listing errors surfaced (they were swallowed into "No models returned"); an empty assistant text is not success; Gemini probe junk error; Azure STT quota marking (Azure stayed available after quota ran out); Azure TTS quota marking (state was lost with the deleted client); worker `_NEEDS_WAV` (vosk/azure never got WAV); the Windows OCR `DataWriter` NameError; the subtitle `WhisperModel` NameError; swallowed errors in `memory_gate`/`managed_service*`/`model_load_status`/`engine_policy`/edge/batch are now reported (same catch and return values); `model_load_status` `__all__` listed an undefined `BROADCAST_EVENT`; sherpa manifest import order; voxcpm2 non-integer TIMESTEPS; `accept_task` used the stale `api_url`; chattts ignored an explicit `CHATTTS_DEVICE` such as `cuda:1`; fishspeech reported ready with a key but no SDK; `apply_gpu_memory_fraction` hid CUDA errors (now logged); chattts/qwen servers died on a startup load failure; an invalid `*_PORT` or blank host crashed or bound to ""; Windows nvidia-smi paths (chattts auto device fell back to CPU on Windows); capabilities reported non-TTS rows through a TTS engine with the same id |
| reverted to 605d08b25 | TTS health/availability probes (timeouts, paths, acceptance per engine); chattts config gate; per-engine audio writer rules; `is_model_loaded` defaults; sherpa/kokoro unload; bark/parler device and tier fallbacks; gtts/streamelements GET timeouts; narrowed excepts broadened back (with reports) in TTS, STT/OCR/LLM, pyctl/tts and orchestration; DeepSeek SDK-equivalent retries (2, jittered, no total deadline); per-provider error wording, list timeouts (30/20/15, OpenRouter auto-pick 15 s), reasoning fallback limited to OpenRouter, OpenAI fixed base URL for chat, image `n` scope, rate-usage fallback path, balance calls without retries; probe stream (ledger only, hub writers unchanged); faster-whisper GPU→CPU fallback only for video-extract; STT whisper direct cache load; whisper_provider large/turbo pick; EasyOCR default-set cache; probe_service extras; LLM health 1.8 s with trust_env (chat stays progress-driven); `audio_utils` 60 s download; lane concurrency `int()` parse; worker memory-wait loop; login/sentence-words `timeout=` (connect bound under body stall mode); qwen free VRAM = total - used; soundfile WAV for melotts/voxcpm2/qwen (byte-identical); voxcpm2/f5tts device not lowercased; VRAM floor env digits only |
| kept by rule | voxcpm2 has no repo-id start and cosyvoice requires its local model dir (shell-install rule: those paths downloaded). cosyvoice readiness checks the key files `cosyvoice2.yaml`, `llm.pt`, `flow.pt`, `hift.pt` (non-empty) and no longer just `is_dir()`. bark/parler load local files only; servers run with HF offline env; NLTK/DLL checks report only. Synthesis/chat/upload POSTs carry no total deadline |

`_laravel_base` stays deleted: the "not configured" early returns use `laravel_endpoint_manager.get_active_base_url()` (no network I/O).

Verification after the decisions:
- 194 C-scope modules import with 0 failures.
- The offline simulation still passes: routes register 315 with no drift, panels report missing models as unavailable with installer-named reasons, and boot gives 58 verdicts.
- `tts_install_assets` compiles.

**OpenRouter verification and free-only guard.** Checked against 605d08b25 with a code trace, offline tests and a repo-wide `git grep`. User decisions: keep 1000/day, and enforce free-only (a required change).
- **Pre-session behaviour.**
  - pycore preferred free models but never refused paid ones.
  - The "only free models" rule existed only in Laravel `app/Services/OpenRouterClient.php:278-314` (`isFreeModel`).
  - No 100/day OpenRouter cap existed anywhere.
- **Free-only guard (new; one place).** `pyutils/ai_cluster/openai_compat/openai_compat_client.py` has `is_free_model()` and `OpenAICompatClient.allows_model()`, enabled by `free_only: True` in `PROVIDERS["openrouter"]["compat"]`.
  - The rule mirrors Laravel `isFreeModel`: the id ends with `:free`, or prompt and completion pricing are both zero. `openrouter/free` is allowed, as Laravel does (its `free` alias).
  - Docs: https://openrouter.ai/docs/api-reference/limits and https://openrouter.ai/docs/guides/routing/routers/free-router.
- **Behaviour per path.**
  - Chat: `chat()` refuses a non-free id before any request with the coded `AI_PAID_MODEL_REFUSED` (non-retriable, provider not reached, en/zh locales); `chat_once` returns `error_code`/`error_params`.
  - Aliases: the paid aliases (gpt-4o, claude-*) are deleted; `free` → `openrouter/free`.
  - Auto-pick and catalog/probe: they use the free-filtered catalog with `openrouter/free` first.
  - Vision: `openrouter/free`, else the first free image-input model; the "first listed model" fallback is removed.
  - Image: there is no free image-output model (https://openrouter.ai/models?output_modalities=image&max_price=0). The runtime queries `?output_modalities=image` and uses a free model only if one exists; otherwise it returns `AI_FREE_IMAGE_MODEL_UNAVAILABLE`. The paid default image model is removed.
  - `free_text_*` is unchanged (`openrouter/free`).
- **Daily limit (unchanged).**
  - `rpm 20 / rpd 1000` in `ai_rate_limits._PROVIDER_LIMITS`.
  - Stored in `<AI state dir>/ai_rate_usage.json`, key `providers.openrouter.day["YYYY-MM-DD"]`, shared with the Laravel AiRateLimiter, reset at UTC midnight.
  - Only `chat_once` counts (a request that never reaches the provider, including a refusal, is released); there is a per-key budget in `ai_key_usage.json`.
  - The official limits are 50/day below 10 credits and 1000/day at 10 or more; the code keeps 1000, as the user confirmed.
- **Fix.** The `ai_state` migration order is restored: the old-shared-dir move runs before the APP_DATA legacy copy.
- **Offline tests** (temp state dir, faked HTTP):
  - paid `openai/gpt-4o` and the removed `gpt-4o` alias are refused with 0 POSTs and not counted;
  - a zero-priced id is allowed;
  - `free` → `openrouter/free`, and auto-pick chooses `openrouter/free`;
  - the listing shows only the free models;
  - image returns the coded unavailable reason with no POST;
  - the day counter persists across processes, and at 1000 the original message appears with no HTTP call;
  - migration counts are preserved.

**Production OCR route.**
- `ocr_orchestrator.ocr_recognize()` holds the shared OCR path; `ocr_test()` = `ocr_recognize()` plus its route tag.
- `pyctl/runtime/local_engine_service.recognize_ocr()` does not write probe history.
- Route `localOcrRecognize` (`local/ocr/recognize`, POST) was added by E; Laravel PycoreOCRUtil was switched to it by I.
- Fix: decoded images used one fixed temp file (`pycore_ocr_test/sample.png`), so concurrent calls could overwrite each other; they now get unique names.
- No relay policy is needed: Laravel calls it over direct HTTP. A added one and then removed it.

**Shared weight paths.** Every weight path resolves through `get_shared_download_cache_dir()` (`<C>`: D:\www\cache, /www/www/cache on dual-boot, /var/_core_node/cache on Linux-only) or the HF_HOME/HF_HUB_CACHE/TORCH_HOME exported by shell. There are no `~` or literal fallbacks.
- TTS staging: `<C>/pycore/<engine>`; cosyvoice `<C>/pycore/cosyvoice/pretrained_models/<leaf>`.
- kokoro `<C>/tts/kokoro`; sherpa `<C>/tts/sherpa`.
- melotts/f5tts weights are in the HF cache.
- faster-whisper: the HF hub cache.
- whisper: `WHISPER_CACHE_DIR`, else `<C>/whisper`.
- vosk: `<C>/stt/vosk`.
- EasyOCR: `EASYOCR_MODULE_PATH`, else `<C>/ocr/easyocr`, with weights in `.../model`.
- CnOCR/CnSTD: `<C>/ocr/cnocr`, `<C>/ocr/cnstd`.
- Ollama: `OLLAMA_MODELS`, else under `<C>`.
- The standalone servers read only launcher env (`*_MODEL`/`*_MODEL_DIR`, HF_HOME/HF_HUB_CACHE) and report missing weights instead of guessing a home dir.
- The launcher passes HF_HOME/HF_HUB_CACHE, and NLTK_DATA=`<C>/nltk_data` for melotts and gptsovits; the gptsovits NLTK check uses NLTK_DATA.
- shell-linux confirmed every Linux path, including sherpa (31_install_tts_offline.sh), kokoro and NLTK (137/139 write only to NLTK_DATA). shell-windows had not replied yet.

**Coordinator audit fixes.**
- **#7: imports never install.** `pyutils/tts/edge/client.py` resolves edge-tts on first use (`_edge_tts_module()`), and `ocr_windows_engine.py`/`ocr_cnocr_engine.py` resolve PIL/numpy inside their recognition methods. Importing the TTS registry and the OCR orchestrator no longer touches the edge-tts getter (verified: its package cache is empty after import). No other module-level `get_third_package_*` call remains in C scope. Outside C scope (D1/D2), these modules still call getters at import:
  - `pyutils/common/port_utils.py`, `zip_task_queue.py`, `clipboard_text.py`, `x11_display.py`
  - `session_dbus.py`, `browser_window_detector.py`, `xdg_desktop_portal.py`, `window_finder.py`
- **#12: reason codes, checked against 605d08b25.**
  - (1) Azure TTS without the SDK reported `tts_not_installed` in status and `PACKAGE_MISSING` at boot in the old code as well; the old azure `PACKAGE_MISSING` branch was unreachable. This is unchanged under the no-behaviour-change rule. It is pre-existing; aligning it is a separate decision.
  - (2) The `python310_not_registered` detail is restored: a missing base interpreter gives detail `python310_not_registered`, and an incompatible one gives "base interpreter incompatible".
  - (3) The memory-gate reason is restored to its old scope: sherpa and kokoro return before the memory-gate check, so the gate never applies to them.
- **#14: backoffs on `pyfoundations.backoff_wait.Backoff`.**
  - `ai_rate_limits` cooldown is `Backoff(30, 900).delay_for(failures)`: 30, 60, 120, 240, 480, 900, ... identical.
  - `laravel_audio_worker_engine._await_engine_memory` gets its delay from `Backoff(initial, max).next_delay()` with the old loop order unchanged: 5, 10, 20, 40, 60, ... identical.

**Load gate for resident models** (bug: qwen3tts lanes paused on "insufficient free RAM to load" while the model was already resident).
- **The fix (by main):** `TTSEngine.load_gate()` = `memory_gate_allows(name)`, or pass when `is_model_loaded()`. The headroom guards only a new load.
- **Review:**
  - It is a pure bug fix. Selection, priorities, fallbacks and reason codes are unchanged; a cold engine is gated exactly as before.
  - `is_model_loaded()` (server `/health` for venv servers, the owner flag for in-process models) is called only when the gate would deny.
  - Callers: `runtime_reason`, the orchestrator mask, the batch selfcheck, and `laravel_audio_worker_engine._await_engine_memory` (pause logged once through the shared `_memory_paused`; Backoff delays unchanged).
- **Same bug elsewhere:** `runtime_profile.engine_start_allowed` (used by the explicit UI per-engine test and the manual server start) still called `memory_gate_allows` directly. It now takes the engine's `load_gate` from the caller (`tts_orchestrator.synthesize_engine` and `tts_service_manager.start_server` pass `adapter.load_gate`). Passing it in avoids importing the TTS registry, so the `engine_policy` → `runtime_profile` import cycle stays closed.
- **Not affected:**
  - The `tts_server_launch` VRAM floors only run when a server is launched, which happens only when it is not running (so its model is not loaded).
  - STT, OCR and LLM have no memory gate (checked: no `memory_gate`/free-RAM/VRAM checks in those packages).
- **Verified:**
  - A simulated denying gate passes a resident qwen3tts (`load_gate` and `engine_start_allowed` → allowed) and denies a cold one with the same reason as before.
  - 195 C-scope modules import with 0 failures.
  - BOOT: routes register (322, no drift), the TTS/STT/OCR/LLM panels build, and `verify_all` gives 58 verdicts.
  - One earlier run hit transient import failures (an in-flight relay contract edit by A, and an IndentationError elsewhere); re-runs were clean.

**Load-gate audit fixes (#9-#12).**
- **#9: one load-gate entry.** `tts_engine_registry.load_gate(name)` returns the engine's `load_gate()`, or `memory_gate_allows(name)` for a name outside the registry. The orchestrator mask, `synthesize_engine`, `start_server` and the audio worker all use it. A pinned engine missing from the registry is now gated; before, it returned allowed.
- **#10: a paused lane wakes at once.** The memory wait now blocks on a per-lane wake signal (Backoff delay as the timeout) instead of `time.sleep`. An immediate `request_stop` and a registered shutdown handler fire the signal; the halt/shutdown check stays first in the loop. Verified: a halt ended the wait after 1.0 s.
- **#11: cached residency check.** `TTSEngine.resident()` caches `is_model_loaded()` for `TTS_AVAILABILITY_TTL_SECONDS` (30 s) on THREAD_BUS. It is cleared by `invalidate_availability()` (server start/stop through `tts_service_manager`) and by in-process `unload_model()`. Verified: 3 denied gates made 1 `/health` probe.
- **#12:** the `runtime_profile` docstring no longer says "(legacy behavior)". Its unused `memory_gate_allows` import was already removed.
- **Pause log per engine:** `engine_memory_pauses` (a THREAD_BUS state owner) replaces the per-worker `_memory_paused`. A pause and its recovery are logged once per engine, so one lane recovering no longer clears another engine's pause.
- **Verified:** 195 C-scope modules import with 0 failures. BOOT: 322 routes, the four panels, and 58 `verify_all` verdicts.

**AUDIT §3.2 leftovers (2026-10-02).**
- **TTS server helpers:** already consolidated (C3, see the merge audit). `tts_server_common.py` owns `resolve_device`, the encoders, `add_lifecycle_routes` and `run_server`. What remains per server is a one-line `_resolve_device()` that passes that engine's device rules as parameters (env name, `lowercase`, explicit set, VRAM floor, GPU index), plus engine-specific routes. No server imports pycore.
- **Demo block:** the `if __name__ == "__main__"` demo block in `pyutils/ocr_cluster/ocr_cnocr_engine.py` is removed. In the rest of C scope only real entry points keep one: `pyctl/tts/batch_selfcheck_main.py` (the `-m` entry run by pyservice) and the standalone `tts_install_assets` server/prefetch scripts.
- **Fixed:** `tts_install_assets/ocr_models_prefetch.py` no longer imports pycore. It source-loads `pyfoundations/third_party/_ocr_models.py` and `system_paths.py` through `tts_server_common.load_pycore_source`.
  - It restores the HF offline flags that `tts_server_common` forces on import, because this installer helper is the one place that downloads.
  - The CLI (`cn [--gpu]` / `easyocr`) and the Step46/125 call contract are unchanged.
  - Verified: the CnSTD/CnOCR roots, the per-language det/rec models and the shared cache dir are identical to the direct pycore import; the real `pycore.pyfoundations.third_party` package is never imported; `HF_HUB_OFFLINE` stays unset.
- **Verified:** `py_compile` passes for every `tts_install_assets` file; 195 C-scope modules import with 0 failures; BOOT: 323 routes, the four panels, and 58 `verify_all` verdicts.

**/dev/null incident.** A C1 sub-agent's `mv` replaced `/dev/null` with a regular file. The user repair is `rm /dev/null && mknod -m 666 /dev/null c 1 3`. The command was `mv pyctl/capabilities.py.tmp /dev/null`, run from `pycore/`. Its source was an untracked scratch copy that the edit script had just written, so no content was lost; the real `pyctl/capabilities.py` is intact. `/dev/null` is restored (character device 1,3).

**Verification.**
- `py_compile` passes on all touched files.
- After the re-audit, 194 C-scope modules import with 0 failures, including `pyctl.stt.*`.
- All `callmodule/rpc_routes` modules import except `local_agent_history_routes` and `register_http_routes`. Both fail on `agent_history_records.read_feed_items`, which belongs to D2, not C.
- The qwen3tts server source list follows E's `qwen3tts_events.py` move (`event_records.py` and `time_utils.py` added; `rpc/http/event_service.py` dropped).

**Open items.**
- D1: `BusSignals.TTS_*_AVAILABLE` are unused; `memory_gate` calls the private `CUDADetector._nvidia_smi_cmd()`; `ai_image_signers` needs a google-auth getter; `atomic_json_store.py` lost its CRLF endings; the HF/CnOCR runtime downloaders listed above.
- Two CnOCR engines remain (`pyapps/d3-check`).
- `scripts/pytools/aitools/qwen3tts_batch.py` has its own GPU snapshot.
- Some orchestration strings are not i18n'd; `orch_generate._generate` is still ~400 lines; `ai_key_rotation` still uses module state.

### D1. Foundations, database, launcher, thread pool

**Design.**
- **Layering.** `pythreadpool` holds the pool and the registry only. Starters moved to `pylauncher/service_starters.py`, which binds them through `registry.register_starter`. `pylauncher/launcher.py` imports that module, so the pyheartbeat <-> pythreadpool cycle is gone.
- **Heartbeat.** The forbidden `RLock` is replaced by `HeartbeatCallbackTable`, a serialized state owner exposed as the module instance `heartbeat_callbacks`. `initialize_heartbeat_system` and the `HeartbeatPusher` alias were removed; callers use `heartbeat_system`.
- **Tasks.** There is one `TaskStatus` in `pyfoundations/tasks.py` (pending, running, completed, failed, cancelled, skipped). It replaces `TaskState`, the desktop `TaskStatus` and the zip `TaskStatus`. The desktop "processing" status is now "running". `global_task_queue` replaces `get_global_task_queue()`.
- **Providers.** `pyfoundations/launch_providers.launch_providers` is one keyed registry, keyed by `SERVICE_LAUNCHER_PROVIDER`. `AppLauncher` moved to `pylauncher/app_launcher.py` and calls the `app_executable_launcher` instance directly, so the executable-launcher seam is no longer needed. `singleton_detectors.for_domain()` replaces `get_process_singleton_detector()`.
- **Paths.**
  - `pygvar` keeps one name per path: `PROJECT_ROOT`, `TMP_DIR`, `CACHE_DIR` (a Path, ensured) and `GLOBAL_VAR_DIR` (a Path).
  - Removed: the `ROOT_DIR`/`PYCORE_ROOT_DIR`/`CURRENT_DIR`, `USER_*`, `DEFAULT_TEMP_DIR`, `LOCAL_CORE_NODE_DIR`, `GLOBAL_VARS_DIR`, `DEFAULT_ZIP_THREADS` and `SYSTEM_*` aliases, the network-constant re-exports, and dead helpers.
  - `system_paths` dropped `APP_CACHE_DIR`, `CORE_NODE_ROOT` and `get_repo_root`, and absorbed the `app_config_path` functions.
  - Agent constants moved to `agent_paths.py` and disk/mount probing to `disk_mounts.py`. `system_paths.py` went from 1045 to about 500 lines.
- **Primitives.**
  - The SQLite repos (audio_resource, terminal_state, laravel_delivery, state) open through `open_wal_connection`.
  - `utc_now_iso` replaces the `_now_iso` copies in state_rpc, state_repository and revisioned_json_store.
  - `atomic_json_store` now writes through one exclusive, no-follow temp file, with `atomic_write_bytes`, `newline` and an explicit `owner` parameter. It is used by result_cache, flat_text_store, pyservice_mode, user_data_store and secret_manager.
- **Smaller fixes.**
  - `x11_display`: the `threading.local` cookie is replaced by the serialized `x11_connector`.
  - matrix `device_service`: moved from `EventBus` to `THREAD_BUS` events (`matrix.device.*`).
  - `codesync_boot.py` and `notebook_boot.py` moved to `pycore/bootstrap/`; pyservice.ps1, pyservice_entry.sh, notebook_runtime.sh and README were updated. codesync_boot now ends in `pyservice_cli.main(["config","codesync",...])`, as workstream E asked.
- **Database cleanup.**
  - `database/__init__.py` is a plain package marker.
  - Dead `TableKeys`/`TableNamespaces` constants were removed.
  - The `state_schema` pragma duplicates were removed.
  - `open_writable_db` now uses `connect_writable`.
  - okx `price_monitor` lost its dead `database_handler` code.
- **Bootstrap CLIs.** Shell-invoked CLIs now run through `pycore/bootstrap/` entries. The shell callers (`ncore_pycore_installer.*`, `tts_install_assets_common.sh`, `TtsCompatibilityCommon.ps1`, `PythonDependencyMapInstallCommon.ps1`, `pycore_package_policy_install.sh`, `175_laravel_main_start.sh`) were updated byte-preserving. The entries:
  - `package_policy.py`: stdlib prerequisite phase
  - `pg_sync.py`
  - `build_config.py`: `-m`
  - `runtime_policy.py`: `-m`

  The library modules expose `run_cli` / `main` without `__main__`, and the demo `__main__` blocks in `shortcut_manager` and `compute_caps` were removed. `python-multipart` was added to `DEPENDENCY_MAP` for the codesync host, which E asked for.
- **Requests from workstream C.**
  - `atomic_json_store.py` restored to CRLF.
  - Unused `BusSignals.TTS_*_AVAILABLE` removed.
  - `CUDADetector.nvidia_smi_cmd()` is now public; `memory_gate` and `_torch_cuda` were updated.
  - google-auth getters added: `get_third_package_google_oauth2_service_account`, `get_third_package_google_auth_transport_requests`, `GOOGLE_AUTH_AVAILABLE`, plus `OPTIONAL_PACKAGES` `google.auth`.
- **Sweeps.**
  - Demo `main()` / `__main__` blocks were stripped from file_lock, encyclopedia, color_print, thread_bus/bus, app_user_model_id and desktop_icon_generator.
  - `secret_manager`'s unused CLI was removed.
  - CLI stdout `print` became `ColorPrint.plain(file=sys.stdout)`.
  - The try/except sweep over scope cut handlers from about 350 to about 280.
  - Every remaining handler reports through ColorPrint, logs via `_log`, or returns the exception as an explicit error value.
  - Exception-driven control flow was replaced by `next(it, None)`, a `select()` accept loop, `find_spec` and up-front validation.

**Merge audit.**
Git dates are unusable because the auto-commit job collapses history, so the newest source is judged by behavior.

| merged-into | variants removed | newest-source | capabilities ported | dropped and why |
|---|---|---|---|---|
| `tasks.TaskStatus` | `TaskState`, `desktop/task_manager.TaskStatus`, `zip_task_queue.TaskStatus` | union | CANCELLED, SKIPPED; consumers updated (task_history, video_extract, audio worker, `PcRecentTasksPanel.tsx`) | "processing" renamed "running". Laravel `tts_status` "processing" is a separate protocol and was not touched. The UI "paused" check had no producer before or after. |
| `pylauncher/service_starters` | `pythreadpool/starters` | same file | headless gate kept through the new `third_party.PYSIDE6_AVAILABLE` (find_spec, no install) | the try/ImportError fallback (forbidden) |
| `launch_providers` | `service_launcher_provider`, `app_launcher` provider block | service seam | the unregistered-provider `RuntimeError` message is kept | executable seam: the direct import is a superset |
| `pygvar` / `system_paths` / `disk_mounts` / `agent_paths` | aliases listed above, `app_config_path` | system_paths | same resolved values on Windows and Linux (CACHE_DIR = data/cache, config = data/config, root = PROJECT_ROOT resolved) | `_fs_is_posix_capable` (dead; `map_web_path` honours the disk as-is) |
| `open_wal_connection` | 4 inline open sequences | sqlite_local | `synchronous=FULL` (terminal, delivery), `foreign_keys` and `isolation_level=None` (state), resolve and mkdir, `check_same_thread` as before | none |
| `HeartbeatCallbackTable` | `_CALLBACKS_STATE_LOCK` RLock and its read-modify-write sites | same logic | register/unregister/enable/disable, `claim_due` applying results, `skip_count`, `in_flight`, `last_error` | the lock (forbidden) |
| `atomic_json_store` | result_cache, flat_text_store, pyservice_mode, user_data_store, secret_manager writers | user_data_store (O_EXCL, O_NOFOLLOW, mode at create, fchown) | newline-verbatim, bytes, private owner; user_data corrupt-file backup and `_verify_private` kept | none |
| `time_utils.utc_now_iso` | `_now_iso` copies | time_utils | same ISO format | none |
| `singleton_detectors.for_domain` | `get_process_singleton_detector`, `detect_singleton` | same body | the refresh-callbacks reuse | `detect_singleton` (no callers) |
| `port_utils.find_port_pids` / `port_process_info` / `kill_process_using_port` | old `kill_process_using_port` (lsof only, any connection state, first PID only); D2's in-flight `_kill_pid_tree_*` / `_pid_alive` / `_wait_pid_exit`; `native_ui/step9_frontend/port_killer` and flutter `port_manager` variants (D2 migrates them) | D2's port_utils rewrite (10-01) | psutil discovery, then netstat (Windows), then ss, then lsof; LISTEN-only matching; every owner killed, not just the first; graceful-then-forced kill of the whole tree; taskkill /T fallback | matching non-listening sockets (it killed clients of the port). **Return value changed:** an already-free port now returns True (it returned False). Callers checked: flutter `port_manager.cleanup_old_server` (True means the port is clear, so it is correct when the port freed itself) and `ensure_ports_available` (ignores the result); nothing branches on False meaning "nothing to kill". |
| `process_manager.kill_process_tree` / `kill_process_by_pid` / `kill_process_by_name` | taskkill-only `kill_process_by_pid` / `kill_process_by_name`; the SIGTERM-to-SIGKILL loop in the old port_utils; D2's `_signal_pid_tree_unix` | merged | Windows and Linux; child tree; SIGTERM, 3 s wait, then SIGKILL; taskkill `[/T] [/F]` and os.kill fallbacks without psutil | none |

**Verification.** py_compile on every touched file. An import sweep over 199 scope modules passes, except `pylauncher/platform/windows_startup_runner.py`: it is a standalone script that reads `sys.argv[1]` at import, and I did not change it. Smoke runs: an atomic-write mode check (0600), StateRepository pragmas (foreign_keys=1, WAL, busy_timeout 30000, isolation None), an x11 connect on the live display, and `build_config_parser` CLI stdout.

**Regression fixed in the re-audit.** Moving the starters had made the `PySide6UIThread` import unconditional, and `framework.py` imports PySide6 directly, so a headless host would fail to start. Restored: a top-level import gated on `third_party.PYSIDE6_AVAILABLE` (find_spec, no install), and `start_ui` returns None in headless mode.

**Shell-install audit (spec section 6).**
- **Removed from Python:**
  - `_hf_helpers`: the HF downloads (`hf_download_file`, `hf_snapshot_to_dir`, `hf_download_zip_and_extract`, `hf_download_repo_latest`), the Hub collection/list calls, the HF CLI prerequisite install and the HF CLI PATH setup.
  - `_ocr_models`: the CnSTD/CnOCR repo and zip downloads (`ensure_cnstd_models`, `ensure_cnocr_models`, `init_ocr_models_from_hf`).
  - `_ocr_initializer`: no longer puts the HF CLI on PATH.
- **Replaced by presence checks** (`missing_ocr_models`, `report_ocr_models`, `ocr_model_dir_present`) that name `CNOCR_INSTALLER` (`Step46_InstallOcr.ps1 / 125_install_ocr.sh`). `cnocr_engine` and `ocr_cluster` reuse them.
- **`CUDADetector`** no longer raises on unreadable sysfs entries.
- **Kept unchanged** (pip self-install, user decision): `DEPENDENCY_MAP`, `_pip_runner`, `_lazy_import`, the installing getters (cnocr, huggingface_hub, speechsdk, edge-tts, windows_ocr), the `_torch_cuda` torch install, and the `compute_caps` ORT GPU install hook. The ORT hook goes through the injected pip runner and has no runtime injector today.
- **Still Python, run by shell installers:**
  - `pyutils/common/python_env/isolated_venv.ensure_venv` and the venv creation in `isolated_venv_runtime` build engine venvs. Callers are the Windows `TtsInstallAssetsCommon.ps1` and `Step56_InstallFishspeech.ps1`. The pycore runtime only calls `resolve_python` / `venv_ready`.
  - `pyutils/common/robust_downloader` (binary downloads). Callers are `pyutils/device/scrcpy_*` (D2), `pyutils/ensure_library/ffmpeg_installer` and pyapps/matrix.
- **Missing shell steps:**
  - CnSTD/CnOCR weights into `CNSTD_HOME` / `CNOCR_HOME`, in both `Step46_InstallOcr.ps1` and `125_install_ocr.sh`.
  - Native per-engine venv build on Windows, replacing the `isolated_venv.ensure_venv` delegation.
  - scrcpy-server and ffmpeg binary install steps for the `robust_downloader` callers.

**Pending deletion (needs user approval).** The list is in "Final pending-deletion list" under D1:
- the eight unreferenced files;
- the SQLAlchemy layer already deleted in e3cf19e10.

Imports of all of `pycore/database` and `pyapps/okx_price_monitor` pass.

**`get_*()` accessor sweep (2026-10-02).** This covers the module-level no-argument `def get_*()` functions in pycore, classified by AST.
- **Converted:**
  - pyfoundations, 1: `core_node_dirs.get_os_var_tag` (a lazy `global` memo) became the import-time constant `OS_VAR_TAG`. The PathMapper.php SYNC comment was updated.
  - pyutils, 3:
    - `ocr_cluster/cnocr_engine_registry` `get_cnocr_engine_default`, `get_cnocr_engine_by_model_key` and `ensure_cnocr_loaded_and_engines_initialized` became the keyed owner `cnocr_engines` (`for_model_key` / `default` / `ensure_loaded`). Its caller, the pyapps d3-check wrapper, was updated.
    - Two dead aliases were removed: `voc_annotator.get_yolo_data_root` (its d3-check caller now uses `YOLO_DATA_ROOT`) and `flutter_dev_tools/utils/path_utils.get_project_root`.
- **Allowed** (real computed queries or spec-mandated getters):
  - 127 `third_party` `get_third_package_*` lazy getters, which spec section 6 requires.
  - 86 computed queries:
    - pyfoundations: 44 (paths, machine id, system info, compute caps);
    - pyutils: 25 (clipboard, window ops, codesync status, ffmpeg path, ...);
    - pyctl: 16 (status/settings views);
    - pylauncher: 1 (tray cache snapshot).

    Each one reads env, files or bus state per call, or delegates a query to a module instance. None returns a shared singleton.
- **Remaining:** 1, `flutter_dev_tools/config/routes_config.get_routes_config` (`SerializedSingletonProvider`). The file is dead and pending deletion.

The import sweep and BOOT pass after the conversions.

**Open items.**
- `SerializedSingletonProvider` stays until D2 converts native_ui and flutter_dev_tools.
- The spec section 7 heartbeat registration module stays open, as the coordinator decided.
- `pylauncher/platform/windows_startup_runner.py` is a stdlib standalone script. It stays in place because existing Windows Startup shortcuts point at its path.
- `model_tiers` keeps a lazy `import ctranslate2`; no getter exists for it.
- Workstream C asked that getters return None when an offline pip self-install fails. That changes the pip mechanism, which the user decided to keep unchanged, so it is open.
- `translator/dictionary.py` still has its own SQLite open; it belongs to D2.

### D2. Desktop / UI / launcher / tool domains and pyctl apps

**File deletion was blocked.** The auto-mode classifier denied `rm` as irreversible, so no file was deleted. Every superseded or dead file is listed under "Final pending-deletion list -> D2".

**Layering**
- `pyutils/desktop` is dissolved:
  - `system_notification` and `toast_stack` -> `native_ui/step11_desktop/` (they need native_ui i18n). Shared state uses THREAD_BUS owners (`NotificationCopyRegistry`, `SerializedDeque`, `SerializedValue`). `Thread(target=)` became `NotifyActionMonitorThread` / `NotifyWithCopyThread`. "Click to copy" / "Copied" are now i18n keys.
  - `tk_taskbar` -> `pyutils/window/tk_taskbar.py` (one ctypes path).
  - `shortcut_manager`: its Linux `.desktop` writer, `delete_shortcut` and `list_shortcuts` are merged into `pyfoundations/shortcut_manager.py` (minimal edit, for D1 to note). `launcher/desktop_integration` uses that writer.
- `pyutils/translator/local_ai_translator` -> `pyctl/translation/` (it imported `pyutils.llm`).

**native_ui duplicates**
- `step1_config/tray_config.py` is the only owner of `TrayBackend`, `TrayMenuItem` (the signal-based model), `TrayConfig`, `create_default_tray_menu`, `create_window_tray_menu` and `tray_menu_from_dicts`. Removed: `platform_adapter.TrayBackend`, the tkinter `TrayMenuItem`, `PySide6TrayMenuItem`, three menu factories, `TrayBusKeys`, and the `app_config` alias. The PySide6, Win32, pystray and AppIndicator backends all render the same `TrayMenuItem`.
- Fixed: bus menu updates on pystray/Win32 never applied, because the signature was pre-set before `update_menu`.
- Removed the `WindowState` enums. `window_state.WindowState` -> `WindowGeometry` (`AtomicJsonStore`). d3-check migrated off the deprecated `UIConfig`.
- `get_platform_adapter()` -> `platform_adapter` instance with lazy detection. GTK/AppIndicator now come through a new `get_third_package_gi_appindicator` getter (D1 file).
- Fork sweep: `i18n`, `bus_manager`, `server_manager`, `timer_manager` and `port_ranges` are module instances. Fixed the TickTimer busy loop. `frontend_thread` uses `port_utils`. The startup selector is i18n.

**Other domains**
- launcher:
  - `app_finder` (1025 lines) split into `app_catalog` / `app_search` / `chrome_finder` / `text_editor_finder`; one `app_finder` instance.
  - menu split into `menu_input` / `menu_toggles`.
  - `launch_device_sync` stub removed; all prompts i18n.
- `agent_history_service` split into store / records / service.
- `terminal_state_repository` split into keys / window views / repository.
- `task_history` uses `time_utils` and `atomic_json_store`.
- `RuntimeConfig` rename dropped: `GlobalConfig` had no live consumer, so it goes to deletion.
- `flutter_dev_tools/port_manager` keeps only the flutter takeover; wait and kill go through `port_utils` / `process_manager`. `app_config` is a module instance.
- `process_output_capturer` -> `StreamDrainThread`.
- Translator has one `translation_cache`.
- Accessors became instances: `clipboard_history`, `global_hotkey_listener`, `scrcpy_initializer`, `scrcpy_server_managers.for_paths()`.
- `ADBManager.execute_shell` returns None on failure.
- Bugs that catch-alls were hiding are fixed: Fernet, docx `Document`, the OCR call, `QtWebEngineCore`, flutter route params, the `webbrowser` import, and the update_prompt id parsing.

**Sweep result (scope):** no `Thread(target=)`, locks, events, executors, `threading.local`, `queue.Queue` or Timer. No library `__main__` blocks. No `SerializedSingletonProvider` or singleton `get_*()` accessors outside to-delete files. 296 `try` blocks remain, all boundary handlers.

**Verification**
- AST compile is clean for `pycore/pyutils`, `pyctl`, `pylauncher`, `callmodule`, `pyfoundations`, `pyapps/matrix` and `pyapps/d3-check`. Fixed two pre-existing syntax errors: d3-check `coordinate_calibration_panel.py` and matrix `launcher_builder.py`. One remains in a dead `_obsolete_*` d3 file.
- Imports pass for every touched native_ui module (PySide6 ones with `QT_QPA_PLATFORM=offscreen`), plus `callmodule_main`, `pylauncher.service_starters`/`tray_menu`, launcher, agent_history, terminal and translator.
- Tray conversion smoke test: 13 pylauncher items -> TrayMenuItem / AppIndicator, translated.
- Windows-only code (Win32 tray, tk_taskbar, ops) is compile-checked only.

**Terminal image upload (pycore side)**
- Probe findings (send path): a message reaches the terminal as one clipboard paste followed by Enter (`TerminalWindowBackend.paste_and_submit`).
  - Windows: Windows Terminal gets Ctrl+Shift+V; a classic console gets the Edit > Paste command.
  - Linux: GNOME Shell bridge key combo; X11 PRIMARY when `paste_uses_primary_selection`.
  - Claude Code and Codex enable bracketed paste and attach a pasted local image path. So the attachment is plain text: one space, then the absolute path. It is double-quoted only when it contains whitespace. No newline, because the send path presses Enter once.
  - Native Windows CLIs accept backslash paths. A Windows terminal window running WSL (title is a distro name or a `user@host:~` prompt) gets `/mnt/<drive>/...`.
  - The rule lives in `pyutils/window/terminal_attachment.format_attachment_reference`.
- Store: `pyctl/terminal/terminal_image_store.py` (`terminal_image_store`).
  - Location: `<APP_DATA_DIR>/timg/<yyMMddHHmmss><4hex>.<ext>`.
  - Validation: magic bytes for png/jpg/gif/webp/bmp.
  - Limits: cap, retention count and age come from `config/pycore_relay_contract.json` limits `terminal_image_upload_bytes` (20 MiB), `terminal_image_retain_count` (200) and `terminal_image_retain_seconds` (7 d).
  - Writes go through `atomic_write_bytes`; old images are pruned on save.
- Service: `terminal_service.upload_image(upload, window_id="")`.
  - Returns `{success, path, display_path, name, bytes, mime}`, or `{success:false, error_code}`.
  - error_code: `terminal_image_missing|too_large|unsupported_type|read_failed|write_failed`.
  - Streams the upload in 1 MiB chunks with no total deadline.
  - Confirmed to E (route) and F (UI). Backend window lookup is now public: `TerminalWindowBackend.find_window`.

**Later items**
- `dictionary.py` reads stardict through `database/adapters/sqlite_readonly.query_rows`; the busy-retry and lookup behaviour is unchanged.
- `SerializedSingletonProvider`: no live users left in D2 scope. `flutter_dev_tools/config/routes_config.py` is dead and pending deletion.
- `is_port_available` / `find_available_port` / `wait_for_port` in `native_ui/step2_port_url/server_manager.py` were replaced by `port_utils.is_port_in_use` / `find_available_port` / `wait_for_port_bound`. The last two are new in port_utils.
- Shell-install rule (sub-agent):
  - ffmpeg: new `ensure_library/ffmpeg_presence.py` (resolve + report). `ffmpeg_installer.py` is superseded.
  - `device/scrcpy_init.py` and `scrcpy_server_manager.py` only resolve the shell-installed bundle (`get_shared_download_cache_dir()/scrcpy`). The GitHub download and `auto_download` are removed.
  - `frontend_thread` no longer runs `pnpm install`. `auto_install` / `frontend_auto_install` are removed from FrontendConfig, NativeUIConfig, native_launcher, callmodule_main, the matrix and okx mains, and okx config.
  - matrix `multimedia_check` and `initialization_manager` report the missing step and mark video unavailable.
  - New D1-area file `pyutils/common/prerequisite_steps.py` maps each prerequisite to its installer step.
  - Steps referenced: Linux `115_install_ffmpeg.sh`, `149_install_device_tools.sh`; Windows `Step21_InstallApplications.ps1`, `Step27_InstallAndroidPlatformTools.ps1`.
  - **Missing shell steps:** Windows scrcpy bundle (scrcpy.exe and scrcpy-server); per-app frontend `pnpm install` on both platforms.
  - `pyside6_checker.py` and `device/adb_manager.py` needed no change (diagnose only; no download).
  - Final resolution rule:
    - scrcpy, adb and scrcpy-server resolve from the `SCRCPY_HOME` env var. When it is unset, the location comes from the contract: `paths.drive_layout.cache_root.linux` + `scrcpy_bundle_dir.dir_name`, i.e. `/opt/core_node/cache/scrcpy`.
    - Present means the file exists and is non-empty. `get_system_cache_dir()/scrcpy` and the shared-cache guess are gone.
    - `SCRCPY_VERSION` (scrcpy_init and `ScrcpyServerManager`) reads `versions.scrcpy` from `config/service_contract.json`; the literals are gone.
    - ffmpeg is present when `shutil.which('ffmpeg')` and `shutil.which('ffprobe')` both resolve.
    - Steps: scrcpy Step68 / 149, ffmpeg Step67 / 115.
    - The Windows scrcpy step now exists (Step68). The per-app frontend `pnpm install` step is still missing.
  - Open: `pyapps/matrix/scripts/{monitor_server,verify_multi_device}.py` still hardcode `SCRCPY_VERSION = "3.3.3"` and `get_system_cache_dir()/scrcpy`. They are dev scripts, not runtime, and were not changed.
- Terminal upload verified in-process through E's `register_terminal_routes`: a 69-byte PNG sent as a Starlette UploadFile named "my long picture name.png" landed at `/www/core_node/data/timg/2610011132583902.png` (45 chars).
- Machine send service, final version on F's contract: `pyctl/desktop/machine_send_service.machine_send_service` with `send_file(upload, open_dir_after)`, `send_text(text, name)`, `send_clipboard(kind, text, upload)` and `clipboard_history(limit)` / `clipboard_history_delete(entry_id)` / `clipboard_history_clear()`.
  - Clipboard backups (ClipboardEntry) live in a `JsonIndexStore` (`<APP_DATA_DIR>/rcv/clipboard_history.json`, newest 100 entries).
  - kind=file puts the saved path on the clipboard as text; kind=image saves the file and returns `clipboard_image_unsupported`.
  - Error codes are `machine_send_*`.
  - It supersedes the earlier draft below (`machine_receive_service.py`, pending deletion once E rewires `machine_receive_routes.py`).
- Earlier draft, superseded: `pyctl/desktop/machine_receive_service.machine_receive_service`.
  - API:
    - `receive_files(uploads)` returns `{success, saved:[{name,path,bytes}], dir}`.
    - `receive_text(text)` returns `{success, path, bytes}`.
    - `set_clipboard(content="", upload=None)` returns `{success, previous:{type, formats, text?}}`.
    - error_codes: `machine_receive_*`, `clipboard_write_failed`, `clipboard_image_unsupported`.
  - Storage:
    - Files go to `<APP_DATA_DIR>/rcv/<yyMMdd>/` under sanitized original names (extension kept, `-xxxx` suffix on a collision).
    - Large files stream through the new `atomic_json_store.atomic_write_chunks` (minimal D1 edit).
    - Caps: relay contract limits `machine_send_file_bytes` (2 GiB, direct calls only; relay sends are capped by `request_body_bytes` = 64 MiB), `machine_send_files_per_request` (32), `machine_send_text_bytes` (10 MiB).
  - Opening:
    - The receive dir opens through `system_launcher.open_dir`.
    - Text opens through `system_launcher.open_file_with_notepad(path, editor)`: notepad.exe on Windows; on Linux the `text_editor_finder` default, then xdg-open, then known editors.
    - `system_launcher` now spawns openers detached instead of `run(timeout=5)`.
    - The duplicate `_open_dir` in `pyctl/tts/batch_selfcheck_main.py` now uses `open_dir`.
  - Clipboard:
    - New `clipboard_text.get_clipboard_kind()` (Win32 EnumClipboardFormats, xclip TARGETS, wl-paste --list-types) reports the previous type. Only text is restored or returned.
    - Clipboard images are not supported: the image is saved as a file and `clipboard_image_unsupported` is returned.
  - Notifications use `step11_desktop.system_notification` with new `receive.*` i18n keys (en/zh/ja).
  - Verified in-process with Starlette UploadFiles. Opener, notification and clipboard writes were stubbed. Test files remain in `/www/core_node/data/rcv/261001/`.
- `port_killer.py` has no importers left. Migrating it means deleting it, so it is on the deletion list. The native_ui `is_port_available` copies use D1's final port_utils.
- flutter_dev_tools is frozen by user decision. These files were touched earlier this session and nothing has changed there since:
  - `pyutils/flutter_dev_tools`:
    - `config/app_config.py`
    - `utils/{port_manager,comparison_manager,image_analyzer,placeholder_generator,design_structure_auto_expand,pageview_updater,path_utils}.py`
    - `api/{file_writer,file_tree,file_reader,app_checker,comparison_api,pageview_updater_api}.py`
    - `routes/*.py`
  - `pyctl/flutter_dev_tools/server.py`
  - `design_structure_auto_expand`'s root path is unchanged.

**Merge audit** (variants dated against pre-session `605d08b25`)

| merged-into | variants removed | newest-source | capabilities ported | capabilities dropped and why |
|---|---|---|---|---|
| `pyfoundations/shortcut_manager.ShortcutManager` | `pyutils/desktop/shortcut_manager.DesktopShortcutManager` (2026-07-31) | pyfoundations (2026-09-30): i18n names, BAT, AppUserModelID, idempotent .lnk, old-name cleanup | Linux `.desktop` writer (menu entry + desktop-folder copy, `Version`, `Path`, `Terminal`, `Categories`), `arguments` for .lnk and Exec, `update_shortcut` (Windows via DesktopIconGenerator; Linux rewrites the entry), `delete_shortcut` (.lnk; menu + desktop copies), `list_shortcuts`, `get_shortcut_info`, `batch_create_shortcuts`. PNG->ICO conversion was already in `DesktopIconGenerator.create_shortcut` | argparse CLI `main()` (one-off script, banned in library modules); dict-shaped return values (survivor returns paths/None, as its callers expect) |
| `pyutils/common/port_utils` | `native_ui/step9_frontend/port_killer` (2026-09-20), flutter `port_manager` port lookup and kill (2026-09-20) | port_killer (Windows netstat/taskkill, multi-PID) + flutter (psutil owner info) | Cross-platform `find_port_pids` (psutil; else netstat LISTENING on Windows; else `ss -ltnp`, then `lsof` on Linux); all PIDs, not just the first; process-tree kill (`taskkill /T` [/F]; SIGTERM -> grace -> SIGKILL over psutil children); zombie-aware exit wait; `port_process_info` (pid, name, cmdline) for flutter's our-server check; `find_available_port`, `wait_for_port_bound` | port_killer `is_port_available` via netstat (duplicate of bind-based `is_port_in_use`, which needs no external tool); flutter WMI cmdline lookup (psutil covers it) |
| `native_ui/step1_config/tray_config` (`TrayMenuItem`, `TrayBackend`, `TrayConfig`, menu factories, `tray_menu_from_dicts`) | tray_config text_key `TrayMenuItem` and `TrayBackend` (09-20), tkinter `TrayMenuItem` (newest, 09-30+), `PySide6TrayMenuItem` and 3 PySide6 menu factories (09-30), `platform_adapter.TrayBackend` (09-30), `build_tray_menu_items`, `build_pyside6_menu_from_dicts` | tkinter TrayMenuItem (i18n key text, text_args, state/enabled getters, checked) | Item icons (PySide6 renders `icon_name`); callback items (`tray_menu_from_dicts` registers a THREAD_BUS handler); `{"source": "tray_menu"}` payload in every backend; PySide6 window menu with show/hide/maximize/restart toggles and "Exit {app_name}" (new i18n key `tray.menu.exit_app`); canonical dict input for AppIndicator; `TrayBackend` PYSTRAY/PYSIDE6/APPINDICATOR/NONE | `TrayBackend.AUTO`/`TKINTER` (AUTO only fed the dead `select_tray_backend`; TKINTER = PYSTRAY); `to_dict`/`from_dict` (no callers; `tray_menu_to_dicts` is canonical); set_language checked-state logic in `build_tray_menu_items` (only served the deleted `pyapps/mcp` signal format; pylauncher menus use `state_getter`); non-i18n PySide6 menu (superseded by the i18n one) |
| `window_state.WindowGeometry` | `step1_config/config.WindowState`, `pyside6/config.WindowState` enums (06-07/07-29) | `window_state` (09-21) | atomic write; reports load/save failures instead of raising | the enums (no readers); `clear_state` / `get_state_file_path` (no callers) |
| `native_ui/step11_desktop` notification + toast | `pyutils/desktop/system_notification` (09-30), `toast_stack` (09-27) | same code, moved | every backend (gdbus with copy action, notify-send, Windows tray event, toast fallback), click-to-copy, card stack and caps; the shutdown stop now comes from the tk pump checking shutdown | none |
| `window/tk_taskbar` | `pyutils/desktop/tk_taskbar` (09-22) | same | ctypes path (style swap, owner reset, frame refresh), AppUserModelID | the pywin32 path: it ran the same three Win32 calls as the ctypes path, so it was redundant |
| `platform_adapter` instance | `get_platform_adapter` + SerializedSingletonProvider | same file (09-30) | every method that has a caller; lazy detection | `select_tray_backend`, `adapt_config`, `get_platform_info`, `set/get_windows_appusermodelid`, module convenience functions (zero callers; the framework sets AUMID itself) |
| `translator/translation_cache` | `GoogleTranslatorCache` + `clear_cache` (10-01, pre-refactor) | same | same key (md5 of `text:src:dest`), same `pycore_db/translator_cache/<src>_to_<dest>` layout and payload, so existing cache files stay valid; per-pair and global clear; atomic write | none |
| `editor_launcher` -> `app_search.find_linux_app` | `_LINUX_BINARIES` table | app_catalog (superset of binaries) | unknown-app PATH fallback (`shutil.which(app_name)`) restored during the re-audit | none |
| RuntimeConfig | not merged | n/a | n/a | `pyctl/runtime/global_config.GlobalConfig` has no live consumer; it is on the deletion list instead of being renamed |

Regressions found and fixed in the re-audit:
- **port_utils:** the kill was lsof-only and killed only the first PID. The Windows netstat/taskkill path, multi-PID and tree kill are restored.
- **flutter port_manager:** its Windows branch is back on the cross-platform kill.
- **ShortcutManager:** update, info, batch, `arguments` and the desktop-folder copy were missing and are now ported.
- **PySide6 tray:** item icons, the "Exit {app_name}" item and the show/hide toggle were lost and are restored.
- **Tray events:** the `source` payload was missing from every backend and is restored.
- **editor_launcher:** the unknown-app fallback is restored.

**Open items**
- `video_pipeline.py` hardcodes a Laravel route and a versioned contract id (`agent-history-video-v1`); now G's scope.
- `third_party` is missing getters for `cryptography.fernet`, `selenium.webdriver` and `PySide6.QtWebEngineCore` (worked around with importlib). `process_manager.kill_process_by_pid` is taskkill-only (D1); port kills no longer depend on it.
- `flutter_dev_tools/design_structure_auto_expand` resolves its root to `pycore/`, so auto-expand is a no-op. Fixing the path would enable a destructive `cleanup_deprecated_files()`; this needs a user decision.
- `window/ops.py` still has module-level wrapper functions; `startup_ui_builder` calls the private `i18n._detect_system_language()`.

### E. RPC, events, codesync, callmodule

**Event journal: one journal, one view (`/api/ws`).**
- There is one process journal: `pyfoundations/event_journal.event_journal` (THREAD_BUS-owned). It is built on the stdlib-only `pyfoundations/event_records` (`EventRecordJournal`, `poll_journal`, `journal_state`).
- Publish API, callable from any thread: `publish_topic`, `publish_log`, `add_tap`/`remove_tap`.
- The event loop never waits on the journal owner. The views use the `*_async` journal methods (snapshot, add/discard waiter, acknowledge, allocate_client_id). The THREAD_BUS journal runs them via `await_bus_task`; the plain qwen journal runs them inline.
- `/api/info` reads the seq off the loop.
- Audit #14: `rpc/http/event_service.py` no longer duplicates `poll_journal`/`journal_state` (it imports them) and stays on the pending-deletion list.
- The pycore RPC server serves it only through `/api/ws` (`rpc/http/ws_event_service`). SSE `/api/events`, `/api/events/poll` and `/api/events/ack` are gone, and `rpc/http/event_service.py` is unreferenced (pending deletion).
- The qwen subprocess has its own standalone `tts_install_assets/qwen3tts_events.py` (journal plus `/queue/events/poll|ack` long-poll for pycore's qwen client, no SSE). It path-loads `event_records`.
- Callers of the deleted `rpc/delivery.py` and `HttpServer.broadcast_event[_sync]` in pyctl, pyapps and relay now publish to the journal.
- Operation events: one `publish_operation_event` and one `operation_audience`; no injected publisher.

**Code Sync.**
- One route table: `callmodule/rpc_routes/code_sync_routes.py`, served by full pycore and by the codesync-only host (`pyservice_cli config codesync run`).
- DEV->CLIENT frames are request/response: the CLIENT handles each frame synchronously and returns the reply in the same signed POST response (`frame_transport.py`).
- The reply is therefore delivered exactly once, to the sender only, under the same K3 auth, with no reply cursor to resume. Keepalive is the existing ping/pong frame every push tick. No event channel is needed, so no codesync traffic reaches the journal.
- `RunningFlag` (appended to `serialized_worker.py`) is the start/stop lifecycle for the mesh, push sender, watcher and manager.

**Route contract.**
- `config/pycore_rpc_contract.json` is the single source. `pyfoundations/rpc_route_contract.py` (stdlib-only, moved down from `pyutils/common`) loads it.
- `network_constants` derives `HTTP_API_PREFIX` and `HTTP_{CLIENT_ID,STATUS,INFO,ROUTES,WS}_PATH` from `api_prefix` and `protocol_routes` (now including `ws`); no literals remain. Names and values are unchanged, so callers are untouched.
- `HTTP_EVENTS_PATH` was removed from `network_constants` and `http_sse`. Its last importer was the dead, unreferenced `pyutils/launcher/device_sync` package, already on the pending-deletion list; its `routes.py` now uses its own `/api/events`.
- `route_names`, `codesync/routes` and `register_http_routes` import the pyfoundations reader.
- The qwen code-identity list includes `rpc_route_contract.py`. A standalone path-load of `network_constants` was verified.
- The old `pyutils/common/rpc_route_contract.py` is unreferenced (pending deletion).
- `route_names.py` (292 route constants) and `codesync/routes.py` RPC_* derive every path from it; no path literals remain.
- `register_http_routes` fails startup (RuntimeError) on any drift: a contract route without a handler, a handler without a contract entry, or a method mismatch. Drift is zero.
- `media/enrich`, `video_extract/backend_media_list` and `video_extract/backend_media_detail` are dead. Their handlers were deliberately removed in d6771c66f (2026-08-04); only the constants survived. They were removed from the contract and from `route_names.py`; no UI caller existed (the UI's `mediaEnrich` is a Laravel route). `pyctl/laravel/media_service.enrich` is left without a caller (B).
- `tailnetPeers` was added to the JSON.
- RPC idempotency: `RpcExecutionKernel.dispatch` (local HTTP and relay) runs a call carrying `client_task_id` once per route through the one implementation, C's `pyutils/common/idempotent_jobs.IdempotentJobs`.
  - The table is `rpc_jobs`, keyed `route|id` via the new `job_key` argument.
  - Concurrent repeats attach; later repeats replay a cached success with `idempotent_replay`. Failures are not cached.
  - TTL 10 min, at most 512 entries, 900 s attach timeout.
  - Non-dict results now pass through.
  - E's interim `pyutils/rpc/idempotency.py` is unreferenced (pending deletion). C is removing its per-service tables.
- `localOcrRecognize` (POST `local/ocr/recognize`) was added for C.
- Machine send: six routes `ui/machine_send/{file,text,clipboard,clipboard_history,clipboard_history_delete,clipboard_history_clear}`.
  - Keys are `machineSend*`, registered in `machine_send_routes.py` against D2's `machine_send_service`.
  - Relay profiles: `machine_upload` (multipart) for file, `machine_clipboard` (`json-or-multipart-form`, now accepted by `_validate_relay_payload`) for clipboard, `general_action` for the rest. All are `at_most_once_action`.
  - `planned_routes` was removed from the contract.
- Multipart has one parser: `RpcExecutionKernel.decode_multipart_params` (Starlette `MultiPartParser`, exposed by the fastapi getter). It serves the local HTTP path (`request.stream()`) and relay execution (buffered relay body, payload profile `multipart-form` accepted in `_validate_relay_payload`). Forms are closed after dispatch.
- Verified offline: the HTTP and relay requests reach the terminal handler with the same UploadFile + `window_id`.

**Terminal image upload.**
- `ui/terminal/image/upload` (contract key `terminalImageUpload`) is a multipart POST. RPC dispatch streams multipart bodies into spooled parts with no total deadline.
- The handler passes the `file` UploadFile and `window_id` to `terminal_service.upload_image(upload, window_id)`; implemented by D2 (20 MiB cap, error codes). Verified end to end in-process: a PNG is saved; text and missing file are rejected.
- Auth middleware semantics are unchanged.

**CLI and entry.**
- One CLI: `pycore/pyservice_cli.py`. The shells and `bootstrap/codesync_boot.py` call it.
- One service entry: `pycore_module_caller.py`.
- The launcher-config builder moved to `pyctl/runtime/launcher_composition.py`, and the terminal parameter helpers to `pyctl/terminal/terminal_rpc.py`.

**Merge audit.** Dates are pre-session (`git log -1 --format=%ad 605d08b25 -- <path>`).

| merged-into | variants removed | newest-source (git date) | capabilities ported | dropped + why |
|---|---|---|---|---|
| `pyfoundations/event_journal` + `event_records` | `rpc_v2/delivery.py` (10-01), `rpc_v2/http/event_service.SseEventJournal` (10-01), `codesync/sse_transport` broker + `sse_receiver` (09-20), `operation_event_service` publisher injection (09-20) | event_service/delivery (10-01) | count/age retention; replay cursor; replay_lost/cursor_ahead; ACK state; audience filter (`*` / `client:<id>`); client-id allocation; taps on the publisher thread; console-log sink; event_id; operation audience and outbox payload; broker's connected-session count (now `push_receiver.get_status`) | pre-bind buffer (the journal exists from import); per-server bindings (one journal); broker 409 "session not connected" and reply queue (replies travel in the frame response) |
| `/api/ws` (`ws_event_service`, 10-01) | SSE stream `/api/events`, `/api/events/poll`, `/api/events/ack` (10-01) | 10-01 | cursor resume (`hello.since_seq`); replay window (same journal); keepalive (uvicorn ping 20 s + op ping/pong); audience (`hello.client_id`); topic filter (`subscribe`); ACK op; batching backpressure (`WS_EVENT_BATCH_MAX`); K7/K3 auth (middleware gates websocket scopes); state frames incl. replay_lost/cursor_ahead | SSE and long-poll transports (user directive: WS only); UI WS->SSE fallback (removed by F) |
| `tts_install_assets/qwen3tts_events.py` | qwen's path-load of `rpc/http/event_service.HttpEventService` | 10-01 | journal, `/queue/events/poll`, `/queue/events/ack`, `publish_event`, `events.instance_id` | SSE stream route (unused by the qwen client) |
| `callmodule/rpc_routes/code_sync_routes.py` | `codesync/http_server.py` (09-27), `codesync/daemon.py` (07-31), the old FastAPI table (10-01) | 10-01 | all 45 constants of the old `routes.py` (the brief's "48" does not match the file), see the per-constant table below; daemon: light flag, light-client root JSON, SIGINT/SIGTERM shutdown, the role log line | daemon legacy `--reload`/`CODESYNC_RELOAD` notice (documented no-op) |
| `codesync/frame_transport.py` | `codesync/http_client.py` (09-27) | 09-27 | signed frame POST, session id, frame_id, sender_id, ping/pong heartbeat, 900 s frame timeout, connection errors -> retry | separate SSE reply stream and its 30 s read timeout (the reply is in the response) |
| direct pyfoundations calls + `codesync/{paths,peer_http,events,legacy_json}` | `codesync/runtime.py` hooks (09-30) | 09-30 | machine_id/hardware id, core root and cache paths, peer baseline/override files, CODESYNC_LIGHT, shutdown handlers (THREAD_BUS), signed peer request (K3 over exact body bytes), emit -> journal + THREAD_BUS, LAN IP (`net_probe`) | `configure()` hooks (no caller passed them); `_ThreadBusProxy` (one bus); `LocalShutdownRegistry` (THREAD_BUS has one); per-thread HTTP cleanup (HttpClient has no per-thread connections) |
| (removed, dead) | `codesync/client.py` (09-27), `server.py` (09-20), `server_connection.py` (09-27), `sync_logger.py` (09-20) | — | — | pull mode: `CodeSyncClient.start()` has no caller at 605d08b25, so no node ever pulled; the server only served those pulls |
| `pyfoundations/serialized_worker.RunningFlag` | per-module `_running` + `*_running_signal` copies in `peer_mesh` (09-27), `push_sender` (09-20), `watcher` (09-20), `client` (09-27), `sse_receiver` (09-20) | peer_mesh 09-27 | atomic start (false if already running), stop, `is_running`, shutdown-aware `active()`, interruptible `wait()` (replaces the 0.5 s sleep loops) | thread join on stop (the loops exit on the next wake) |
| `pycore/pyservice_cli.py` | `pyctl/pyservice_cli/__main__.py` (09-20), `codesync/cli.py` (09-20) | both 09-20 | `config system get --key`, `config system set --key --value --json`; `codesync run --host --port --light`; `show`; `role [dev\|client]`; `peers list\|add\|remove\|update --name --host --peer-port --role --id`; `distribute on\|off`; `skip-update on\|off`; `--port` on every leaf; HTTP-first with file fallback; identical offline snapshot | `run --reload` (hidden no-op; units written by `codesync_service.sh` omit it, an old unit that still passes it needs a reinstall); hardcoded `/code-sync/*` and `/api/local/user-data/system-settings` paths (absent on full pycore; now contract RPC routes) |
| `pycore/pycore_module_caller.py` | `callmodule/__main__.py` (09-20), `callmodule/callmodule_main.py` (10-01), `scripts/pycore/run_callmodule_service.py` (10-01) | 10-01 | `--host --port --debug` (all three entries); `--no-reload`, the PYCORE_NO_RELOAD/PYCORE_RELOAD env; `--service-mode`; `--tts-selfcheck`; exit 3 on supersede; restart re-exec; the translation routes (part of the full table) | `--reload` (no-op, both entries); `--tray` (called the nonexistent `launch_windows_tray`); `--service` (parsed, never read); the `callmodule_main` native-UI composition (no script invokes it); the 0.0.0.0 translation-only server (bypasses the K7 bind rule) |
| `pyfoundations/atomic_json_store.atomic_write_bytes` | `codesync/file_operations.atomic_write_bytes` (09-20) | atomic_json_store (D1, 10-01) | `preserve_mode`, `allow_fallback` (in-place write on PermissionError), temp cleanup on failure (now in `_write_replace` for all writers) | separate `.codesync-tmp` naming (the shared temp naming is used) |
| `pyctl/runtime/launcher_composition.py` | `callmodule/config.py` (10-01) | 10-01 | launcher/ui/tray service config, window sizing, saved language, AI handlers, Code Sync boot, laravel_http and queue_bump bridges | swallow-all try blocks (failures surface); tkinter/ctypes screen probe (duplicate of `system_info.get_screen_resolution`) |

Per-constant proof for `codesync/routes.py` at 605d08b25 (45 constants). Each maps to a contract RPC route or a `/code-sync` path in the merged table, or is dead:
- Panel: ROOT_PATH, FAVICON_PATH -> host root and favicon (codesync-only host; light client gets the JSON). BASE_PATH, ASSETS_PATH_PREFIX, ROUTES_PATH, PANEL_API_ROUTES -> `/code-sync/`, assets, routes.
- Peer protocol: PEER_STATUS_PATH, PEER_CONFIG_PATH, PEER_HEARTBEAT_PATH, FILE_TREE_PATH, EVENTS_FRAME_PATH -> same paths.
- Workspace: WORKSPACE_PATH, WORKSPACE_FILES_PATH, WORKSPACE_FILE_PATH (GET/PUT), WORKSPACE_DOCUMENTS_PATH, WORKSPACE_LATEST_DOCUMENT_PATH -> same paths.
- RPC routes: PING_PATH and UI_PING_PATH -> `codeSyncPing`. STATUS_PATH -> `codeSyncGetStatus`. PEERS_PATH, PEERS_ADD_PATH, PEERS_REMOVE_PATH, PEERS_UPDATE_PATH -> `codeSyncGetPeers`/`AddPeer`/`RemovePeer`/`UpdatePeer`. SETTINGS_PATH (GET/POST), SETTINGS_RESET_PATH -> `codeSyncGetSyncSettings`/`SetSyncSettings`/`ResetSyncSettings`. LOGS_PATH -> `codeSyncGetSyncLogs`. PEER_FILE_TREE_PATH -> `codeSyncGetPeerFileTree`. ROLE_PATH -> `codeSyncSetRole`. DISTRIBUTE_PATH -> `codeSyncSetDistribute`. SKIP_UPDATE_PATH -> `codeSyncSetSkipUpdate`. DISCOVER_PATH -> `codeSyncDiscover`. APPLY_PENDING_UPDATE_PATH, CLEAR_PENDING_UPDATE_PATH -> `codeSyncApplyPendingUpdate`/`ClearPendingUpdate`. SERVICE_STATUS_PATH, SERVICE_RESTART_PATH, SERVICE_REINSTALL_PATH -> `codeSyncServiceStatus`/`Restart`/`Reinstall`.
- Replaced: EVENTS_PATH (SSE reply stream) -> the reply is in the frame response.
- Dead (pull mode, never started): REGISTER_PATH, INITIAL_SYNC_PATH, CHANGES_PATH, DOWNLOAD_PATH, TOGGLE_BACKUP_PATH.
- Dead aliases: SET_SERVER_PATH, SET_CLIENT_PATH, STOP_PATH = set_role(dev/client) / set_distribute(false), which exist as RPC routes.

**Verification.**
- py_compile and import checks.
- In-process TestClient:
  - `/api/events` returns 404
  - WS hello -> state + replay, ping -> pong
  - frame POST returns its reply
  - panel, root, favicon
  - multipart upload reaches the terminal handler with `file` + `window_id` (stub service)
- The qwen events module runs standalone (path-loads only stdlib pyfoundations leaves).
- Boot contract-drift report.
- CLI offline paths.
- Not done: no services started, no tsc run.

**Open items (E).**
- Pending deletion (classifier-blocked; all unreferenced): `callmodule/__main__.py`, `callmodule/callmodule_main.py`, `callmodule/config.py`, `pyctl/pyservice_cli/`, `scripts/pycore/run_callmodule_service.py`, `rpc/module_loader.py`, `rpc/http/event_service.py`, `rpc/idempotency.py`, `callmodule/rpc_routes/machine_receive_routes.py`, `pyctl/desktop/machine_receive_service.py` (superseded by machine_send), `pyutils/common/rpc_route_contract.py` (moved to pyfoundations), and `pyctl/runtime/module_call_{service,models}.py`.
- All Code Sync peers must run this version.
- The codesync-only host needs fastapi/uvicorn and python-multipart (all registered in third_party and auto-installed).
- Spec §3 places the event journal in `pyutils/rpc`. It lives in pyfoundations because common and codesync publish to it; rpc owns the WS view.

### F. UI <-> pycore API alignment

**Design.** All UI traffic to pycore goes through `poly_apps/pycore_laravel_wordnew_ui/core/integrations/pycore/`:
- Routes: `config/pycore_rpc_contract.json` (`{api_prefix, routes: {<camelKey>: {path, method}}}`; key = path segments without `ui`, camelCase; POST except `ui/terminal/content`, `ui/terminal/screenshot`, `ui/audio_orch/resource/file` = GET). E made callmodule derive its paths from it. `PycoreHttpRoutes.ts` derives `PYCORE_HTTP_ROUTES`, `pycoreRouteMethod` and `isPycoreRouteServed` from it, so a removed or renamed route fails `tsc` (build-time drift detection). `requestPycoreHttp` picks GET or POST from the contract.
- Requests: `PycoreHttp.ts` is only the request controller (one `tracedRequest` helper behind JSON, text, binary, binary-POST and multipart calls).
- Events: `PycoreEventClient.ts` is the one subscription over the event journal. WebSocket only (`/api/ws`, direct and proxy targets; no EventSource, no SSE fallback), relay tunnel in relay mode, one persisted cursor, reconnect backoff, ping keepalive. One tab per browser runs the socket (Web Locks leader `pycore-events:<scope>`); other tabs replay its pushes over a BroadcastChannel and announce their topics so the leader subscribes to the union. A suspended leader releases the lock; without Web Locks every tab is its own leader.
- Live stores: `PycoreLiveSource.ts` is the shared lifecycle (refcount, topic pushes, reconcile on restart or replay loss, optional visibility-aware fallback poll).
- Console log: `PycoreConsoleLogStore` holds the `pycore_log` topic only while a log view is mounted (`usePcLogs()`), no longer app-wide.
- Uploads: `core/network/ProgressUpload.ts` is the one upload path: XHR, no total deadline, aborts only after `config/queue_center_contract.json` `http_transfer.idle_timeout_seconds` (30 s) without progress.
- Engine panels: `PycoreSpeechTypes.ts` has one `EngineRow` / `EnginePanel<Row>` that `OcrStatus`, `SttStatus`, `LlmStatus` and `TtsStatus` extend (C's `build_engine_panel` shape). Added: OCR `active`, LLM `disabled_reason_code/params`. `heartbeat_enabled` is gone; the UI reads `processor_enabled` only (worker labels `workerOnline/Offline`).

**Merge audit.** Newest-source dates are `git log -1 --format=%ad 605d08b25 -- <path>` (pre-session state, not the auto-commit date).

| merged-into | variants removed | newest-source (git date) | capabilities ported | dropped + why |
|---|---|---|---|---|
| `requestPycoreHttp` (method from contract) + `tracedRequest` | `requestPycoreHttpGet`; 4 copy-pasted trace blocks (text, binary, binary-POST, JSON) | `PycoreHttp.ts` (2026-10-01 19:39) | GET query params; status/error/timing debug records for every call shape | none (GET calls are now traced too) |
| `createPycoreLiveSource` (`PycoreLiveSource.ts`) | 7 store copies of retain/release + restart/replay-lost reconcile + fallback poll: AiHubCatalog, ModelLive, AudioLaneState, AgentHistoryRuntime, AgentHistoryVideoRuntime, LlmStatusRuntime, CodeSyncRuntime | `CodeSyncRuntimeStore.ts` (2026-10-01 17:44, push-only, no poll: also the newest of the seven; the other stores of 09-30 22:23-22:54 are push-only too); optional poll shape from `AudioLaneStateStore.ts` (2026-09-30 22:41) over AiHub/ModelLive (2026-09-30 19:02) | refcount; topic handlers; restart + replay-lost reconcile; visibility-aware `Poller` fallback; ModelLive watch keep-alive (onRetain/onRelease); AiHub debounce cleanup; AgentHistory timer cleanup | `removeLegacyPollingSession` + `PYCORE_LEGACY_CODE_SYNC_TASK` key (dead migration of a removed poll session) |
| `PycoreEventClient.ts` (WS only, Web Locks leader + BroadcastChannel) | event code inside `PycoreHttp.ts`; EventSource/SSE path; "fall back to SSE after 3 failed opens" and 5 min socket retry; `PYCORE_SSE_EVENTS`; `PYCORE_HTTP_PATHS.events`; dead `getRuntime`/`RuntimeInfo`; one socket per tab | `PycoreHttp.ts` (2026-10-01 19:39) | `/api/ws` ops hello/subscribe/lease/ping/pong/state/events/error; cursor persist + resume; replay-lost and restart signals; reconnect backoff + keepalive via `ReconnectingWebSocket`; leases; relay tunnel (kept) | SSE (user directive: pycore events are WS only; E removed `/api/events`) |
| route keys `presenceLease`, `threadBusTriggerEvent` | `uiPresenceLease`, `threadBusTrigger` | `route_names.py` (2026-10-01) | same paths | old key names (1 consumer, updated) |
| `PYCORE_HTTP_ROUTES` from the JSON contract | hand-written 300-line route object | `PycoreHttpRoutes.ts` (2026-10-01) + registrars | all keys; methods typed per route | none |
| Vortex `VORTEX_PYCORE_SERVED_HTTP_ROUTES` via `isPycoreRouteServed` | empty hand-kept served list | `VortexPycoreContract.ts` (2026-09-27) | panel gating by served list | stale mirror comment |
| `progressUpload` | fixed-deadline fetch for FormData, blob PUT and large JSON; XHR upload without stall detection (`BaseAPI.uploadWithProgress`); `NETWORK_TIMEOUTS.uploadStallMs` | `BaseAPI.ts` (2026-10-01) | progress callback, response framing, abort signal | fixed per-request deadline for uploads (must be progress-driven) |
| `EngineRow` / `EnginePanel<Row>` | 4 duplicated engine row and panel field sets (OCR, TTS, STT, LLM) | `PycoreSpeechTypes.ts` (2026-09-30) | every field of each variant | none |
| `usePcTerminalImages` + `PcTerminalInputBox` | composer textarea block inside `PcTerminalPage.tsx` | `PcTerminalPage.tsx` (2026-10-01) | draft text, ctrl+enter send, draft save status | none |

**Upload sites fixed** (stall window from the contract, never a total deadline):
- `BaseAPI.sendOnce` (FormData and JSON bodies >= `maximum_chunk_bytes`): laravel-manager uploads, cloud clipboard multipart, BooksAPI, McpV1, ItToolsV1, AppQyV1, DatabaseManagerAPI.
- `BaseAPI.rawRequest` (binary bodies): the relay request blob chunk PUT.
- `BaseAPI.uploadWithProgress` (McpV1 static resource upload): rewritten on `progressUpload`.
- `MasterApiClient.send/deliver` (pycore link, wordnew queued transport): file bodies and large JSON skip the 30 min dead-socket ceiling.
- `WfNewApiTransport.laravelFetch` (wordnew multipart avatar/document uploads).
- Other `protocolFetch` calls carry no file body.

**Terminal image attach.** Route `terminalImageUpload` (`ui/terminal/image/upload`, POST, in the contract). `PycoreApiTerminal.uploadTerminalImage` sends multipart (`file`, `window_id` form fields) through `requestPycoreHttpUpload` -> `PycoreMasterClient.postForm` (form encoded to a Blob with its boundary so the relay leg carries the same bytes). `usePcTerminalImages` (state, per-image progress, retry/remove) and `PcTerminalInputBox` (paste, drop, picker, thumbnails) are split out of `PcTerminalPage.tsx`. `sendInput` uploads first, appends each returned `display_path` after the draft text separated by spaces, then sends; any failed image blocks the send. Strings: `terminal.images.*` in en/zh features locales.

**Files changed (UI).** `core/integrations/pycore/`: PycoreHttpRoutes, PycoreHttp, PycoreClient, PycoreEventClient (new), PycoreLiveSource (new), PycoreNetwork, PycoreConsoleLogStore, PycoreApiTransport, PycoreApiTerminal, PycoreApi, PycoreSpeechTypes, PycoreHealth, useAgentHistoryPromptFeed, index. `core/network/`: ProgressUpload (new), api-client/MasterApiClient. `core/integrations/laravel/transport/BaseAPI.ts`, `core/config/NetworkTiming.ts`. `apps/pycore-manager/`: api stores (7), PcLiveContext, components/{PcLogPanel, PcDebugDock, PcTagFilteredLog, PcWordAudioPanel, PcTerminalInputBox (new), usePcTerminalImages (new)}, pages/PcTerminalPage, pc-locales (Core, Features en/zh), persistence/PycoreManagerStorageKeys. Also `apps/vortex/api/VortexPycoreContract.ts`, `apps/wordnew/api/WfNewApiTransport.ts`, `shell/ShellProvider.tsx`. New config: `config/pycore_rpc_contract.json`.

**Verification.** `node node_modules/typescript/bin/tsc --noEmit` in the UI: 0 errors. No tests added, no dev server or build run. The cross-tab leader, the upload stall path and the terminal image upload are not exercised in a browser. The TaskStatus strings are already `running` in pycore and the UI; UI `processing` strings are Laravel TTS queue states.

**Wordnew.** Audit of every pycore-facing path in `apps/wordnew/**` (WordNewPycoreLink, WordNewPycoreApiService, WfNewApiTransport, ClipSources, Composer, PresetStore, ClipLibrary, LanScan, TTS priority panel, CapLanInfo, compose list/detail): all calls already ride `core/integrations/pycore` (`pycoreApi`, `pycoreLink`, shared probes and target store, `PYCORE_HTTP_ROUTES`) and the Laravel-facing calls stay on Laravel. Wordnew has no private pycore fetch helpers, route literals, event listeners, polling loops or type copies, and never read `heartbeat_enabled`, `PROCESSING` or the SSE endpoint. Fixed:

| merged-into | variants removed | newest-source (git date) | capabilities ported | dropped + why |
|---|---|---|---|---|
| `switchPycoreTarget` (`PycoreEndpointProbe.ts`) | probe-then-select logic in `WordNewPycoreLink.choose` and in `PcPycoreTargetSwitcher.switchTo` | `WordNewPycoreLink.ts` (2026-10-01 19:39; newer than `PcPycoreTargetSwitcher.tsx` 2026-10-01 00:27) | relay entries skip the probe (switcher); reachable-only switch; `reload` option (link: no reload); superseded-choice guard (`isCurrent`, link); verdict state for the notice (switcher); `reload` option (link: no reload) | none |
| `WordNewPycoreLink.readSelection` (persisted target only) | one-time wordnew pin migration (`WORDNEW_PYCORE_PINNED` key) | `WordNewPycoreLink.ts` (2026-10-01) | persisted selection | legacy pin migration (compatibility shim, forbidden) |
| direct `core/integrations/pycore` import in `WordNewTtsEnginePriorityPanel` | `apps/wordnew/integrations/pycore.ts` (11-line re-export adapter) | `integrations/pycore.ts` (2026-09-27) | all 7 re-exports (classifyPycoreAccess, pycoreApi, ttsEngineUiState, ttsEngineBadgeLabel, ...) | none |

Files changed: `core/integrations/pycore/{PycoreEndpointProbe,index}.ts`, `apps/pycore-manager/components/PcPycoreTargetSwitcher.tsx`, `apps/wordnew/integrations/WordNewPycoreLink.ts`, `apps/wordnew/components/settings/WordNewTtsEnginePriorityPanel.tsx`, `apps/wordnew/persistence/WordNewStorageKeys.ts`; deleted `apps/wordnew/integrations/pycore.ts`. Wordnew uploads (`postMultipart`, `laravelFetch`) were already moved to `progressUpload`. Verification: `tsc --noEmit` 0 errors.

**Compute scheduler.** `core/integrations/compute/` is the one entry for compute-heavy work (TTS, OCR); wordnew's thin adapter is `apps/wordnew/services/compute/WordNewCompute.ts`.

Design:
- Availability (`ComputeAvailability`): one reactive state per path with hysteresis (up after 0.5 s stable, down after 3 s; the first reading is taken as is). pycore = event connection (`isHttpConnected`) + health + `pycoreLink` + an app gate (wordnew: a selected target); Laravel = an app-supplied source (wordnew: `wfNewEndpoints` health + link).
- Routing: pycore up -> direct call through the pycore API layer; pycore down, Laravel up -> Laravel (`classifyLaravelCompute`: 202 `data.pycore_task` queued, `pycore_unavailable` queued or rejected, or a result); both down -> the job stays pending in the journal. Every submission carries `job.id` as `client_task_id` (pycore body, Laravel body and `Idempotency-Key`).
- Journal: `core/persistence/IdbKeyValueStore.ts` (IndexedDB, memory fallback), one record per job: id, kind, payload, state, attempts, failures, nextAttemptAt, path, shadow, laravelRef, resultRef, error. A reload turns `submitted-pycore` back to `pending` (same key) and resumes polling of `submitted-laravel`; finished jobs are kept 24 h.
- Failover: a path that drops (availability or a thrown network error) frees its job for the other path under the same key; a queued Laravel job unfinished after 15 s is also submitted directly when pycore is up (shadow); the first result wins, the other flight is aborted and a late result ignored.
- Concurrency and backoff: bounded parallelism per path (pycore 2, Laravel 4), per-job shared `Backoff` (1-30 s) for retryable failures and `pycore_unavailable`, `maxAttempts` 6, cancellation through `AbortSignal`. Large OCR bodies go through `ProgressUpload` (stall-driven) via `requestPycoreHttp`.
- Results: direct = the HTTP answer; queued = poll `GET /api/task/{id}/status` (`classifyLaravelTaskStatus`), `scheduler.wake(id)` for event-driven pickup. UI: `useComputeJobs` and `computeJobStatus` (locale keys `compute.status.*`, `compute.error.*`, en and zh).

State machine: `pending -> submitted-pycore -> done`; `pending -> submitted-laravel -> done` (poll or event); `submitted-pycore -> pending` (path drop, same key); `submitted-laravel -> + shadow on pycore` (first result wins); any -> `failed` (non-retryable, `maxAttempts`, cancel).

Files: `core/integrations/compute/{ComputeTypes,ComputeAvailability,ComputeScheduler,ComputeService,PycoreComputeSource,useComputeJobs,index}.ts`, `core/integrations/laravel/LaravelCompute.ts`, `core/persistence/IdbKeyValueStore.ts`, `core/integrations/pycore/{PycoreApiSpeech,PycoreSpeechTypes,PycoreHttp,PycoreClient}.ts` (`synthesizeSpeech`, `recognizeOcr`, request signal), `apps/wordnew/services/compute/WordNewCompute.ts`, `apps/wordnew/api/{WfNewAdminApi,WfNewApiTransport}.ts` (envelope, headers and signal on POST), `apps/wordnew/components/admin/WfNewAdminTranslate.tsx`, wordnew locales `en_c`/`zh_c`.

| merged-into | variants removed | newest-source (git date) | capabilities ported | dropped + why |
|---|---|---|---|---|
| `ComputeScheduler` ('tts' kind) | `wfNewAdminApi.ttsGenerate` (direct Laravel TTS call) and the inline flow of `WfNewAdminTranslate.doTts` | `WfNewAdminApi.ts` (2026-09-29 21:21); `WfNewAdminTranslate.tsx` (2026-09-27 15:57) | `voice_type: female`, `speed: 1.0`, absolute audio URL, toast on failure, busy state | none |
| `ComputeScheduler` ('ocr' kind) | none (wordnew had no OCR call; the Laravel leg posts the base64 image to `/api/ocr/recognize`, request shape pending I's confirmation) | `PycoreApiSpeech.ts` (2026-09-30 20:40) | `recognizeOcr` over `local/ocr/recognize` | none |
| `Backoff` reuse | none | `core/tasks/Backoff.ts` (A) | exponential delay with jitter | none |
| `AdminRequestExtra` on the admin request core | the lost Laravel error body (only `.status` was kept) | `WfNewAdminApi.ts` (2026-09-29) | `.body` on thrown errors, headers, signal, whole envelope | none |

Verification: `tsc --noEmit` 0 errors. A scratch simulation (fake clock, outside the repo: `esbuild` bundle of the scheduler with injected availability and runners) passed all cases: direct pycore; Laravel queued then polled; both offline then resume; in-flight pycore drop failing over to Laravel with the same key; shadow resubmission and first-result-wins; flapping inside the hysteresis window not thrashing; journal reload resuming queued and pending jobs; `pycore_unavailable` backoff without a hot loop; cancellation; classifier cases for 202, queued-unavailable, rejected, completed and task status.

**Client-key signing of Laravel compute routes.** No UI signer existed (the browser never held the key, K6), so one was added: `core/integrations/laravel/ClientKeySigner.ts` (K3 HMAC-SHA256 over the contract canonical fields, WebCrypto; path and query canonicalization as `RelayContract`), `ClientKeyRouteTable.ts` (the signed routes: Laravel's own table at `client_key_auth.routes_endpoint` in the service contract, loaded once per selected endpoint over the shared transport, revalidated by ETag, kept per endpoint in `localStorage`, matched by method and route template; no static list; while no table is known every request of a keyed build is signed) and `ClientKeyFailure.ts` (401 handling). It was checked against pycore's signer (`client_key_auth.py`) on four requests (query sort, percent-encoded path, unicode JSON body, multipart unsigned): headers and signature are identical. One function, `withClientKey`, is applied on every Laravel call path: `BaseAPI` (JSON, raw, upload), wordnew `laravelFetch`, the wordnew admin gateway (`WfNewAdminApi`, used by the scheduler's Laravel leg) and the queued transport (`MasterApiClient.signRequest`). The key is compiled in by `vite.config.ts` (`__CORE_NODE_CLIENT_KEY__`) only for the dev server or a build with `CORE_NODE_COMPILE_CLIENT_KEY=1`, read from `.secret_keys/.secret_ignore/CORE_NODE_CLIENT_KEY_1`; a build without it, or a page without `crypto.subtle` (not HTTPS or localhost), sends no signature and the session decides. A 401 with a `client_key_*` code no longer opens the login window; it shows the localized message (`common.client_key_*`, en and zh). Caveat: this reverses requirements K6 (the key is readable in the shipped JS of an opted-in build); keep the web build without the opt-in.

**Merge-audit fixes (UI).**
- #1 (HIGH, fixed): Laravel's AI status now carries `image_gateway: {image_capable}`. `CoverStatusData` (`AppQyV1Types.ts`) and `CoverStatusCard` read it (the pycore reachability row and provider chips are gone, with their `no_providers`/`provider_image_mark` locale keys; `pycore` label became `image_gateway`). The dropped `ffmpeg`/`gpu` fields of the processing capability were removed from `ProcessingCapability` (`BooksAPI.ts`) and `ProcessingCapabilityCard`. Other stale readers found and fixed: the laravel-manager MCP OCR tab and API (`McpV1`, `McpModel`, tools config) read the removed engine list and engine-info and sent a nonexistent `engine`; they now read the OCR task description (`model_types`, `required_compute`, `image_max_bytes`), send `model_type`, and show a queued task or `pycore_unavailable` as a message. wordnew and pycore-manager have no other reader of the old shapes.
- #5 (shared routing): the delivery channels are derived and debounced once, in `ComputeAvailability`: its snapshot now holds `pycore`, `laravel`, `direct` and `relay` (`relay` = not direct AND Laravel up AND paired, or the selected relay target answering) with the same up/down hysteresis, from the path sources plus `ChannelInputs` (relay mode and pairing, wired by `createPycoreChannelInputs` through the new `subscribePycoreTarget` in `pycoreTarget.ts` and the existing `subscribeLaravelRelayDevice`). `createChannelAvailability(availability)` is a thin view (`direct`, `relay`, `laravel`, `available(channel)`, `subscribe`); wordnew exports `wordNewChannels` and no longer passes a pairing callback. A pairing, unpairing or relay-mode switch now publishes a change, so the composer's R9 rising-edge resume fires for the relay. c4 was sent the adapter and adopted it; `orchClipScheduler` was not edited.
- #14 (backoffs): `core/tasks/Backoff.ts` gained `jitter` (`additive` default, `half`, `none`), `initialStep` and a pure `delayFor(step)`, so every variant keeps its parameters: `ReconnectingWebSocket` (half jitter), `Poller` (`delayFor(failures)`), `LaravelRealtime` and `WfNewSocialRealtime` (additive), `useQueueCenterHub` (two sites, no jitter, initial step 1; `maxBackoffExponent` removed), `CapNetworkReachability.retryWhenOnline`. Left: `ServiceLink` (core-node-c4's file) and `BaseAPI`'s linear retry delay (not exponential).
- Relay blob downloads: `readBytesWithStallGuard` (`core/network/StallGuardedRead.ts`) reads a body with no total deadline and fails only after `http_transfer.idle_timeout_seconds` without a byte; it now reads `getRelayResponseBlob` and every pycore binary answer (`requestPycoreHttpBinary`). The orchestration clip downloads (c4's files) still read bodies unguarded.
- Protocol paths: `PYCORE_HTTP_PATHS` (client id, status, info, routes, `/api/ws`) are derived from `config/pycore_rpc_contract.json` (`api_prefix` + `protocol_routes`, E added `ws`); no `/api/...` literal remains in the UI event client or network constants.
- Audit #6, #7, #15 (stall guards, abort):
  - One idle watchdog (`core/network/IdleWatchdog.ts`, window `TRANSFER_IDLE_MS` from `http_transfer.idle_timeout_seconds`) now serves `ProgressUpload` and `StallGuardedRead` (the duplicated timer is gone). `consumeBodyWithStallGuard` / `readBytesWithStallGuard` take a `signal`: an abort cancels the body (AbortError), a stall rejects with TimeoutError; checked in a scratch harness (read, stall, abort, pre-aborted).
  - The signal reaches every reader: `requestPycoreHttpBinary` (new `signal` argument, `getBinary`), `requestPycoreHttpBinaryPost`, the relay blob read. `MasterApiClient.send` keeps the caller's abort listener after the headers arrive (it only cleared the ceiling timer), so a cancelled run stops its body download and frees its transfer slot.
  - Native: `ProtocolHttpPlugin.java` has an `IdleWatchdog` re-armed on every `onResponseStarted` / `onReadCompleted` of the request, bundle and the new `download` (file download with temp file + rename, `downloadProgress` events, cancel); a stall rejects with `STALLED`. `ProtocolFetch.ts` passes `idleTimeoutMs` (the contract value), maps STALLED to TimeoutError and adds `nativeDownloadToFile`. `CapFilesystemCache.putFromUrl` uses it on the Cronet app (replacing the unguarded Capacitor `downloadFile` there), guards the OPFS and blob branches with the stall guard and takes a `signal`. iOS keeps `Filesystem.downloadFile` (no native plugin there, so no guard). The Java file was checked for balance only: it could not be compiled here (no Android SDK).
  - Left to c4 (orchestration files): `WordNewOrchClipStore.putFromUrl` should pass `signal` into `blobs.putFromUrl(name, url, { force: true, onProgress, signal })` and `WordNewOrchClipSources` its `context.signal`.
- Audit #14 client: `requiresClientKey` no longer waits for the table fetch: while no table is known every request of a keyed build is signed at once; HEAD matches the GET entries.
- Relay progress: the relay `progress` frame's `done/total` feeds `ComputeRunContext.progress` (through `onProgress` on `MasterRequestOptions`, `requestPycoreHttp`, `synthesizeSpeech` / `recognizeOcr`, and the relay pending call); a heartbeat-only frame updates nothing.
- Client-key route list: `ClientKeyRoutes.ts` (static) is replaced by `ClientKeyRouteTable.ts`, which reads the public endpoint I added (`/api/public/client-key-routes`, ETag, derived from the live route table) and caches it in `localStorage`; the signer consults it only when the build holds a key. The path is the new `client_key_auth.routes_endpoint` key of `config/service_contract.json`.

**Terminal UI audit (fixed).** (1) `sendInput` read the draft before the image uploads, so text typed during an upload was lost and the draft cleared; it now reads the latest draft after the uploads. (2) A failed send persisted the merged text with image paths as the draft, duplicating paths on retry; it persists the draft text only. (3) An explicit text resend (`textOverride`) also uploaded and attached the draft images; images now belong to draft sends only. (4) A retry and a send could upload the same image twice; uploads share one flight per image. (5) An image removed during an upload could still end up in the message or block it; removed images are skipped. (6) The drag highlight flickered over child elements (`relatedTarget` check). Payload field names and params of the terminal routes (`windows`, `activate`, `click`, `input`, `enter`, `draft`, `view`, `content`, `screenshot`, `command_history`, `scroll`, `image/upload`) were checked against `terminal_routes.py` and the window views: no mismatch.

**Terminal page layout and machine send panel.**
- Layout: `PcTerminalPage` now renders the windows grid and operation panel first (page padding top and bottom removed, section header `py-1.5`, mobile grid offset 15.5 -> 6.5 rem), then the action notice, and below them the page header (title, schedule clear, refresh), the detected/platform status, notices and the desktop integration panel, then the machine send panel.
- Contract (proposed to D2 and E; routes added to `config/pycore_rpc_contract.json`): `machineSendFile` (multipart `file`, `open`), `machineSendText` ({text, name?}), `machineSendClipboard` ({kind:'text', text} or multipart `file`, `kind` image or file; pycore backs up its clipboard first and returns `backup`, then replaces it and notifies), `machineSendClipboardHistory` ({limit?} -> entries), `machineSendClipboardHistoryDelete` ({id}), `machineSendClipboardHistoryClear`. `ClipboardEntry = {id, kind: text|image|files|empty|other, text?, mime?, bytes?, names?, at}`.
- UI: `core/integrations/pycore/PycoreApiMachineSend.ts` (typed calls on the single layer, uploads through `ProgressUpload`), `apps/pycore-manager/components/machine-send/{PcMachineSendPanel,usePcMachineSend,machineSendShortcut}`, locale block `machineSend.*` (en, zh), storage key `PYCORE_MACHINE_SEND_SHORTCUT`.
- Behaviour: files (picker or drop, several) are saved and the receive folder opened, or put on the machine clipboard; text opens in the machine editor or goes to its clipboard; every action shows progress, a result line and a coded error; backups appear in a history list (text in full, other kinds with kind, mime, size and names) with delete and clear. The clipboard sync shortcut (default Alt+Shift+V, configurable, must hold Ctrl, Alt or Meta, matched by physical key so Option+V works on macOS) reads this browser's clipboard (images and text) through the Clipboard API and sends it through the same clipboard route; a blocked, unsupported or empty clipboard shows an i18n hint pointing to the text box.
- Wired by D2/E on that contract (`machine_send_service.py`, `machine_send_routes.py`, the six keys now in `routes`): `file` takes `file` repeated plus `open`, answers the first file at top level and every file in `saved`; the clipboard backup history is kept by pycore (`entries`, delete, clear). The UI maps `machine_send_*` and `clipboard_*` error codes (with `max_files` and `max_bytes`) to `machineSend.errors.*`; an image cannot be put on the machine clipboard (`clipboard_image_unsupported`, the file is saved and its path shown).
- Relay: over the relay one request body is capped at `request_body_bytes` (64 MiB, relay contract); in relay mode the panel blocks a file above the cap with an i18n message (`machineSend.errors.relay_too_large`) and groups the other files into requests that each stay under it; direct calls rely on pycore's own 2 GiB cap.
- Duplicate found: `pyctl/desktop/machine_receive_service.py` and `rpc_routes/machine_receive_routes.py` (`receive_files`/`receive_text`/`set_clipboard`, D2's earlier iteration) are not registered in `register_http_routes` and duplicate `machine_send_*`; the UI follows `machine_send_*`; D2 should delete the receive pair.
- Pending D2 and E: the service and route wiring, the final field names, size caps and error codes (the UI maps `error_code` to `machineSend.errors.<code>` with a generic fallback).

**Pending deletion.** None from F.

**Open items (F).**
- Resolved: `client_task_id` dedupe is live at E's RPC layer for every route (10 min, joins in-flight calls, failures not cached) and echoed by C; Laravel accepts it on the OCR and TTS generate routes (I).
- Scheduler additions after the shapes arrived: pycore failures keep C's `error_code`/`error_params` (the six new `model_*` request codes have en/zh text in pc `reasons` and in wordnew `compute.error.*`; `model_input_*` and `model_unknown_engine` are not retried); Laravel failures keep `error_code` and `error_params` (AI_PAID_MODEL_REFUSED, AI_FREE_IMAGE_MODEL_UNAVAILABLE); `ComputeKind.pycoreRequired` (false, or a getter) sends work Laravel does without pycore straight to Laravel and never races it on pycore. I's `/api_info` inventory arrived: `pycore_required: true` covers exactly the scheduler's kinds (OCR `ocr_recognize`, TTS `tts_synthesize`, plus the audio lanes, which wordnew reaches through its queue-center path); every `light` and `none` endpoint is a plain Laravel call, so no wordnew kind needs `pycoreRequired: false` today (the flag stays for kinds that may be added). The Laravel OCR answer shape (flat 200 result, 202 `pycore_task`, 503 rejected `pycore_unavailable`) matches the classifier.
- Terminal images: only the returned `display_path` text goes into the message; `[Image #N]` placeholders are stripped from the draft before send (`stripImagePlaceholders`); image bytes never reach the terminal input calls. D2 confirmed pycore puts only text on the clipboard.
- Resolved: callmodule derives every route path from `config/pycore_rpc_contract.json` (E); C's engine panel shape is applied (`EnginePanel`) and `heartbeat_enabled` is gone; `/api/events` is removed and `/api/ws` ops match; D2's `terminal_service.upload_image` is built (its `error_code`s map to `terminal.images.errors.*`); relay multipart works (E's relay kernel); the 3 unserved contract routes were removed.
- AI gateway codes `AI_PAID_MODEL_REFUSED` (provider, model) and `AI_FREE_IMAGE_MODEL_UNAVAILABLE` (provider) map to pc `errorCodes` en/zh with their params (`PcFailureFields.error_params`, `pcErrorCodeMessage(code, detail, params)`).
- Pending shape from I (laravel-pycore): Laravel compute endpoints now queue a pycore task or return a typed `pycore_unavailable`. Wordnew call sites that can hit them (inventory): `moveSentenceAudioToHead` / `moveWordAudioToHead` (`WordNewQueueCenter`, `WordNewOrchClipSources`, `WordNewBookReaderSentenceAudio`), `ttsSentenceAudio`, `audioBundle`, admin `ttsGenerate` and `translationTranslate` (`WfNewAdminApi`, `WfNewAdminTranslate`). The one shared handler in the core Laravel layer is built when I's shape arrives.
- `PycoreEngineLoadStore` keeps its gated fast poll (the load log tail is not in the event delta).
- The contract has no response schema names (pycore has no machine-readable response schemas).

### G. Agent history prompt sources

**Design.** The scattered extractors and JSON caches are now three layers.

1. Prompt sources: `pyctl/agent_history/sources/`.
   - `source_kit` holds the shared readers, timestamp and content normalisation, and `SessionDraft`, the one session accumulator (first/last ts, models, turn cap, record shape).
   - `source_specs` holds the `SourceSpec`/`ToolSpec` data classes, the one discovery implementation (globs or a non-following walk, realpath root dedupe, size cap, directory sources, fallback scope `home`/`root`) and `editor_user_dirs()` for VS Code-family editors.
   - `tool_specs.TOOL_SPECS` is the only per-tool table (roots, patterns, format and format options).
   - `source_registry.source_registry` is the one registry. It validates the specs against `agent_paths` markers and provides `tools`, `discover`, `discover_all` and `parse`.
   - Source kinds are named by data shape under `sources/formats/`. No module or class carries a product name.
     - JSONL logs: `content_block_log`, `response_item_log`, `wire_event_log`, `typed_entry_log`, `typed_history`, `block_transcript`.
     - JSON files: `message_list`, `project_temp_json`, `chat_session_file`, `markdown_artifacts`.
     - SQLite KV stores: `prompt_store_sqlite`.
     - Shared conversation shape: `chat_conversations.ChatLayout`.
   - Every tool contributes data only: roots, globs, field names, origin kinds, key filters and JSON paths in `tool_specs`, including the Pi root resolver.
   - The single-producer log schemas (content-block, response-item, wire-event, typed-entry) keep their schema rules in code. Those rules (queued-command attachments, turn.prompt mirroring, article chunking) cannot be expressed as field paths.
2. Read-only prompt store. `formats/prompt_store_sqlite.SqlitePromptStore` (instance `sqlite_prompt_store`) reads key-value `state.vscdb` `ItemTable` stores read-only through `database/adapters/sqlite_readonly.query_rows`; that API is unchanged.
   - A `KvStoreLayout` declares the table, the key LIKE filters and a `ChatLayout`: containers, a message list or VS Code `requests` pairs, roles, text, ids, titles and times.
   - `chat_session_file` reads the same conversations from `chatSessions/*.json[l]`. The `.jsonl` files are VS Code's mutation log (kind 0/1/2/3), checked against a real file on this host.
   - `tool_specs.EDITOR_APPS` declares each editor: app dir names (Windows, Linux, macOS), remote-server dirs and extra state keys. `editor_chat_sources()` turns that into both sources for VS Code (Code, Insiders, VSCodium), Cursor, Windsurf, Trae (incl. CN) and Antigravity.
   - A `KvStoreLayout` lists one or more `KvTable`s. Each has a name, LIKE key filters and an optional referenced-row key template. Tables a database lacks are skipped.
   - Conversations whose message headers point at separate rows are resolved with one prefix query per conversation.
   - Workspace DBs keep the 50 MB cap; global DBs have a 512 MB cap.
   - Cursor keeps its old semantics: a home-scope backup, used only when no agent transcripts exist.
   - New tool ids `vscode`, `windsurf` and `trae` were added to `agent_paths` markers (additive; foundations and ui-pycore-api told).
   - Cline tasks are found in every one of those editors' globalStorage.
3. Prompt records: one SQLite store, `pyctl/agent_history/prompt_records.prompt_records`, at `<agent_history store>/prompt_records.sqlite3`.
   - It runs on its own serialized owner thread and opens its repository lazily.
   - It holds the feeds `new`, `derived` and `rewritten` (bounded: per tool by ts for `new`, by write recency for transforms) and the append-only `archive`, which is never trimmed and uses the same sha1 content key as before.
   - The database is `database/repositories/prompt_record_repository.py` with schema `database/schema/prompt_record_schema.py`, on `open_wal_connection`, with new TableKeys `AGENT_HISTORY_PROMPT_{FEED,ARCHIVE,META}` and namespace `util_agent_history`. foundations was notified.
   - The legacy JSON feeds and JSONL archive are imported once, guarded by the meta key `legacy_imported`. There are no dual readers.
   - The DB files are always mode 0640, like every other store file, which replaces the per-file root-only chmod.
   - `snapshot_cache` stays as it is: it is the in-memory catalog cache, not a prompt store.

**Splits.**
- `agent_history_service` (561 lines) became the service (extract pass and live scan, 317 lines) plus `source_scan` (homes, spool overlay, descriptors, signature), `prompt_events` (the prompt-new choke point) and `extract_probe`.
- `ui_service` (562 lines) became `ui_service` (store, scan, feed and probe routes), `ui_runtime_service` (status, runtime, AI dashboard, fragments, config), `ui_article_service` and `ui_requests`.
- `agent_history_txt` became the store plus `txt_format` (kv and block format).
- `EXTRACTOR_SCHEMA_REVISION` was bumped to `2026-10-01.3`, which forces a one-time baseline re-parse with no prompt-new events. Persisted source records now carry `source`/`format` instead of the extractor index. Spool index records carry them too.

**Files.** New: `sources/{__init__,source_kit,source_specs,tool_specs,source_registry}.py`, `sources/formats/*.py` (13), `source_scan.py`, `prompt_events.py`, `extract_probe.py`, `prompt_records.py`, `ui_runtime_service.py`, `ui_article_service.py`, `ui_requests.py`, `txt_format.py`, `database/schema/prompt_record_schema.py`, `database/repositories/prompt_record_repository.py`. Changed: `agent_history_service`, `agent_history_records` (`page_window`; `read_feed_items` removed), `agent_history_txt`, `root_spool`, `root_spool_main`, `prompt_{transform,derive,rewrite,notify}_service`, `pipeline/config.py`, `ui_service`. Deleted: all 11 `*_extractor.py`/`extractor_registry.py`/`base_extractor.py` modules, `prompt_new_cache.py`, `prompt_transform_cache.py`, `prompt_archive.py`. Outside the scope (minimal): `callmodule/rpc_routes/local_agent_history_routes.py` (imports only; rpc-events told), `database/models/{namespaces,table_keys}.py` and `pyfoundations/agent_paths.py` markers (additive; foundations told).

**Merge audit (G).** Dates from the pre-session commit `605d08b25`.

| merged-into | variants removed | newest-source | capabilities ported | dropped + why |
|---|---|---|---|---|
| `source_kit` + `SessionDraft` | `BaseExtractor` helpers and the per-extractor first/last-ts, models, turn-cap and `session()` code (9 copies) | all variants 09-30 (pre-session `605d08b25`); base_extractor taken as base | JSONL malformed-line count, reported read errors, ms/s/ISO ts, `[image]` content, injected-prefix filter, truncation, `ts_estimated`, file-mtime+order fallback | first/last ts is now min/max for all formats (claude/codex/kimi used first-seen/last-seen, which is identical for ordered logs); turn cap is `>=` everywhere |
| `source_specs.discover_spec` + `tool_specs` | 9 `discover()` implementations | all 09-30; union of every variant | realpath dedupe, kimi root dedupe, codex no-symlink depth walk, pi env/settings roots, 50 MB KV cap and mtime-0 skip, gemini `logs.json` exclusion (via path dedupe), cursor transcripts-first fallback, kimi per-root user-history fallback, antigravity directory descriptors | none |
| `formats/message_list` | generic_agent, cline, gemini chat | all 09-30; generic_agent (widest role map) as base | containers, `session` skip, role maps per tool (gemini skips non-chat types), doc start/end ts, parent-dir/stem/sessionId ids, gemini project dir | none |
| `formats/typed_history` | claude/codex `history.jsonl`, kimi user-history | all 09-30; kimi (mtime fallback) as base | per-tool text/ts fields, project as turn name, slash-command skip, ids and titles | undated claude/codex rows now get file mtime (estimated) instead of 0; their prompt ids are content-only either way, so they are stable |
| `formats/prompt_store_sqlite.SqlitePromptStore` + `chat_conversations` | `CursorExtractor._parse_vscdb/_read_item_table` | cursor_extractor 09-30 (only variant) | ro open, key filters (the same 4 for Cursor), conversation/bubble paths, user role markers, composer ids/titles, db-dir project, estimated ts, transcripts-first fallback | none; added: BLOB decoding, list documents, request/response pairs, globalStorage db, other editors |
| `prompt_records` (SQLite) | `prompt_new_cache` (per-tool JSON), `prompt_transform_cache` (2 JSON), `prompt_archive` (per-tool JSONL + in-memory key set) | prompt_transform_cache / prompt_archive 09-27 (newest; replace-on-write and append-only semantics kept), prompt_new_cache 09-20 | id dedupe, per-tool cap 2000 by ts, transform cap 1000 newest-write with replace, text caps, namespaces and counts, page clamping, append-only archive with the same key, root-safe file mode, one-shot import | per-file root-only chmod (the DB is always 0640, the store mode) |
| `source_registry` | `extractor_registry` + per-tool classes | extractor_registry 09-27 | marker-table validation, UI display order, `has_tool` | none |

Other drops, each provably obsolete:
- Empty claude sessions with zero turns and zero prompts: 3 files on this host. They carried no record.
- The probe's try/except around parsing: formats never raise, and the readers report errors themselves.
- Gemini `logs.json` stopped every remaining session after one hit the turn cap. That was a bug, and it is fixed.

**Verification.**
- py_compile and import checks pass for the routes module, ui_*, root_spool_main, the prompt services, video_pipeline and the formats. An AST unused/undefined scan is clean.
- The old extractors and the new registry were run side by side over all 4 scanned homes (/root, /home/debian, Kimi1, Kimi2). Discovery sets and parsed sessions were identical except the 3 empty claude sessions.
- Legacy import on a copy: 1905 new, 509 derived, 482 rewritten and 1807 of 1809 archive lines (duplicate keys). Dedupe, caps and paging were checked.
- Synthetic Cursor global DB: a `cursorDiskKV` `composerData:c1` row with `fullConversationHeadersOnly`, plus `bubbleId:c1:*` rows, parses to the prompt and reply with bubble times.
- Synthetic Trae `memento/icube-ai-agent-storage` row: `list` -> `messages` parses as expected.
- Synthetic VS Code home: a `chatSessions` `.json`, a `.jsonl` mutation log and an `interactive.sessions` KV row each parse into the expected prompts and replies with real timestamps.
- A full extract into a scratch store gave 96 sessions and 826 prompts. A second run returned unchanged. Live scan skipped when nothing changed.
- The live pycore service, restarted at 21:04 by someone else, is running this code. It imported the legacy records at 21:03, rebuilt the store (95 sessions, 804 prompts), and `ui/agent_history/prompt_cache` and `status` answer with unchanged shapes.

**Pending deletion (G).** These legacy record files were imported and are no longer read:
- `/var/_core_node/cache/pycore/.ai_state/agent_history/prompt_new_cache/`
- `/var/_core_node/cache/pycore/.ai_state/agent_history/prompt_derived_cache.json`
- `/var/_core_node/cache/pycore/.ai_state/agent_history/prompt_rewrite_cache.json`
- `/var/_core_node/cache/pycore/.ai_state/agent_history/prompt_archive/`

The same paths apply on other hosts.

**Incident (G).** While the old cache modules were still in place, `read_feed_items` had already been removed from `agent_history_records`, so `register_http_routes` failed to import for a few minutes. Deleting the old modules in the same pass fixed it, and the import now passes. A second window of the same kind happened during the VS Code-family extension: `KvStoreLayout` gained `tables` before `tool_specs` stopped passing `key_patterns`, so the tree was unimportable for about a minute. Both files are in sync now. From now on, a definition and all its callers change in one step, followed by an import check of `tool_specs` and `register_http_routes`.

**Open items (G).**
- Per-editor research (sources: Cursor storage write-ups such as cursaves `docs/how-cursor-stores-chats.md` and vibe-replay; Trae and Antigravity reverse-engineering notes; files inspected read-only on this host):
  - VS Code (Copilot Chat): current builds keep only `chat.ChatSessionStore.index` in the KV store (checked here). The data is in `chatSessions/*.jsonl` mutation logs (format checked against a real file here) and `emptyWindowChatSessions/`. Older builds stored `interactive.sessions` in the KV store. All three are declared.
  - Cursor: workspace `ItemTable` (aichat/composer) and global `cursorDiskKV` (`composerData:<id>` + `bubbleId:<id>:<bubble>`). Both are declared. The global DB here is 2.4 MB with empty composers.
  - Trae: workspace `ItemTable` keys `memento/icube-ai-agent-storage`, `ChatStore`, `icube-ai[-ng]-chat-storage-*`. They are declared, but the JSON shape is not verified (no install here).
  - Trae's `ModularData/ai-agent/database.db` is SQLCipher-encrypted and not recoverable.
  - Windsurf: Cascade conversations are `~/.codeium/windsurf/cascade/*.pb` protobuf blobs, not recoverable without the app's schema and key. Its KV store and chatSessions are declared like every other editor; the VS Code chat panel lands there. `~/.codeium/windsurf/memories/` holds AI memories, not prompts.
  - Antigravity: `conversations/*.pb` are encrypted (checked: high-entropy bytes on this host). The `state.vscdb` chat keys are empty (only `chat.ChatSessionStore.index` here). Recoverable data is the `brain/*.md` artifacts, now discovered for `antigravity`, `antigravity-ide` and `antigravity-cli`, plus the editor KV and chatSessions declarations.
  - Antigravity IDE 2.x reportedly stores `~/.gemini/antigravity-ide/conversations/*.db` (SQLite). No sample exists here, so no schema is declared yet.
- UI labels and badges for `vscode`, `windsurf` and `trae` are already in `presentation.tsx` (added by F).
- The root spool process must be restarted to write `source`/`format` in its index. Until then the worker reads spooled sessions unchanged.
- UI comments still name the old cache modules (ui-pycore-api told).
- `pyutils/agent_history/article_records.py` (635 lines) and `video_pipeline.py` (454 lines) are not split. They are article storage and the video job runner, not prompt sources.

### H. Shell prerequisite installers (Linux)

Shared helpers: `pycore/tts_install_assets/hf_prefetch.py` (`snapshot_download` into the HF hub cache that runtime reads offline; `--check` is cache-only and prints `__HF_READY__`/`__HF_MISSING__`) and `nltk_prefetch.py`. Bash wrappers in `scripts/shells/linux/common/tts_install_assets_common.sh`: `hf_hub_cache_prefetch` (cache check first, then official Hub, then the installer mirror as fallback; errors are printed) and `nltk_data_prefetch`. The installers source `shared_cache_env.sh` when `HF_HOME` is unset, so a standalone run fills the same cache pycore uses.

| Step | Change | Official source | Idempotency check |
|---|---|---|---|
| 133 cosyvoice | `FunAudioLLM/<leaf of cosyvoice_model_dir>` -> `<staging>/pretrained_models/<leaf>` (exactly `cosyvoice_engine.model_dir()`), allow `*.json,*.yaml,*.pt,*.onnx,*.txt,*.safetensors,CosyVoice-BlankEN/*`; the installed shortcut and the opt-in gate now require the weights | https://github.com/FunAudioLLM/CosyVoice (README `snapshot_download(..., local_dir='pretrained_models/CosyVoice2-0.5B')`), https://huggingface.co/FunAudioLLM/CosyVoice2-0.5B (19 files, not gated) | `.model_installed` plus `cosyvoice2.yaml`, `llm.pt`, `flow.pt`, `hift.pt` non-empty |
| 139 melotts | `prepare_melotts_nltk` (one tagger, `\|\| true`) replaced by `prepare_melotts_assets`: NLTK `averaged_perceptron_tagger`, `averaged_perceptron_tagger_eng`, `cmudict` into `<venv>/nltk_data`; HF cache: `myshell-ai/MeloTTS-<lang>` `config.json`+`checkpoint.pth` and the BERT of each language in `$LANGUAGES` (EN `bert-base-uncased`, ZH `bert-base-multilingual-uncased` because `ZH` runs as `ZH_MIX_EN`, JP `tohoku-nlp/bert-base-japanese-v3`, KR `kykim/bert-kor-base`, ES `dccuchile/bert-base-spanish-wwm-uncased`, FR `dbmdz/bert-base-french-europeana-cased`), plus the tokenizer files of all six because `melo.text.cleaner` imports every language module; also runs on the already-provisioned shortcut | https://github.com/myshell-ai/MeloTTS (`melo/download_utils.py`, `melo/text/*` read from the installed package), https://github.com/Kyubyong/g2p (NLTK list), nltk >= 3.9 needs the `_eng` tagger | `hf_prefetch.py --check` per repo; `nltk_prefetch.py` finds each resource before downloading |
| 135 f5tts | HF cache: `SWivid/F5-TTS` `F5TTS_v1_Base/model_1250000.safetensors` and `charactr/vocos-mel-24khz` `config.yaml`+`pytorch_model.bin` (what `F5TTS()` requests; vocab ships in the package); installed shortcut and opt-in gate require them | https://github.com/SWivid/F5-TTS (`src/f5_tts/api.py`, `infer/utils_infer.py load_vocoder`); HF file lists confirmed, not gated | `hf_prefetch.py --check --file ...` |
| 141 bark / 181 parler | Verified, unchanged: both already run `install_hf_repo_flat` into `<staging>/weights`, which `resolve_model_id` reads; Bark allow-list `tts_model_tiers.HF_ALLOW['bark']` covers `pytorch_model.bin`, tokenizer, `speaker_embeddings_path.json` and `speaker_embeddings/**/*.npy` (784 files on both `suno/bark` and `suno/bark-small`; `BarkProcessor.from_pretrained` rewrites `repo_or_path` to the local dir); Parler allow-list covers `model.safetensors`, `spiece.model`, tokenizer files | https://huggingface.co/suno/bark, https://huggingface.co/parler-tts/parler-tts-mini-v1 | existing sentinel plus `neural_tts_local_weights_ready` |
| docker voxcpm2 | New `model.sh` (`compose_run`, repo `openbmb/VoxCPM2`, subdir `hf` = `HF_HOME=/data/hf`, allow `*.pth,*.json,*.safetensors,tokenization_voxcpm2.py`, import check `voxcpm`, smoke through `/load` and `/synthesize`); `compose.yml` gained the fingerprint label, limits, `HF_HOME`/`HF_ENDPOINT` env | https://huggingface.co/openbmb/VoxCPM2 (8 files, not gated) | runner weights stamp `repo\|allow`, image fingerprint label |
| docker melotts | `model.sh` weights: adds `MeloTTS-Chinese`, `bert-base-multilingual-uncased` and the other four tokenizer repos (import loads all six); allow gains `*.model,*.vocab` | same as 139 | runner weights stamp changes, then `snapshot_download` skips cached files |
| docker melotts + voxcpm2 | `compose.yml` mounts `pycore/pyfoundations/sentence_segmenter.py` and `config/sentence_segmentation_contract.json` next to the server (`/opt/<engine>/`), the paths `tts_text_chunking._SEGMENTER_CANDIDATES` and `CONTRACT_PATH` resolve | n/a | read-only bind mounts, no image rebuild |

Verification: `bash -n` passes on every touched script and `model.sh`; shellcheck is not installed. Live-tested only the helpers: `hf_prefetch.py` (check, small download, ready after download) and `nltk_prefetch.py` through `nltk_data_prefetch`. Installers were not run.

Second batch (Linux), same helper style:

| Step | Change | Official source | Idempotency check |
|---|---|---|---|
| 125 ocr | Calls the shared `ocr_models_prefetch.py` (Windows agent) with the main interpreter: `easyocr` (EasyOCR `Reader(download_enabled=True)`, `craft_mlt_25k.pth` plus recognizers) into `$EASYOCR_MODULE_PATH/model`; `cn` always (CPU set: `ch_PP-OCRv5_det`, `en_PP-OCRv3_det`, `ch_PP-OCRv3_det`, `ch_PP-OCRv5`, `en_PP-OCRv4`, `chinese_cht_PP-OCRv3`) and additionally `cn --gpu` on GPU hosts (`ch_PP-OCRv5_det_server`, `ch_PP-OCRv5_server`) into `CNSTD_HOME`/`CNOCR_HOME` (`<ver>/ppocr/<model>/`); sources `breezedeus/cnstd-ppocr-*`, `breezedeus/cnocr-ppocr-*`, cht zips from `breezedeus/cnstd-cnocr-models`. Header comment fixed. `shared_cache_env.sh` exports `EASYOCR_MODULE_PATH=<shared cache>/ocr/easyocr`, forwarded by `pyservice_entry.sh`. The OCR helper has not been executed yet | https://www.jaided.ai/easyocr/documentation/, https://github.com/JaidedAI/EasyOCR (`easyocr/config.py`), https://cnocr.readthedocs.io/zh-cn/stable/models/ | helper skips present files; rerun downloads nothing |
| 127/151 whisper | Verified, only the stale "downloads on first use" messages fixed. 127 writes `<WHISPER_CACHE_DIR or CORE_NODE_CACHE_DIR/whisper>/<model>.pt` and 151 `faster_whisper.download_model` fills the HF hub cache (`models--Systran--faster-whisper-<model>`); `whisper_models.py` reads exactly those roots (`WHISPER_CACHE_DIR`, `XDG_CACHE_HOME/whisper`, `HF_HUB_CACHE`, `HF_HOME/hub`, `CORE_NODE_CACHE_DIR/huggingface/hub`) and the tier models `large-v3`/`medium` | https://github.com/openai/whisper, https://github.com/SYSTRAN/faster-whisper | existing local-file checks |
| 149 device tools | adb stays on apt (errors visible). scrcpy: official Genymobile `scrcpy-linux-x86_64-v<version>.tar.gz` (adb, scrcpy, scrcpy-server) extracted to the ext4 `<paths.drive_layout.cache_root.linux>/<scrcpy_bundle_dir.dir_name>` (`/opt/core_node/cache/scrcpy`; a Linux-only binary install never goes on the NTFS shared cache, D26), sha256 checked against the release `SHA256SUMS.txt`. Version and dir name are read from the contract (`versions.scrcpy`, `paths.drive_layout.scrcpy_bundle_dir`, both new), no literals in the script; the apt-scrcpy attempt, the `exit 0` and the `scrcpy_init` Python fallback are removed. Both OSes export the resolved dir as `SCRCPY_HOME` (Linux from `shared_cache_env.sh`, forwarded by `pyservice_entry.sh`; Windows `<tool root>\scrcpy`), the one variable Python reads | https://github.com/Genymobile/scrcpy/releases/tag/v3.3.4 | adb on PATH; adb+scrcpy+scrcpy-server non-empty in the bundle dir |
| 115 ffmpeg | apt install kept; `exit 0` after failure and hidden stderr replaced by visible output and `exit 1` (the prerequisite runner retries). Linux install path is the apt binary on PATH (`/usr/bin/ffmpeg`) | https://packages.debian.org/trixie/ffmpeg | `ffmpeg` and `ffprobe` on PATH |

Whisper (127): `install_whisper_model_weights` now takes the URL only from the installed `whisper._MODELS` (the hand-written URL table is removed), names the file after the URL leaf and verifies the sha256 in the URL; 125 also installs the GPU OCR set (`cn --gpu`) on GPU hosts besides the CPU set. 151 already downloads the tier model on every run via `faster_whisper.download_model`.

Shared-path audit: weights resolve through `shared_cache_env.sh` only. 133/135/139 and 131/137/141/143/145/147/181/183 now source it and require `CORE_NODE_CACHE_DIR` (31 sherpa too: `SHERPA_TTS_MODEL_DIR`, else `<shared cache>/tts/sherpa`, as Python reads it) (the old `$REPO/.cache` fallback is gone), so staging = `<shared cache>/pycore/<engine>` = Python `get_local_data_dir()/<engine>`; HF cache = `HF_HOME`, Whisper = `WHISPER_CACHE_DIR` (127/151 literal `/var/_core_node/cache` fallbacks removed), EasyOCR = `EASYOCR_MODULE_PATH` (required, `<shared cache>/ocr/easyocr`), CnSTD/CnOCR = Python roots. Only the scrcpy bundle (a binary install) moved to ext4.

No repo/home fallbacks remain in the Linux weight paths: the docker runner defaults staging to `$CORE_NODE_CACHE_DIR/pycore/<model>` (it sources `shared_cache_env.sh`) and fails with `staging_unresolved` instead of using `<repo>/.cache`; 129 vosk (`<shared cache>/stt/vosk`) and 117 ollama lost their `$HOME`/`/var/_core_node` fallbacks. NLTK data now lives in `<shared cache>/nltk_data`: `shared_cache_env.sh` exports `NLTK_DATA`, `pyservice_entry.sh` forwards it, and 139 (melotts) and 137 (gptsovits) install into it with `nltk_prefetch.py` (present resources skipped) instead of `<venv>/nltk_data`; the launcher's venv-local check in `tts_server_launch.py` must switch to `NLTK_DATA`.

Frontend packages (new step 193, registered as `frontend_packages` in `prepare_pycore_prerequisites.sh`): installs the dependencies of `poly_apps/pycore_laravel_wordnew_ui`, the callmodule `FRONTEND_DIR` that holds every pycore-launched frontend app (one workspace root, one `node_modules`). It reuses the UI's idempotent `scripts/start.sh --prepare --dev` (node + bun toolchain, `bun install` against `bun.lock`; the UI uses bun, not pnpm) and passes `--force-install` on `--force`. On an NTFS checkout it first creates the empty in-repo mount point and binds `<trees_root.linux>/<ns>/node_modules` with `project_tree_ensure` (contract `trees_rule`), so node_modules stays on ext4; a Windows junction is left alone. Idempotency: vite present plus an in-place no-op `bun install`. Not run. Python must map `PREREQ_FRONTEND_PACKAGES` to `scripts/shells/linux/debian/install_shells/193_install_frontend_packages.sh`.

HF snapshot layout: `shared_cache_env.sh` now exports `HF_HUB_DISABLE_SYMLINKS=1` on every host (it was only set when the cache was the cross-OS NTFS tree), matching Windows `SharedCacheEnv.ps1`, so both OSes write plain-file snapshots; `pyservice_entry.sh` already forwards it in the worker env list.

Book seed corpus (175_laravel_main_start.sh, `ensure_book_seed_corpus`): extracts `poly_apps/laravel_main/database/seed_data/books/bible-corpus.unique.tar.xz.js` (an xz-compressed tar) into `<laravel_db>/seed_data/books/zeoinjesus-bible/` (`map_web_path "laravel_db"`), streaming `xz -dc | tar -x` into a same-filesystem temp dir and moving the top dir into place, so a partial extract never passes the presence check; `xz-utils` is installed only when xz/tar are missing; owner and mode follow laravel_db (`chown --reference`, `a+rX`). Skipped when the corpus dir already holds a `*.json`. Checked in a scratch laravel_db (68 files, second run skipped); Laravel's `sys:init` only reads the files and names step 175 when absent.

Cosyvoice sentinel aligned with Windows: `<staging>/pretrained_models/.<leaf>.model_installed` (sibling of the model dir); readiness also checks `cosyvoice2.yaml`, `llm.pt`, `flow.pt`, `hift.pt`. F5-TTS skips the Whisper ASR pipeline that `infer` loads only when `F5TTS_REF_TEXT` is empty (the server requires it).

### H2. Shell prerequisite installers (Windows)

Shared helpers (new): `pycore/tts_install_assets/hf_prefetch.py` (the Linux copy; HF hub-cache fill via `huggingface_hub.snapshot_download`, `--check` is offline) and `nltk_prefetch.py` (`nltk.download` into one dir; fails when the resource is still absent, because `nltk.download` returns False instead of raising). `win_common/TtsInstallAssetsCommon.ps1` gained `Invoke-InstallerPython` (non-zero exit is an error), `Test-HfHubFilesCached`, `Install-HfHubCacheRepo` and `Install-NltkDataResources`. HF mirror follows `Resolve-HfMirrorBase`.

| Step | Change | Official source | Idempotency check |
|---|---|---|---|
| Step52 cosyvoice | `FunAudioLLM/<leaf of cosyvoice_model_dir>` (CosyVoice2-0.5B, all files) -> `<staging>/pretrained_models/<leaf>` via `Install-HfRepoFlat`; the already-installed skip and the status-only exit now also require verified weights | https://github.com/FunAudioLLM/CosyVoice (README: `snapshot_download('FunAudioLLM/CosyVoice2-0.5B', local_dir='pretrained_models/CosyVoice2-0.5B')`) | `.CosyVoice2-0.5B.model_installed` sentinel + `Test-NeuralTtsLocalWeightsReady` (HF catalog sizes); complete files skipped, partial resumed |
| Step55 melotts | Inside the venv: NLTK `averaged_perceptron_tagger_eng`, `averaged_perceptron_tagger`, `cmudict` into `<venv>/nltk_data` (the `2>$null`/empty catch is gone); HF cache: `myshell-ai/MeloTTS-{English,Chinese}` (+ `-Japanese/-Korean/-Spanish/-French` on GPU) `config.json` + `checkpoint.pth`; BERT repos `bert-base-uncased`, `bert-base-multilingual-uncased` (tokenizer + `pytorch_model.bin`), and `tohoku-nlp/bert-base-japanese-v3`, `kykim/bert-kor-base`, `dccuchile/bert-base-spanish-wwm-uncased`, `dbmdz/bert-base-french-europeana-cased` (tokenizer files always, because `melo/text/cleaner.py` imports every language at import; weights on GPU only). Runs on the provisioned-venv fast path too | MeloTTS source `melo/download_utils.py` (`LANG_TO_HF_REPO_ID`, `hf_hub_download`), `melo/text/*_bert.py` / `english.py` / `japanese.py` / `korean.py` / `spanish.py` / `french.py` / `chinese_mix.py` (model ids), `g2p_en` 2.1.0 `g2p.py` (nltk resources), https://github.com/myshell-ai/MeloTTS/blob/main/docs/install.md | `hf_prefetch.py` skips cached files, `nltk_prefetch.py` skips found resources |
| Step53 f5tts | HF cache: `SWivid/F5-TTS` `F5TTS_v1_Base/model_1250000.safetensors` and `charactr/vocos-mel-24khz` `config.yaml` + `pytorch_model.bin`, exactly what `f5_tts.api.F5TTS()` requests (vocab ships in the package) | https://github.com/SWivid/F5-TTS (`src/f5_tts/api.py`, `infer/utils_infer.py load_vocoder`) | `hf_prefetch.py --check` gates the installed-skip; cached files skipped |
| Step59 bark | Verified, not changed: `tts_model_tiers.HF_ALLOW['bark']` covers `pytorch_model.bin`, config, tokenizer, `speaker_embeddings_path.json` and `speaker_embeddings/**/*.npy` (390 v2 presets confirmed on `suno/bark` and `suno/bark-small`). Fixed: the installed-skip and status-only exit now require verified weights (sentinel tier + size check), swallowed pip `catch { }` replaced by warnings | https://huggingface.co/docs/transformers/model_doc/bark | sentinel + `Test-NeuralTtsLocalWeightsReady` |
| Step60 parler | Verified: allow-list covers `model.safetensors`, config, `spiece.model`, tokenizer files of `parler-tts-{mini,large}-v1`. Same skip/status-only fix and swallowed-pip fix as bark | https://github.com/huggingface/parler-tts | same |
| Step54 gptsovits | NLTK `try { nltk.downloader } catch { }` replaced by `Install-NltkDataResources` (same two resources the Python check expects) | n/a | `nltk_prefetch.py` |

Second batch (STT/OCR audit), same helpers plus `pycore/tts_install_assets/ocr_models_prefetch.py` (`cn [--gpu]`, `easyocr`):

| Step | Change | Official source | Idempotency check |
|---|---|---|---|
| Step46 ocr | After the policy set: CnSTD/CnOCR weights via `ocr_models_prefetch.py cn` (roots and model set come from `_ocr_models`: CNSTD_HOME/CNOCR_HOME, PREWARM_SPEC; repo models `breezedeus/cnstd-ppocr-*` / `cnocr-ppocr-*` -> `<root>/<ver>/ppocr/<model>/`, zip models `ch_PP-OCRv3_det`, `en_PP-OCRv3_det`, `chinese_cht_PP-OCRv3` from `breezedeus/cnstd-cnocr-models` stored flat as the library reads them AND mirrored into `ppocr/<model>/` for the Python presence check, native `densenet_lite_136-gru`, `scene-`, `doc-` zips into `<root>/2.3/<model>/`). EasyOCR via the official `Reader(download_enabled=True, model_storage_directory=...)` for ch_sim+en, en, ja+en, ko+en into `EASYOCR_MODULE_PATH/model` (or `~/.EasyOCR/model`, what `EasyOCREngine.model_dir` reads) | cnocr 2.3.3 `cnocr/ppocr/{consts,rapid_recognizer,pp_recognizer}.py`, cnstd 1.2.8 `cnstd/ppocr/*`, https://cnocr.readthedocs.io/zh-cn/stable/models/, EasyOCR `easyocr/config.py` (filenames/md5), https://github.com/JaidedAI/EasyOCR | files present are skipped; verified on a scratch root: after one run `missing_ocr_models(False)` is `[]` and the rerun prints only "cached" |
| Step11 faster-whisper | The model is now downloaded on every run when the package is present (it was only done with `-Model`/`-Force`); swallowed `2>$null`/catch replaced by `Invoke-InstallerPython` (official `faster_whisper.download_model`, lands in the HF hub cache `models--*--faster-whisper-<name>` that `whisper_models.faster_whisper_weights` scans) | https://github.com/SYSTRAN/faster-whisper | `Set-FasterWhisperLocalModelInfo` finds the hub snapshot first |
| Step42 whisper | `Get-WhisperModelDownloadUrl` held wrong sha segments (broken URLs); replaced by the official `whisper/__init__.py` `_MODELS` (adds large-v1, large-v3-turbo, turbo), sha256 verified after download, file named after the URL leaf so `WHISPER_CACHE_DIR/large-v3.pt` / `large-v3-turbo.pt` match `whisper_models.whisper_weights` | https://github.com/openai/whisper (`whisper/__init__.py`) | size check against HEAD, sha256 after download; cached file skipped |
| Azure Speech SDK | No new step: `azure-cognitiveservices-speech` is in `DEPENDENCY_MAP` and installed by the central `installer` policy set that the python_prereqs step (`Install-PycoreDependencyMapPackages`) runs | pip package `azure-cognitiveservices-speech` | policy set installs only missing distributions |

Third batch (binaries, dual-boot layout audit):

| Item | Change | Source |
|---|---|---|
| Step67 ffmpeg (new) | Idempotent: `ffmpeg` + `ffprobe` on PATH -> kept; else the catalog entry `FFmpeg` (winget `Gyan.FFmpeg`, `ForceToInstallDir`) through `Step21_InstallApplications.ps1 -ExactPackageName FFmpeg`, PATH refreshed and verified. Python presence check: `shutil.which('ffmpeg')` | https://www.gyan.dev/ffmpeg/builds/ (winget `Gyan.FFmpeg`) |
| Step68 scrcpy + adb (new) | Official Genymobile v3.3.4 `scrcpy-win64-v3.3.4.zip`, sha256 verified against the release asset `SHA256SUMS.txt`, flattened into `$env:SCRCPY_HOME` = `<CN_TOOL_ROOT>\scrcpy` (program-drive tool root, D: fallback with the shared warning). Present check: `scrcpy.exe`, `adb.exe`, `scrcpy-server` non-empty. `SCRCPY_HOME` is exported once by `SharedCacheEnv.ps1`; both steps are registered in `InstallerScriptsList.ps1`, `PycorePrerequisitesList.ps1` and `WinScriptsInstaller.ps1` | https://github.com/Genymobile/scrcpy/releases/tag/v3.3.4 |
| Layout audit | Weights: HF hub cache, `WHISPER_CACHE_DIR`, `ocr\cnstd`/`ocr\cnocr` (via `_ocr_models`), `ocr\easyocr` (`EASYOCR_MODULE_PATH`, new, same relative path as `shared_cache_env.sh`), cosyvoice/bark/parler staging (`PYCORE_LOCAL_DATA_DIR` = `<WWW_CACHE_DIR>\pycore`) all sit under `D:\www\cache`; no `%USERPROFILE%` cache is used. Tools (scrcpy, ffmpeg install dir, venvs) follow `CN_TOOL_ROOT`. HF downloads try the official Hub first and the mirror only as fallback (`Invoke-InstallerPythonHfEndpoints`). Step52 readiness now also requires `cosyvoice2.yaml`, `llm.pt`, `flow.pt`, `hift.pt` (what `cosyvoice_engine.model_ready` checks); sentinel stays the sibling `.<leaf>.model_installed`, same as Linux 133 | `docs_fix/REQUIREMENTS_20260927_DUAL_BOOT_DRIVE_LAYOUT.md` D26/D30 |

Shared-path follow-up: NLTK data now installs into the shared tree `<WWW_CACHE_DIR>\nltk_data` (`NLTK_DATA` exported once by `SharedCacheEnv.ps1`, same as Linux) for Step55 melotts and Step54 gptsovits (resources `averaged_perceptron_tagger_eng`, `averaged_perceptron_tagger`, `cmudict`), not `<venv>\nltk_data`; `tts_server_launch._missing_gptsovits_nltk_data` still checks the venv dir and must follow to `NLTK_DATA`. The EasyOCR helper no longer falls back to `~/.EasyOCR`: without `EASYOCR_MODULE_PATH` it resolves `<shared cache>/ocr/easyocr` through `get_shared_download_cache_dir`. Confirmed weight paths (Windows installers = what pycore resolves): chattts/bark/parler/voxcpm2/qwen3tts `<C>\pycore\<engine>\weights` + `.model_installed`; cosyvoice `<C>\pycore\cosyvoice\pretrained_models\<leaf>`; fishspeech `<C>\pycore\fishspeech\checkpoints\<name>`; melotts/f5tts the HF hub cache; kokoro `<C>\tts\kokoro` (no Windows step writes `<C>\tts\sherpa`); vosk `<C>\stt\vosk`; Ollama `OLLAMA_MODELS` else `<C>\<local_ai.ollama_models_subdir>`; faster-whisper HF hub cache; whisper `WHISPER_CACHE_DIR`; EasyOCR `<C>\ocr\easyocr\model`; CnSTD/CnOCR `<C>\ocr\{cnstd,cnocr}` (`<C>` = `D:\www\cache`).

Frontend dependencies (corrected: the UI is a bun workspace, `bun.lock`; the earlier pnpm-based Step48 was wrong and is replaced): `Step69_InstallFrontendPackages.ps1` (prerequisite key `frontend_packages`, same as Linux `193_install_frontend_packages.sh`) targets the one workspace `poly_apps/pycore_laravel_wordnew_ui` (`callmodule_config.FRONTEND_DIR`: pycore-manager, vortex, pdd-manager, ...). It junctions `node_modules` to the E: trees root through `Invoke-ProjectTreeLinks` (shared notice and in-repo directory without E:), then runs the UI's own idempotent policy through the new `scripts/start.ps1 -Prepare` switch (twin of `start.sh --prepare`: node + bun, `bun install` converges against `bun.lock`, legacy `.pnpm` layout rebuilt once, vite verified, no server started). A failure marks the step pending. `Step48_InstallDesktopManager.ps1` now only forwards to Step69.

Sherpa offline TTS: new `Step70_InstallSherpa.ps1` (key `sherpa`, `SHERPA_SKIP=1`), twin of `31_install_tts_offline.sh`: installs `sherpa-onnx` and the Kokoro multi-lang model (`tts_model_tiers.kokoro_url`: GPU full model, CPU int8; official https://k2-fsa.github.io/sherpa/onnx/tts/all/Chinese-English/kokoro-multi-lang-v1_1.html) into `SHERPA_TTS_MODEL_DIR` else `<C>\tts\sherpa` (what `sherpa_engine.model_dir()` reads). Idempotent: `.model_installed` sentinel plus onnx and `tokens.txt` present; partial archive resumed with `curl -C -` and a Content-Length check.

Book seed (sys:init): `Ensure-LaravelBookSeedExtracted` (new, `win_common/FrankenPhpManager.ps1`, plus getter `Get-FrankenPhpLaravelDataDirectory` = `<www base>\wwwroot\laravel_db`) is called by `Step175_LaravelMainStart.ps1` before its admin gate. It copies `poly_apps\laravel_main\database\seed_data\books\bible-corpus.unique.tar.xz.js` as `.tar.xz` into `<laravel_db>\seed_data\books\.extract_work`, extracts with the Windows `System32\tar.exe -xJf` (else an installed 7z, two passes), checks `zeoinjesus-bible\*.json`, then moves it to `<laravel_db>\seed_data\books\zeoinjesus-bible`, so a partial extraction never passes. Idempotent: skipped when that directory already holds a `*.json`. Nothing new is installed.

Verification: every touched script parses clean with the PowerShell parser (0 errors), CRLF preserved; both helpers pass `py_compile`. Installers were not run. Notes for others: `cosyvoice_engine.model_dir()` only checks `is_dir()`, so a partially downloaded dir reads as ready (the installer's sentinel is not consulted); the melotts docker backend (Step55 docker path) is unchanged and relies on its own `model.sh`. Whisper/OCR/ffmpeg/adb steps: pending coordinator input.

### I. Laravel <-> pycore alignment

**Binding rules (LARAVEL_GUIDE §1):**
- **pycore boundary.** Laravel never calls pycore; only pycore requests Laravel.
- **AI gateway.** Keyed or remote AI (chat, translation, vision, image, AI capability) runs in Laravel through one gateway. pycore gets only local-compute work (OCR, TTS/STT, GPU/CPU-heavy work).
- **pycore_unavailable.** A compute request with no suitable online pycore gets a uniform typed answer.
- **Compute class.** Laravel schedules compute tasks by each pycore's reported class.

This supersedes the RPC client I built earlier the same day. Before that client, every Laravel -> pycore call was already broken: they used dead paths such as `/health`, `/api/call`, `/ocr/*` and `/api/local/ai/*`.

**Touchpoints (one direction only: pycore -> Laravel).**
- All `config/queue_center_contract.json` endpoints exist with the methods pycore uses: worker register / pull / accept / result / release (heartbeat and unregister are kept for mcp-chrome), the queue-center reads, the 14 `audio_*`/`orch_*` routes, `laravel_health`, `media_ingest*`, `media_subtitles` and `assist_requests`.
- `submitResult` and the TTS report routes match the outbox: 200 accepted, 404 gone, 409/422 terminal, 5xx only on faults.
- Media ingest accepts only model_version 3 (the v1/v2 `sentences`/`words` fold is gone).

**Compute tasks for pycore.** `task_types[].compute` uses C's classes; `offline_policy` decides queue or reject when no pycore is online.

| task_type | execution | compute | offline | payload -> result | Laravel side |
|---|---|---|---|---|---|
| `ocr_recognize` (new) | remote_ocr | cpu_ok | reject | `{image_data b64, image_sha256, model_type, engine?, lang?, languages?, client_task_id?}` -> pycore recognize payload | `PycoreTasks\OcrRecognizeTask`; OCRController, McpV1OCRCtl, VoiceSubtitleProcessor |
| `tts_synthesize` (new) | remote_compute | cpu_ok (edge) | queue | `{text, language, voice, rate, volume, pitch, text_type, relative_path, cache_key, provider: edge, client_task_id?}` -> `{audio_base64, ...}` | `EdgeTTSService::generateAudio` on a cache miss; `TtsSynthesizeTaskProcessor` writes the file; TTSController, WordLookup and Translation audio embed the view; VoiceSubtitle |
| word_audio | (existing) | cpu_ok | queue | unchanged | unchanged |
| sentence_audio, article_audio | (existing) | gpu_preferred | queue | unchanged | unchanged |
| stt, audio_transcribe, subtitle_search | (existing) | gpu_preferred | queue | unchanged | unchanged |

Browser-claimed types get `compute: cpu_ok` and are never filtered.

**Removed task types:**
- `text_translation`: Google translation is now Laravel's keyless `AiGateway\GoogleTranslateClient`. Its primary endpoint is translate.googleapis.com (translation plus romanization); the fallback is clients5 dict-chrome-ex, because this host gets HTTP 429 from the primary. Results are cached 30 days per input, and items keep pycore's translate shape.
- `ai_status`: the AI status panel now reports `image_gateway.image_capable` from `AiGateway::hasImageProvider()`.

**Interface (sent to F, B, C and main).**
- **Queued:** HTTP 202, `{success: true, message, data: {..., pycore_task: {status, task_id, task_type, client_task_id, required_compute, poll: /api/task/{id}/status, last_error?}}}`.
- **pycore_unavailable:** the `errorWithCode` envelope with `error_code: pycore_unavailable` and a Retry-After header. `data = {task_type, required_compute, registered_pycores, eligible_pycores, last_seen_at, heartbeat_ttl_seconds, disposition: queued|rejected, task_id, client_task_id, retry_after_seconds}`. HTTP 202 when queued, 503 when rejected.
- **Completed:** the domain result. Repeating a request with the same input or `client_task_id` returns it.
- **Batch OCR:** a top-level `results[]` holding per-item views.
- **client_task_id** (at most 128 chars, `[A-Za-z0-9._:-]`) is accepted on the OCR and TTS generate routes. It becomes the dedup group key and is copied into the payload.

**One implementation.**
- `PycoreTaskQueue::request` (dedup, availability, offline policy, client_task_id) and `::response` / `::embed` produce every shape.
- `PycoreComputeRoster` does the scheduling:
  - **Online** means `isAlive()` within `task_contract.limits.worker_heartbeat_ttl_seconds` (120), which replaces the hardcoded `Worker::HEARTBEAT_TIMEOUT` everywhere, and status not offline.
  - **pycore** means a worker with `metadata.compute_class`.
  - **Class rule:** gpu_required means gpu only. gpu_preferred: cpu_only claims only while no fresh gpu pycore of that execution type has spare lease capacity.
  - **Load rule:** a pycore whose in-flight count exceeds the least-loaded same-class peer's by at least that peer's lease capacity gets nothing.
- **Hooks in the existing paths:**
  - WorkerController register and pull accept `compute_class` (gpu|cpu_only), `gpu_name` and `gpu_vram_mb` into metadata.
  - pull returns no tasks when `mayClaim` is false; accept answers 409 when the class cannot run the task (`canRun`).
  - QueueCenterController diff and page-data take `worker_id` and `compute_class` and return empty ids/items to an ineligible pycore.
  - `TaskManagerService::createTaskOnce` is the shared dedup creator; `QueueCenterService::enqueue` uses it.
- **Not yet true:** `PycoreTaskQueue` checks `ocr_recognize` and `tts_synthesize`. The existing lanes are scheduled in pull/diff but are still enqueued by their own producers without the unavailable answer.

**AI gateway status.** `App\Services\AiGateway` already existed:
- key loading (`AiSecretLoader`), multi-key rotation (`AiKeyRotation`), provider registry and capabilities (`AiProviderRegistry`);
- free-first image and text dispatch with cooldowns, and `AiRateLimiter` on the shared `ai_rate_usage.json` (OpenRouter rpd 1000).

Added:
- the OpenRouter free-only rule (`OpenRouterFreeOnly`), enforced in `AiChat::chatCompat`, `OpenRouterClient::chatCompletion` and `AiGateway::imageOpenRouter`, with the coded `AI_PAID_MODEL_REFUSED {provider, model}` and `AI_FREE_IMAGE_MODEL_UNAVAILABLE {provider}` (`error_code` plus `error_params`, lang `ai_gateway.php`);
- `GoogleTranslateClient`.

Not merged yet: the older direct clients (`OpenRouterClient`, `GeminiClient`, `DeepSeekClient`, used by TranslationService, `AIServiceDispatcher` and `UnifiedAIRouter`) still sit beside the gateway. Merging them is open.

**Merge audit.**

| merged-into | variants removed | newest-source | capabilities ported | dropped + why |
|---|---|---|---|---|
| `PycoreTaskQueue` + `PycoreComputeRoster` | `PycoreHttpClient`, `PycoreRpcContract`, `HttpTransfer`, `PycoreRpcException` (10-01), `PycoreCaller` (2025-11-21), `PycoreUrlFinder`/`PycoreAiClient`/`PycoreUrlDiscoveryTask` (08-23), OctaneTimerStatus pycore block, `/api/octane/timer/pycore/*` | 10-01 | every local-compute call became a task, with dedup, typed errors (task error/last_error), `pycore_unavailable` and scheduling | discovery, signing and progress transfer (no Laravel -> pycore traffic) |
| `GoogleTranslateClient` | `PycoreTranslatorUtil`, my `TextTranslationTask` | 10-01 | single and batch, src/dest, cache, item shape, per-item errors | `detectLanguage` and `googleTranslateWord`/`Batch`/`isWordValid` (zero callers); romanization on the fallback endpoint |
| `OcrRecognizeTask` | `PycoreOCRUtil`, `Utils\OCRUtil` | 10-01 | image and batch, `MODEL_TYPES`, engine/lang/languages, base64 transport | live engine panel (`describe()` reports the contract) |
| `EdgeTTSService` + `TtsSynthesizeTaskProcessor` | `PycoreEdgeTTSUtil`, the local `python -m edge_tts` path, `EdgeTTSChecker` | 10-01 | voices, rate/volume/pitch, text types, file and payload cache, zero-byte checks, voice override; `getConcurrentCount` counts in-flight tts tasks | binary assist runs nothing locally (directive; the setting stays readable) |
| `AiGateway::hasImageProvider` | `PycoreAiClient`, my `AiStatusTask` | 10-01 | image capability | the pycore gateway panel |
| `AppQyV1ProcessingCapabilityController` | ffmpeg / nvidia-smi shell probes | 10-01 | load and document recommendation | `ffmpeg`/`gpu` fields; video is always pycore |
| `Worker::heartbeatTtlSeconds()` (contract) | `Worker::HEARTBEAT_TIMEOUT` constant | 10-01 | same 120 s | none |

**Approved exception.** `app/Console/Commands/OctaneTimerStatus.php`, edited under the user's one-off exception: the pycore block was removed.

**Pending deletion** (classifier blocked `rm`; all unreferenced; the timer is disabled through `isEnabled()`):
- `app/CallPycoreUtils/`
- `app/Support/PycoreRpcContract.php`, `app/Support/HttpTransfer.php`
- `app/Services/PycoreAiClient.php`
- `app/Services/TimerTasks/PycoreUrlDiscoveryTask.php`
- `app/Services/EdgeTTS/EdgeTTSChecker.php`

My own untracked files from this session (`TextTranslationTask`, `AiStatusTask`, `AiStatusTaskProcessor`) were removed.

**Contract changes** (`queue_center_contract.json`):
- `compute` and `offline_policy` on every task type (validated in `QueueCenterContract::assertTaskTypeContract`);
- `ocr_recognize` and `tts_synthesize`; `text_translation` and `ai_status` were removed;
- `limits.worker_heartbeat_ttl_seconds` (120) and `limits.pycore_unavailable_retry_seconds` (30);
- `http_transfer` keepalive keys (read by pycore).

`pycore_rpc_contract.json` `protocol_routes` is read only by E. Lang: `pycore.php`, `ai_gateway.php`, `api.messages.task_compute_class_mismatch`, `app_qy_v1.messages.processing_video_pycore`.

**Coordination.**
- B: compute field names agreed. B builds pullers for `ocr_recognize`/`tts_synthesize` and sends `compute_class`. The pycores must list the execution types in `processor_types`, because the roster counts pycores per execution type.
- C: handlers and compute classes.
- F: response shapes and route list. ui-domains was the wrong recipient and has been corrected.

**Verification.**
- `php -l` passes on every changed file.
- `php artisan route:list` lists 1089 routes.
- Read-only tinker checks:
  - contract compute/offline/limits;
  - roster availability (0 registered pycores, because pycore does not send `compute_class` yet);
  - Google translation (fallback endpoint works; primary returns 429 here);
  - `OpenRouterFreeOnly` codes;
  - `octane:timer-status`.
- No tasks were created locally (no DB writes), and no services or tests were run.

**Behaviour until B ships `compute_class`.** No pycore counts as registered:
- `ocr_recognize` answers 503 `pycore_unavailable`;
- `tts_synthesize` queues with 202 `pycore_unavailable`;
- the existing lanes are unaffected, because workers without a compute class are not filtered.

**Open.**
- Internal background producers (DictLane materialization, the UnifiedTTS miss path) have no HTTP caller to answer; their tasks wait in the queue.

**Round 4 (user decisions, idempotency, AI client merge).**
- **Idempotency.** `PycoreTaskQueue::clientTaskId()` reads body `client_task_id`, else the `Idempotency-Key` header (same pattern). A repeated key returns the same live task, its completed result, or a re-queued task. Limit: a run done directly on pycore under the same key reaches Laravel only if pycore posts it. Laravel cannot see direct pycore results otherwise.
- **AI gateway merge** (done by a fork of this workstream):
  - Deleted: `OpenRouterClient`, `GeminiClient`, `DeepSeekClient`, `AIServiceDispatcher`, `AI\OpenRouterClient`, `AI\DeepSeekClient`, `AI\MultiKeyAIClientBase`, `AI\UnifiedRateLimiter`.
  - Every caller uses `AiGateway::chatWith/generateText/describeImage/generateImage`. No direct provider HTTP call remains outside `app/Services/AiGateway`.
  - `UnifiedAIRouter` keeps only `getProvidersStatus()`, rebuilt on the gateway, because `app/Console/Commands/InitializeApps.php` still calls it.
  - OpenRouter is free-ONLY through one definition, `OpenRouterFreeOnly::isFreeModel` (`:free`, zero prompt and completion pricing, or `openrouter/free`). It is used by catalog filtering, chat (AiChat, AiSdkChat, the free `models` fallback list) and image (a free image-output model from the cached catalog, else `AI_FREE_IMAGE_MODEL_UNAVAILABLE`). `hasImageProvider()` counts OpenRouter only while a free image model exists.
  - Paid models are refused with `AI_PAID_MODEL_REFUSED` before any key or rate budget is used. One early test refusal counted once against the shared counter before that fix.
  - Bug fixed: the old clients returned `"Error: ..."` as a plain string, which `translateViaProvider` reported as a successful translation.
- **sys:init book seed.** `AppQyV1BookSeedImporter` reads `<laravel_db>/seed_data/books/zeoinjesus-bible/*.json`. Laravel runs no tar/xz/7z or apt-get any more. A missing corpus is a warning that names `175_laravel_main_start.sh / Step175_LaravelMainStart.ps1` (lang `book_seed_corpus_missing`). Extraction spec (source blob, target, presence check, atomic move, tools) was sent to shell-linux-installs and shell-windows-installs.
- **SystemInfoService.** Tool-version probes are cached per tool for 24 h (`system_info:tool_version:<tool>`).
- **Light local work.** `App\Support\ResourceLimiter` is the one cap: 5% CPU and 5% RAM.
  - Spawned tools run in a transient systemd scope (`CPUQuota` = 5% x cores, `MemoryMax` = 5% of RAM). Without systemd-run, the fallback is prlimit + nice/ionice + cpulimit. The scope was verified on this host.
  - Windows has no PHP-reachable cap, so the endpoints that spawn tools answer `platform_unsupported` (501) there: ItToolsV1 PDF split/merge/compress/rotate/add-password, which ApiInfo lists as `linux-only`, and 7z/tar extraction in the AppQyV1 media archive processors (zip stays in-process).
  - In-process GD (`ImageProcessUtil::createImageFromFile`, the new `createFromBytes` used by AvatarService, CommonAvatarService, PostMedia and McpV1Placeholder) refuses a bitmap larger than the memory share before decoding.
  - No `pdf_process` pycore task.
- **API inventory.** `App\Support\ApiComputeCatalog::classify(path)` is merged into every ApiInfo endpoint by `ApiInfoIndex`, so `/api_info` shows `pycore_required`, `compute` (none | light | pycore), `pycore_task_type` and `platforms`.
  - **pycore_required:**
    - OCR: `/api/ocr/recognize`, `/api/ocr/recognize-batch`, `/api/mcp/v1/ocr/{recognize,smart-recognize,batch}`;
    - TTS: `/tts/generate`, `/tts/batch-generate`;
    - audio lanes: `/api/app_qy_v1/ai_tools/tts/{generate,batch-generate,queue*,sentence/*}`, `/api/queue-center/queues/*/head*`.
  - **light:**
    - ItTools `advanced/image/*` (GD) and `advanced/pdf/*` (linux-only);
    - post images, user avatar, `mcp/v1/placeholders/generate`, `public/avatar/*`;
    - `app_qy_v1/system/(re)initialize`.
  - **Everything else is `none`:** data and CRUD, the keyed-AI gateway (`/api/local/ai/*`, translation including Google, AI status), the queue-center reads and the worker API. Endpoints that only optionally pre-generate audio (lookup, learning, translation audio) are `none` and embed the queued view.
  - The list was sent to F.
- **Roster check.** B's fields are accepted on register and pull. A `cpu_only` pycore satisfies `cpu_ok`, so it can be offered `ocr_recognize`/`tts_synthesize` (subject to the load rule). The local DB has no compute-class pycore registered (the live server is remote), so this was checked by code path, not data.
- **Verification.** `php -l` passes on all changed files and `route:list` lists 1089 routes. `/api_info?app=ItToolsV1` shows the classification. The `ResourceLimiter` command was built and a systemd scope ran.

**Round 5 (lane gaps, direct-API marker, OCR upload).**
- **Existing lanes.** The same availability logic now covers them:
  - `PycoreTaskQueue::availabilityView(taskType, taskId)` returns null when the type is not claimed by pycore or a suitable pycore is online. Otherwise it returns the uniform `pycore_unavailable` view. Disposition: queued when a task exists, else per offline_policy.
  - `PycoreTaskQueue::mayEnqueue()` applies offline_policy before creating a task.
  - Wired into: `QueueCenterService::moveToHead`/`schedule` results (so the queue-center head and head/batch per-item results and the audio gateways carry it), the generic `/api/task` create (`TaskController`) and `AppQyV1TaskEnqueueController` (202 queued with the view, or the 503 reject for reject-policy types), and `intelligentBatchQuery` (`pycore_lanes` for word_audio/sentence_audio).
  - `PycoreComputeRoster::availability` is memoised for 5 s per worker process, so a batch reads the roster once.
- **Learning cards** (`/api/app_qy_v1/learning/words`): each card has `audio_task` (queued or unavailable view) while its word audio is a pending pycore task.
- **Image capability.** `hasImageProvider()` applies the free-only rule (done in the gateway merge): OpenRouter counts only while `OpenRouterFreeOnly::freeImageModel()` finds a free image model.
- **Direct-API marker** (marker only, no switch). Each contract `task_types[]` entry has `direct_api_capable` and `direct_api_kinds`:
  - true: ocr_recognize [ocr]; tts_synthesize, word_audio, sentence_audio, article_audio [tts]; stt, audio_transcribe, subtitle_search [stt];
  - false for all others.
  - `QueueCenterContract::taskTypeDirectApi()` reads it, and `ApiComputeCatalog` derives `direct_api_capable` / `direct_api_kinds` per endpoint from the endpoint's `pycore_task_types`, so `/api_info` carries them. The data lives in one place.
- **OCR upload shape.** `POST /api/ocr/recognize` accepts `{image_data (base64 or data URL) | image_path, model_type?, engine?, lang?, languages?, client_task_id?}` (`OcrRecognizeTask::recognizeBytes` / `decodeImageData`). No auth header.
- **Book seed shell steps are done.** Linux `175_laravel_main_start.sh` has `ensure_book_seed_corpus` (tested on a scratch laravel_db: 68 files, and a rerun skips). Windows `Step175_LaravelMainStart.ps1` has `Ensure-LaravelBookSeedExtracted` (parses, not run).
- **Verification.** `php -l` passes on all changed files and `route:list` lists 1089 routes. Read-only checks: lane availability view (sentence_audio queued/gpu_preferred with 0 pycores registered locally), `mayEnqueue(ocr_recognize)` false offline, browser types unaffected, and the catalog markers.

**Round 5 follow-ups.**
- **Paid default image model removed.** The registry's OpenRouter `image_model` is now `''`. The model is always picked from the free image catalog (`OpenRouterFreeOnly::freeImageModel`), else `AI_FREE_IMAGE_MODEL_UNAVAILABLE`.
- **Learning audio status.** Learning cards carry `audio_task` (queued or unavailable view); see Round 5.
- **Security, open (pre-existing, user decision).** The compute endpoints have no authentication:
  - `/api/ocr/*` and `/api/mcp/v1/ocr/*`: `api` middleware only;
  - `/tts/generate` and `/tts/batch-generate`: `web`.
  - They were unauthenticated at 605d08b25 too: `routes/api_ocr.php` is unchanged and documents "No authentication required for local MCP bridge access".
  - This session widened the exposure. `/api/ocr/recognize` now also accepts an uploaded base64 `image_data` (up to 8 MiB) and creates pycore compute tasks, where it used to accept only an existing server file path.
  - Auth semantics were not changed without the user. Suggested options: client-key-or-dashboard or Sanctum on these routes, a per-IP throttle, or both.

**Round 6 (compute auth, UnifiedAIRouter, deployment).**
- **Compute routes now require auth.** `ApiComputeCatalog::AUTH_MIDDLEWARE` = `client.key_or_dashboard:user` + `throttle:compute`. This reuses the existing `ClientKeyOrDashboard` middleware: a K3 signature with `CORE_NODE_CLIENT_KEY_1` is checked by `ClientKeyAuthService`, otherwise `LocalDebugOrSanctum` accepts a user session (or the loopback debug bypass). No second verifier was written.
  - Throttle: `RateLimiter::for('compute')`, 30 requests per minute per user, else per signing machine, else per IP.
  - Anonymous remote calls get 401 `{code: AUTH_REQUIRED}`; a bad signature gets the coded `client_key_*` 401.
  - Protected routes (all previously anonymous):
    - OCR: POST `/api/ocr/recognize`, `/api/ocr/recognize-batch`, `/api/mcp/v1/ocr/{recognize,smart-recognize,batch}`;
    - voice subtitle: POST `/api/mcp/v1/voice-subtitle/{add,add-text,add-image,add-voice}` (OCR/TTS producers);
    - TTS: POST `/tts/generate`, `/tts/batch-generate` (registered in the immutable `routes/web.php`, so the middleware is attached through `TTSController implements HasMiddleware`);
    - audio heads: POST `/api/app_qy_v1/ai_tools/tts/sentence/audio/head`, `/api/app_qy_v1/word/audio/head`;
    - ItTools: POST `/api/ittools/v1/advanced/image/{resize,rotate,flip,extract-colors,convert,compress,crop}` and `/api/ittools/v1/advanced/pdf/{split,merge,compress,rotate,add-password}`;
    - placeholders: POST `/api/mcp/v1/placeholders/generate` (web.php, so `McpV1PlaceholderCtl implements HasMiddleware`);
    - system init: POST `/api/app_qy_v1/system/initialize`, at admin level (`AUTH_MIDDLEWARE_ADMIN`).
  - `GET /api/public/avatar/{name}` stays public, because browsers load it as an `<img>`; it gets only `throttle:compute`.
  - Already protected, unchanged: the queue-center heads and the TTS queue producers (`ClientKeyOrDashboard` or Sanctum), `/api/task/create`, `/api/app_qy_v1/ai_tools/task/enqueue`, post images and user avatar (Sanctum), `system/reinitialize` (client token).
  - ApiInfo: `ApiComputeCatalog` adds `auth: client_key_or_session | public_throttled` to these endpoints in `/api_info`.
  - Verified in-process with a non-loopback REMOTE_ADDR: unsigned OCR, TTS and PDF calls return 401 AUTH_REQUIRED; a K3-signed OCR call passes auth and reaches validation (400).
- **UnifiedAIRouter deleted.** Its `getProvidersStatus()` moved to `AiGateway::providersStatus()`. `app/Console/Commands/InitializeApps.php` was edited under the user's one-off Console exception (import plus one call line).
- **Production version skew** (the live pycore gets 404 "Unknown task type: tts_synthesize"). The live Laravel needs these in the same deploy:
  1. `poly_apps/laravel_main/**` (auto-sync or `./pyservice codesync`), and the repo-root `config/queue_center_contract.json`. Laravel reads it from `<core_node>/config/`, outside `laravel_main`, so it must be synced too. It holds `ocr_recognize`/`tts_synthesize`, compute/offline_policy/direct_api keys, the limits and the http_transfer keepalive.
  2. Restart the Octane/FrankenPHP workers (`ncore-laravel-main`) after the contract lands, plus `php artisan optimize:clear` if config or route caches are used. `QueueCenterContract` keeps the parsed contract in a static for the life of each worker, so the old task list survives until the workers restart.
  3. No migration or sys:init for workstream I: compute fields live in worker metadata, and the live-group-key unique index already exists. sys:init is still needed for A's `global_relay_ledger`.
  4. Run step 175 once on the server (book seed corpus to `<laravel_db>/seed_data/books/zeoinjesus-bible`) before sys:init seeds books.
  5. Secret: the live server's `CORE_NODE_CLIENT_KEY_1` must match pycore and wordnew, because compute routes now require the K3 signature.
  6. Post-deploy checks:
     - `php artisan tinker --execute='echo App\Support\QueueCenterContract::taskTypeExecution("tts_synthesize");'` prints `remote_compute`;
     - `POST /api/worker/tasks/tts_synthesize/pull` from pycore returns 200;
     - `route:list` shows the compute middleware.

**Round 7 (independent merge-audit fixes #2, #3, #4, #13, #14).**
- **#2 Sampling and timeouts.** The gateway's own defaults are unchanged: they predate the session (605d08b25) and are `OpenAiCompatClient::DEFAULT_SAMPLING`, temperature 0.7 / max_tokens 2048. The merged direct-client callers get their old values back as per-provider data:
  - registry `direct_sampling`: OpenRouter `{temperature: 1.0, top_p: 1.0}`; DeepSeek and Gemini none; never max_tokens;
  - it is passed through `AiGateway::chatWith(..., $timeout, $sampling)` -> `AiChat::chatOnce` -> `OpenAiCompatClient::chatCompletion(?array $sampling)`.
  - TranslationService (all chat paths, including the probe) and SentenceEnrichmentService use `AiGateway::directSampling($provider)` and `DIRECT_CLIENT_TIMEOUT_SECONDS` = 300. VoiceSubtitleProcessor's vision and rewrite calls use 300 s, as `AIServiceDispatcher` did; it sent no sampling for Gemini.
  - Timeouts: a 15 s connect bound plus the per-call timeout on the non-streamed JSON reply. Provider calls are not streamed, so nothing is cut mid-stream. The old per-call values are restored, not a new fixed total.
- **#3 Sync guarantee in background jobs.** `PycoreTaskQueue::await($view)` waits on a pending pycore task with no total deadline. It ends:
  - on completed or failed;
  - with the `pycore_unavailable` view when the task is still pending and no suitable pycore is online;
  - as stalled when status / progress / updated_at do not change for the worker heartbeat TTL (120 s).
  - VoiceSubtitleProcessor uses it for TTS clips (`callEdgeTTS`, then reads the stored file) and the OCR fallback (`processImage`). On unavailable, failed or stalled, the step is reported `failed` with the reason and the `pycore_task` / `pycore_unavailable` view, then the job throws. Nothing is skipped silently.
  - The voice task now also ends `failed` (Round 8 bug fix).
- **#4 Free catalog cache.** `OpenRouterFreeOnly::freeCatalog` caches only a successful, non-empty fetch. On a fetch failure or an empty result it falls back to the registry free ids for text (as `OpenRouterClient::getFallbackModels` did), uses an empty image catalog, and fetches again next time.
- **#13 Dropped budgets, recorded.** Not ported:
  - GeminiClient's per-key `RATE_LIMITS` (rpm 25, tpm 250000, rpd 100) through `UnifiedRateLimiter::acquire` (per-key minute/day request and token windows);
  - the per-key multiplier.
  Why:
  - the single limiter is `AiRateLimiter` on the shared `ai_rate_usage.json`, which pycore writes too. It counts requests per provider, not tokens or keys; adding token accounting on one side only would desynchronise the two runtimes.
  - its Gemini budget (rpm 5, rpd 20) is stricter than the old per-key 25/100, and 250k TPM cannot bind at 5 rpm unless a request averages more than 50k tokens.
  - extra keys add failover (`AiKeyRotation`), not budget.
  - `UnifiedRateLimiter`'s other user (`UnifiedAIRouter::request`) had no caller.
  Merge-table row: `AiRateLimiter` | `UnifiedRateLimiter`, GeminiClient per-key budget | AiRateLimiter (shared with pycore) | request rpm/rpd per provider | TPM/TPD windows and the per-key multiplier (reasons above).
- **#14 client_task_id dedup.** The group key stays the client key, so a repeat finds the same task. The task payload stores `input_sha1` (the input identity hash). A reused key with a different input returns 409 `client_task_id_conflict` naming the existing task_id (`PycoreTaskQueue::response`). Tasks without the field (older ones) match.
- **Verification.** `php -l` passes on all changed files and `route:list` lists 1089 routes. Read-only checks: `directSampling(openrouter)` = `{temperature: 1, top_p: 1}`, deepseek `[]`, free catalog 20 entries. `await` was not exercised (no local pycore tasks; no DB writes).

**Round 8 (CORS, signed-route data, voice task bug).**
- **CORS for K3 headers: confirmed, no change needed.** `config/cors.php` has `allowed_headers: ['*']` with `supports_credentials: true` and the contract `corsOrigins`. Laravel's CORS middleware echoes the requested headers on preflight. Checked in-process: OPTIONS `/api/ocr/recognize` from `http://debian:13054`, requesting all eight `X-Core-Node-*` headers plus `Idempotency-Key` and `Content-Type`, returns 204 with those headers allowed, `Allow-Credentials: true` and the origin echoed. A front proxy (FrankenPHP/Caddy, tailnet) that answers OPTIONS itself would need the same; check on the server.
- **Signed-route list as data.** `/api_info` now carries `client_key_routes`: `[{method, path, auth: client_key | client_key_or_session}]`. `ApiComputeCatalog::signedRoutes()` derives it from the live route table, including controller `HasMiddleware`, so the UI can derive its list instead of copying it (134 entries today, including the pycore worker and queue-center routes). Per-endpoint `auth` also stays in the ApiInfo entries. `/api_info` needs an admin session, but a logged-out client must know what to sign, so the same list is also served publicly: `GET /api/public/client-key-routes` returns `{success, data: {client_key_routes}}` with an ETag, `Cache-Control: public, max-age=300` and `throttle:compute`. I chose an endpoint over a generated config file because it cannot drift from the route table.
- **Bug fix: a voice-subtitle task stayed "processing" after a failed step.** `VoiceSubtitleTaskManager::runPipeline()` runs the background pipeline and, on any exception, calls `failTask` with the reason on the failed step (else the running one). The task now ends `failed`. The controller's terminating callback uses it; the pipeline steps are otherwise unchanged.

**Round 9 (one AI provider catalog).**
- **Merged.** `App\Services\AI\AiConfiguration` (the laravel/ai SDK provider config) and its enums `AiProvider` / `AiCapability` (all 2026-08-18) are merged into `AiGateway\AiProviderRegistry` (2026-08-23, newest).
  - The SDK view is data in the registry: `SDK_DEFAULTS` and `SDK_PROVIDERS`. Each SDK name maps to a registry provider; `qwen` maps to `dashscope`, and `claude-code` and `openrouter-free` are aliases of `anthropic` and `openrouter`.
  - The data covers driver, model defaults with their override secrets, base-URL override secret, capabilities and extras.
  - New registry methods: `sdkConfig()` (what `config/ai.php` returns), `sdkProviders()` and `refreshSdkRuntime()`.
  - Keys come from the registry `key_base` and default URLs from the registry `base_url`.
- **Callers updated in the same step:** `config/ai.php` and `AiSdkChat` (`capabilities()`, `send()`). The gateway, `OpenRouterFreeOnly` and the status controllers already read only the registry. `/api_info` has no catalog-specific metadata.
- **Semantics unchanged.** `AiConfiguration::get()` and `AiProviderRegistry::sdkConfig()` were compared key-sorted before the deletion and are IDENTICAL: defaults, the openrouter-free text default, the claude-code bearer rule, the Gemini models and embedding dimensions, OpenAI `store: false`, and capabilities. Routing, priority and free-only rules were not touched.
- **Dropped:** the two enums and the URL constants. They duplicated the registry provider names and base URLs; capability names are now the same strings, held as data.
- **Deleted:** `AiConfiguration.php`, `AiProvider.php`, `AiCapability.php`, and the now-empty `app/Services/AI/` directory.
- **Merge-table row:** `AiProviderRegistry` (SDK_PROVIDERS / sdkConfig) | `AiConfiguration`, `AiProvider`, `AiCapability` | AiProviderRegistry 08-23 | SDK defaults, per-provider driver, key, url override, models with secret overrides, embedding dimensions, headers (claude-code), store flag, capabilities, runtime refresh | the enums and URL constants (duplicates of registry data).
- **Verification.** `php -l` passes on the changed files and `route:list` lists 1090 routes. `AiSdkChat::capabilities()` lists 10 SDK providers, and `config('ai.default')` = `openrouter-free`.

**Round 10 (merge-audit #4, #8, #14; c4 audio lookup).**
- **#4 Coded unknown-type 404.** `WorkerController::invalidTaskType` and every "Unknown queue" 404 in `QueueCenterController` now return `ApiResponse::taskTypeUnsupported()`:
  - shape: `errorWithCode` with `error_code: LARAVEL_TASK_TYPE_UNSUPPORTED` (`QueueCenterContract::ERROR_TASK_TYPE_UNSUPPORTED`) and `data: {task_type, supported[]}`;
  - message: i18n `api.messages.task_type_unsupported`.
  - Checked with a signed pull of an unknown type: 404 with the code. B was told it is live in the tree.
- **#8 Public route table.** `GET /api/public/client-key-routes` calls `isNotModified()`, so a matching `If-None-Match` gets 304 with an empty body (checked). It uses its own limiter, `client-key-routes` (60/min per IP), not `throttle:compute`.
- **#14 Table scope.**
  - HEAD is listed wherever GET is, because it passes the same middleware and is signed the same way.
  - The public table keeps only the routes a client may sign instead of logging in: `client_key_or_session`, both user and admin level (F's scheduler signs the admin-level task routes). Each entry has `session_level`.
  - Worker-only `client_key` routes (the pycore worker API) are left out of the public table and stay in the admin `/api_info` table.
  - Counts: 91 public, 164 full.
- **c4 read-only audio lookup.** New `POST /api/app_qy_v1/ai_tools/tts/audio/lookup`, contract endpoint `audio_lookup`, middleware `client.key_or_dashboard:user`, `AppQyV1AudioLookupCtl`.
  - Body: the clip-bundle item shape, `{items: [{kind: word|sentence, language, text}]}`, at most the bundle item limit.
  - Answer: `results[]` in input order, each `{kind, language, text, ready, url, md5 (word) | content_id (sentence)}`.
  - It calls only the existing passive resolvers (`AppQyV1AudioGateway::resolveWordsPassive` / `resolveSentencesPassive`): no queue write, no head move, no task. Checked with a signed call: 200.
- **Verification.** `php -l` passes on all changed files and `route:list` lists 1091 routes.

**Verify on the live laravel-main server.**
- `route:list`.
- After B and C deploy: a pycore registers with `compute_class`, then `POST /api/ocr/recognize` returns 202, then the task completes; a TTS cache miss returns 202, then the file exists.
- With every pycore stopped: OCR returns 503 and TTS returns 202, both `pycore_unavailable` with Retry-After.
- A gpu_preferred lane (sentence_audio) with one gpu and one cpu_only pycore: the cpu pycore gets tasks only while the gpu pycore is saturated.
- Google translation from the server's IP.
- No `sys:init` is needed: no schema change (compute fields live in worker metadata).

## Final pending-deletion list (user decision)

**Deleted 2026-10-02 (user-approved; zero live references verified first):**
- Laravel: both relay migrations (RelayV2 operations, RelayV3 fabric ledger), the `RELAY_OPERATIONS` key in `GlobalTablesMap` (the DB table itself is untouched), `app/CallPycoreUtils/`, `PycoreRpcContract.php`, `HttpTransfer.php`, `PycoreAiClient.php`, `PycoreUrlDiscoveryTask.php`, `EdgeTTSChecker.php`.
- D1: `app_config_path`, `event_bus`, `stdio_utils`, `speech_queue_ops`, `common/global_config`, `endpoint_scoped_cache`, `speech_config`, `pycore/__main__.py`.
- E: `callmodule/__main__`, `callmodule_main`, `callmodule/config`, `pyctl/pyservice_cli/`, `scripts/pycore/run_callmodule_service.py`, `rpc/module_loader`, `rpc/http/event_service`, `rpc/idempotency`, `module_call_service`, `module_call_models`.
- D2: `pyutils/mcp/`, `pyutils/launcher/device_sync/`, `pyutils/video_stream/`, `pyctl/desktop/ai_hooks.py`.
- Two comments that named deleted files were updated. Checks after deletion: BOOT OK, import sweep 1041 modules with 15 expected failures and none new, route:list 1091.
- Every entry below that is not listed here is still pending.

**Migrations / Laravel**
- Delete these together, because the migration reads the key (existing DB tables stay untouched):
  - `poly_apps/laravel_main/database/migrations/global_RelayV2_2026_08_23_000005_create_relay_operations_table.php`
  - the `RELAY_OPERATIONS` key in `GlobalTablesMap`
- `poly_apps/laravel_main/database/migrations/global_RelayV3_2026_09_30_000001_create_relay_fabric_ledger_table.php`: a no-op since the relay merge.

**pycore**
- `pycore/pyctl/relay/fabric/`: an empty directory (pycache only).

**Stale SQLite files** (no code references them):
- `/www/core_node/config/audio_delivery_outbox.sqlite3`
- `/var/_core_node/config/audio_delivery_outbox.sqlite3`
- `/var/_core_node/data/terminal_windows/state.sqlite3`

**D1 (foundations)**, unreferenced:
- `pycore/pyfoundations/app_config_path.py`, `event_bus.py`, `stdio_utils.py`, `speech_queue_ops.py`
- `pycore/pyutils/common/global_config.py`, `endpoint_scoped_cache.py`, `speech_config.py`
- `pycore/__main__.py`

D1 also already deleted, without explicit approval, the dead SQLAlchemy layer under `pycore/database` and okx `lib/models.py` + `foundation/database_handler.py` (auto-committed in `e3cf19e10`). The DB audit verdict is safe to stay deleted. Decision: keep deleted, or restore from `e3cf19e10^`.

**E (rpc/codesync)**, unreferenced:
- `pycore/callmodule/__main__.py`, `callmodule_main.py`, `config.py`
- `pycore/pyctl/pyservice_cli/` (package)
- `scripts/pycore/run_callmodule_service.py`
- `pycore/pyutils/rpc/module_loader.py`, `pycore/pyutils/rpc/http/event_service.py`, `pycore/pyutils/rpc/idempotency.py`
- `pycore/pyctl/runtime/module_call_service.py`, `module_call_models.py`

E also already removed, recoverable from git HEAD: `pyutils/rpc/delivery.py` and the codesync `cli`, `client`, `daemon`, `http_client`, `http_server`, `runtime`, `server`, `server_connection`, `sse_receiver`, `sse_transport` and `sync_logger` modules.

**D2 (UI/tool domains)**, verified zero importers:
- `pyutils/mcp/**`, `pyutils/launcher/device_sync/**`, `pyutils/video_stream/**`
- `pyctl/desktop/video_processor.py`
- `translator/romanization.py`, `phonetic.py`
- `window/unified_detector.py`, `integrated_analyzer.py`
- `image_tools/icon_analyzer.py`, `image_enhancer.py`, `png_matcher.py`
- `pyctl/mcpctl/global_state.py`
- native_ui `step7_managers/file_monitor.py`, `step8_utils/resize_handles.py`, `image_converter.py`, `step5_main_ui/tkinter/styled_widgets.py`
- `flutter_dev_tools/config/routes_config.py`, `utils/update_to_english.py`
- `ensure_library/quick_test_ffmpeg.py`, `verify_pyside6_fix.py`
- `device/adb_exceptions.py`
- `pyctl/runtime/module_call_service.py`
- `control/coordinate_mapper.py`
- `clipboard/clipboard_sync.py`
- `external_apis/movie_poster_client.py`
- `native_ui/重构.txt`, `_prompts/`, `_analysis/`

D2 additions:
- `pyutils/desktop/**` (moved to `native_ui/step11_desktop`, `window/tk_taskbar`, `pyfoundations/shortcut_manager`)
- native_ui:
  - `step1_config/config.py` (deprecated `UIConfig`)
  - `step9_frontend/port_killer.py`
  - `step4_startup/startup_window.py`
  - `step8_utils/embedded_images.py`
  - `step5_main_ui/tkinter/theme_system.py`
  - `step7_managers/shutdown_manager.py`
  - `step0_i18n/translations/translations_en_bak.json`
- translator: `local_ai_translator.py` (moved to pyctl/translation) and `__main__.py`
- `hotkey/hotkey_listener.py`, `window/ui_analyzer.py`
- image_tools: `image_processor.py`, `image_split.py`, `image_transform.py`, `dataset_generator.py`, `image_comparator.py`, plus `pyapps/d3-check/providor/common_imports.py`
- pyctl:
  - `mcpctl/**` (imports the missing `pyapps.mcp`)
  - `pybrowserauto/**`
  - `flutter_dev_tools/**`
  - `runtime/global_config.py`, `runtime/module_call_models.py`
  - `desktop/ai_hooks.py`
- `frontend_launcher/universal_launcher.py`, `voc_annotator/annotation_io.py`, `voc_annotator/backup_before_tk/`, `nodejs_bridge/`
- empty pybrowser packages: `factories`, `compat`, `core`, `interfaces`, `plugins/{core,extensions}`, `implementations/pages`, `config/presets`, `utils/{download,tampermonkey,events,base,control,operations,iframe}`
- `pyapps/d3-check/utils/_obsolete_*.py` (`_obsolete_diablo_button_clicker.py` does not parse)
- `pyctl/desktop/machine_receive_service.py`, superseded by `machine_send_service`. Merged first: multi-file requests (`saved` list, 32-file cap, `machine_send_too_many_files`), text `bytes`, and clipboard `formats` in each ClipboardEntry. Delete it together with `callmodule/rpc_routes/machine_receive_routes.py`: that file is unregistered and imports `route_names` constants that no longer exist.
- shell-install rule: `pycore/pyutils/ensure_library/ffmpeg_installer.py`, `pyutils/common/robust_downloader.py` (no callers left), `pyapps/matrix/matrix_config/scrcpy_server_downloader.py`, `pyapps/matrix/services/adb_manager.py` (no importers)
- `flutter_dev_tools/config/routes_config.py` (last SerializedSingletonProvider user in D2 scope; already listed)

**G (agent history)**: old prompt cache data, imported once into the new SQLite prompt store and no longer read:
- `/var/_core_node/cache/pycore/.ai_state/agent_history/prompt_new_cache/`
- `prompt_derived_cache.json`
- `prompt_rewrite_cache.json`
- `prompt_archive/`

The old extractor modules (`*_extractor.py`, `base_extractor.py`, `extractor_registry.py`) are already deleted.

**I (Laravel <-> pycore)**, unreferenced; `rm` was classifier-blocked:
- `poly_apps/laravel_main/app/CallPycoreUtils/` (whole directory)
- `poly_apps/laravel_main/app/Support/PycoreRpcContract.php`, `app/Support/HttpTransfer.php`
- `poly_apps/laravel_main/app/Services/PycoreAiClient.php`
- `poly_apps/laravel_main/app/Services/TimerTasks/PycoreUrlDiscoveryTask.php` (disabled through `isEnabled()`)
- `poly_apps/laravel_main/app/Services/EdgeTTS/EdgeTTSChecker.php`

**Coordinator additions**:
- `scripts/pytools/media_compressor/json_store.py`: legacy standalone store; the compressor now uses `SplitFileStore`.
- `poly_apps/pycore_laravel_wordnew_ui/shared/orchestration/orchPycoreClipSource.ts`: already deleted by session core-node-c4; listed for the record.
- Note: `pyutils/flutter_dev_tools/**` and `pyctl/flutter_dev_tools/**` are frozen by user decision. D2 lists some of their files as dead; decide them separately from the refactor.
- Laravel `UnifiedAIRouter` was deleted (approved InitializeApps.php edit).

## Open items / not done

**Live deployment, required together, because the relay contract digest changed:**
- Laravel code (`poly_apps/laravel_main`).
- Repo-root `config/*.json`: `queue_center_contract.json`, `pycore_relay_contract.json`, `pycore_rpc_contract.json` and `service_contract.json`.
- Restart the `ncore-laravel-main` Octane/FrankenPHP workers. The contracts are cached per worker.
- Run `php artisan sys:init` for the relay ledger table.
- Run step 175 once for the book seed.
- Keep `CORE_NODE_CLIENT_KEY_1` identical across Laravel, pycore and wordnew.
- Until this is done, live pycore logs `LARAVEL_TASK_TYPE_UNSUPPORTED` for `tts_synthesize` and re-probes with backoff.

**Verification not yet done on real systems:**
- Nothing was run against live services: no browser checks of the UI, no real installer runs (Linux scripts passed `bash -n`; Windows scripts passed parsing only), and no real OS checks of machine send (opener, notification, clipboard).
- The Windows extraction in Step175 has not been executed.
- The OCR and EasyOCR weight download helpers have not been executed.
- A real restart has not been run for the outbox recovery skip (B #11).
- `kill_process_by_pid` without psutil has not been checked on a real non-child target.
- The voice-subtitle failure path (`runPipeline()` marks the task failed) has not been run with a failing step.
- F's scheduler, stall guard and Backoff checks ran only in a scratch harness, not in a browser.
- core-node-c4 adopted the shared `wordNewChannels` for clip orchestration and removed its own `WordNewOrchChannels.ts` and the `ServiceLink.onRecovered` hook. Contract to keep stable: `relay` means not direct, Laravel up and paired. c4 has since moved `ServiceLink` to the shared `Backoff` (its reconnect delays now carry the default additive jitter) and the clip bundle reads to `readBytesWithStallGuard`.

**Security and decisions:**
- **Client key in builds:** `CORE_NODE_COMPILE_CLIENT_KEY=1` embeds `CORE_NODE_CLIENT_KEY_1` in the shipped JS, which reverses requirement K6. Never enable it for the public web build; use it only for app packaging and local debugging.
- **Signed routes:** compute routes now require the K3 signature or a session. Laravel CORS allows the `X-Core-Node-*` headers, checked inside Laravel only; if a front proxy answers `OPTIONS` itself, check it on the server. The UI reads the signed-route list from the public `GET /api/public/client-key-routes`.
- **Azure TTS without the SDK:** status still reports "not installed" (pre-session behaviour). It becomes "package missing" only on request.
- **Remaining fixed timeouts:** Laravel provider calls still use fixed total timeouts (AiGateway, describeImage, DataSyncPeerClient). These are provider calls, not pycore uploads.
- **Pre-session gaps:**
  - The Antigravity IDE 2.x conversation DB is not covered (no sample).
  - Windsurf and Trae declarations are untested.
  - The melotts and voxcpm2 containers previously lacked `sentence_segmenter.py`; it is now mounted.

**Windows run fixes (after the user's 2026-10-01 log):**
- The Windows pycore ran pre-refactor code (traceback at `task_puller.py:387`; the current pull raise is at line 444). It needs a code sync and a restart; the current code skips a task type the server does not know and re-probes it with backoff.
- An old Laravel answers the queue-center diff with 404 `Unknown queue: <type>`, which failed the whole diff round for every type. `task_puller._unknown_task_type` now also matches "unknown queue".
- qwen3tts lanes paused on "insufficient free RAM to load" while the model was already resident, because its own memory counted against the load floor. The new `TTSEngine.load_gate()` lets a resident model pass, and the worker lane, orchestrator, status and selfcheck all use it. The parallel lanes of one worker share one pause state, so the pause is logged once instead of once per lane.

**Pending-deletion importer check (db-audit, round 2):**
- `pyctl/desktop/ai_hooks.py` was still imported on the startup path by `launcher_composition`, through a write-only `set_ai_handlers(...)` call with no readers. Main removed that wiring, so the file is now unreferenced and safe to delete. BOOT OK.
- `open_writable_db` (`sqlite_local.py`) has only one caller, in the pending-deletion package `pyutils/mcp`; delete them together.
- `pyctl/relay/fabric/` holds only `__pycache__`.
- Outside pycore, and not converged: the okx pyapp and `scripts/pytools/media_compressor` open SQLite themselves.

**Optional follow-ups:**
- `network_constants` `HTTP_*_PATH` duplicates the contract `protocol_routes`. A consistency check could replace the copy.
- Done (I, Round 9): Laravel now has one AI provider catalog, `AiProviderRegistry`.
- Per-operation relay progress frames are not defined; only `ack` and `result` exist.
