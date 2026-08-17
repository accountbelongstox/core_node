# DESIGN 20260817 2115 - Pycore UI Relay Groups via Laravel Central Server + HTTP/3 Everywhere - PART 3 (Implementation plan)

Date: 2026-08-17 21:15
Document split 2026-08-17 into four parts (see PART_0 for the index).
Appended after PART_2 per working order. Fully restated under the **Mercure
pivot**: Mercure topics are THE wake/control transport; Reverb is fully
removed (2026-08-17, no Phase 5 - the removal shipped with the same change
set). Execution order is BINDING: Phase 0 (PART_0) -> backend -> pycore
library -> UI -> audit; norms PART_1 1.9 govern every phase.

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

## 3.0 Design decision

**Relay = Mercure wake/control plane (server-published SSE topics) + Laravel
HTTP store-and-fetch data plane.** Rationale:

- pycore is an outbound-only client behind NAT: the Mercure downstream is SSE
  - plain outbound HTTPS - so it fits the same single-egress posture as the
  existing result upload. The UI is already a Laravel HTTP client; browsers
  consume SSE natively (`EventSource`).
- Only the server publishes (browsers never publish): `mercure_publish()` is
  in-process - zero extra daemons, zero network hops for wake frames. The
  single `octane:frankenphp` process hosts API + hub + UI + relay entry on
  one h3 listener (PART_0).
- **The hub has no application presence** (PART_2 2.2.3): the
  both-ends-online gate (R3) is the heartbeat registry pair
  (RelayMachineRegistry + RelayPairRegistry) - server-side truth, immediate
  `peer-offline` refusal, independent of connection flaps.
- Wake updates stay tiny (8 KB cap); bodies and blobs transfer through
  Laravel HTTP endpoints keyed by `request_id` (same shape as the Queue
  Center wake + HTTP-pull pattern the four ends already implement).

## 3.1 Topic layout and registries

| Topic | Update visibility | Subscribers | Purpose |
|-------|-------------------|-------------|---------|
| `pycore.machines` | public update (`private=0`), subscribe requires JWT | UI sessions (machines optionally) | roster announcements - `roster.update` deltas on registry transitions |
| `pycore.pair.{machineId}` | **private** update | that pycore machine + UI sessions paired to it | G2 paired group: wake events `relay.request` / `relay.response` |
| `queue-center` (migration target) | public update | pycore, mcp-chrome, UI | queue revision events - Phase 2 migrates the WS consumer here |

- `machineId` = existing hostname-stable worker identity (worker_id family) -
  no new identity scheme.
- Reserved update `type` values (SSE event field): `relay.request`,
  `relay.response`, `roster.update` (the spec forbids the reserved `mercure`
  type; these are ours).
- Registries (Laravel, database cache store family):
  - `RelayMachineRegistry` (WRITTEN): register / heartbeat (20 s) /
    unregister / isOnline / listOnline, offline after 45 s stale TTL,
    `relay:machines:index` roster key.
  - `RelayPairRegistry` (new): active pair per machineId (UI session id,
    TTL 60 s refreshed on activity); the R3 gate = machine heartbeat fresh
    AND pair active.
- Roster announcements: registry transitions (online/offline) publish
  `roster.update` `{machine_id, online, capabilities}` on `pycore.machines`;
  the UI re-syncs from `GET /api/relay/machines` (truth) on (re)connect.

### Capability-provider registry (PART_1 1.8)

The same contract declares each end's PROVIDABLE capabilities. In code:

- Laravel: `RelayCapabilityRegistry` (contract-driven) - resolves which
  group/class may provide which roster entries, topics, route families.
- pycore: capability flags published with its registry member record and in
  `roster.update` payloads (machine class + provided route families).
- UI: `core/contracts/RelayCapabilities.ts` - renders declared providers;
  laravel-manager (G3) and wordnew (G4) are DECLARED here but not wired to
  any provider integration this pass; mcp-chrome is declared as a future
  machine class. Only the pycore pair (G2) implements end-to-end.

## 3.2 Relay protocol (v1)

