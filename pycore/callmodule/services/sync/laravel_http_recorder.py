# -*- coding: utf-8 -*-
"""
LaravelHttpRecorder - structured observer + bounded ring for every pycore->Laravel
HTTP request emitted by the unified ``LaravelClient`` (and the
``LaravelEndpointManager`` health probe).

DELIBERATELY has ZERO project-internal imports (stdlib only) so it can be imported
by BOTH ``laravel_client`` AND ``laravel_endpoint_manager`` without forming an import
cycle: ``laravel_client`` imports ``laravel_endpoint_manager`` (for base-URL
resolution); if this recorder lived inside ``laravel_client``, the endpoint manager
could not import it without cycling back into the client.

Mirrors the ColorPrint observer pattern: ``rpc_v2`` registers a callback here that
broadcasts each record as a ``laravel_http`` WS event to the dashboard HTTP debugger
panel (PcHttpDebugger). The ring buffer is a fallback snapshot store for any future
poll-style consumer.
"""
import threading
import time
from typing import Any, Callable, Dict, List, Optional

_RECORD_CAP = 500


class LaravelHttpRecorder:
    """Singleton observer registry + bounded ring for Laravel HTTP request records."""

    def __init__(self):
        self._lock = threading.Lock()
        self._records: List[Dict[str, Any]] = []
        self._callbacks: List[Callable[[Dict[str, Any]], None]] = []

    def register_callback(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        with self._lock:
            if callback not in self._callbacks:
                self._callbacks.append(callback)

    def unregister_callback(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        with self._lock:
            if callback in self._callbacks:
                self._callbacks.remove(callback)

    def clear_all_callbacks(self) -> None:
        with self._lock:
            self._callbacks.clear()

    def notify(self, record: Dict[str, Any]) -> None:
        """Append ``record`` to the ring and fan out to callbacks. Never raises."""
        if not isinstance(record, dict):
            return
        record.setdefault("ts", time.time())
        with self._lock:
            self._records.append(record)
            if len(self._records) > _RECORD_CAP:
                del self._records[: len(self._records) - _RECORD_CAP]
            callbacks = list(self._callbacks)
        for cb in callbacks:
            try:
                cb(record)
            except Exception:
                # A listener must never break the request path.
                pass

    def get_recent(self, limit: int = _RECORD_CAP) -> List[Dict[str, Any]]:
        with self._lock:
            if limit >= len(self._records):
                return list(self._records)
            return list(self._records[-limit:])

    def clear(self) -> None:
        with self._lock:
            self._records.clear()


_recorder = LaravelHttpRecorder()


def get_laravel_http_recorder() -> LaravelHttpRecorder:
    return _recorder


def register_laravel_http_callback(callback: Callable[[Dict[str, Any]], None]) -> None:
    _recorder.register_callback(callback)


def notify_laravel_http(record: Dict[str, Any]) -> None:
    _recorder.notify(record)


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
