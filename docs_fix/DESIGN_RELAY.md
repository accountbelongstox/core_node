# Relay: pycore ⇄ Laravel ⇄ UI (pyservice mode 2)

Scope: remote UI calls to pycore devices through Laravel and the Mercure hub, device identity, pairing, liveness, the event tunnel, and pycore → Laravel delivery.

Authority: code > `config/pycore_relay_contract.json` > this document. Transport plane (FrankenPHP, Mercure hub, HTTP versions, pycore `/api/ws`): `DESIGN_TRANSPORT_PLANE.md`.

## 1. Architecture

Every remote UI call is a hub-native frame:

```text
UI --POST owner_frames--> Laravel (authz, route policy, rate limit, session check, mercure_publish)
   --private relay.request on topics.request--> device (one SSE reader)
   --device executes in process through the RPC kernel--> device POSTs relay.response
   directly to the hub on topics.response --> UI owner stream (SSE)
```

- Laravel is control plane only: enrollment, pairing, roster, grant/token minting, route policy, rate limit, admission, session fencing, telemetry. No PostgreSQL transaction or row lock on the frame path; admission reads Redis (`RelayStore`, connection `relay`, db 3).
- One device heartbeat (`heartbeat_seconds` 20) returns the grant; a grant is issued without a live stream (bootstrap). One owner grant covers the owner-events and response topics, so the UI holds one hub connection.
- Offline device fails fast: `device_offline` (503) when no presence/session is recorded. There is no queued/deferred execution and no durable lane.
- Long actions (`ack: true` profiles: `terminal_integration`, `machine_upload`) get an `ack` frame, then `progress`, then `result`. Deadlines are clamped to `min_deadline_seconds` 3 … `max_deadline_seconds` 180.
- Bodies above the inline/part limits go through the blob store by `b.ref`, both directions.
- The relay agent starts whenever pycore runs in mode 2; pycore never runs on the relay host. The relay origin is fixed: `public_urls.laravel_api_origin` / `public_urls.mercure_hub` (UI); the device resolves its coordinator through `laravel_endpoint_manager.resolve()`, which must share the hub origin.
- The relay agent never calls the local `:59000` listener; it dispatches handlers in process (`RpcExecutionKernel.dispatch`, same parser, route lookup, payload rules, timeout and response encoder as local HTTP).

### 1.1 Sources

| Runtime | Modules |
| --- | --- |
| pycore | `pyctl/relay/relay_agent` (enrollment + heartbeat control thread, `supersede()`), `relay_state` (per-process `session_id`, grant, in-flight set, duplicate cache), `relay_frames`, `relay_grant`, `relay_reader` (single hub subscription on the request topic), `relay_publisher` (via `laravel_client`; 401/403 re-grant retry, 2 attempts), `relay_worker` (+ `RelayProgressThread`), `relay_events` (journal tap + device events); `pyutils/laravel/relay_transport` (device signing, blob up/down, `Accept-Encoding: identity`); `pyutils/laravel/mercure_client` (`SseEventDecoder`, `Backoff`); `pyutils/common/relay_{contract,identity,execution_ledger,progress,request_clock,activity_log}` |
| Laravel | `app/Apps/Relay/RelayServices/{RelayContract, RelayFrameService, RelayStore, RelayBlobService, RelayDeviceService, RelayEnrollmentService, RelayPairingService, RelayPairingEventService, RelayDeviceSignatureService, RelayNonceRepository, RelayOutboxRepository, RelayTopicService, RelayFleetScope, RelayOwnerResolver, RelayMaintenanceService}`; `RelayControllers/{RelayOwnerCtl, RelayDeviceCtl}`; `RelayMiddleware/RelayDeviceSignatureMiddleware`; `app/Services/Relay/RelayHub{Jwt,AuthService,KeyProvisioner}`; `app/Services/Realtime/MercurePublisher`; `routes/RelayRouter/RelayApi.php`; `Services/TimerTasks/RelayMaintenanceTask`; `lang/{en,zh_CN}/relay.php` |
| UI | `core/integrations/pycore/{RelayTransport, RelayDelivery, RelayPairing, PycoreRelayWire, PycoreRelayError, PycoreEventClient, PycoreLiveSource, PycoreNetwork, pycoreTarget}.ts`; `core/integrations/laravel/{LaravelRequest, LaravelRelayAPI, LaravelRelayStream, LaravelRelayRoster, LaravelRelayTelemetry, LaravelMercureConnection}.ts`; `core/contracts/{RelayContract, RelayCapabilities}.ts`; `apps/pycore-manager/components/PcRelayStats.tsx`; shared `core/tasks/Backoff.ts` |
| Contract | `config/pycore_relay_contract.json` only. Single readers: `relay_contract.py`, `RelayContract.php`, `RelayContract.ts` (`RELAY_CONTRACT_DIGEST`) |

