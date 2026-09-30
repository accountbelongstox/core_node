# -*- coding: utf-8 -*-
"""UI presence leases shared by event sockets and HTTP renewals.

Socket holders are mutated only on the HTTP server event loop and end when
their socket closes; HTTP holders renew a deadline from any thread. Both sides
publish on THREAD_BUS, so owners on any thread read presence lock-free.
"""

from __future__ import annotations

import time
from typing import Dict, Iterable, Set

from pycore.pyfoundations.network_constants import UI_PRESENCE_LEASE_SECONDS
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

UI_PRESENCE_SIGNAL_PREFIX = "rpc_v2.ui_presence."
_SOCKETS_SUFFIX = ".sockets"
_DEADLINE_SUFFIX = ".until"


class UiPresenceRegistry:
    """Presence per lease name: open sockets plus one renewable HTTP deadline."""

    def __init__(self) -> None:
        self._socket_holders: Dict[str, Set[str]] = {}

    def hold_socket(self, name: str, session_id: str) -> None:
        holders = self._socket_holders.setdefault(name, set())
        if session_id in holders:
            return
        holders.add(session_id)
        self._publish_sockets(name)

    def release_socket(self, name: str, session_id: str) -> None:
        holders = self._socket_holders.get(name)
        if not holders or session_id not in holders:
            return
        holders.discard(session_id)
        if not holders:
            self._socket_holders.pop(name, None)
        self._publish_sockets(name)

    def release_sockets(self, session_id: str, names: Iterable[str]) -> None:
        for name in tuple(names):
            self.release_socket(name, session_id)

    @staticmethod
    def renew(name: str, lease_seconds: float = UI_PRESENCE_LEASE_SECONDS) -> float:
        deadline = time.monotonic() + max(0.0, float(lease_seconds))
        THREAD_BUS.signal(f"{UI_PRESENCE_SIGNAL_PREFIX}{name}{_DEADLINE_SUFFIX}", deadline)
        return deadline

    @staticmethod
    def expire(name: str) -> None:
        THREAD_BUS.signal(f"{UI_PRESENCE_SIGNAL_PREFIX}{name}{_DEADLINE_SUFFIX}", 0.0)

    @staticmethod
    def remaining(name: str) -> float:
        deadline = float(THREAD_BUS.get_signal(f"{UI_PRESENCE_SIGNAL_PREFIX}{name}{_DEADLINE_SUFFIX}", 0.0) or 0.0)
        return max(0.0, deadline - time.monotonic())

    @staticmethod
    def socket_count(name: str) -> int:
        return int(THREAD_BUS.get_signal(f"{UI_PRESENCE_SIGNAL_PREFIX}{name}{_SOCKETS_SUFFIX}", 0) or 0)

    def is_present(self, name: str) -> bool:
        return self.socket_count(name) > 0 or self.remaining(name) > 0.0

    def _publish_sockets(self, name: str) -> None:
        THREAD_BUS.signal(
            f"{UI_PRESENCE_SIGNAL_PREFIX}{name}{_SOCKETS_SUFFIX}",
            len(self._socket_holders.get(name) or ()),
        )


ui_presence = UiPresenceRegistry()

__all__ = ["UiPresenceRegistry", "ui_presence"]
