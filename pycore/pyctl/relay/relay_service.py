# -*- coding: utf-8 -*-
"""Outbound-only Pycore Relay V2 device agent."""

from __future__ import annotations

import math
import platform
import socket
import time
import urllib.parse
import uuid
from typing import Any, Dict, List

from pycore.pyctl.relay.relay_processor import relay_operation_processor
from pycore.pyctl.relay.relay_transport import RelayHttpError, relay_transport
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.mercure_client import (
    MERCURE_STATE_CONNECTING,
    MERCURE_STATE_OFFLINE,
    MERCURE_STATE_ONLINE,
    MercureSubscriber,
    MercureUpdate,
)
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.relay_identity import relay_device_identity
from pycore.pyutils.common.terminal_events import TERMINAL_CHANGED_EVENT
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager


RELAY_STOP_SIGNAL = "relay.v2.runtime.stop"
RELAY_CONTROL_SIGNAL = "relay.v2.runtime.control"
RELAY_CONTROL_WAKE = "operation_available"
RELAY_CONTROL_CREDENTIAL_REVOKED = "credential_revoked"
RELAY_SHUTDOWN_HANDLER_NAME = "relay_v2_runtime"
RELAY_STATE_QUEUE = "relay.v2.runtime.state"
RELAY_STATE_THREAD = "RelayV2StateThread"
RELAY_CONTROL_THREAD = "RelayV2ControlThread"
RELAY_SUBSCRIBER_THREAD = "RelayV2SubscriberThread"
RELAY_OPERATION_BATCH_THREAD = "RelayV2OperationBatchThread"
RELAY_TOKEN_LIFETIME_FRACTION = 0.8


