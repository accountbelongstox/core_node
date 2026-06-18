# Code Sync — Lightweight Standalone Library (Architecture Design)

> Status: **IMPLEMENTED** — the library lives at `pycore/pyutils/codesync/`
> (bootstrap `pycore/pyutils/codesync_boot.py`); the old `device_sync/code_sync_*`
> + `peer_*` modules were removed and all references repointed. Usage doc:
> `pycore/pyutils/codesync/README.md`. This file remains the architecture record.
>
> Target: extract the existing Code Sync
> mesh into a self-contained, **stdlib-only** package that can run on its own
> (`pyservice.sh codesync ...`) without importing `third_party`, without booting
> the full `pycore` runtime, and without the `pyservice.sh` prerequisite install —
> while the full `pycore` runtime keeps using the **same** library. Linux + Windows.

---

## 1. Goals & hard constraints

1. **Same logic, one source of truth.** The peer config, role mesh, file
   distribution (dev → client) and last-writer-wins replication behave exactly as
   documented in `CODE_SYNC_MESH.md`. No behavioural change.
2. **Standalone = stdlib only.** When launched as `pyservice.sh codesync …`, the
   process imports **only the Python 3 standard library**. No `requests`, no
   `fastapi`/`uvicorn`, no `pycore` package import, no `third_party`.
3. **No prerequisites, no `pycore_module_caller`.** The `codesync` launch branch in
   `pyservice.sh` / `pyservice.ps1` must short-circuit **before** the prereq
   (`prepare.sh`) step and must never run `pycore_module_caller.py` ("pymain").
4. **Shared by full pycore.** When the full native pycore runtime is running,
   `pyservice.sh codesync` (and the in-process FastAPI router) call the **same**
   library — pycore just *injects* its richer services (logging, event bus,
   machine-id) into the library at startup.
5. **Cross-OS.** Identical behaviour on Linux / macOS / Git-Bash / WSL (`.sh`) and
   Windows PowerShell (`.ps1`). Stdlib only ⇒ no platform-specific deps.

---

## 2. The core problem: import isolation

Python runs **every parent package `__init__.py`** when you import a submodule.
So `import pycore.pyutils.device_sync.X` *always* executes the heavy
`pycore/__init__.py`. Therefore the lightweight library must be importable
**without** its name being rooted at `pycore`.

**Solution — a self-contained package imported as a top-level name.**

```
pycore/pyutils/codesync/            ← the new self-contained package
```

- **Standalone mode:** the bootstrap puts `pycore/pyutils/` on `sys.path[0]` and
  does `import codesync`. Python resolves `codesync` as a **top-level** package →
  `pycore/__init__.py` and `pycore/pyutils/__init__.py` are **never executed**.
- **Full-pycore mode:** pycore imports it as `from pycore.pyutils import codesync`.
  The heavy `__init__` runs, but that is fine — the full runtime is already up.

For this to work under **both** import names the package obeys two rules:

- **Only relative imports inside** (`from .peer_config import …`), never
  `from pycore.pyutils.codesync.… import …` and never bare `import codesync.…`.
- **Zero `import pycore` / `from pycore …` at module top level.** All pycore
  services arrive by **dependency injection** (see §4), never by import.

> The two processes (standalone vs full) hold two different `sys.modules` entries
> for the same files and therefore two independent singletons — harmless, since
> they never share a process.

---

## 3. Module layout

```
pycore/pyutils/codesync/
├── __init__.py          # public API + configure() injection entry point
├── runtime.py           # the bridge/shim layer (stdlib defaults; pycore overrides)
├── http_client.py       # urllib-based GET/POST-json / GET-bytes  (replaces requests)
├── http_server.py       # http.server ThreadingHTTPServer exposing /code-sync/*  (standalone only)
├── peer_config.py       # committed peer list  (ported from device_sync/peer_config.py)
├── peer_mesh.py         # probing + LWW replication  (ported; requests → http_client)
├── server.py            # dev side: client registry + changed-file computation  (ported)
├── sync_ws.py           # WS file push: dev dials OUT, BATCHED deltas + per-client resume  (see below)
├── client.py            # client side: pull newest file across dev-ends  (ported; requests → http_client)
├── manager.py           # orchestrator: get_manager(), role/distribute/peers/status  (ported)
├── cli.py               # stdlib argparse CLI: show / role / peers / distribute / skip-update
├── daemon.py            # standalone entry: start http_server + mesh + client/server, run forever
└── README.md            # usage (the "调用文档")

pycore/pyutils/codesync_boot.py     # tiny bootstrap run by the launchers (see §5)
```

The 5 ported files are near-mechanical moves of the existing
`device_sync/{peer_config,peer_mesh,code_sync_server,code_sync_client,code_sync_manager}.py`,
with three substitutions applied (§4). **Update (2026-06-16):** the legacy
`device_sync/` folder was retired and its committed baseline + these docs were
folded into `codesync/`; the canonical committed baseline is now
`pycore/pyutils/codesync/code_sync_peers.json` (per-machine edits live in the
`.data` override — see CODE_SYNC_MESH.md "Peer config file").

