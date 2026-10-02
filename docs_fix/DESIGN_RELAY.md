# Relay: pycore ⇄ Laravel ⇄ UI (pyservice mode 2)

Status: current architecture (single relay, no version number) as of 2026-10-02.
Supersedes: `DESIGN_20260817_2115_PYCORE_UI_RELAY_GROUPS_HTTP3*.md` (relay part), `DESIGN_20260823_PYCORE_REMOTE_RELAY_V2.md` + its three `PROGRESS_20260823_*` files, `DESIGN_20260930_RELAY_FABRIC_V3_HUB_NATIVE_RPC.md`, `A7A*_*.md`, `FIX_20260930_RELAY_EVENT_TUNNEL_AND_ADMISSION.md`, the relay part of `FIX_20260929_WINDOWS_MEMORY_AND_RELAY_DIGEST.md`.
Authority order: code > `config/pycore_relay_contract.json` > this document. Transport plane: `DESIGN_TRANSPORT_PLANE.md`.

## 1. Architecture

Every remote UI call is a hub-native frame:

```text
UI --POST owner_frames--> Laravel (authz, policy, rate limit, mercure_publish)
   --private update relay.request on topics.request--> device (SSE reader)
   --device executes through the RPC kernel--> device POSTs relay.response
   directly to the hub on topics.response --> UI owner stream (SSE)
```

- Laravel is control plane only: enrollment, pairing, roster, grant/token minting, route policy, rate limit, admission, telemetry. No PostgreSQL transaction or row lock on the frame path.
- One device heartbeat (20 s) returns the grant; a grant is issued without a live stream (bootstrap). One owner grant covers the owner-events and response topics, so the UI holds one hub connection.
- Offline device fails fast: `device_offline` (503). There is no queued/deferred execution and no durable lane.
- Long actions (`ack: true` profiles, e.g. `terminal_integration`, `machine_upload`) get an `ack` frame, then `progress`, then `result`. `max_deadline_seconds` = 180.
- Bodies above the inline/part limits go through the blob store by `b.ref`, both directions.

### 1.1 Sources

| Runtime | Modules |
| --- | --- |
| pycore | `pyctl/relay/relay_agent` (enrollment + heartbeat control thread), `relay_state`, `relay_frames`, `relay_grant`, `relay_reader` (single hub subscription on the request topic), `relay_publisher` (via `laravel_client`), `relay_worker` (+ `RelayProgressThread`), `relay_events` (journal tap + device events); `pyutils/laravel/relay_transport` (endpoint = `laravel_endpoint_manager.resolve()`, device signing, blob up/down); `pyutils/laravel/mercure_client` (`SseEventDecoder`, `Backoff`); `pyutils/common/relay_{contract,identity,execution_ledger,progress,request_clock,activity_log}` |
| Laravel | `app/Apps/Relay/RelayServices/{RelayContract, RelayFrameService, RelayStore, RelayBlobService, RelayDeviceService, RelayEnrollmentService, RelayPairingService, RelayDeviceSignatureService, RelayNonceRepository, RelayOutboxRepository, RelayTopicService, RelayFleetScope, RelayOwnerResolver, RelayMaintenanceService}`; `RelayControllers/{RelayOwnerCtl, RelayDeviceCtl}`; `RelayMiddleware/RelayDeviceSignatureMiddleware`; `app/Services/Relay/RelayHub{Jwt,AuthService,KeyProvisioner}`; `routes/RelayRouter/RelayApi.php`; `Services/TimerTasks/RelayMaintenanceTask` |
| UI | `core/integrations/pycore/{RelayTransport, RelayDelivery, RelayPairing, PycoreRelayWire, PycoreRelayError}.ts`; `core/integrations/laravel/{LaravelRelayAPI, LaravelRelayStream, LaravelRelayRoster, LaravelRelayTelemetry}.ts`; `core/contracts/{RelayContract, RelayCapabilities}.ts`; `apps/pycore-manager/components/PcRelayStats.tsx`; shared `core/tasks/Backoff.ts` |
| Contract | `config/pycore_relay_contract.json` only. Single readers: `relay_contract.py`, `RelayContract.php`, `RelayContract.ts` (`RELAY_CONTRACT_DIGEST`) |