### 1.2 Topics and events

| Contract key | Template | Publisher | Subscriber |
| --- | --- | --- | --- |
| `topics.request` | `{laravel_api_origin}/.well-known/relay/req/{device_id}` | Laravel only | device |
| `topics.response` | `{laravel_api_origin}/.well-known/relay/res/{owner_topic_token}/{device_id}` | device (scoped JWT) | owner UI |
| `topics.owner_events` | `{laravel_api_origin}/.well-known/relay/owners/{owner_topic_token}` | Laravel (outbox) | owner UI |

- `owner_topic_token` = `RelayTopicService::opaque('owner', userId)` (HMAC); topics never carry user IDs, hostnames, paths or secrets. Device descriptors and roster responses carry the same opaque `group_id`.
- Hub events: `relay.request`, `relay.response`, `relay.pairing.changed`, `relay.credential.revoked` (also on the request topic), `relay.device.presence`, `terminal.changed`, `agent_history.prompt.{new,derived}`, `agent_history.config.changed`, `pycore.events` (event tunnel). Payload fields: contract `event_payload_profiles`; device-posted events: contract `device_events`, payload ≤ `device_event_payload_bytes`.
- Client event (UI-internal, not on the hub): `client_events.relay_events_dropped` = `relay.events.dropped {dropped, since}`.
- Request frames carry no numeric user id; the device uses the `owner` topic token as the execution owner identity and receives server-derived context only, never browser assertions.

### 1.3 Frame envelope (`frame_profile` version 1)

- Request fields `v op owner pair se m p q h pol b iat dl`; body `{len, sha256, b64, ref}` (`b64` and `ref` are exclusive; `len`/`sha256` are verified on decode).
- Response fields `v op k s h b part t p`; `k` ∈ `ack | progress | result`; `part {i,n}` (a single-frame response is `{0,1}`; every part repeats `s`, `h`, `b.len`, `b.sha256`); empty body is `b64: ""`; timing `t {dev_recv, exec_ms, dev_send}`; progress `p {phase, done, total, bytes}` (status 102, empty body).
- Limits: `frame_bytes` 60,000; `inline_body_bytes` 45,000 bounds the base64 text of one frame; `max_parts` 6; a response whose decoded body ≤ `response_inline_bytes` (192 KiB) is sent as parts, larger bodies as a blob (`blob_chunk_bytes` 4 MiB; `request_body_bytes` / `response_body_bytes` 64 MiB; `owner_blob_bytes` 1 GiB). A request frame above `frame_bytes` gets `413 frame_too_large`.
- Clocks: `iat`/`dl` are unix ms on the server clock; the device aligns through `relay_request_clock` (re-measures when wall and monotonic time diverge, e.g. after VM suspend). `t.dev_*` use the raw device clock. `dl` is authoritative: the device drops expired requests.
- Admission answer: `202 {operation_id, deadline_ms (absolute), device_id, server_time_ms, ack_required}`; a duplicate `operation_id` within `operation_dedupe_seconds` 120 answers 200 with the same body and publishes nothing.
- Payload profile `json-object`: absent or empty body is valid; a non-empty body must decode to one JSON object; GET carries no body. Redirects are not followed by the executor.

### 1.4 Session fencing

