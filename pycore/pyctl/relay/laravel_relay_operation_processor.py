# -*- coding: utf-8 -*-
"""Claimed Relay operation validation, in-process execution, and completion."""

from __future__ import annotations

import base64
import hashlib
import time
from typing import Any, Callable, Dict, Iterable, Mapping

from pycore.pyfoundations.serialized_worker import map_bus_tasks, start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.relay_execution_ledger import (
    RELAY_EXECUTE,
    RELAY_EXECUTION_UNKNOWN,
    RELAY_REPLAY_RESPONSE,
    relay_execution_ledger,
)
from pycore.pyutils.common.relay_identity import relay_device_identity
from pycore.pyutils.common.rpc_response import rpc_response_digest
from pycore.pyutils.laravel.relay_transport import (
    RelayHttpError,
    laravel_relay_transport,
)
from pycore.pyutils.rpc_v2.execution import (
    RpcExecutionError,
    RpcExecutionResponse,
    rpc_execution_kernel,
)


RELAY_RESULT_RESPONDED = "responded"
RELAY_RESULT_FAILED = "failed"
RELAY_RESULT_CANCELED = "canceled"
RELAY_RESULT_EXPIRED = "expired"
RELAY_LEASE_STOP_PREFIX = "relay.v2.operation.lease.stop"
RELAY_LEASE_LOST_PREFIX = "relay.v2.operation.lease.lost"
RELAY_LEASE_DEADLINE_PREFIX = "relay.v2.operation.lease.deadline"


