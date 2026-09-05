# -*- coding: utf-8 -*-
"""Signed outbound transport for the Laravel Relay V2 coordinator."""

from __future__ import annotations

import base64
import hashlib
import json
import time
from typing import Any, Callable, Dict, Mapping, Optional

from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.relay_identity import relay_device_identity
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager


RELAY_JSON_CONTENT_TYPE = "application/json"
RELAY_BINARY_CONTENT_TYPE = "application/octet-stream"
RELAY_REQUEST_BLOB_ENDPOINT = "device_request_blob_download"
RELAY_RESPONSE_BLOB_CHUNK_ENDPOINT = "device_response_blob_chunk"
RELAY_EMPTY_BODY_SHA256 = hashlib.sha256(b"").hexdigest()


class RelayHttpError(RuntimeError):
    """One coordinator response outside the successful HTTP range."""

    def __init__(
        self,
        status_code: int,
        action: str,
        error_code: str = "",
    ) -> None:
        detail = str(error_code or f"relay_http_{status_code}")
        super().__init__(f"{detail}:{action}")
        self.status_code = int(status_code)
        self.action = str(action)
        self.error_code = str(error_code)


class LaravelRelayTransport:
    """Encode exact requests and generation-bound blob transfers."""

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
        coordinator_url: str = "",
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
            coordinator_url,
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
        coordinator_url: str = "",
    ) -> Any:
        return self._request(
            method,
            path,
            query or {},
            bytes(body),
            content_type,
            timeout,
            action,
            coordinator_url,
        )

    def request_body(
        self,
        descriptor: Mapping[str, Any],
        operation_id: str,
        body_present: bool,
        coordinator_url: str,
    ) -> bytes:
        body_base64 = descriptor.get("body_base64")
        body_ref = str(descriptor.get("body_ref") or "")
        if body_base64 is not None and body_ref:
            raise ValueError("relay_request_body_source_conflict")
        if not body_present and (body_base64 is not None or body_ref):
            raise ValueError("relay_request_unexpected_body_source")
        if not body_present:
            return b""
        if body_base64 is not None:
            body = base64.b64decode(str(body_base64), validate=True)
            relay_activity_log.debug(
                "operation.request.inline_body.loaded",
                operation_id=operation_id,
                body=body,
            )
            return body
        if not body_ref:
            raise ValueError("relay_request_body_source_missing")
        response = self.request_bytes(
            "GET",
            relay_contract.endpoint(RELAY_REQUEST_BLOB_ENDPOINT, blob_id=body_ref),
            query=relay_contract.generation_query(
                RELAY_REQUEST_BLOB_ENDPOINT,
                int(descriptor["revision"]),
                int(descriptor["claim_epoch"]),
                str(descriptor["lease_owner"]),
            ),
            timeout=relay_contract.duration("request_timeout_seconds"),
            action="operation.request_blob.download",
            coordinator_url=coordinator_url,
        )
        return bytes(response.content or b"")

    def upload_response_blob(
        self,
        request: Mapping[str, Any],
        body: bytes,
        body_digest: str,
        assert_active_lease: Callable[[Mapping[str, Any]], None],
    ) -> str:
        operation_id = str(request["operation_id"])
        assert_active_lease(request)
        allocation = self.request_json(
            "POST",
            relay_contract.endpoint(
                "device_response_blob_allocate",
                operation_id=operation_id,
            ),
            {
                "operation_id": operation_id,
                "direction": "response",
                "expected_sha256": body_digest,
                "expected_length": len(body),
                "operation_revision": int(request["operation_revision"]),
                "claim_epoch": int(request["claim_epoch"]),
                "lease_owner": str(request["lease_owner"]),
            },
            action="operation.response_blob.allocate",
            coordinator_url=str(request["coordinator_url"]),
        )
        blob = (
            allocation.get("blob")
            if isinstance(allocation.get("blob"), dict)
            else allocation
        )
        blob_id = str(blob.get("blob_id") or "")
        if not blob_id:
            raise RuntimeError("relay_response_blob_id_missing")
        chunk_size = relay_contract.limit("blob_chunk_bytes")
        for chunk_index, offset in enumerate(range(0, len(body), chunk_size)):
            assert_active_lease(request)
            chunk = body[offset : offset + chunk_size]
            self.request_bytes(
                "PUT",
                relay_contract.endpoint(
                    RELAY_RESPONSE_BLOB_CHUNK_ENDPOINT,
                    blob_id=blob_id,
                    chunk_index=chunk_index,
                ),
                body=chunk,
                query=relay_contract.generation_query(
                    RELAY_RESPONSE_BLOB_CHUNK_ENDPOINT,
                    int(request["operation_revision"]),
                    int(request["claim_epoch"]),
                    str(request["lease_owner"]),
                ),
                action="operation.response_blob.chunk",
                coordinator_url=str(request["coordinator_url"]),
            )
        assert_active_lease(request)
        self.request_json(
            "POST",
            relay_contract.endpoint(
                "device_response_blob_finalize",
                blob_id=blob_id,
            ),
            {
                "blob_id": blob_id,
                "expected_sha256": body_digest,
                "expected_length": len(body),
                "operation_revision": int(request["operation_revision"]),
                "claim_epoch": int(request["claim_epoch"]),
                "lease_owner": str(request["lease_owner"]),
            },
            action="operation.response_blob.finalize",
            coordinator_url=str(request["coordinator_url"]),
        )
        return blob_id

    def submit_nonexecution(
        self,
        descriptor: Mapping[str, Any],
        outcome: str,
        error_code: str,
        status: int = 0,
        lease_owner: str = "",
    ) -> bool:
        operation_id = str(descriptor.get("operation_id") or "")
        operation_revision = int(descriptor.get("revision") or 0)
        claim_epoch = int(descriptor.get("claim_epoch") or 0)
        descriptor_lease_owner = str(descriptor.get("lease_owner") or "")
        coordinator_url = str(descriptor.get("_coordinator_url") or "")
        if (
            not operation_id
            or operation_revision <= 0
            or claim_epoch <= 0
            or not descriptor_lease_owner
            or descriptor_lease_owner != str(lease_owner)
            or not coordinator_url
        ):
            relay_activity_log.error(
                "operation.nonexecution.unreportable",
                operation_id=operation_id,
                operation_revision=operation_revision,
                claim_epoch=claim_epoch,
                lease_owner=descriptor_lease_owner,
                outcome=outcome,
                error_code=error_code,
            )
            return False
        payload: Dict[str, Any] = {
            "operation_id": operation_id,
            "operation_revision": operation_revision,
            "claim_epoch": claim_epoch,
            "lease_owner": descriptor_lease_owner,
            "outcome": str(outcome),
            "headers": {},
            "error": {"code": str(error_code)},
            "body_sha256": RELAY_EMPTY_BODY_SHA256,
            "body_length": 0,
            "body_present": False,
        }
        if status > 0:
            payload["status"] = int(status)
        self.request_json(
            "POST",
            relay_contract.endpoint("operation_result", operation_id=operation_id),
            payload,
            action="operation.result.nonexecution",
            coordinator_url=coordinator_url,
        )
        relay_activity_log.success(
            "operation.nonexecution.submitted",
            operation_id=operation_id,
            operation_revision=operation_revision,
            claim_epoch=claim_epoch,
            outcome=outcome,
            error_code=error_code,
        )
        return True

    def _request(
        self,
        method: str,
        path: str,
        query: Mapping[str, Any],
        body: bytes,
        content_type: str,
        timeout: Optional[float],
        action: str,
        coordinator_url: str,
    ) -> Any:
        endpoint = str(coordinator_url or "").rstrip("/") or self.endpoint()
        if not endpoint:
            raise RuntimeError("relay_coordinator_endpoint_unavailable")
        normalized_method = str(method or "GET").upper()
        headers = relay_device_identity.signed_headers(
            normalized_method,
            path,
            query,
            body,
        )
        headers["Accept-Encoding"] = "identity"
        if body or normalized_method != "GET":
            headers["Content-Type"] = str(content_type)
        started = time.perf_counter()
        relay_activity_log.debug(
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
            log_line=False,
            include_default_identity=False,
            sensitive_request=True,
        )
        status = int(getattr(response, "status_code", 0) or 0)
        elapsed_ms = (time.perf_counter() - started) * 1000
        if status < 200 or status >= 300:
            response_type = str(
                getattr(response, "headers", {}).get("Content-Type") or ""
            ).lower()
            error_document = response.json() if "json" in response_type else {}
            error_code = (
                str(error_document.get("error_code") or "")
                if isinstance(error_document, dict)
                else ""
            )
            relay_activity_log.error(
                action + ".failed",
                method=normalized_method,
                path=path,
                status=status,
                error_code=error_code,
                duration_ms=f"{elapsed_ms:.1f}",
            )
            raise RelayHttpError(status, action, error_code)
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


laravel_relay_transport = LaravelRelayTransport()


__all__ = ["RelayHttpError", "laravel_relay_transport"]