- Each pycore process creates a random `session_id` (`relay_state`; renewed on reset) and sends it in every heartbeat (required field).
- `RelayStore::sessionTouch` (Redis Lua, key `session:{device_id}`, retention `session_retention_seconds` 7 d) gives the first sight of a session the next epoch for that device identity; a new epoch clears presence; a heartbeat from an older epoch answers `409 relay_session_superseded` before any device row or presence update.
- Presence stores `session_id` + `session_epoch`; admission stamps the current session into `se`; `relay_reader` drops a frame whose `se` differs from its own session (`session_mismatch`).
- The superseded agent logs once and stops (`RelayAgent.supersede`, no withdrawal); frames admitted to it before the takeover still run there. Rule: one running process per relay identity.

### 1.5 Liveness (progress frames)

- `relay_progress` tracks running relayed operations; `RelayProgressThread` emits a progress frame for every operation silent for `progress_min_interval_seconds` (2 s). Handlers may enrich it with `relay_progress.report(request_id, phase, done, total, byte_count)` (corebook `add_language` / `fill_audio` do); a finished `done >= total` report is emitted immediately.
- The UI (`RelayTransport.ts`) treats any frame as liveness and fails an admitted call only after `stall_window_seconds` (30 s) of silence; on `ack_required` routes the first frame must arrive within `ack_timeout_seconds` (5 s). A heartbeat-only frame only re-arms the stall timer.
- `stall_window_seconds` ≥ 3 × `progress_min_interval_seconds` (validated by `relay_contract.py`). The admission deadline does not bound the UI wait; a result finishing after it is still published. Device execution stays capped by `execution_timeout_seconds` and the route timeout.

### 1.6 Delivery guarantees (route-profile key `delivery`, enforced on the device)

- `read`: re-executed on duplicate `op` or answered from the device memory cache (`device_dedupe_entries` 512, `device_dedupe_seconds` 120).
- `idempotent_write`: safe to re-execute; duplicate `op` replays the cached result.
- `at_most_once_action`: durable `relay_execution_ledger` keyed by `op`, byte-exact result replay, `execution_unknown` (502) when interrupted. The UI never auto-retries an admitted at-most-once call; a network retry reuses the original `op`.
- Load bounds: `owner_frames_per_minute` 1200 (Redis limiter keyed by authenticated user + lane, IP only when anonymous), `device_max_concurrent_requests` 8 plus overload verdict (`device_overloaded`).

### 1.7 Route policy

- Matching: `exact > prefix > suffix`, tie → longest value, then first declared; unmatched routes resolve to `general_action` (relay-exposed, `at_most_once_action`, 30 s). Laravel and the device both resolve the profile; the device re-checks exposure.
- Denied (`denied` profile, `403 route_denied`): every route that opens or picks something on the host OS — suffixes `/open`, `/open_output`, `/open_directory`, `_reveal`, `/pick_path`; `ui/audio_orch/video/background_import`; endpoint-assist `ui/assist/{bind_laravel_endpoint, laravel_transport_probe, laravel_endpoints_probe}`; prefix `ui/code_sync/`. The UI shows these features as direct-only with a localized reason.
- `ui/machine_send/*` stays relay-exposed (`machine_upload`, `machine_clipboard`, `general_action`); `file` with `open=1` opens the receive folder on the target host, which is intended.
- Terminal routes are classified per route (`terminal_read|resource|backup_read|write|action|integration|upload`); keyboard, mouse, activation, input, Enter, history and scroll are `at_most_once_action`.

### 1.8 Host capabilities

- Nodes are GPU or CPU only (`compute_class` from worker registration); Colab/Kaggle is only where a node runs. There is no node-platform field or notebook node type.
- Relay capabilities = contract `capabilities` plus detected `host_capabilities`: `desktop_session` when `has_graphical_display()` is true (`RelayDeviceIdentity.capabilities()`); sent with enrollment and every heartbeat with a capability digest.
- The UI reads roster capabilities (`isHeadlessRelayDevice`, `usePcDesktopHost`) and replaces Terminal and Window automation pages with a notice on a headless device. The GPU badge comes from Laravel worker registration, not the relay roster.

### 1.9 Endpoints (contract `endpoints`)

