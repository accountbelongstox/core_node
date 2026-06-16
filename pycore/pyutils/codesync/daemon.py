# -*- coding: utf-8 -*-
"""
Standalone Code Sync daemon (stdlib only).

Starts the stdlib HTTP server (/code-sync/*) and the shared manager (which runs
the peer mesh + the role's file service), then blocks until SIGINT/SIGTERM. This
is what `pyservice.sh codesync run` launches — no pycore, no third_party, no
prerequisite install.

Hot-reload (dev): with `--reload` (or `CODESYNC_RELOAD=1`) a daemon thread polls
the codesync package's .py files and, on a change, gracefully stops and re-execs
the SAME command via os.execv — re-reading all Python (mirrors the full-pycore
`dev_reload.py`, but stdlib-only since this process never imports pycore). The
flag rides through argv so reload stays on across restarts. Under systemd
(`Restart=always`) a re-exec keeps the same PID; even a plain exit would be
restarted by the supervisor, so this works headless too.
"""

import os
import signal
import sys
import threading
import time
from pathlib import Path

from .runtime import log as ColorPrint, request_local_shutdown, is_shutdown_requested
from .http_server import CodeSyncHTTPServer
from .manager import get_manager

# Set by the reload watcher so the main loop re-execs AFTER the HTTP server has
# been stopped (so :port is freed cleanly before the new image rebinds it).
_reload_event = threading.Event()

_IGNORE_DIR_NAMES = frozenset({"__pycache__", ".git", ".mypy_cache", ".pytest_cache"})


def _reload_enabled(explicit: bool) -> bool:
    return bool(explicit) or os.environ.get("CODESYNC_RELOAD", "") in ("1", "true", "True")


def _watch_snapshot(root: Path) -> dict:
    """path -> st_mtime_ns for every *.py under the codesync package."""
    snap = {}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in _IGNORE_DIR_NAMES]
        for filename in filenames:
            if not filename.endswith(".py"):
                continue
            p = os.path.join(dirpath, filename)
            try:
                snap[p] = os.stat(p).st_mtime_ns
            except FileNotFoundError:
                pass  # atomic-save rename race; ignore
    return snap


def _start_reload_watcher(interval: float = 1.0, debounce: float = 0.4) -> None:
    # daemon.py lives in the codesync package dir — exactly the code this process
    # runs, so that is what we watch.
    root = Path(__file__).resolve().parent

    def _run():
        baseline = _watch_snapshot(root)
        ColorPrint.blue(f"[CodeSync] reload ON — watching {len(baseline)} .py files under {root}")
        while not is_shutdown_requested():
            time.sleep(interval)
            if is_shutdown_requested():
                return
            current = _watch_snapshot(root)
            if current == baseline:
                continue
            # Settle a save-burst, then re-diff so we restart once on the final state.
            time.sleep(debounce)
            current = _watch_snapshot(root)
            if current == baseline:
                baseline = current
                continue
            changed = sorted(p for p in set(baseline) | set(current)
                             if baseline.get(p) != current.get(p))
            for p in changed[:10]:
                ColorPrint.yellow(f"[CodeSync] reload: changed {os.path.basename(p)}")
            ColorPrint.yellow(f"[CodeSync] reload: {len(changed)} change(s) -> restarting (os.execv)")
            _reload_event.set()
            request_local_shutdown()   # break the main loop -> httpd.stop() -> re-exec
            return

    threading.Thread(target=_run, name="CodeSync-Reload", daemon=True).start()


def _reexec() -> None:
    """Replace this process image with a fresh one running the SAME command."""
    ColorPrint.yellow("[CodeSync] reload: re-executing daemon")
    try:
        os.execv(sys.executable, [sys.executable, sys.argv[0], *sys.argv[1:]])
    except Exception as exc:  # pragma: no cover — supervisor (systemd) will restart us
        ColorPrint.yellow(f"[CodeSync] reload: execv failed ({exc}); exiting for supervisor restart")
        os._exit(3)


def run(host: str = "0.0.0.0", port: int = 59000, reload: bool = False) -> int:
    httpd = CodeSyncHTTPServer(host=host, port=port)
    httpd.start()

    # Creating the manager starts the peer mesh and the role's file service
    # (client puller by default; dev waits for distribute).
    manager = get_manager()
    ColorPrint.green(f"[CodeSync] Standalone daemon up "
                     f"(role={manager.get_role()}, http=:{port}). Ctrl-C to stop.")

    if _reload_enabled(reload):
        _start_reload_watcher()

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
    if _reload_event.is_set():
        # Socket is now released; hand off to a fresh image (re-reads all .py).
        _reexec()
    ColorPrint.yellow("[CodeSync] Standalone daemon stopped")
    return 0
