# DESIGN 20260817 2115 - Pycore UI Relay Groups via Laravel Central Server + HTTP/3 Everywhere

Date: 2026-08-17 21:15
Status: Part 1 (requirements) written first; Part 2 (code + official-doc research)
and Part 3 (implementation plan) appended after, per working order. No code changed.

Update 2026-08-17 (spec change, supersedes parts of the original Part 1):
- Transport engagement is now **selection of an HTTPS pycore backend** (no
  :59000 port; server-side reverse proxy), notified on selection. Non-https
  selections keep the current direct connection (1.3).
- The UI communicates with Laravel **at all times**; online pycore roster +
  designation of a machine -> paired-group state (1.3).
- Other groups become **capability providers**: declared in code, not
  implemented in this pass (1.8).
- Implementation order fixed: backend first, then pycore library extension,
  then UI (3.8).
- Binding development norms added (1.9).

Reference input:
- `docs_fix/origin/b.txt` - Laravel group-forwarding conversation (Reverb presence
  channels, A/B pairs, both-ends-online gating, offline fallback).
- `scripts/shells/linux/debian/install_shells/132_laravel_main_start.sh`
- `scripts/shells/linux/debian/install_shells/26_install_nginx.sh`

---

# Part 1 - Requirements (written before research; binding)

## 1.1 Question from b.txt mapped onto this project

b.txt asks: can Laravel forward messages between client groups (A, A1 <-> B, B1),
forwarding only when the other side is online? The project equivalent is:

> Can `laravel_main` relay pycore-UI traffic to a pycore machine when the browser
> cannot reach that machine directly, gating on BOTH ends being online?

The capability owner in this stack is **Reverb** (presence channels + channel
authorization), not Octane. Part 2 verifies this against the official docs.

## 1.2 Group topology (binding)

Five participants, one central server, four groups:

| Group | Members | Channel pairing semantics |
|-------|---------|---------------------------|
| G1 | pycore (the Python runtime, standalone) | Machine side of every UI<->pycore pair |
| G2 | pycore UI `pycore-manager` | UI side of the pycore pair |
| G3 | pycore UI `laravel-manager` | Talks to the central server only (no pycore relay need) |
| G4 | pycore UI `wordnew` | Talks to the central server only (no pycore relay need) |
| C  | `laravel_main` (central server) | Broker + presence authority for all groups |

Rules:

1. **G2 is a paired group (UI end + pycore end).** A paired group forwards only
   when BOTH ends are online (b.txt semantics). The pycore end is one selected
   pycore client machine; the UI end is the browser session.
2. **G3/G4 always talk to C directly** - they already do (LaravelAPI). The relay
   requirement does not change their data plane.
3. **G1 (pycore) alone** stays a group member of C: it registers, heartbeats,
   and keeps its existing outbound Reverb subscription. Nothing in the current
   pycore -> Laravel plane (result upload, queue events) is removed.
4. One UI browser session can host G2 + G3 + G4 simultaneously (the shell hosts
   all three apps today); only G2 needs the relay.

## 1.3 Core requirement: relay entry by selecting an HTTPS backend

UPDATE 2026-08-17 (supersedes the earlier page-origin classification): the
engagement signal is the **selected pycore backend endpoint**, not the page
origin.

- The user selects a pycore backend whose URL starts with `https://` and
  carries NO `:59000` port (the pycore service is reverse-proxied on the
  central server: TLS terminates at nginx :443 and the relay carries the
  traffic to the pycore machine). On that selection the UI **notifies** the
  user (visible transport switch + pairing handshake result) and **defaults
  to entering the relay scheme**.
- Every non-https selection - today's presets (`http://127.0.0.1:59000`,
  `http://<public-ip>:59000`, `http://100.x.x.x:59000`) and manual `http`
  entries - keeps the CURRENT direct connection, unchanged.

Always-on Laravel link (new baseline, both modes):

- The UI communicates with Laravel at ALL times (HTTP API + Reverb presence),
  regardless of the selected pycore transport.
- While linked, the UI watches the pycore group roster (`pycore.machines`
  presence). When a pycore client is ONLINE and the user designates it, the
  UI enters the **paired-group state** on `pycore.pair.{machineId}`; only a
  paired group forwards (both ends present).

