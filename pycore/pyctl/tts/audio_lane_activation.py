# -*- coding: utf-8 -*-
"""ONE ON transition for the audio lanes (word_audio / sentence_audio).

Every entry that turns a lane on (Queue Center control, auto-start helpers,
pycore boot) runs the same chain, so both lanes behave identically:

  1. restore the lane's local Queue items (orchestration / manual) from the
     snapshot (once per process; cache-first, Laravel may be offline);
  2. release every work lease a previous process of this worker id still
     holds, then claim a fresh lease batch (contract ``work_leases``);
  3. wake the drain.

A lane whose persisted switch is OFF is never activated.
"""

from typing import Any, Dict

from pycore.pyctl.assist.assist_settings import assist_capability_enabled
from pycore.pyctl.queue_center.lane_registry import lane_capability, lane_worker
from pycore.pyutils.tts.audio_queue_model import (
    AUDIO_LANE_ERROR_DISABLED,
    AUDIO_LANE_ERROR_UNKNOWN,
    AUDIO_QUEUE_LANES,
)
from pycore.pyutils.tts.audio_queue_center import audio_queue_center


def lane_enabled(lane: str) -> bool:
    """The persisted lane switch (assist capability) - the only lane flag."""
    capability = lane_capability(lane)
    return bool(capability) and assist_capability_enabled(capability)


def activate_audio_lane(lane: str) -> Dict[str, Any]:
    """Restore -> release stale leases -> claim -> drain for one enabled lane."""
    lane = str(lane or "").strip()
    if lane not in AUDIO_QUEUE_LANES:
        return {"success": False, "error_code": AUDIO_LANE_ERROR_UNKNOWN, "lane": lane}
    if not lane_enabled(lane):
        return {"success": False, "error_code": AUDIO_LANE_ERROR_DISABLED, "lane": lane}
    restored = audio_queue_center.restore_from_cache(lane)
    lane_worker(lane).release_leases("lane_start")
    audio_queue_center.request_pull(lane, prefer_remote=True)
    audio_queue_center.note_state_change(lane, "activated")
    return {"success": True, "lane": lane, "restored": restored}


def activate_enabled_audio_lanes() -> Dict[str, Any]:
    """Boot chain: activate every audio lane whose persisted switch is ON."""
    return {
        lane: activate_audio_lane(lane)
        for lane in AUDIO_QUEUE_LANES
        if lane_enabled(lane)
    }


__all__ = [
    "activate_audio_lane",
    "activate_enabled_audio_lanes",
    "lane_enabled",
]
