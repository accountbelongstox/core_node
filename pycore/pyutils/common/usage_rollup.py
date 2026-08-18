# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Any, Dict, Iterable, List


class UsageRollup:
    """Shared source/day usage aggregation for JSON-backed usage stores."""

    @staticmethod
    def empty_stat() -> Dict[str, Any]:
        return {
            "calls": 0,
            "ok": 0,
            "failed": 0,
            "latency_total_ms": 0.0,
            "latency_count": 0,
        }

    def increment(self, stat: Dict[str, Any], entry: Dict[str, Any]) -> None:
        result_key = "ok" if bool(entry.get("success")) else "failed"
        latency = entry.get("latency_ms")
        stat["calls"] = int(stat.get("calls") or 0) + 1
        stat[result_key] = int(stat.get(result_key) or 0) + 1
        if isinstance(latency, (int, float)):
            stat["latency_total_ms"] = float(stat.get("latency_total_ms") or 0.0) + float(latency)
            stat["latency_count"] = int(stat.get("latency_count") or 0) + 1

    def update(self, rollups: Dict[str, Any], entry: Dict[str, Any]) -> None:
        source = str(entry.get("source") or "").strip()
        if not source:
            return
        day = str(entry.get("iso") or "")[:10]
        source_stat = rollups.setdefault(source, self.empty_stat())
        self.increment(source_stat, entry)
        source_stat["last_ts"] = entry.get("ts")
        source_stat["last_model"] = entry.get("model") or ""
        if day:
            days = source_stat.setdefault("days", {})
            self.increment(days.setdefault(day, self.empty_stat()), entry)

    def rebuild(self, entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        rollups: Dict[str, Any] = {}
        for entry in entries:
            if isinstance(entry, dict):
                self.update(rollups, entry)
        return rollups

    def summarize(
        self,
        rollups: Dict[str, Any],
        sources: Iterable[str],
        day: str = "",
    ) -> Dict[str, Any]:
        calls = 0
        succeeded = 0
        failed = 0
        latency_total = 0.0
        latency_count = 0
        for source in sources:
            source_stat = rollups.get(source) or {}
            stat = ((source_stat.get("days") or {}).get(day) or {}) if day else source_stat
            calls += int(stat.get("calls") or 0)
            succeeded += int(stat.get("ok") or 0)
            failed += int(stat.get("failed") or 0)
            latency_total += float(stat.get("latency_total_ms") or 0.0)
            latency_count += int(stat.get("latency_count") or 0)
        return {
            "requests": calls,
            "succeeded": succeeded,
            "failed": failed,
            "average_latency_ms": round(latency_total / latency_count, 1) if latency_count else None,
        }


usage_rollup = UsageRollup()

