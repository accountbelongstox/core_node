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
pyservice.sh codesync run [--host 0.0.0.0] [--port 59000] [--reload]
                                                             # interactively offer to install as a
                                                             # systemd service (default Y); decline
                                                             # -> run the foreground daemon
                                                             # --reload: dev hot-reload (see below)
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

## System service (Linux / systemd)

```
pyservice.sh codesync                 # prompt [Y/n] -> add to systemd + start + show logs
pyservice.sh codesync install         # install + enable + start (no prompt)
pyservice.sh codesync start|stop|restart|status
pyservice.sh codesync uninstall       # stop + disable + remove the unit
```

`pyservice.sh codesync` with **no subcommand** calls
`scripts/shells/linux/common/codesync_service.sh` (reusing the shared
`debian_service_manager.sh`), asks whether to add Code Sync to the system service
(default **Yes**), then installs + starts the `codesync` systemd unit
(`ExecStart=/bin/bash <repo>/pyservice.sh codesync run`) and prints how to follow
the logs:

```
journalctl -u codesync -f                 # live follow
journalctl -u codesync -n 200 --no-pager  # last 200 lines
systemctl status codesync --no-pager      # current status
# file-sync activity also logs to ~/.core_node/data/code_sync_logs/
```

On Windows (no systemd) these print a notice + how to run it in the foreground
(`.\pyservice.ps1 codesync run`, optionally wrapped in Task Scheduler / nssm).

## Hot-reload (dev)

`pyservice.sh codesync run --reload` (or `CODESYNC_RELOAD=1`) starts a stdlib
daemon thread that polls every `.py` under `pycore/pyutils/codesync/` (mtime, no
`watchdog`). On any change it gracefully stops the HTTP server (freeing `:59000`)
and **re-execs the same command via `os.execv`** — re-reading all Python. The
`--reload` flag rides through `sys.argv`, so reload stays on across restarts.
Under systemd (`Restart=always`) the re-exec keeps the same PID; even a plain exit
would be restarted by the supervisor. This mirrors the full-pycore reloader
(`pycore/pyutils/common/dev_reload.py`, enabled by `pyservice.sh run --reload` /
`PYCORE_RELOAD=1`) but is stdlib-only since the daemon never imports pycore.

**As a background systemd service.** Hot-reload works under systemd too: the unit's
`ExecStart` runs `pyservice.sh codesync run`, which `exec`s the daemon as the
service's MainPID, so an in-place `os.execv` keeps the same PID and `Restart=always`
is unaffected. Install with reload baked into the unit so e.g. a `git pull` on the
server is picked up automatically:

```
CODESYNC_RELOAD=1 ./pyservice.sh codesync          # (or: codesync install)
# -> ExecStart=/bin/bash <repo>/pyservice.sh codesync run --reload
```

To toggle it on an already-installed unit, either re-install with `CODESYNC_RELOAD=1`,
or edit `ExecStart` in `/etc/systemd/system/codesync.service` to add `--reload` then
`systemctl daemon-reload && systemctl restart codesync`.

> Leave `--reload` OFF for a normal headless cloud unit unless you want git-pull
> auto-restart — it adds a 1s polling loop and restarts on any codesync/*.py change.

## Web panel (standalone)

In standalone mode the daemon serves a **self-contained control panel at `GET /`**
(`http://<host>:59000/`) — pure HTML + vanilla JS, no build step and no CDN. It
polls `GET /code-sync/peers` every 5s and drives the same `/code-sync/*` API the
desktop React app uses: switch role, toggle distribute / skip-update, add / remove
/ discover peers, and see each peer's reachability + `via` (probe / heartbeat /
both) + last contact + code stats. This gives a headless box (cloud / VPS) a
browser UI without the React app. The full-pycore runtime serves its own React UI
and never starts this stdlib server, so `/` there is owned by pycore.

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
| `peer_mesh.py` | periodic peer probing + reverse heartbeat (NAT-friendly presence) + config push/broadcast; merges both directions into one snapshot (`via` / `last_checkin`) |
| `server.py` | dev side: client registry + changed-file computation |
| `client.py` | client side: pull newest file across dev-ends |
| `manager.py` | role coordinator; `get_manager()` / `get_code_sync_manager()` |
| `http_server.py` | stdlib `http.server` exposing `/code-sync/*` (standalone only) |
| `daemon.py` | standalone `run()` — HTTP server + manager, blocks until SIGINT |
| `cli.py` | the `codesync` CLI surface |

The bootstrap `../codesync_boot.py` is what the launchers run (as a file, so the
package loads as the top-level name `codesync` and pycore is never imported).
