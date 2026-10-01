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


class Backoff:
    """Unbounded exponential delay sequence for reconnect/retry loops.

    ``next_delay()`` returns the current delay and doubles it up to the cap;
    ``reset()`` returns to the initial delay after a success.
    """

    def __init__(self, initial_seconds: float, maximum_seconds: float, factor: float = 2.0) -> None:
        self.initial_seconds = max(0.05, float(initial_seconds))
        self.maximum_seconds = max(self.initial_seconds, float(maximum_seconds))
        self.factor = max(1.0, float(factor))
        self._delay = self.initial_seconds
        self.failures = 0

    @property
    def current(self) -> float:
        return self._delay

    def next_delay(self) -> float:
        delay = self._delay
        self.failures += 1
        self._delay = min(self.maximum_seconds, self._delay * self.factor)
        return delay

    def reset(self) -> None:
        self._delay = self.initial_seconds
        self.failures = 0

    def delay_for(self, attempt: int) -> float:
        """Stateless delay after the ``attempt``-th consecutive failure (1-based),
        for persisted retry counters (e.g. durable outbox rows)."""
        exponent = max(0, min(int(attempt) - 1, 32))
        return min(self.maximum_seconds, self.initial_seconds * (self.factor ** exponent))

    def sleep(self) -> bool:
        """Sleep the next delay; False when a bus shutdown is requested."""
        if THREAD_BUS.is_shutdown_requested():
            return False
        time.sleep(self.next_delay())
        return not THREAD_BUS.is_shutdown_requested()


class BackoffWait:
    """One bounded exponential-backoff wait episode: a Backoff delay sequence
    capped by a total wall-clock budget."""

    def __init__(
        self,
        budget_seconds: float,
        initial_seconds: float,
        maximum_seconds: float,
    ) -> None:
        self.budget_seconds = max(0.0, float(budget_seconds))
        self._backoff = Backoff(initial_seconds, maximum_seconds)
        self.initial_seconds = self._backoff.initial_seconds
        self.maximum_seconds = self._backoff.maximum_seconds
        self._started = time.monotonic()

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
        time.sleep(min(self._backoff.next_delay(), max(0.0, self.budget_seconds - self.elapsed)))
        return True


__all__ = ["Backoff", "BackoffWait"]