1. UI -> Laravel: `POST /api/relay/{machineId}/requests`
   `{ method, path, headers?, body_ref? }` where large bodies were first
   `POST /api/relay/{machineId}/blobs` (chunked) -> `body_ref`. Laravel:
   - verifies the gate (machine heartbeat fresh AND pair active) else
     **HTTP 409 `peer-offline` immediately** (R3, A2);
   - stores the request (QueueCenterCacheStore-family store, short TTL);
   - publishes the wake frame in-process:
     `mercure_publish('pycore.pair.{machineId}', json_encode([request_id,
     method, path, size]), private: true, type: 'relay.request')`
     (hub POST with the publisher JWT as fallback path).
2. pycore relay consumer wakes on the `relay.request` update, fetches
   `GET /api/relay/{machineId}/requests/{request_id}` (body included when
   small; blob refs fetched via `GET .../blobs/{ref}`), executes it against
   `127.0.0.1:59000` through the existing local HTTP stack (route contract
   untouched - R6), then `POST /api/relay/{machineId}/responses`
   `{request_id, status, headers, body | body_ref}`.
3. UI receives the response either on the pair topic (`relay.response`
   `{request_id, status, size}` private wake update) or by its in-flight
   HTTP poll `GET /api/relay/{machineId}/responses/{request_id}?wait=1`
   (long-poll, bounded ~25 s). v1 ships the long-poll (simpler, no UI
   callback routing); the wake update stays as the latency optimization hook.
4. Resilience: pycore keeps a bounded fallback poll (400 ms, contract
   `poll_interval_ms`) while a pair is active - covers SSE gaps/reconnects;
   the hub's Last-Event-ID replay covers missed frames on reconnect.
5. Timeouts: request TTL 60 s; pair TTL 60 s; no store-and-forward across
   offline peers (the pair REFUSES when offline - b.txt's offline-message
   branch is deliberately NOT taken for interactive RPC; offline work
   already belongs to Queue Center tasks).
6. Size caps (contract-declared): control update <= 8 KB, inline JSON body
   <= 256 KB, blob chunks <= 4 MB, per-request total <= 32 MB (terminal/
   code-sync/audio bounded accordingly).

## 3.3 Transport engagement (R8, A1, A5, A7)

`pycoreTarget.ts` is REBUILT (not patched) to carry full backend URLs
(scheme + host + optional port), replacing the mode-by-origin model:

- Selected backend starts with `https://` (no :59000 port; the entry is the
  server-side reverse proxy of the relay) -> **relay scheme**: notify (badge +
  pairing handshake result), bind the relay transport to that endpoint, then
  pair per 3.4.
- Selected backend is `http://<host>:59000` -> direct, byte-for-byte today's
  behavior (origin/local/remote presets render to this form).
- The always-on Laravel link (HTTP API + roster topic SSE) runs in BOTH
  modes; the roster view and machine designation are available even while
  direct.
- Pair entry: user designates an online machine from the roster -> register
  the pair + acquire pair-topic auth (`hub-auth`) -> paired-state badge;
  forwarding is gated by the registry pair (R3).

## 3.4 Machine designation in the UI (R4, A3, A4, A7)

`PcPycoreTargetSwitcher` gains a relay section fed by the always-on roster:
online machines from `GET /api/relay/machines` + `roster.update` deltas
(roster topic SSE), showing machine label + since/latency; **designation** of
a machine enters the paired state and persists (`PycoreStorageKeys`,
existing pattern); switching re-binds the transport to
`pycore.pair.{machineId}`. Two machines online -> two entries; traffic never
leaves the selected pair topic + registry pair (isolation, A4). While
unpaired/https-selected, the switcher shows why forwarding is unavailable
(no online machine / not designated).

## 3.5 Security (R7)

