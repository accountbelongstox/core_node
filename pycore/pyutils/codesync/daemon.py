# -*- coding: utf-8 -*-
"""
Standalone Code Sync daemon (stdlib only).

Starts the stdlib HTTP server (/code-sync/*) and the shared manager (which runs
the peer mesh + the role's file service), then blocks until SIGINT/SIGTERM. This
is what `pyservice.sh codesync run` launches — no pycore, no third_party, no
prerequisite install.

Resident by design: codesync does NOT hot-reload. A code change (a dev editing
codesync/*.py, or a client receiving pushed files) must NEVER bounce this daemon —
it stays up until a MANUAL `pyservice codesync restart` or a reinstall. A legacy
`--reload` flag / `CODESYNC_RELOAD=1` env is still accepted but IGNORED, so an old
systemd unit that baked the flag keeps starting cleanly (a reinstall drops it).
"""

import os
import signal
import time

from pycore.pyfoundations.pygvar import HTTP_BIND_HOST, PYCORE_HTTP_PORT
from pycore.pyutils.common.strtools.normalization import to_bool

from pycore.pyutils.codesync.runtime import (
    log as ColorPrint,
    request_local_shutdown,
    is_shutdown_requested,
    set_light,
)
from pycore.pyutils.codesync.http_server import CodeSyncHTTPServer
from pycore.pyutils.codesync.manager import get_manager


def run(host: str = HTTP_BIND_HOST, port: int = PYCORE_HTTP_PORT, reload: bool = False,
        light: bool = False) -> int:
    # Light mode: --light flag OR CODESYNC_LIGHT env (same truthy set as RELOAD).
    # MUST be set BEFORE get_manager() so the manager reads it in __init__.
    light = light or to_bool(os.environ.get("CODESYNC_LIGHT", ""))
    set_light(light)

    # Creating the manager starts the peer mesh and the role's file service
    # (client puller by default; dev waits for distribute). It reads is_light()
    # once and applies the CLIENT-only trims; we mirror its role gate below.
    manager = get_manager()

    # The HTTP control panel is a CLIENT-only trim: a LIGHT CLIENT serves a tiny
    # JSON at GET / instead of the full panel. A light-flagged DEV keeps the full
    # panel (and every other component) per the no-op-with-warning rule, so gate
    # the panel on role too — never disable it on a dev.
    light_client = bool(getattr(manager, "light", light)) and manager.get_role() == "client"
    httpd = CodeSyncHTTPServer(host=host, port=port, serve_panel=not light_client)
    httpd.start()

    ColorPrint.green(f"[CodeSync] Standalone daemon up "
                     f"(role={manager.get_role()}, light={light}, http=:{port}). Ctrl-C to stop.")

    # Hot-reload was removed on purpose: codesync is a resident service. A legacy
    # `--reload` / `CODESYNC_RELOAD=1` is accepted (so old units start) but does
    # nothing — restart explicitly with `pyservice codesync restart` or reinstall.
    if reload or to_bool(os.environ.get("CODESYNC_RELOAD", "")):
        ColorPrint.yellow("[CodeSync] note: hot-reload is disabled by design; the daemon stays "
                          "resident (restart with `pyservice codesync restart` or reinstall).")

    def _on_signal(signum, frame):
        ColorPrint.yellow(f"[CodeSync] Shutdown signal ({signum}) received")
        request_local_shutdown()

    for sig in (getattr(signal, "SIGINT", None), getattr(signal, "SIGTERM", None)):
        if sig is not None:
            try:
                signal.signal(sig, _on_signal)
            except Exception:
                pass

    try:
        while not is_shutdown_requested():
            time.sleep(0.5)
    except KeyboardInterrupt:
        request_local_shutdown()

    httpd.stop()
    ColorPrint.yellow("[CodeSync] Standalone daemon stopped")
    return 0
