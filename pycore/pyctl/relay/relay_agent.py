# -*- coding: utf-8 -*-
"""Pycore device agent: enrollment, heartbeat, and the frame pipeline lifecycle."""

from __future__ import annotations

import platform
import socket
import threading
from typing import List

from pycore.pyctl.relay.relay_events import relay_events
from pycore.pyctl.relay.relay_grant import relay_grant
from pycore.pyctl.relay.relay_publisher import RelayPublisherThread
from pycore.pyctl.relay.relay_reader import RelayReaderThread
from pycore.pyctl.relay.relay_state import (
    RELAY_GRANT_READY_SIGNAL,
    RELAY_PUBLISH_QUEUE,
    RELAY_STOP_MESSAGE,
    RELAY_STOP_SIGNAL,
    RELAY_SUBSCRIBER_SIGNAL,
    RELAY_WAKE_SIGNAL,
    RELAY_WORK_QUEUE,
    relay_state,
)
from pycore.pyctl.relay.relay_worker import RelayProgressThread, RelayWorkerThread
from pycore.pyfoundations.backoff_wait import Backoff
from pycore.pyfoundations.notebook_policy import notebook_platform
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.http_client import HttpError
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.relay_identity import relay_device_identity
from pycore.pyutils.laravel.relay_transport import RelayHttpError, relay_transport


RELAY_SHUTDOWN_HANDLER_NAME = "relay_agent"
RELAY_SHUTDOWN_PRIORITY = 60
RELAY_AGENT_STATE_QUEUE = "relay.agent"
RELAY_AGENT_STATE_THREAD = "RelayAgentStateThread"
RELAY_CONTROL_THREAD = "RelayControlThread"
RELAY_THREAD_JOIN_SECONDS = 2.0
RELAY_REENROLLMENT_ERROR_CODES = frozenset(
    (
        "device_not_found",
        "device_credential_revoked",
        "enrollment_not_found",
        "signature_credential_missing",
        "signature_credential_invalid",
        "signature_enrollment_not_found",
    )
)
RELAY_PERMANENT_CONFLICT_ERROR_CODES = frozenset(("contract_digest_conflict",))
RELAY_SESSION_SUPERSEDED_ERROR_CODE = "relay_session_superseded"
RELAY_ENROLLMENT_ENDED_STATES = ("expired", "revoked")
RELAY_ENROLLMENT_CLAIMED_STATE = "claimed"


def relay_should_stop() -> bool:
    return THREAD_BUS.is_shutdown_requested() or bool(THREAD_BUS.get_signal(RELAY_STOP_SIGNAL, False))


