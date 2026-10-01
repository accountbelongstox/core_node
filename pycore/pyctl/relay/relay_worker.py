# -*- coding: utf-8 -*-
"""Bounded relay worker threads running the shared RPC kernel."""

from __future__ import annotations

import hashlib
import threading
import time
from typing import Any, Dict, List

from pycore.pyctl.relay.relay_frames import (
    ack_frames,
    blob_frames,
    error_frames,
    fits_inline,
    progress_frames,
    response_frames,
)
from pycore.pyctl.relay.relay_publisher import publish_frames
from pycore.pyctl.relay.relay_state import (
    RELAY_STOP_MESSAGE,
    RELAY_STOP_SIGNAL,
    RELAY_WORK_QUEUE,
    relay_state,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.http_client import HttpError
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import (
    RELAY_DELIVERY_READ,
    relay_contract,
)
from pycore.pyutils.common.relay_execution_ledger import (
    RELAY_EXECUTE,
    RELAY_EXECUTION_UNKNOWN,
    RELAY_REPLAY_RESPONSE,
    relay_execution_ledger,
)
from pycore.pyutils.common.relay_identity import relay_device_identity
from pycore.pyutils.common.relay_progress import relay_progress
from pycore.pyutils.common.rpc_response import RpcExecutionResponse
from pycore.pyutils.laravel.relay_transport import RelayHttpError, relay_transport
from pycore.pyutils.rpc.execution import RpcExecutionError, rpc_execution_kernel


RELAY_WORKER_THREAD_PREFIX = "RelayWorker"
RELAY_WORKER_THREAD_SUFFIX = "Thread"
RELAY_PROGRESS_THREAD = "RelayProgressThread"
RELAY_ERROR_EXECUTION_TIMEOUT = "rpc_execution_timeout"
RELAY_ERROR_EXECUTION_FAILED = "rpc_execution_failed"
RELAY_ERROR_BODY_UNAVAILABLE = "relay_request_body_unavailable"
RELAY_ERROR_BODY_DIGEST = "relay_request_body_digest_conflict"
RELAY_ERROR_BODY_LENGTH = "relay_request_body_length_conflict"
RELAY_ERROR_RESPONSE_LIMIT = "relay_response_body_limit_exceeded"
RELAY_STATUS_BAD_REQUEST = 400
RELAY_STATUS_TOO_LARGE = 413
RELAY_STATUS_INTERNAL_ERROR = 500
RELAY_STATUS_GATEWAY_TIMEOUT = 504


class RelayWorkerThread(threading.Thread):
    """Execute queued requests until a stop message arrives."""

    def __init__(self, index: int) -> None:
        super().__init__(
            name=f"{RELAY_WORKER_THREAD_PREFIX}{index}{RELAY_WORKER_THREAD_SUFFIX}",
            daemon=True,
        )

    def run(self) -> None:
        while True:
            job = THREAD_BUS.receive_message(RELAY_WORK_QUEUE, block=True)
            if not isinstance(job, dict) or job.get("kind") == RELAY_STOP_MESSAGE["kind"]:
                return
            try:
                self._process(job)
            except Exception as error:  # noqa: BLE001 - the worker loop must outlive one failed job
                relay_state.abandon(str(job["op"]), str(job["owner"]))
                relay_activity_log.error(
                    "request.process.failed",
                    op=job["op"],
                    error_type=type(error).__name__,
                    error=error,
                )

    def _process(self, job: Dict[str, Any]) -> None:
        op = str(job["op"])
        owner = str(job["owner"])
        topic = str(job["topic"])
        if relay_state.server_now_ms() >= int(job["deadline_ms"]):
            relay_state.abandon(op, owner)
            relay_activity_log.debug("request.expired", op=op, stage="queued")
            return
        if job["ack"]:
            publish_frames(topic, op, ack_frames(op), int(job["dev_recv"]))
        started = time.monotonic()
        relay_progress.begin(op, lambda phase, done, total, byte_count: publish_frames(
            topic, op, progress_frames(op, phase, done, total, byte_count), int(job["dev_recv"])
        ))
        frames = self._execute(job, started)
        relay_progress.end(op)
        relay_state.complete(op, owner, frames)
        publish_frames(topic, op, frames, int(job["dev_recv"]))
        relay_activity_log.debug(
            "request.executed",
            op=op,
            method=job["method"],
            path=job["path"],
            status=frames[0]["s"],
            exec_ms=frames[0]["t"]["exec_ms"],
        )

    def _execute(self, job: Dict[str, Any], started: float) -> List[Dict[str, Any]]:
        op = str(job["op"])
        body, error = self._request_body(job)
        if error is not None:
            return error_frames(op, RELAY_STATUS_BAD_REQUEST, error)
        ledgered = job["delivery"] != RELAY_DELIVERY_READ
        request_digest = relay_contract.request_digest(
            job["method"],
            job["path"],
            job["query"],
            job["headers"],
            bool(job["body_present"]),
            hashlib.sha256(body).hexdigest(),
            len(body),
        )
        if ledgered:
            admission = relay_execution_ledger.admit(
                op,
                relay_device_identity.device_id(),
                request_digest,
                job["route"],
                job["delivery"],
            )
            if admission["action"] == RELAY_REPLAY_RESPONSE:
                return self._frames_for(op, relay_execution_ledger.response(admission["result"]), 0, job)
            if admission["action"] == RELAY_EXECUTION_UNKNOWN:
                return error_frames(op, relay_contract.error_status("execution_unknown"), RELAY_EXECUTION_UNKNOWN)
            relay_execution_ledger.mark_started(op)
        try:
            response = rpc_execution_kernel.execute_relay(
                job["method"],
                job["path"],
                job["query"],
                job["headers"],
                body,
                op,
                job["pair"],
                job["owner"],
            )
        except RpcExecutionError as error:
            return self._failed(job, request_digest, error.status_code, error.code, ledgered)
        except TimeoutError:
            if ledgered:
                relay_execution_ledger.mark_unknown(op, RELAY_ERROR_EXECUTION_TIMEOUT)
                return error_frames(op, relay_contract.error_status("execution_unknown"), RELAY_EXECUTION_UNKNOWN)
            return error_frames(op, RELAY_STATUS_GATEWAY_TIMEOUT, RELAY_ERROR_EXECUTION_TIMEOUT)
        except Exception as error:  # noqa: BLE001 - every request must end in one result frame
            relay_activity_log.error(
                "rpc.dispatch.failed",
                op=op,
                error_type=type(error).__name__,
                error=error,
            )
            return self._failed(job, request_digest, RELAY_STATUS_INTERNAL_ERROR, RELAY_ERROR_EXECUTION_FAILED, ledgered)
        if len(response.body) > relay_contract.limit("response_body_bytes"):
            return self._failed(job, request_digest, RELAY_STATUS_TOO_LARGE, RELAY_ERROR_RESPONSE_LIMIT, ledgered)
        if ledgered:
            relay_execution_ledger.save_response(op, request_digest, response)
        return self._frames_for(op, response, int((time.monotonic() - started) * 1000), job)

    @staticmethod
    def _request_body(job: Dict[str, Any]) -> tuple:
        if not job["body_ref"]:
            return job["body"], None
        try:
            body = relay_transport.download_request_blob(job["body_ref"])
        except (HttpError, RelayHttpError) as error:
            relay_activity_log.error(
                "request.blob.download.failed",
                op=job["op"],
                error_type=type(error).__name__,
                error=error,
            )
            return b"", RELAY_ERROR_BODY_UNAVAILABLE
        if len(body) != int(job["body_length"]):
            return b"", RELAY_ERROR_BODY_LENGTH
        if hashlib.sha256(body).hexdigest() != job["body_sha256"]:
            return b"", RELAY_ERROR_BODY_DIGEST
        return body, None

    @staticmethod
    def _failed(job: Dict[str, Any], request_digest: str, status: int, code: str, ledgered: bool) -> List[Dict[str, Any]]:
        op = str(job["op"])
        response = rpc_execution_kernel.error_response(code, status, op)
        if ledgered:
            relay_execution_ledger.save_response(op, request_digest, response, failed=True)
        return RelayWorkerThread._frames_for(op, response, 0, job)

    @staticmethod
    def _frames_for(
        op: str,
        response: RpcExecutionResponse,
        exec_ms: int,
        job: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        headers = rpc_execution_kernel.filtered_headers(response.headers, "response")
        if fits_inline(response.body):
            return response_frames(op, response.status_code, headers, response.body, exec_ms)
        try:
            reference = relay_transport.upload_response_blob(op, str(job["pair"]), response.body)
        except (HttpError, RelayHttpError) as error:
            relay_activity_log.error(
                "response.blob.upload.failed",
                op=op,
                error_type=type(error).__name__,
                error=error,
            )
            return error_frames(op, relay_contract.error_status("relay_unavailable"), "relay_unavailable")
        return blob_frames(
            op,
            response.status_code,
            headers,
            len(response.body),
            hashlib.sha256(response.body).hexdigest(),
            reference,
            exec_ms,
        )


class RelayProgressThread(threading.Thread):
    """Emit a heartbeat progress frame for every relayed operation that stays silent."""

    def __init__(self) -> None:
        super().__init__(name=RELAY_PROGRESS_THREAD, daemon=True)

    def run(self) -> None:
        interval = relay_contract.duration("progress_min_interval_seconds")
        while not THREAD_BUS.is_shutdown_requested() and not THREAD_BUS.get_signal(RELAY_STOP_SIGNAL, False):
            THREAD_BUS.wait_signal(RELAY_STOP_SIGNAL, timeout=interval)
            try:
                relay_progress.emit_due()
            except Exception as error:  # noqa: BLE001 - liveness must outlive one failed emit
                relay_activity_log.error("progress.emit.failed", error_type=type(error).__name__, error=error)


__all__ = ["RelayProgressThread", "RelayWorkerThread"]
