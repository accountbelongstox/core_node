# -*- coding: utf-8 -*-
"""Single hub subscription on the device request topic."""

from __future__ import annotations

import threading
from typing import Any, Dict

from pycore.pyctl.relay.relay_frames import decode_request, error_frames, validate_request
from pycore.pyctl.relay.relay_grant import relay_grant
from pycore.pyctl.relay.relay_publisher import publish_frames
from pycore.pyctl.relay.relay_state import (
    RELAY_GRANT_READY_SIGNAL,
    RELAY_STOP_SIGNAL,
    RELAY_SUBSCRIBER_SIGNAL,
    RELAY_VERDICT_EXPIRED,
    RELAY_VERDICT_FORBIDDEN,
    RELAY_VERDICT_INFLIGHT,
    RELAY_VERDICT_OVERLOAD,
    RELAY_VERDICT_REPLAY,
    RELAY_WAKE_SIGNAL,
    RELAY_WORK_QUEUE,
    relay_local_ms,
    relay_state,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.relay_identity import relay_device_identity
from pycore.pyutils.laravel.mercure_client import (
    MERCURE_STATE_ONLINE,
    MercureSubscriber,
    MercureUpdate,
)


RELAY_READER_THREAD = "RelayReaderThread"
RELAY_GRANT_WAIT_SECONDS = 1.0
RELAY_ERROR_DEVICE_OVERLOAD = "device_overloaded"
RELAY_SSE_FRAME_MARGIN_BYTES = 4096
RELAY_READ_TIMEOUT_HEARTBEATS = 2


class RelayReaderThread(threading.Thread):
    """Hold one hub subscription on the request topic and dispatch valid frames."""

    def __init__(self) -> None:
        super().__init__(name=RELAY_READER_THREAD, daemon=True)

    @staticmethod
    def _should_stop() -> bool:
        return THREAD_BUS.is_shutdown_requested() or bool(THREAD_BUS.get_signal(RELAY_STOP_SIGNAL, False))

    @staticmethod
    def _wait(seconds: float) -> None:
        THREAD_BUS.wait_signal(RELAY_STOP_SIGNAL, timeout=max(0.01, seconds))

    def run(self) -> None:
        while not self._should_stop():
            try:
                self._serve_once()
            except Exception as error:  # noqa: BLE001 - the reader loop must outlive one failed subscription
                relay_activity_log.error(
                    "reader.failed",
                    error_type=type(error).__name__,
                    error=error,
                )
                self._wait(RELAY_GRANT_WAIT_SECONDS)

    def _serve_once(self) -> None:
        grant = relay_state.grant()
        if not grant:
            THREAD_BUS.wait_signal(RELAY_GRANT_READY_SIGNAL, timeout=RELAY_GRANT_WAIT_SECONDS)
            return
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
                relay_contract.duration("heartbeat_seconds") * RELAY_READ_TIMEOUT_HEARTBEATS,
            ),
            reconnect_min_seconds=relay_contract.duration("subscriber_reconnect_min_seconds"),
            reconnect_max_seconds=relay_contract.duration("subscriber_reconnect_max_seconds"),
            max_event_bytes=relay_contract.limit("frame_bytes") + RELAY_SSE_FRAME_MARGIN_BYTES,
        )
        THREAD_BUS.signal(RELAY_SUBSCRIBER_SIGNAL, subscriber)
        subscriber.run(
            lambda: self._should_stop() or self._target_changed(hub_url, request_topic),
            self._wait,
        )
        THREAD_BUS.clear_signal(RELAY_SUBSCRIBER_SIGNAL)
        if relay_state.set_stream_connected(False):
            THREAD_BUS.signal(RELAY_WAKE_SIGNAL, True)

    @staticmethod
    def _target_changed(hub_url: str, request_topic: str) -> bool:
        grant = relay_state.grant()
        return bool(grant) and (
            str(grant["hub_url"]) != hub_url or str(grant["request_topic"]) != request_topic
        )

    @staticmethod
    def _authorization(force: bool) -> Dict[str, Any]:
        relay_grant.ensure_fresh(force)
        grant = relay_state.grant()
        if not grant:
            raise RuntimeError("relay_grant_unavailable")
        return {
            "token": grant["subscriber_token"],
            "token_ttl_seconds": relay_state.grant_remaining_seconds(),
        }

    @staticmethod
    def _state_changed(state: str, detail: str) -> None:
        if not relay_state.set_stream_connected(state == MERCURE_STATE_ONLINE):
            return
        relay_activity_log.info("stream.state", state=state, detail=detail)
        THREAD_BUS.signal(RELAY_WAKE_SIGNAL, True)

    def _update(self, update: MercureUpdate) -> None:
        if update.type == relay_contract.event("credential_revoked"):
            self._credential_revoked(update)
            return
        if update.type != relay_contract.event("request_frame"):
            return
        dev_recv = relay_local_ms()
        document = decode_request(update.data)
        if document is None:
            relay_activity_log.debug("request.dropped", reason="frame_invalid")
            return
        op = str(document["op"])
        owner = str(document["owner"])
        verdict, topic, cached = relay_state.admit(op, str(document["pair"]), owner, int(document["dl"]))
        if verdict in (RELAY_VERDICT_EXPIRED, RELAY_VERDICT_INFLIGHT):
            relay_activity_log.debug("request.dropped", op=op, reason=verdict)
            return
        if verdict == RELAY_VERDICT_FORBIDDEN:
            relay_activity_log.warning("request.dropped", op=op, reason=verdict)
            return
        if verdict == RELAY_VERDICT_REPLAY:
            relay_activity_log.debug("request.replayed", op=op)
            publish_frames(topic, op, cached, dev_recv)
            return
        if verdict == RELAY_VERDICT_OVERLOAD:
            relay_activity_log.warning("request.overloaded", op=op)
            publish_frames(
                topic,
                op,
                error_frames(op, relay_contract.error_status("device_overloaded"), RELAY_ERROR_DEVICE_OVERLOAD),
                dev_recv,
            )
            return
        job, error = validate_request(document)
        if job is None:
            status, code = error
            frames = error_frames(op, status, code)
            relay_state.complete(op, owner, frames)
            relay_activity_log.debug("request.rejected", op=op, status=status, code=code)
            publish_frames(topic, op, frames, dev_recv)
            return
        job["topic"] = topic
        job["dev_recv"] = dev_recv
        THREAD_BUS.send_message(RELAY_WORK_QUEUE, job)
        relay_activity_log.debug("request.queued", op=op, method=job["method"], path=job["path"])

    @staticmethod
    def _credential_revoked(update: MercureUpdate) -> None:
        try:
            payload = update.json()
            credential_id = str(payload.get("credential_id") or "")
            credential_version = int(payload.get("credential_version") or 0)
        except (ValueError, TypeError, AttributeError) as error:
            relay_activity_log.warning("credential.revocation.invalid", error_type=type(error).__name__)
            return
        relay_device_identity.revoke_credential_if_current(credential_id, credential_version)
        THREAD_BUS.signal(RELAY_WAKE_SIGNAL, True)


__all__ = ["RELAY_READER_THREAD", "RelayReaderThread"]
