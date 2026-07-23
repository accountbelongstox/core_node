# -*- coding: utf-8 -*-
"""
Backend hot-reload watcher (dev-only).

Why this exists
---------------
The backend has no native hot-reload: editing a route/processor/handler requires
re-reading Python, which only happens on a full process restart. The tray
"Restart" already does that the right way -- it sets the restart flag and the
__main__ block in pycore_module_caller.py re-execs via os.execv (re-reading ALL
Python) instead of unwinding the interpreter (which would crash Qt/Tk teardown
on the wrong thread).

This module turns that manual restart into an automatic one: a daemon thread
polls the pycore package's .py files and, on a change, calls
``THREAD_BUS.request_restart()`` -- the SAME path the tray uses. No new restart
logic, no patching of live functions (which is fragile with PySide6/torch
C-extensions); just "save .py -> graceful restart -> os.execv".

Design notes
------------
- stdlib only (mtime polling via os.walk). No ``watchdog`` dependency, so it
  works on a freshly-provisioned machine with nothing pip-installed.
- On by default; disable with ``--no-reload`` / ``PYCORE_NO_RELOAD=1``. The
  reload flag rides through os.execv (sys.argv is preserved), so the choice stays
  on across restarts.
- Logs the EXACT file and change kind that triggered the restart (not a generic
  "files changed"), and routes through ColorPrint so it also reaches the live WS
  log bridge.
"""

import os
import time
from pathlib import Path

from pycore import ColorPrint, THREAD_BUS
from pycore.pyfoundations.serialized_worker import start_bus_task

# Directories never worth watching: caches, vendored JS (Vite owns the FE),
# backups, generated trees. Pruned in-place so os.walk never descends into them.
_IGNORE_DIR_NAMES = frozenset({
    '__pycache__', '.git', '.hg', '.svn',
    'node_modules', '.venv', 'venv', 'env',
    'bak', 'backup_before_tk', 'desktop-manager',
    '.mypy_cache', '.pytest_cache', '.ruff_cache',
})


def _iter_py_files(roots):
    """Yield every non-ignored *.py path under the given roots."""
    for root in roots:
        if not root.exists():
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in _IGNORE_DIR_NAMES]
            for filename in filenames:
                if filename.endswith('.py'):
                    yield Path(dirpath) / filename


def _mtime_ns(path):
    """st_mtime_ns for ``path``, or None if it vanished mid-scan.

    An editor's atomic save (write temp -> rename over target) makes a file
    momentarily absent between listing and stat. That ONE expected race is the
    only thing tolerated here -- it is narrowed to FileNotFoundError so any other
    OS error (permissions, I/O) still surfaces instead of being swallowed.
    """
    try:
        return path.stat().st_mtime_ns
    except FileNotFoundError:
        return None


def _snapshot(roots):
    """Map of path -> mtime_ns for all watched files right now."""
    snap = {}
    for path in _iter_py_files(roots):
        mtime = _mtime_ns(path)
        if mtime is not None:
            snap[path] = mtime
    return snap


def _changes(old, new):
    """List of (path, kind) describing how ``new`` differs from ``old``."""
    diffs = []
    for path, mtime in new.items():
        if path not in old:
            diffs.append((path, 'added'))
        elif old[path] != mtime:
            diffs.append((path, 'modified'))
    for path in old:
        if path not in new:
            diffs.append((path, 'removed'))
    return diffs


def start_reload_watcher(roots=None, interval=1.0, debounce=0.4):
    """Start the dev hot-reload watcher on a daemon thread.

    Args:
        roots: iterable of dirs to watch. Default: the ``pycore`` package dir.
        interval: seconds between scans.
        debounce: after a change is seen, wait this long and re-scan so a burst
            of saves coalesces into a single restart.

    Returns:
        The started ``threading.Thread``.
    """
    if roots is None:
        # This file is pycore/pyutils/dev_reload.py -> the pycore package dir.
        roots = [Path(__file__).resolve().parent.parent]
    roots = [Path(r).resolve() for r in roots]

    def _run():
        baseline = _snapshot(roots)
        ColorPrint.blue(
            f"[reload] dev hot-reload ON - watching {len(baseline)} .py files under "
            + ", ".join(str(r) for r in roots)
        )

        while not THREAD_BUS.is_shutdown_requested():
            time.sleep(interval)
            if THREAD_BUS.is_shutdown_requested():
                return

            diffs = _changes(baseline, _snapshot(roots))
            if not diffs:
                continue

            # Settle: let a save-burst (and atomic-rename temp files) finish,
            # then re-diff so we restart once, on the real final state.
            time.sleep(debounce)
            settled = _snapshot(roots)
            diffs = _changes(baseline, settled)
            if not diffs:
                baseline = settled
                continue

            for path, kind in diffs:
                ColorPrint.yellow(f"[reload] {kind}: {path}")
            trigger_path, trigger_kind = diffs[0]
            ColorPrint.yellow(
                f"[reload] {len(diffs)} change(s) -> restarting backend via os.execv"
            )
            THREAD_BUS.request_restart(
                reason=f"hot-reload: {trigger_path.name} {trigger_kind}",
                execute_handlers=True,
            )
            return  # restart in flight; this process image is about to be replaced

    return start_bus_task(_run, thread_name="DevReloadWatcher")
