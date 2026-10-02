# -*- coding: utf-8 -*-
"""Server-side pause of one Laravel server (contract ``schema_gate``).

A Laravel whose schema is behind its code answers every work-lease, report,
delivery and typed-task route with ``http_status`` / ``error_code``, and the
same server answers repeated HTTP 5xx while it is half migrated. Both mean
"the server cannot take work": the node claims nothing, its outbox drains wait
and finished results stay durable, for ``retry_after_seconds``. Nothing counts
as a failure or an attempt of an item. The first answer after the pause is the
probe; an accepted answer clears the streak, and the online edge event
reconciles the server again.
"""

import time
from typing import Any, Dict, List, Mapping

from pycore.pyfoundations.backoff_wait import Backoff
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.queue_center_contract import QUEUE_CENTER_SCHEMA_GATE, lane_state_code
from pycore.pyutils.laravel.endpoint_manager import (
    LARAVEL_ONLINE_EVENT,
    laravel_endpoint_manager,
)

SCHEMA_PENDING_CODE = str(QUEUE_CENTER_SCHEMA_GATE["error_code"])
SCHEMA_PENDING_STATUS = int(QUEUE_CENTER_SCHEMA_GATE["http_status"])
SCHEMA_PAUSE_SECONDS = float(QUEUE_CENTER_SCHEMA_GATE["retry_after_seconds"])
ASSIST_BLOCK_SERVER_SCHEMA_PENDING = lane_state_code("assist_reason_codes", SCHEMA_PENDING_CODE)
# Consecutive 5xx answers of the gated routes that mean the same pause.
SERVER_ERROR_STREAK_THRESHOLD = 3
SCHEMA_PAUSE_MAX_SECONDS = 2.0 * SCHEMA_PAUSE_SECONDS
RESUMED_REASON = "schema_resumed"
RETRY_AFTER_HEADER = "Retry-After"


def _retry_after_seconds(headers: Mapping[str, Any], body: Mapping[str, Any]) -> float:
    """Pause the server asked for (header, then body), else the contract default."""
    data = body.get("data") if isinstance(body.get("data"), dict) else {}
    for value in (headers.get(RETRY_AFTER_HEADER), body.get("retry_after_seconds"), data.get("retry_after_seconds")):
        text = str(value or "").strip()
        if text.isdigit() and int(text) > 0:
            return float(text)
    return SCHEMA_PAUSE_SECONDS


class ServerSchemaGate:
    """Per server namespace pause state on a THREAD_BUS owner (written by
    every request thread, read by claims and drains)."""

    def __init__(self) -> None:
        self._servers: Dict[str, Dict[str, Any]] = {}
        init_serialized_owner(self, "laravel.server_schema_gate", "LaravelServerSchemaGateState")

    @serialized_method
    def observe(
        self, namespace: str, status_code: int, headers: Mapping[str, Any], body: Mapping[str, Any],
    ) -> None:
        """One answer of a gated route. ``body`` is only read for the gate status."""
        entry = self._servers.setdefault(namespace, {
            "streak": 0, "paused_until": 0.0, "resume_pending": False, "last_error_at": 0.0,
            "backoff": Backoff(SCHEMA_PAUSE_SECONDS, SCHEMA_PAUSE_MAX_SECONDS),
        })
        if status_code >= 500:
            entry["last_error_at"] = time.time()
        if status_code == SCHEMA_PENDING_STATUS and str(body.get("error_code") or "") == SCHEMA_PENDING_CODE:
            self._pause(namespace, entry, _retry_after_seconds(headers, body), SCHEMA_PENDING_CODE)
            return
        if status_code < 500:
            entry["streak"] = 0
            entry["backoff"].reset()
            return
        entry["streak"] += 1
        if entry["streak"] >= SERVER_ERROR_STREAK_THRESHOLD:
            self._pause(namespace, entry, _retry_after_seconds(headers, body), f"{entry['streak']}x HTTP 5xx")

    @staticmethod
    def _pause(namespace: str, entry: Dict[str, Any], seconds: float, cause: str) -> None:
        """A probe that fails again lengthens the pause (up to
        ``SCHEMA_PAUSE_MAX_SECONDS``); an accepted answer resets it."""
        now = time.monotonic()
        if entry["paused_until"] <= now:
            seconds = max(seconds, entry["backoff"].next_delay())
            ColorPrint.red(
                f"[ServerSchemaGate] {namespace}: {SCHEMA_PENDING_CODE} ({cause}); claims and "
                f"delivery paused {seconds:.0f}s, results stay in the outbox"
            )
        entry["paused_until"] = max(float(entry["paused_until"]), now + seconds)
        entry["resume_pending"] = True
        entry["streak"] = 0

    @serialized_method
    def server_error_since(self, namespace: str, since: float) -> bool:
        """True when a gated route of that server answered 5xx after the
        wall-clock time ``since`` (a failed attempt that started then was the
        server's failure, never the item's)."""
        entry = self._servers.get(namespace)
        return entry is not None and float(entry["last_error_at"]) >= float(since)

    @serialized_method
    def paused_seconds(self, namespace: str) -> float:
        """Seconds left of the pause of one server namespace (0 = open). The
        first read after an expired pause raises the online edge of that
        server, so its delivery reconciles again."""
        entry = self._servers.get(namespace)
        if entry is None:
            return 0.0
        remaining = float(entry["paused_until"]) - time.monotonic()
        if remaining > 0:
            return remaining
        if entry["resume_pending"]:
            entry["resume_pending"] = False
            ColorPrint.green(f"[ServerSchemaGate] {namespace}: pause over; probing the server again")
            THREAD_BUS.trigger_event(LARAVEL_ONLINE_EVENT, {
                "at": time.time(), "base_url": "", "namespace": namespace,
                "previous_namespace": "", "server_id": "", "reason": RESUMED_REASON,
            }, async_mode=True)
        return 0.0

    def paused_for(self, base_url: str) -> float:
        """``paused_seconds`` of the server one endpoint URL belongs to."""
        return self.paused_seconds(laravel_endpoint_manager.delivery_namespace(base_url))

    def paused_for_any(self, namespaces: List[str]) -> float:
        return max((self.paused_seconds(namespace) for namespace in namespaces), default=0.0)


server_schema_gate = ServerSchemaGate()


__all__ = [
    "ASSIST_BLOCK_SERVER_SCHEMA_PENDING",
    "SCHEMA_PENDING_CODE",
    "SERVER_ERROR_STREAK_THRESHOLD",
    "ServerSchemaGate",
    "server_schema_gate",
]
