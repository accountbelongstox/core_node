# Relay Fabric V3: hub-native RPC for pycore ⇄ Laravel ⇄ UI (pyservice mode 2)

Date: 2026-09-30
Status: design (this document is written before any code); supersedes the
"durable job queue for every call" data plane of
`DESIGN_20260823_PYCORE_REMOTE_RELAY_V2.md` for interactive traffic.
Authors: laravel-remote (server evidence + Laravel), contracts for pycore and UI.

## 0. One-paragraph summary

In pyservice mode 2 every UI interaction is turned into a *durable job*
(HTTP admit → wake → device claim → device start → execute → device result →
status push → UI fetch). A median call takes **8 s** (p90 16 s, p99 7 min) to move
tens of bytes. The server is not slow (admit 51 ms, claim 18 ms), the Mercure hub is
not slow (2 ms publish→receive), and the WAN is not slow (RTT 130 ms). The cost is the
*architecture*: 6+ sequential request/response hops per call, a PostgreSQL state
machine and a PHP worker on every hop, and 94 % of calls being polls that never
needed durability. V3 replaces the interactive data plane with **hub-native RPC**:
frames travel over the already-proven Mercure hub (SSE down, one HTTP POST up), PHP
and PostgreSQL leave the hot path, and the durable queue is kept only for actions
that need it. Expected call latency: ≈ 2 RTT + execution ≈ **0.3 s** (≈ 25–30× faster).

## 1. Symptoms

- Remote Pycore Manager UI (mode 2, `ui12gm.com` → `api.si.12gm.com` → device) feels frozen:
  panels update every several seconds, actions "hang", the connected indicator flaps.
- Prior fixes (event tunnel, admission single-flight, 429 back-off, worker restarts,
  CPU quota) removed *pathologies* but not the base latency.

## 2. Evidence (all measured 2026-09-30 on the live host)

Method notes: relay timestamps in `global_relay_operations` are `timestamp(0)`
(1-second resolution), which is itself why the problem stayed invisible; percentiles
below are therefore ±1 s. Server-side costs were measured in-process inside a
rolled-back transaction; hub latency with a throw-away private topic.

| Measurement | Result |
| --- | --- |
| Volume, last 24 h | 2,916 responded operations; 2,005 `terminal_resource`, 549 `general_read`, 101 `terminal_read`, 101 `terminal_write`, 160 `general_action` → **94 % are reads/polls** |
| End-to-end (accepted → completed) | p50 **8 s**, p90 **16 s**, p99 **422 s** |
| accepted → execution start | p50 **6 s**, p90 13 s, p99 413 s (buckets: 3 ops < 1 s, 167 in 1–2 s, bell-shaped 2–10 s, tail to 23 s) |
| execution start → completed | p50 1 s (a trivial local read) |
| Payload | route `general_read` average response 27 B; `terminal_resource` up to 51 KB |
| Server cost per call | `admit` 51 ms (11 queries, 41 ms DB); `claim` 17.5 ms (9 queries) |
| Hub delivery (publish → subscriber) | **2 ms** through `https://api.si.12gm.com/.well-known/mercure` (Caddy `encode`/`reverse_proxy` in path), 1 ms direct on :9000; first event 58 ms (connection warm-up) |
| Outbox (server publish lag) | 0 ms (published in the same second), 45,010 outbox rows for 2,916 operations = **15 hub events per operation** |
| WAN | server in Singapore (Tencent, `43.163.112.77`); client kernel RTT **122–140 ms**, 54 external connections, 31 from one client IP |
| Server thread model | FrankenPHP 4 worker threads; each relay hop is a full Laravel request |
| Host state during measurement | load 0.3, CPU 23 % of one core: this is the **healthy** baseline, not a saturation artefact |

Conclusion of the evidence: 8 s is not explained by compute (≈ 0.1 s server), hub
(0.002 s) or propagation (6 hops × ≤ 3 RTT ≈ 2.4 s worst case with a cold TLS
handshake per hop). The remaining seconds sit in *sequencing on the device and
client* (thread-per-operation with a fresh pooled HTTP session, serialized control
loop, clock probe, recovery cadence fallbacks). That portion is **not directly
observable from the server** and is one of the things V3 makes observable (§9).

## 3. Root causes (architectural, in order of weight)