---

## 4. The bridge layer (`runtime.py`) — stdlib default, pycore-injected

All cross-cutting pycore dependencies are funnelled through one module with
**stdlib fallbacks**. Ported code changes `from pycore import …` → `from .runtime import …`.

| Concern | Today (heavy) | `runtime.py` default (stdlib) | Injected by full pycore |
|---|---|---|---|
| Logging | `ColorPrint.green/blue/yellow/red` (93 sites) | `log.*` → `logging`/stderr, same method names | forward to `pycore.ColorPrint` |
| Event bus | `THREAD_BUS.trigger_event("code_sync_update", …)` (30 sites) | `emit_event(name, payload)` → no-op | forward to `THREAD_BUS.trigger_event` |
| Shutdown flag | `THREAD_BUS.is_shutdown_requested()` | `is_shutdown_requested()` → `False` (daemon owns its own stop Event) | forward to `THREAD_BUS` |
| HTTP client | `requests` / `get_third_package_requests()` (8 sites) | `http_client.get_json/post_json/get_bytes` (`urllib.request`) | unchanged (still stdlib) |
| Machine id | `pycore.pyutils.security.machine_id.get_machine_id` | stdlib copy (`uuid.getnode()` + hostname; `winreg` MachineGuid on Windows) | optionally inject richer impl |
| LAN ip | `pycore.pyutils.rpc_v2.…local_ip_detector` | stdlib `socket` UDP-connect trick | optionally inject |
| core_node root / app-data dir | `pycore.pyfoundations.system_paths` | stdlib compute of `~/.core_node` + repo root | optionally inject |

Public injection API (called once, only in full-pycore mode):

```python
# pycore/callmodule/config.py startup, before get_manager()
from pycore.pyutils import codesync
codesync.configure(
    logger=ColorPrint,
    emit_event=THREAD_BUS.trigger_event,
    is_shutdown_requested=THREAD_BUS.is_shutdown_requested,
    # machine_id / lan_ip / paths: optional overrides
)
```

If `configure()` is never called (standalone), the stdlib defaults are used.

---

## 5. Launchers — new `codesync` subcommand (Linux + Windows)

`code_sync_peers.json`, role, peers and the mesh are persistent/offline-capable, so
the standalone daemon needs nothing but Python 3.

### Bootstrap (`pycore/pyutils/codesync_boot.py`)

Run **as a file** (not `-m`), so `sys.path[0]` becomes `pycore/pyutils/` and
`codesync` resolves top-level — pycore is never imported:

```python
# stdlib only
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # → pycore/pyutils
import codesync                      # top-level, NOT pycore.pyutils.codesync
raise SystemExit(codesync.cli.main(sys.argv[1:]))   # cli dispatches run/show/role/...
```

### `pyservice.sh` (Linux/macOS/Git-Bash/WSL)

Add `codesync` to the subcommand peek and dispatch it **right after `config`,
before the prereq step** (mirrors the existing `config` short-circuit at lines
187–194), so `prepare.sh` never runs:

```sh
run|config|codesync|install|start|stop|restart|status|uninstall)
    CMD="$1"; shift ;;
...
if [[ "$CMD" == "codesync" ]]; then
    PY="$(resolve_python)" || { echo "[X] Python 3 not found"; exit 1; }
    cd "$SCRIPT_DIR"
    exec "$PY" pycore/pyutils/codesync_boot.py "$@"   # no prepare.sh, no pycore
fi
```

### `pyservice.ps1` (Windows)

Add a `'codesync'` arm to the existing `switch ($Command.ToLowerInvariant())`
(next to `'config'`), short-circuiting before any prereq logic:

```powershell
'codesync' {
    $py = Resolve-Python ; if (-not $py) { Write-Host '[X] Python 3 not found'; exit 1 }
    & $py.Path (Join-Path $PSScriptRoot 'pycore/pyutils/codesync_boot.py') @rest
    exit $LASTEXITCODE
}
```

### CLI surface (`codesync.cli`, stdlib argparse) — mirrors today's `config codesync`

```
pyservice.sh codesync run [--host 0.0.0.0] [--port 59000]   # start the standalone daemon
pyservice.sh codesync show
pyservice.sh codesync role [dev|client]
pyservice.sh codesync peers list|add|remove|update …   # add defaults to role=client
pyservice.sh codesync distribute on|off          # dev: push code (needs a running daemon)
pyservice.sh codesync skip-update on|off          # client: temporarily reject code
```

HTTP-first / file-fallback semantics are identical to the current CLI, and the
already-applied `_offline_snapshot` alignment fix is carried over verbatim.

---

## 6. Standalone HTTP server (`http_server.py`)

Full pycore serves `/code-sync/*` from its **FastAPI** app (`code_sync_router.py`).
Standalone has no FastAPI, so the daemon runs a stdlib `http.server.ThreadingHTTPServer`
that exposes the **same routes**, each a thin call into `manager`:

