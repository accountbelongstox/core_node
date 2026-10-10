# -*- coding: utf-8 -*-
"""Server-error breaker of the delivery drains: after
``SERVER_ERROR_STREAK_THRESHOLD`` consecutive HTTP 5xx outcomes of one kind on
one server, that server's rows of the kind pause with an exponential Backoff
(other servers of a fan-out kind keep draining); a delivered row closes it."""

import time
from typing import Any, Dict, Tuple

from pycore.pyfoundations.backoff_wait import Backoff
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.laravel.delivery.model import (
    SERVER_ERROR_PAUSE_INITIAL_SECONDS,
    SERVER_ERROR_PAUSE_MAX_SECONDS,
    SERVER_ERROR_STREAK_THRESHOLD,
)


class DeliveryBreaker:
    def __init__(self) -> None:
        self._server_errors: Dict[Tuple[str, str], Dict[str, Any]] = {}
        init_serialized_owner(self, "laravel.delivery.breaker", "LaravelDeliveryBreakerState")

    @serialized_method
    def note(self, kind: str, namespace: str, server_error: bool) -> None:
        if not server_error:
            if self._server_errors.pop((kind, namespace), None):
                ColorPrint.green(
                    f"[LaravelDelivery] kind={kind} server={namespace} accepted a delivery - breaker closed"
                )
            return
        entry = self._server_errors.setdefault((kind, namespace), {
            "streak": 0,
            "paused_until": 0.0,
            "backoff": Backoff(SERVER_ERROR_PAUSE_INITIAL_SECONDS, SERVER_ERROR_PAUSE_MAX_SECONDS),
        })
        entry["streak"] += 1
        if entry["streak"] >= SERVER_ERROR_STREAK_THRESHOLD:
            delay = entry["backoff"].next_delay()
            entry["paused_until"] = time.monotonic() + delay
            ColorPrint.red(
                f"[LaravelDelivery] kind={kind} server={namespace} {entry['streak']} consecutive server errors"
                f" - its drain paused {delay:.0f}s"
            )

    @serialized_method
    def pause_seconds(self, kind: str, namespace: str) -> float:
        entry = self._server_errors.get((kind, namespace))
        return max(0.0, float(entry["paused_until"]) - time.monotonic()) if entry else 0.0


delivery_breaker = DeliveryBreaker()
