# -*- coding: utf-8 -*-
"""Source discovery across the scan-center homes plus the root spool overlay.

A source record is ``{source_id, mtime, bytes, tool, source, format, user}``
(+ ``spool`` for sources only the root spool can read, whose parsed sessions
are read from the spool instead of parsing the file).
"""

from __future__ import annotations

import hashlib
import os
from typing import Any, Dict, List

import pycore.pyctl.agent_history.agent_history_txt as txt
import pycore.pyctl.agent_history.root_spool as root_spool
from pycore.pyctl.agent_history.agent_history_records import source_id
from pycore.pyctl.agent_history.sources.source_registry import source_registry
from pycore.pyfoundations.agent_home_scanner import scan_user_homes
from pycore.pyfoundations.agent_paths import AGENT_HISTORY_OFFICIAL_HOME_MARKERS


def descriptor_key(mtime: Any, nbytes: Any) -> str:
    return f"{int(mtime or 0)}:{int(nbytes or 0)}"


def scan_sources() -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    for home, user in scan_user_homes().items():
        for d in source_registry.discover_all(home, user):
            out[d["path"]] = {
                "source_id": source_id(d["path"]),
                "mtime": d["mtime"],
                "bytes": d["bytes"],
                "tool": d["tool"],
                "source": d["source"],
                "format": d["format"],
                "user": user,
            }
    for path, rec in root_spool.read_sources().items():
        tool = str(rec.get("tool") or "")
        if not source_registry.has_tool(tool):
            continue
        out[path] = {
            "source_id": source_id(path),
            "mtime": int(rec.get("mtime") or 0),
            "bytes": int(rec.get("bytes") or 0),
            "tool": tool,
            "source": int(rec.get("source") or 0),
            "format": str(rec.get("format") or ""),
            "user": str(rec.get("user") or ""),
            "spool": str(rec.get("file") or ""),
        }
    return out


def parse_source(path: str, info: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Own parse, or the root spool's parse for sources this process cannot read."""
    if info.get("spool"):
        return root_spool.read_sessions(info["spool"])
    return source_registry.parse(path, info["user"], info["tool"], info["source"])


def signature(sources: Dict[str, Dict[str, Any]]) -> str:
    parts = sorted(
        f"{i.get('source_id') or source_id(p)}:{i['mtime']}:{i['bytes']}"
        for p, i in sources.items()
    )
    return hashlib.md5("|".join(parts).encode()).hexdigest()


def live_scan_homes(tools: List[str]) -> Dict[str, str]:
    """Scan-center homes plus official env-override roots per tool."""
    homes = scan_user_homes()
    for tool in tools:
        spec = AGENT_HISTORY_OFFICIAL_HOME_MARKERS.get(tool) or {}
        env_key = str(spec.get("env") or "")
        env_value = os.environ.get(env_key, "").strip() if env_key else ""
        if env_value and os.path.isabs(env_value):
            parent = os.path.dirname(env_value.rstrip("/\\"))
            if parent and os.path.isdir(parent) and parent not in homes:
                homes[parent] = os.path.basename(parent)
    return homes


def tool_descriptors(tool: str, homes: Dict[str, str], spooled: Dict[str, Dict[str, Any]]) -> Dict[str, str]:
    """``path -> mtime:bytes`` of one tool's current sources (own + spooled)."""
    descriptors: Dict[str, str] = {}
    for home, user in homes.items():
        for d in source_registry.discover(home, user, tool):
            descriptors[str(d.get("path") or "")] = descriptor_key(d.get("mtime"), d.get("bytes"))
    for path, rec in spooled.items():
        if rec.get("tool") == tool:
            descriptors[path] = descriptor_key(rec.get("mtime"), rec.get("bytes"))
    return descriptors


def state_tool_descriptors(tool: str) -> Dict[str, str]:
    """Rebuild one tool's source descriptors from the persisted extract state."""
    state = txt.read_state()
    sources = state.get("sources") if isinstance(state.get("sources"), dict) else {}
    return {
        str(path): descriptor_key(info.get("mtime"), info.get("bytes"))
        for path, info in sources.items()
        if isinstance(info, dict) and str(info.get("tool") or "") == tool
    }


__all__ = [
    "descriptor_key",
    "live_scan_homes",
    "parse_source",
    "scan_sources",
    "signature",
    "state_tool_descriptors",
    "tool_descriptors",
]