In relay mode:

- R1. The browser NEVER needs a route to `:59000` on the pycore machine.
- R2. Laravel is the only intermediary: request in (UI -> Laravel), execution on
  the pycore machine, response back (Laravel -> UI).
- R3. **Both-ends-online gating**: Laravel only accepts/forwards a relay request
  when the selected pycore machine is connected (presence) AND the requesting UI
  session is connected (presence). If either end is offline the UI gets an
  immediate, explicit `peer-offline` style result - not a timeout.
- R4. **Client selection in the UI**: the pycore-manager target switcher lists
  the pycore machines currently online (from presence), plus manual direct-host
  entry for direct mode. The user picks which pycore client to use; the choice
  persists (existing storage-key pattern).
- R5. Every existing pycore-manager capability must work through the relay:
  JSON APIs, task dispatch, engine/worker state, terminal, code-sync, blobs
  (audio/images), and the existing pycore HTTP log/heartbeat surfaces. Binary
  payloads must not be base64-inflated beyond need and must respect a stated
  size cap.
- R6. The relay is transport-only: pycore route semantics, RPC contract, and the
  Queue Center contract (`config/queue_center_contract.json` `endpoints` block)
  stay the single sources. The relay path renders the same routes; it does not
  fork them.
- R7. Security floor (aligns with `DESIGN_20260814_QUEUE_CENTER_MACHINE_AUTHENTICATION.md`):
  - `REVERB_APP_SECRET` never ships to pycore, the browser bundle, or the
    extension.
  - Relay channels are private/presence with server-side authorization
    (`routes/channels.php`), not public like today's `queue-center` channel.
  - Machine enrollment/credential issuance may reuse the design already proposed
    in the machine-authentication document; this document does not weaken it.
- R8. Engagement is explicit and notified: selecting an `https://` backend
  enters the relay scheme by default with a visible notification (transport
  badge + pairing handshake result); `http://...:59000` selections stay
  direct. There is no silent reclassification by page origin.

## 1.4 HTTP/3 requirement

- H1. Every browser-reachable HTTP surface of the central server serves HTTP/3:
  the JSON API (Octane :9000 via nginx), the pycore UI itself (vite/dist via
  nginx), any new relay endpoints, AND the selected HTTPS pycore backend (the
  reverse-proxied relay entry) - all behind the existing nginx
  HTTP/3 + QUIC + early-data stanza (`common/nginx_manager.sh`).
- H2. WebSocket (Reverb) is the known exception: browser WebSocket-over-HTTP/3
  (RFC 9220) is not shipped by browsers; Reverb stays `wss://` over TCP, proxied
  through nginx on the same domains. Part 2 confirms with official sources.
- H3. Direct-mode pycore traffic stays plain `http://...:59000` on loopback or
  Tailscale CGNAT - HTTP/3 there is out of scope (no nginx in that path).

## 1.5 Octane capability question (from the task)

Evaluate whether Octane (as used by `132_laravel_main_start.sh`) provides the
b.txt capability. Answer shape expected (verified in Part 2):

- Octane(Swoole) is the HTTP application server on :9000 - it hosts no
  broadcast channels and no presence state.
- Reverb (already supervised next to Octane by
  `debian_com/laravel_run_runtime.sh`) is the WebSocket/presence component the
  feature needs. No new daemon is required; the supervised pair already exists.

## 1.6 Non-goals

- No replacement of the exchange-hub architecture
  (`FIX_20260802_UI_EXCHANGE_HUB_ARCHITECTURE.md`): UI stays the task pump; the
  relay only changes the UI -> pycore transport leg when remote.
- No generic TURN/tunnel: the relay carries the pycore HTTP route contract only.
- No changes to pycore result-upload egress (`pycore/pyutils/laravel/client.py`).
- No test creation/modification (project rule).

## 1.7 Acceptance criteria

- A1. The user selects the HTTPS backend; the UI notifies, enters the relay
  scheme, and pycore-manager is fully usable from any browser origin while the
  pycore machine sits behind NAT with only outbound connectivity to Laravel.
