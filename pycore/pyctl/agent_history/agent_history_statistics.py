# -*- coding: utf-8 -*-
"""Revision-aware Agent History statistics snapshots."""

from __future__ import annotations

import calendar
import hashlib
import re
from typing import Any, Dict, List

import pycore.pyctl.agent_history.agent_history_txt as txt
from pycore.pyctl.agent_history.agent_history_fragments import (
    summarize_tool_fragments_many,
)
from pycore.pyctl.agent_history.snapshot_cache import (
    file_revision,
    read_index_catalog,
)
from pycore.pyutils.common.status_snapshot_cache import status_snapshot_cache


TOOL_SOURCE_REVISIONS_CACHE_KEY = "agent_history.tool_source_revisions"
TOOL_STATISTICS_CACHE_PREFIX = "agent_history.tool_statistics."
STORE_TIMESTAMP_RE = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$"
)


def valid_generated_at(value: Any) -> str:
    timestamp = str(value or "").strip()
    match = STORE_TIMESTAMP_RE.fullmatch(timestamp)
    if match is None:
        return ""
    year, month, day, hour, minute, second = [
        int(part) for part in match.groups()
    ]
    if year < 2000 or year > 2100 or month < 1 or month > 12:
        return ""
    if day < 1 or day > calendar.monthrange(year, month)[1]:
        return ""
    if hour > 23 or minute > 59 or second > 59:
        return ""
    return timestamp


