# -*- coding: utf-8 -*-
"""Read-only per-tool extract probe for the UI tool checkbox flow.

Parses the newest sources of one tool and returns its latest prompt (source
formats report and skip unreadable input themselves); never writes the txt
store and never touches extract state. Results are cached per tool source
revision.
"""

from __future__ import annotations

from typing import Any, Dict, List

from pycore.pyctl.agent_history.agent_history_records import newest_prompts_first
from pycore.pyctl.agent_history.agent_history_statistics import agent_history_statistics
from pycore.pyctl.agent_history.sources.source_registry import source_registry
from pycore.pyfoundations.agent_home_scanner import scan_user_homes
from pycore.pyutils.common.status_snapshot_cache import status_snapshot_cache

EXTRACT_PROBE_SOURCE_CAP = 25
EXTRACT_PROBE_MAX_BYTES = 16 * 1024 * 1024
EXTRACT_PROBE_TEXT_CAP = 500
TOOL_EXTRACT_PROBE_CACHE_PREFIX = "agent_history.extract_probe."


class ExtractProbe:
    def test_extract(self, tool: str) -> Dict[str, Any]:
        key = str(tool or "").strip().lower()
        source_revision = agent_history_statistics.source_revisions().get(key) or {}
        return status_snapshot_cache.get(
            TOOL_EXTRACT_PROBE_CACHE_PREFIX + key,
            lambda: self._probe(key),
            ttl_seconds=float("inf"),
            version=str(source_revision.get("revision") or "empty"),
        )

    @staticmethod
    def _sources(key: str) -> List[Dict[str, Any]]:
        by_path: Dict[str, Dict[str, Any]] = {}
        for home, user in scan_user_homes().items():
            for d in source_registry.discover(home, user, key):
                by_path[str(d.get("path") or "")] = {**d, "user": user}
        return sorted(by_path.values(), key=lambda d: float(d.get("mtime") or 0), reverse=True)

    def _probe(self, key: str) -> Dict[str, Any]:
        if not source_registry.has_tool(key):
            return {"ok": False, "tool": key, "error": "unknown tool", "sources": 0}
        sources = self._sources(key)
        if not sources:
            return {"ok": False, "tool": key, "error": "no history source found", "sources": 0}
        inline_sources = [s for s in sources if int(s.get("bytes") or 0) <= EXTRACT_PROBE_MAX_BYTES]
        if not inline_sources:
            return {
                "ok": False,
                "tool": key,
                "error": "history sources exceed the 16 MiB inline probe limit",
                "sources": len(sources),
            }
        for src in inline_sources[:EXTRACT_PROBE_SOURCE_CAP]:
            sessions = source_registry.parse(src["path"], src["user"], key, src["source"])
            prompts = [p for sess in sessions for p in sess.get("prompts") or [] if p.get("text")]
            if prompts:
                latest = newest_prompts_first(prompts)[0]
                return {
                    "ok": True,
                    "tool": key,
                    "sources": len(sources),
                    "prompt": {
                        "ts": int(latest.get("ts") or 0),
                        "text": str(latest.get("text") or "")[:EXTRACT_PROBE_TEXT_CAP],
                    },
                }
        return {"ok": True, "empty": True, "tool": key, "sources": len(sources)}


extract_probe = ExtractProbe()


__all__ = ["extract_probe"]