class RelayControlThread(threading.Thread):
    """Enroll the device, then heartbeat on a fixed cadence and on every stream change."""

    def __init__(self) -> None:
        super().__init__(name=RELAY_CONTROL_THREAD, daemon=True)
        self._presented_enrollment_id = ""
        self._conflict_hint_presented = False

    def run(self) -> None:
        backoff = Backoff(
            relay_contract.duration("subscriber_reconnect_min_seconds"),
            relay_contract.duration("subscriber_reconnect_max_seconds"),
        )
        relay_activity_log.info("control.started")
        while not relay_should_stop():
            wait_seconds = self._cycle(backoff)
            THREAD_BUS.wait_signal(RELAY_WAKE_SIGNAL, timeout=max(0.1, wait_seconds))
            THREAD_BUS.clear_signal(RELAY_WAKE_SIGNAL)
        relay_activity_log.info("control.stopped")

    def _cycle(self, backoff: Backoff) -> float:
        if not relay_transport.endpoint():
            relay_activity_log.warning("coordinator.endpoint.unavailable")
            return relay_contract.duration("subscriber_reconnect_max_seconds")
        try:
            relay_device_identity.ensure()
            if not self._ensure_enrollment():
                return relay_contract.duration("enrollment_poll_seconds")
            relay_grant.heartbeat()
        except RelayHttpError as error:
            return self._http_failed(error, backoff)
        except (HttpError, RuntimeError, TypeError, ValueError) as error:
            relay_activity_log.error(
                "control.failed",
                error_type=type(error).__name__,
                error=error,
            )
            return backoff.next_delay()
        backoff.reset()
        return relay_contract.duration("heartbeat_seconds")

    def _http_failed(self, error: RelayHttpError, backoff: Backoff) -> float:
        if error.error_code == RELAY_SESSION_SUPERSEDED_ERROR_CODE:
            relay_activity_log.warning("session.superseded", device_id=relay_device_identity.device_id())
            ColorPrint.yellow(
                "[Relay] This session was superseded by a newer session of the same device identity "
                "and has stopped. Run one process per identity; restart this process to take the identity back."
            )
            relay_agent.supersede()
            return relay_contract.duration("subscriber_reconnect_max_seconds")
        if error.error_code in RELAY_REENROLLMENT_ERROR_CODES and relay_device_identity.prepare_reenrollment():
            relay_activity_log.warning(
                "coordinator.authorization.rejected",
                status_code=error.status_code,
                action_name=error.action,
                error_code=error.error_code,
            )
        if error.status_code == 409 and error.error_code in RELAY_PERMANENT_CONFLICT_ERROR_CODES:
            relay_activity_log.error(
                "control.conflict.skipped",
                status=error.status_code,
                action_name=error.action,
                error_code=error.error_code,
                local_contract_digest=relay_contract.digest,
            )
            if not self._conflict_hint_presented:
                self._conflict_hint_presented = True
                ColorPrint.yellow(
                    "[Relay] Permanent coordinator conflict "
                    f"({error.error_code}): local contract digest {relay_contract.digest} is rejected. "
                    "Align config/pycore_relay_contract.json on device and coordinator; "
                    "requests are skipped until both sides match."
                )
            return relay_contract.duration("subscriber_reconnect_max_seconds")
        relay_activity_log.error(
            "control.http.failed",
            status=error.status_code,
            action_name=error.action,
            error_code=error.error_code,
        )
        return backoff.next_delay()

    def _ensure_enrollment(self) -> bool:
        if relay_device_identity.has_credential():
            return True
        enrollment_id = relay_device_identity.enrollment_id()
        if not enrollment_id:
            data = relay_transport.request_json(
                "POST",
                relay_contract.endpoint("enrollment_create"),
                {
                    "device": relay_device_identity.descriptor(
                        self._device_label(),
                        platform.platform(),
                    )
                },
                action="enrollment.create",
            )
        else:
            data = relay_transport.request_json(
                "GET",
                relay_contract.endpoint("enrollment_status", enrollment_id=enrollment_id),
                action="enrollment.status",
            )
        enrollment = data.get("enrollment")
        if not isinstance(enrollment, dict):
            raise ValueError("relay_enrollment_response_missing")
        resolved_id = str(enrollment.get("enrollment_id") or "")
        state = str(enrollment.get("state") or "")
        if not resolved_id or not state:
            raise ValueError("relay_enrollment_response_incomplete")
        if not enrollment_id:
            claim_code = str(enrollment.get("claim_code") or "")
            expires_at = str(enrollment.get("expires_at") or "")
            if not claim_code or not expires_at:
                raise ValueError("relay_enrollment_claim_details_incomplete")
            relay_device_identity.save_enrollment(resolved_id, claim_code, expires_at)
        if state in RELAY_ENROLLMENT_ENDED_STATES:
            relay_device_identity.clear_enrollment()
            return False
        if state != RELAY_ENROLLMENT_CLAIMED_STATE:
            self._present_enrollment_claim(resolved_id)
            relay_activity_log.info("enrollment.awaiting_claim", enrollment_id=resolved_id, state=state)
            return False
        credential = data.get("credential")
        if not isinstance(credential, dict):
            raise ValueError("relay_enrollment_credential_missing")
        relay_device_identity.save_credential(
            str(credential.get("credential_id") or ""),
            int(credential.get("credential_version") or 0),
        )
        relay_activity_log.success(
            "enrollment.claimed",
            enrollment_id=resolved_id,
            device_id=relay_device_identity.device_id(),
        )
        return True

    @staticmethod
    def _device_label() -> str:
        host = socket.gethostname() or relay_device_identity.device_id()
        notebook = notebook_platform()
        return f"{notebook}-{host}" if notebook else host

    def _present_enrollment_claim(self, enrollment_id: str) -> None:
        claim = relay_device_identity.enrollment_claim()
        resolved_id = str(claim.get("enrollment_id") or "")
        claim_code = str(claim.get("claim_code") or "")
        if (
            not resolved_id
            or resolved_id != str(enrollment_id)
            or not claim_code
            or self._presented_enrollment_id == resolved_id
        ):
            return
        self._presented_enrollment_id = resolved_id
        ColorPrint.yellow(
            "[Relay] Enrollment required: "
            f"enter claim code {claim_code} in the Relay device roster "
            f"before {claim.get('expires_at')}."
        )


