# -*- coding: utf-8 -*-
"""
Standalone Code Sync daemon (stdlib only).

Starts the stdlib HTTP server (/code-sync/*) and the shared manager (which runs
the peer mesh + the role's file service), then blocks until SIGINT/SIGTERM. This
is what `pyservice.sh codesync run` launches — no pycore, no third_party, no
prerequisite install.
"""

import signal
import time

from .runtime import log as ColorPrint, request_local_shutdown, is_shutdown_requested
from .http_server import CodeSyncHTTPServer
from .manager import get_manager


def run(host: str = "0.0.0.0", port: int = 59000) -> int:
    httpd = CodeSyncHTTPServer(host=host, port=port)
    httpd.start()

    # Creating the manager starts the peer mesh and the role's file service
    # (client puller by default; dev waits for distribute).
    manager = get_manager()
    ColorPrint.green(f"[CodeSync] Standalone daemon up "
                     f"(role={manager.get_role()}, http=:{port}). Ctrl-C to stop.")

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
