# -*- coding: utf-8 -*-
"""Background Terminal snapshot collector serving the last-known state."""

from __future__ import annotations

import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyctl.terminal.terminal_activity_log import terminal_activity_log
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS


TERMINAL_COLLECT_INTERVAL_SECONDS = 1.0
TERMINAL_SNAPSHOT_WAKE_AGE_SECONDS = 2.5
TERMINAL_SNAPSHOT_MAX_AGE_SECONDS = 30.0
TERMINAL_PUBLISH_MIN_INTERVAL_SECONDS = 2.0
TERMINAL_RENEW_INTERVAL_SECONDS = 5.0
TERMINAL_RENEWAL_RETENTION_SECONDS = 60.0
COLLECTOR_WAKE_SIGNAL = "terminal.snapshot.collector.wake"


class TerminalSnapshotCollectorThread(threading.Thread):
    """Collect while a viewer holds a demand lease; sleep until woken otherwise."""

    def __init__(self, collector: "TerminalSnapshotCollector") -> None:
        super().__init__(name="TerminalSnapshotCollectorThread", daemon=True)
        self._collector = collector

    def run(self) -> None:
        while True:
            THREAD_BUS.clear_signal(COLLECTOR_WAKE_SIGNAL)
            demanded = self._collector.demanded()
            if demanded:
                # One failing pass (window enumeration, state store) must be
                # reported and retried; it must never end the collector.
                try:
                    self._collector.collect()
                except Exception as error:  # noqa: BLE001
                    terminal_activity_log.error(
                        "snapshot.collect.failed",
                        error_type=type(error).__name__,
                        error=error,
                    )
            THREAD_BUS.wait_signal(
                COLLECTOR_WAKE_SIGNAL,
                timeout=TERMINAL_COLLECT_INTERVAL_SECONDS if demanded else None,
            )


class TerminalSnapshotCollector:
    """Keep the newest snapshot off the request path and announce changes.

    The heavy work (window enumeration, state reconciliation, capture
    planning) runs on the collector thread, so a request reads the stored
    snapshot in one owner hop and never waits for a pass. Only a request that
    finds no snapshot, or one older than the hard age limit (collector idle
    since the last viewer, or failing), collects once itself. Decorators
    (schedule runtime) are applied by the collector, not per request.
    """

    def __init__(
        self,
        collect: Callable[[], Dict[str, Any]],
        has_demand: Callable[[], bool],
        publish: Callable[[Dict[str, Any]], None],
        finalize: Callable[[Dict[str, Any]], Dict[str, Any]],
    ) -> None:
        self._collect = collect
        self._has_demand = has_demand
        self._publish = publish
        self._finalize = finalize
        self._decorators: List[Callable[[Dict[str, Any]], Dict[str, Any]]] = []
        self._renewals: Dict[str, Tuple[Tuple[str, ...], float]] = {}
        self._latest: Optional[Dict[str, Any]] = None
        self._collected_at = 0.0
        self._published_revision = ""
        self._published_at = 0.0
        init_serialized_owner(
            self,
            "terminal.snapshot.cache",
            "TerminalSnapshotCache",
        )
        self._thread = TerminalSnapshotCollectorThread(self)
        self._thread.start()

    def demanded(self) -> bool:
        return self._has_demand()

    def wake(self) -> None:
        THREAD_BUS.signal(COLLECTOR_WAKE_SIGNAL, True)

    def register_decorator(
        self,
        decorate: Callable[[Dict[str, Any]], Dict[str, Any]],
    ) -> None:
        self._add_decorator(decorate)

    def collect(self) -> Dict[str, Any]:
        snapshot = self._collect()
        for decorate in self._decorators_now():
            snapshot = decorate(snapshot)
        snapshot = self._finalize(snapshot)
        if self._store(snapshot, time.monotonic()):
            self._publish(snapshot)
        return snapshot

    def read(
        self,
        viewer_id: str,
        window_ids: Tuple[str, ...],
    ) -> Tuple[Optional[Dict[str, Any]], float, bool]:
        """Stored snapshot, its collection time, and whether the viewer's
        demand lease is due for renewal (first call, changed windows, or the
        renewal interval elapsed)."""
        return self._load(viewer_id, window_ids)

    def mark_renewed(self, viewer_id: str, window_ids: Tuple[str, ...]) -> None:
        self._record_renewal(viewer_id, window_ids)

    def serve(
        self,
        snapshot: Optional[Dict[str, Any]],
        collected_at: float,
    ) -> Dict[str, Any]:
        age = time.monotonic() - collected_at
        if age > TERMINAL_SNAPSHOT_WAKE_AGE_SECONDS:
            self.wake()
        if snapshot is not None and age <= TERMINAL_SNAPSHOT_MAX_AGE_SECONDS:
            return snapshot
        return self.collect()

    @serialized_method
    def _add_decorator(
        self,
        decorate: Callable[[Dict[str, Any]], Dict[str, Any]],
    ) -> None:
        self._decorators.append(decorate)

    @serialized_method
    def _decorators_now(
        self,
    ) -> Tuple[Callable[[Dict[str, Any]], Dict[str, Any]], ...]:
        return tuple(self._decorators)

    @serialized_method
    def _store(self, snapshot: Dict[str, Any], collected_at: float) -> bool:
        self._latest = snapshot
        self._collected_at = collected_at
        revision = str(snapshot.get("state_revision") or "")
        due = (
            revision != self._published_revision
            and collected_at - self._published_at
            >= TERMINAL_PUBLISH_MIN_INTERVAL_SECONDS
        )
        if due:
            self._published_revision = revision
            self._published_at = collected_at
        return due

    @serialized_method
    def _load(
        self,
        viewer_id: str,
        window_ids: Tuple[str, ...],
    ) -> Tuple[Optional[Dict[str, Any]], float, bool]:
        renewed = self._renewals.get(viewer_id)
        due = bool(viewer_id) and (
            renewed is None
            or renewed[0] != window_ids
            or time.monotonic() - renewed[1] >= TERMINAL_RENEW_INTERVAL_SECONDS
        )
        return self._latest, self._collected_at, due

    @serialized_method
    def _record_renewal(
        self,
        viewer_id: str,
        window_ids: Tuple[str, ...],
    ) -> None:
        now = time.monotonic()
        self._renewals = {
            viewer: renewal
            for viewer, renewal in self._renewals.items()
            if now - renewal[1] < TERMINAL_RENEWAL_RETENTION_SECONDS
        }
        self._renewals[viewer_id] = (window_ids, now)


__all__ = ["TerminalSnapshotCollector"]
