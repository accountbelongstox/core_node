# -*- coding: utf-8 -*-
"""Shared Python transport for Pycore-to-Laravel HTTP traffic.

Keep-alive connection pooling (SPECIAL OPTIMIZATION, 2026-09-06): the relay
agent, the audio workers, and the heartbeats all issue high-frequency Laravel
requests. Creating one throwaway ``requests.Session`` per call forced a full
TCP + TLS handshake on EVERY request (measured ~1.0s per relay claim against
the public coordinator), which was the dominant latency source of the whole
UI->Laravel->pycore relay path. Sessions are now cached per THREAD
(``threading.local``), preserving the original isolation guarantee ("no
mutable HTTP state crosses threads") while reusing pooled connections within
each worker/agent thread. Streamed responses no longer close their owning
session; the pooled connection returns to the thread's pool when the stream
is fully consumed or closed.
"""

import threading
from typing import Any, Dict, Tuple

from pycore.pyfoundations.third_party.api import get_third_package_requests

TRANSPORT_REQUESTS = "requests"

# urllib3 pool sizing per thread-session: pycore fans out bounded lanes
# (audio workers <= 8 lanes, relay agent 2-3 threads, RPC servers) and each
# thread owns ONE session, so a modest pool is sufficient; the adapter exists
# so keep-alive stays bounded instead of growing without limit.
_POOL_CONNECTIONS = 8
_POOL_MAXSIZE = 8

_THREAD_LOCAL = threading.local()


def _build_session() -> Any:
    """Create one keep-alive session (called once per thread, then reused)."""
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
    session = getattr(_THREAD_LOCAL, "laravel_session", None)
    if session is None:
        session = _build_session()
        _THREAD_LOCAL.laravel_session = session
    return session, {}, TRANSPORT_REQUESTS


def close_thread_laravel_session() -> None:
    """Drop and close the calling thread's pooled session (tests/shutdown)."""
    session = getattr(_THREAD_LOCAL, "laravel_session", None)
    if session is not None:
        try:
            session.close()
        except Exception:
            pass
        _THREAD_LOCAL.laravel_session = None


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
