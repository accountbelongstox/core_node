# -*- coding: utf-8 -*-
"""Single-thread keep-alive publisher of Relay Fabric V3 response frames to the hub."""

from __future__ import annotations

import threading
from typing import Any, Dict, List

from pycore.pyctl.relay.fabric.fabric_frames import serialize_frame
from pycore.pyctl.relay.fabric.fabric_grant import relay_fabric_grant
from pycore.pyctl.relay.fabric.fabric_state import (
    FABRIC_PUBLISH_QUEUE,
    FABRIC_STOP_MESSAGE,
    fabric_local_ms,
    relay_fabric_state,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.laravel_http_transport import (
    close_thread_laravel_session,
    create_laravel_http_session,
)
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.relay_fabric_contract import relay_fabric_contract


FABRIC_PUBLISHER_THREAD = "RelayFabricPublisherThread"
FABRIC_PUBLISH_ATTEMPTS = 2
FABRIC_HTTP_UNAUTHORIZED = (401, 403)


class FabricPublisherThread(threading.Thread):
    """Drain the publish queue through one dedicated keep-alive HTTP session."""

    def __init__(self) -> None:
        super().__init__(name=FABRIC_PUBLISHER_THREAD, daemon=True)

    def run(self) -> None:
        session, _options, _transport = create_laravel_http_session()
        relay_activity_log.debug("fabric.publisher.started")
        while True:
            job = THREAD_BUS.receive_message(FABRIC_PUBLISH_QUEUE, block=True)
            if not isinstance(job, dict) or job.get("kind") == FABRIC_STOP_MESSAGE["kind"]:
                break
            self._publish(session, job)
        close_thread_laravel_session()
        relay_activity_log.debug("fabric.publisher.stopped")

    def _publish(self, session: Any, job: Dict[str, Any]) -> None:
        frames: List[Dict[str, Any]] = job["frames"]
        for frame in frames:
            payload = dict(frame)
            payload["t"] = {
                **frame["t"],
                "dev_recv": int(job["dev_recv"]),
                "dev_send": fabric_local_ms(),
            }
            if not self._post(session, str(job["topic"]), serialize_frame(payload)):
                relay_activity_log.error(
                    "fabric.publish.dropped",
                    op=job["op"],
                    part=frame["part"]["i"],
                    part_count=frame["part"]["n"],
                )
                return
        relay_activity_log.debug(
            "fabric.publish.completed",
            op=job["op"],
            frame_count=len(frames),
        )

    def _post(self, session: Any, topic: str, data: str) -> bool:
        form = {
            "topic": topic,
            "private": "1",
            "type": relay_fabric_contract.event_type("response"),
            "data": data,
        }
        timeout = (
            relay_contract.duration("subscriber_connect_timeout_seconds"),
            relay_fabric_contract.duration("publish_timeout_seconds"),
        )
        for attempt in range(FABRIC_PUBLISH_ATTEMPTS):
            grant = relay_fabric_state.grant()
            if not grant:
                return False
            try:
                response = session.post(
                    grant["hub_url"],
                    data=form,
                    headers={"Authorization": "Bearer " + grant["publish_token"]},
                    timeout=timeout,
                    allow_redirects=False,
                )
            except Exception as error:  # noqa: BLE001 - one lost frame times out at the deadline
                relay_activity_log.warning(
                    "fabric.publish.request.failed",
                    attempt=attempt + 1,
                    error_type=type(error).__name__,
                    error=error,
                )
                continue
            status = int(response.status_code)
            if 200 <= status < 300:
                return True
            relay_activity_log.warning(
                "fabric.publish.rejected",
                attempt=attempt + 1,
                status=status,
            )
            if status in FABRIC_HTTP_UNAUTHORIZED and attempt + 1 < FABRIC_PUBLISH_ATTEMPTS:
                try:
                    relay_fabric_grant.ensure_fresh(True)
                except Exception as error:  # noqa: BLE001 - heartbeat loop reports its own failures
                    relay_activity_log.error(
                        "fabric.grant.refresh.failed",
                        error_type=type(error).__name__,
                        error=error,
                    )
                    return False
                continue
            return False
        return False


__all__ = ["FABRIC_PUBLISHER_THREAD", "FabricPublisherThread"]
