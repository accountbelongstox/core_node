# -*- coding: utf-8 -*-
"""Signed device heartbeat and hub grant handling."""

from __future__ import annotations

import urllib.parse
from typing import Any, Dict

from pycore.pyctl.relay.relay_state import (
    RELAY_CLOCK_TRUNCATION_MS,
    RELAY_GRANT_READY_SIGNAL,
    RELAY_SUBSCRIBER_SIGNAL,
    relay_local_ms,
    relay_state,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.relay_identity import relay_device_identity
from pycore.pyutils.common.relay_request_clock import relay_request_clock
from pycore.pyutils.laravel.relay_transport import relay_transport


RELAY_GRANT_REQUIRED_KEYS = (
    "hub_url",
    "subscriber_token",
    "request_topic",
    "response_topics",
    "grant_version",
    "expires_in_seconds",
)


def validate_grant(grant: Dict[str, Any], endpoint: str) -> Dict[str, Any]:
    """Return the stored form of a grant; ValueError when it is malformed or off-origin."""
    for key in RELAY_GRANT_REQUIRED_KEYS:
        if grant.get(key) in (None, ""):
            raise ValueError(f"relay_grant_field_missing:{key}")
    hub = urllib.parse.urlsplit(str(grant["hub_url"]))
    origin = urllib.parse.urlsplit(endpoint)
    if hub.scheme != origin.scheme or hub.netloc != origin.netloc or hub.query or hub.fragment:
        raise ValueError("relay_grant_hub_origin_invalid")
    topics = []
    for item in grant["response_topics"]:
        if not isinstance(item, dict) or not item.get("topic") or not item.get("pairing_id") or not item.get("owner_topic_token"):
            raise ValueError("relay_grant_response_topic_invalid")
        topics.append(
            {
                "pairing_id": str(item["pairing_id"]),
                "owner_topic_token": str(item["owner_topic_token"]),
                "topic": str(item["topic"]),
            }
        )
    return {
        "hub_url": str(grant["hub_url"]),
        "subscriber_token": str(grant["subscriber_token"]),
        "publish_token": str(grant.get("publish_token") or ""),
        "request_topic": str(grant["request_topic"]),
        "response_topics": topics,
        "grant_version": str(grant["grant_version"]),
    }


class RelayGrantClient:
    """Send the device heartbeat and keep the latest hub grant in shared state."""

    def heartbeat(self, online: bool = True, force_grant: bool = False) -> Dict[str, Any]:
        endpoint = relay_transport.endpoint()
        data = relay_transport.request_json(
            "POST",
            relay_contract.endpoint("device_heartbeat"),
            {
                "device_id": relay_device_identity.device_id(),
                "contract_digest": relay_contract.digest,
                "capabilities": relay_contract.capabilities(),
                "online": online,
                "stream_connected": relay_state.stream_connected(),
                "active_requests": relay_state.active_requests(),
                "grant_version": "" if force_grant else relay_state.grant_version(),
            },
            timeout=relay_contract.duration("subscriber_connect_timeout_seconds"),
            action="device.heartbeat",
        )
        self._observe_clock(endpoint)
        grant = data.get("grant")
        if online and isinstance(grant, dict):
            self._store(grant, endpoint)
        relay_activity_log.debug(
            "heartbeat.acknowledged",
            online=online,
            grant_received=isinstance(grant, dict),
        )
        return data

    def ensure_fresh(self, force: bool) -> None:
        """Refresh the grant when forced or inside the refresh margin."""
        remaining = relay_state.grant_remaining_seconds()
        if force or remaining < relay_contract.duration("grant_refresh_margin_seconds"):
            self.heartbeat(force_grant=force)

    def _store(self, grant: Dict[str, Any], endpoint: str) -> None:
        stored = validate_grant(grant, endpoint)
        target_changed = relay_state.store_grant(stored, float(grant["expires_in_seconds"]))
        THREAD_BUS.signal(RELAY_GRANT_READY_SIGNAL, True)
        relay_activity_log.info(
            "grant.refreshed",
            grant_version=stored["grant_version"],
            expires_in_seconds=grant.get("expires_in_seconds"),
            pairing_count=len(stored["response_topics"]),
            stream_target_changed=target_changed,
        )
        if target_changed:
            subscriber = THREAD_BUS.get_signal(RELAY_SUBSCRIBER_SIGNAL)
            if subscriber is not None:
                subscriber.close()

    @staticmethod
    def _observe_clock(endpoint: str) -> None:
        if not relay_request_clock.ready(endpoint):
            return
        server_ms = relay_request_clock.timestamp(endpoint) * 1000 + RELAY_CLOCK_TRUNCATION_MS
        relay_state.set_clock_offset_ms(server_ms - relay_local_ms())


relay_grant = RelayGrantClient()


__all__ = ["RelayGrantClient", "relay_grant", "validate_grant"]