### 1.2 Topics and events

| Contract key | Template | Publisher | Subscriber |
| --- | --- | --- | --- |
| `topics.request` | `{laravel_api_origin}/.well-known/relay/req/{device_id}` | Laravel only | device |
| `topics.response` | `{laravel_api_origin}/.well-known/relay/res/{owner_topic_token}/{device_id}` | device (scoped JWT) | owner UI |
| `topics.owner_events` | `{laravel_api_origin}/.well-known/relay/owners/{owner_topic_token}` | Laravel (outbox) | owner UI |

`owner_topic_token` = `RelayTopicService::opaque('owner', userId)` (HMAC); topics never carry user IDs, hostnames, paths or secrets. Events: `relay.request`, `relay.response`, `relay.pairing.changed`, `relay.credential.revoked` (also on the request topic), `relay.device.presence`, `terminal.changed`, `agent_history.prompt.{new,derived}`, `agent_history.config.changed`, `pycore.events` (event tunnel).

### 1.3 Frame envelope (`frame_profile` version 1)

- Request fields: `v op owner pair se m p q h pol b iat dl`; body `{len, sha256, b64, ref}`.
- Response fields: `v op k s h b part t p`; `k` ∈ `ack | progress | result`; `part {i,n}`; timing `t {dev_recv, exec_ms, dev_send}`; progress `p {phase, done, total, bytes}` (status 102, empty body).
- Limits: `frame_bytes` 60,000; `inline_body_bytes` 45,000; `max_parts` 6; larger bodies use blobs (`blob_chunk_bytes` 4 MiB; `request_body_bytes`/`response_body_bytes` 64 MiB).
- `dl` (unix ms) is authoritative: the device drops expired requests. `se` (relay session) mismatch drops the frame (`relay_session_superseded`).
- Liveness: the device emits a progress frame for every operation silent for `progress_min_interval_seconds` (2 s). The UI fails an admitted call only after `stall_window_seconds` (30 s) of silence (`ack_timeout_seconds` 5 s before the first frame on ack routes). `stall_window_seconds` must span at least three progress intervals. A result finishing after the admission deadline is still published.

### 1.4 Delivery guarantees (route-profile key `delivery`, enforced on the device)

- `read`: re-executed on duplicate `op` or answered from the device memory cache (`device_dedupe_entries` 512, 120 s).
- `idempotent_write`: safe to re-execute; duplicate `op` replays the cached result.
- `at_most_once_action`: durable `relay_execution_ledger` keyed by `op`, byte-exact result replay, `execution_unknown` (502) when interrupted. The UI never auto-retries an admitted at-most-once call.
- Load bounds: `owner_frames_per_minute` 1200, `device_max_concurrent_requests` 8 plus overload verdict (`device_overloaded`), Redis limiter keyed by authenticated user + lane (IP only when anonymous).

### 1.5 Endpoints (contract `endpoints`)

- Device (signed, `throttle:relay-device`): `device-enrollments` create/status, `device/heartbeat`, `device/events`, device blob download, response-blob allocate/chunk/finalize.
- Owner: `grant`, `frames`, `telemetry`, `stats` (no throttle group); `throttle:relay-owner`: enrollment claim, `devices` roster, pairings create/renew/revoke, request-blob allocate/chunk/finalize, response-blob download.

## 2. Security model

| Threat | Control |
| --- | --- |
| Device forges work | Device JWT has no publish claim on request topics |
| Device injects into another owner | Publish claim lists only the response topics of its active pairings |
| Browser abuses hub publish | No browser publish claim; frames are admitted by Laravel |
| Frame replay | `op` + `dl` + device dedupe cache / execution ledger |
| Hub key compromise | Separate HS256 publisher/subscriber keys in the runtime store; topic tokens are HMACs; the global `publish: ['*']` token stays server-side |
| Data at rest on hub | `transport local` keeps no history; private updates only |
| Header abuse | `RelayContract::filterHeaders` allow-list |
| Flooding | Per-user+lane limiter, frame cap, device concurrency cap |

