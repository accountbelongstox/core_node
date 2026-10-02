# -*- coding: utf-8 -*-
"""Signed device transport to the Laravel relay control plane."""

from __future__ import annotations

import hashlib
import json
import time
import uuid
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Any, Dict, Mapping, Optional

from pycore.pyutils.common.http_client import RESPONSE_CONTROL
from pycore.pyfoundations.network_constants import (
    HTTP_JSON_CONTENT_TYPE,
    HTTP_OCTET_STREAM_CONTENT_TYPE,
)
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.relay_identity import relay_device_identity
from pycore.pyutils.common.relay_request_clock import relay_request_clock
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.endpoint_manager import HEALTH_PATH, laravel_endpoint_manager


RELAY_SIGNATURE_RETRY_ATTEMPTS = 2
RELAY_SIGNATURE_TIMESTAMP_ERROR = "signature_timestamp_invalid"
RELAY_NO_ENDPOINT_ERROR = "relay_endpoint_unavailable"


class RelayHttpError(RuntimeError):
    """One control-plane response outside the successful HTTP range."""

    def __init__(self, status_code: int, action: str, error_code: str = "") -> None:
        detail = str(error_code or f"relay_http_{status_code}")
        super().__init__(f"{detail}:{action}")
        self.status_code = int(status_code)
        self.action = str(action)
        self.error_code = str(error_code)