- Device (signed, `throttle:relay-device`): `device-enrollments` create/status, `device/heartbeat`, `device/events`, device blob download, response-blob allocate/chunk/finalize.
- Owner (all `client.key_or_dashboard:user`: K3 client-key signature or Sanctum Bearer): `grant`, `frames`, `telemetry`, `stats` (no throttle group; frames return `Server-Timing: relay;dur=…`); `throttle:relay-owner`: enrollment claim (`throttle:relay-enrollment-claim`), `devices` roster, pairings create/renew/revoke, request-blob allocate/chunk/finalize, response-blob download.
- Telemetry: the UI sends `route_policy: unknown`, which the server discards so the admit row keeps the real profile; device timings reported as `0` are absent. `stats` returns per-route p50/p90/p99 and error rate.

## 2. Security model

| Threat | Control |
| --- | --- |
| Device forges work | Device JWT has no publish claim on request topics |
| Device injects into another owner | Publish claim lists only the response topics of its active pairings |
| Browser abuses hub publish | No browser publish claim; frames are admitted by Laravel |
| Two processes share one identity | Session epochs; only the newest session heartbeats and executes |
| Frame replay | `op` + `dl` + device dedupe cache / execution ledger + `se` |
| Hub key compromise | Separate HS256 publisher/subscriber keys in the runtime store; topic tokens are HMACs; the global `publish: ['*']` token stays server-side |
| Data at rest on hub | `transport local` keeps no history; private updates only |
| Header abuse | `RelayContract::filterHeaders` allow-lists (`headers.request_allow`, `headers.response_allow`); hop-by-hop, Host, Cookie, Authorization, forwarding and relay identity headers never cross |
| Flooding | Per-user+lane limiter, frame cap, device concurrency cap |
| Secrets in logs | `relay_activity_log` redacts keys, credentials, claim codes, signatures and tokens; bodies are logged as length + SHA-256 |

- Owner identity = client key (shared fleet) OR Sanctum user. Owner routes sit behind `client.key_or_dashboard:user`: a signed request is judged by K3 only (`client_key_*` 401 on failure); an unsigned one needs the Sanctum Bearer (`401 AUTH_REQUIRED`; only the loopback debug bypass binds its debug user). `RelayOwnerResolver` resolves the Sanctum user first, else a verified K3 caller as `RelayFleetScope::clientKeyOwner()`, else `401 authentication_required`; anonymous traffic never receives ownership. Device, pairing, frame and blob access is scoped to that owner (and its fleet, §3); the owner topic uses its id; limiters key by `RelayOwnerResolver::rateKey` (`user:{id}`, or `client:{clientKeyOwnerId}:{ip}` so keyed machines do not share one bucket).
- Grants: device `subscribe=[request(device)]`, `publish=[response(owner_i, device)…]`, TTL `grant_ttl_seconds` 300, refreshed in the heartbeat response when < `grant_refresh_margin_seconds` (90 s) remain or `grant_version` (opaque string; the device sends `""` to force one) changed. UI tokens are held in memory only, sent via `Authorization`, never in storage, URLs, logs or diagnostics.
- Hub profile (contract `hub_profile`): SSE, repeated `topic`, bearer private subscriber JWT, `lastEventID` initial cursor, `Last-Event-ID` resume, `redirects: forbidden`, notification-only updates, `history_is_authoritative: false`, `reconciliation_required: true`; every reconnect reconciles from authoritative HTTP state.

### 2.1 Why Mercure SSE + POST, not a WebSocket broker

PHP long-poll and PHP-native streams pin FrankenPHP threads; FrankenPHP hosts no WebSocket server; the Mercure FAQ rates SSE-down + POST-up as negligible versus a 130 ms WAN RTT; the hub already provides topic auth, private updates, `Last-Event-ID` and heartbeats; the single-node hub matches the single-node deployment. Durable job queues on the hot path measured p50 8 s / p99 422 s for 94 % reads, while hub publish→receive is 2 ms.

Revisit a WebSocket broker (Go service behind Caddy `reverse_proxy`, same JWT grants and envelopes; replace only the subscriber/publisher adapters) only if: relay p95 > 1 s with RTT < 200 ms, or sustained > 50 frames/s per device, or backpressure becomes necessary. WebTransport: not while the edge serves `h1 h2`. If long disconnect windows ever matter, Bolt history for the response topic only.

