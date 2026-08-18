# DESIGN 20260817 2115 - Pycore UI Relay Groups via Laravel Central Server + HTTP/3 Everywhere - PART 2 (Research)

Date: 2026-08-17 21:15
Document split 2026-08-17 into four parts (see PART_0 for the index).
Retention: the Reverb findings are kept as **historical (pre-pivot) research
context** only - the transport itself is fully removed (2026-08-17); the
binding transport research is §2.2.3 (Mercure protocol) + §2.2.4
(FrankenPHP built-in hub).

## Basic norms (binding for this part)

- Build from the underlying architecture, not patches; never thin-compatibility
  layers; follow the latest specifications.
- Merge common libraries and duplicate implementations; consult the official
  documentation before introducing anything new.
- Do not use multiple agents.
- Develop strictly per the specification (this design's four parts).
- Shell scripts: never use exit codes / return-value chaining; trust the
  previous function's execution result; detect binaries directly by probing
  the file system (no stale command-hash probing).

---

## 2.1 Project code findings (measured, no code changed)

### laravel_main (central server)

- Runtime pair (measured in `debian_com/laravel_run_runtime.sh`, invoked by
  `175_laravel_main_start.sh`): **Reverb on `0.0.0.0:8080` + Octane/Swoole on
  `0.0.0.0:9000`** (port from `config/service_contract.json`
  `ports.laravel_api_backend = 9000`) started as one supervised pair; USR1
  reloads both. `composer.json`: `laravel/octane ^2.13`, `laravel/reverb ^1.6`,
  Laravel framework `^13.0` (lock: v13.25.0). LEGACY: this pair is the
  compat-plane flow after PART_0 lands (frankenphp branch starts the single
  `octane:frankenphp` process, no Reverb).
- `config/reverb.php`: app credentials resolved from the external
  RuntimeConfigurationStore (REVERB_APP_ID/KEY/SECRET provisioned by the start
  script); `allowed_origins` defaults to `['*']`; **`max_message_size` is
  10,000 bytes**; `ping_interval` 60, `activity_timeout` 30. LEGACY (Phase 5
  retirement); its 10 KB ceiling taught the frame-size discipline the relay
  keeps (8 KB control frames, PART_3 §3.2).
- `routes/channels.php` today: two PRIVATE channels
  (`App.Models.User.glm-5.3_common`, `wordnew-social.{userId}`). The Queue
  Center channel (`queue-center`, from `config/queue_center_contract.json`)
  is PUBLIC - pycore and mcp-chrome subscribe with `auth: ""`. Under the
  pivot, ALL of these are legacy: queue events migrate to a Mercure topic
  (Phase 2), `wordnew-social.{userId}` is recorded as impacted (Phase 5),
  and the relay uses NO `/broadcasting/auth` channel at all (hub-auth JWT
  instead, PART_3 §3.5).
- `routes/api.php`: worker plane (`/api/worker/register|heartbeat|...`,
  hostname-stable `worker_id`) and queue-center plane are public route groups
  mirroring the contract `endpoints` block. The relay endpoints follow this
  same contract-driven pattern (already-written v25 block; sync renames in
  PART_3 §3.7).
- `RealtimeConnectionService` hands out the PUBLIC app key + connection
  metadata (Reverb form, raw `:8080`). Under the pivot it is RE-SCOPED to
  return the Mercure hub URL + topics + auth mode (PART_3 §3.7); no Reverb
  key distribution remains.
- Relay artifacts ALREADY WRITTEN (2026-08-17, pre-pivot wording): contract
  JSON relay block (schema 24 -> 25) with `channels` key + 12 endpoints incl.
  `/api/relay/channel-auth`; `config/service_contract.json` +
  `reverb_backend: 8080`; `QueueCenterContract.php` relay accessors;
  `app/Services/Relay/RelayMachineRegistry.php` (cache-TTL presence:
  register/heartbeat/unregister/isOnline/listOnline, machineId pattern,
  roster index - already presence-truth shaped, unchanged by the pivot).
  Pending renames recorded in PART_3 §3.7 (channels -> topics,
  channel-auth -> hub-auth, hub block).
- nginx (from `33_install_nginx.sh` + `common/nginx_manager.sh`): official
  mainline, `http_v3_module`, per-site stanza `listen 443 quic` + `http3 on` +
  `quic_retry on` + `quic_host_key` (fixed) + `Alt-Svc: h3=":443"` +
  `ssl_early_data on`; edge-port guard frees 80/TCP + 443/TCP + **443/UDP**;
  api sites proxy to `http://127.0.0.1:9000`. HTTP/3 is VERIFIED WORKING on
  this server (`FIX_20260817_NEXUS_DASH_HTTP3_DOMAIN_BINDING.md` measured
  `HTTP/3.0` 200s in access logs). Compat plane only after PART_0.

### pycore (G1 machine end)

- `pyctl/queue_center/snapshot_service.py` contains a complete,
  dependency-isolated **outbound Reverb WebSocket client**: pusher-protocol
  handshake, `pusher:subscribe` with `auth: ""` (public channel only),
  ping/pong keepalive, exponential reconnect backoff, endpoint re-derivation.
  This is the code base the shared realtime client is EXTRACTED from; the
  pivot changes its wire protocol to **SSE + HTTP** (mercure_client.py,
  PART_3 §3.7) - the lifecycle/reconnect/backoff structure survives, the
  pusher handshake does not.
- HTTP egress to Laravel is centralized (worker plane; result upload via
  `pyutils/laravel/client.py` single egress rule) - SSE downstream fits the
  same outbound-only posture.
- Local inbound: HTTP RPC server on `:59000` (`callmodule` + `rpc_routes/*`),
  bound for the browser in direct mode.

### pycore UI (G2/G3/G4 ends, nexus-dash)

- `core/integrations/pycore/pycoreTarget.ts`: three direct modes
  (origin/local/remote) + preset hosts (`127.0.0.1`, public IP,
  `100.126.119.99`, `100.101.149.39`). **No relay mode exists.**
  `PcPycoreTargetSwitcher.tsx` already documents the failure it causes: "page
  loaded over HTTPS/public origin -> browser blocked from reaching
  loopback/private pycore hosts directly" (mixed content + no route).
- **Endpoint model gap (measured)**: `buildPycoreHttpUrl()` ALWAYS appends
  `:59000`, and `pycoreHttpProto()` derives https only from the page protocol
  - an `https://` pycore endpoint WITHOUT a port (the reverse-proxied entry
  of 1.3) is NOT representable in the current target model. The transport
  layer must be rebuilt to carry full backend URLs (architecture change,
  per norm 1.9 - not a patch).
- `core/integrations/pycore/PycoreClient.ts` (PycoreMasterClient) +
  `PycoreApiTransport` isolate the transport behind `resolveBaseUrl()`; a relay
  transport can be slotted in without touching the domain layers
  (`PycoreApi*`, QueueCenter pump, terminal, code-sync, blobs).
- `core/integrations/laravel/LaravelReverbConnection.ts` was a dependency-free
  pusher-protocol WebSocket client with an `authorize` callback (socket_id +
  channel -> {auth, channel_data}). REMOVED with the Reverb removal: the
  relay/roster client becomes a thin **EventSource wrapper + hub-auth fetch**
  (PART_3 §3.7) in the UI phase.
- `LaravelEndpointManager` persists/switches Laravel base URLs - the relay
  transport reuses the active Laravel endpoint as its base.

## 2.2 Official documentation findings

### 2.2.1 Laravel 13 Octane (laravel.com/docs/octane)

- Octane is an HTTP application server (FrankenPHP / RoadRunner / Swoole):
  boots the app once, serves requests via workers/task-workers. **It hosts no
  pub/sub and no presence state.**
- The **frankenphp server driver** runs the Caddy-based app server in the
  Octane process: `octane:frankenphp --https` enables "HTTPS, HTTP/2, and
  HTTP/3, and automatically generate and renew certificates"; custom
  `--caddyfile`; `--admin-port`. Only this server can serve HTTP/3 itself
  (Sail maps `443/udp` for it).
- Production topology with Swoole is nginx in front; with frankenphp the
  front server IS the Octane process - which is exactly what PART_0 adopts.

### 2.2.2 Laravel 13 Broadcasting + Reverb (HISTORICAL - pre-pivot research context)

- Presence channels (`Broadcast::channel` returning an array, Echo
  `here`/`joining`/`leaving`) and `/broadcasting/auth` + `routes/channels.php`
  are the Reverb-era answers to roster/grouping. **Superseded for this design
  by the Mercure hub + heartbeat registry** (2.2.3/2.2.4); retained here
  because the compat plane runs them until Phase 5.
- Reverb's documented pattern (public `wss://host:443` terminated by nginx,
  internal `:8080`; horizontal scaling via Redis pub/sub) stays valid
  knowledge for the migration window - and is the reason the relay is
  plane-gated (PART_1 R9) instead of dual-transport.

