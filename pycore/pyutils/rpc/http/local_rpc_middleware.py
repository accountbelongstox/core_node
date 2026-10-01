# -*- coding: utf-8 -*-
"""K7 ASGI gate in front of every route of one pycore HTTP server."""

import json
from typing import Any, Dict, FrozenSet, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.client_key_auth import client_key_present
from pycore.pyutils.common.local_rpc_guard import (
    ERROR_BODY_TOO_LARGE,
    NON_LOOPBACK_BODY_MAX_BYTES,
    STATUS_PAYLOAD_TOO_LARGE,
    evaluate_request,
    is_loopback_peer,
)
from pycore.pyutils.rpc.http.client_key_request import verify_scope_client_key

LOCAL_RPC_ORIGIN_SCOPE_KEY = "pycore.local_rpc.origin"
_HEADER_ENCODING = "latin-1"
_JSON_CONTENT_TYPE = b"application/json"
_GATED_SCOPE_TYPES = ("http", "websocket")
_WEBSOCKET_POLICY_VIOLATION = 1008


class _BodyTooLarge(Exception):
    pass


def scope_headers(scope: Dict[str, Any]) -> Dict[str, str]:
    return {
        bytes(name).decode(_HEADER_ENCODING).lower(): bytes(value).decode(_HEADER_ENCODING)
        for name, value in scope.get("headers") or []
    }


class LocalRpcGuardMiddleware:
    """Loopback callers: loopback Host and an allowed Origin; others: K3."""

    def __init__(self, app: Any, origins: FrozenSet[str]) -> None:
        self.app = app
        self.origins = origins

    async def __call__(self, scope: Dict[str, Any], receive: Any, send: Any) -> None:
        scope_type = scope.get("type")
        if scope_type not in _GATED_SCOPE_TYPES:
            await self.app(scope, receive, send)
            return
        headers = scope_headers(scope)
        peer = (scope.get("client") or ("", 0))[0]
        forward_receive = receive
        body = b""
        # Only a signed non-loopback HTTP request has its body buffered (for the
        # K3 digest), and never beyond the cap; an unsigned one is refused as is.
        if scope_type == "http" and not is_loopback_peer(peer) and client_key_present(headers):
            try:
                body = await self._read_body(receive, headers)
            except _BodyTooLarge:
                await self._reject(send, STATUS_PAYLOAD_TOO_LARGE, ERROR_BODY_TOO_LARGE, str(scope.get("path") or ""))
                return
            forward_receive = self._replay(body, receive)
        decision = evaluate_request(
            peer,
            headers,
            self.origins,
            lambda: verify_scope_client_key(scope, headers, body),
        )
        if not decision["allowed"]:
            ColorPrint.yellow(
                f"[HttpServer] rejected {scope.get('method')} {scope.get('path')} "
                f"from {peer}: {decision['error_code']}"
            )
            if scope_type == "websocket":
                await receive()
                await send({"type": "websocket.close", "code": _WEBSOCKET_POLICY_VIOLATION})
                return
            await self._reject(send, int(decision["status"]), str(decision["error_code"]), str(scope.get("path") or ""))
            return
        scope[LOCAL_RPC_ORIGIN_SCOPE_KEY] = decision["origin"]
        await self.app(scope, forward_receive, send)

    @staticmethod
    async def _read_body(receive: Any, headers: Dict[str, str]) -> bytes:
        declared = str(headers.get("content-length") or "").strip()
        if declared.isdigit() and int(declared) > NON_LOOPBACK_BODY_MAX_BYTES:
            raise _BodyTooLarge()
        chunks: List[bytes] = []
        size = 0
        more = True
        while more:
            message = await receive()
            if message.get("type") != "http.request":
                break
            chunk = bytes(message.get("body") or b"")
            size += len(chunk)
            if size > NON_LOOPBACK_BODY_MAX_BYTES:
                raise _BodyTooLarge()
            chunks.append(chunk)
            more = bool(message.get("more_body"))
        return b"".join(chunks)

    @staticmethod
    def _replay(body: bytes, receive: Any) -> Any:
        delivered = {"body": False}

        async def replay() -> Dict[str, Any]:
            if not delivered["body"]:
                delivered["body"] = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        return replay

    @staticmethod
    async def _reject(send: Any, status: int, error_code: str, route: str) -> None:
        payload = json.dumps(
            {
                "success": False,
                "error": {"code": error_code, "message": error_code},
                "route": route,
            },
            separators=(",", ":"),
        ).encode("utf-8")
        await send({
            "type": "http.response.start",
            "status": status,
            "headers": [
                (b"content-type", _JSON_CONTENT_TYPE),
                (b"content-length", str(len(payload)).encode("ascii")),
            ],
        })
        await send({"type": "http.response.body", "body": payload})


__all__ = ["LOCAL_RPC_ORIGIN_SCOPE_KEY", "LocalRpcGuardMiddleware", "scope_headers"]