- **`/api/relay/hub-auth`** (renamed from channel-auth; same route family):
  `POST` with the caller's identity (UI session: Sanctum / loopback-debug
  pattern; machine: enrollment credential per
  `DESIGN_20260814_QUEUE_CENTER_MACHINE_AUTHENTICATION.md` - first phase may
  gate on the existing InstallationAccessCode while enrollment lands).
  Returns a **short-lived HS256 subscriber JWT** (TTL 600 s, contract
  `relay.hub.token_ttl`) with `{"mercure":{"subscribe":[<topics allowed for
  that identity>]}}` - roster topic for any authenticated end; pair topic
  only for the paired machine/session.
- **Browser delivery**: EventSource cannot set headers - the endpoint also
  sets `Set-Cookie: mercureAuthorization=<jwt>;
  Path=/.well-known/mercure; HttpOnly; Secure; SameSite=Strict;
  Max-Age=600` (spec-recommended cookie mechanism, PART_2 2.2.3; same-origin
  hub, so the cookie rides the SSE request). Tokens NEVER appear in URLs.
  The client refreshes via `hub-auth` before expiry (live streams continue
  past token expiry; only new connections authorize).
- **pycore delivery**: `Authorization: Bearer <jwt>` on its SSE HTTP client
  (machines are not browsers).
- **Publisher path**: `mercure_publish()` in-process (no JWT handling in
  PHP); the fallback hub POST uses the publisher JWT read from the secret
  store. The publisher JWT key NEVER leaves the server - supersedes the
  REVERB_APP_SECRET rule.
- **Hub mode**: `anonymous` disabled - every subscriber presents a JWT
  (PART_0 §0.5); private pair updates are enforced by the hub.
- **JWT signing**: `symfony/mercure` + `lcobucci/jwt` (official pairing per
  the FrankenPHP docs; decision PART_2 2.2.4 - no hand-rolled signer).
- Hub keys (`publisher_jwt`, `subscriber_jwt`) provisioned by 132 into the
  secret store and rendered by the runtime branch as process env
  (PART_0 §0.5/0.6) - same lifecycle the former REVERB_APP_* keys had.

## 3.6 HTTP/3 work (H1, H2, A6; plane-aware - PART_0)

- `/api/relay/*`, the hub SSE stream (`/.well-known/mercure`), the UI, and
  the **selected HTTPS pycore backend** all ride the SAME 443 listener with
  h3 (Caddy default; nginx stanza on the compat plane) - no API-surface
  change needed for H1.
- **No WebSocket, no `/app/*` rule on any plane**: SSE rides h3
  (PART_2 2.2.6 deletes the old wss exception). The relay is simply not
  served on the compat plane (R9).
- The UI preset for the HTTPS backend is added to the contract-rendered
  preset list, not hardcoded in the bundle.
- `RealtimeConnectionService` RE-SCOPED: returns
  `{ hub_url: https://api.<region>.<domain>/.well-known/mercure, topics,
  auth_mode: "jwt", token_ttl }` - pycore and the UI both consume it; no
  Reverb key distribution remains (the Reverb path is deleted).

## 3.7 File-touch list (planned) + written-artifact sync

### Already written pre-pivot (2026-08-17) - required SYNC renames (Phase 1 start)

- `config/queue_center_contract.json` (schema 25): relay `channels` key ->
  **`topics`** (`pycore.machines`, `pycore.pair.{machine_id}`); endpoint
  `/api/relay/channel-auth` -> **`/api/relay/hub-auth`**; add `hub` block
  (`token_ttl: 600`, `cookie: mercureAuthorization`, `anonymous: false`,
  control-frame cap); `events` entries become update `type` values.
- `config/service_contract.json`: the former `reverb_backend: 8080` is
  REMOVED; Phase 0 adds the `frankenphp_http/https/admin` ports.
- `app/Support/QueueCenterContract.php`: rename `relayChannel()` ->
  `relayTopic()`; add `relayHub()` accessors.
- `app/Services/Relay/RelayMachineRegistry.php`: unchanged (already
  presence-truth shaped).

### Laravel (`poly_apps/laravel_main`) - BACKEND FIRST

