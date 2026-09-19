# -*- coding: utf-8 -*-
"""Outbound-only Pycore Relay device agent."""

from __future__ import annotations

import platform
import socket
import time
import uuid
from typing import Any, Dict, List

from pycore.pyutils.common.mercure_client import MercureSubscriber, MercureUpdate, MERCURE_STATE_ONLINE
from pycore.pyctl.relay.laravel_relay_operation_processor import (
    laravel_relay_operation_processor,
)
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.relay_identity import relay_device_identity
from pycore.pyutils.common.terminal_events import TERMINAL_CHANGED_EVENT
from pycore.pyutils.laravel.relay_transport import (
    RelayHttpError,
    laravel_relay_transport,
)


RELAY_STOP_SIGNAL = "relay.runtime.stop"
RELAY_CONTROL_SIGNAL = "relay.runtime.control"
RELAY_CONTROL_WAKE = "operation_available"
RELAY_CONTROL_CREDENTIAL_REVOKED = "credential_revoked"
RELAY_SHUTDOWN_HANDLER_NAME = "relay_runtime"
RELAY_STATE_QUEUE = "relay.runtime.state"
RELAY_STATE_THREAD = "RelayStateThread"
RELAY_CONTROL_THREAD = "RelayControlThread"
RELAY_SUBSCRIBER_THREAD = "RelaySubscriberThread"
RELAY_OPERATION_BATCH_THREAD = "RelayOperationBatchThread"
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
RELAY_PERMANENT_CONFLICT_ERROR_CODES = frozenset(
    (
        "contract_digest_conflict",
        "capability_digest_conflict",
    )
)