- A2. Killing pycore (or its connection) makes the UI surface `peer-offline`
  within the presence/heartbeat window; relay requests are refused immediately.
- A3. Restarting pycore restores the pair within one reconnect cycle, and the UI
  picker shows the machine online again.
- A4. Two different pycore machines online: the UI can switch between them and
  traffic never crosses between machines (pair isolation).
- A5. `http://...:59000` selections (loopback / Tailscale 100.x / public-IP
  presets) keep working unchanged (direct mode) with no relay hop.
- A7. Even without an HTTPS backend selected, the always-on Laravel link shows
  the online pycore roster; designating a machine enters the paired state
  (readiness without relay engagement).
- A6. `curl --http3` (or browser devtools protocol column `h3`) on the API
  domain, the UI domain, and the HTTPS pycore backend; Reverb `wss` connects
  on the same host.

## 1.8 Capability-provider rule (other groups)

The group system is an architecture, not a single feature:

- Every group end declares the capabilities it can PROVIDE through the central
  server (roster entries, channel capabilities, route capabilities).
- G3 (laravel-manager) and G4 (wordnew), plus future machine classes
  (mcp-chrome workers), are declared as capability providers in code (shared
  contract entries + per-end registries), but their provider integration is
  NOT implemented in this pass. Only the G2 pycore pair is fully implemented.
- No end hardcodes "who else exists": declarations live in the shared
  contract; ends render what the contract and the roster give them.

## 1.9 Development norms (binding for this feature)

- Build from the underlying architecture, not patches; no thin-compatibility
  layers; follow the latest specifications (Laravel 13, nginx mainline, current
  project contracts).
- Merge common libraries and duplicate implementations; consult the official
  documentation before introducing anything new.
- Do not use multiple agents.
- Develop strictly per this specification.
- Shell scripts: never use exit codes / return-value chaining; trust the
  previous function's execution result; detect binaries directly by probing
  the file system (no stale command-hash probing).

---

# Part 2 - Research findings (appended after Part 1)

## 2.1 Project code findings (measured, no code changed)

### laravel_main (central server)

- Runtime pair (measured in `debian_com/laravel_run_runtime.sh`, invoked by
  `132_laravel_main_start.sh`): **Reverb on `0.0.0.0:8080` + Octane/Swoole on
  `0.0.0.0:9000`** (port from `config/service_contract.json`
  `ports.laravel_api_backend = 9000`) started as one supervised pair; USR1
  reloads both. `composer.json`: `laravel/octane ^2.13`, `laravel/reverb ^1.6`,
  Laravel framework `^13.0` (lock: v13.25.0).
- `config/reverb.php`: app credentials resolved from the external
  RuntimeConfigurationStore (REVERB_APP_ID/KEY/SECRET provisioned by the start
  script); `allowed_origins` defaults to `['*']`; **`max_message_size` is
  10,000 bytes**; `ping_interval` 60, `activity_timeout` 30.
- `routes/channels.php` today: two PRIVATE channels
  (`App.Models.User.glm-5.3_common`, `wordnew-social.{userId}`). **No presence
  channel, no machine channel exists yet.** The Queue Center channel
  (`queue-center`, from `config/queue_center_contract.json`) is PUBLIC - pycore
  and mcp-chrome subscribe with `auth: ""`.
- `routes/api.php`: worker plane (`/api/worker/register|heartbeat|...`, hostname-
  stable `worker_id`) and queue-center plane are public route groups mirroring
  the contract `endpoints` block (schema_version 20).
- `RealtimeConnectionService` hands out the PUBLIC app key + connection
  metadata; there is no `/broadcasting/auth` consumer for machines yet. The
  user-side private pattern (`wordnew-social.*`, `auth:sanctum`,
  `/api/broadcasting/auth`) already proves the private-channel path works.
