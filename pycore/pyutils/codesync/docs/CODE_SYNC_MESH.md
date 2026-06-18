# Code Sync Mesh

Authoritative description of the current Code Sync model: a **role-based peer
mesh**. This supersedes the PRIMARY/SECONDARY material in `README.md`,
`UNIFIED_ARCHITECTURE.md`, and `ARCHITECTURE_VERIFICATION_REPORT.md`.

## Roles

Every machine has exactly one role, stored in the committed peer config:

- **dev** — distributes code to clients. **Multiple dev-ends are allowed.**
  Distribution is **OFF by default on every startup** and must be enabled manually
  from the UI (`set_distributing(True)`); the flag is never persisted, so a dev
  machine never pushes code unintentionally after a restart. A dev never pulls code
  and never connects to itself.
- **client** (default) — receives code. The file client runs on startup (always on)
  and pulls the **newest version of each file across all configured dev-ends**
  (per-file `mtime`, newest-wins). Clients never push.

The local machine and any newly added peer default to **`role=client`** (receive-only).
Only an explicit role change (UI or `/role` endpoint) makes a peer a dev. A prior UI
bug defaulted the add-peer form and the loading fallback to `"dev"`, which mislabeled
clients in the mesh — that is now fixed.

Sync flows only **dev → client**. There is no "only 1 PRIMARY" enforcement.

## Peer config file

The peer list has **two tiers** (see `peer_config.py`):

- **Baseline (committed default, read-only at runtime):**
  `pycore/pyutils/codesync/code_sync_peers.json` — the shipped default, the seed
  for a fresh machine.
- **Override (per-machine, writable, gitignored):**
  `<core_node>/.data/pycore/codesync/code_sync_peers.json` — **every runtime edit
  lands here**, never in the committed baseline. On load the override wins; if it is
  absent the baseline is used as the seed and the first edit creates the override.
  This keeps per-machine role/peers out of the code tree (each machine differs) and
  stops the committed file from churning. Default role for a machine not in the
  config is **client** (receives code).

Schema:

```json
{
  "version": 0,
  "updated_at": 0.0,
  "peers": [
    { "id": "<machine-id or host:port>",
      "name": "<display name>",
      "host": "<lan ip / hostname>",
      "port": 59000,
      "role": "dev | client" }
  ]
}
```

- A peer `id` is the machine id string (or `host:port` for manually added peers).
- The local machine always has an entry (default role `client`); newly added peers also default to `client`.
- The file is **edited from the UI** (add / remove / update peers, set role) and
  **replicated across peers via the mesh** using **last-writer-wins** on
  `(version, updated_at)`.
- It is **excluded from the bulk code file-sync** so the config-replication and the
  file-sync mechanisms do not fight.
- The per-session `distributing` flag is **not** stored here (it must reset to off
  on every startup).

## HTTP endpoints

All under the `/code-sync` prefix (`pycore/callmodule/routers/code_sync_router.py`).
Endpoints are thin wrappers over `get_code_sync_manager()`.

### Mesh / control (UI + peer-to-peer)

| Method & path          | Body                                    | Calls / returns |
|------------------------|-----------------------------------------|-----------------|
| `GET  /peer/status`    | —                                       | `get_local_peer_status()`. Probed frequently by peers; fast, never raises (returns a minimal dict on error). |
| `POST /peer/config`    | `{peers, version, updated_at}`          | `apply_remote_config(...)` — adopt a newer config (LWW). |
| `POST /peer/heartbeat` | sender's `get_local_peer_status()` dict | `receive_heartbeat(payload, src)` — record inbound presence (NAT-friendly); returns `{success, config}` so the sender adopts our config (LWW). |
| `GET  /peers`          | —                                       | `get_peers()` — `{success, self, peers, version}`. |
| `POST /peers/add`      | `{name, host, port=59000, role="client"}` | `add_peer(...)`. Default `role="client"` — only an explicit value makes a peer a dev. |
| `POST /peers/remove`   | `{id}`                                  | `remove_peer(id)`. |
| `POST /peers/update`   | `{id, name?, host?, port?, role?}`      | `update_peer(id, fields)`. |
| `POST /role`           | `{role}`                                | `{success, role: set_role(role)}` (`dev` or `client`). |
| `POST /distribute`     | `{enabled}`                             | `set_distributing(enabled)` (dev only). |
| `POST /discover`       | —                                       | `discover()` — LAN candidate peers. |
| `GET  /status`         | —                                       | `get_status()` — role, distributing, peers, version. |

### File transfer (active only when a dev has distribution enabled)

