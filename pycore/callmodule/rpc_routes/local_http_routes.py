# -*- coding: utf-8 -*-
"""
Local HTTP RPC — loopback GET proxy for the dashboard when browser HTTP to
:59000 is blocked (cross-origin / Private Network Access) but the WS bus works.

Route:
  local_http.get   { path: "/api/local/assist/status?..." }
  local_http.post  { path: "/api/local/capabilities/settings", body: {...}, timeout_s? }
    -> loopback HTTP on 127.0.0.1:<rpc_port>  (5s default; /api/local/*/test uses 600s)
    -> parsed JSON body (or {success:false, error})

Long engine tests (TTS/STT/OCR) should prefer the direct WS routes in
local_engine_test_routes.py (local.tts.test, local.stt.test, local.ocr.test).

Only paths under allowed prefixes are permitted.
"""

import asyncio
import os
from typing import Any, Dict, Tuple
from urllib.parse import urlparse

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests

_ALLOWED_PREFIXES: Tuple[str, ...] = (
    "/api/local/",
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


def _loopback_request(
    method: str,
    path: str,
    payload: Any = None,
    timeout_s: Any = None,
) -> Dict[str, Any]:
    safe = _normalize_path(path)
    if not any(safe.split("?", 1)[0].startswith(p) for p in _ALLOWED_PREFIXES):
        return {
            "success": False,
            "error": f"path not allowed for local_http.{method.lower()}",
        }
    timeout = _resolve_timeout(safe, timeout_s)
    port = _rpc_port()
    url = f"http://127.0.0.1:{port}{safe}"
    try:
        requests = get_third_package_requests()
        if method.upper() == "POST":
            resp = requests.post(url, json=payload or {}, timeout=timeout)
        else:
            resp = requests.get(url, timeout=timeout)
        if resp.status_code >= 400:
            try:
                body = resp.json()
            except Exception:  # noqa: BLE001
                body = {"error": resp.text[:200] or f"HTTP {resp.status_code}"}
            if isinstance(body, dict):
                body.setdefault("success", False)
                return body
            return {"success": False, "error": f"HTTP {resp.status_code}"}
        try:
            data = resp.json()
        except Exception:  # noqa: BLE001
            return {"success": False, "error": "response is not JSON"}
        if isinstance(data, dict):
            return data
        return {"success": True, "data": data}
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[local_http.{method.lower()}] {safe} failed: {exc}")
        return {"success": False, "error": str(exc)}


def _loopback_get(path: str) -> Dict[str, Any]:
    return _loopback_request("GET", path)


def register_local_http_routes(server):
    """Register local_http.get on the rpc_v2 WS server."""

    async def local_http_get(params, request_id, context):
        path = (params or {}).get("path") or ""
        return await asyncio.to_thread(_loopback_get, str(path))

    async def local_http_post(params, request_id, context):
        params = params or {}
        path = params.get("path") or ""
        body = params.get("body")
        timeout_s = params.get("timeout_s")
        return await asyncio.to_thread(
            _loopback_request, "POST", str(path), body, timeout_s
        )

    server.route(
        name="local_http.get",
        handler=local_http_get,
        sync=False,
        description="Loopback GET proxy for dashboard HTTP fallback",
    )
    server.route(
        name="local_http.post",
        handler=local_http_post,
        sync=False,
        description="Loopback POST proxy for dashboard HTTP fallback",
    )
    ColorPrint.green("[ConfigBuilder] Registered local_http.get + local_http.post RPC routes")


__all__ = ["register_local_http_routes"]
