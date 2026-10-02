# -*- coding: utf-8 -*-
"""Progress and liveness of relayed operations, keyed by operation id."""

from __future__ import annotations

import time
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.common.relay_contract import relay_contract


RELAY_PROGRESS_STATE_QUEUE = "relay.progress.state"
RELAY_PROGRESS_STATE_THREAD = "RelayProgressStateThread"
RELAY_PROGRESS_DEFAULT_PHASE = "running"

ProgressEmit = Callable[[str, Optional[int], Optional[int], Optional[int]], None]


class RelayProgress:
    """Registry of running relayed operations.

    Handlers call ``report`` with their own phase and counters; operations that
    stay silent still emit a heartbeat frame every minimum interval through
    ``due``, so a waiting client always sees liveness. Direct (non-relay)
    calls are never registered, so ``report`` is a no-op for them.
    """

    def __init__(self) -> None:
        init_serialized_owner(self, RELAY_PROGRESS_STATE_QUEUE, RELAY_PROGRESS_STATE_THREAD)
        self._active: Dict[str, Dict[str, Any]] = {}

    @serialized_method
    def begin(self, operation_id: str, emit: ProgressEmit) -> None:
        self._active[str(operation_id)] = {
            "emit": emit,
            "phase": RELAY_PROGRESS_DEFAULT_PHASE,
            "done": None,
            "total": None,
            "bytes": None,
            "last": time.monotonic(),
        }

    @serialized_method
    def end(self, operation_id: str) -> None:
        self._active.pop(str(operation_id), None)

    def report(
        self,
        operation_id: str,
        phase: str = RELAY_PROGRESS_DEFAULT_PHASE,
        done: Optional[int] = None,
        total: Optional[int] = None,
        byte_count: Optional[int] = None,
    ) -> None:
        emit = self._record(str(operation_id), str(phase), done, total, byte_count)
        if emit is not None:
            emit(str(phase), done, total, byte_count)

    @serialized_method
    def _record(
        self,
        operation_id: str,
        phase: str,
        done: Optional[int],
        total: Optional[int],
        byte_count: Optional[int],
    ) -> Optional[ProgressEmit]:
        """Store the latest state; the emit to call (outside the owner) when one is due."""
        state = self._active.get(operation_id)
        if state is None:
            return None
        state.update(phase=phase, done=done, total=total, bytes=byte_count)
        finished = done is not None and total is not None and done >= total
        if not finished and time.monotonic() - state["last"] < relay_contract.duration("progress_min_interval_seconds"):
            return None
        state["last"] = time.monotonic()
        return state["emit"]

    def emit_due(self) -> int:
        """Emit a heartbeat for every operation silent for a full interval."""
        due = self._take_due()
        for emit, phase, done, total, byte_count in due:
            emit(phase, done, total, byte_count)
        return len(due)

    @serialized_method
    def _take_due(self) -> List[Tuple[ProgressEmit, str, Optional[int], Optional[int], Optional[int]]]:
        interval = relay_contract.duration("progress_min_interval_seconds")
        now = time.monotonic()
        due = []
        for state in self._active.values():
            if now - state["last"] >= interval:
                state["last"] = now
                due.append((state["emit"], state["phase"], state["done"], state["total"], state["bytes"]))
        return due


relay_progress = RelayProgress()


__all__ = ["RELAY_PROGRESS_DEFAULT_PHASE", "RelayProgress", "relay_progress"]
