# -*- coding: utf-8 -*-
"""K3 client-key verification of one inbound ASGI request (verified once per request)."""

from typing import Any, Dict, Mapping

from pycore.pyutils.common.client_key_auth import client_key_verify

CLIENT_KEY_SCOPE_KEY = "pycore.client_key"
_RAW_ENCODING = "latin-1"


def verify_scope_client_key(scope: Dict[str, Any], headers: Mapping[str, Any], body: bytes) -> Dict[str, Any]:
    cached = scope.get(CLIENT_KEY_SCOPE_KEY)
    if cached is not None:
        return cached
    raw_path = bytes(scope.get("raw_path") or str(scope.get("path") or "/").encode("utf-8"))
    result = client_key_verify(
        str(scope.get("method") or "GET"),
        raw_path.decode(_RAW_ENCODING).split("?", 1)[0],
        bytes(scope.get("query_string") or b"").decode(_RAW_ENCODING),
        headers,
        body,
        str(dict(headers).get("content-type") or ""),
    )
    scope[CLIENT_KEY_SCOPE_KEY] = result
    return result


async def request_client_key(request: Any) -> Dict[str, Any]:
    cached = request.scope.get(CLIENT_KEY_SCOPE_KEY)
    if cached is not None:
        return cached
    return verify_scope_client_key(request.scope, dict(request.headers), await request.body())


__all__ = ["CLIENT_KEY_SCOPE_KEY", "request_client_key", "verify_scope_client_key"]