class LaravelRelayAgentService:
    """Coordinate the Pycore device agent with Laravel Relay."""

    def __init__(self) -> None:
        init_serialized_owner(
            self,
            RELAY_STATE_QUEUE,
            RELAY_STATE_THREAD,
        )
        self._threads: List[Any] = []
        self._registered_endpoint = ""
        self._active_operations = set()
        self._presented_enrollment_id = ""
        self._conflict_hint_presented = False
        self._lease_owner = uuid.uuid4().hex
        self._subscriber_response: Any = None
        self._subscriber_connected: bool = False
        self._group_id = ""
        relay_activity_log.info(
            "runtime.constructed",
            contract_digest=relay_contract.digest,
            protocol_version=relay_contract.protocol_version,
            lease_owner=self._lease_owner,
        )

    @serialized_method
    def start(self) -> None:
        alive = {
            str(thread.name): thread
            for thread in self._threads
            if thread.is_alive()
        }
        relay_device_identity.ensure_device_id()
        relay_device_identity.ensure_signing_key()
        THREAD_BUS.clear_signal(RELAY_STOP_SIGNAL)
        THREAD_BUS.clear_signal(RELAY_CONTROL_SIGNAL)
        THREAD_BUS.register_event_handler(
            TERMINAL_CHANGED_EVENT,
            self._publish_device_event,
        )
        THREAD_BUS.register_event_handler(
            BusSignals.AGENT_HISTORY_PROMPT_NEW,
            self._publish_prompt_new_device_event,
        )
        threads = list(alive.values())
        if RELAY_CONTROL_THREAD not in alive:
            threads.append(
                start_bus_task(
                    self._control_loop,
                    thread_name=RELAY_CONTROL_THREAD,
                )
            )
            relay_activity_log.success("runtime.control_thread.started")
        else:
            relay_activity_log.warning(
                "runtime.control_thread.present",
                thread_name=RELAY_CONTROL_THREAD,
            )
        if RELAY_SUBSCRIBER_THREAD not in alive:
            threads.append(
                start_bus_task(
                    self._subscriber_loop,
                    thread_name=RELAY_SUBSCRIBER_THREAD,
                )
            )
            relay_activity_log.success("runtime.subscriber_thread.started")
        else:
            relay_activity_log.warning(
                "runtime.subscriber_thread.present",
                thread_name=RELAY_SUBSCRIBER_THREAD,
            )
        self._threads = threads
        THREAD_BUS.register_shutdown_handler(
            self.stop,
            priority=60,
            name=RELAY_SHUTDOWN_HANDLER_NAME,
        )
        relay_activity_log.success(
            "runtime.started",
            device_id=relay_device_identity.device_id(),
            thread_count=len(self._threads),
        )

    def stop(self) -> None:
        relay_activity_log.info(
            "runtime.stop.requested",
            device_id=relay_device_identity.device_id(),
        )
        THREAD_BUS.signal(RELAY_STOP_SIGNAL, True)
        THREAD_BUS.signal(
            RELAY_CONTROL_SIGNAL,
            {"kind": "stop"},
        )
        subscriber_response = self._subscriber_response
        if subscriber_response is not None:
            try:
                subscriber_response.close()
            except Exception:
                pass
        THREAD_BUS.unregister_event_handler(
            TERMINAL_CHANGED_EVENT,
            self._publish_device_event,
        )
        THREAD_BUS.unregister_event_handler(
            BusSignals.AGENT_HISTORY_PROMPT_NEW,
            self._publish_prompt_new_device_event,
        )
        relay_activity_log.success(
            "runtime.event_handler.removed",
            event_type=TERMINAL_CHANGED_EVENT,
        )

    @property
    def machine_id(self) -> str:
        return relay_device_identity.device_id()

    def capabilities(self) -> List[str]:
        return relay_contract.capabilities()

    def _recovery_claim_seconds(self) -> float:
        # While the Mercure stream is live, frame loss is impossible without
        # a detectable disconnect (TCP in-order delivery), so the bounded
        # recovery pass runs sparsely and the stream drives claim immediacy.
        # Without the stream the contract floor cadence applies.
        base_seconds = relay_contract.duration("recovery_claim_seconds")
        return base_seconds * 4 if self._subscriber_connected else base_seconds

    def _should_stop(self) -> bool:
        return THREAD_BUS.is_shutdown_requested() or bool(
            THREAD_BUS.get_signal(RELAY_STOP_SIGNAL, False)
        )

    @serialized_method
    def _remember_endpoint(self, endpoint: str) -> None:
        if self._registered_endpoint != str(endpoint):
            relay_activity_log.success(
                "coordinator.endpoint.bound",
                endpoint=endpoint,
            )
        self._registered_endpoint = str(endpoint)

    def _wait_control(self, seconds: float) -> Dict[str, Any]:
        value = THREAD_BUS.wait_signal(
            RELAY_CONTROL_SIGNAL,
            timeout=max(0.1, float(seconds)),
        )
        THREAD_BUS.clear_signal(RELAY_CONTROL_SIGNAL)
        return dict(value) if isinstance(value, dict) else {}

    def _control_loop(self) -> None:
        retry_seconds = relay_contract.duration("subscriber_reconnect_min_seconds")
        max_retry_seconds = relay_contract.duration(
            "subscriber_reconnect_max_seconds"
        )
        next_heartbeat_at = 0.0
        next_claim_at = 0.0
        force_claim = True
        relay_activity_log.info("control.loop.started")
        while not self._should_stop():
            endpoint = laravel_relay_transport.endpoint()
            if not endpoint:
                relay_activity_log.warning(
                    "coordinator.endpoint.unavailable",
                    retry_seconds=max_retry_seconds,
                )
                self._wait_control(max_retry_seconds)
                continue
            try:
                relay_device_identity.ensure()
                enrolled = self._ensure_enrollment(endpoint)
                if not enrolled:
                    signal = self._wait_control(
                        relay_contract.duration("enrollment_poll_seconds")
                    )
                    self._handle_control_signal(signal)
                    continue
                self._remember_endpoint(endpoint)
                now = time.monotonic()
                if now >= next_heartbeat_at:
                    self._heartbeat(endpoint)
                    next_heartbeat_at = now + relay_contract.duration(
                        "heartbeat_seconds"
                    )
                if force_claim or now >= next_claim_at:
                    if self._operation_capacity() == 0:
                        relay_activity_log.debug(
                            "operation.claim.deferred",
                            reason="operation_batch_active",
                        )
                    else:
                        self._claim_operations(endpoint)
                    force_claim = False
                    next_claim_at = now + self._recovery_claim_seconds()
                retry_seconds = relay_contract.duration(
                    "subscriber_reconnect_min_seconds"
                )
                wait_seconds = max(
                    0.1,
                    min(next_heartbeat_at, next_claim_at) - time.monotonic(),
                )
                signal = self._wait_control(wait_seconds)
                signal_kind = self._handle_control_signal(signal)
                force_claim = signal_kind == RELAY_CONTROL_WAKE
            except RelayHttpError as exc:
                if exc.error_code in RELAY_REENROLLMENT_ERROR_CODES:
                    if relay_device_identity.prepare_reenrollment():
                        relay_activity_log.warning(
                            "coordinator.authorization.rejected",
                            status_code=exc.status_code,
                            action_name=exc.action,
                            error_code=exc.error_code,
                        )
                if self._is_permanent_conflict(exc):
                    self._skip_permanent_conflict(exc, max_retry_seconds)
                    retry_seconds = max_retry_seconds
                    self._wait_control(retry_seconds)
                    continue
                relay_activity_log.error(
                    "control.http.failed",
                    status=exc.status_code,
                    action_name=exc.action,
                    error_code=exc.error_code,
                    retry_seconds=retry_seconds,
                )
                self._wait_control(retry_seconds)
                retry_seconds = min(max_retry_seconds, retry_seconds * 2)
            except Exception as exc:
                relay_activity_log.error(
                    "control.loop.failed",
                    error_type=type(exc).__name__,
                    error=exc,
                    retry_seconds=retry_seconds,
                )
                self._wait_control(retry_seconds)
                retry_seconds = min(max_retry_seconds, retry_seconds * 2)
        if relay_device_identity.has_credential() and laravel_relay_transport.endpoint():
            self._heartbeat(laravel_relay_transport.endpoint(), online=False)
        relay_activity_log.info("control.loop.stopped")

    def _subscriber_loop(self) -> None:
        endpoint = ""
        subscriber = None
        while not self._should_stop():
            endpoint = laravel_relay_transport.endpoint()
            if not endpoint or not relay_device_identity.has_credential():
                self._subscriber_wait(relay_contract.duration("enrollment_poll_seconds"))
                continue
            subscriber = MercureSubscriber(
                relay_contract.public_url("mercure_hub"),
                [relay_contract.topic("device_wake", device_id=relay_device_identity.device_id())],
                lambda force: self._subscriber_authorization(endpoint),
                on_update=self._subscriber_update,
                on_state_change=self._subscriber_state,
                connect_timeout=relay_contract.duration("subscriber_connect_timeout_seconds"),
                read_timeout=relay_contract.duration("subscriber_read_timeout_seconds"),
                reconnect_min_seconds=relay_contract.duration("subscriber_reconnect_min_seconds"),
                reconnect_max_seconds=relay_contract.duration("subscriber_reconnect_max_seconds"),
            )
            self._subscriber_response = subscriber
            subscriber.run(lambda: self._should_stop()
                or laravel_relay_transport.endpoint() != endpoint
                or not relay_device_identity.has_credential(), self._subscriber_wait)
            self._subscriber_response = None
            self._subscriber_connected = False

    def _subscriber_wait(self, seconds: float) -> None:
        THREAD_BUS.wait_signal(RELAY_STOP_SIGNAL, timeout=max(0.01, seconds))

    def _subscriber_authorization(self, endpoint: str) -> Dict[str, Any]:
        data = laravel_relay_transport.request_json(
            "POST", relay_contract.endpoint("device_hub_authorization"),
            {"device_id": relay_device_identity.device_id(), "contract_digest": relay_contract.digest},
            timeout=relay_contract.duration("subscriber_connect_timeout_seconds"),
            action="device.hub.authorization", coordinator_url=endpoint,
        )
        return {
            "token": data["hub"]["subscriber_token"],
            "token_ttl_seconds": data["hub"]["expires_in_seconds"],
        }

    def _subscriber_state(self, state: str, detail: str) -> None:
        self._subscriber_connected = state == MERCURE_STATE_ONLINE
        relay_activity_log.info(
            "subscriber.state.changed",
            state=state,
            device_id=relay_device_identity.device_id(),
            coordinator=laravel_relay_transport.endpoint(),
        )
        if self._subscriber_connected:
            THREAD_BUS.signal(RELAY_CONTROL_SIGNAL, {"kind": RELAY_CONTROL_WAKE})

    def _subscriber_update(self, update: MercureUpdate) -> None:
        payload = update.json()
        if update.type == relay_contract.event("operation_available"):
            THREAD_BUS.signal(RELAY_CONTROL_SIGNAL, {"kind": RELAY_CONTROL_WAKE})
        elif update.type == relay_contract.event("credential_revoked"):
            THREAD_BUS.signal(RELAY_CONTROL_SIGNAL,
                {**payload, "kind": RELAY_CONTROL_CREDENTIAL_REVOKED})

    @staticmethod
    def _is_permanent_conflict(exc: RelayHttpError) -> bool:
        return (
            exc.status_code == 409
            and exc.error_code in RELAY_PERMANENT_CONFLICT_ERROR_CODES
        )

    def _skip_permanent_conflict(
        self,
        exc: RelayHttpError,
        wait_seconds: float,
    ) -> None:
        relay_activity_log.error(
            "control.http.conflict.skipped",
            status=exc.status_code,
            action_name=exc.action,
            error_code=exc.error_code,
            local_contract_digest=relay_contract.digest,
            retry_seconds=wait_seconds,
        )
        if not self._conflict_hint_presented:
            self._conflict_hint_presented = True
            ColorPrint.yellow(
                "[Relay] Permanent coordinator conflict "
                f"({exc.error_code}): local contract digest "
                f"{relay_contract.digest} is rejected. Align "
                "config/pycore_relay_contract.json on device and coordinator; "
                "requests are skipped until both sides match."
            )

    def _handle_control_signal(self, signal: Dict[str, Any]) -> str:
        kind = str(signal.get("kind") or "")
        if kind == RELAY_CONTROL_CREDENTIAL_REVOKED:
            relay_device_identity.revoke_credential_if_current(
                str(signal.get("credential_id") or ""),
                int(signal.get("credential_version") or 0),
            )
        if kind:
            relay_activity_log.info("control.signal.received", kind=kind)
        return kind

    def _ensure_enrollment(self, endpoint: str) -> bool:
        if relay_device_identity.has_credential():
            return True
        enrollment_id = relay_device_identity.enrollment_id()
        if not enrollment_id:
            descriptor = relay_device_identity.descriptor(
                socket.gethostname() or relay_device_identity.device_id(),
                platform.platform(),
            )
            data = laravel_relay_transport.request_json(
                "POST",
                relay_contract.endpoint("enrollment_create"),
                {"device": descriptor},
                action="enrollment.create",
                coordinator_url=endpoint,
            )
        else:
            data = laravel_relay_transport.request_json(
                "GET",
                relay_contract.endpoint(
                    "enrollment_status",
                    enrollment_id=enrollment_id,
                ),
                action="enrollment.status",
                coordinator_url=endpoint,
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
            relay_device_identity.save_enrollment(
                resolved_id,
                claim_code,
                expires_at,
            )
        if state in ("expired", "revoked"):
            relay_device_identity.clear_enrollment()
            return False
        if state != "claimed":
            self._present_enrollment_claim(resolved_id)
            relay_activity_log.info(
                "enrollment.awaiting_claim",
                endpoint=endpoint,
                enrollment_id=resolved_id,
                state=state,
            )
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

    def _present_enrollment_claim(self, enrollment_id: str) -> None:
        claim = relay_device_identity.enrollment_claim()
        resolved_id = str(claim.get("enrollment_id") or "")
        claim_code = str(claim.get("claim_code") or "")
        expires_at = str(claim.get("expires_at") or "")
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
            f"before {expires_at}."
        )

    def _heartbeat(self, coordinator_url: str, online: bool = True) -> None:
        group_id = ""
        data = laravel_relay_transport.request_json(
            "POST",
            relay_contract.endpoint("device_heartbeat"),
            {
                "device_id": relay_device_identity.device_id(),
                "contract_digest": relay_contract.digest,
                "capabilities": relay_contract.capabilities(),
                "online": online,
            },
            action="device.heartbeat",
            coordinator_url=coordinator_url,
        )
        group_id = str(data.get("device", {}).get("group_id") or "")
        if group_id and group_id != self._group_id:
            self._group_id = group_id
            relay_activity_log.info(
                "device.group.bound",
                device_id=relay_device_identity.device_id(),
                group_id=group_id,
                coordinator=coordinator_url,
            )
        relay_activity_log.debug(
            "device.heartbeat.acknowledged",
            device_id=relay_device_identity.device_id(),
        )

    def _claim_operations(self, coordinator_url: str) -> None:
        data = laravel_relay_transport.request_json(
            "POST",
            relay_contract.endpoint("operation_claim"),
            {
                "device_id": relay_device_identity.device_id(),
                "lease_owner": self._lease_owner,
                "limit": min(relay_contract.limit("claim_batch"), self._operation_capacity()),
                "contract_digest": relay_contract.digest,
            },
            timeout=relay_contract.duration("claim_timeout_seconds"),
            action="operation.claim",
            coordinator_url=coordinator_url,
        )
        operations = data.get("operations")
        if not isinstance(operations, list):
            raise ValueError("relay_claim_operations_missing")
        if operations:
            relay_activity_log.info(
                "operation.claim.received",
                operation_count=len(operations),
                lease_owner=self._lease_owner,
            )
        else:
            # An empty reconciliation pass is the silent steady state; it only
            # matters when auditing cadence with debug output enabled.
            relay_activity_log.debug(
                "operation.claim.received",
                operation_count=len(operations),
                lease_owner=self._lease_owner,
            )
        descriptors = []
        for item in operations:
            if not isinstance(item, dict):
                continue
            descriptor = dict(item)
            descriptor["_coordinator_url"] = str(coordinator_url)
            descriptors.append(descriptor)
        if not descriptors:
            return
        for descriptor in descriptors:
            operation_id = str(descriptor.get("operation_id") or "")
            if not self._reserve_operation(operation_id):
                continue
            start_bus_task(self._process_operation, descriptor, self._lease_owner,
                thread_name=RELAY_OPERATION_BATCH_THREAD + "." + operation_id)

    @serialized_method
    def _reserve_operation(self, operation_id: str) -> bool:
        if operation_id in self._active_operations:
            return False
        self._active_operations.add(operation_id)
        return True

    @serialized_method
    def _operation_capacity(self) -> int:
        return max(0, relay_contract.limit("device_active_leases") - len(self._active_operations))

    @serialized_method
    def _release_operation(self, operation_id: str) -> None:
        self._active_operations.discard(operation_id)

    def _process_operation(self, descriptor: Dict[str, Any], lease_owner: str) -> None:
        try:
            laravel_relay_operation_processor.process(descriptor, lease_owner)
        finally:
            self._release_operation(str(descriptor.get("operation_id") or ""))
            THREAD_BUS.signal(RELAY_CONTROL_SIGNAL, {"kind": RELAY_CONTROL_WAKE})

    def _publish_device_event(self, payload: Any) -> None:
        event_payload = dict(payload) if isinstance(payload, dict) else {}
        self._post_device_event(
            "terminal_changed",
            event_payload,
            int(event_payload.get("revision") or 0),
        )

    def _publish_prompt_new_device_event(self, payload: Any) -> None:
        """Forward agent-history prompt.new to paired UI owners via the hub."""
        event_payload = dict(payload) if isinstance(payload, dict) else {}
        revision = int(time.time())
        prompts = event_payload.get("prompts")
        if isinstance(prompts, list) and prompts:
            first = prompts[0]
            if isinstance(first, dict) and int(first.get("ts") or 0) > 0:
                revision = int(first.get("ts"))
        self._post_device_event("agent_history_prompt_new", event_payload, revision)

    def _post_device_event(self, event_name: str, event_payload: Dict[str, Any], revision: int) -> None:
        revision = max(1, int(revision or 0))
        event_type = relay_contract.event(event_name)
        if not relay_device_identity.has_credential():
            relay_activity_log.warning(
                "device.event.skipped",
                event_type=event_type,
                revision=revision,
                reason="credential_unavailable",
            )
            return
        try:
            laravel_relay_transport.request_json(
                "POST",
                relay_contract.endpoint("device_event"),
                {
                    "device_id": relay_device_identity.device_id(),
                    "event_type": event_type,
                    "revision": revision,
                    "payload": event_payload,
                },
                action="device.event.publish",
            )
        except Exception as error:
            relay_activity_log.error(
                "device.event.publish.failed",
                event_type=event_type,
                revision=revision,
                error_type=type(error).__name__,
                error=error,
            )
            return
        relay_activity_log.success(
            "device.event.publish.completed",
            event_type=event_type,
            revision=revision,
        )


laravel_relay_agent_service = LaravelRelayAgentService()


__all__ = ["laravel_relay_agent_service"]
