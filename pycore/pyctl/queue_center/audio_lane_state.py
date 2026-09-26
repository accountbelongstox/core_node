# -*- coding: utf-8 -*-
"""State-driven audio lanes for the Queue Center and audio orchestration.

Binding: docs_fix/REQUIREMENTS_20260926_AUDIO_ORCH_QUEUE_STATE_DRIVEN.md §5.3.
pycore owns the ONE truth of both audio lanes (word_audio / sentence_audio —
each lane its own Queue = Part1 + Part2). This module composes it:

  * switch      persisted lane capability + heartbeat callback running
  * queue       whole / Part1 / Part2 view + Part1 tracker (audio_queue_center)
  * worker      lane worker status (cycle, counters, outbox)
  * full_sync   the lane's backlog full-pull status (both lanes)
  * contract    the Queue Center section contract (same builder as the
                exchange snapshot)

and pushes it to the UI on every change: ``AudioLaneStatePublisherThread``
waits on the queue library's change signal (every lane mutation, switch,
full pull, activation), coalesces bursts, and publishes the SSE topic
``queue_center.audio_lane.changed`` with the full two-lane payload. The RPC
``ui/queue_center/audio_lane_state`` answers the same payload (optionally
scoped to one orchestration owner) for mount, reconnect, and relay polling.
"""

from __future__ import annotations

import threading
import time
import uuid
from typing import Any, Dict, Optional

from pycore.pyfoundations.serialized_worker import SerializedValue
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
from pycore.pyctl.queue_center.lane_registry import lane_callback_name
from pycore.pyctl.queue_center.snapshot_service import queue_center_snapshot_service
from pycore.pyctl.tts.audio_lane_activation import AUDIO_LANE_FULL_SYNC, lane_enabled
from pycore.pyutils.rpc_v2.delivery import http_event_delivery_service
from pycore.pyutils.tts.audio_queue_center import (
    AUDIO_QUEUE_CHANGED_SIGNAL,
    AUDIO_QUEUE_LANES,
    audio_queue_center,
)

AUDIO_LANE_STATE_TOPIC = "queue_center.audio_lane.changed"
_PUBLISHER_STOP_SIGNAL = "queue_center.audio_lane.publisher_stop"
# Coalescing window for bursts (drain pops, full-pull pages).
_COALESCE_SECONDS = 0.4
# Idle heartbeat: republish only while a lane is actively working.
_ACTIVE_HEARTBEAT_SECONDS = 5.0
_QUEUE_ITEM_LIMIT = 10


