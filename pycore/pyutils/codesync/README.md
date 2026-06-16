# codesync — lightweight, stdlib-only Code Sync

A self-contained Code Sync mesh (role-based dev → client file distribution +
last-writer-wins peer-config replication) that runs in **two modes from one
codebase**:

- **Standalone** — `pyservice.sh codesync ...` (Linux/macOS/Git-Bash/WSL) or
  `.\pyservice.ps1 codesync ...` (Windows). Imports **only the Python standard
  library**: no `requests`, no FastAPI, no `third_party`, no pycore. No
  prerequisite install runs.
- **Inside full pycore** — imported as `pycore.pyutils.codesync`; pycore injects
  its logging / event-bus / shutdown via `configure()` and serves `/code-sync/*`
  from its FastAPI app. Same implementation, same committed peer file.

Behaviour is unchanged from the previous `device_sync/code_sync_*` modules — see
`../device_sync/CODE_SYNC_MESH.md` for the model and `../device_sync/CODESYNC_LITE_DESIGN.md`
for the extraction architecture.

## CLI

```
pyservice.sh codesync run [--host 0.0.0.0] [--port 59000]   # start the standalone daemon
pyservice.sh codesync show                                   # role + peers (aligned shape)
pyservice.sh codesync role [dev|client]                      # print or set this device's role
pyservice.sh codesync peers list
pyservice.sh codesync peers add --host 192.168.1.10 --name lab --role dev [--peer-port 59000]
pyservice.sh codesync peers remove --id 192.168.1.10:59000
pyservice.sh codesync peers update --id <id> [--name N] [--host H] [--peer-port P] [--role R]
pyservice.sh codesync distribute on|off                      # dev only; needs a running daemon
pyservice.sh codesync skip-update on|off                     # client only; needs a running daemon
pyservice.sh codesync show --port 59055                      # target a non-default port
```

**HTTP-first, file-fallback**: while a daemon (or the full pycore service) is up
on the target port, edits apply live over HTTP; while it is stopped, role/peers
edits are written straight to the committed peer file and take effect next start.
`distribute` / `skip-update` are runtime-only and require a running daemon.

Windows note: run `.\pyservice.ps1 codesync ...` (or `bash ./pyservice.sh codesync ...`).
A bare `pyservice.sh ...` in PowerShell *opens* the file in the editor instead of
executing it.

## Embedding (Python API)

```python
from pycore.pyutils import codesync           # full-pycore import path
codesync.configure(logger=..., emit_event=..., is_shutdown_requested=...,
                   register_shutdown_handler=...)   # optional injection
mgr = codesync.get_manager()                  # starts the mesh + role service
mgr.get_peers(); mgr.set_role("dev"); mgr.set_distributing(True)
```

## Files

| File | Role |
|---|---|
| `runtime.py` | stdlib bridge: log shim, urllib HTTP shim, event/shutdown hooks, machine-id, lan-ip, paths, `configure()` |
| `peer_config.py` | committed peer list (`device_sync/code_sync_peers.json`), LWW replication |
| `peer_mesh.py` | periodic peer probing + config push/broadcast |
| `server.py` | dev side: client registry + changed-file computation |
| `client.py` | client side: pull newest file across dev-ends |
| `manager.py` | role coordinator; `get_manager()` / `get_code_sync_manager()` |
| `http_server.py` | stdlib `http.server` exposing `/code-sync/*` (standalone only) |
| `daemon.py` | standalone `run()` — HTTP server + manager, blocks until SIGINT |
| `cli.py` | the `codesync` CLI surface |

The bootstrap `../codesync_boot.py` is what the launchers run (as a file, so the
package loads as the top-level name `codesync` and pycore is never imported).
