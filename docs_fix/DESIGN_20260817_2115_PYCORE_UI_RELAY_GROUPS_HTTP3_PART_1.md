# DESIGN 20260817 2115 - Pycore UI Relay Groups via Laravel Central Server + HTTP/3 Everywhere - PART 1 (Requirements)

Date: 2026-08-17 21:15
Document split 2026-08-17 into four parts (see PART_0 for the index).
This part is BINDING. It carries the 2026-08-17 spec changes:
- Transport engagement = **selection of an HTTPS pycore backend** (no
  `:59000`; server-side reverse proxy), notified on selection; non-https
  selections keep the direct connection (1.3).
- The UI communicates with Laravel **at all times**; online pycore roster +
  designation of a machine -> paired-group state (1.3).
- **Mercure pivot (binding)**: the FrankenPHP built-in Mercure hub is THE
  realtime transport (SSE downstream + HTTP POST upstream, server-side
  publish). Reverb is fully removed (no migration window; the same change
  set deleted package, config, processes, proxies, contract ports, keys).
- Other groups become **capability providers**: declared in code, not
  implemented in this pass (1.8).
- Implementation order fixed: Phase 0 (PART_0) -> backend -> pycore library
  -> UI (PART_3 §3.8). The **basic norms below are BINDING for all four
  parts** and restated verbatim at the head of every part file (full text:
  1.9): build from the underlying architecture (no patches, no thin-compat
  layers, latest specifications); merge common libraries and duplicate
  implementations; consult official docs; no multiple agents; develop
  strictly per spec; shells never use exit-code/return-value chaining,
  trust the previous function's result, detect binaries by file probing.

Reference input: `docs_fix/origin/b.txt` (FrankenPHP/Mercure revision).

---

## 1.1 Question from b.txt mapped onto this project

b.txt asks: can Laravel forward messages between client groups (A, A1 <-> B, B1),
forwarding only when the other side is online? The project equivalent is:

> Can `laravel_main` relay pycore-UI traffic to a pycore machine when the browser
> cannot reach that machine directly, gating on BOTH ends being online?

The capability owners in this stack are the **FrankenPHP built-in Mercure
hub** (transport: SSE downstream, server-side publish) plus the **heartbeat
registry** (both-ends-online truth) - NOT Octane alone and no longer Reverb.
Part 2 verifies this against the official docs.

## 1.2 Group topology (binding)

Five participants, one central server, four groups:

| Group | Members | Topic pairing semantics |
|-------|---------|-------------------------|
| G1 | pycore (the Python runtime, standalone) | Machine side of every UI<->pycore pair |
| G2 | pycore UI `pycore-manager` | UI side of the pycore pair |
| G3 | pycore UI `laravel-manager` | Talks to the central server only (no pycore relay need) |
| G4 | pycore UI `wordnew` | Talks to the central server only (no pycore relay need) |
| C  | `laravel_main` (central server) | Broker + roster authority for all groups |

Rules:

1. **G2 is a paired group (UI end + pycore end).** A paired group forwards only
   when BOTH ends are online (b.txt semantics). The pycore end is one selected
   pycore client machine; the UI end is the browser session.
2. **G3/G4 always talk to C directly** - they already do (LaravelAPI). The relay
   requirement does not change their data plane.
3. **G1 (pycore) alone** stays a group member of C: it registers, heartbeats,
   and keeps its existing outbound realtime subscription (queue events -
   migrated to the Mercure client, PART_3 §3.8 Phase 2). Nothing in the current
   pycore -> Laravel plane (result upload, queue events) is removed.
4. One UI browser session can host G2 + G3 + G4 simultaneously (the shell hosts
   all three apps today); only G2 needs the relay.

## 1.3 Core requirement: relay entry by selecting an HTTPS backend

The engagement signal is the **selected pycore backend endpoint**, not the
page origin.

- The user selects a pycore backend whose URL starts with `https://` and
  carries NO `:59000` port (the pycore service is reverse-proxied on the
  central server: TLS terminates at Caddy :443 and the relay carries the
  traffic to the pycore machine). On that selection the UI **notifies** the
  user (visible transport switch + pairing handshake result) and **defaults
  to entering the relay scheme**.