- Grants: device `subscribe=[request(device)]`, `publish=[response(owner_i, device)…]`, TTL `grant_ttl_seconds` 300, refreshed in the heartbeat response when < `grant_refresh_margin_seconds` (90 s) remain or `grant_version` changed. UI tokens are held in memory only, sent via `Authorization`, never in storage, URLs, logs or diagnostics.
- Hub profile: SSE, `redirects: forbidden`, `history_is_authoritative: false`, `reconciliation_required: true`; every reconnect reconciles from authoritative HTTP state.

### 2.1 Why Mercure SSE + POST, not a WebSocket broker

PHP long-poll and PHP-native streams pin FrankenPHP threads; FrankenPHP hosts no WebSocket server; the Mercure FAQ rates SSE-down + POST-up as negligible versus a 130 ms WAN RTT; the hub already provides topic auth, private updates, `Last-Event-ID` and heartbeats. Measured before the change: durable-queue p50 8 s / p90 16 s / p99 422 s, 94 % reads; hub publish→receive 2 ms.

Revisit a WebSocket broker (Go service behind Caddy `reverse_proxy`, same JWT grants and envelopes; replace only the subscriber/publisher adapters) only if: relay p95 > 1 s with RTT < 200 ms, or sustained > 50 frames/s per device, or backpressure becomes necessary. WebTransport: not while the edge serves `h1 h2`.

## 3. Identity, enrollment, pairing

- Device identity: random device UUID + Ed25519 key created once, stored in `pycore_relay_identity.json` (the legacy `pycore_relay_v2_identity.json` is no longer read).
- Enrollment (outbound only): device creates an enrollment (device ID, public key, label, platform, contract and capability digests) → Laravel returns enrollment ID + one-time claim code → an owner claims → device polls status every `enrollment_poll_seconds` (5 s) and receives a scoped credential only after the claim commits. Same key → same pending/claimed enrollment; a code is claimable once; rotation stores the new key version before revoking the old one.
- Auto-claim: an authenticated admin (`User::isAdmin()`, rolelevel ≥ 10) roster read runs `RelayEnrollmentService::autoClaimPending` best-effort before the snapshot, so a new pycore joins without console access. It reuses `claim()` (ownership guards, credential rotation, post-commit presence). Non-admins never adopt devices; manual claim stays available.
- Fleet scope (`RelayFleetScope`): super admins (rolelevel ≥ 100) share one fleet for device visibility, pairing anchor gates and presence fan-out; others are owner-scoped. Pairings stay per user.
- Signed device requests (`signature_profile`, Ed25519): canonical input = protocol version, credential version, method, normalized path, sorted query, device ID, timestamp, nonce, SHA-256 of exact body bytes; headers `X-Pycore-Relay-*`. Laravel checks owner binding, credential state, clock window (`signature_clock_skew_seconds` 60), body digest, signature and one-time nonce (atomic, per credential version, retained 300 s) as independent steps.
- Pairing: one user × one device × one UI client instance (hashed); renew/revoke by pairing ID, never overwriting another session; lease `pairing_lease_seconds` 86400.
- Credential revocation (`relay.credential.revoked`) is applied by the device only when `credential_id`/`credential_version` match its current credential.

### 3.1 Surviving tables (`global_` prefix, created by `php artisan sys:init`)

