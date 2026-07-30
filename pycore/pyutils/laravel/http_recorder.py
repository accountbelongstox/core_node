# -*- coding: utf-8 -*-
"""
Shared Laravel HTTP observer and bounded ring for every pycore-to-Laravel
HTTP request emitted by the unified ``LaravelClient`` (and the
``LaravelEndpointManager`` health probe).

Depends only on ``pyfoundations`` so both the client and endpoint manager can
import it without a callmodule cycle.

Mirrors the ColorPrint observer pattern: ``rpc_v2`` registers a callback here that
publishes each record as a ``laravel_http`` HTTP event to the dashboard debugger
panel (PcHttpDebugger). The ring buffer is a fallback snapshot store for any future
poll-style consumer.
"""
import time
from collections import deque
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method

_RECORD_CAP = 500


class LaravelHttpRecorder:
    """Singleton observer registry + bounded ring for Laravel HTTP request records.

    All registry and ring mutations run on one THREAD_BUS-backed state owner.
    """

    def __init__(self):
        self._records: deque = deque(maxlen=_RECORD_CAP)
        self._callbacks: List[Callable[[Dict[str, Any]], None]] = []
        init_serialized_owner(self, "laravel_http_recorder.state", "LaravelHttpRecorderState")

    @serialized_method
    def register_callback(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        if callback not in self._callbacks:
            self._callbacks.append(callback)

    @serialized_method
    def unregister_callback(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        try:
            self._callbacks.remove(callback)
        except ValueError:
            pass

    @serialized_method
    def clear_all_callbacks(self) -> None:
        self._callbacks = []

    @serialized_method
    def notify(self, record: Dict[str, Any]) -> None:
        """Append ``record`` to the ring and fan out to callbacks. Never raises."""
        if not isinstance(record, dict):
            return
        stored = dict(record)
        stored.setdefault("ts", time.time())
        self._records.append(stored)
        callbacks = list(self._callbacks)
        for cb in callbacks:
            try:
                cb(dict(stored))
            except Exception:
                # A listener must never break the request path.
                pass

    @serialized_method
    def get_recent(self, limit: int = _RECORD_CAP) -> List[Dict[str, Any]]:
        records = [dict(record) for record in self._records]
        if limit >= len(records):
            return records
        return records[-limit:]

    @serialized_method
    def clear(self) -> None:
        self._records = deque(maxlen=_RECORD_CAP)


laravel_http_recorder = LaravelHttpRecorder()


def make_record(method: str, url: str, path: str, params_summary: str = "",
                status: int = 0, ms: float = 0.0, error: Optional[str] = None,
                base_url: Optional[str] = None) -> Dict[str, Any]:
    """Build a uniform record dict for callers that emit without the client (e.g. the probe)."""
    return {
        "ts": time.time(),
        "method": method,
        "url": url,
        "path": path,
        "params_summary": params_summary,
        "status": int(status) if status is not None else 0,
        "ms": round(float(ms), 1),
        "error": error,
        "base_url": base_url,
    }
