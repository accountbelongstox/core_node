# -*- coding: utf-8 -*-
"""Claimed Relay operation validation, in-process execution, and completion."""

from __future__ import annotations

import base64
import hashlib
import json
from typing import Any, Dict, Iterable, Mapping

from pycore.pyctl.relay.relay_transport import relay_transport
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.relay_execution_ledger import (
    RELAY_EXECUTE,
    RELAY_EXECUTION_UNKNOWN,
    RELAY_REPLAY_RESPONSE,
    relay_execution_ledger,
)
from pycore.pyutils.common.relay_identity import relay_device_identity
from pycore.pyutils.rpc_v2.execution import (
    RpcExecutionError,
    RpcExecutionResponse,
    rpc_execution_kernel,
)


RELAY_RESULT_RESPONDED = "responded"
RELAY_RESULT_FAILED = "failed"


class RelayOperationProcessor:
    """Process each operation as independently retryable protocol steps."""

    def process_many(self, operations: Iterable[Mapping[str, Any]]) -> None:
        for descriptor in operations:
            operation_id = str(descriptor.get("operation_id") or "")
            try:
                self.process(descriptor)
            except Exception as exc:
                relay_activity_log.error(
                    "operation.processing.interrupted",
                    operation_id=operation_id,
                    error_type=type(exc).__name__,
                    error=exc,
                )

    def process(self, descriptor: Mapping[str, Any]) -> None:
        request = self._validated_request(descriptor)
        operation_id = request["operation_id"]
        ledger = relay_execution_ledger.admit(
            operation_id,
            relay_device_identity.device_id(),
            request["request_digest"],
            request["route"],
            request["retry_policy"],
        )
        action = str(ledger["action"])
        if action == RELAY_REPLAY_RESPONSE:
            response = relay_execution_ledger.response(ledger["result"])
            self._post_response(request, response, RELAY_RESULT_RESPONDED)
            return
        if action == RELAY_EXECUTION_UNKNOWN:
            self._post_execution_unknown(request, "prior_execution_incomplete")
            return
        if action != RELAY_EXECUTE:
            raise RuntimeError("relay_ledger_action_invalid")
        self._execute(request)

    def _execute(self, request: Dict[str, Any]) -> None:
        operation_id = request["operation_id"]
        try:
            response = rpc_execution_kernel.execute_relay(
                request["method"],
                request["path"],
                request["query"],
                request["headers"],
                request["body"],
                operation_id,
                request["pairing_id"],
                request["user_id"],
            )
        except RpcExecutionError as exc:
            response = rpc_execution_kernel.error_response(
                exc.code,
                exc.status_code,
                operation_id,
            )
            relay_execution_ledger.save_response(
                operation_id,
                request["request_digest"],
                response,
                failed=True,
            )
            self._post_response(request, response, RELAY_RESULT_FAILED)
            return
        except TimeoutError:
            relay_execution_ledger.mark_unknown(
                operation_id,
                "rpc_execution_timeout",
            )
            self._post_execution_unknown(request, "rpc_execution_timeout")
            return
        except Exception as exc:
            relay_activity_log.error(
                "rpc.dispatch.failed",
                operation_id=operation_id,
                error_type=type(exc).__name__,
                error=exc,
            )
            response = rpc_execution_kernel.error_response(
                "rpc_execution_failed",
                500,
                operation_id,
            )
            relay_execution_ledger.save_response(
                operation_id,
                request["request_digest"],
                response,
                failed=True,
            )
            self._post_response(request, response, RELAY_RESULT_FAILED)
            return
        if len(response.body) > relay_contract.limit("response_body_bytes"):
            response = rpc_execution_kernel.error_response(
                "relay_response_body_limit_exceeded",
                413,
                operation_id,
            )
            relay_execution_ledger.save_response(
                operation_id,
                request["request_digest"],
                response,
                failed=True,
            )
            self._post_response(request, response, RELAY_RESULT_FAILED)
            return
        relay_execution_ledger.save_response(
            operation_id,
            request["request_digest"],
            response,
        )
        self._post_response(request, response, RELAY_RESULT_RESPONDED)

    def _validated_request(
        self,
        descriptor: Mapping[str, Any],
    ) -> Dict[str, Any]:
        operation_id = str(descriptor.get("operation_id") or "")
        pairing_id = str(descriptor.get("pairing_id") or "")
        user_id = str(descriptor.get("user_id") or "")
        method = str(descriptor.get("method") or "GET").upper()
        path = str(descriptor.get("path") or "")
        query = {
            str(key): value
            for key, value in dict(descriptor.get("query") or {}).items()
        }
        headers = rpc_execution_kernel.filtered_headers(
            dict(descriptor.get("headers") or {}),
            "request",
        )
        if not operation_id or not pairing_id or not user_id or not path:
            raise ValueError("relay_operation_descriptor_incomplete")
        route = rpc_execution_kernel.route_path(path)
        policy = relay_contract.route_policy(route, method)
        if str(policy.get("exposure") or "denied") != "relay":
            raise ValueError("relay_operation_route_denied")
        retry_policy = str(policy.get("retry") or "at_most_once_action")
        body_present_value = descriptor.get("body_present")
        if not isinstance(body_present_value, bool):
            raise ValueError("relay_request_body_presence_missing")
        body_present = bool(body_present_value)
        body = self._request_body(descriptor, operation_id, body_present)
        body_sha256 = hashlib.sha256(body).hexdigest()
        expected_body_sha256 = str(descriptor.get("body_sha256") or "")
        expected_body_length = int(descriptor.get("body_length") or 0)
        if body_sha256 != expected_body_sha256:
            raise ValueError("relay_request_body_digest_conflict")
        if len(body) != expected_body_length:
            raise ValueError("relay_request_body_length_conflict")
        if len(body) > relay_contract.limit("request_body_bytes"):
            raise ValueError("relay_request_body_limit_exceeded")
        request_digest = self._request_digest(
            method,
            path,
            query,
            headers,
            body_present,
            body_sha256,
            len(body),
        )
        if request_digest != str(descriptor.get("request_digest") or ""):
            raise ValueError("relay_request_descriptor_digest_conflict")
        relay_activity_log.success(
            "operation.request.validated",
            operation_id=operation_id,
            pairing_id=pairing_id,
            user_id=user_id,
            method=method,
            route=route,
            retry_policy=retry_policy,
            body=body,
            request_digest=request_digest,
        )
        return {
            "operation_id": operation_id,
            "claimed_revision": int(descriptor.get("revision") or 0),
            "pairing_id": pairing_id,
            "user_id": user_id,
            "method": method,
            "path": path,
            "route": route,
            "query": query,
            "headers": headers,
            "body": body,
            "body_present": body_present,
            "body_sha256": body_sha256,
            "request_digest": request_digest,
            "retry_policy": retry_policy,
        }

    def _request_body(
        self,
        descriptor: Mapping[str, Any],
        operation_id: str,
        body_present: bool,
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
        if body_ref:
            response = relay_transport.request_bytes(
                "GET",
                relay_contract.endpoint("request_blob", blob_id=body_ref),
                timeout=relay_contract.duration("request_timeout_seconds"),
                action="operation.request_blob.download",
            )
            return bytes(response.content or b"")
        raise ValueError("relay_request_body_source_missing")

    @staticmethod
    def _request_digest(
        method: str,
        path: str,
        query: Mapping[str, Any],
        headers: Mapping[str, Any],
        body_present: bool,
        body_sha256: str,
        body_length: int,
    ) -> str:
        canonical = json.dumps(
            {
                "method": str(method).upper(),
                "path": "/" + str(path).strip().lstrip("/"),
                "query": dict(query),
                "headers": {
                    str(key).lower(): str(value)
                    for key, value in sorted(
                        dict(headers).items(),
                        key=lambda item: str(item[0]).lower(),
                    )
                },
                "body_present": bool(body_present),
                "body_sha256": str(body_sha256),
                "body_length": int(body_length),
            },
            ensure_ascii=False,
            allow_nan=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        return hashlib.sha256(canonical).hexdigest()

    def _post_response(
        self,
        request: Mapping[str, Any],
        response: RpcExecutionResponse,
        outcome: str,
    ) -> None:
        operation_id = str(request["operation_id"])
        body_digest = hashlib.sha256(response.body).hexdigest()
        payload: Dict[str, Any] = {
            "operation_id": operation_id,
            "claimed_revision": int(request["claimed_revision"]),
            "outcome": str(outcome),
            "status": int(response.status_code),
            "headers": rpc_execution_kernel.filtered_headers(
                response.headers,
                "response",
            ),
            "body_sha256": body_digest,
            "body_length": len(response.body),
            "body_present": response.has_body,
        }
        if response.has_body:
            if len(response.body) <= relay_contract.limit("inline_body_bytes"):
                payload["body_base64"] = base64.b64encode(response.body).decode("ascii")
            else:
                payload["body_ref"] = self._upload_response_blob(
                    operation_id,
                    response.body,
                    body_digest,
                )
        relay_transport.request_json(
            "POST",
            relay_contract.endpoint(
                "operation_result",
                operation_id=operation_id,
            ),
            payload,
            timeout=relay_contract.duration("request_timeout_seconds"),
            action="operation.result.submit",
        )
        relay_activity_log.success(
            "operation.result.submitted",
            operation_id=operation_id,
            outcome=outcome,
            status=response.status_code,
            body=response.body,
            body_sha256=body_digest,
        )

    def _post_execution_unknown(
        self,
        request: Mapping[str, Any],
        code: str,
    ) -> None:
        operation_id = str(request["operation_id"])
        relay_transport.request_json(
            "POST",
            relay_contract.endpoint(
                "operation_result",
                operation_id=operation_id,
            ),
            {
                "operation_id": operation_id,
                "claimed_revision": int(request["claimed_revision"]),
                "outcome": RELAY_EXECUTION_UNKNOWN,
                "error": {"code": str(code)},
                "body_sha256": hashlib.sha256(b"").hexdigest(),
                "body_length": 0,
                "body_present": False,
            },
            action="operation.result.unknown",
        )

    def _upload_response_blob(
        self,
        operation_id: str,
        body: bytes,
        body_digest: str,
    ) -> str:
        allocation = relay_transport.request_json(
            "POST",
            relay_contract.endpoint(
                "response_blob_allocate",
                operation_id=operation_id,
            ),
            {
                "operation_id": operation_id,
                "direction": "response",
                "expected_sha256": body_digest,
                "expected_length": len(body),
            },
            action="operation.response_blob.allocate",
        )
        blob = allocation.get("blob") if isinstance(allocation.get("blob"), dict) else allocation
        blob_id = str(blob.get("blob_id") or "")
        if not blob_id:
            raise RuntimeError("relay_response_blob_id_missing")
        chunk_size = relay_contract.limit("blob_chunk_bytes")
        for chunk_index, offset in enumerate(range(0, len(body), chunk_size)):
            chunk = body[offset : offset + chunk_size]
            relay_transport.request_bytes(
                "PUT",
                relay_contract.endpoint(
                    "response_blob_chunk",
                    blob_id=blob_id,
                    chunk_index=chunk_index,
                ),
                body=chunk,
                action="operation.response_blob.chunk",
            )
        relay_transport.request_json(
            "POST",
            relay_contract.endpoint("response_blob_finalize", blob_id=blob_id),
            {
                "blob_id": blob_id,
                "expected_sha256": body_digest,
                "expected_length": len(body),
            },
            action="operation.response_blob.finalize",
        )
        return blob_id


relay_operation_processor = RelayOperationProcessor()


__all__ = ["relay_operation_processor"]