class AgentHistoryStatistics:
    """Compute and cache counts at tool-source revision granularity."""

    def read(
        self,
        tool: str,
        after_ts: int = 0,
        after_fragment_id: str = "",
    ) -> Dict[str, Any]:
        key = str(tool or "").strip().lower()
        items = self.read_many(
            {
                key: {
                    "after_ts": int(after_ts or 0),
                    "after_fragment_id": str(after_fragment_id or ""),
                },
            }
        )
        return items[0] if items else {
            "tool": key,
            "sessions": 0,
            "history_records": 0,
            "content_records": 0,
            "processed": 0,
            "pending": 0,
            "prompts": 0,
            "replies": 0,
            "generated_at": "",
            "source_modified_ts": 0,
        }

    def read_many(
        self,
        cursors: Dict[str, Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        keys = [str(tool or "").strip().lower() for tool in cursors]
        keys = [tool for tool in keys if tool]
        normalized_cursors: Dict[str, Dict[str, Any]] = {}
        source_revisions = self.source_revisions()
        versions: Dict[str, str] = {}
        for tool in keys:
            cursor = cursors.get(tool) or {}
            normalized = {
                "after_ts": int(cursor.get("after_ts") or 0),
                "after_fragment_id": str(cursor.get("after_fragment_id") or ""),
                "backfill_target_ts": int(cursor.get("backfill_target_ts") or 0),
                "backfill_target_fragment_id": str(
                    cursor.get("backfill_target_fragment_id") or ""
                ),
                "live_after_ts": int(cursor.get("live_after_ts") or 0),
                "live_after_fragment_id": str(
                    cursor.get("live_after_fragment_id") or ""
                ),
                "lane_aware": bool(cursor.get("lane_aware")),
            }
            normalized_cursors[tool] = normalized
            source_revision = source_revisions.get(tool) or {}
            version_source = (
                f"{tool}|{source_revision.get('revision') or 'empty'}|"
                f"{normalized['after_ts']}|{normalized['after_fragment_id']}|"
                f"{normalized['backfill_target_ts']}|"
                f"{normalized['backfill_target_fragment_id']}|"
                f"{normalized['live_after_ts']}|"
                f"{normalized['live_after_fragment_id']}|"
                f"{int(normalized['lane_aware'])}"
            )
            versions[tool] = hashlib.md5(version_source.encode()).hexdigest()
        cache_keys = {
            tool: TOOL_STATISTICS_CACHE_PREFIX + tool
            for tool in keys
        }
        tools_by_cache_key = {
            cache_key: tool
            for tool, cache_key in cache_keys.items()
        }
        cache_versions = {
            cache_keys[tool]: versions[tool]
            for tool in keys
        }

        def load_missing(
            missing_cache_keys: List[str],
        ) -> Dict[str, Dict[str, Any]]:
            missing_tools = [
                tools_by_cache_key[cache_key]
                for cache_key in missing_cache_keys
            ]
            missing_cursors = {
                tool: normalized_cursors[tool]
                for tool in missing_tools
            }
            computed = self._compute_many(
                missing_cursors,
                source_revisions,
            )
            computed_by_tool = {
                str(item.get("tool") or ""): item
                for item in computed
            }
            return {
                cache_keys[tool]: computed_by_tool[tool]
                for tool in missing_tools
                if tool in computed_by_tool
            }

        cached_by_key = status_snapshot_cache.get_many(
            cache_versions,
            load_missing,
            ttl_seconds=float("inf"),
        )
        return [
            dict(cached_by_key[cache_keys[tool]])
            for tool in keys
            if cache_keys[tool] in cached_by_key
        ]

    def source_revisions(self) -> Dict[str, Dict[str, Any]]:
        state_path = txt.store_dir() / "state.txt"
        revision = file_revision(state_path)
        snapshot = status_snapshot_cache.get(
            TOOL_SOURCE_REVISIONS_CACHE_KEY,
            self._build_source_revisions,
            ttl_seconds=float("inf"),
            version=revision,
        )
        tools = snapshot.get("tools") or {}
        return tools if isinstance(tools, dict) else {}

    @staticmethod
    def _build_source_revisions() -> Dict[str, Any]:
        state = txt.read_state()
        sources = state.get("sources") or {}
        schema_revision = str(state.get("extractor_schema_revision") or "")
        parts_by_tool: Dict[str, List[str]] = {}
        modified_by_tool: Dict[str, int] = {}
        for source_path, raw_source in sources.items():
            if not isinstance(raw_source, dict):
                continue
            tool = str(raw_source.get("tool") or "").strip().lower()
            if not tool:
                continue
            modified = int(raw_source.get("mtime") or 0)
            session_ids = sorted(
                str(item) for item in raw_source.get("session_ids") or []
            )
            source_id = str(raw_source.get("source_id") or source_path)
            parts_by_tool.setdefault(tool, []).append(
                f"{source_id}|{modified}|{int(raw_source.get('bytes') or 0)}|"
                f"{','.join(session_ids)}|{schema_revision}"
            )
            modified_by_tool[tool] = max(
                modified_by_tool.get(tool, 0),
                modified,
            )
        tools: Dict[str, Dict[str, Any]] = {}
        for tool, parts in parts_by_tool.items():
            parts.sort()
            tools[tool] = {
                "revision": hashlib.md5("\n".join(parts).encode()).hexdigest(),
                "last_modified_ts": modified_by_tool.get(tool, 0),
                "source_count": len(parts),
            }
        return {"tools": tools}

    @staticmethod
    def _compute_many(
        cursors: Dict[str, Dict[str, Any]],
        source_revisions: Dict[str, Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        keys = list(cursors)
        index_snapshot = read_index_catalog()
        index = index_snapshot.get("data") or {}
        session_counts = {tool: 0 for tool in keys}
        for session in index.get("sessions") or []:
            if not isinstance(session, dict):
                continue
            session_tool = str(session.get("tool") or "").lower()
            if session_tool in session_counts:
                session_counts[session_tool] += 1
        counts_by_tool = summarize_tool_fragments_many(cursors)
        generated_at = valid_generated_at(index.get("generated_at"))
        results: List[Dict[str, Any]] = []
        for tool, counts in counts_by_tool.items():
            source_revision = source_revisions.get(tool) or {}
            results.append(
                {
                    "tool": tool,
                    "sessions": session_counts.get(tool, 0),
                    "history_records": counts["prompts"],
                    "content_records": counts["total"],
                    "processed": counts["processed"],
                    "pending": counts["pending"],
                    "prompts": counts["prompts"],
                    "replies": counts["replies"],
                    "generated_at": generated_at,
                    "source_modified_ts": int(
                        source_revision.get("last_modified_ts") or 0
                    ),
                }
            )
        return results


agent_history_statistics = AgentHistoryStatistics()


__all__ = ["agent_history_statistics", "valid_generated_at"]