class RelayTransport:
    """Signed requests and blob transfers against the relay control plane."""

    @staticmethod
    def endpoint() -> str:
        return laravel_endpoint_manager.resolve().rstrip("/")

    @staticmethod
    def _server_epoch(response: Any, document: Optional[Mapping[str, Any]] = None) -> Optional[float]:
        data = document or {}
        epoch = data.get("server_time_unix")
        if isinstance(epoch, (int, float)) and not isinstance(epoch, bool):
            return float(epoch)
        timestamp = data.get("timestamp")
        date_header = str(response.headers.get("Date") or "")
        try:
            if isinstance(timestamp, str) and timestamp:
                parsed = datetime.fromisoformat(timestamp[:-1] + "+00:00" if timestamp.endswith("Z") else timestamp)
                return parsed.timestamp() if parsed.tzinfo is not None else None
            if date_header:
                parsed = parsedate_to_datetime(date_header)
                return parsed.timestamp() if parsed.tzinfo is not None else None
        except (ValueError, TypeError) as error:
            relay_activity_log.warning("clock.server.response.invalid", error_type=type(error).__name__, error=error)
        return None

    def ensure_clock(self, endpoint: str, force: bool = False) -> None:
        if not force and relay_request_clock.ready(endpoint):
            return
        started = time.monotonic()
        response = laravel_client.request(
            "GET",
            HEALTH_PATH,
            base_url=endpoint,
            params={"clock_probe": uuid.uuid4().hex},
            headers={
                "Accept": HTTP_JSON_CONTENT_TYPE,
                "Cache-Control": "no-cache",
                "Accept-Encoding": "identity",
            },
            timeout=(
                relay_contract.duration("subscriber_connect_timeout_seconds"),
                relay_contract.duration("request_timeout_seconds"),
            ),
            allow_redirects=False,
            log_line=False,
        )
        received = time.monotonic()
        if response.status_code != 200:
            raise RelayHttpError(response.status_code, "clock.server.probe", "relay_server_clock_probe_failed")
        document = response.json() if "json" in str(response.headers.get("Content-Type") or "").lower() else {}
        epoch = self._server_epoch(response, document if isinstance(document, dict) else None)
        if epoch is None or not relay_request_clock.observe(endpoint, epoch, started, received):
            raise RelayHttpError(503, "clock.server.probe", "relay_server_clock_unavailable")

    def request_json(
        self,
        method: str,
        path: str,
        payload: Optional[Mapping[str, Any]] = None,
        query: Optional[Mapping[str, Any]] = None,
        timeout: Optional[float] = None,
        action: str = "control.request",
    ) -> Dict[str, Any]:
        body = (
            json.dumps(dict(payload), ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
            if payload is not None
            else b""
        )
        response = self.request_bytes(method, path, body, query, HTTP_JSON_CONTENT_TYPE, timeout, action)
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
        content_type: str = HTTP_OCTET_STREAM_CONTENT_TYPE,
        timeout: Optional[float] = None,
        action: str = "control.bytes",
    ) -> Any:
        endpoint = self.endpoint()
        if not endpoint:
            raise RuntimeError(RELAY_NO_ENDPOINT_ERROR)
        normalized_method = str(method or "GET").upper()
        params = dict(query or {})
        request_timeout = relay_contract.duration("request_timeout_seconds") if timeout is None else float(timeout)
        self.ensure_clock(endpoint)
        for attempt in range(RELAY_SIGNATURE_RETRY_ATTEMPTS):
            headers = relay_device_identity.signed_headers(normalized_method, path, params, body, endpoint)
            headers["Accept-Encoding"] = "identity"
            if body or normalized_method != "GET":
                headers["Content-Type"] = str(content_type)
            started = time.monotonic()
            response = laravel_client.request(
                normalized_method,
                path,
                base_url=endpoint,
                params=params,
                data=body if body else None,
                headers=headers,
                timeout=(
                    min(relay_contract.duration("subscriber_connect_timeout_seconds"), request_timeout),
                    request_timeout,
                ),
                allow_redirects=False,
                log_line=False,
                sensitive_request=True, response=RESPONSE_CONTROL,
            )
            received = time.monotonic()
            status = int(response.status_code)
            error_document: Any = {}
            error_code = ""
            if status < 200 or status >= 300:
                is_json = "json" in str(response.headers.get("Content-Type") or "").lower()
                error_document = response.json() if is_json else {}
                error_code = str(error_document.get("error_code") or "") if isinstance(error_document, dict) else ""
            epoch = self._server_epoch(response, error_document if isinstance(error_document, dict) else None)
            if epoch is not None:
                relay_request_clock.observe(endpoint, epoch, started, received)
            if status == 403 and error_code == RELAY_SIGNATURE_TIMESTAMP_ERROR and attempt == 0:
                relay_activity_log.warning("clock.signature.resynchronizing", action_name=action, endpoint=endpoint)
                self.ensure_clock(endpoint, force=True)
                continue
            if status < 200 or status >= 300:
                relay_activity_log.error(
                    action + ".failed",
                    method=normalized_method,
                    path=path,
                    status=status,
                    error_code=error_code,
                    duration_ms=f"{(received - started) * 1000:.1f}",
                )
                raise RelayHttpError(status, action, error_code)
            relay_activity_log.debug(
                action + ".completed",
                method=normalized_method,
                path=path,
                status=status,
                duration_ms=f"{(received - started) * 1000:.1f}",
            )
            return response
        raise RelayHttpError(403, action, RELAY_SIGNATURE_TIMESTAMP_ERROR)

    def download_request_blob(self, blob_id: str) -> bytes:
        response = self.request_bytes(
            "GET",
            relay_contract.endpoint("device_request_blob_download", blob_id=blob_id),
            timeout=relay_contract.duration("request_timeout_seconds"),
            action="blob.request.download",
        )
        return bytes(response.content or b"")

    def upload_response_blob(self, operation_id: str, pairing_id: str, body: bytes) -> str:
        blob_id = str(uuid.uuid4())
        digest = hashlib.sha256(body).hexdigest()
        self.request_json(
            "POST",
            relay_contract.endpoint("device_response_blob_allocate"),
            {
                "blob_id": blob_id,
                "operation_id": operation_id,
                "pairing_id": pairing_id,
                "direction": "response",
                "expected_sha256": digest,
                "expected_length": len(body),
            },
            action="blob.response.allocate",
        )
        chunk_size = relay_contract.limit("blob_chunk_bytes")
        for chunk_index, offset in enumerate(range(0, len(body), chunk_size)):
            self.request_bytes(
                "PUT",
                relay_contract.endpoint("device_response_blob_chunk", blob_id=blob_id, chunk_index=chunk_index),
                body[offset : offset + chunk_size],
                action="blob.response.chunk",
            )
        self.request_json(
            "POST",
            relay_contract.endpoint("device_response_blob_finalize", blob_id=blob_id),
            {"blob_id": blob_id, "expected_sha256": digest, "expected_length": len(body)},
            action="blob.response.finalize",
        )
        return blob_id


relay_transport = RelayTransport()


__all__ = ["RelayHttpError", "relay_transport"]
