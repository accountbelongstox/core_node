# -*- coding: utf-8 -*-
"""Bounded Relay Fabric V3 worker threads running the shared RPC kernel."""

from __future__ import annotations

import threading
import time
from typing import Any, Dict, List

from pycore.pyctl.relay.fabric.fabric_frames import error_frames, response_frames
from pycore.pyctl.relay.fabric.fabric_state import (
    FABRIC_PUBLISH_QUEUE,
    FABRIC_STOP_MESSAGE,
    FABRIC_WORK_QUEUE,
    relay_fabric_state,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.rpc_v2.execution import RpcExecutionError, rpc_execution_kernel


FABRIC_WORKER_THREAD_SUFFIX = "Thread"
FABRIC_WORKER_THREAD_PREFIX = "RelayFabricWorker"
FABRIC_ERROR_EXECUTION_TIMEOUT = "rpc_execution_timeout"
FABRIC_ERROR_EXECUTION_FAILED = "rpc_execution_failed"
FABRIC_STATUS_GATEWAY_TIMEOUT = 504
FABRIC_STATUS_INTERNAL_ERROR = 500


def publish_frames(
    topic: str,
    op: str,
    frames: List[Dict[str, Any]],
    dev_recv: int,
) -> None:
    THREAD_BUS.send_message(
        FABRIC_PUBLISH_QUEUE,
        {"op": op, "topic": topic, "frames": frames, "dev_recv": int(dev_recv)},
    )


class FabricWorkerThread(threading.Thread):
    """Execute queued fast-lane requests until a stop message arrives."""

    def __init__(self, index: int) -> None:
        super().__init__(
            name=f"{FABRIC_WORKER_THREAD_PREFIX}{index}{FABRIC_WORKER_THREAD_SUFFIX}",
            daemon=True,
        )

    def run(self) -> None:
        while True:
            job = THREAD_BUS.receive_message(FABRIC_WORK_QUEUE, block=True)
            if not isinstance(job, dict) or job.get("kind") == FABRIC_STOP_MESSAGE["kind"]:
                return
            self._process(job)

    def _process(self, job: Dict[str, Any]) -> None:
        op = str(job["op"])
        owner = str(job["owner"])
        if relay_fabric_state.server_now_ms() >= int(job["deadline_ms"]):
            relay_fabric_state.abandon(op, owner)
            relay_activity_log.debug("fabric.request.expired", op=op, stage="queued")
            return
        started = time.monotonic()
        try:
            response = rpc_execution_kernel.execute_relay(
                job["method"],
                job["path"],
                job["query"],
                job["headers"],
                job["body"],
                op,
                job["pair"],
                owner,
            )
            exec_ms = int((time.monotonic() - started) * 1000)
            frames = response_frames(
                op,
                response.status_code,
                response.headers,
                response.body,
                exec_ms,
            )
        except RpcExecutionError as error:
            frames = error_frames(op, error.status_code, error.code)
        except TimeoutError:
            frames = error_frames(op, FABRIC_STATUS_GATEWAY_TIMEOUT, FABRIC_ERROR_EXECUTION_TIMEOUT)
        except Exception as error:  # noqa: BLE001 - every request must end in one response frame
            relay_activity_log.error(
                "fabric.rpc.dispatch.failed",
                op=op,
                error_type=type(error).__name__,
                error=error,
            )
            frames = error_frames(op, FABRIC_STATUS_INTERNAL_ERROR, FABRIC_ERROR_EXECUTION_FAILED)
        relay_fabric_state.complete(op, owner, frames)
        if relay_fabric_state.server_now_ms() >= int(job["deadline_ms"]):
            relay_activity_log.debug("fabric.request.expired", op=op, stage="executed")
            return
        publish_frames(str(job["topic"]), op, frames, int(job["dev_recv"]))
        relay_activity_log.debug(
            "fabric.request.executed",
            op=op,
            method=job["method"],
            path=job["path"],
            status=frames[0]["s"],
            exec_ms=frames[0]["t"]["exec_ms"],
        )


__all__ = ["FabricWorkerThread", "publish_frames"]