- Every non-https selection - today's presets (`http://127.0.0.1:59000`,
  `http://<public-ip>:59000`, `http://100.x.x.x:59000`) and manual `http`
  entries - keeps the CURRENT direct connection, unchanged.

Always-on Laravel link (new baseline, both modes):

- The UI communicates with Laravel at ALL times (HTTP API + roster topic
  SSE), regardless of the selected pycore transport.
- While linked, the UI watches the pycore group roster (`pycore.machines`
  announcements + the roster HTTP endpoint). When a pycore client is ONLINE
  and the user designates it, the UI enters the **paired-group state** on
  `pycore.pair.{machineId}`; only a paired group forwards (both ends
  registered).

In relay mode:

- R1. The browser NEVER needs a route to `:59000` on the pycore machine.
- R2. Laravel is the only intermediary: request in (UI -> Laravel), execution on
  the pycore machine, response back (Laravel -> UI).
- R3. **Both-ends-online gating**: Laravel only accepts/forwards a relay request
  when the selected pycore machine's registry heartbeat is fresh AND the pair
  is active (machine registered + pair registered). If either end is offline
  the UI gets an immediate, explicit `peer-offline` style result - not a
  timeout.
- R4. **Client selection in the UI**: the pycore-manager target switcher lists
  the pycore machines currently online (from the roster), plus manual
  direct-host entry for direct mode. The user picks which pycore client to
  use; the choice persists (existing storage-key pattern).
- R5. Every existing pycore-manager capability must work through the relay:
  JSON APIs, task dispatch, engine/worker state, terminal, code-sync, blobs
  (audio/images), and the existing pycore HTTP log/heartbeat surfaces. Binary
  payloads must not be base64-inflated beyond need and must respect a stated
  size cap.
- R6. The relay is transport-only: pycore route semantics, RPC contract, and
  the Queue Center contract (`config/queue_center_contract.json` `endpoints`
  block) stay the single sources. The relay path renders the same routes; it
  does not fork them.
- R7. Security floor (aligns with `DESIGN_20260814_QUEUE_CENTER_MACHINE_AUTHENTICATION.md`):
  - The Mercure **publisher JWT key never leaves the server** (used only by
    the server-side publish path); it never ships to pycore, the browser
    bundle, or the extension. (Supersedes the earlier REVERB_APP_SECRET rule;
    same class of rule, new secret.)
  - Subscribers authenticate with **short-lived, topic-scoped subscriber
    JWTs** issued by the server (`/api/relay/hub-auth`, PART_3 §3.5). Browsers
    receive them via HttpOnly cookie on the hub path (EventSource cannot set
    headers); tokens are never placed in URLs (spec security rule).
  - Pair wake updates are **private** (delivered only to subscribers whose
    JWT grants `subscribe` on the pair topic); the hub does not run in
    anonymous mode.
  - Machine enrollment/credential issuance may reuse the design already
    proposed in the machine-authentication document; this document does not
    weaken it.
- R8. Engagement is explicit and notified: selecting an `https://` backend
  enters the relay scheme by default with a visible notification (transport
  badge + pairing handshake result); `http://...:59000` selections stay
  direct. There is no silent reclassification by page origin.
- R9. **Plane gating**: the relay requires the frankenphp plane
  (`WEB_SERVER_PLANE=frankenphp`, default). The nginx compat plane does not
  serve relay endpoints (PART_0 §0.8); it has no realtime path at all
  (Reverb fully removed, 2026-08-17).

## 1.4 HTTP/3 requirement

- H1. Every browser-reachable HTTP surface of the central server serves HTTP/3:
  the JSON API, the pycore UI itself, any new relay endpoints, the Mercure hub
  SSE stream, AND the selected HTTPS pycore backend (the reverse-proxied relay
  entry) - all behind the single 443 listener (Caddy h3 default on the
  frankenphp plane; existing nginx stanza on the compat plane).
