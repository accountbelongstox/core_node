# -*- coding: utf-8 -*-
"""
Local HTTP RPC — bridge that lets the dashboard reach the pycore HTTP routes over
the WS bus. Requests ride WS; the backend dispatches them NATIVELY in-process by
driving the running FastAPI ASGI app with a hand-built scope — no HTTP client, no
loopback socket, no 2nd request to the server's own port. Same event loop as the
WS handler, so it can never self-saturate the worker pool (the loopback-socket
design deadlocked under the WS-primary FE and timed out every call).

Routes:
  local_http.get     { path, timeout_s? }
  local_http.post    { path, body, timeout_s? }
  local_http.delete  { path, timeout_s? }
  local_http.blob    { path, timeout_s? }  -> { base64, mime, bytes } for media

Only paths under allowed prefixes are permitted. The `requests` loopback remains
ONLY as a fallback when the app instance is not available.
"""

import asyncio
import base64
import json
import os
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests

# Pycore's own HTTP route families. The WS bridge dispatches ONLY into the running
# pycore app (in-process), so every path the FE legitimately calls must be listed —
# a WS-primary FE routes ALL of these over the bridge. /api/ covers /api/local/ +
# /api/manage/*; /code-sync/ is the peer-mesh surface (was the 'path not allowed'
# regression when the transport flipped to WS-primary).
_ALLOWED_PREFIXES: Tuple[str, ...] = (
    "/api/",
    "/code-sync/",
    "/voice-subtitle/",
    "/ping",
)
_DEFAULT_TIMEOUT = 5.0
_LIVE_TEST_TIMEOUT = 600.0
_LIVE_TEST_PREFIX = "/api/local/"


def _rpc_port() -> int:
    raw = os.getenv("PYCORE_RPC_PORT") or os.getenv("RPC_PORT") or "59000"
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 59000


def _normalize_path(path: str) -> str:
    p = (path or "").strip()
    if not p.startswith("/"):
        p = f"/{p}"
    parsed = urlparse(p)
    safe = parsed.path or "/"
    if parsed.query:
        safe = f"{safe}?{parsed.query}"
    return safe


def _resolve_timeout(path: str, timeout_s: Any = None) -> float:
    if timeout_s is not None:
        try:
            return max(1.0, min(3600.0, float(timeout_s)))
        except (TypeError, ValueError):
            pass
    bare = path.split("?", 1)[0]
    if bare.startswith(_LIVE_TEST_PREFIX) and bare.endswith("/test"):
        return _LIVE_TEST_TIMEOUT
    return _DEFAULT_TIMEOUT


def _path_allowed(safe: str) -> bool:
    bare = safe.split("?", 1)[0]
    return any(bare.startswith(p) for p in _ALLOWED_PREFIXES)


def _parse_status_json(status_code: int, data: Any, text: str) -> Dict[str, Any]:
    """Shared response shaping for JSON responses (native + loopback)."""
    if status_code >= 400:
        if isinstance(data, dict):
            data.setdefault("success", False)
            return data
        return {"success": False, "error": (text[:200] if text else f"HTTP {status_code}")}
    if isinstance(data, dict):
        return data
    if data is not None:
        return {"success": True, "data": data}
    return {"success": False, "error": "response is not JSON"}


def _shape_blob(status_code: int, content: bytes, mime: str) -> Dict[str, Any]:
    if status_code >= 400:
        return {"success": False, "error": f"HTTP {status_code}", "status": status_code}
    return {
        "success": True,
        "base64": base64.b64encode(content or b"").decode("ascii"),
        "mime": mime or "application/octet-stream",
        "bytes": len(content or b""),
        "status": status_code,
    }


# --------------------------------------------------------------------------- #
# Native in-process ASGI dispatch (no HTTP client, no socket)                  #
# --------------------------------------------------------------------------- #
async def _asgi_call(
    app: Any,
    method: str,
    safe: str,
    body_bytes: bytes,
    timeout: float,
) -> Tuple[int, Dict[str, str], bytes]:
    """Drive the FastAPI ASGI app directly with a hand-built HTTP scope. Returns
    (status_code, headers, body_bytes). Pure-native: same event loop, no socket,
    no HTTP client. Bounded by the caller's asyncio.wait_for."""
    path, _, query = safe.partition("?")
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": method.upper(),
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("utf-8"),
        "query_string": query.encode("utf-8"),
        "root_path": "",
        "headers": [
            (b"host", b"pycore.local"),
            (b"content-type", b"application/json"),
            (b"accept", b"application/json"),
            (b"content-length", str(len(body_bytes)).encode("ascii")),
        ],
        "server": ("127.0.0.1", _rpc_port()),
        "client": ("127.0.0.1", 0),
    }
    sent = {"body": False}

    async def receive() -> Dict[str, Any]:
        if not sent["body"]:
            sent["body"] = True
            return {"type": "http.request", "body": body_bytes, "more_body": False}
        return {"type": "http.disconnect"}

    status = {"code": 500}
    headers: Dict[str, str] = {}
    chunks: List[bytes] = []

    async def send(message: Dict[str, Any]) -> None:
        mtype = message.get("type")
        if mtype == "http.response.start":
            status["code"] = int(message.get("status") or 500)
            for k, v in message.get("headers") or []:
                headers[k.decode("latin-1").lower()] = v.decode("latin-1")
        elif mtype == "http.response.body":
            chunk = message.get("body")
            if chunk:
                chunks.append(chunk)

    await asyncio.wait_for(app(scope, receive, send), timeout=timeout)
    return status["code"], headers, b"".join(chunks)


