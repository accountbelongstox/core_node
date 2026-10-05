# -*- coding: utf-8 -*-
"""A long-lived state-owner thread that drains one THREAD_BUS queue in batches.

Producers ``post`` from any thread and never wait; the owner takes everything
queued so far as one batch, so per-message overhead (wake-ups, bus round
trips, flushes) is paid once per burst instead of once per message.
"""

from __future__ import annotations

import threading
from typing import Any, Callable, List

from pycore.pyfoundations.thread_bus.bus import THREAD_BUS


class BatchOwnerThread(threading.Thread):
    """Run ``handler(batch)`` on this thread for each drained burst of messages."""

    def __init__(
        self,
        queue_name: str,
        thread_name: str,
        handler: Callable[[List[Any]], None],
        on_error: Callable[[BaseException], None],
        batch_max: int,
    ) -> None:
        super().__init__(name=thread_name, daemon=True)
        self._queue_name = queue_name
        self._handler = handler
        self._on_error = on_error
        self._batch_max = max(1, int(batch_max))

    def post(self, message: Any) -> None:
        THREAD_BUS.send_message(self._queue_name, message)

    def is_owner(self) -> bool:
        return threading.current_thread() is self

    def run(self) -> None:
        while True:
            batch = [THREAD_BUS.receive_message(self._queue_name, block=True)]
            while len(batch) < self._batch_max:
                message = THREAD_BUS.receive_message(self._queue_name)
                if message is None:
                    break
                batch.append(message)
            try:
                self._handler(batch)
            except Exception as exc:
                self._on_error(exc)


__all__ = ["BatchOwnerThread"]