## 3. Identity, enrollment, pairing

- Device identity: random device UUID + Ed25519 key created once in `CORE_NODE_DATA_DIR/config/pycore_relay_identity.json` (mode 0600, applied before the atomic replace). Identity mutations are serialized on one THREAD_BUS owner; a missing or invalid private key is never silently replaced while enrollment or credential state exists.
- The relay device id is the node's one persisted identity: worker ids derive from it (`build_worker_id` = `<prefix>-<first 12 hex of device id>[-PYCORE_WORKER_INSTANCE]`), so they survive VM restarts where the hostname changes. A worker row registered under the hostname-based id (`legacy_worker_id`) is unregistered once per server and process only after its pending outbox results delivered (`_retire_legacy_id`).
- Enrollment (outbound only): device creates an enrollment (device ID, public key, label = hostname, platform, contract and capability digests, capabilities), signed by the proposed key (credential-version header = key version, no credential-ID header) → Laravel returns enrollment ID + one-time claim code → an owner claims → device polls status every `enrollment_poll_seconds` (5 s) and receives a scoped credential only after the claim commits. Same key → same pending/claimed enrollment; a code is claimable once; rotation stores the new key version before revoking the old one.
- Auto-claim: an authenticated admin (`User::isAdmin()`, rolelevel ≥ 10) roster read runs `RelayEnrollmentService::autoClaimPending` best-effort before the snapshot (server-side encrypted claim-code copy), so a new pycore joins without console access. It reuses `claim()` (ownership guards, credential rotation, post-commit presence). Non-admins never adopt devices; manual claim stays available.
- Fleet scope (`RelayFleetScope`): super admins (rolelevel ≥ 100) share one fleet for device visibility, pairing anchor gates and presence fan-out (one outbox row per fleet member's owner topic with that member's roster snapshot); others are owner-scoped. Pairings stay per user. A device enrollment carrying a valid client-key signature is claimed at once for `RelayFleetScope::clientKeyOwner()` (first super admin), so it joins the shared fleet.
- Signed device requests (`signature_profile`, Ed25519): canonical input = protocol version, credential version, method, normalized path, sorted query, device ID, timestamp, nonce, SHA-256 of exact body bytes; canonicalization rules and `X-Pycore-Relay-*` header names are in the contract. Laravel checks owner binding, credential state, clock window (`signature_clock_skew_seconds` 60), body digest, signature and one-time nonce (atomic, per credential version, retained 300 s) as independent steps. Signed HTTP calls use profile `control` with separate connect and read timeouts (`subscriber_connect_timeout_seconds`, `request_timeout_seconds`).
- Pairing: one user × one device × one UI client instance (hashed); renew/revoke by pairing ID, never overwriting another session; lease `pairing_lease_seconds` 86400. Admission resolves pairing → device from a Redis pairing cache (`roster_cache_seconds` 30), invalidated on pairing create/renew/revoke and on a miss (`409 pairing_not_active`).
- Credential revocation (`relay.credential.revoked`) is applied by the device only when `credential_id`/`credential_version` match its current credential.

### 3.1 Tables (`global_` prefix, created by `php artisan sys:init`)

| Table | Content |
| --- | --- |
| `relay_devices` | device ID, owner user, public key + credential version, label, platform, capabilities + digest, contract digest, status, last-seen, expiry/revocation |
| `relay_enrollments` | enrollment ID, hashed + encrypted claim code, proposed key/digests/capabilities, state, claimant, expiry, revision |
| `relay_credentials` | credential versions per device |
| `relay_pairings` | pairing ID, user, device, hashed client instance, state, expiry, credential version, revision |
| `relay_blobs`, `relay_blob_chunks` | operation-independent blob store; immutable chunks `(blob_id, chunk_index, chunk_digest)`; finalize verifies contiguity, length, digest; private storage via `PathMapper`/`FileSystemManager`, outside the public docroot |
| `relay_nonces` | one-time nonces |
| `relay_outbox` | owner-event publication; unique `(entity_type, entity_id, revision, event_type)`; published after commit, the timer publisher retries failures |
| `relay_ledger` | per-call telemetry (`RELAY_LEDGER`), drained from Redis in batches of `ledger_drain_batch` 500 |