```
GET  /code-sync/ping
GET  /code-sync/peer/status        GET  /code-sync/peers      GET /code-sync/status
POST /code-sync/peer/config        POST /code-sync/role       POST /code-sync/distribute
POST /code-sync/peers/{add,remove,update}                     POST /code-sync/skip-update
POST /code-sync/register  /initial-sync  /changes  /download  (file transfer; dev+distributing)
```

- **Standalone:** `daemon.py` binds `:59000` with this server.
- **Full pycore:** the FastAPI router keeps serving these routes; the stdlib server
  is **not** started (avoids double-bind on 59000). Both call the identical
  `manager` instance/logic.

`code_sync_router.py` is reduced to thin wrappers over `codesync.get_manager()`
(it already is thin), so there is exactly one implementation behind both servers.

### WS file-push channel (`sync_ws.py`)

The actual file delivery does **not** ride the `POST /…/changes` + `POST /…/download`
HTTP pull anymore: the dev is NAT'd and dials OUT to each client's
`/code-sync/ws`, the client being the WS server (canonical: `CODE_SYNC_MESH.md`
"WS file-push protocol"). Both servers expose `/code-sync/ws`: standalone via the
`http.server` upgrade, full pycore via the rpc_v2 FastAPI WS — both feed each text
frame to the same `PushReceiver`. The current design is:

- **Batched push:** a tick's changed files go out as one `{"type":"batch",…}`
  message answered by one `{"type":"batch_ack",…}`; large deltas split into
  ~8 MB batches; legacy `file`/`ack` frames still accepted. Round-trips drop from
  N to ~1 per tick.
- **Per-client `last_sent` snapshot** that outlives the push thread: first connect
  baselines (no bulk resend); a reconnect **resumes** (`reason="resume"`, offline
  changes still delivered) and `last_sent` advances only for acked files — it is
  **not** reset on reconnect.
- **Exponential backoff** (2s … 30s) for unreachable clients, first failure logged
  once; a `retrying` sync phase reaches the UI.
- **Richer per-file log** `{action,file_path,reason,details,size,diff,timestamp,peer,direction}`
  — `peer` is the other end's name/id; `direction` is `"push"` or `"receive"`;
  client computes the signed byte diff.
- **Per-channel sync phase** — phase is tracked per channel id (dev side: `target_client_id`;
  client side: `source_dev_id`, carried in every batch/file message as `dev_id`/`dev_name`).
  `get_sync_phase()` returns `{phase, count, channels:{id:{phase,count,name,direction,ts}}}`:
  the top-level `phase`/`count` is an aggregate (first non-idle channel, priority
  `pushing`/`receiving` > `retrying` > `idle`) kept for back-compat; the `channels` map
  drives per-peer phase pills in the UI. No more global sync_phase that peer connections
  overwrite.

---

## 7. Compatibility & migration

- **Keep the old module paths working.** `device_sync/code_sync_manager.py`,
  `peer_config.py`, `peer_mesh.py`, `code_sync_server.py`, `code_sync_client.py`
  become **deprecation shims** that re-export from `pycore.pyutils.codesync`
  (`from pycore.pyutils.codesync.manager import *`, etc.), so existing imports
  (`callmodule/config.py`, the router, `pyservice_cli`) don't break during/after
  migration.
- **`pyservice_cli config codesync`** (the existing subcommand) is repointed to the
  lib's `peer_config` for its offline path; behaviour unchanged. Long-term it can
  delegate to `codesync.cli` to avoid the heavy pycore import on the file path too.
- **`code_sync_peers.json`** path and schema are unchanged → no data migration.
- The legacy `simple_*`, `_deprecated/`, `_legacy/` device_sync files are out of
  scope (left as-is).

---

## 8. Work plan (after design sign-off)

1. Scaffold `pycore/pyutils/codesync/` + `runtime.py` (shims) + `http_client.py`.
2. Port the 5 core files with the 3 substitutions (logger / event / http).
3. Add `http_server.py`, `daemon.py`, `cli.py`, `codesync_boot.py`.
4. Wire `configure()` injection from `callmodule/config.py`; turn old files into shims.
5. Add the `codesync` branch to `pyservice.sh` and `pyservice.ps1`.
6. Verify: (a) `python pycore/pyutils/codesync_boot.py show` imports **no** pycore
   and **no** third_party (assert `pycore` not in `sys.modules`); (b) full pycore
   still serves `/code-sync/*`; (c) a dev↔client sync round-trips on the stdlib server.

---

## 9. Acceptance checks

- `pyservice.sh codesync run` starts with **only** stdlib imported
  (`assert 'pycore' not in sys.modules and 'requests' not in sys.modules`).
- No `prepare.sh` / prereq output appears on the `codesync` path.
- `pyservice.sh codesync show` (daemon up) and `--port <dead>` (file path) return
  the aligned snapshot shape from §"alignment fix".
- Full pycore: `GET /code-sync/peers` unchanged; UI `code_sync_update` events still fire.
```