class LaravelRelayOperationProcessor:
    """Execute Laravel Relay operations as independently retryable steps."""

    def process_many(
        self,
        operations: Iterable[Mapping[str, Any]],
        lease_owner: str,
    ) -> None:
        items = []
        operation_ids = set()
        for descriptor in operations:
            operation_id = str(descriptor.get("operation_id") or "")
            if operation_id and operation_id in operation_ids:
                relay_activity_log.warning(
                    "operation.claim.duplicate_ignored",
                    operation_id=operation_id,
                )
                continue
            if operation_id:
                operation_ids.add(operation_id)
            items.append((dict(descriptor), str(lease_owner)))
        if not items:
            return
        relay_activity_log.info(
            "operation.batch.started",
            operation_count=len(items),
            lease_owner=lease_owner,
        )
        map_bus_tasks(
            self._process_item,
            items,
            max_workers=relay_contract.limit("device_active_leases"),
            thread_prefix="RelayV2Operation",
        )
        relay_activity_log.success(
            "operation.batch.completed",
            operation_count=len(items),
            lease_owner=lease_owner,
        )

    def _process_item(self, item: tuple) -> None:
        descriptor, lease_owner = item
        operation_id = str(descriptor.get("operation_id") or "")
        try:
            self.process(descriptor, lease_owner)
        except Exception as error:
            relay_activity_log.error(
                "operation.processing.interrupted",
                operation_id=operation_id,
                error_type=type(error).__name__,
                error=error,
            )

    def process(
        self,
        descriptor: Mapping[str, Any],
        lease_owner: str,
    ) -> None:
        remote_state = str(descriptor.get("state") or "").strip().lower()
        if remote_state in ("cancel_requested", "canceled"):
            laravel_relay_transport.submit_nonexecution(
                descriptor,
                RELAY_RESULT_CANCELED,
                "operation_canceled",
                lease_owner=lease_owner,
            )
            return
        if remote_state == "expired":
            laravel_relay_transport.submit_nonexecution(
                descriptor,
                RELAY_RESULT_EXPIRED,
                "operation_expired",
                lease_owner=lease_owner,
            )
            return
        try:
            request = self._validated_request(descriptor, lease_owner)
        except Exception as error:
            relay_activity_log.error(
                "operation.descriptor.rejected",
                operation_id=descriptor.get("operation_id"),
                error_type=type(error).__name__,
                error=error,
            )
            self._reject_descriptor(descriptor, error, lease_owner)
            return
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
            self._begin_execution(request)
            response = relay_execution_ledger.response(ledger["result"])
            outcome = str(
                ledger["result"].get("response_outcome")
                or RELAY_RESULT_RESPONDED
            )
            self._run_with_lease(
                request,
                self._post_response,
                request,
                response,
                outcome,
            )
            return
        if action == RELAY_EXECUTION_UNKNOWN:
            self._begin_execution(request)
            self._run_with_lease(
                request,
                self._post_execution_unknown,
                request,
                "prior_execution_incomplete",
            )
            return
        if action != RELAY_EXECUTE:
            raise RuntimeError("relay_ledger_action_invalid")
        self._begin_execution(request)
        relay_execution_ledger.mark_started(operation_id)
        self._run_with_lease(request, self._execute, request)

    def _run_with_lease(
        self,
        request: Dict[str, Any],
        callback: Callable[..., None],
        *arguments: Any,
    ) -> None:
        operation_id = str(request["operation_id"])
        claim_epoch = int(request["claim_epoch"])
        stop_signal = f"{RELAY_LEASE_STOP_PREFIX}.{operation_id}.{claim_epoch}"
        lost_signal = f"{RELAY_LEASE_LOST_PREFIX}.{operation_id}.{claim_epoch}"
        deadline_signal = (
            f"{RELAY_LEASE_DEADLINE_PREFIX}.{operation_id}.{claim_epoch}"
        )
        THREAD_BUS.clear_signal(stop_signal)
        THREAD_BUS.clear_signal(lost_signal)
        THREAD_BUS.signal(deadline_signal, float(request["lease_deadline"]))
        request["lease_lost_signal"] = lost_signal
        request["lease_deadline_signal"] = deadline_signal
        lease_thread = start_bus_task(
            self._lease_renew_loop,
            dict(request),
            stop_signal,
            lost_signal,
            thread_name="RelayV2LeaseRenewThread",
        )
        try:
            self._assert_active_lease(request)
            callback(*arguments)
        finally:
            THREAD_BUS.signal(stop_signal, True)
            lease_thread.join(
                timeout=relay_contract.duration(
                    "operation_lease_shutdown_wait_seconds"
                )
            )
            if lease_thread.is_alive():
                THREAD_BUS.signal(lost_signal, True)
                relay_activity_log.error(
                    "operation.lease.thread.stop_timeout",
                    operation_id=operation_id,
                    claim_epoch=claim_epoch,
                )
                try:
                    start_bus_task(
                        self._cleanup_lease_thread,
                        lease_thread,
                        stop_signal,
                        lost_signal,
                        deadline_signal,
                        thread_name="RelayV2LeaseCleanupThread",
                    )
                except Exception as error:
                    relay_activity_log.error(
                        "operation.lease.thread.cleanup.failed",
                        operation_id=operation_id,
                        claim_epoch=claim_epoch,
                        error_type=type(error).__name__,
                        error=error,
                    )
            else:
                if THREAD_BUS.get_signal(lost_signal, False):
                    relay_activity_log.error(
                        "operation.lease.lost",
                        operation_id=operation_id,
                        claim_epoch=claim_epoch,
                    )
                THREAD_BUS.clear_signal(stop_signal)
                THREAD_BUS.clear_signal(lost_signal)
                THREAD_BUS.clear_signal(deadline_signal)

    @staticmethod
    def _cleanup_lease_thread(
        lease_thread: Any,
        stop_signal: str,
        lost_signal: str,
        deadline_signal: str,
    ) -> None:
        lease_thread.join()
        THREAD_BUS.clear_signal(stop_signal)
        THREAD_BUS.clear_signal(lost_signal)
        THREAD_BUS.clear_signal(deadline_signal)
        relay_activity_log.info(
            "operation.lease.thread.cleanup.completed",
            thread_name=lease_thread.name,
        )

    def _begin_execution(self, request: Dict[str, Any]) -> None:
        operation_id = str(request["operation_id"])
        descriptor_revision = int(request["operation_revision"])
        claimed_state = str(request["remote_state"])
        data = laravel_relay_transport.request_json(
            "POST",
            relay_contract.endpoint(
                "operation_execution_start",
                operation_id=operation_id,
            ),
            {
                "operation_id": operation_id,
                "operation_revision": int(request["operation_revision"]),
                "claim_epoch": int(request["claim_epoch"]),
                "lease_owner": str(request["lease_owner"]),
                "request_digest": str(request["request_digest"]),
                "retry_policy": str(request["retry_policy"]),
            },
            action="operation.execution_start",
            coordinator_url=str(request["coordinator_url"]),
        )
        operation = (
            data.get("operation")
            if isinstance(data.get("operation"), dict)
            else data
        )
        state = str(operation.get("state") or "")
        revision = int(operation.get("revision") or 0)
        claim_epoch = int(operation.get("claim_epoch") or 0)
        server_time = str(operation.get("server_time") or "")
        lease_expires_at = str(operation.get("lease_expires_at") or "")
        if state != "executing":
            raise RuntimeError("relay_execution_start_state_invalid")
        if claim_epoch != int(request["claim_epoch"]):
            raise RuntimeError("relay_execution_start_epoch_conflict")
        if claimed_state == "leased" and revision <= descriptor_revision:
            raise RuntimeError("relay_execution_start_revision_invalid")
        if claimed_state == "executing" and revision != descriptor_revision:
            raise RuntimeError("relay_execution_start_idempotency_conflict")
        lease_deadline = relay_contract.lease_deadline(
            server_time,
            lease_expires_at,
        )
        request["operation_revision"] = revision
        request["lease_server_time"] = server_time
        request["lease_expires_at"] = lease_expires_at
        request["lease_deadline"] = lease_deadline
        relay_activity_log.success(
            "operation.execution_start.confirmed",
            operation_id=operation_id,
            operation_revision=revision,
            claim_epoch=claim_epoch,
            server_time=server_time,
            lease_expires_at=request["lease_expires_at"],
            lease_remaining_seconds=max(0.0, lease_deadline - time.monotonic()),
        )

    def _lease_renew_loop(
        self,
        request: Mapping[str, Any],
        stop_signal: str,
        lost_signal: str,
    ) -> None:
        operation_id = str(request["operation_id"])
        renew_seconds = relay_contract.duration("operation_lease_renew_seconds")
        retry_seconds = relay_contract.duration(
            "subscriber_reconnect_min_seconds"
        )
        max_retry_seconds = relay_contract.duration(
            "subscriber_reconnect_max_seconds"
        )
        deadline_signal = str(request["lease_deadline_signal"])
        lease_deadline = float(request["lease_deadline"])
        wait_seconds = renew_seconds
        while not THREAD_BUS.get_signal(stop_signal, False):
            THREAD_BUS.wait_signal(stop_signal, timeout=wait_seconds)
            if THREAD_BUS.get_signal(stop_signal, False):
                THREAD_BUS.clear_signal(stop_signal)
                return
            try:
                data = laravel_relay_transport.request_json(
                    "POST",
                    relay_contract.endpoint(
                        "operation_lease_renew",
                        operation_id=operation_id,
                    ),
                    {
                        "operation_id": operation_id,
                        "operation_revision": int(request["operation_revision"]),
                        "claim_epoch": int(request["claim_epoch"]),
                        "lease_owner": str(request["lease_owner"]),
                    },
                    action="operation.lease.renew",
                    coordinator_url=str(request["coordinator_url"]),
                )
                operation = (
                    data.get("operation")
                    if isinstance(data.get("operation"), dict)
                    else data
                )
                if str(operation.get("state") or "") != "executing":
                    raise RuntimeError("relay_lease_renew_state_invalid")
                if int(operation.get("claim_epoch") or 0) != int(
                    request["claim_epoch"]
                ):
                    raise RuntimeError("relay_lease_renew_epoch_conflict")
                if int(operation.get("revision") or 0) != int(
                    request["operation_revision"]
                ):
                    raise RuntimeError("relay_lease_renew_revision_conflict")
                server_time = str(operation.get("server_time") or "")
                lease_expires_at = str(operation.get("lease_expires_at") or "")
                lease_deadline = relay_contract.lease_deadline(
                    server_time,
                    lease_expires_at,
                )
                THREAD_BUS.signal(deadline_signal, lease_deadline)
                relay_activity_log.success(
                    "operation.lease.renewed",
                    operation_id=operation_id,
                    operation_revision=request["operation_revision"],
                    claim_epoch=request["claim_epoch"],
                    server_time=server_time,
                    lease_expires_at=lease_expires_at,
                    lease_remaining_seconds=max(
                        0.0,
                        lease_deadline - time.monotonic(),
                    ),
                )
                retry_seconds = relay_contract.duration(
                    "subscriber_reconnect_min_seconds"
                )
                wait_seconds = renew_seconds
            except RelayHttpError as error:
                if error.status_code in (401, 403, 409, 410):
                    THREAD_BUS.signal(lost_signal, True)
                    relay_activity_log.error(
                        "operation.lease.rejected",
                        operation_id=operation_id,
                        operation_revision=request["operation_revision"],
                        claim_epoch=request["claim_epoch"],
                        status=error.status_code,
                    )
                    THREAD_BUS.clear_signal(stop_signal)
                    return
                remaining_seconds = lease_deadline - time.monotonic()
                if remaining_seconds <= 0:
                    THREAD_BUS.signal(lost_signal, True)
                    relay_activity_log.error(
                        "operation.lease.expired",
                        operation_id=operation_id,
                        operation_revision=request["operation_revision"],
                        claim_epoch=request["claim_epoch"],
                        status=error.status_code,
                    )
                    THREAD_BUS.clear_signal(stop_signal)
                    return
                wait_seconds = min(
                    retry_seconds,
                    max_retry_seconds,
                    remaining_seconds,
                )
                retry_seconds = min(max_retry_seconds, retry_seconds * 2)
                relay_activity_log.warning(
                    "operation.lease.renew.retry",
                    operation_id=operation_id,
                    operation_revision=request["operation_revision"],
                    claim_epoch=request["claim_epoch"],
                    status=error.status_code,
                    retry_seconds=wait_seconds,
                )
            except Exception as error:
                remaining_seconds = lease_deadline - time.monotonic()
                if remaining_seconds <= 0:
                    THREAD_BUS.signal(lost_signal, True)
                    relay_activity_log.error(
                        "operation.lease.expired",
                        operation_id=operation_id,
                        operation_revision=request["operation_revision"],
                        claim_epoch=request["claim_epoch"],
                        error_type=type(error).__name__,
                        error=error,
                    )
                    THREAD_BUS.clear_signal(stop_signal)
                    return
                wait_seconds = min(
                    retry_seconds,
                    max_retry_seconds,
                    remaining_seconds,
                )
                retry_seconds = min(max_retry_seconds, retry_seconds * 2)
                relay_activity_log.warning(
                    "operation.lease.renew.retry",
                    operation_id=operation_id,
                    operation_revision=request["operation_revision"],
                    claim_epoch=request["claim_epoch"],
                    error_type=type(error).__name__,
                    error=error,
                    retry_seconds=wait_seconds,
                )
        THREAD_BUS.clear_signal(stop_signal)

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
        expected_lease_owner: str,
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
        descriptor_revision = int(descriptor.get("revision") or 0)
        remote_state = str(descriptor.get("state") or "").strip().lower()
        claim_epoch = int(descriptor.get("claim_epoch") or 0)
        lease_owner = str(descriptor.get("lease_owner") or "")
        lease_expires_at = str(descriptor.get("lease_expires_at") or "")
        coordinator_url = str(descriptor.get("_coordinator_url") or "")
        if not operation_id or not pairing_id or not user_id or not path:
            raise ValueError("relay_operation_descriptor_incomplete")
        if not coordinator_url:
            raise ValueError("relay_operation_coordinator_missing")
        if path != relay_contract.canonical_path(path):
            raise ValueError("relay_operation_path_not_canonical")
        if descriptor_revision <= 0:
            raise ValueError("relay_operation_revision_invalid")
        if remote_state not in ("leased", "executing"):
            raise ValueError("relay_operation_state_invalid")
        if claim_epoch <= 0 or not lease_expires_at:
            raise ValueError("relay_operation_lease_incomplete")
        if not lease_owner or lease_owner != str(expected_lease_owner):
            raise ValueError("relay_operation_lease_owner_conflict")
        route = rpc_execution_kernel.route_path(path)
        policy = relay_contract.route_policy(route, method)
        if str(policy.get("exposure") or "denied") != "relay":
            raise ValueError("relay_operation_route_denied")
        retry_policy = str(policy.get("retry") or "at_most_once_action")
        body_present_value = descriptor.get("body_present")
        if not isinstance(body_present_value, bool):
            raise ValueError("relay_request_body_presence_missing")
        body_present = bool(body_present_value)
        body = laravel_relay_transport.request_body(
            descriptor,
            operation_id,
            body_present,
            coordinator_url,
        )
        body_sha256 = hashlib.sha256(body).hexdigest()
        expected_body_sha256 = str(descriptor.get("body_sha256") or "")
        expected_body_length = int(descriptor.get("body_length") or 0)
        if body_sha256 != expected_body_sha256:
            raise ValueError("relay_request_body_digest_conflict")
        if len(body) != expected_body_length:
            raise ValueError("relay_request_body_length_conflict")
        if len(body) > relay_contract.limit("request_body_bytes"):
            raise ValueError("relay_request_body_limit_exceeded")
        request_digest = relay_contract.request_digest(
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
            "operation_revision": descriptor_revision,
            "remote_state": remote_state,
            "claim_epoch": claim_epoch,
            "lease_owner": lease_owner,
            "lease_expires_at": lease_expires_at,
            "coordinator_url": coordinator_url,
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

    def _post_response(
        self,
        request: Mapping[str, Any],
        response: RpcExecutionResponse,
        outcome: str,
    ) -> None:
        operation_id = str(request["operation_id"])
        self._assert_active_lease(request)
        body_digest = hashlib.sha256(response.body).hexdigest()
        payload: Dict[str, Any] = {
            "operation_id": operation_id,
            "operation_revision": int(request["operation_revision"]),
            "claim_epoch": int(request["claim_epoch"]),
            "lease_owner": str(request["lease_owner"]),
            "outcome": str(outcome),
            "status": int(response.status_code),
            "headers": rpc_execution_kernel.filtered_headers(
                response.headers,
                "response",
            ),
            "body_sha256": body_digest,
            "body_length": len(response.body),
            "body_present": response.has_body,
            "result_digest": rpc_response_digest(response),
        }
        if response.has_body:
            if len(response.body) <= relay_contract.limit("inline_body_bytes"):
                payload["body_base64"] = base64.b64encode(response.body).decode("ascii")
            else:
                payload["body_ref"] = laravel_relay_transport.upload_response_blob(
                    request,
                    response.body,
                    body_digest,
                    self._assert_active_lease,
                )
        laravel_relay_transport.request_json(
            "POST",
            relay_contract.endpoint(
                "operation_result",
                operation_id=operation_id,
            ),
            payload,
            timeout=relay_contract.duration("request_timeout_seconds"),
            action="operation.result.submit",
            coordinator_url=str(request["coordinator_url"]),
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
        self._assert_active_lease(request)
        laravel_relay_transport.request_json(
            "POST",
            relay_contract.endpoint(
                "operation_result",
                operation_id=operation_id,
            ),
            {
                "operation_id": operation_id,
                "operation_revision": int(request["operation_revision"]),
                "claim_epoch": int(request["claim_epoch"]),
                "lease_owner": str(request["lease_owner"]),
                "outcome": RELAY_EXECUTION_UNKNOWN,
                "error": {"code": str(code)},
                "body_sha256": hashlib.sha256(b"").hexdigest(),
                "body_length": 0,
                "body_present": False,
            },
            action="operation.result.unknown",
            coordinator_url=str(request["coordinator_url"]),
        )

    def _reject_descriptor(
        self,
        descriptor: Mapping[str, Any],
        error: Exception,
        lease_owner: str,
    ) -> None:
        error_code = (
            error.code
            if isinstance(error, RpcExecutionError)
            else str(error) or "relay_operation_descriptor_invalid"
        )
        try:
            laravel_relay_transport.submit_nonexecution(
                descriptor,
                RELAY_RESULT_FAILED,
                error_code,
                status=400,
                lease_owner=lease_owner,
            )
        except Exception as submit_error:
            relay_activity_log.error(
                "operation.rejection.submit.failed",
                operation_id=descriptor.get("operation_id"),
                error_type=type(submit_error).__name__,
                error=submit_error,
            )

    @staticmethod
    def _assert_active_lease(request: Mapping[str, Any]) -> None:
        signal = str(request.get("lease_lost_signal") or "")
        if signal and THREAD_BUS.get_signal(signal, False):
            raise RuntimeError("relay_operation_lease_lost")
        deadline_signal = str(request.get("lease_deadline_signal") or "")
        lease_deadline = float(
            THREAD_BUS.get_signal(
                deadline_signal,
                request.get("lease_deadline") or 0,
            )
            or 0
        )
        if lease_deadline <= time.monotonic():
            if signal:
                THREAD_BUS.signal(signal, True)
            raise RuntimeError("relay_operation_lease_expired")


laravel_relay_operation_processor = LaravelRelayOperationProcessor()


__all__ = ["laravel_relay_operation_processor"]
