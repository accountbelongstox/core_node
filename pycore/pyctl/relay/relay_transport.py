# -*- coding: utf-8 -*-
"""Signed outbound-only Laravel transport for the Pycore Relay V2 agent."""

from __future__ import annotations

import hashlib
import json
import time
from typing import Any, Dict, Mapping, Optional

from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.relay_identity import relay_device_identity
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager


RELAY_JSON_CONTENT_TYPE = "application/json"
RELAY_BINARY_CONTENT_TYPE = "application/octet-stream"


class RelayHttpError(RuntimeError):
    """One coordinator response outside the successful HTTP range."""

    def __init__(self, status_code: int, action: str) -> None:
        super().__init__(f"relay_http_{status_code}:{action}")
        self.status_code = int(status_code)
        self.action = str(action)


class RelayTransport:
    """Encode exact request bytes, sign them, and retain raw response bytes."""

    @staticmethod
    def endpoint() -> str:
        return str(laravel_endpoint_manager.get_active_base_url() or "").rstrip("/")

    def request_json(
        self,
        method: str,
        path: str,
        payload: Optional[Mapping[str, Any]] = None,
        query: Optional[Mapping[str, Any]] = None,
        timeout: Optional[float] = None,
        action: str = "coordinator.request",
    ) -> Dict[str, Any]:
        body = (
            json.dumps(
                dict(payload),
                ensure_ascii=False,
                allow_nan=False,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
            if payload is not None
            else b""
        )
        response = self._request(
            method,
            path,
            query or {},
            body,
            RELAY_JSON_CONTENT_TYPE,
            timeout,
            action,
        )
        data = response.json()
        if not isinstance(data, dict):
            raise TypeError("relay_response_root_not_object")
        nested = data.get("data")
        return dict(nested) if isinstance(nested, dict) else dict(data)

    def request_bytes(
        self,
        method: str,
        path: str,
        body: bytes = b"",
        query: Optional[Mapping[str, Any]] = None,
        content_type: str = RELAY_BINARY_CONTENT_TYPE,
        timeout: Optional[float] = None,
        action: str = "coordinator.bytes",
    ) -> Any:
        return self._request(
            method,
            path,
            query or {},
            bytes(body),
            content_type,
            timeout,
            action,
        )

    def _request(
        self,
        method: str,
        path: str,
        query: Mapping[str, Any],
        body: bytes,
        content_type: str,
        timeout: Optional[float],
        action: str,
    ) -> Any:
        endpoint = self.endpoint()
        if not endpoint:
            raise RuntimeError("relay_coordinator_endpoint_unavailable")
        normalized_method = str(method or "GET").upper()
        headers = relay_device_identity.signed_headers(
            normalized_method,
            path,
            query,
            body,
        )
        if body or normalized_method != "GET":
            headers["Content-Type"] = str(content_type)
        started = time.perf_counter()
        relay_activity_log.info(
            action + ".started",
            method=normalized_method,
            path=path,
            query=dict(query),
            body=body,
            endpoint=endpoint,
        )
        response = laravel_client.request(
            normalized_method,
            path,
            base_url=endpoint,
            params=dict(query),
            data=body if body else None,
            headers=headers,
            timeout=(
                relay_contract.duration("request_timeout_seconds")
                if timeout is None
                else float(timeout)
            ),
            allow_redirects=False,
            include_default_identity=False,
        )
        status = int(getattr(response, "status_code", 0) or 0)
        elapsed_ms = (time.perf_counter() - started) * 1000
        if status < 200 or status >= 300:
            relay_activity_log.error(
                action + ".failed",
                method=normalized_method,
                path=path,
                status=status,
                duration_ms=f"{elapsed_ms:.1f}",
            )
            raise RelayHttpError(status, action)
        content = bytes(getattr(response, "content", b"") or b"")
        relay_activity_log.success(
            action + ".completed",
            method=normalized_method,
            path=path,
            status=status,
            duration_ms=f"{elapsed_ms:.1f}",
            response_length=len(content),
            response_sha256=hashlib.sha256(content).hexdigest(),
        )
        return response


relay_transport = RelayTransport()


__all__ = ["RelayHttpError", "relay_transport"]