| Table | Content |
| --- | --- |
| `relay_devices` | device ID, owner user, public key + credential version, label, platform, `node_platform` (2026-10-02), digests, status, last-seen, expiry/revocation |
| `relay_enrollments` | enrollment ID, hashed claim code, proposed key/digests, state, claimant, expiry, revision |
| `relay_credentials` | credential versions per device |
| `relay_pairings` | pairing ID, user, device, hashed client instance, state, expiry, credential version, revision |
| `relay_blobs`, `relay_blob_chunks` | operation-independent blob store; immutable chunks `(blob_id, chunk_index, chunk_digest)`; finalize verifies contiguity, length, digest |
| `relay_nonces` | one-time nonces |
| `relay_outbox` | owner-event publication; unique `(entity_type, entity_id, revision, event_type)`; reuses the timer publisher, published after commit |
| `relay_ledger` | per-call telemetry (`RELAY_LEDGER`), drained from Redis (`RelayStore`, connection `relay`, db 3) in batches of 500 |

Applied migration filenames (`global_RelayV2_*`, `global_RelayV3_*`) keep their names; renaming re-runs them. Never drop existing tables.

## 4. Lifecycle constraints

Enrollment and identity
- Enrollment recovery is driven only by explicit coordinator codes (`enrollment_not_found`, `device_not_found`, `device_credential_revoked`). Any other 401/403 (timestamp, nonce, digest, protocol, signature) keeps the identity and retries with backoff; it never rotates keys.
- A single known but stale device is "temporarily offline", not "no device"; selection must distinguish them.
- Enrollment commit refreshes the roster and publishes presence after commit, through the same lifecycle as heartbeat.

Roster and selection
- Roster reconciliation reads the authoritative device registry; no second cached roster copy (`Cache::remember` vs heartbeat `Cache::put` races across FrankenPHP workers).
- The UI merge preserves presence that arrives during an in-flight snapshot, reconciles periodically (`roster_reconciliation_seconds` 60) even with a live stream, and validates `devices` is an array at the API boundary.
- Empty roster returns stable `RELAY_GROUP_EMPTY` with an i18n message about account-scoped visibility; never advise re-enrolling.
- Persisted selected device IDs are validated against the authorized roster before admission; repeated failures are bounded.

Auth and fencing
- A 401 on hub authorization or grant pauses reconnecting until the shared auth session changes; network failures keep bounded backoff.
- Roster, pairing and frame work are fenced by auth generation; responses from a superseded generation are rejected, never shown to the next account.
- The relay origin is fixed (`public_urls.laravel_api_origin`); general endpoint-selection events must not reset the relay roster or stream. A real coordinator change resets coordinator-owned state and fences pending work.
- `laravel_endpoint_manager.resolve()` is the device grant-origin authority; the server's public `mercure_hub` URL must share that origin.

Streams
- Reconnect backoff resets only after a stable connection, not on HTTP 200 headers; abnormal chunk termination is not a clean close. Subscriber connect 10 s, read 90 s, reconnect 1–30 s.
- Tokens are renewed proactively from their lifetime, not after rejection.
- Mercure proxy routes carry `stream_close_delay` (`realtime.mercure_proxy_close_delay`) in both shell and PHP Caddy renderers.

Contract and server
- Contract digest = SHA-256 of the LF-normalized file bytes (`relay_contract.normalize_eol`, `RelayContract::canonicalContractBytes`). A digest change is a flag day: devices, Laravel and UI deploy together; mismatch answers `409 contract_digest_conflict`.
- `RelayContract::load()` reloads when the file signature (`filemtime:filesize`) changes, so Octane/FrankenPHP workers never serve a stale digest; the worker watch includes the contract directory.
- Composite identifiers are hashed in PHP before PostgreSQL advisory locks (`text` cannot carry NUL).
- The Octane worker's per-request ceiling comes from `service_contract.json php_runtime.max_execution_time_seconds`, applied through `REQUEST_MAX_EXECUTION_TIME` and the Caddyfile `php_ini` lines rendered identically by shell, PHP and PS1.
- pyservice mode: an explicit argv/env mode persists to `pyservice_mode.json`; a bare launch reuses the cache; shell launches always pass `--service-mode` (default 1). Mode 2 = relay UI.