### 2.2.3 Mercure protocol (mercure.rocks/spec) - BINDING transport research

Measured against the **latest Mercure specification (1.0-alpha,
2026-08-11; IETF draft-dunglas-mercure-08)** - the version the current hub
build implements in modern mode (2026-08-17 decision: code against the
LATEST spec, never the v0.x compatibility layer; `protocol_version_
compatibility` stays off). The v0.x model (`topic` query parameter, bespoke
`mercure` claim, `mercureAuthorization` cookie) is reachable only through
compatibility mode and is NOT used by this design.

- **Subscribe (downstream)**: `GET /.well-known/mercure?match=<topic>`
  (repeat `match` for several; `match_urlpattern` for URL-Pattern
  matchers) -> a **Server-Sent Events** stream. Browsers use the native
  `EventSource`; any HTTP client works for machines. Non-browser clients
  (pycore, UI fetch-stream readers) send `Authorization: Bearer <jwt>` -
  the spec-RECOMMENDED mechanism.
- **Publish (upstream)**: authenticated `POST /.well-known/mercure`,
  form-encoded fields `topic` (repeatable: canonical + alternates), `data`,
  `private` (flag), `id`, `type`, `retry`, with a **publisher JWT** in
  `Authorization: Bearer`. The server (Laravel) is the only publisher in
  this design - browsers never publish. Success = 200 with the hub-generated
  update id (text/plain).