`GET /ping`, `POST /register`, `POST /initial-sync`, `POST /changes`,
`POST /download`, `POST /toggle-backup`. These gate on `is_server_mode()` /
`get_server()`, which now mean **"dev AND distributing"**.

### Deprecated (back-compat shims)

`POST /set-server` → `role=dev`, `POST /set-client` → `role=client`,
`POST /stop` → `distribute=false`. Prefer `/role` and `/distribute`.

## Mesh: probing, heartbeat & replication

Every end runs the `PeerMeshManager` (`peer_mesh.py`) regardless of role. On each
tick it works **both directions** so a peer's contact state shows across WAN, not
only on the LAN:

- **Outbound probe** — the mesh probes all configured peers (`GET /peer/status`).
  Works only when this node can open a connection to `peer:port` (LAN / tailscale /
  a port-forwarded public host). Reachable peers report role / distributing / code
  stats; **unreachable peers are still shown** in the snapshot.
- **Inbound heartbeat** — the mesh also POSTs this node's own status to every
  configured **dev/hub** (`POST /peer/heartbeat`). This is the NAT-friendly
  direction: a client behind NAT (home laptop, cloud box, phone) that can never be
  *probed* still **reports its presence + code stats** to the dev. The heartbeat
  **response carries the dev's peer-config**, so even a one-directional client
  converges config (LWW) without being push-reachable.
- **Merged presence** — `snapshot()` combines both signals per peer:
  `reachable = probe_ok OR heartbeat_fresh` (fresh = within `HEARTBEAT_STALE_SECONDS`,
  3 ticks); `last_seen = max(probe, checkin)`; `status` = the fresher payload; and a
  `via` field (`probe` / `heartbeat` / `both` / `null`) records how the peer is
  connected. `last_checkin` is exposed separately.
- **Config replication** — peer-config edits are pushed to peers (`POST /peer/config`)
  and adopted with **last-writer-wins** on `(version, updated_at)`. **Offline peers
  receive the queued update when they come back online** (or, if unreachable for a
  push, on their next heartbeat response).
- **UI updates** — status is broadcast to the UI over the RPC WebSocket via
  `THREAD_BUS` event `code_sync_update`. The desktop CodeSync page renders the `via`
  badge + `last_checkin` so each client's connection situation is visible.

> **Topology note.** A heartbeat only helps if the client can reach the dev's
> configured `host:port` outbound. For the cloud/tailscale ends, the dev entry's
> host must be an address the clients can reach (e.g. its tailscale IP), and the
> dev/hub's `:59000` must be open to them. Probing the *other* way additionally
> needs the client's `:59000` reachable from the dev — which NAT usually blocks, and
> which the heartbeat is exactly there to work around.

## Ports & channels (no conflict)

Three **distinct** channels share two ports — do not conflate them:

| Channel | Endpoint | Purpose |
| --- | --- | --- |
| UI ↔ pycore | `:59000` `/rpc/ws` (rpc_v2) + `/code-sync/*` HTTP | the UI talks **directly** to pycore here (status, control, peer mgmt) |
| pycore ↔ laravel | `:9000` `/api/*` | sync engine target; the UI's **"Laravel endpoint"** picker just tells pycore *which* laravel `:9000` backend to use (see `services/sync/laravel_endpoint_manager.py`) — it is NOT a UI↔laravel link |
| dev → client file push | `:59000` `/code-sync/ws` | the dev dials INTO each client peer and streams **batched** file deltas; the client is the WS **server/receiver** (see "WS file-push protocol" below) |

So selecting a Laravel endpoint in the UI never touches the codesync mesh, and
the codesync mesh never touches `:9000` — they only share the host list.

### The `/code-sync/ws` receiver lives in TWO servers

The file-push receiver (`PushReceiver`) is reachable at `/code-sync/ws` from
**both** server implementations, so a peer accepts pushes regardless of how it
runs:

- **Standalone daemon** (`http_server.py`, `pyservice codesync`) — serves it
  directly.
- **Full pycore** — registered onto the rpc_v2 FastAPI app (`:59000`) by
  `callmodule/config.py::_register_code_sync_ws`. Full pycore never starts the
  standalone daemon, so without this the route was missing and every push from
  the dev failed the handshake with **`HTTP/1.0 404 Not Found`**. If you see
  that again, the peer's `:59000` server lacks this registration.

## WS file-push protocol (`sync_ws.py`)