class RelayService:
    """Coordinate enrollment, heartbeat, wake subscription, and recovery claims."""

    def __init__(self) -> None:
        init_serialized_owner(
            self,
            RELAY_STATE_QUEUE,
            RELAY_STATE_THREAD,
        )
        self._threads: List[Any] = []
        self._hub_url = ""
        self._hub_topic = ""
        self._hub_token_value = ""
        self._hub_token_expires_at = 0.0
        self._registered_endpoint = ""
        self._endpoint_listener_registered = False
        self._operation_batch_active = False
        self._presented_enrollment_id = ""
        self._lease_owner = uuid.uuid4().hex
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
        if not self._endpoint_listener_registered:
            laravel_endpoint_manager.register_endpoint_change_listener(
                self._on_endpoint_changed
            )
            self._endpoint_listener_registered = True
        relay_device_identity.ensure_device_id()
        relay_device_identity.ensure_signing_key()
        THREAD_BUS.clear_signal(RELAY_STOP_SIGNAL)
        THREAD_BUS.clear_signal(RELAY_CONTROL_SIGNAL)
        THREAD_BUS.register_event_handler(
            TERMINAL_CHANGED_EVENT,
            self._publish_device_event,
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
        THREAD_BUS.unregister_event_handler(
            TERMINAL_CHANGED_EVENT,
            self._publish_device_event,
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

    def hub_token(self, force_refresh: bool = False) -> str:
        self._ensure_hub_authorization(force=force_refresh)
        snapshot = self._hub_snapshot()
        token = str(snapshot.get("token") or "")
        if not token:
            raise RuntimeError("relay_hub_token_unavailable")
        return token

    def _should_stop(self) -> bool:
        return THREAD_BUS.is_shutdown_requested() or bool(
            THREAD_BUS.get_signal(RELAY_STOP_SIGNAL, False)
        )

    @serialized_method
    def _on_endpoint_changed(self, base_url: str) -> None:
        previous = self._registered_endpoint
        self._registered_endpoint = ""
        self._clear_hub_authorization(reason="endpoint_changed")
        relay_activity_log.warning(
            "coordinator.endpoint.changed",
            previous_endpoint=previous,
            endpoint=base_url,
        )
        THREAD_BUS.signal(
            RELAY_CONTROL_SIGNAL,
            {"kind": "endpoint_changed"},
        )

    @serialized_method
    def _remember_endpoint(self, endpoint: str) -> None:
        if self._registered_endpoint != str(endpoint):
            relay_activity_log.success(
                "coordinator.endpoint.bound",
                endpoint=endpoint,
            )
        self._registered_endpoint = str(endpoint)

    @serialized_method
    def _remember_hub(
        self,
        hub: Dict[str, Any],
        coordinator_url: str = "",
    ) -> None:
        hub_url = str(hub.get("url") or "")
        token = str(hub.get("subscriber_token") or "")
        expected_hub_url = relay_contract.public_url("mercure_hub")
        expected_origin = relay_contract.public_url("laravel_api_origin")
        coordinator_parts = urllib.parse.urlsplit(expected_origin)
        expected_topic = relay_contract.topic(
            "device_wake",
            device_id=relay_device_identity.device_id(),
        )
        topic = str(hub.get("topic") or "") or expected_topic
        expires_in_seconds = float(hub.get("expires_in_seconds") or 0)
        if (
            not hub_url
            or not token
            or not math.isfinite(expires_in_seconds)
            or expires_in_seconds <= 0
        ):
            raise ValueError("relay_hub_authorization_incomplete")
        if expires_in_seconds > relay_contract.duration(
            "subscriber_token_seconds"
        ):
            raise ValueError("relay_hub_token_lifetime_invalid")
        hub_parts = urllib.parse.urlsplit(hub_url)
        if (
            hub_url != expected_hub_url
            or hub_parts.scheme != coordinator_parts.scheme
            or hub_parts.netloc != coordinator_parts.netloc
        ):
            raise ValueError("relay_hub_origin_untrusted")
        if topic != expected_topic:
            raise ValueError("relay_hub_topic_conflict")
        self._hub_url = hub_url
        self._hub_topic = topic
        self._hub_token_value = token
        self._hub_token_expires_at = (
            time.time() + expires_in_seconds * RELAY_TOKEN_LIFETIME_FRACTION
        )
        relay_activity_log.success(
            "hub.authorization.saved",
            hub_url=hub_url,
            topic=topic,
            expires_in_seconds=expires_in_seconds,
        )

    @serialized_method
    def _hub_snapshot(self) -> Dict[str, Any]:
        return {
            "url": self._hub_url,
            "topic": self._hub_topic,
            "token": self._hub_token_value,
            "expires_at": self._hub_token_expires_at,
        }

    @serialized_method
    def _clear_hub_authorization(self, reason: str) -> None:
        self._hub_url = ""
        self._hub_topic = ""
        self._hub_token_value = ""
        self._hub_token_expires_at = 0.0
        relay_activity_log.warning(
            "hub.authorization.cleared",
            reason=reason,
        )

    def _hub_changed(self, expected_url: str, expected_topic: str) -> bool:
        snapshot = self._hub_snapshot()
        return (
            str(snapshot.get("url") or "") != str(expected_url)
            or str(snapshot.get("topic") or "") != str(expected_topic)
        )

    def _wait_control(self, seconds: float) -> Dict[str, Any]:
        value = THREAD_BUS.wait_signal(
            RELAY_CONTROL_SIGNAL,
            timeout=max(0.1, float(seconds)),
        )
        THREAD_BUS.clear_signal(RELAY_CONTROL_SIGNAL)
        return dict(value) if isinstance(value, dict) else {}

    def _wait_stop(self, seconds: float) -> None:
        THREAD_BUS.wait_signal(
            RELAY_STOP_SIGNAL,
            timeout=max(0.1, float(seconds)),
        )

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
            endpoint = relay_transport.endpoint()
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
                self._ensure_hub_authorization(coordinator_url=endpoint)
                if force_claim or now >= next_claim_at:
                    if self._operation_batch_is_active():
                        relay_activity_log.debug(
                            "operation.claim.deferred",
                            reason="operation_batch_active",
                        )
                    else:
                        self._claim_operations(endpoint)
                    force_claim = False
                    next_claim_at = now + relay_contract.duration(
                        "recovery_claim_seconds"
                    )
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
                if exc.status_code in (401, 403):
                    relay_device_identity.prepare_reenrollment()
                    self._clear_hub_authorization(
                        reason="coordinator_authorization_rejected"
                    )
                relay_activity_log.error(
                    "control.http.failed",
                    status=exc.status_code,
                    action_name=exc.action,
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
        relay_activity_log.info("control.loop.stopped")

    def _handle_control_signal(self, signal: Dict[str, Any]) -> str:
        kind = str(signal.get("kind") or "")
        if kind == RELAY_CONTROL_CREDENTIAL_REVOKED:
            revoked = relay_device_identity.revoke_credential_if_current(
                str(signal.get("credential_id") or ""),
                int(signal.get("credential_version") or 0),
            )
            if revoked:
                self._clear_hub_authorization(reason="credential_revoked")
        if kind:
            relay_activity_log.info("control.signal.received", kind=kind)
        return kind

    def _ensure_enrollment(self, endpoint: str) -> bool:
        if relay_device_identity.has_credential():
            relay_activity_log.debug(
                "enrollment.credential.present",
                device_id=relay_device_identity.device_id(),
            )
            return True
        enrollment_id = relay_device_identity.enrollment_id()
        if not enrollment_id:
            descriptor = relay_device_identity.descriptor(
                socket.gethostname() or relay_device_identity.device_id(),
                platform.platform(),
            )
            data = relay_transport.request_json(
                "POST",
                relay_contract.endpoint("enrollment_create"),
                {"device": descriptor},
                action="enrollment.create",
                coordinator_url=endpoint,
            )
        else:
            data = relay_transport.request_json(
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
        hub = data.get("hub")
        if isinstance(hub, dict):
            self._remember_hub(hub, endpoint)
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
            "[RelayV2] Enrollment required: "
            f"enter claim code {claim_code} in the Relay device roster "
            f"before {expires_at}."
        )

    def _heartbeat(self, coordinator_url: str) -> None:
        data = relay_transport.request_json(
            "POST",
            relay_contract.endpoint("device_heartbeat"),
            {
                "device_id": relay_device_identity.device_id(),
                "contract_digest": relay_contract.digest,
                "capabilities": relay_contract.capabilities(),
            },
            action="device.heartbeat",
            coordinator_url=coordinator_url,
        )
        hub = data.get("hub")
        if isinstance(hub, dict):
            self._remember_hub(hub, coordinator_url)
        relay_activity_log.success(
            "device.heartbeat.acknowledged",
            device_id=relay_device_identity.device_id(),
        )

    def _ensure_hub_authorization(
        self,
        force: bool = False,
        coordinator_url: str = "",
    ) -> None:
        snapshot = self._hub_snapshot()
        margin = relay_contract.duration(
            "subscriber_token_refresh_margin_seconds"
        )
        token_valid = (
            bool(snapshot.get("token"))
            and bool(snapshot.get("url"))
            and time.time() + margin < float(snapshot.get("expires_at") or 0)
        )
        if token_valid and not force:
            relay_activity_log.debug(
                "hub.authorization.present",
                hub_url=snapshot.get("url"),
                topic=snapshot.get("topic"),
            )
            return
        data = relay_transport.request_json(
            "POST",
            relay_contract.endpoint("device_hub_authorization"),
            {
                "device_id": relay_device_identity.device_id(),
                "contract_digest": relay_contract.digest,
            },
            action="hub.authorization",
            coordinator_url=coordinator_url,
        )
        hub = data.get("hub")
        if not isinstance(hub, dict):
            raise ValueError("relay_hub_authorization_missing")
        self._remember_hub(hub, coordinator_url)

    def _claim_operations(self, coordinator_url: str) -> None:
        data = relay_transport.request_json(
            "POST",
            relay_contract.endpoint("operation_claim"),
            {
                "device_id": relay_device_identity.device_id(),
                "lease_owner": self._lease_owner,
                "limit": relay_contract.limit("claim_batch"),
                "contract_digest": relay_contract.digest,
            },
            timeout=relay_contract.duration("claim_timeout_seconds"),
            action="operation.claim",
            coordinator_url=coordinator_url,
        )
        operations = data.get("operations")
        if not isinstance(operations, list):
            raise ValueError("relay_claim_operations_missing")
        relay_activity_log.info(
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
        if not self._reserve_operation_batch():
            raise RuntimeError("relay_operation_batch_already_active")
        try:
            start_bus_task(
                self._process_operation_batch,
                descriptors,
                self._lease_owner,
                thread_name=RELAY_OPERATION_BATCH_THREAD,
            )
        except Exception:
            self._release_operation_batch()
            raise
        relay_activity_log.success(
            "operation.batch.scheduled",
            operation_count=len(descriptors),
            lease_owner=self._lease_owner,
            coordinator_url=coordinator_url,
        )

    @serialized_method
    def _reserve_operation_batch(self) -> bool:
        if self._operation_batch_active:
            return False
        self._operation_batch_active = True
        return True

    @serialized_method
    def _operation_batch_is_active(self) -> bool:
        return bool(self._operation_batch_active)

    @serialized_method
    def _release_operation_batch(self) -> None:
        self._operation_batch_active = False

    def _process_operation_batch(
        self,
        descriptors: List[Dict[str, Any]],
        lease_owner: str,
    ) -> None:
        try:
            relay_operation_processor.process_many(descriptors, lease_owner)
        finally:
            self._release_operation_batch()
            THREAD_BUS.signal(
                RELAY_CONTROL_SIGNAL,
                {"kind": RELAY_CONTROL_WAKE},
            )
            relay_activity_log.info(
                "operation.batch.released",
                operation_count=len(descriptors),
                lease_owner=lease_owner,
            )

    def _publish_device_event(self, payload: Any) -> None:
        event_payload = dict(payload) if isinstance(payload, dict) else {}
        revision = int(event_payload.get("revision") or 0)
        if not relay_device_identity.has_credential():
            relay_activity_log.warning(
                "device.event.skipped",
                event_type=TERMINAL_CHANGED_EVENT,
                revision=revision,
                reason="credential_unavailable",
            )
            return
        try:
            relay_transport.request_json(
                "POST",
                relay_contract.endpoint("device_event"),
                {
                    "device_id": relay_device_identity.device_id(),
                    "event_type": relay_contract.event("terminal_changed"),
                    "revision": revision,
                    "payload": event_payload,
                },
                action="device.event.publish",
            )
        except Exception as error:
            relay_activity_log.error(
                "device.event.publish.failed",
                event_type=TERMINAL_CHANGED_EVENT,
                revision=revision,
                error_type=type(error).__name__,
                error=error,
            )
            return
        relay_activity_log.success(
            "device.event.publish.completed",
            event_type=TERMINAL_CHANGED_EVENT,
            revision=revision,
        )

    def _subscriber_loop(self) -> None:
        retry_seconds = relay_contract.duration("subscriber_reconnect_min_seconds")
        relay_activity_log.info("subscriber.loop.started")
        while not self._should_stop():
            snapshot = self._hub_snapshot()
            hub_url = str(snapshot.get("url") or "")
            topic = str(snapshot.get("topic") or "")
            if not hub_url or not topic or not snapshot.get("token"):
                self._wait_stop(retry_seconds)
                continue
            subscriber = MercureSubscriber(
                hub_url,
                [topic],
                token_provider=self.hub_token,
                on_update=self._on_update,
                on_state_change=self._on_hub_state,
                reconnect_min_seconds=relay_contract.duration(
                    "subscriber_reconnect_min_seconds"
                ),
                reconnect_max_seconds=relay_contract.duration(
                    "subscriber_reconnect_max_seconds"
                ),
                connect_timeout=relay_contract.duration(
                    "subscriber_connect_timeout_seconds"
                ),
                read_timeout=relay_contract.duration(
                    "subscriber_read_timeout_seconds"
                ),
                max_redirects=0,
                max_event_bytes=relay_contract.limit(
                    "device_event_payload_bytes"
                ),
            )

            def subscriber_should_stop() -> bool:
                return self._should_stop() or self._hub_changed(hub_url, topic)

            relay_activity_log.info(
                "subscriber.connection.starting",
                hub_url=hub_url,
                topic=topic,
            )
            subscriber.run(subscriber_should_stop, sleep=self._wait_stop)
            if not self._should_stop():
                self._wait_stop(retry_seconds)
        relay_activity_log.info("subscriber.loop.stopped")

    def _on_hub_state(self, state: str, detail: str) -> None:
        if state == MERCURE_STATE_ONLINE:
            relay_activity_log.success("subscriber.state.online", detail=detail)
            THREAD_BUS.signal(
                RELAY_CONTROL_SIGNAL,
                {"kind": RELAY_CONTROL_WAKE},
            )
        elif state == MERCURE_STATE_CONNECTING:
            relay_activity_log.info("subscriber.state.connecting", detail=detail)
        elif state == MERCURE_STATE_OFFLINE:
            relay_activity_log.warning("subscriber.state.offline", detail=detail)

    def _on_update(self, update: MercureUpdate) -> None:
        relay_activity_log.info(
            "subscriber.update.received",
            event_id=update.id,
            event_type=update.type,
            data_length=len(update.data.encode("utf-8")),
        )
        operation_event = relay_contract.event("operation_available")
        revocation_event = relay_contract.event("credential_revoked")
        if update.type not in (operation_event, revocation_event):
            return
        event_profile = (
            "operation_available"
            if update.type == operation_event
            else "credential_revoked"
        )
        operation_id = ""
        revision = 0
        credential_id = ""
        credential_version = 0
        try:
            payload = update.json()
            if not isinstance(payload, dict):
                raise ValueError("relay_event_payload_not_object")
            if any(
                field not in payload
                for field in relay_contract.event_payload_fields(event_profile)
            ):
                raise ValueError("relay_event_payload_incomplete")
            if update.type == operation_event:
                operation_id = str(payload.get("operation_id") or "")
                revision = int(payload.get("revision") or 0)
                if not operation_id or revision < 1:
                    raise ValueError("relay_operation_event_payload_invalid")
            else:
                credential_id = str(payload.get("credential_id") or "")
                credential_version = int(payload.get("credential_version") or 0)
                if not credential_id or credential_version < 1:
                    raise ValueError("relay_credential_event_payload_invalid")
        except Exception as error:
            relay_activity_log.error(
                "subscriber.update.rejected",
                event_id=update.id,
                event_type=update.type,
                error_type=type(error).__name__,
                error=error,
            )
            return
        if update.type == operation_event:
            THREAD_BUS.signal(
                RELAY_CONTROL_SIGNAL,
                {
                    "kind": RELAY_CONTROL_WAKE,
                    "operation_id": operation_id,
                    "revision": revision,
                },
            )
            return
        if str(payload.get("device_id") or "") != relay_device_identity.device_id():
            relay_activity_log.warning(
                "subscriber.credential_revocation.device_mismatch",
                event_id=update.id,
                device_id=payload.get("device_id"),
            )
            return
        THREAD_BUS.signal(
            RELAY_CONTROL_SIGNAL,
            {
                "kind": RELAY_CONTROL_CREDENTIAL_REVOKED,
                "credential_id": credential_id,
                "credential_version": credential_version,
            },
        )


relay_service = RelayService()


__all__ = ["RelayService", "relay_service"]