async def _dispatch_native(app: Any, method: str, safe: str, payload: Any, timeout_s: Any) -> Dict[str, Any]:
    """Native JSON dispatch. Always returns a result dict (a timeout/error becomes
    a {success:false,error} shape — never a loopback retry, so a non-idempotent
    POST is never re-run)."""
    timeout = _resolve_timeout(safe, timeout_s)
    method_upper = method.upper()
    if method_upper in ("POST", "PUT", "PATCH"):
        body_bytes = json.dumps(payload if payload is not None else {}).encode("utf-8")
    else:
        body_bytes = b""
    try:
        status_code, _headers, body = await _asgi_call(app, method_upper, safe, body_bytes, timeout)
    except asyncio.TimeoutError:
        return {"success": False, "error": f"request timed out after {timeout:.0f}s"}
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[local_http.{method.lower()}] native {safe} failed: {exc}")
        return {"success": False, "error": str(exc)}
    text = body.decode("utf-8", "replace") if body else ""
    try:
        data = json.loads(text) if text else None
    except ValueError:
        data = None
    return _parse_status_json(status_code, data, text)


async def _dispatch_blob_native(app: Any, safe: str, timeout_s: Any) -> Dict[str, Any]:
    """Native binary GET -> base64 (for <img>/<audio> data: URIs over WS)."""
    timeout = _resolve_timeout(safe, timeout_s)
    try:
        status_code, headers, body = await _asgi_call(app, "GET", safe, b"", timeout)
    except asyncio.TimeoutError:
        return {"success": False, "error": f"blob timed out after {timeout:.0f}s"}
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[local_http.blob] native {safe} failed: {exc}")
        return {"success": False, "error": str(exc)}
    return _shape_blob(status_code, body, headers.get("content-type", ""))


# --------------------------------------------------------------------------- #
# Loopback fallback (only when the app instance is unavailable)                #
# --------------------------------------------------------------------------- #
def _loopback_request(method: str, path: str, payload: Any = None, timeout_s: Any = None) -> Dict[str, Any]:
    safe = _normalize_path(path)
    timeout = _resolve_timeout(safe, timeout_s)
    url = f"http://127.0.0.1:{_rpc_port()}{safe}"
    try:
        requests = get_third_package_requests()
        method_upper = method.upper()
        if method_upper == "POST":
            resp = requests.post(url, json=payload or {}, timeout=timeout)
        elif method_upper == "DELETE":
            resp = requests.delete(url, timeout=timeout)
        else:
            resp = requests.get(url, timeout=timeout)
        try:
            data = resp.json()
        except Exception:  # noqa: BLE001
            data = None
        return _parse_status_json(resp.status_code, data, resp.text)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[local_http.{method.lower()}] {safe} failed: {exc}")
        return {"success": False, "error": str(exc)}


def _loopback_blob(path: str, timeout_s: Any) -> Dict[str, Any]:
    safe = _normalize_path(path)
    timeout = _resolve_timeout(safe, timeout_s)
    url = f"http://127.0.0.1:{_rpc_port()}{safe}"
    try:
        requests = get_third_package_requests()
        resp = requests.get(url, timeout=timeout)
        return _shape_blob(resp.status_code, resp.content, resp.headers.get("content-type", ""))
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[local_http.blob] {safe} failed: {exc}")
        return {"success": False, "error": str(exc)}


# --------------------------------------------------------------------------- #
# Bridge entry points                                                          #
# --------------------------------------------------------------------------- #
async def _bridge(app: Any, method: str, path: str, payload: Any, timeout_s: Any) -> Dict[str, Any]:
    safe = _normalize_path(path)
    if not _path_allowed(safe):
        return {"success": False, "error": f"path not allowed for local_http.{method.lower()}"}
    if app is None:
        return await asyncio.to_thread(_loopback_request, method, path, payload, timeout_s)
    return await _dispatch_native(app, method, safe, payload, timeout_s)


async def _bridge_blob(app: Any, path: str, timeout_s: Any) -> Dict[str, Any]:
    safe = _normalize_path(path)
    if not _path_allowed(safe):
        return {"success": False, "error": "path not allowed for local_http.blob"}
    if app is None:
        return await asyncio.to_thread(_loopback_blob, path, timeout_s)
    return await _dispatch_blob_native(app, safe, timeout_s)


def register_local_http_routes(server):
    """Register local_http.{get,post,delete,blob} on the rpc_v2 WS server."""
    app = getattr(server, "app", None)

    async def local_http_get(params, request_id, context):
        params = params or {}
        return await _bridge(app, "GET", str(params.get("path") or ""), None, params.get("timeout_s"))

    async def local_http_post(params, request_id, context):
        params = params or {}
        return await _bridge(app, "POST", str(params.get("path") or ""), params.get("body"), params.get("timeout_s"))

    async def local_http_delete(params, request_id, context):
        params = params or {}
        return await _bridge(app, "DELETE", str(params.get("path") or ""), None, params.get("timeout_s"))

    async def local_http_blob(params, request_id, context):
        params = params or {}
        return await _bridge_blob(app, str(params.get("path") or ""), params.get("timeout_s"))

    server.route(name="local_http.get", handler=local_http_get, sync=False,
                 description="Native in-process GET bridge for dashboard-over-WS")
    server.route(name="local_http.post", handler=local_http_post, sync=False,
                 description="Native in-process POST bridge for dashboard-over-WS")
    server.route(name="local_http.delete", handler=local_http_delete, sync=False,
                 description="Native in-process DELETE bridge for dashboard-over-WS")
    server.route(name="local_http.blob", handler=local_http_blob, sync=False,
                 description="Native in-process binary GET bridge (base64) for media-over-WS")
    mode = "native ASGI" if app is not None else "loopback socket"
    ColorPrint.green(f"[ConfigBuilder] Registered local_http.get/post/delete/blob RPC routes ({mode})")


__all__ = ["register_local_http_routes"]
