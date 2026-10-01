# -*- coding: utf-8 -*-
"""Single-thread publisher of relay response frames to the hub."""

from __future__ import annotations

import threading
from typing import Any, Dict, List

from pycore.pyctl.relay.relay_frames import serialize_frame
from pycore.pyctl.relay.relay_grant import relay_grant
from pycore.pyctl.relay.relay_state import (
    RELAY_PUBLISH_QUEUE,
    RELAY_STOP_MESSAGE,
    relay_local_ms,
    relay_state,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.http_client import HttpError
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.relay_transport import RelayHttpError


RELAY_PUBLISHER_THREAD = "RelayPublisherThread"
RELAY_PUBLISH_ATTEMPTS = 2
RELAY_HTTP_UNAUTHORIZED = (401, 403)


def publish_frames(topic: str, op: str, frames: List[Dict[str, Any]], dev_recv: int) -> None:
    THREAD_BUS.send_message(
        RELAY_PUBLISH_QUEUE,
        {"op": op, "topic": topic, "frames": frames, "dev_recv": int(dev_recv)},
    )


class RelayPublisherThread(threading.Thread):
    """Drain the publish queue through the canonical Laravel client."""

    def __init__(self) -> None:
        super().__init__(name=RELAY_PUBLISHER_THREAD, daemon=True)

    def run(self) -> None:
        relay_activity_log.debug("publisher.started")
        while True:
            job = THREAD_BUS.receive_message(RELAY_PUBLISH_QUEUE, block=True)
            if not isinstance(job, dict) or job.get("kind") == RELAY_STOP_MESSAGE["kind"]:
                break
            self._publish(job)
        relay_activity_log.debug("publisher.stopped")

    def _publish(self, job: Dict[str, Any]) -> None:
        frames: List[Dict[str, Any]] = job["frames"]
        for frame in frames:
            payload = dict(frame)
            payload["t"] = {
                **frame["t"],
                "dev_recv": int(job["dev_recv"]),
                "dev_send": relay_local_ms(),
            }
            if not self._post(str(job["topic"]), serialize_frame(payload)):
                relay_activity_log.error(
                    "publish.dropped",
                    op=job["op"],
                    part=frame["part"]["i"],
                    part_count=frame["part"]["n"],
                )
                return
        relay_activity_log.debug("publish.completed", op=job["op"], frame_count=len(frames))

    def _post(self, topic: str, data: str) -> bool:
        form = {
            "topic": topic,
            "private": "1",
            "type": relay_contract.event("response_frame"),
            "data": data,
        }
        timeout = (
            relay_contract.duration("subscriber_connect_timeout_seconds"),
            relay_contract.duration("publish_timeout_seconds"),
        )
        for attempt in range(RELAY_PUBLISH_ATTEMPTS):
            grant = relay_state.grant()
            if not grant or not grant["publish_token"]:
                return False
            try:
                response = laravel_client.request(
                    "POST",
                    grant["hub_url"],
                    data=form,
                    headers={"Authorization": "Bearer " + grant["publish_token"]},
                    timeout=timeout,
                    allow_redirects=False,
                    log_line=False,
                    sensitive_request=True,
                )
            except HttpError as error:
                relay_activity_log.warning(
                    "publish.request.failed",
                    attempt=attempt + 1,
                    error_type=type(error).__name__,
                    error=error,
                )
                continue
            status = int(response.status_code)
            if 200 <= status < 300:
                return True
            relay_activity_log.warning("publish.rejected", attempt=attempt + 1, status=status)
            if status in RELAY_HTTP_UNAUTHORIZED and attempt + 1 < RELAY_PUBLISH_ATTEMPTS:
                if not self._refresh_grant():
                    return False
                continue
            return False
        return False

    @staticmethod
    def _refresh_grant() -> bool:
        try:
            relay_grant.ensure_fresh(True)
        except (HttpError, RelayHttpError, ValueError, RuntimeError) as error:
            relay_activity_log.error(
                "grant.refresh.failed",
                error_type=type(error).__name__,
                error=error,
            )
            return False
        return True


__all__ = ["RELAY_PUBLISHER_THREAD", "RelayPublisherThread", "publish_frames"]