1. **Wrong abstraction on the hot path.** A durable, leased, exactly-tracked job
   queue (accepted → leased → executing → responded, claim epochs, nonces, outbox)
   is used for `GET /status`. Durability buys nothing for a read that can simply be
   re-asked.
2. **Hop count.** One interaction needs: UI POST admit → (hub wake) → device POST
   claim → device POST execution-start → local execution → device POST result →
   (hub status) → UI GET response. Six sequential HTTPS exchanges plus two hub hops,
   each with TLS/HTTP framing, a device signature, a nonce row and a DB transaction.
3. **PHP + PostgreSQL in the data path.** `admit` takes `SELECT … FOR UPDATE` on the
   *user row*, so all admissions of one owner serialize on one lock; every hop is
   one of only 4 FrankenPHP threads. Load on the relay directly competes with the
   rest of the API for the same 4 threads.
4. **Wake path is advisory, recovery is slow.** The hub runs `transport local`
   (no history, per Mercure docs "local disables history entirely"), so a wake lost
   across a reconnect is never replayed; the device falls back to a claim poll every
   15 s, and **60 s** while it *believes* the stream is connected
   (`_recovery_claim_seconds = base × 4`). That is the source of the long tail
   (p99 7 min includes lease expiry).
5. **Client sequencing.** One new thread per operation (`start_bus_task`) means a
   new thread-local pooled HTTP session per operation, i.e. a new TCP+TLS handshake
   (3 × 130 ms) for `execution-start` and again for `result`; a per-operation
   lease-renew thread; a clock probe; serialized `_control_loop`.
6. **Fifteen hub events per operation** (presence 6, status 4, `pycore.events` 4,
   wake 1) and a 1 s resolution ledger amplify load and hide timing.
7. **Instrumentation lies.** `GoLatency` middleware rewrites `X-Response-Time` /
   `X-Runtime` to random 5–30 ms and spoofs `Server: Nginx`; the number that
   engineers normally read first cannot be trusted. (V3 adds a truthful
   `Server-Timing` header on fabric routes.)

## 4. Options compared (with official documentation)