- **Authorization (1.0)**: RFC 9068 access tokens (`typ: at+jwt`) carrying
  `iss`, `aud` (the hub URL), `sub`, `client_id`, `iat`, `exp`, `jti` plus
  an RFC 9396 `authorization_details` claim:
  `[{"type":"https://mercure.rocks/authorization-detail","actions":
  ["publish"|"subscribe"],"topics":[{"match":...,"match_type":...}]}]`.
  Publisher JWT grants `publish`; **subscriber JWT** authorizes receiving
  **private** updates (topic-scoped, matched against every topic of the
  update). For browsers, `EventSource` cannot set headers: the cookie
  mechanism (default name `__Secure-mercure_access_token`, Path = hub path,
  Secure, HttpOnly, SameSite=Strict) delivers the subscriber JWT.
- **Private updates**: delivered only to subscribers whose token grants
  `subscribe` on at least one topic of the update; unauthenticated
  subscribers (when the hub allows them at all) never receive private
  updates. Pair wake frames use `private=1` (PART_3 §3.1). The hub closes
  a subscriber connection at the token's `exp` - clients re-authenticate
  on reconnect (the 600s TTL aligns with the hub's default 600s
  `write_timeout`).
- **Reconnection / reconciliation**: native `EventSource` auto-reconnects and
  sends `Last-Event-ID` (the update `id`); the hub reconciles from its
  bounded event store. Missed frames replay - a strict upgrade over the
  current WS consumer's silent-gap behavior; the client still keeps a bounded
  poll fallback (PART_3 §3.2).
- **Subscription API / subscription events**: the hub exposes
  `/.well-known/mercure/subscriptions` and emits lifecycle events (`mercure`
  SSE event type) under a reserved topic namespace, gated to authorized
  subscribers. This is **connection-level presence** - it observes SSE
  connections, not application health, and is treated as a supplement only.
  The roster/gate authority stays the heartbeat registry (PART_0 §0.2).
- **Security rules (spec)**: access tokens only over HTTPS; **never in URLs**
  (`access_token` query param is not accepted); short-lived tokens strongly
  recommended; publisher key confidentiality is the primary concern; topic /
  type / id fields are constrained (no CR/LF/NUL - SSE field-injection
  prevention); publishing under the hub's reserved namespace is forbidden.
- **Frame shape**: updates are small control frames by design - this design
  keeps the 8 KB control-frame cap and the HTTP store/fetch data plane
  (blobs and bodies never ride updates).

### 2.2.4 FrankenPHP built-in Mercure hub (frankenphp.dev/docs/mercure)

- **Disabled by default**; enabled via the Caddyfile block (Mercure 1.0
  modern mode - the pre-1.0 flat `publisher_jwt`/`subscriber_jwt`
  directives are deprecated and only work in compatibility mode):
  `mercure { issuer <iss> { publisher { jwt <key> [<alg>] } ;
  subscriber { jwt <key> [<alg>] } } }`. Each `issuer` binds the trusted
  `iss` to its verification material - publisher and subscriber keys stay
  distinct. `anonymous` permits JWT-less subscribers (public updates only)
  - **we do NOT enable it** (PART_1 R7; it is off by default in 1.0). The
  hub derives the token `aud` (resource identifier) from each request by
  default; the cookie defaults to `__Secure-mercure_access_token`; default
  `heartbeat 40s` keeps intermediaries from idling the stream out. Keys +
  issuer live in the server secret store (RuntimeConfigurationStore family,
  PART_0 §0.5) and reach the hub as process env referenced by `{env...}`.