- H2. **No WebSocket anywhere**: the Mercure downstream is SSE over
  the same HTTPS listener, so realtime rides HTTP/3 like every other surface.
  The former WebSocket-over-HTTP/3 gap (RFC 9220 unshipped in browsers) no
  longer applies - there is no `wss://` to place on either plane.
- H3. Direct-mode pycore traffic stays plain `http://...:59000` on loopback or
  Tailscale CGNAT - HTTP/3 there is out of scope (no front server in that path).

## 1.5 Runtime capability question (from the task)

Evaluate whether Octane (as used by `132_laravel_main_start.sh`) provides the
b.txt capability. Answer shape expected (verified in Part 2):

- Octane is the HTTP application server - it hosts no pub/sub and no roster
  state by itself.
- With the **frankenphp driver** (PART_0), the same Octane process embeds
  Caddy and the built-in **Mercure hub**: SSE downstream to subscribers,
  server-side publish (`mercure_publish()`). That is the transport half of
  the capability, with zero extra daemons.
- The gating half (who is online) is NOT provided by the hub (no application
  presence): it stays the heartbeat registry (RelayMachineRegistry). Reverb,
  the previous answer, is removed from the codebase entirely.

## 1.6 Non-goals

- No replacement of the exchange-hub architecture
  (`FIX_20260802_UI_EXCHANGE_HUB_ARCHITECTURE.md`): UI stays the task pump; the
  relay only changes the UI -> pycore transport leg when remote.
- No generic TURN/tunnel: the relay carries the pycore HTTP route contract only.
- No changes to pycore result-upload egress (`pycore/laravel/client.py`).
- No test creation/modification (project rule).
- No dual-transport relay: the relay is Mercure-only; the compat plane simply
  does not serve it (R9) instead of carrying a second implementation.

## 1.7 Acceptance criteria

- A1. The user selects the HTTPS backend; the UI notifies, enters the relay
  scheme, and pycore-manager is fully usable from any browser origin while the
  pycore machine sits behind NAT with only outbound connectivity to Laravel.
- A2. Killing pycore (or its connection) makes the UI surface `peer-offline`
  within the heartbeat/offline window; relay requests are refused immediately
  (registry TTL, PART_3 §3.1).
- A3. Restarting pycore restores the pair within one reconnect cycle, and the UI
  picker shows the machine online again.
- A4. Two different pycore machines online: the UI can switch between them and
  traffic never crosses between machines (pair isolation by topic + registry).
- A5. `http://...:59000` selections (loopback / Tailscale 100.x / public-IP
  presets) keep working unchanged (direct mode) with no relay hop.
- A6. `curl --http3` (or browser devtools protocol column `h3`) on the API
  domain, the UI domain, the Mercure hub SSE stream, and the HTTPS pycore
  backend; the roster `EventSource` receives a server-published update on the
  same domain.
- A7. Even without an HTTPS backend selected, the always-on Laravel link shows
  the online pycore roster; designating a machine enters the paired state
  (readiness without relay engagement).

## 1.8 Capability-provider rule (other groups)

The group system is an architecture, not a single feature:

- Every group end declares the capabilities it can PROVIDE through the central
  server (roster entries, topic capabilities, route capabilities).
- G3 (laravel-manager) and G4 (wordnew), plus future machine classes
  (mcp-chrome workers), are declared as capability providers in code (shared
  contract entries + per-end registries), but their provider integration is
  NOT implemented in this pass. Only the G2 pycore pair is fully implemented.
- No end hardcodes "who else exists": declarations live in the shared
  contract; ends render what the contract and the roster give them.

## 1.9 Development norms (binding for this feature)

- Build from the underlying architecture, not patches; no thin-compatibility
  layers; follow the latest specifications (Laravel 13, FrankenPHP/Mercure
  current docs, current project contracts).
- Merge common libraries and duplicate implementations; consult the official
  documentation before introducing anything new.
- Do not use multiple agents.
- Develop strictly per this specification.
- Shell scripts: never use exit codes / return-value chaining; trust the
  previous function's execution result; detect binaries directly by probing
  the file system (no stale command-hash probing).

---

End of PART 1. Prerequisite: PART_0. Research: PART_2. Implementation
plan: PART_3.
