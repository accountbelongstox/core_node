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

Sync flows only **dev → client**. There is no "only 1 PRIMARY" enforcement.

## Peer config file

The peer list is the source of truth for the mesh and is **committed in the repo**
(it is code/config, not user data):

    pycore/pyutils/device_sync/code_sync_peers.json

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
- The local machine always has an entry (default role `client`).
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
| `GET  /peers`          | —                                       | `get_peers()` — `{success, self, peers, version}`. |
| `POST /peers/add`      | `{name, host, port=59000, role="client"}` | `add_peer(...)`. |
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

## Mesh: probing & replication

Every end runs the `PeerMeshManager` (`peer_mesh.py`) regardless of role:

- **Probing** — on each tick the mesh probes all configured peers (via
  `GET /peer/status`). Reachable peers report role / distributing / config version;
  **unreachable peers are still shown** in the snapshot.
- **Config replication** — peer-config edits are pushed to peers (`POST /peer/config`)
  and adopted with **last-writer-wins** on `(version, updated_at)`. **Offline peers
  receive the queued update when they come back online.**
- **UI updates** — status is broadcast to the UI over the RPC WebSocket via
  `THREAD_BUS` event `code_sync_update`.

## UI control flow

Control is **entirely UI-driven (no tray menu).**

1. The UI reads `GET /peers` / `GET /status` and subscribes to `code_sync_update`.
2. Add / remove / edit peers and set the local role through `/peers/*` and `/role`;
   changes are persisted to `code_sync_peers.json` and replicated across the mesh.
3. A **client** receives code by default (nothing to enable).
4. A **dev** must press the distribute toggle (`POST /distribute {enabled:true}`)
   after each startup to begin pushing code; status/probing always runs regardless.