class RelayAgent:
    """Start and stop the relay device agent."""

    def __init__(self) -> None:
        init_serialized_owner(self, RELAY_AGENT_STATE_QUEUE, RELAY_AGENT_STATE_THREAD)
        self._threads: List[threading.Thread] = []

    @serialized_method
    def start(self) -> None:
        alive = [thread for thread in self._threads if thread.is_alive()]
        if alive and not THREAD_BUS.get_signal(RELAY_STOP_SIGNAL, False):
            relay_activity_log.debug("agent.present", thread_count=len(alive))
            return
        for thread in alive:
            thread.join(timeout=RELAY_THREAD_JOIN_SECONDS)
        relay_device_identity.ensure_device_id()
        relay_device_identity.ensure_signing_key()
        for signal_name in (
            RELAY_STOP_SIGNAL,
            RELAY_WAKE_SIGNAL,
            RELAY_GRANT_READY_SIGNAL,
            RELAY_SUBSCRIBER_SIGNAL,
        ):
            THREAD_BUS.clear_signal(signal_name)
        THREAD_BUS.clear_queue(RELAY_WORK_QUEUE)
        THREAD_BUS.clear_queue(RELAY_PUBLISH_QUEUE)
        relay_state.reset()
        threads: List[threading.Thread] = [RelayPublisherThread()]
        threads.extend(
            RelayWorkerThread(index)
            for index in range(1, relay_contract.limit("device_max_concurrent_requests") + 1)
        )
        threads.append(RelayProgressThread())
        threads.append(RelayReaderThread())
        threads.append(RelayControlThread())
        for thread in threads:
            thread.start()
        relay_events.start()
        self._threads = threads
        THREAD_BUS.register_shutdown_handler(
            self.stop,
            priority=RELAY_SHUTDOWN_PRIORITY,
            name=RELAY_SHUTDOWN_HANDLER_NAME,
        )
        relay_activity_log.success(
            "agent.started",
            device_id=relay_device_identity.device_id(),
            contract_digest=relay_contract.digest,
            thread_count=len(threads),
        )

    @serialized_method
    def stop(self) -> None:
        self._halt(True)

    @serialized_method
    def supersede(self) -> None:
        """Terminal stop of this session after a newer session of the identity took over."""
        self._halt(False)

    def _halt(self, withdraw: bool) -> None:
        if not any(thread.is_alive() for thread in self._threads):
            return
        THREAD_BUS.signal(RELAY_STOP_SIGNAL, True)
        THREAD_BUS.signal(RELAY_WAKE_SIGNAL, True)
        for _index in range(relay_contract.limit("device_max_concurrent_requests")):
            THREAD_BUS.send_message(RELAY_WORK_QUEUE, dict(RELAY_STOP_MESSAGE))
        THREAD_BUS.send_message(RELAY_PUBLISH_QUEUE, dict(RELAY_STOP_MESSAGE))
        subscriber = THREAD_BUS.get_signal(RELAY_SUBSCRIBER_SIGNAL)
        if subscriber is not None:
            subscriber.close()
        relay_state.set_stream_connected(False)
        relay_events.stop()
        if withdraw and relay_device_identity.has_credential() and relay_transport.endpoint():
            try:
                relay_grant.heartbeat(online=False)
            except (HttpError, RelayHttpError, RuntimeError, ValueError) as error:
                relay_activity_log.error(
                    "heartbeat.withdraw.failed",
                    error_type=type(error).__name__,
                    error=error,
                )
        relay_activity_log.info("agent.stopped", device_id=relay_device_identity.device_id())


relay_agent = RelayAgent()


__all__ = ["RelayAgent", "relay_agent"]
