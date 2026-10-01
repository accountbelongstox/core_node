# -*- coding: utf-8 -*-
"""RPC idempotency: a call carrying ``client_task_id`` runs once per route.

A repeated call joins the in-flight run or gets the cached result until the
TTL expires; a failed run is forgotten so the client may retry.
"""

from __future__ import annotations

import time
import uuid
from collections import OrderedDict
from typing import Any, Dict, Optional, Tuple

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

CLIENT_TASK_ID_PARAM = "client_task_id"
IDEMPOTENCY_TTL_SECONDS = 600.0
IDEMPOTENCY_MAX_ENTRIES = 1000
CLAIM_RUN = "run"
CLAIM_DONE = "done"
CLAIM_WAIT = "wait"


def idempotency_key(route_path: str, params: Dict[str, Any]) -> Optional[str]:
    client_task_id = str((params or {}).get(CLIENT_TASK_ID_PARAM) or "").strip()
    return f"{route_path}\x00{client_task_id}" if client_task_id else None


class RpcIdempotencyStore:
    """THREAD_BUS-owned table: key -> running signal or cached result."""

    def __init__(self) -> None:
        self._entries: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
        init_serialized_owner(self, "rpc.idempotency", "RpcIdempotencyStateThread")

    @serialized_method
    def claim(self, key: str) -> Tuple[str, Any]:
        """(run, None) for the first caller; (done, result) or (wait, signal) after."""
        self._prune()
        entry = self._entries.get(key)
        if entry is None:
            signal = f"rpc.idempotency.done.{uuid.uuid4().hex}"
            self._entries[key] = {"signal": signal, "done": False, "result": None, "expires": 0.0}
            return CLAIM_RUN, None
        if entry["done"]:
            return CLAIM_DONE, entry["result"]
        return CLAIM_WAIT, entry["signal"]

    @serialized_method
    def complete(self, key: str, result: Any) -> None:
        entry = self._entries.get(key)
        if entry is None:
            return
        entry.update({"done": True, "result": result, "expires": time.monotonic() + IDEMPOTENCY_TTL_SECONDS})
        self._entries.move_to_end(key)
        THREAD_BUS.signal(entry["signal"], True)

    @serialized_method
    def forget(self, key: str) -> None:
        entry = self._entries.pop(key, None)
        if entry is not None:
            THREAD_BUS.signal(entry["signal"], True)

    def _prune(self) -> None:
        now = time.monotonic()
        for key in [k for k, e in self._entries.items() if e["done"] and e["expires"] < now]:
            THREAD_BUS.clear_signal(self._entries.pop(key)["signal"])
        while len(self._entries) > IDEMPOTENCY_MAX_ENTRIES:
            oldest_key = next((k for k, e in self._entries.items() if e["done"]), None)
            if oldest_key is None:
                break
            THREAD_BUS.clear_signal(self._entries.pop(oldest_key)["signal"])


rpc_idempotency_store = RpcIdempotencyStore()


__all__ = [
    "CLAIM_DONE",
    "CLAIM_RUN",
    "CLAIM_WAIT",
    "CLIENT_TASK_ID_PARAM",
    "RpcIdempotencyStore",
    "idempotency_key",
    "rpc_idempotency_store",
]