- `config/queue_center_contract.json`: sync renames above + `hub` block.
- `app/Services/Relay/` (new): **RelayPairRegistry**, RelayRequestStore,
  RelayBlobStore (disk-backed, chunked), **RelayDispatcher** (gate check +
  `mercure_publish`, hub-POST fallback), **RelayHubAuthService** (subscriber
  JWT + cookie), **RelayCapabilityRegistry** (contract-driven, 1.8).
- `app/Http/Controllers/RelayController.php` (new): the 12 endpoints incl.
  `hub-auth`.
- `routes/api.php`: `/api/relay/*` group (PycoreClientOnly header middleware
  for machine endpoints; session middleware for hub-auth).
- `app/Services/Realtime/RealtimeConnectionService.php`: hub form (3.6).
- `config/octane.php`: frankenphp server entry + `'mercure'` block (with
  132/W3).
- `composer.json`: `symfony/mercure` + `lcobucci/jwt`.
- `ServerManagerV1FrankenPhpManagerCtl` + Caddyfile builder (Part 0; carries
  the `mercure` block).
- REMOVED from the pre-pivot plan: `routes/channels.php` relay channels,
  `config/reverb.php` allowed_origins work - the relay uses no
  `/broadcasting/auth` channel (and `config/reverb.php` is deleted).

### pycore (`pycore/`) - LIBRARY EXTENSION (after backend complete; norm 1.9 merge)

- EXTRACT ONE shared realtime client -> `pyutils/common/mercure_client.py`:
  SSE HTTP consumer (GET hub URL + `topic` params, `Authorization: Bearer`),
  EventSource-like lifecycle, **Last-Event-ID resume**, reconnect/backoff,
  token refresh hook - single definition, consumed by BOTH queue events and
  the relay (the pusher WS handshake is retired; the lifecycle/backoff
  structure survives from snapshot_service).
- `pyctl/queue_center/snapshot_service.py`: migrated onto the shared client
  (queue events become a topic subscription on the frankenphp plane).
- New `pyctl/relay/` (thin consumer): registry loop (register/heartbeat/
  unregister), roster + pair topic subscriptions, `relay.request` consumer,
  response poster; executor reuses the local `:59000` HTTP client.
- `pyutils/common/queue_center_contract.py`: relay endpoint renderer reuse.

### UI (`poly_apps/pycore_laravel_wordnew_ui`) - LAST

- `core/integrations/pycore/pycoreTarget.ts`: REBUILT to full backend URLs
  (https selection -> relay scheme + notification; http -> direct) per 3.3.
- `core/integrations/pycore/` new `PycoreRelayTransport.ts` implementing the
  same surface as `PycoreApiTransport` (domain layers untouched).
- `core/integrations/laravel/LaravelAPI.ts`: relay route methods + `hub-auth`
  fetch/refresh.
- `core/integrations/laravel/` new `LaravelMercureConnection.ts`: native
  `EventSource` wrapper + roster topic subscription + token refresh
  (replaces the deleted LaravelReverbConnection).
- `core/contracts/RelayCapabilities.ts` (new): declared capability providers
  (G3/G4/mcp-chrome) - rendered, NOT wired this pass (1.8).
- `apps/pycore-manager/components/PcPycoreTargetSwitcher.tsx`: https backend
  entry + preset, machine designation from roster, transport/pair badges,
  peer-offline surfacing.

### Shell (scripts)

- Phase 0 (PART_0): `28_install_frankenphp.sh` + `common/frankenphp_manager.sh`
  + `132` plane branch + `selector_common.sh` MENU_CONFIG + 32-35 plane flows
  + service-contract ports - all under the shell norms (1.9).
- Phase 1: nothing nginx-side (relay is plane-gated; the Caddyfile builder is
  the only front-server change).

## 3.8 Execution order (binding; each phase independently shippable)

0. **Phase 0 - FrankenPHP server plane (PART_0)**: shared plane constants +
   `28` + `frankenphp_manager.sh` + dual-end FrankenPHP Server Manager +
   `132` plane branch + menu/toolchain (32-35) + service-contract ports.
   Verify: P0-A1..P0-A6.
