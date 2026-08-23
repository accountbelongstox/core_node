# -*- coding: utf-8 -*-
"""Durable, minimum-step execution ledger for claimed Relay operations."""

from __future__ import annotations

from typing import Any, Dict

from pycore.pyutils.common.operation_service import OperationService
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.rpc_response import (
    RpcExecutionResponse,
    rpc_response_digest,
)


RELAY_OPERATION_KIND = "pycore_relay_v2"
RELAY_OPERATION_SCOPE_PREFIX = "relay:"
RELAY_EXECUTE = "execute"
RELAY_REPLAY_RESPONSE = "replay_response"
RELAY_EXECUTION_UNKNOWN = "execution_unknown"


class RelayExecutionLedger:
    """Compose OperationService with byte-exact Relay response persistence."""

    def __init__(self) -> None:
        self.operations = OperationService()
        self.repo = self.operations.repo

    def admit(
        self,
        operation_id: str,
        device_id: str,
        request_digest: str,
        route: str,
        retry_policy: str,
    ) -> Dict[str, Any]:
        scope = RELAY_OPERATION_SCOPE_PREFIX + str(operation_id)
        operation = self.operations.create_external_or_get(
            operation_id,
            RELAY_OPERATION_KIND,
            scope,
            request_digest,
            retry_policy,
            client_id=device_id,
        )
        result = self.repo.ensure_relay_execution_result(
            operation_id,
            request_digest,
            route,
            retry_policy,
        )
        if result.get("response_digest"):
            relay_activity_log.info(
                "ledger.response.replay",
                operation_id=operation_id,
                request_digest=request_digest,
                response_digest=result["response_digest"],
            )
            return {"action": RELAY_REPLAY_RESPONSE, "result": result}
        if operation.status == "pending":
            relay_activity_log.info(
                "ledger.execution.awaiting_server_fence",
                operation_id=operation_id,
                request_digest=request_digest,
                retry_policy=retry_policy,
                route=route,
            )
            return {"action": RELAY_EXECUTE, "result": result}
        if operation.status == "running" and retry_policy in (
            "read",
            "idempotent_write",
        ):
            relay_activity_log.warning(
                "ledger.execution.recovered",
                operation_id=operation_id,
                request_digest=request_digest,
                retry_policy=retry_policy,
                route=route,
            )
            return {"action": RELAY_EXECUTE, "result": result}
        if operation.status == "running":
            self.operations.fail(
                operation_id,
                {"code": RELAY_EXECUTION_UNKNOWN},
                message="operation.execution_unknown",
                stage=RELAY_EXECUTION_UNKNOWN,
            )
            relay_activity_log.error(
                "ledger.execution.unknown",
                operation_id=operation_id,
                request_digest=request_digest,
                retry_policy=retry_policy,
                route=route,
            )
            return {"action": RELAY_EXECUTION_UNKNOWN, "result": result}
        if operation.stage == RELAY_EXECUTION_UNKNOWN:
            return {"action": RELAY_EXECUTION_UNKNOWN, "result": result}
        raise RuntimeError("relay_operation_terminal_without_response")

    def mark_started(self, operation_id: str) -> None:
        operation = self.operations.get_operation(operation_id)
        if operation is None:
            raise RuntimeError("relay_operation_missing")
        if operation.status == "pending":
            self.operations.start(
                operation_id,
                stage="executing",
                message="operation.execution_started",
                expected_revision=operation.revision,
            )
        relay_activity_log.success(
            "ledger.execution.started",
            operation_id=operation_id,
        )

    def save_response(
        self,
        operation_id: str,
        request_digest: str,
        response: RpcExecutionResponse,
        failed: bool = False,
    ) -> Dict[str, Any]:
        response_digest = rpc_response_digest(response)
        result = self.repo.save_relay_execution_response(
            operation_id,
            request_digest,
            response.status_code,
            response.headers,
            response.body,
            response.has_body,
            response_digest,
            "failed" if failed else "responded",
        )
        operation = self.operations.get_operation(operation_id)
        if operation is None:
            raise RuntimeError("relay_operation_missing")
        summary = {
            **dict(operation.summary_json or {}),
            "response_digest": response_digest,
            "response_length": len(response.body),
            "response_status": response.status_code,
            "response_has_body": response.has_body,
        }
        if failed:
            self.operations.fail(
                operation_id,
                {"code": "rpc_execution_failed"},
                message="operation.execution_failed",
            )
        else:
            self.operations.complete(
                operation_id,
                message="operation.response_persisted",
                summary=summary,
            )
        relay_activity_log.success(
            "ledger.response.persisted",
            operation_id=operation_id,
            request_digest=request_digest,
            response_digest=response_digest,
            response_length=len(response.body),
            response_status=response.status_code,
            failed=failed,
        )
        return result

    def mark_unknown(self, operation_id: str, code: str) -> None:
        operation = self.operations.get_operation(operation_id)
        if operation is None:
            raise RuntimeError("relay_operation_missing")
        if operation.stage != RELAY_EXECUTION_UNKNOWN:
            self.operations.fail(
                operation_id,
                {"code": str(code)},
                message="operation.execution_unknown",
                stage=RELAY_EXECUTION_UNKNOWN,
            )
        relay_activity_log.error(
            "ledger.execution.unknown",
            operation_id=operation_id,
            code=code,
        )

    @staticmethod
    def response(result: Dict[str, Any]) -> RpcExecutionResponse:
        body = result.get("response_body")
        if body is None:
            raise RuntimeError("relay_response_body_missing")
        return RpcExecutionResponse(
            int(result["response_status"]),
            {
                str(key): str(value)
                for key, value in dict(result.get("response_headers") or {}).items()
            },
            bytes(body),
            bool(result.get("response_has_body")),
        )


relay_execution_ledger = RelayExecutionLedger()


__all__ = [
    "RELAY_EXECUTE",
    "RELAY_EXECUTION_UNKNOWN",
    "RELAY_REPLAY_RESPONSE",
    "relay_execution_ledger",
]
