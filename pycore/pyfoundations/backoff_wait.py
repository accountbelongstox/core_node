# -*- coding: utf-8 -*-
"""Bounded exponential-backoff wait budget.

One BackoffWait instance owns one wait episode: exponential delay growth from
``initial_seconds`` to ``maximum_seconds``, bounded by a total wall-clock
``budget_seconds``. ``sleep()`` returns False once the budget is spent (or a
bus shutdown is requested), so retry loops terminate with a reportable
deadline instead of waiting forever.
"""

import time

from pycore.pyfoundations.thread_bus.bus import THREAD_BUS


class BackoffWait:
    """One bounded exponential-backoff wait episode."""

    def __init__(
        self,
        budget_seconds: float,
        initial_seconds: float,
        maximum_seconds: float,
    ) -> None:
        self.budget_seconds = max(0.0, float(budget_seconds))
        self.initial_seconds = max(0.05, float(initial_seconds))
        self.maximum_seconds = max(self.initial_seconds, float(maximum_seconds))
        self._started = time.monotonic()
        self._delay = self.initial_seconds

    @property
    def elapsed(self) -> float:
        """Wall-clock seconds since this wait episode started."""
        return time.monotonic() - self._started

    @property
    def expired(self) -> bool:
        return self.elapsed >= self.budget_seconds

    def sleep(self) -> bool:
        """Sleep one backoff step; False means stop waiting (budget spent)."""
        if self.expired or THREAD_BUS.is_shutdown_requested():
            return False
        time.sleep(min(self._delay, max(0.0, self.budget_seconds - self.elapsed)))
        self._delay = min(self.maximum_seconds, self._delay * 2.0)
        return True


__all__ = ["BackoffWait"]
