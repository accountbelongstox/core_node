# -*- coding: utf-8 -*-

import threading
from typing import Any, Dict, Tuple

from pycore.pyfoundations.third_party.api import get_third_package_httpx, get_third_package_requests
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method

TRANSPORT_REQUESTS = "requests"
TRANSPORT_HTTPX = "httpx"

# urllib3 pool sizing per thread-session: pycore fans out bounded lanes
# (audio workers <= 8 lanes, relay agent 2-3 threads, RPC servers) and each
# thread owns ONE session, so a modest pool is sufficient; the adapter exists
# so keep-alive stays bounded instead of growing without limit.
_POOL_CONNECTIONS = 8
_POOL_MAXSIZE = 8

class LaravelHttpSessions:
    def __init__(self) -> None:
        init_serialized_owner(self, "laravel.http.sessions", "LaravelHttpSessionsThread")
        self._sessions = {}

    @serialized_method
    def acquire(self, owner: Any, transport: str = TRANSPORT_REQUESTS) -> Any:
        retired = [key for key in self._sessions if not key[0].is_alive()]
        for key in retired:
            self._sessions.pop(key).close()
        key = (owner, transport)
        if key not in self._sessions:
            self._sessions[key] = _build_session(transport)
        return self._sessions[key]

    @serialized_method
    def release(self, owner: Any) -> None:
        for key in [key for key in self._sessions if key[0] is owner]:
            self._sessions.pop(key).close()


laravel_http_sessions = LaravelHttpSessions()


def _build_session(transport: str = TRANSPORT_REQUESTS) -> Any:
    """Create one keep-alive session (called once per thread, then reused)."""
    if transport == TRANSPORT_HTTPX:
        httpx = get_third_package_httpx()
        return httpx.Client(limits=httpx.Limits(
            max_connections=_POOL_MAXSIZE,
            max_keepalive_connections=_POOL_CONNECTIONS,
        ))
    requests = get_third_package_requests()
    session = requests.Session()
    adapter = requests.adapters.HTTPAdapter(
        pool_connections=_POOL_CONNECTIONS,
        pool_maxsize=_POOL_MAXSIZE,
    )
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def create_laravel_http_session() -> Tuple[Any, Dict[str, Any], str]:
    """Return the CALLING THREAD's shared Laravel session (keep-alive).

    The first call on a thread creates and mounts the pooled session; later
    calls on the same thread reuse it, so consecutive requests reuse pooled
    TCP/TLS connections instead of re-handshaking. Never close the returned
    session — it stays pooled for the thread's lifetime.
    """
    session = laravel_http_sessions.acquire(threading.current_thread())
    return session, {}, TRANSPORT_REQUESTS


def close_thread_laravel_session() -> None:
    """Drop and close the calling thread's pooled session (tests/shutdown)."""
    laravel_http_sessions.release(threading.current_thread())


def create_progress_http_session() -> Any:
    return laravel_http_sessions.acquire(threading.current_thread(), TRANSPORT_HTTPX)


def response_http_version(response: Any) -> str:
    """Normalize a transport-specific response protocol value for diagnostics."""
    value = getattr(response, "http_version", None)
    if value is not None:
        name = getattr(value, "name", None)
        normalized = str(name or value)
        return {
            "10": "HTTP/1.0",
            "11": "HTTP/1.1",
            "20": "HTTP/2",
            "30": "HTTP/3",
            "V1_0": "HTTP/1.0",
            "V1_1": "HTTP/1.1",
            "V2_0": "HTTP/2",
            "V3": "HTTP/3",
        }.get(normalized, normalized)
    raw = getattr(response, "raw", None)
    version = getattr(raw, "version", None)
    return {10: "HTTP/1.0", 11: "HTTP/1.1", 20: "HTTP/2"}.get(version, "")