class AudioLaneState:
    """Compose and publish the two-lane audio state (pycore-owned truth)."""

    def __init__(self) -> None:
        self._instance = uuid.uuid4().hex[:12]
        self._sequence = SerializedValue(0, "AudioLaneStateSequence")
        self._publisher: Optional[AudioLaneStatePublisherThread] = None

    def _next_revision(self) -> int:
        while True:
            current = int(self._sequence.get() or 0)
            if self._sequence.compare_and_set(current, current + 1):
                return current + 1

    def lane_state(
        self,
        lane: str,
        local: Dict[str, Any],
        owner: str = "",
        item_limit: int = _QUEUE_ITEM_LIMIT,
    ) -> Dict[str, Any]:
        """One lane's state from the shared local snapshot (``local``)."""
        status = local["wordAudio"] if lane == "word_audio" else local["sentenceAudio"]
        worker = status.get("worker") if isinstance(status.get("worker"), dict) else {}
        state: Dict[str, Any] = {
            "lane": lane,
            "switch": {
                "enabled": lane_enabled(lane),
                "running": shared_heartbeat_system.is_callback_enabled(lane_callback_name(lane)),
            },
            "queue": audio_queue_center.lane_view(lane, owner=owner, item_limit=item_limit),
            "worker": {
                "cycle_running": bool(worker.get("cycle_running")),
                "processing": int(worker.get("processing") or 0),
                "queued": int(worker.get("queued") or 0),
                "total_claimed": int(worker.get("total_claimed") or 0),
                "total_succeeded": int(worker.get("total_succeeded") or 0),
                "total_failed": int(worker.get("total_failed") or 0),
                "planned_engine": worker.get("planned_engine"),
                "current_keys": list(worker.get("current_keys") or []),
                "event_revision": int(worker.get("event_revision") or 0),
                "delivery_outbox": worker.get("delivery_outbox") or {},
                "delivery_outbox_running": bool(worker.get("delivery_outbox_running")),
            },
            "section_contract": (local.get("sectionContracts") or {}).get(lane),
            "full_sync": AUDIO_LANE_FULL_SYNC[lane].get_status(),
        }
        return state

    def snapshot(self, owner: str = "", item_limit: int = _QUEUE_ITEM_LIMIT, advance: bool = False) -> Dict[str, Any]:
        """Two-lane payload (the push topic and the RPC share this shape)."""
        local = queue_center_snapshot_service.local_audio_state()
        revision = self._next_revision() if advance else int(self._sequence.get() or 0)
        return {
            "success": True,
            "instance": self._instance,
            "revision": revision,
            "generated_at": time.time(),
            "lanes": {
                lane: self.lane_state(lane, local, owner=owner, item_limit=item_limit)
                for lane in AUDIO_QUEUE_LANES
            },
            "wordAudio": local["wordAudio"],
            "sentenceAudio": local["sentenceAudio"],
        }

    def publish(self) -> None:
        """Push the current two-lane state to every UI event stream."""
        http_event_delivery_service.publish_topic(
            AUDIO_LANE_STATE_TOPIC,
            self.snapshot(advance=True),
        )

    def lanes_active(self) -> bool:
        """True while any lane works (drain cycle or full pull in flight)."""
        if any(full_sync.get_status().get("running") for full_sync in AUDIO_LANE_FULL_SYNC.values()):
            return True
        local = queue_center_snapshot_service.local_audio_state()
        for key in ("wordAudio", "sentenceAudio"):
            worker = (local.get(key) or {}).get("worker") or {}
            if worker.get("cycle_running") or int(worker.get("processing") or 0) > 0:
                return True
        return False

    def start(self) -> None:
        """Start the publisher thread once (runtime service step)."""
        if self._publisher is not None and self._publisher.is_alive():
            return
        THREAD_BUS.clear_signal(_PUBLISHER_STOP_SIGNAL)
        self._publisher = AudioLaneStatePublisherThread(self)
        self._publisher.start()
        THREAD_BUS.register_shutdown_handler(
            self.stop,
            priority=60,
            name="audio_lane_state_publisher",
        )

    def stop(self) -> None:
        THREAD_BUS.signal(_PUBLISHER_STOP_SIGNAL, True)
        THREAD_BUS.signal(AUDIO_QUEUE_CHANGED_SIGNAL, {"reason": "stop"})


class AudioLaneStatePublisherThread(threading.Thread):
    """Wait for lane changes, coalesce, publish (event-driven, no busy poll)."""

    def __init__(self, state: AudioLaneState) -> None:
        super().__init__(name="AudioLaneStatePublisherThread", daemon=True)
        self._state = state

    def _stopping(self) -> bool:
        return THREAD_BUS.is_shutdown_requested() or bool(
            THREAD_BUS.get_signal(_PUBLISHER_STOP_SIGNAL, False)
        )

    def run(self) -> None:
        while not self._stopping():
            changed = THREAD_BUS.wait_signal(AUDIO_QUEUE_CHANGED_SIGNAL, timeout=_ACTIVE_HEARTBEAT_SECONDS)
            THREAD_BUS.clear_signal(AUDIO_QUEUE_CHANGED_SIGNAL)
            if self._stopping():
                return
            if changed is None and not self._state.lanes_active():
                continue
            THREAD_BUS.wait_signal(_PUBLISHER_STOP_SIGNAL, timeout=_COALESCE_SECONDS)
            if self._stopping():
                return
            self._state.publish()


audio_lane_state = AudioLaneState()


__all__ = [
    "AUDIO_LANE_STATE_TOPIC",
    "AudioLaneState",
    "audio_lane_state",
]
