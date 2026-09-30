# -*- coding: utf-8 -*-
"""Signed device heartbeat and hub grant handling for Relay Fabric V3."""

from __future__ import annotations

from typing import Any, Dict

from pycore.pyctl.relay.fabric.fabric_state import (
    FABRIC_CLOCK_TRUNCATION_MS,
    FABRIC_GRANT_READY_SIGNAL,
    FABRIC_SUBSCRIBER_SIGNAL,
    fabric_local_ms,
    relay_fabric_state,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.relay_fabric_contract import relay_fabric_contract
from pycore.pyutils.common.relay_identity import relay_device_identity
from pycore.pyutils.common.relay_request_clock import relay_request_clock
from pycore.pyutils.laravel.relay_transport import laravel_relay_transport


class RelayFabricGrantClient:
    """Send the device heartbeat and keep the latest hub grant in shared state."""

    def heartbeat(self, force_grant: bool = False) -> Dict[str, Any]:
        endpoint = laravel_relay_transport.endpoint()
        data = laravel_relay_transport.request_json(
            "POST",
            relay_fabric_contract.endpoint("device_heartbeat"),
            {
                "device_id": relay_device_identity.device_id(),
                "contract_digest": relay_fabric_contract.digest,
                "stream_connected": relay_fabric_state.stream_connected(),
                "active_requests": relay_fabric_state.active_requests(),
                "grant_version": "" if force_grant else relay_fabric_state.grant_version(),
            },
            timeout=relay_contract.duration("subscriber_connect_timeout_seconds"),
            action="fabric.device.heartbeat",
            coordinator_url=endpoint,
        )
        self._observe_clock(endpoint)
        grant = data.get("grant")
        if isinstance(grant, dict):
            self._store(grant)
        relay_activity_log.debug(
            "fabric.heartbeat.acknowledged",
            fast_capable=data.get("fast_capable"),
            grant_received=isinstance(grant, dict),
        )
        return data

    def ensure_fresh(self, force: bool) -> None:
        """Refresh the grant when forced or inside the refresh margin."""
        remaining = relay_fabric_state.grant_remaining_seconds()
        if force or remaining < relay_fabric_contract.duration("grant_refresh_margin_seconds"):
            self.heartbeat(force_grant=force)

    def _store(self, grant: Dict[str, Any]) -> None:
        target_changed = relay_fabric_state.store_grant(grant)
        THREAD_BUS.signal(FABRIC_GRANT_READY_SIGNAL, True)
        relay_activity_log.info(
            "fabric.grant.refreshed",
            grant_version=grant.get("grant_version"),
            expires_in_seconds=grant.get("expires_in_seconds"),
            pairing_count=len(grant.get("response_topics") or []),
            stream_target_changed=target_changed,
        )
        if target_changed:
            subscriber = THREAD_BUS.get_signal(FABRIC_SUBSCRIBER_SIGNAL)
            if subscriber is not None:
                subscriber.close()

    @staticmethod
    def _observe_clock(endpoint: str) -> None:
        if not relay_request_clock.ready(endpoint):
            return
        server_ms = relay_request_clock.timestamp(endpoint) * 1000 + FABRIC_CLOCK_TRUNCATION_MS
        relay_fabric_state.set_clock_offset_ms(server_ms - fabric_local_ms())


relay_fabric_grant = RelayFabricGrantClient()


__all__ = ["RelayFabricGrantClient", "relay_fabric_grant"]