Migration filenames (`global_RelayV2_*`, `global_Relay_*`) are applied state and keep their names; renaming re-runs them. Never drop existing tables.

## 4. Lifecycle constraints

Enrollment and identity
- Enrollment recovery is driven only by explicit coordinator codes (`enrollment_not_found`, `device_not_found`, `device_credential_revoked`, `signature_credential_missing|invalid`, `signature_enrollment_not_found`). Any other 401/403 (timestamp, nonce, digest, protocol, signature) keeps the identity and retries with backoff; it never rotates keys.
- A single known but stale device is "temporarily offline", not "no device"; a missing selected device never silently redirects an action to another machine.
- Enrollment commit refreshes the roster and publishes presence after commit, through the same lifecycle as heartbeat. Presence = last heartbeat within `presence_timeout_seconds` (65).
- Deploy is lockstep: `session_id` is required on heartbeat and a contract digest change is a flag day; an old pycore gets 422 / `contract_digest_conflict` and stays offline until updated.

Roster and selection
- Roster reads query the authoritative device registry; no second cached roster copy and no worker-local (APCu/static) roster.
- The UI merge preserves presence that arrives during an in-flight snapshot, reconciles periodically (`roster_reconciliation_seconds` 60) even with a live stream, and validates `devices` is an array at the API boundary (`RELAY_ROSTER_PAYLOAD_INVALID`).
- Empty roster returns stable `RELAY_GROUP_EMPTY` with an i18n message about account-scoped visibility; never advise re-enrolling.
- Persisted selected device IDs are validated against the authorized roster before admission; repeated failures are bounded.
- The relay roster and owner stream run only while a relay target is selected (`pycoreTarget` kind `relay`; transport is never inferred from HTTPS, ports or the page host).

Auth and fencing
- Owner calls go through `BaseAPI.rawRequest`: K3-signed by `withClientKey` whenever the build holds a key (the routes are `client_key_or_session` in `/api/public/client-key-routes`) and carrying the Sanctum Bearer when logged in. A 401 opens the shared login window only in a build without a key; a `client_key_*` rejection never prompts a login and keeps bounded backoff. A session 401/403 on grant, roster or stats pauses reconnecting/polling until the shared auth session changes; a hub 401/403 discards the grant so the next connect re-grants; network failures keep bounded backoff.
- Roster, pairing and frame work are fenced by auth generation; responses from a superseded generation are rejected, never shown to the next account. An auth change drops stored pairings and the grant; the selected device is revalidated against the next owner's roster. Stream cursors reset on auth transitions.
- General endpoint-selection events must not reset the relay roster or stream. A real coordinator change resets coordinator-owned state and fences pending work.
- Errors cross the UI boundary with domain code, status, path and server-localized message (`LaravelRequest.ts`); UI strings are i18n keys.

Streams
- Reconnect backoff resets only after a stable connection, not on HTTP 200 headers; abnormal chunk termination is not a clean close; incomplete SSE frames are discarded and cursors commit at complete frame boundaries. Subscriber connect 10 s, read 90 s, reconnect 1–30 s.
- Browser reconnects send `Last-Event-ID` alongside the initial `lastEventID` query cursor, same as the Python subscriber.
- Tokens are renewed proactively from their lifetime, not after rejection.

Contract and server
- Contract digest = SHA-256 of the LF-normalized file bytes (`relay_contract.normalize_eol`, `RelayContract::canonicalContractBytes`). Mismatch answers `409 contract_digest_conflict`. Capability digest = SHA-256 of the sorted, newline-joined capability list.
- `RelayContract::load()` reloads when the file signature (`filemtime:filesize`) changes; the worker watch includes the contract directory.
- Composite identifiers are hashed in PHP before PostgreSQL advisory locks (`text` cannot carry NUL).
- pyservice mode: explicit argv/env (`PYCORE_SERVICE_MODE`) persists to `pyservice_mode.json` (best-effort; an unwritable store never blocks startup); a bare launch reuses the cache, default 1; shell launches always pass `--service-mode` (default 1). Mode 2 = relay UI.

