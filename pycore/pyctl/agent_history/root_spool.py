# -*- coding: utf-8 -*-
"""
Worker-side reader of the agent history root spool (Linux only).

pyservice_entry.sh runs the worker as the desktop user (tray needs its D-Bus
session), so agent sources owned by root with mode 0600 (claudeteam / kimi1 /
kimi2 ... started as root) are unreadable to it. The launcher therefore keeps
this small root process next to the worker:

    python -m pycore.pyctl.agent_history.root_spool_main --worker-user <user> --parent-pid <pid>

Root side (``root_spool_main``): every AGENT_HISTORY_ROOT_SPOOL_INTERVAL_S it discovers
sources with the shared source registry, keeps ONLY root-owned regular
files the worker cannot read that stay inside the home they were found in (no
symlink / hard-link escape), parses them and writes the parsed sessions into
AGENT_HISTORY_ROOT_SPOOL_DIR (root:<worker gid>, 0750 / 0640). It exits when
the parent (the worker's sudo process) exits.

Worker side (``read_index`` / ``read_sessions``): the service overlays the
spooled sources onto its own discovery; extraction, live scan, prompt-new
events and the prompt archive then treat them like any other source.
"""

from __future__ import annotations

import json
import os
import stat
import sys
import time
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.agent_home_scanner import unreadable_user_homes
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.agent_paths import (
    AGENT_HISTORY_ROOT_SPOOL_DIR,
    AGENT_HISTORY_ROOT_SPOOL_STALE_S,
)

SPOOL_INDEX_FILE = "index.json"
SPOOL_LOCK_FILE = ".lock"
SPOOL_DIR_MODE = 0o750
SPOOL_FILE_MODE = 0o640


# --------------------------------------------------------------------------- #
# Worker side (read-only)
# --------------------------------------------------------------------------- #
def _trusted_spool_dir() -> Optional[str]:
    if sys.platform == "win32" or not os.path.lexists(AGENT_HISTORY_ROOT_SPOOL_DIR):
        return None
    try:
        st = os.lstat(AGENT_HISTORY_ROOT_SPOOL_DIR)
    except OSError as exc:
        ColorPrint.yellow(f"[AgentHistoryRootSpool] spool dir lstat failed path={AGENT_HISTORY_ROOT_SPOOL_DIR}: {exc}")
        return None
    if not stat.S_ISDIR(st.st_mode) or st.st_uid != 0:
        return None
    return AGENT_HISTORY_ROOT_SPOOL_DIR


def _read_json(path: str) -> Any:
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError) as exc:
        ColorPrint.yellow(f"[AgentHistoryRootSpool] spool read failed path={path}: {exc}")
        return None


def read_index() -> Dict[str, Any]:
    """{"updated_at", "sources": {path: {tool, user, home, mtime, bytes, file}}}; {} when absent."""
    spool = _trusted_spool_dir()
    if not spool:
        return {}
    data = _read_json(os.path.join(spool, SPOOL_INDEX_FILE))
    return data if isinstance(data, dict) else {}


def read_sources() -> Dict[str, Dict[str, Any]]:
    sources = read_index().get("sources")
    return sources if isinstance(sources, dict) else {}


def read_sessions(file_name: str) -> List[Dict[str, Any]]:
    spool = _trusted_spool_dir()
    if not spool or os.path.basename(file_name) != file_name:
        return []
    data = _read_json(os.path.join(spool, file_name))
    sessions = data.get("sessions") if isinstance(data, dict) else None
    return [s for s in sessions if isinstance(s, dict)] if isinstance(sessions, list) else []


def spool_status() -> Dict[str, Any]:
    index = read_index()
    updated_at = int(index.get("updated_at") or 0)
    sources = index.get("sources") if isinstance(index.get("sources"), dict) else {}
    return {
        "active": bool(updated_at) and time.time() - updated_at <= AGENT_HISTORY_ROOT_SPOOL_STALE_S,
        "updated_at": updated_at,
        "sources": len(sources),
        "homes": sorted({str(r.get("home") or "") for r in sources.values() if isinstance(r, dict)} - {""}),
        "worker_user": str(index.get("worker_user") or ""),
    }


def uncovered_unreadable_homes() -> List[str]:
    """Unreadable homes minus those an active root spool already covers."""
    unreadable = unreadable_user_homes()
    if not unreadable:
        return unreadable
    status = spool_status()
    if not status["active"]:
        return unreadable
    covered = {os.path.realpath(h) for h in status["homes"]}
    return [h for h in unreadable if os.path.realpath(h) not in covered]


__all__ = [
    "read_index",
    "read_sessions",
    "read_sources",
    "spool_status",
    "uncovered_unreadable_homes",
]

