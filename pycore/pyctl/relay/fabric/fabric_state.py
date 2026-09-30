# -*- coding: utf-8 -*-
"""Shared THREAD_BUS-owned state for the Relay Fabric V3 device agent."""

from __future__ import annotations

import time
import urllib.parse
from collections import OrderedDict
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.relay_fabric_contract import relay_fabric_contract


FABRIC_STOP_SIGNAL = "relay.fabric.stop"
FABRIC_WAKE_SIGNAL = "relay.fabric.wake"
FABRIC_GRANT_READY_SIGNAL = "relay.fabric.grant.ready"
FABRIC_SUBSCRIBER_SIGNAL = "relay.fabric.subscriber"
FABRIC_WORK_QUEUE = "relay.fabric.work"
FABRIC_PUBLISH_QUEUE = "relay.fabric.publish"
FABRIC_STATE_QUEUE = "relay.fabric.state"
FABRIC_STATE_THREAD = "RelayFabricStateThread"
FABRIC_STOP_MESSAGE = {"kind": "stop"}
FABRIC_GRANT_REQUIRED_KEYS = (
    "hub_url",
    "subscriber_token",
    "publish_token",
    "request_topic",
    "response_topics",
    "grant_version",
    "expires_in_seconds",
)
FABRIC_VERDICT_EXECUTE = "execute"
FABRIC_VERDICT_REPLAY = "replay"
FABRIC_VERDICT_INFLIGHT = "inflight"
FABRIC_VERDICT_EXPIRED = "expired"
FABRIC_VERDICT_FORBIDDEN = "forbidden"
FABRIC_VERDICT_OVERLOAD = "overload"
FABRIC_CLOCK_TRUNCATION_MS = 500


def fabric_local_ms() -> int:
    return int(time.time() * 1000)