Event tunnel
- `relay_events` taps the journal: dedicated topics (`terminal.changed`, agent-history prompt/config) post one device event each; every other public event is batched into one `pycore.events` device event (2 s flush, ≤ 200 entries, ≤ 48 KB payload, ≤ 16 KB per entry, queue cap 2000, backoff to 60 s). Events raised by the flusher thread are excluded.
- Latest-wins per batch is keyed by (topic, entity): `audio_orch` tasks by `task_id`, engine load status by `name`, snapshot topics (queue bump, settings, Qwen queue, agent-history sessions/video) by topic; every other topic keeps all entries in order (`engine_load_log_appended` is never collapsed).
- Drops (queue full, failed post) are counted; the next batch carries `dropped` and `since` (earliest drop, unix ms). The UI publishes `relay.events.dropped` and live stores, topic refreshes and the orchestration list reconcile exactly like after a reconnect. Console log entries carry their journal sequence; the UI fills gaps through the console log history route.
- The UI replays entries on `pycoreEventBus` with the same topics and dedupe as direct mode, filtered by the selected device; dedicated topics (`PYCORE_RELAY_DEDICATED_TOPICS`) are bridged once in the shared client. Laravel publishes `terminal.changed` once per owner/device revision.
- Reads are single-flight per `method+url`; on 429 reads back off (5–60 s) while mutations still go through.

Terminal resources
- `ui/terminal/windows` returns metadata, state/screenshot revisions and resource descriptors, never base64 images; `ui/terminal/viewer_demand` renews a bounded viewer lease (`terminal_viewer_demand_lease_seconds`); `ui/terminal/screenshot` serves digest-addressed PNG with ETag and 304. Capture is coalesced per window, fenced by a per-window epoch, and an unchanged digest emits no revision or event. Limits: contract `terminal_*`.

## 5. pycore → Laravel worker delivery

Delivery outbox, breakers, uploader dedup and worker intake: `DESIGN_QUEUE_PIPELINE.md` §7.4, §8, §9.1; engine memory gating: `DESIGN_TTS_AI_RUNTIME.md`. Relay steady state is silent: per-request chatter logs at debug (`PYCORE_ACTIVITY_DEBUG=1`).

## 6. Verification

- Contract: digest equal in PHP, Python and TS (`python3 -c "import hashlib;b=open('config/pycore_relay_contract.json','rb').read();print(hashlib.sha256(b.replace(b'\r\n',b'\n')).hexdigest())"`); device log shows heartbeat 2xx, no `contract_digest_conflict`.
- Server: `php artisan route:list --path=relay`; Redis db 3 reachable as connection `relay`; `sys:init` applied (`global_relay_ledger`).
- Session fencing: two agents on one copied identity → only the newest executes; the older logs `session.superseded` once and stops heartbeating.
- End to end (Windows device + browser): 200 sequential `/status` reads, p50 ≤ 0.6 s, p95 ≤ 1.2 s; `GET /api/relay/stats` shows the traffic.

## 7. Open items

1. The relay has not run end to end on Windows (acceptance in §6). Device-side latency stays unmeasured until relay stats show real traffic.
2. Leftover to remove (user decision): the `pycore/pyctl/relay/fabric/` directory (pycache only).
3. Audio orchestration books sync still polls every 3 s (`ORCH_POLL_MS`); Laravel-fed Queue Center slices reconcile every 30 s instead of being fed from Laravel Mercure.
4. Slow server responses seen from Windows (`/api/queue-center/overview` 8 s read timeouts, slow `/api/health`, worker register 20–25 s): check FrankenPHP thread saturation and the overview query.
5. Only the corebook handlers report done/total progress; other long handlers send heartbeat progress only. Frames lost during a UI stream outage surface as a stall timeout.
6. Re-encrypt the 12 secret files encrypted with a U+FEFF-prefixed password once `secret_password_runner.js` strips a leading BOM (the fix is not in the tree; needs the Windows user's approval).