Event tunnel
- In relay mode pycore journal events reach the UI as batched `pycore.events` device events (`relay_events` journal tap) replayed on `pycoreEventBus` with the same topics and dedupe as direct mode, filtered by the selected device. Dedicated topics (`PYCORE_RELAY_DEDICATED_TOPICS`) are bridged once in the shared client, not per consumer.
- Reads are single-flight per `method+url`; on 429 reads back off (5–60 s) while mutations still go through.

## 5. Delivery/outbox constraints (pycore → Laravel workers)

- Synthesis never waits on progress or result HTTP: progress is local-only; results and uploads go through the durable delivery outbox (`pyutils/laravel/delivery_outbox.py`, kinds `audio_lane.*`, `audio_orch.*`, `agent_history.*`), drained by background lanes.
- Claim/result posts share a transport backoff gate; one failed attempt returns immediately and cannot serialize a synthesis lane.
- A successful queue-diff response triggers the outbox drain before admitting more work.
- Full-sync intake refreshes the diff every cycle, pages until the durable segment window (4096 ordered IDs; 128 per page) is filled, keeps pending reads replayable until heap admission, and marks rows delivered after admission. Stale marks are cleared once per process.
- Queue page-data rows are under `data.items`; worker pull and task-list snapshots use `tasks`. Do not normalize the two shapes at call sites.
- `writeback_pending` is a durable idempotent receipt: mark accepted, do not re-upload.
- History submissions are idempotent per `(delivery_id, operation)`; history `record_id` is delivery-derived.
- `LaravelProgressUploader` treats identical `(endpoint, params, bytes)` transfers as one delivery: concurrent duplicates await the leader; duplicates within `http_transfer.dedup_window_seconds` (300 s) reuse the receipt.
- Upload progress carries a producer reason (`sentence_audio_delivery`, `word_audio_delivery`, `agent_history_audio_rebuild`) and task identity.
- `/api/worker/tasks/{type}/accept` stays as the early drop before synthesis even though `/result` covers the same pending-claim branch.
- Qwen engine start is single-flight; queue-wide `progress` (completed/total) and per-synthesis `qwen_progress`/chunks are distinct.
- Logs print only on state change (diff state, `QUEUE_CENTER_DIFF_SYNC_LOG_KEYS` counters); sentence text prints once at the Qwen processing boundary.

## 6. Open items

1. Owner routes are not authenticated per user: `RelayOwnerResolver` returns `RelayFleetScope::publicOwner()`, so grant/frames/roster are unauthenticated. Needs a decision.
2. The unified relay has not run end to end on Windows. Acceptance: 200 sequential `/status` reads, p50 ≤ 0.6 s, p95 ≤ 1.2 s. The device-side share of the old 8 s latency stays unconfirmed until relay stats show real traffic.
3. Leftovers to remove together (user decision): migration `global_RelayV2_2026_08_23_000005_create_relay_operations_table.php`, the no-op `global_RelayV3_2026_09_30_000001_create_relay_fabric_ledger_table.php`, the `RELAY_OPERATIONS` key in `GlobalTablesMap`, the `pycore/pyctl/relay/fabric/` pycache directory, `state_repository.migrate_operation_kind`. Never drop tables.
4. Audio orchestration still polls every 3 s (`ORCH_POLL_MS`); move it to event-driven refresh.
5. Slow server responses seen from Windows (`/api/queue-center/overview` 8 s read timeouts, slow `/api/health`, worker register 20–25 s): check FrankenPHP thread saturation and the overview query.
6. Handlers do not yet call `relay_progress.report(...)`; frames lost during a UI stream outage surface as a stall timeout.
7. The 6.9 GB `laravel.log` on the server is not truncated (needs operator approval).
8. Windows `Step175_LaravelMainStart.ps1` idempotent double run is still pending (second run must change nothing and print no secrets).
9. Re-encrypt the 12 secret files with the BOM-free password after the `secret_password_runner.js` U+FEFF fix (needs the Windows user's approval). Client key direction: `DESIGN_20261001_CLIENT_KEY_DEVICE_IDENTITY.md`.