class RelayFabricState:
    """Grant, stream flag, in-flight set, and duplicate cache on one bus owner."""

    def __init__(self) -> None:
        init_serialized_owner(self, FABRIC_STATE_QUEUE, FABRIC_STATE_THREAD)
        self._grant: Dict[str, Any] = {}
        self._grant_expires_at = 0.0
        self._stream_connected = False
        self._clock_offset_ms = 0
        self._inflight: set = set()
        self._cache: "OrderedDict[str, Tuple[float, List[Dict[str, Any]]]]" = OrderedDict()

    @serialized_method
    def reset(self) -> None:
        self._grant = {}
        self._grant_expires_at = 0.0
        self._stream_connected = False
        self._inflight = set()
        self._cache = OrderedDict()

    @serialized_method
    def store_grant(self, grant: Dict[str, Any]) -> bool:
        """Validate and keep a grant; True when the stream target changed."""
        for key in FABRIC_GRANT_REQUIRED_KEYS:
            if grant.get(key) in (None, ""):
                raise ValueError(f"relay_fabric_grant_field_missing:{key}")
        hub = urllib.parse.urlsplit(str(grant["hub_url"]))
        origin = urllib.parse.urlsplit(relay_contract.public_url("laravel_api_origin"))
        if hub.scheme != origin.scheme or hub.netloc != origin.netloc or hub.query or hub.fragment:
            raise ValueError("relay_fabric_grant_hub_origin_invalid")
        topics = []
        for item in grant["response_topics"]:
            if not isinstance(item, dict) or not item.get("topic") or not item.get("pairing_id") or not item.get("owner_topic_token"):
                raise ValueError("relay_fabric_grant_response_topic_invalid")
            topics.append(
                {
                    "pairing_id": str(item["pairing_id"]),
                    "owner_topic_token": str(item["owner_topic_token"]),
                    "topic": str(item["topic"]),
                }
            )
        stored = {
            "hub_url": str(grant["hub_url"]),
            "subscriber_token": str(grant["subscriber_token"]),
            "publish_token": str(grant["publish_token"]),
            "request_topic": str(grant["request_topic"]),
            "response_topics": topics,
            "grant_version": str(grant["grant_version"]),
        }
        changed = (
            stored["hub_url"] != self._grant.get("hub_url")
            or stored["request_topic"] != self._grant.get("request_topic")
        )
        self._grant = stored
        self._grant_expires_at = time.monotonic() + max(1.0, float(grant["expires_in_seconds"]))
        return changed

    @serialized_method
    def grant(self) -> Dict[str, Any]:
        return self._grant

    @serialized_method
    def grant_version(self) -> str:
        return str(self._grant.get("grant_version") or "")

    @serialized_method
    def grant_remaining_seconds(self) -> float:
        if not self._grant:
            return 0.0
        return max(0.0, self._grant_expires_at - time.monotonic())

    @serialized_method
    def set_stream_connected(self, connected: bool) -> bool:
        changed = self._stream_connected != bool(connected)
        self._stream_connected = bool(connected)
        return changed

    @serialized_method
    def stream_connected(self) -> bool:
        return self._stream_connected

    @serialized_method
    def set_clock_offset_ms(self, offset_ms: int) -> None:
        self._clock_offset_ms = int(offset_ms)

    @serialized_method
    def server_now_ms(self) -> int:
        return fabric_local_ms() + self._clock_offset_ms

    @serialized_method
    def active_requests(self) -> int:
        return len(self._inflight)

    @serialized_method
    def admit(
        self,
        op: str,
        pair: str,
        owner: str,
        deadline_ms: int,
    ) -> Tuple[str, str, Optional[List[Dict[str, Any]]]]:
        """Classify one request: (verdict, response topic, cached frames)."""
        if fabric_local_ms() + self._clock_offset_ms >= int(deadline_ms):
            return FABRIC_VERDICT_EXPIRED, "", None
        topic = ""
        for item in self._grant.get("response_topics") or []:
            if item["pairing_id"] == pair and item["owner_topic_token"] == owner:
                topic = item["topic"]
                break
        if not topic:
            return FABRIC_VERDICT_FORBIDDEN, "", None
        self._purge_cache()
        key = self._key(op, owner)
        cached = self._cache.get(key)
        if cached is not None:
            return FABRIC_VERDICT_REPLAY, topic, cached[1]
        if key in self._inflight:
            return FABRIC_VERDICT_INFLIGHT, topic, None
        if len(self._inflight) >= relay_fabric_contract.limit("device_dedupe_entries"):
            return FABRIC_VERDICT_OVERLOAD, topic, None
        self._inflight.add(key)
        return FABRIC_VERDICT_EXECUTE, topic, None

    @serialized_method
    def complete(self, op: str, owner: str, frames: List[Dict[str, Any]]) -> None:
        key = self._key(op, owner)
        self._inflight.discard(key)
        self._purge_cache()
        self._cache[key] = (
            time.monotonic() + relay_fabric_contract.duration("device_dedupe_seconds"),
            frames,
        )
        self._cache.move_to_end(key)
        while len(self._cache) > relay_fabric_contract.limit("device_dedupe_entries"):
            self._cache.popitem(last=False)

    @serialized_method
    def abandon(self, op: str, owner: str) -> None:
        self._inflight.discard(self._key(op, owner))

    @staticmethod
    def _key(op: str, owner: str) -> str:
        return f"{owner}/{op}"

    def _purge_cache(self) -> None:
        now = time.monotonic()
        while self._cache:
            op, entry = next(iter(self._cache.items()))
            if entry[0] > now:
                break
            self._cache.pop(op)


relay_fabric_state = RelayFabricState()


__all__ = [
    "FABRIC_CLOCK_TRUNCATION_MS",
    "FABRIC_GRANT_READY_SIGNAL",
    "FABRIC_PUBLISH_QUEUE",
    "FABRIC_STOP_MESSAGE",
    "FABRIC_STOP_SIGNAL",
    "FABRIC_SUBSCRIBER_SIGNAL",
    "FABRIC_VERDICT_EXECUTE",
    "FABRIC_VERDICT_EXPIRED",
    "FABRIC_VERDICT_FORBIDDEN",
    "FABRIC_VERDICT_INFLIGHT",
    "FABRIC_VERDICT_OVERLOAD",
    "FABRIC_VERDICT_REPLAY",
    "FABRIC_WAKE_SIGNAL",
    "FABRIC_WORK_QUEUE",
    "RelayFabricState",
    "fabric_local_ms",
    "relay_fabric_state",
]