1. **Backend complete FIRST (Laravel)**: sync renames (3.7) + `hub` block,
   registries, stores, dispatcher (`mercure_publish`), hub-auth service,
   controller + routes, RealtimeConnectionService hub form, octane mercure
   config, Caddyfile builder (SYNC CONTRACT both ends). Verify: tinker-level
   publish reaches an authorized SSE subscriber (curl); relay request vs a
   fake machine -> 409 peer-offline; Caddy validate + reload; h3 on the hub.
2. **pycore library extension SECOND**: extract the ONE shared
   `mercure_client.py` (merge the snapshot consumer - no duplicate
   implementation), then the thin `pyctl/relay/` consumer. Verify: manual
   pair with curl as the "UI"; full pycore route smoke via relay; kill
   pycore -> 409 within the heartbeat window; queue-events consumer still
   works on the new client (merge regression check).
3. **UI LAST**: target rebuild (https -> relay + notify, http -> direct),
   always-on Laravel link + roster, designation -> paired state, relay
   transport, switcher, capability-provider declarations (rendered only).
   Verify: A1-A7 walkthrough.
4. **HTTP/3 + SSE audit**: h3 on API + UI + hub + the HTTPS pycore backend
   (`curl --http3` / devtools), roster `EventSource` over h3, publish ->
   receive latency sanity, A6.
5. **Reverb removal** (SHIPPED 2026-08-17 with the backend phase, ahead of the
   original Phase 5 slot): supervision dropped from the compat branch;
   `reverb_backend` deleted from the service contract; `queue-center`
   broadcast channel + legacy `channels.php` entries dropped;
   `wordnew.social.{userId}` migrated to a Mercure topic (private);
   `LaravelReverbConnection` scheduled for deletion in the UI phase.

## 3.9 Risks / mitigations

- Registry TTL vs SSE connection flaps -> roster truth is the registry
  (never the stream); SSE is push-only; 400 ms bounded poll covers gaps.
- Token expiry mid-stream -> live streams continue; only new connections
  authorize; `hub-auth` refresh before expiry; `Max-Age` aligned with TTL.
- SSE buffering by intermediaries -> Caddy streams natively; same-origin hub;
  EventSource auto-retry; the poll fallback bounds worst-case latency.
- Hub restart -> EventSource auto-reconnect + Last-Event-ID replay + poll
  fallback; request TTLs survive the restart window.
- Browser connection limits -> h2/h3 multiplexes all streams (incl. SSE) on
  one connection; the old HTTP/1.1 6-per-host concern does not apply.
- Cookie-auth CSRF on the hub -> `SameSite=Strict` + same-origin UI + short
  TTL + spec's Origin/Referer check noted; no tokens in URLs, ever.
- Single-process CPU under many pairs -> one-digit machines (current scale);
  the Go hub side is efficient; no Redis scale-out needed.
- mcp-chrome as a future consumer gates the Phase 5 close of the window ->
  it is a DECLARED provider (1.8); its migration is tracked separately.

## 3.10 Verification checklist (manual; no tests created - project rule)

- [ ] A1 select https backend -> notified relay engagement, full
      pycore-manager via relay from any origin
- [ ] A2 pycore down -> immediate `peer-offline` (409), no hanging requests
- [ ] A3 pycore restart -> pair restored within one reconnect cycle
- [ ] A4 two machines online, designation switch isolates traffic
- [ ] A5 `http://...:59000` selections unchanged (direct, no relay hop)
- [ ] A6 `h3` on API + UI + hub SSE + HTTPS pycore backend; roster
      `EventSource` receives a server-published update on the same domain
- [ ] A7 always-on roster without https selection; designation -> paired
      state
- [ ] `hub-auth`: browser cookie path works (EventSource same-origin);
      pycore Bearer path works; refresh before expiry is seamless
- [ ] blobs (audio preview, code-sync zip) through relay within caps
- [ ] terminal stream (long-running) via relay long-poll within TTL
- [ ] queue events consumed via the shared Mercure client after Phase 2
- [ ] no realtime sidecar process on any plane (P0-A4)

---

End of PART_3. Prerequisite: PART_0. Requirements: PART_1. Research: PART_2.