- nginx (from `26_install_nginx.sh` + `common/nginx_manager.sh`): official
  mainline, `http_v3_module`, per-site stanza `listen 443 quic` + `http3 on` +
  `quic_retry on` + `quic_host_key` (fixed) + `Alt-Svc: h3=":443"` +
  `ssl_early_data on` (+ source-build option for QUIC 0-RTT via QuicTLS /
  BoringSSL); edge-port guard frees 80/TCP + 443/TCP + **443/UDP**; api sites
  proxy to `http://127.0.0.1:9000`. HTTP/3 is VERIFIED WORKING on this server
  (`FIX_20260817_NEXUS_DASH_HTTP3_DOMAIN_BINDING.md` measured `HTTP/3.0`
  200s in access logs). Reverb :8080 is currently reached directly, NOT via
  nginx wss proxy.

### pycore (G1 machine end)

- `pyctl/queue_center/snapshot_service.py` already contains a complete,
  dependency-isolated **outbound Reverb WebSocket client**: pusher-protocol
  handshake, `pusher:subscribe` with `auth: ""` (public channel only),
  ping/pong keepalive, exponential reconnect backoff, endpoint re-derivation.
  This is the code base the relay subscription extends; it has NO
  private/presence auth handshake yet.
- HTTP egress to Laravel is centralized (worker plane; result upload via
  `pyutils/laravel/client.py` single egress rule).
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
- `core/integrations/laravel/LaravelReverbConnection.ts` is a dependency-free
  pusher-protocol WebSocket client that ALREADY accepts an `authorize`
  callback (socket_id + channel -> {auth, channel_data}) - i.e. the UI side of
  private/presence subscription is structurally ready.
- `LaravelEndpointManager` persists/switches Laravel base URLs - the relay
  transport reuses the active Laravel endpoint as its base.

## 2.2 Official documentation findings

### Laravel 13 Octane (laravel.com/docs/13.x/octane)

- Octane is an HTTP application server (FrankenPHP / RoadRunner / Swoole):
  boots the app once, serves requests via workers/task-workers. **It hosts no
  broadcast channels, no presence state, no WebSocket routing.** The official
  production topology is exactly this project's: nginx in front, proxying to
  Octane with `proxy_http_version 1.1` + `Upgrade`/`Connection` headers.