The dev (NAT'd) dials OUT to each client (the WS server) and pushes file changes
over `/code-sync/ws`. The handshake is `hello` (dev→client) / `welcome`
(client→dev), then files flow in **batches**.

### Batched push (one round-trip per tick)

Instead of one WS frame + one ack per file, the dev **batches a tick's changed
files into a single message** and the client replies **once**:

```jsonc
// dev → client
{ "type": "batch",
  "reason": "delta|resume",
  "files": [ { "rel", "mtime", "hash", "size", "b64" }, … ] }

// client → dev
{ "type": "batch_ack",
  "results": [ { "rel", "status", "diff", "size" }, … ] }
```

- `status` is `written | skipped | error`; `skipped` means the client's file hash
  already matched (up-to-date), so nothing was written.
- A large delta is **split into multiple ~8 MB batches** rather than sent as one
  oversized frame; each batch is acked independently.
- This cuts round-trips from **N (one per file) to ~1 per tick**.
- Legacy single-file `file` / `ack` messages **remain supported** for back-compat;
  new senders use `batch` / `batch_ack`.

### Per-client queue + resume (no baseline reset on reconnect)

The sender keeps a **persistent per-`client_id` `last_sent` snapshot** that
**outlives the push thread** (so a dropped/reconnected link does not lose state):

- **First-ever connect** baselines to the current tree — no bulk resend of the
  existing files (only what changes afterwards is pushed).
- **A reconnect reuses the stored snapshot** (`reason="resume"`), so files that
  changed **while the client was offline are still delivered**. (This supersedes
  the old behaviour, which reset the baseline on every reconnect and silently
  dropped offline-window changes.)
- `last_sent` **advances only for files the client acked** (`written` or
  `skipped`), so a mid-sync drop **resumes from the last acked point** rather than
  re-sending everything.

### Retry with backoff

Unreachable clients are retried with **exponential backoff (2s … cap 30s)**, reset
to the floor on a successful connect. The **first failure is logged once, then the
retry loop is quiet** (no log spam). A **`retrying` sync phase** is surfaced to the
UI so the operator sees a client that is down but still being chased.

### Richer sync log

Each sync-log entry carries
`{ action, file_path, reason, details, size, diff, timestamp, peer, direction }`.
`peer` is the display name / id of the other end (the dev that sent the file, or
the client that received it); `direction` is `"push"` (dev side) or `"receive"`
(client side). The **client** computes the **signed byte diff**
(`new size − old size`) on write, so the UI can show, per file, the
**update reason, time, diff size, and which peer was involved**
(e.g. `+128 B`, `-40 B`).

## Per-channel sync phase

The manager tracks sync phase **per channel**, not as a single global value.
Multiple simultaneous peer connections previously overwrote each other's phase;
with per-channel tracking they are independent:

- **Dev side** — keyed by `target_client_id`; each outbound push thread has its own
  phase (`idle | pushing | retrying`).
- **Client side** — keyed by `source_dev_id`; each inbound receive session has its
  own phase (`idle | receiving | retrying`). The `dev_id` and `dev_name` are carried
  in every `batch` / `file` message the dev sends, so the client can tag the channel
  without additional round-trips.

`get_sync_phase()` returns:

```jsonc
{
  "phase": "pushing",           // aggregate: first non-idle; priority pushing/receiving > retrying > idle
  "count": 3,                   // aggregate file count for that phase
  "channels": {
    "<channel-id>": {
      "phase": "pushing",
      "count": 3,
      "name": "office-dev",     // display name of the peer
      "direction": "push",      // "push" (dev→client) | "receive" (client←dev)
      "ts": 1718700000.0        // last transition timestamp
    }
  }
}
```

The top-level `phase` / `count` fields are kept for back-compat with the
single-badge UI. The `channels` map drives the per-peer phase pills in the
richer UI.

## UI control flow

Control is **entirely UI-driven (no tray menu).**

1. The UI reads `GET /peers` / `GET /status` and subscribes to `code_sync_update`.
2. Add / remove / edit peers and set the local role through `/peers/*` and `/role`;
   changes are persisted to `code_sync_peers.json` and replicated across the mesh.
3. A **client** receives code by default (nothing to enable).
4. A **dev** must press the distribute toggle (`POST /distribute {enabled:true}`)
   after each startup to begin pushing code; status/probing always runs regardless.

Both the React CodeSync page and the standalone vanilla-JS panel expose the same
enhanced control surfaces:

- **Per-peer phase pills** — one pill per channel entry from `get_sync_phase()
  .channels`, coloured by phase (`idle` / `pushing` / `receiving` / `retrying`).
  Replaces the former single global phase badge.
- **Icon stat strip** — compact row of labelled counters: role, distributing/skip
  flag, peer count, reachable count, queued file count, files synced this session,
  error count.
- **Time-range activity chart** — histogram of sync events built from the `timestamp`
  field of sync-log entries, with selectable windows: **5 m / 30 m / 1 h / 24 h**.
  Gives an at-a-glance view of sync activity without querying a separate endpoint.
