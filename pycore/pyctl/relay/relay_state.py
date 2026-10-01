# -*- coding: utf-8 -*-
"""Shared THREAD_BUS-owned state of the relay device agent."""

from __future__ import annotations

import time
from collections import OrderedDict
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.time_utils import utc_now_ms
from pycore.pyutils.common.relay_contract import relay_contract


RELAY_STOP_SIGNAL = "relay.stop"
RELAY_WAKE_SIGNAL = "relay.wake"
RELAY_GRANT_READY_SIGNAL = "relay.grant.ready"
RELAY_SUBSCRIBER_SIGNAL = "relay.subscriber"
RELAY_WORK_QUEUE = "relay.work"
RELAY_PUBLISH_QUEUE = "relay.publish"
RELAY_STATE_QUEUE = "relay.state"
RELAY_STATE_THREAD = "RelayStateThread"
RELAY_STOP_MESSAGE = {"kind": "stop"}
RELAY_VERDICT_EXECUTE = "execute"
RELAY_VERDICT_REPLAY = "replay"
RELAY_VERDICT_INFLIGHT = "inflight"
RELAY_VERDICT_EXPIRED = "expired"
RELAY_VERDICT_FORBIDDEN = "forbidden"
RELAY_VERDICT_OVERLOAD = "overload"
RELAY_CLOCK_TRUNCATION_MS = 500


def relay_local_ms() -> int:
    return utc_now_ms()


class RelayState:
    """Grant, stream flag, in-flight set, and duplicate cache on one bus owner."""

    def __init__(self) -> None:
        init_serialized_owner(self, RELAY_STATE_QUEUE, RELAY_STATE_THREAD)
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
    def store_grant(self, stored: Dict[str, Any], expires_in_seconds: float) -> bool:
        """Keep a validated grant; True when the stream target changed."""
        changed = (
            stored["hub_url"] != self._grant.get("hub_url")
            or stored["request_topic"] != self._grant.get("request_topic")
        )
        self._grant = stored
        self._grant_expires_at = time.monotonic() + max(1.0, float(expires_in_seconds))
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
        return relay_local_ms() + self._clock_offset_ms

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
        if relay_local_ms() + self._clock_offset_ms >= int(deadline_ms):
            return RELAY_VERDICT_EXPIRED, "", None
        topic = ""
        for item in self._grant.get("response_topics") or []:
            if item["pairing_id"] == pair and item["owner_topic_token"] == owner:
                topic = item["topic"]
                break
        if not topic:
            return RELAY_VERDICT_FORBIDDEN, "", None
        self._purge_cache()
        key = self._key(op, owner)
        cached = self._cache.get(key)
        if cached is not None:
            return RELAY_VERDICT_REPLAY, topic, cached[1]
        if key in self._inflight:
            return RELAY_VERDICT_INFLIGHT, topic, None
        if len(self._inflight) >= relay_contract.limit("device_dedupe_entries"):
            return RELAY_VERDICT_OVERLOAD, topic, None
        self._inflight.add(key)
        return RELAY_VERDICT_EXECUTE, topic, None

    @serialized_method
    def complete(self, op: str, owner: str, frames: List[Dict[str, Any]]) -> None:
        key = self._key(op, owner)
        self._inflight.discard(key)
        self._purge_cache()
        self._cache[key] = (
            time.monotonic() + relay_contract.duration("device_dedupe_seconds"),
            frames,
        )
        self._cache.move_to_end(key)
        while len(self._cache) > relay_contract.limit("device_dedupe_entries"):
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


relay_state = RelayState()


__all__ = [
    "RELAY_CLOCK_TRUNCATION_MS",
    "RELAY_GRANT_READY_SIGNAL",
    "RELAY_PUBLISH_QUEUE",
    "RELAY_STOP_MESSAGE",
    "RELAY_STOP_SIGNAL",
    "RELAY_SUBSCRIBER_SIGNAL",
    "RELAY_VERDICT_EXECUTE",
    "RELAY_VERDICT_EXPIRED",
    "RELAY_VERDICT_FORBIDDEN",
    "RELAY_VERDICT_INFLIGHT",
    "RELAY_VERDICT_OVERLOAD",
    "RELAY_VERDICT_REPLAY",
    "RELAY_WAKE_SIGNAL",
    "RELAY_WORK_QUEUE",
    "RelayState",
    "relay_local_ms",
    "relay_state",
]