- Swoole WebSockets inside Octane exist only as an unfinished community PR
  (laravel/octane#977, WIP) - not Laravel-official, not adopted.
- (Aside: only the FrankenPHP server can serve HTTP/3 itself (`--https`, Sail
  maps `443/udp`); with Swoole - this project - HTTP/3 is nginx's job.)

### Laravel 13 Broadcasting (laravel.com/docs/13.x/broadcasting)

- Presence channels: `Broadcast::channel('chat.{roomId}', fn ($user, $roomId)
  => ['id' => ..., 'name' => ...])` - a callback returning an ARRAY turns the
  channel into a presence channel with member data. Echo `join()` +
  `here`/`joining`/`leaving` give the online roster.
- Authorization happens via the auto-registered `/broadcasting/auth` HTTP
  route + `routes/channels.php`; custom `guards` per channel are supported;
  channel classes (`php artisan make:channel`) exist for organization.
- Anonymous events: `Broadcast::presence('channels.{id}')->send()` and
  `->sendNow()` (immediate, bypassing the queue) - relevant for relay control
  frames where queue latency must not apply.

### Laravel Reverb (laravel.com/docs/13.x/reverb)

- `reverb:start --host --port` (`REVERB_SERVER_HOST/PORT`) vs client-facing
  `REVERB_HOST/PORT` - the documented production pattern is: public
  `wss://host:443` terminated by nginx, forwarded to Reverb on `:8080`
  internally. This matches requirement H2 exactly.
- `allowed_origins` restricts browser origins; app credentials are the
  connection trust root; scaling horizontally requires Redis pub/sub between
  Reverb instances.

### nginx QUIC / HTTP/3 (nginx.org/en/docs/quic.html, ngx_http_v3_module)

- HTTP/3 since 1.25.0, in official Linux binary packages
  (`--with-http_v3_module`); `listen ... quic [+ reuseport]`, `quic_retry on`,
  `ssl_early_data on` (0-RTT), `quic_gso`, `quic_host_key`; QUIC requires
  TLS 1.3; OpenSSL >= 3.5.1 recommended for early data (else compatibility
  layer without it) - exactly what `nginx_manager.sh` already implements and
  what `nginx_quic_early_data_supported()` probes.
- Troubleshooting per nginx: verify a client actually speaks QUIC with a
  console client (ngtcp2) first; browsers are picky. (Project equivalent:
  `curl --http3`, plus the already-measured `HTTP/3.0` access-log entries.)

### WebSocket over HTTP/3 (RFC 9220) - the H2 exception

- RFC 9220 (WebSocket over HTTP/3) is a final standard, BUT browser support
  has NOT shipped: the Chromium feature (chromestatus 5080537855688704) has
  been sitting unshipped since 2022; Mozilla tracking bug is still open.
  Therefore: **`wss://` remains a TCP (HTTP/1.1 upgrade) connection proxied by
  nginx; it cannot ride the QUIC listener.** The design keeps Reverb on
  `wss://<same-domain>` via nginx; browsers coexist fine (h3 for HTTP,
  TCP wss for the socket).

### Tailscale CGNAT range

- `100.64.0.0/10` (RFC 6598 shared address space) - the "100.xx" prefix.
  Under the UPDATED engagement rule (1.3) these stay direct because their
  preset endpoints are `http://...:59000` (non-https selection); the range
  itself is no longer the classifier - the selected backend URL scheme is.

## 2.3 Answer to the Octane capability question (1.5)

**Octane does not provide the b.txt capability and does not need to.**

- The capability (paired groups, both-ends-online gating, cross-end
  forwarding) is the job of the broadcast layer: **Reverb presence channels +
  `/broadcasting/auth` + `routes/channels.php`** - all of which Laravel 13
  documents, and all of which this project already runs (Reverb 1.6 sits next
  to Octane in the supervised pair).
- Concretely: b.txt's "A sends, forwarded to B only if B online" maps to:
  `presence-pycore.pair.{machine}` channel; Laravel checks members (presence)
  and `Broadcast::presence(...)->sendNow()` the relay frame; the roster of
  online machines for UI selection maps to a machine presence channel's
  `here`/`joining`/`leaving`.
- No new daemon, no new Composer dependency, no Octane change. Octane keeps
  its role: HTTP API host for the relay data-plane endpoints.

---

# Part 3 - Implementation plan (appended after Part 2)

## 3.0 Design decision

**Relay = Reverb presence wake-up (control plane) + Laravel HTTP store-and-
fetch (data plane).** Rationale:

- pycore is already an outbound-only WebSocket client behind NAT; the UI is
  already a Laravel HTTP + Reverb WebSocket client. Zero new daemons, zero
  inbound holes on the pycore machine.
- Presence membership IS the both-ends-online gate (R3) - no separate
  heartbeat machinery.
- Reverb `max_message_size` is 10 KB; blobs (audio/images) and long payloads
  must NOT ride broadcast frames. Control frames stay tiny; bodies and
  responses transfer through Laravel HTTP endpoints keyed by `request_id`
  (same shape as the Queue Center wake + HTTP-pull pattern the four ends
  already implement).

## 3.1 Channel and group layout (all on the existing Reverb app)

| Channel | Type | Who joins | Purpose |
|---------|------|-----------|---------|
| `pycore.machines` | presence | every pycore machine | G1 roster: online-machine list for the UI picker (here/joining/leaving) |
| `pycore.pair.{machineId}` | presence | that pycore machine + UI sessions paired to it | G2 paired group: both-ends-online gate + relay wake events |
| `queue-center` (existing) | public (unchanged) | pycore, mcp-chrome, UI | queue revision events - NOT used by the relay |

`machineId` = existing hostname-stable worker identity (worker_id family) -
no new identity scheme.

### Capability-provider registry (1.8)

The same contract declares each end's PROVIDABLE capabilities. In code:

- Laravel: `RelayCapabilityRegistry` (contract-driven) - resolves which
  group/class may provide which roster entries, channels, route families.
- pycore: capability flags published with its `pycore.machines` presence
  member data (machine class + provided route families).
- UI: `core/contracts/RelayCapabilities.ts` - renders declared providers;
  laravel-manager (G3) and wordnew (G4) are DECLARED here but not wired to
  any provider integration this pass; mcp-chrome is declared as a future
  machine class. Only the pycore pair (G2) implements end-to-end.

## 3.2 Relay protocol (v1)

1. UI -> Laravel: `POST /api/relay/{machineId}/requests`
   `{ method, path, headers?, body_ref? }` where large bodies were first
   `POST /api/relay/{machineId}/blobs` (chunked) -> `body_ref`. Laravel:
   - verifies pair presence (machine member AND >=1 UI member) else **HTTP
     409 `peer-offline` immediately** (R3, A2);
   - stores the request (QueueCenterCacheStore-family store, short TTL);
   - `Broadcast::presence("pycore.pair.{machineId}")->sendNow()` a small
     `relay.request` frame `{request_id, method, path, size}`.
2. pycore relay consumer (in its WS thread) wakes on `relay.request`, fetches
   `GET /api/relay/{machineId}/requests/{request_id}` (body included when
   small; blob refs fetched via `GET .../blobs/{ref}`), executes it against
   `127.0.0.1:59000` through the existing local HTTP stack (route contract
   untouched - R6), then `POST /api/relay/{machineId}/responses`
   `{request_id, status, headers, body | body_ref}`.
3. UI receives the response either on the pair channel (`relay.response`
   `{request_id, status, size}` wake frame) or by its in-flight HTTP poll
   `GET /api/relay/{machineId}/responses/{request_id}?wait=1` (long-poll,
   bounded ~25 s). v1 ships the long-poll (simpler, no UI callback routing);
   the wake frame stays as the latency optimization hook.
4. Timeouts: request TTL 60 s; no store-and-forward across offline peers (the
   pair REFUSES when offline - b.txt's offline-message branch is deliberately
   NOT taken for interactive RPC; offline work already belongs to Queue
   Center tasks).
5. Size caps (contract-declared): control frame <= 8 KB (fits Reverb 10 KB),
   inline JSON body <= 256 KB, blob chunks <= 4 MB, per-request total <= 32 MB
   (terminal/code-sync/audio bounded accordingly).

## 3.3 Transport engagement (R8, A1, A5, A7)

`pycoreTarget.ts` is REBUILT (not patched) to carry full backend URLs
(scheme + host + optional port), replacing the mode-by-origin model:

- Selected backend starts with `https://` (no :59000 port; the entry is the
  server-side reverse proxy of the relay) -> **relay scheme**: notify (badge +
  pairing handshake result), bind the relay transport to that endpoint, then
  pair per 3.4.
- Selected backend is `http://<host>:59000` -> direct, byte-for-byte today's
  behavior (origin/local/remote presets render to this form).
- The always-on Laravel link (HTTP API + presence) runs in BOTH modes; the
  roster view and machine designation are available even while direct.
- Pair entry: user designates an online machine from the roster ->
  subscribe `pycore.pair.{machineId}` (presence, authorized) -> paired-state
  badge; forwarding is gated by both-end presence (R3).

## 3.4 Machine designation in the UI (R4, A3, A4, A7)

`PcPycoreTargetSwitcher` gains a relay section fed by the always-on roster:
online machines from `pycore.machines` presence (via
LaravelReverbConnection authorize + join), showing machine label +
since/latency; **designation** of a machine enters the paired state and
persists (`PycoreStorageKeys`, existing pattern); switching re-binds the
transport to `pycore.pair.{machineId}`. Two machines online -> two entries;
traffic never leaves the selected pair channel (isolation, A4). While
unpaired/https-selected, the switcher shows why forwarding is unavailable
(no online machine / not designated).

## 3.5 Security (R7)

- pycore joins private/presence channels through the standard
  `/broadcasting/auth` handshake (the WS client gains the auth step it
  currently lacks - subscribe with computed `auth` instead of `""`),
  authenticated by its machine enrollment credential per
  `DESIGN_20260814_QUEUE_CENTER_MACHINE_AUTHENTICATION.md` (first phase may
  gate on the existing InstallationAccessCode while enrollment lands).
- UI sessions authorize against the same channels with user/session identity
  (Sanctum / loopback-debug pattern already in `wordnew-social.*`). The
  machine secret never reaches the browser (unchanged rule).
- `routes/channels.php`: `pycore.machines` join returns machine roster data;
  `pycore.pair.{machineId}` join allows (a) the machine itself and (b) UI
  sessions permitted for that machine.
- `config/reverb.php`: `allowed_origins` tightened from `*` to the served
  domains (contract-driven, like `UI_ALLOWED_HOSTS`).

## 3.6 HTTP/3 work (H1, H2, A6)

- All new `/api/relay/*` routes ride the existing api.<region>.<domain>
  sites -> already HTTP/3 (no nginx change needed for the API surface).
- The **selected HTTPS pycore backend** (1.3) IS one of those sites (the
  reverse-proxied relay entry): same domain family, same HTTP/3 + QUIC +
  early-data stanza, no port in the URL. The UI preset for it is added to the
  contract-rendered preset list, not hardcoded in the bundle.
- Add an nginx `location` for Reverb wss on the SAME api domain
  (`location /app/{reverb-key}` -> `proxy_pass http://127.0.0.1:8080` with
  `proxy_http_version 1.1` + `Upgrade`/`Connection` + long `proxy_read_timeout`),
  rendered by `nginx_manager.sh`/domain templates (shell end) and
  ServerManagerV1 config builder (Laravel end) under the existing SYNC
  CONTRACT - both ends changed together, one template, content-hash idempotent.
  UDP/443 stays guarded by `nm_edge_ports_ensure`.
- Browser reality check (2.2): WebSocket stays wss-over-TCP (RFC 9220 unshipped)
  - the UI connects `wss://api.<region>.<domain>/app/{key}` on the same host
  that serves h3; mixed h3 + wss is standard practice.
- `RealtimeConnectionService` starts returning the proxied public
  `host:443/scheme:wss` form (REVERB_HOST/PORT semantics from the Reverb
  docs) instead of the raw `:8080` - pycore and the UI both consume it.

## 3.7 File-touch list (planned; NOTHING changed in this pass)

Laravel (`poly_apps/laravel_main`) - BACKEND FIRST, complete before any
client work:
- `config/queue_center_contract.json` (or sibling `relay_contract.json`):
  channels + relay endpoints + caps + **capability-provider declarations**
  (schema_version bump; four-end rule).
- `routes/api.php`: `/api/relay/*` group; `routes/channels.php`: the two
  presence channels.
- `app/Services/Relay/` (new): RelayRequestStore, RelayDispatcher
  (presence check + `sendNow`), RelayBlobStore, **RelayCapabilityRegistry**
  (contract-driven, 1.8).
- `app/Http/Controllers/RelayController.php` (new).
- `app/Services/Realtime/RealtimeConnectionService.php`: proxied wss form.
- `config/reverb.php`: allowed_origins.
- ServerManagerV1 nginx config builder: wss location template.
- Shell end (same phase, SYNC CONTRACT): `common/nginx_manager.sh` + domain
  templates; shell norms 1.9 apply (no exit-code chaining, trust previous
  results, binary detection by file probe).

pycore (`pycore/`) - LIBRARY EXTENSION, after the backend is complete
(norm 1.9: merge, do not duplicate):
- EXTRACT the WS consumer from `pyctl/queue_center/snapshot_service.py`
  into ONE shared Reverb client library (e.g. `pyutils/common/reverb_client.py`):
  connection lifecycle, pusher handshake, **private/presence auth handshake**
  (`/broadcasting/auth`), ping/pong, reconnect/backoff - single definition,
  consumed by BOTH queue events and the relay (removes the would-be second
  implementation before it exists).
- New `pyctl/relay/` (thin consumer of that library): subscriptions
  (`pycore.machines` + `pycore.pair.{self}` with capability member data),
  `relay.request` consumer, response poster; executor reuses the local
  `:59000` HTTP client.
- `pyutils/common/queue_center_contract.py`: relay endpoint renderer reuse.

UI (`poly_apps/pycore_laravel_wordnew_ui`) - LAST, after backend + pycore
library are complete:
- `core/integrations/pycore/pycoreTarget.ts`: REBUILT to full backend URLs
  (https selection -> relay scheme + notification; http -> direct) per 3.3.
- `core/integrations/pycore/` new `PycoreRelayTransport.ts` implementing the
  same surface as `PycoreApiTransport` (domain layers untouched).
- `core/integrations/laravel/LaravelAPI.ts`: relay route methods.
- `core/integrations/laravel/LaravelRealtime.ts` / `LaravelReverbConnection.ts`:
  always-on presence join + roster exposure (authorize hook already exists).
- `core/contracts/RelayCapabilities.ts` (new): declared capability providers
  (G3/G4/mcp-chrome) - rendered, NOT wired this pass (1.8).
- `apps/pycore-manager/components/PcPycoreTargetSwitcher.tsx`: https backend
  entry + preset, machine designation from roster, transport/pair badges,
  peer-offline surfacing.

Shell (scripts):
- `scripts/shells/linux/common/nginx_manager.sh` + domain templates: wss
  location (SYNC CONTRACT both ends).
- No change needed in `132_laravel_main_start.sh` / `26_install_nginx.sh`
  flows - the wss stanza is another idempotent render/migrate step.

## 3.8 Execution order (binding: backend -> pycore library -> UI; each phase
independently shippable; norms 1.9 govern every phase)

1. **Backend complete FIRST (Laravel + shell end)**: contract JSON (channels,
   endpoints, caps, capability-provider declarations), routes, store,
   dispatcher + capability registry, controller, channels.php, reverb
   origins, RealtimeConnectionService wss form, nginx wss template BOTH ends
   under the SYNC CONTRACT. Verify: tinker-level presence publish; curl relay
   request against a fake machine -> 409 peer-offline; `nginx -t` + reload;
   h3 on the relay entry.
2. **pycore library extension SECOND**: extract the ONE shared Reverb client
   library (merge with the snapshot consumer - no duplicate implementation),
   add the private/presence auth handshake, then the thin `pyctl/relay/`
   consumer (subscriptions, executor, poster). Verify: manual pair with curl
   as the "UI"; full pycore route smoke via relay; kill pycore -> 409 within
   the presence window; queue-events consumer still works (merge regression
   check).
3. **UI LAST**: target rebuild (https -> relay + notify, http -> direct),
   always-on Laravel link + roster, designation -> paired state, relay
   transport, switcher, capability-provider declarations (rendered only).
   Verify: A1-A7 walkthrough.
4. **HTTP/3 + wss audit**: h3 on API + UI + the HTTPS pycore backend
   (`curl --http3` / devtools), wss handshake on the api domain, A6.
5. **Hardening**: caps enforcement, TTL sweeps, origin tightening, latency
   budget re-check (single Reverb process; Redis horizontal only if needed).

## 3.9 Risks / mitigations

- Reverb single-process CPU under many pairs -> current scale is one digit
  machines; Redis horizontal scaling documented by Reverb if ever needed.
- Relay latency = 2x Laravel RTT + pycore exec; wake frames keep added
  latency ~ presence-forward time; long-poll fallback bounds it.
- Mixed-content in direct mode: an https PAGE selecting an `http://...:59000`
  direct backend is browser-blocked - surfaced by the switcher as a direct-
  mode limitation (workaround: the https backend / relay), not silently
  retried.
- 10 KB Reverb frame ceiling -> control-plane-only frames by design.
- Presence flap storms (laptop sleep) -> presence `activity_timeout` 30 s
  already configured; UI badge derives from roster, no extra polling.

## 3.10 Verification checklist (manual; no tests created - project rule)

- [ ] A1 select https backend -> notified relay engagement, full
      pycore-manager via relay from any origin
- [ ] A2 pycore down -> immediate `peer-offline` (409), no hanging requests
- [ ] A3 pycore restart -> pair restored within one reconnect cycle
- [ ] A4 two machines online, designation switch isolates traffic
- [ ] A5 `http://...:59000` selections unchanged (direct, no relay hop)
- [ ] A6 `h3` on API + UI + HTTPS pycore backend; `wss://` Reverb handshake
      on same domain
- [ ] A7 always-on roster without https selection; designation -> paired
      state
- [ ] blobs (audio preview, code-sync zip) through relay within caps
- [ ] terminal stream (long-running) via relay long-poll within TTL

---

End of document.