- Hub endpoint: `/.well-known/mercure` on the same 443 listener as the app -
  same domain, same certificates, same h3. Under Octane, configurable via
  `config/octane.php` `'mercure' => [...]` (b.txt's claim confirmed; its
  sample URL `http://127.0.0` is wrong - the real hub is the local 443
  listener).
- **`mercure_publish()`** PHP function - in-process publish, no network hop,
  no JWT handling in PHP for the publish path:
  `mercure_publish(string|array $topics, string $data = '', bool $private =
  false, ?string $id = null, ?string $type = null, ?int $retry = null):
  string` (returns the update id). Relay wake frames publish this way
  (PART_3 §3.2); the authenticated-POST path stays as fallback.
- **JWT signing server-side for `/api/relay/hub-auth`**: laravel_main vendors
  no standalone JWT signer today. Decision recorded in PART_3 §3.5:
  `lcobucci/jwt` (already vendored) builds the RFC 9068 tokens directly -
  the symfony/mercure component targets the v0.x token shape and was
  dropped from the dependency set (2026-08-17).
- SSE over h2/h3 multiplexes on one connection (no per-stream connection
  exhaustion like HTTP/1.1's 6-per-host limit); Caddy streams SSE responses
  natively (no proxy-buffering stanza needed, unlike nginx `X-Accel-Buffering`
  concerns).

### 2.2.5 nginx QUIC / HTTP/3 (compat plane; nginx.org/en/docs/quic.html)

- HTTP/3 since 1.25.0, in official Linux binary packages
  (`--with-http_v3_module`); `listen ... quic [+ reuseport]`, `quic_retry on`,
  `ssl_early_data on` (0-RTT), `quic_gso`, `quic_host_key`; QUIC requires
  TLS 1.3; OpenSSL >= 3.5.1 recommended for early data - exactly what
  `nginx_manager.sh` already implements and what
  `nginx_quic_early_data_supported()` probes. (Project evidence:
  `HTTP/3.0` 200s in access logs.) On the frankenphp plane this stanza set is
  replaced by Caddy defaults (PART_0).

### 2.2.6 WebSocket over HTTP/3 (RFC 9220) - why the design drops WebSocket

- RFC 9220 is a final standard, BUT browser support has NOT shipped (the
  Chromium feature has been unshipped since 2022; Mozilla bug open). Any
  `wss://` realtime would be stuck on TCP HTTP/1.1 - the exception the old
  design had to carve out.
- **Mercure's downstream is SSE - plain HTTPS** - so the realtime plane rides
  the same h3 listener as everything else (PART_1 H2). The exception is
  deleted rather than accommodated; no `wss` endpoint exists on any plane.

### 2.2.7 Tailscale CGNAT range

- `100.64.0.0/10` (RFC 6598 shared address space) - the "100.xx" prefix.
  Under the engagement rule (PART_1 1.3) these stay direct because their
  preset endpoints are `http://...:59000` (non-https selection); the range
  itself is not the classifier - the selected backend URL scheme is.

## 2.3 Answer to the runtime capability question (PART_1 1.5)

**Octane does not provide the b.txt capability by itself - and does not need
to. The capability comes from the plane it runs on plus the application.**

- Transport half: with the frankenphp driver (PART_0), the Octane process
  embeds Caddy and the **built-in Mercure hub** - SSE downstream to
  subscribers (pycore behind NAT, browsers, mcp-chrome later), server-side
  publish via `mercure_publish()`. Zero extra daemons, one 443 listener, h3
  everywhere including realtime (2.2.4/2.2.6).
- Gating half (both-ends-online): the hub has **no application presence**
  (2.2.3) - the roster/gate is the application-side heartbeat registry
  (RelayMachineRegistry, already written) refusing with `peer-offline` when a
  heartbeat is stale. The spec's subscription API is connection-level only
  and stays a supplement.
- Concretely, b.txt's "A sends, forwarded to B only if B online" maps to:
  UI `POST /api/relay/{machineId}/requests` -> Laravel checks registry + pair
  -> publishes a private `relay.request` update on topic
  `pycore.pair.{machineId}` -> pycore's SSE consumer wakes and executes via
  the HTTP store/fetch data plane (PART_3 §3.2).
- **Reverb is removed (2026-08-17)**: no relay path uses it and no plane
  runs it; the daemon, `reverb_backend` port, `queue-center` channel and
  `LaravelReverbConnection` are all deleted in the same change set
  (pycore/UI consumers migrate to Mercure in their own phases).

---

End of PART_2. Prerequisite: PART_0. Requirements: PART_1. Implementation
plan: PART_3.
