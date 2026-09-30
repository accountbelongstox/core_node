# -*- coding: utf-8 -*-
"""UI presence leases held by open event sockets.

Holders are mutated only on the HTTP server event loop; the per-lease holder
count is published on THREAD_BUS so heartbeat threads read it lock-free. A
lease ends the moment its socket closes, so no renewal polling is needed.
"""

from __future__ import annotations

from typing import Dict, Iterable, Set

from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

WS_LEASE_SIGNAL_PREFIX = "rpc_v2.ws.lease."


class WsLeaseRegistry:
    """Reference-counted presence leases keyed by lease name."""

    def __init__(self) -> None:
        self._holders: Dict[str, Set[str]] = {}

    def hold(self, name: str, session_id: str) -> None:
        holders = self._holders.setdefault(name, set())
        if session_id in holders:
            return
        holders.add(session_id)
        self._publish(name)

    def release(self, name: str, session_id: str) -> None:
        holders = self._holders.get(name)
        if not holders or session_id not in holders:
            return
        holders.discard(session_id)
        if not holders:
            self._holders.pop(name, None)
        self._publish(name)

    def release_all(self, session_id: str, names: Iterable[str]) -> None:
        for name in tuple(names):
            self.release(name, session_id)

    @staticmethod
    def is_held(name: str) -> bool:
        return int(THREAD_BUS.get_signal(f"{WS_LEASE_SIGNAL_PREFIX}{name}", 0) or 0) > 0

    def _publish(self, name: str) -> None:
        THREAD_BUS.signal(
            f"{WS_LEASE_SIGNAL_PREFIX}{name}",
            len(self._holders.get(name) or ()),
        )


ws_lease_registry = WsLeaseRegistry()

__all__ = ["WsLeaseRegistry", "ws_lease_registry"]
