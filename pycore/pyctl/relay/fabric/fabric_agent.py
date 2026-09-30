# -*- coding: utf-8 -*-
"""Relay Fabric V3 device agent lifecycle and heartbeat loop."""

from __future__ import annotations

import threading
from typing import List

from pycore.pyctl.relay.fabric.fabric_grant import relay_fabric_grant
from pycore.pyctl.relay.fabric.fabric_publisher import FabricPublisherThread
from pycore.pyctl.relay.fabric.fabric_reader import FabricReaderThread
from pycore.pyctl.relay.fabric.fabric_state import (
    FABRIC_GRANT_READY_SIGNAL,
    FABRIC_PUBLISH_QUEUE,
    FABRIC_STOP_MESSAGE,
    FABRIC_STOP_SIGNAL,
    FABRIC_SUBSCRIBER_SIGNAL,
    FABRIC_WAKE_SIGNAL,
    FABRIC_WORK_QUEUE,
    relay_fabric_state,
)
from pycore.pyctl.relay.fabric.fabric_worker import FabricWorkerThread
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.relay_fabric_contract import relay_fabric_contract
from pycore.pyutils.common.relay_identity import relay_device_identity
from pycore.pyutils.laravel.relay_transport import laravel_relay_transport


FABRIC_AGENT_STATE_QUEUE = "relay.fabric.agent"
FABRIC_AGENT_STATE_THREAD = "RelayFabricAgentThread"
FABRIC_HEARTBEAT_THREAD = "RelayFabricHeartbeatThread"
FABRIC_THREAD_JOIN_SECONDS = 2.0


def fabric_should_stop() -> bool:
    return THREAD_BUS.is_shutdown_requested() or bool(
        THREAD_BUS.get_signal(FABRIC_STOP_SIGNAL, False)
    )


class FabricHeartbeatThread(threading.Thread):
    """Send the device heartbeat on a fixed cadence and on every stream change."""

    def __init__(self) -> None:
        super().__init__(name=FABRIC_HEARTBEAT_THREAD, daemon=True)

    def run(self) -> None:
        interval = relay_fabric_contract.duration("device_heartbeat_seconds")
        retry_seconds = relay_contract.duration("subscriber_reconnect_min_seconds")
        max_retry_seconds = relay_contract.duration("subscriber_reconnect_max_seconds")
        relay_activity_log.info("fabric.heartbeat.started", interval_seconds=interval)
        while not fabric_should_stop():
            wait_seconds = interval
            if not relay_device_identity.has_credential() or not laravel_relay_transport.endpoint():
                wait_seconds = relay_contract.duration("enrollment_poll_seconds")
            else:
                try:
                    relay_fabric_grant.heartbeat()
                    retry_seconds = relay_contract.duration("subscriber_reconnect_min_seconds")
                except Exception as error:  # noqa: BLE001 - the loop owns transport failures
                    wait_seconds = min(interval, retry_seconds)
                    retry_seconds = min(max_retry_seconds, retry_seconds * 2)
                    relay_activity_log.error(
                        "fabric.heartbeat.failed",
                        error_type=type(error).__name__,
                        error=error,
                        retry_seconds=wait_seconds,
                    )
            THREAD_BUS.wait_signal(FABRIC_WAKE_SIGNAL, timeout=max(0.1, wait_seconds))
            THREAD_BUS.clear_signal(FABRIC_WAKE_SIGNAL)
        relay_activity_log.info("fabric.heartbeat.stopped")


class RelayFabricAgent:
    """Start and stop the hub-native RPC lane of the Pycore device agent."""

    def __init__(self) -> None:
        init_serialized_owner(self, FABRIC_AGENT_STATE_QUEUE, FABRIC_AGENT_STATE_THREAD)
        self._threads: List[threading.Thread] = []

    @serialized_method
    def start(self) -> None:
        alive = [thread for thread in self._threads if thread.is_alive()]
        if alive and not THREAD_BUS.get_signal(FABRIC_STOP_SIGNAL, False):
            relay_activity_log.debug("fabric.agent.present", thread_count=len(alive))
            return
        for thread in alive:
            thread.join(timeout=FABRIC_THREAD_JOIN_SECONDS)
        for signal_name in (
            FABRIC_STOP_SIGNAL,
            FABRIC_WAKE_SIGNAL,
            FABRIC_GRANT_READY_SIGNAL,
            FABRIC_SUBSCRIBER_SIGNAL,
        ):
            THREAD_BUS.clear_signal(signal_name)
        THREAD_BUS.clear_queue(FABRIC_WORK_QUEUE)
        THREAD_BUS.clear_queue(FABRIC_PUBLISH_QUEUE)
        relay_fabric_state.reset()
        threads: List[threading.Thread] = [FabricPublisherThread()]
        threads.extend(
            FabricWorkerThread(index)
            for index in range(1, relay_fabric_contract.limit("device_max_concurrent_requests") + 1)
        )
        threads.append(FabricReaderThread())
        threads.append(FabricHeartbeatThread())
        for thread in threads:
            thread.start()
        self._threads = threads
        relay_activity_log.success(
            "fabric.agent.started",
            device_id=relay_device_identity.device_id(),
            contract_digest=relay_fabric_contract.digest,
            thread_count=len(threads),
        )

    @serialized_method
    def stop(self) -> None:
        if not any(thread.is_alive() for thread in self._threads):
            return
        THREAD_BUS.signal(FABRIC_STOP_SIGNAL, True)
        THREAD_BUS.signal(FABRIC_WAKE_SIGNAL, True)
        for _index in range(relay_fabric_contract.limit("device_max_concurrent_requests")):
            THREAD_BUS.send_message(FABRIC_WORK_QUEUE, dict(FABRIC_STOP_MESSAGE))
        THREAD_BUS.send_message(FABRIC_PUBLISH_QUEUE, dict(FABRIC_STOP_MESSAGE))
        subscriber = THREAD_BUS.get_signal(FABRIC_SUBSCRIBER_SIGNAL)
        if subscriber is not None:
            subscriber.close()
        relay_fabric_state.set_stream_connected(False)
        if relay_device_identity.has_credential() and laravel_relay_transport.endpoint():
            try:
                relay_fabric_grant.heartbeat()
            except Exception as error:  # noqa: BLE001 - shutdown proceeds without the withdrawal
                relay_activity_log.error(
                    "fabric.heartbeat.withdraw.failed",
                    error_type=type(error).__name__,
                    error=error,
                )
        relay_activity_log.info("fabric.agent.stopped", device_id=relay_device_identity.device_id())


relay_fabric_agent = RelayFabricAgent()


__all__ = ["RelayFabricAgent", "relay_fabric_agent"]
