# -*- coding: utf-8 -*-
"""Single SSE request reader for Relay Fabric V3."""

from __future__ import annotations

import threading
from typing import Any, Dict

from pycore.pyctl.relay.fabric.fabric_frames import (
    decode_request,
    error_frames,
    validate_request,
)
from pycore.pyctl.relay.fabric.fabric_grant import relay_fabric_grant
from pycore.pyctl.relay.fabric.fabric_state import (
    FABRIC_STOP_SIGNAL,
    FABRIC_SUBSCRIBER_SIGNAL,
    FABRIC_GRANT_READY_SIGNAL,
    FABRIC_VERDICT_EXECUTE,
    FABRIC_VERDICT_EXPIRED,
    FABRIC_VERDICT_FORBIDDEN,
    FABRIC_VERDICT_INFLIGHT,
    FABRIC_VERDICT_OVERLOAD,
    FABRIC_VERDICT_REPLAY,
    FABRIC_WAKE_SIGNAL,
    FABRIC_WORK_QUEUE,
    fabric_local_ms,
    relay_fabric_state,
)
from pycore.pyctl.relay.fabric.fabric_worker import publish_frames
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.mercure_client import (
    MERCURE_STATE_ONLINE,
    MercureSubscriber,
    MercureUpdate,
)
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.relay_fabric_contract import relay_fabric_contract


FABRIC_READER_THREAD = "RelayFabricReaderThread"
FABRIC_GRANT_WAIT_SECONDS = 1.0
FABRIC_ERROR_DEVICE_OVERLOAD = "device_fabric_unavailable"
FABRIC_SSE_FRAME_MARGIN_BYTES = 4096
FABRIC_READ_TIMEOUT_HEARTBEATS = 2


class FabricReaderThread(threading.Thread):
    """Hold one hub subscription on the request topic and dispatch valid frames."""

    def __init__(self) -> None:
        super().__init__(name=FABRIC_READER_THREAD, daemon=True)

    @staticmethod
    def _should_stop() -> bool:
        return THREAD_BUS.is_shutdown_requested() or bool(
            THREAD_BUS.get_signal(FABRIC_STOP_SIGNAL, False)
        )

    @staticmethod
    def _wait(seconds: float) -> None:
        THREAD_BUS.wait_signal(FABRIC_STOP_SIGNAL, timeout=max(0.01, seconds))

    def run(self) -> None:
        while not self._should_stop():
            grant = relay_fabric_state.grant()
            if not grant:
                THREAD_BUS.wait_signal(FABRIC_GRANT_READY_SIGNAL, timeout=FABRIC_GRANT_WAIT_SECONDS)
                continue
            hub_url = str(grant["hub_url"])
            request_topic = str(grant["request_topic"])
            subscriber = MercureSubscriber(
                hub_url,
                [request_topic],
                self._authorization,
                on_update=self._update,
                on_state_change=self._state_changed,
                connect_timeout=relay_contract.duration("subscriber_connect_timeout_seconds"),
                read_timeout=min(
                    relay_contract.duration("subscriber_read_timeout_seconds"),
                    relay_fabric_contract.duration("device_heartbeat_seconds") * FABRIC_READ_TIMEOUT_HEARTBEATS,
                ),
                reconnect_min_seconds=relay_contract.duration("subscriber_reconnect_min_seconds"),
                reconnect_max_seconds=relay_contract.duration("subscriber_reconnect_max_seconds"),
                max_event_bytes=relay_fabric_contract.limit("frame_bytes") + FABRIC_SSE_FRAME_MARGIN_BYTES,
            )
            THREAD_BUS.signal(FABRIC_SUBSCRIBER_SIGNAL, subscriber)
            subscriber.run(
                lambda: self._should_stop() or self._target_changed(hub_url, request_topic),
                self._wait,
            )
            THREAD_BUS.clear_signal(FABRIC_SUBSCRIBER_SIGNAL)
            if relay_fabric_state.set_stream_connected(False):
                THREAD_BUS.signal(FABRIC_WAKE_SIGNAL, True)

    @staticmethod
    def _target_changed(hub_url: str, request_topic: str) -> bool:
        grant = relay_fabric_state.grant()
        return bool(grant) and (
            str(grant["hub_url"]) != hub_url or str(grant["request_topic"]) != request_topic
        )

    @staticmethod
    def _authorization(force: bool) -> Dict[str, Any]:
        relay_fabric_grant.ensure_fresh(force)
        grant = relay_fabric_state.grant()
        if not grant:
            raise RuntimeError("relay_fabric_grant_unavailable")
        return {
            "token": grant["subscriber_token"],
            "token_ttl_seconds": relay_fabric_state.grant_remaining_seconds(),
        }

    @staticmethod
    def _state_changed(state: str, detail: str) -> None:
        if not relay_fabric_state.set_stream_connected(state == MERCURE_STATE_ONLINE):
            return
        relay_activity_log.info("fabric.stream.state", state=state, detail=detail)
        THREAD_BUS.signal(FABRIC_WAKE_SIGNAL, True)

    def _update(self, update: MercureUpdate) -> None:
        if update.type != relay_fabric_contract.event_type("request"):
            return
        dev_recv = fabric_local_ms()
        document = decode_request(update.data)
        if document is None:
            relay_activity_log.debug("fabric.request.dropped", reason="frame_invalid")
            return
        op = str(document["op"])
        owner = str(document["owner"])
        verdict, topic, cached = relay_fabric_state.admit(
            op,
            str(document["pair"]),
            owner,
            int(document["dl"]),
        )
        if verdict in (FABRIC_VERDICT_EXPIRED, FABRIC_VERDICT_INFLIGHT):
            relay_activity_log.debug("fabric.request.dropped", op=op, reason=verdict)
            return
        if verdict == FABRIC_VERDICT_FORBIDDEN:
            relay_activity_log.warning("fabric.request.dropped", op=op, reason=verdict)
            return
        if verdict == FABRIC_VERDICT_REPLAY:
            relay_activity_log.debug("fabric.request.replayed", op=op)
            publish_frames(topic, op, cached, dev_recv)
            return
        if verdict == FABRIC_VERDICT_OVERLOAD:
            relay_activity_log.warning("fabric.request.overloaded", op=op)
            publish_frames(
                topic,
                op,
                error_frames(
                    op,
                    relay_fabric_contract.error_status("device_fabric_unavailable"),
                    FABRIC_ERROR_DEVICE_OVERLOAD,
                ),
                dev_recv,
            )
            return
        job, error = validate_request(document)
        if job is None:
            status, code = error
            frames = error_frames(op, status, code)
            relay_fabric_state.complete(op, owner, frames)
            relay_activity_log.debug("fabric.request.rejected", op=op, status=status, code=code)
            publish_frames(topic, op, frames, dev_recv)
            return
        job["topic"] = topic
        job["dev_recv"] = dev_recv
        THREAD_BUS.send_message(FABRIC_WORK_QUEUE, job)
        relay_activity_log.debug("fabric.request.queued", op=op, method=job["method"], path=job["path"])


__all__ = ["FABRIC_READER_THREAD", "FabricReaderThread"]