| Option | Hops / call | PHP threads in path | DB in path | Direction | Notes from official docs |
| --- | --- | --- | --- | --- | --- |
| A. **Current durable queue over HTTP + SSE wake** | ≥ 6 exchanges | every hop | every hop | – | Measured 8 s p50. |
| B. **HTTP long-poll served by PHP** | 2–3 | one thread per waiting device (blocks) | optional | pull | FrankenPHP: threads default `2 × CPU`, `max_wait_time` = how long a request waits for a *free PHP thread*; a blocking request pins a thread ([FrankenPHP config](https://frankenphp.dev/docs/config/)). With 4 threads, 4 idle devices would starve the API. **Rejected.** |
| C. **SSE via Mercure down + HTTP POST up (hub-native RPC)** | **2 one-way legs each side** | 0–1 (UI→PHP only) | none | down: push; up: POST | FrankenPHP embeds the hub ([FrankenPHP Mercure](https://frankenphp.dev/docs/mercure/)); Mercure publishing is an HTTP `POST` with a JWT whose `mercure.publish` claim holds topic matchers; private updates require a `mercure.subscribe` claim ([Mercure spec](https://mercure.rocks/spec)); the FAQ states "the round-trip cost of subscribe via SSE, send via `POST` is negligible on HTTP/2" and payloads are unbounded ([Mercure FAQ](https://mercure.rocks/docs/reference/faq)); the spec says connections SHOULD use HTTP/2+ ([spec](https://mercure.rocks/spec)). **Chosen.** |
| D. **WebSocket broker (separate Go/Python service behind Caddy)** | 1 one-way leg each side | 0 | none | full duplex | Caddy `reverse_proxy` supports the upgrade and then a bidirectional tunnel ([Caddy reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)); FrankenPHP has **no** built-in WebSocket server (open feature request [php/frankenphp#1888](https://github.com/php/frankenphp/issues/1888), alternatives Swoole/ReactPHP); classic browser WebSocket has no backpressure ([MDN WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)); over HTTP/2 it needs RFC 8441 extended CONNECT ([RFC 8441](https://datatracker.ietf.org/doc/html/rfc8441)). Wins only for "tightly-bound, low-latency, full-duplex" workloads (Mercure FAQ: games, voice). Adds a new stateful service, auth, roster and supervision. **Deferred** (revisit criteria in §11). |
| E. **WebTransport / HTTP/3** | 1 | 0 | none | duplex + datagrams | MDN marks WebTransport as the expected WebSocket successor but with narrower browser support ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)); our Caddyfile serves `h1 h2` only. **Not now.** |
| F. **PHP-native SSE/streams in Octane workers** | 1–2 | one thread per stream | – | push | Same thread-pinning problem as B; FrankenPHP itself points to Mercure for this. **Rejected.** |

Additional facts that shape the Mercure design:

- SSE is strictly server→client; the client sends with normal HTTP requests
  ([MDN SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)).
  Browser limit is 6 SSE connections per domain on HTTP/1.1 but ≈ 100 streams on
  HTTP/2, so the UI must keep **one** owner stream (already true) and our `:443`
  serves h2.
- Caddy `reverse_proxy` flushes `text/event-stream` immediately and Caddy `encode`
  does not list `text/event-stream` among default compressed types
  ([encode](https://caddyserver.com/docs/caddyfile/directives/encode)); our own test
  confirmed no buffering (2 ms through the full front door).
- Hub knobs (defaults): `dispatch_timeout 5s`, `write_timeout 600s`, `heartbeat 40s`;
  history only with the Bolt transport, `local` keeps none
  ([hub config](https://mercure.rocks/docs/hub/config)). The open-source hub is
  single-node; our deployment is single-node, so this is acceptable.

## 5. Decision

**Fabric V3 = Mercure-native RPC with tiered lanes.**

- **Fast lane** (default for every route with retry policy `read` or `idempotent_write`,
  and for streams/polls): request and response are *frames* on hub topics. PHP is
  touched once (UI → Laravel frame admission, ≈ 15 ms, no PostgreSQL transaction);
  the device answers by publishing **directly to the hub** with a topic-scoped JWT.
- **Durable lane** (routes with retry policy `at_most_once_action`, long-running
  work > 30 s, or when the device is offline and the caller opted into queueing):
  the existing V2 state machine, unchanged. It carries ≈ 6 % of today's traffic.
- Laravel becomes the **control plane**: enrollment, pairing, roster, token minting,
  policy, rate limits, audit. It leaves the data plane.

This is a replacement, not a wrapper: the fast lane shares no code path with the V2
claim/lease machinery, has its own contract section, its own device agent module and
its own UI transport class.

Why not WebSocket first: the Mercure FAQ quantifies the difference for our shape
(SSE + POST on HTTP/2 is negligible next to a 130 ms WAN RTT), WebSocket needs a new
stateful service that FrankenPHP cannot host, and Mercure already gives topic auth,
private updates, reconnection (`Last-Event-ID`) and heartbeats. The frame envelope is
transport-neutral, so a WebSocket broker can replace the hub later without touching
UI or device business code (§11).

## 6. Architecture

```text
Browser (ui12gm.com)                 Laravel + FrankenPHP (Singapore)              Device (pycore, outbound only)
        |                                     |                                            |
 SSE  <=================== hub (Mercure, in Caddy, Go) =========================> SSE   (one stream each)
        |                                     |                                            |
        | 1 POST /api/relay/fabric/frames     |                                            |
        |------------------------------------>| authz (Redis roster cache), policy,        |
        |                                     | rate limit, mercure_publish() in-process   |
        |                                     |==== req frame on relay/v3/req/{device} ===>| 2 execute via RPC kernel
        |                                     |                                            |
        |<========= res frame on relay/v3/res/{owner}/{device} (device POSTs to hub) =====| 3 keep-alive POST, scoped JWT
        |                                     |                                            |
        control plane (unchanged cadence): heartbeat 20 s, enrollment, presence, token refresh
```

Latency budget (RTT_ui ≈ RTT_dev ≈ 130 ms): UI→server ½ RTT (65 ms) + PHP 15 ms +
hub 2 ms + server→device ½ RTT (65 ms) + execution + device→hub ½ RTT (65 ms) +
hub→UI ½ RTT (65 ms) ≈ **280 ms + execution**, versus 8,000 ms today.

### 6.1 Topics (added to `pycore_relay_contract.json → topics`)

| Contract key | Template | Publisher | Subscriber |
| --- | --- | --- | --- |
| `fabric_request` | `{laravel_api_origin}/.well-known/relay/v3/req/{device_id}` | **Laravel only** | the device |
| `fabric_response` | `{laravel_api_origin}/.well-known/relay/v3/res/{owner_topic_token}/{device_id}` | the device (scoped) | the owner UI (private) |

`owner_topic_token` reuses `RelayTopicService::opaque('owner', userId)` (HMAC), so
topics are unguessable and never reveal user ids.

### 6.2 Authorization (JWT `mercure` claims, HS256, existing separate keys)

- **Device**: `subscribe = [fabric_request(device)]` (private) and
  `publish = [fabric_response(owner_i, device) for each active pairing]`. TTL 300 s.
  The device can never publish on a request topic, so it cannot forge work.
- **Owner UI**: `subscribe = [existing owner topic, fabric_response(owner, d) for
  each paired device d]` (private). **No publish claim is ever issued to a browser**
  (no CORS/JWT-in-browser exposure); the UI publishes through Laravel (§6.4).
- New helper `RelayHubJwt::scopedPublisherToken(subject, topics, ttl)`; the global
  `publish: ['*']` token stays server-side only.
- Refresh: the device heartbeat response carries a new `fabric` grant whenever the
  current one has < 90 s left (no extra request); the UI refreshes on the existing
  `subscriber_token_refresh_margin_seconds` path.

### 6.3 Frame envelope (JSON UTF-8, ≤ `limits.fabric_frame_bytes` = 60,000 B)

Request (`type = relay.fabric.request`, private update on `fabric_request`):

```text
{ "v":3, "op":"<uuid>", "owner":"<owner_topic_token>", "pair":"<pairing_id>",
  "m":"GET", "p":"/status", "q":{...}, "h":{allow-listed headers},
  "pol":"general_read", "lane":"fast",
  "b":{"len":0,"sha256":"...","b64":"..."|null,"ref":"<blob_id>"|null},
  "iat":<unix_ms>, "dl":<unix_ms deadline>, "seq":<owner monotonic> }
```

Response (`type = relay.fabric.response`, private update on `fabric_response`):

```text
{ "v":3, "op":"<uuid>", "s":200, "h":{...},
  "b":{"len":27,"sha256":"...","b64":"...","ref":null},
  "part":{"i":0,"n":1},                # inline chunking for 60 KB < body ≤ 256 KB
  "t":{"dev_recv":<ms>,"exec_ms":<n>,"dev_send":<ms>} }
```

Rules:

1. Bodies ≤ 45 KB are inline base64 (framing overhead 33 %); 45 KB–256 KB use up to
   6 ordered `part` frames; larger bodies keep using the existing blob endpoints and
   the frame carries `ref` + digest (screenshots are already served as conditional
   binary resources by `terminal_resource`, so the polled body becomes a small
   revision notification and the image an out-of-band GET).
2. `dl` is authoritative: the device drops a request whose deadline passed; the UI
   fails the call at `dl` (route policy timeout, 15–30 s) — no lease machinery.
3. Every response carries `t.*` device timestamps; the UI and Laravel compute per-hop
   latency from `iat`, `dev_recv`, `dev_send` and its own receive time (clock skew
   bounded by the existing clock probe).
4. `at_most_once_action` never uses the fast lane; `idempotent_write` may, and the
   device ledger (`relay_execution_ledger`) answers a duplicate `op` with the cached
   response frame for 120 s, so a UI retry after a lost frame is safe.

### 6.4 Frame admission (`POST /api/relay/fabric/frames`, Laravel, owner-authenticated)

Validates HTTP shape, owner ↔ pairing ↔ device from a **Redis roster cache**
(invalidated by pairing/enrollment changes and a 30 s TTL), route policy
(`RelayContract::routePolicy`), size, per-user rate limit (Redis token bucket, keyed
by user + lane, replacing the IP-keyed limiter), then publishes with the in-process
`mercure_publish()` (measured 1 ms). No PostgreSQL transaction, no user-row lock.
Returns `202 { op, dl }`. Audit is appended to a Redis stream and drained in batches
into `global_relay_fabric_ledger` (`timestamptz(3)`), off the request path.

Fallback: if the roster cache misses, one indexed read (no lock) rebuilds it.
If the device is not present (presence key in Redis, refreshed by heartbeat) the call
fails fast with `device_offline` (the UI may then choose the durable lane).

### 6.5 Device agent (pycore)

- One **fabric session** (one thread, one keep-alive HTTP session) publishes
  responses straight to the hub; one SSE reader per device on the request topic
  (the existing `MercureSubscriber`, now also the request receiver).
- Executes through the shared RPC execution kernel (same as V2, no local HTTP hop).
- A bounded worker pool (default 8) executes requests concurrently; results are
  published as soon as ready; no per-request thread creation, no per-request TLS.
- Connection health is a first-class state: when the stream is not connected the
  device does **not** advertise `fast` capability in heartbeat; the UI then uses the
  durable lane. There is no "4× slower recovery while connected" rule in V3.

### 6.6 UI (TypeScript)

- New `LaravelFabricTransport` implements the existing `PycoreTransport` interface
  (`deliver`, `subscribe`, `health`): `deliver()` POSTs the frame, awaits the
  response frame on the already-open owner stream keyed by `op`, enforces `dl`,
  reassembles `part` frames, verifies digest, resolves a fetch-shaped `Response`.
- Read single-flight per `method+url` (already implemented) stays; adds a
  short-TTL (250 ms) response coalescing for identical in-flight reads.
- `terminal_resource` polls are replaced by revision events + conditional GET.
- Feature components keep using only the transport interface.

### 6.7 Hub and Caddy configuration changes

- Keep `transport local` for the fast lane (frames are ephemeral by design). Enable
  `subscriptions` (already on) so Laravel can read subscriber presence.
- Set `dispatch_timeout 5s` explicitly, `write_timeout 0s`, `heartbeat 20s`
  (already), and add `request_body { max_size 262144 }` on the publish route.
- Do **not** add `encode` for `text/event-stream` (default already excludes it).
- Enable HTTP/2 on every route that fronts the hub (already `h1 h2`).

### 6.8 Security review

| Threat | Control |
| --- | --- |
| Device forges work for another device | device has no publish claim on request topics |
| Device injects into another owner's stream | publish claim lists only its paired owners' response topics |
| Browser abuses hub publish | no browser publish claim; admission via authenticated Laravel |
| Replay of a request frame | `op` + `dl` + device execution ledger |
| Hub key compromise | same trust root as V2 (keys live only in the runtime store); separate publisher/subscriber keys unchanged; topic tokens are HMACs |
| Data at rest on hub | `transport local` keeps no history; private updates only |
| Header abuse | same allow-list as V2 (`RelayContract::filterHeaders`) |
| Amplification / flooding | Redis token bucket per user + lane; 60 KB frame cap; device concurrency cap |

## 7. What is removed or reduced

- 94 % of durable operations and ≈ 13 of the 15 hub events per operation.
- The IP-keyed admission limiter; the user-row `FOR UPDATE` on the fast lane.
- Thread-per-operation and per-operation TLS on the device fast lane.
- Reliance on `GoLatency`: the obfuscating `X-Response-Time`/`X-Runtime`/`Server`
  headers stay (fingerprint hardening) but are never used for diagnostics; fabric
  routes add a truthful `Server-Timing: fabric;dur=<ms>` header.

## 8. Ownership and work breakdown

| Area | Owner | Work |
| --- | --- | --- |
| Contract | laravel-remote (author) + pycore-lead + pycore-ui review | **new file** `config/pycore_relay_fabric_contract.json` (own schema/protocol version and digest). `pycore_relay_contract.json` is **not** changed, so its digest and every connected V2 device keep working during rollout. Each runtime adds a small read-only `RelayFabricContract` adapter |
| Laravel | laravel-remote | `RelayFabric*` services, `POST /api/relay/fabric/frames`, grants in heartbeat + owner authorization, scoped JWT, Redis roster/presence cache, ledger table + drain timer, truthful `Server-Timing`, remove `GoLatency`, Caddy body cap |
| pycore | pycore-lead | fabric agent (request reader, response publisher, worker pool, duplicate cache, capability advertisement), removal of the 4× recovery rule for fabric |
| UI | pycore-ui | `LaravelFabricTransport`, lane selection by capability, coalescing, remove polls replaced by events |

Cutover: additive first (fast lane behind `lane=fast` capability negotiation), UI and
device advertise `fabric_v3`; when both do, the fast lane is used for policy `read` /
`idempotent_write`; otherwise V2. After 7 quiet days the polling routes are marked
`lane: fast` only in the contract. Rollback is a contract change (`lanes` → `durable`).

## 8a. Wire contract (normative for all three runtimes)

Contract file: `config/pycore_relay_fabric_contract.json` (protocol `3.0`). Its
SHA-256 over the canonical bytes is the *fabric digest*; devices and the UI send it
and Laravel answers `409 fabric_digest_conflict` on mismatch (V2 digest untouched).

Owner endpoints (Sanctum session/token, same auth as V2 owner routes):

| Endpoint | Body | Success | Errors |
| --- | --- | --- | --- |
| `POST /api/relay/fabric/grant` | `{contract_digest}` | `{hub_url, subscriber_token, topics[], devices:[{device_id, pairing_id, response_topic, fast_available, last_seen_ms}], grant_version, expires_in_seconds, server_time_ms}` | 409 digest |
| `POST /api/relay/fabric/frames` | `{operation_id, pairing_id, method, path, query{}, headers{}, body:{present, length, sha256, base64\|null}}` | `202 {operation_id, deadline_ms, device_id, lane:"fast", server_time_ms}` (a duplicate `operation_id` inside 120 s returns `200` with the same body and publishes nothing) | 403 `route_denied`, 409 `lane_durable_required`, 409 `pairing_not_active`, 413 `frame_too_large`, 429 `fabric_rate_limited`, 503 `device_fabric_unavailable` / `fabric_unavailable` |
| `POST /api/relay/fabric/telemetry` | `{items:[{operation_id, route_policy, lane, http_status, outcome, t_ui_send, t_ui_recv, dev_recv, dev_send, exec_ms, bytes_in, bytes_out}]}` (≤ 200) | `202` | – |
| `GET /api/relay/fabric/stats?minutes=15` | – | per-route `{count, p50, p90, p99, error_rate}` in ms | – |

Device endpoint (device-signed exactly like V2 device calls):

| Endpoint | Body | Success |
| --- | --- | --- |
| `POST /api/relay/fabric/device/heartbeat` | `{device_id, contract_digest, stream_connected, active_requests, grant_version}` | `{fast_capable, grant: null \| {hub_url, subscriber_token, request_topic, publish_token, response_topics:[{pairing_id, owner_topic_token, topic}], grant_version, expires_in_seconds}}` — `grant` is present when the current one has < 90 s left, `grant_version` differs, or none was issued |

`stream_connected=false` immediately withdraws the device's fast capability (Redis key
deleted); the UI then routes reads through the durable lane. Every 20 s the device
heartbeat keeps the key alive for 65 s.

Hub calls made **directly** by the device (no PHP):

```text
POST {hub_url}
Authorization: Bearer <publish_token>
Content-Type: application/x-www-form-urlencoded
topic=<response topic>&private=1&type=relay.fabric.response&data=<response frame JSON>
```

Request delivery (Laravel → device) is a private update of type
`relay.fabric.request` on the device request topic; the device subscribes with
`subscriber_token` (`Authorization: Bearer`, existing `MercureSubscriber`).

Multi-part responses: a body whose base64 is larger than `inline_body_bytes` is
split into `n ≤ max_parts` frames `part:{i,n}` with consecutive slices of the base64
text in `b.b64`; `b.len`/`b.sha256` describe the *whole* decoded body on every part;
the receiver concatenates in `i` order, decodes and verifies the digest. Decoded
bodies larger than `response_total_bytes` are rejected by the device with a single
frame `s=502`, header `x-relay-error: response_too_large`, and the caller retries on the
durable lane.

Phase 2 (not in the first cut): device→owner event tunnel (`pycore.events`) published
directly to the hub with the same scoped publish grant; today it costs one PostgreSQL
transaction and one outbox row per owner per batch.

## 9. Observability (part of the change, not an afterthought)

- Ledger table `global_relay_fabric_ledger(op, owner, device, route, lane, status,
  t_admit, t_publish, t_dev_recv, t_dev_send, t_ui_recv, bytes_in, bytes_out)` with
  `timestamptz(3)`.
- `GET /api/relay/fabric/stats` (owner) returns p50/p90/p99 per route for the last
  15 min; the UI diagnostic panel shows it.
- V2 operations table gets millisecond columns for the durable lane (so the
  remaining 6 % is also measurable).

## 10. Test plan

1. Server: loopback harness (throw-away topic, as used for the measurements) asserting
   hub p50 ≤ 10 ms and frame admission p95 ≤ 40 ms with 4 concurrent callers.
2. Contract: JSON schema check + digest conflict test between PHP/Python/TS adapters.
3. Device: synthetic request burst (50/s for 60 s) with duplicate `op` replays;
   assert no double execution and ledger replay returns identical bytes.
4. End-to-end (Windows device + browser): 200 sequential `/status` reads; acceptance:
   p50 ≤ 0.6 s, p95 ≤ 1.2 s, zero durable operations created for reads.
5. Failure drills: kill device SSE (fast capability withdrawn, UI falls to durable),
   restart hub (both sides reconnect, in-flight calls fail at `dl`, no ghost work),
   token expiry mid-stream.

## 11. Revisit criteria for a WebSocket broker (D)

Adopt D only if measured p95 fast-lane latency after V3 exceeds 1 s with RTT < 200 ms,
or a workload needs sustained > 50 frames/s per device, or backpressure becomes
necessary. Because frames are transport-neutral, the migration is: run a small Go
broker behind `reverse_proxy` (Caddy supports the upgrade), keep the same JWT grants
and envelopes, replace only `MercureSubscriber` / publisher adapters.

## 12. Risks and open items

- Device-side split of the 8 s is inferred (server data cannot see it); §9 telemetry
  will confirm. If a device-local cause (proxy, DNS, clock probe) survives V3 it will
  now be visible per hop.
- `transport local` drops frames while a party is disconnected: by design RPC
  deadlines cover it. If long disconnect windows matter, switch to Bolt history for
  the *response* topic only.
- Single-node hub: acceptable now; clustering would need the commercial transports
  (Mercure docs).
- Payload sizes above 256 KB stay on blob endpoints.

## 13. Sources

- FrankenPHP Mercure: https://frankenphp.dev/docs/mercure/
- FrankenPHP configuration (threads, `max_wait_time`, `php_ini`): https://frankenphp.dev/docs/config/
- FrankenPHP WebSocket feature request: https://github.com/php/frankenphp/issues/1888
- Mercure protocol: https://mercure.rocks/spec
- Mercure hub configuration: https://mercure.rocks/docs/hub/config
- Mercure FAQ: https://mercure.rocks/docs/reference/faq
- Caddy `reverse_proxy`: https://caddyserver.com/docs/caddyfile/directives/reverse_proxy
- Caddy `encode`: https://caddyserver.com/docs/caddyfile/directives/encode
- MDN Server-sent events: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
- MDN WebSockets API (WebSocketStream, WebTransport): https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API
- RFC 8441 (WebSockets over HTTP/2): https://datatracker.ietf.org/doc/html/rfc8441

## 14. Implementation status (Laravel, laravel-remote, 2026-09-30)

Done and live on the server (workers reloaded gracefully, no service restart):

- `config/pycore_relay_fabric_contract.json` (protocol 3.0); V2 contract untouched.
- `RelayFabricContract` (adapter + digest), `RelayFabricStore` (Redis db 3, connection
  `relay_fabric`, 0.5 s connect / 1 s read timeouts: presence, roster cache, op dedupe,
  per-user window limiter, ledger queue), `RelayFabricService` (grants, frame admission,
  device heartbeat, telemetry, stats, ledger drain), `RelayFabricCtl`, routes in
  `routes/RelayRouter/RelayApi.php` (owner routes are outside the V2 per-action limiter),
  `RelayHubJwt::scopedPublisherToken`, `RelayPairingService::activePairingRows`
  (shared by V2 authorization and fabric grants), roster-cache invalidation on pairing
  create/renew/revoke, i18n keys (en, zh_CN), ledger migration
  `global_RelayV3_2026_09_30_000001_create_relay_fabric_ledger_table.php`, and the
  ledger drain hooked into the existing 30 s `RelayMaintenanceService` slice.
- The drain and `stats` are table-aware: until the migration is applied they return
  empty results and never touch PostgreSQL, so the maintenance slice keeps working.
  **The migration is applied by the next 175 / `sys:init` run** (not applied by hand).

Verified against the live hub (throw-away flows, presence cleared afterwards):

| Check | Result |
| --- | --- |
| Frame admission (cold, CLI publish path) | 202 in 48 ms; duplicate `operation_id` → 200, nothing republished |
| Request frame reaches a subscriber holding the device grant | 40 ms including the CLI→hub HTTP publish (in-process `mercure_publish` in a worker measured 1 ms earlier) |
| Device publishes with the scoped token | own response topic → 200; another topic → **401**; the request topic → **401** |
| Owner subscriber receives the response frame | yes, private update, correct type `relay.fabric.response` |
| Lane guard | action route on the fast lane → `409 lane_durable_required`; unknown pairing → `409 pairing_not_active`; wrong digest → `409 fabric_digest_conflict` |
| Ledger: 20 admits + 20 telemetry rows, drain, merge, stats | 20 merged rows, p50 350 ms / p90 426 ms on synthetic data (rolled-back transaction) |
| V2 heartbeat/claim/operations | unchanged (V2 digest unchanged) |

Mistakes made and fixed during the work (recorded for the next engineer):

- A missing `use ($fabricUri)` in the device route group broke route registration for
  ~15 s for anything that booted the app (scheduler tick, two test runs); HTTP workers
  were not affected because they had not reloaded. Fixed and re-verified.
- The maintenance slice called the ledger drain before the table existed and logged one
  `relation does not exist` error at 12:58:30 UTC before the drain became table-aware.

Security note found while implementing (pre-existing, applies to V2 and V3 alike):
`RelayOwnerResolver::resolve()` returns `RelayFleetScope::publicOwner()`, i.e. the
owner routes are not per-user authenticated (an unauthenticated `GET` of the V2 roster
returns the device list). Fabric inherits the same trust model; the compensating
controls are the route policy exposure allow-list, the per-user window limiter and the
frame/deadline limits. Tightening owner authentication is a separate decision and is
called out in the final report.

Pending (other owners): device agent (pycore-lead), UI transport (pycore-ui),
Windows end-to-end run, 7-day quiet period before the polling routes become
`lane: fast` only. Phase 2: device→owner event tunnel directly on the hub.

## 15. Contract clarifications (from the pycore implementation review, 2026-09-30)

Normative additions to §8a; the contract JSON is unchanged.

1. `grant_version` is an **opaque string** (16 hex chars). Devices send `""` to force a
   new grant; servers never interpret it beyond equality.
2. Request frames carry no numeric user id. The device uses the `owner` topic token as
   the execution owner identity.
3. A request with `b.len > 0` and no `b64` is invalid on the fast lane (there is no
   `ref` in request bodies); the server never produces one, the device answers
   `400 relay_request_body_length_conflict`.
4. SSE timeouts: the fabric reader reuses the V2 `subscriber_*` connect timeout and
   reconnect backoff; its read timeout is `min(V2 read timeout, 2 × device_heartbeat_seconds)`
   (40 s, valid because the hub heartbeat is 20 s), so a dead stream withdraws the fast
   capability quickly.
5. Device in-flight cap reuses `limits.device_dedupe_entries` (512); beyond it the
   device answers `503 device_fabric_unavailable`.
6. Empty response body is `"b64":""`; a single-frame response is `part:{i:0,n:1}`; every
   part repeats `s`, `h`, `b.len`, `b.sha256` so any part identifies the response.
7. Clocks: `dl`/`iat` use the server clock; the device aligns to it through the V2
   request-clock probe (≈ 1 s resolution, +500 ms truncation compensation).
   `t.dev_recv`/`t.dev_send` use the raw device clock, so their difference is exact.
8. Known behaviour: `MercureSubscriber` renews its token by reconnecting, so
   `stream_connected` flips false→true about every 260 s. The server withdraws and
   restores the fast capability within one heartbeat round trip; a call landing in that
   window gets `503 device_fabric_unavailable` and the UI falls back to the durable
   lane for that single call.
9. Unknown routes resolve to the default profile, which is durable: they get
   `409 lane_durable_required`.
