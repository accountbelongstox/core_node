# -*- coding: utf-8 -*-
"""
Native RPC v2 adapter for legacy pycore router services (non-UI / transitional).

pycore-manager UI must use named ``ui.*`` routes — not this bridge.
Kept for non-manager callers that still dispatch legacy FastAPI paths in-process.

Routes:
  pycore.router.invoke   { route, input?, operation? }
  pycore.router.resource { route, query? }

Only registered pycore router paths are permitted. If the app is unavailable,
the RPC returns an error; it never falls back to HTTP.
"""

import base64
import json
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    PYCORE_ROUTER_INVOKE,
    PYCORE_ROUTER_RESOURCE,
)

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
def _normalize_path(path: str) -> str:
    p = (path or "").strip()
    if not p.startswith("/"):
        p = f"/{p}"
    parsed = urlparse(p)
    safe = parsed.path or "/"
    if parsed.query:
        safe = f"{safe}?{parsed.query}"
    return safe


def _route_allowed(safe: str) -> bool:
    bare = safe.split("?", 1)[0]
    return any(bare.startswith(p) for p in _ALLOWED_PREFIXES)


def _parse_status_json(status_code: int, data: Any, text: str) -> Dict[str, Any]:
    """Shape the legacy router response for the RPC v2 result field."""
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
# Legacy router compatibility dispatch (no HTTP client or socket)              #
# --------------------------------------------------------------------------- #
async def _asgi_call(
    app: Any,
    method: str,
    safe: str,
    body_bytes: bytes,
) -> Tuple[int, Dict[str, str], bytes]:
    """Invoke the registered legacy app in-process for compatibility paths."""
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
        "server": ("127.0.0.1", 59000),
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

    await app(scope, receive, send)
    return status["code"], headers, b"".join(chunks)


async def _dispatch_router(app: Any, operation: str, safe: str, payload: Any) -> Dict[str, Any]:
    """Dispatch one registered router operation without transport timeouts."""
    method = "GET" if operation == "read" else "DELETE" if operation == "remove" else "POST"
    method_upper = method.upper()
    if method_upper in ("POST", "PUT", "PATCH"):
        body_bytes = json.dumps(payload if payload is not None else {}).encode("utf-8")
    else:
        body_bytes = b""
    try:
        status_code, _headers, body = await _asgi_call(app, method_upper, safe, body_bytes)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[router_rpc] {operation} {safe} failed: {exc}")
        return {"success": False, "error": str(exc)}
    text = body.decode("utf-8", "replace") if body else ""
    try:
        data = json.loads(text) if text else None
    except ValueError:
        data = None
    return _parse_status_json(status_code, data, text)


async def _dispatch_blob_native(app: Any, safe: str) -> Dict[str, Any]:
    """Native binary GET -> base64 (for <img>/<audio> data: URIs over WS)."""
    try:
        status_code, headers, body = await _asgi_call(app, "GET", safe, b"")
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[router_rpc] resource {safe} failed: {exc}")
        return {"success": False, "error": str(exc)}
    return _shape_blob(status_code, body, headers.get("content-type", ""))


# --------------------------------------------------------------------------- #
# Compatibility guard                                                         #
# --------------------------------------------------------------------------- #
def _rpc_only_error(route: str) -> Dict[str, Any]:
    return {"success": False, "error": f"{route} requires the native rpc_v2 WebSocket app"}


# --------------------------------------------------------------------------- #
# Bridge entry points                                                          #
# --------------------------------------------------------------------------- #
async def _invoke_router(app: Any, route: str, operation: str, payload: Any) -> Dict[str, Any]:
    safe = _normalize_path(route)
    if not _route_allowed(safe):
        return {"success": False, "error": "router path is not registered for RPC v2"}
    if app is None:
        return _rpc_only_error(PYCORE_ROUTER_INVOKE)
    return await _dispatch_router(app, operation, safe, payload)


async def _resource_router(app: Any, route: str) -> Dict[str, Any]:
    safe = _normalize_path(route)
    if not _route_allowed(safe):
        return {"success": False, "error": "router resource is not registered for RPC v2"}
    if app is None:
        return _rpc_only_error(PYCORE_ROUTER_RESOURCE)
    return await _dispatch_blob_native(app, safe)


def register_router_rpc_routes(server):
    """Register native router RPC routes on the rpc_v2 WebSocket server."""
    app = getattr(server, "app", None)

    async def router_resource(params, request_id, context):
        params = params or {}
        return await _resource_router(app, str(params.get("route") or ""))

    server.route(name=PYCORE_ROUTER_RESOURCE, handler=router_resource, sync=False,
                 description="Read a registered pycore binary resource over native RPC v2")
    mode = "native ASGI compatibility" if app is not None else "rpc-only"
    ColorPrint.green(f"[ConfigBuilder] Registered pycore.router.resource RPC routes ({mode})")


__all__ = ["register_router_rpc_routes"]
