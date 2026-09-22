# -*- coding: utf-8 -*-
"""Shared audio queue library: ONE whole-Queue per lane = Part1 + Part2.

INDEPENDENT class library, instantiated once at pycore initialization and
GLOBALLY SHARED (``audio_queue_center`` below). Lane workers, audio
orchestration, the snapshot service, and RPC controllers import this
instance — none of them constructs a queue or embeds the implementation.

Queue model (binding, docs_fix/REQUIREMENTS_20260922_AUDIO_QUEUE_HEAD_PART1_PART2.md):
  * Queue ALWAYS = Part1 + Part2. Part1 is EMPTY until an orchestration
    push or a pycore-manager promote fills it; nothing else writes Part1.
  * Externally the two parts are ONE Queue: outside actors never see the
    split, never address a part. The split is INTERNAL (ordering part_rank
    + the Part1 membership set), annotated at every related code path.
  * ANY head promotion operates on the WHOLE Queue; dedup always runs
    against the whole Queue (an item exists at most once across parts).
  * Part1 fill path: pycore self-promotion (orchestration / pycore-manager)
    writes DIRECTLY into Part1 (``promote_local_head``).
  * Part2 fill path: wordnew notifies Laravel first, so Laravel's initial
    sync, diff updates, and realtime head tickets DEFAULT to Part2
    (``initialize_from_laravel`` / ``apply_laravel_diff`` /
    ``apply_head_ticket``). A Part2 ticket never demotes a Part1 member.
  * Direction: Laravel -> pycore only. This library NEVER sends head state
    to Laravel.

Public API (the ONLY external surface; everything else is library-internal):
  M1 ``initialize_from_laravel(lane)``  - initial Laravel state -> fills Part2.
  M2 ``apply_laravel_diff(lane)``       - timed diff entry -> Part2 update.
     ``apply_head_ticket(lane, id, pos)`` - realtime {queue}_head ticket -> Part2.
  M3 ``promote_local_head(lane, items)`` - pycore self-promotion -> fills Part1.
  M4 ``get_head(lane, limit)``          - read head value(s) WITHOUT consuming.
  M5 ``accept_task`` / ``pop_next`` / ``complete`` / ``request_pull`` /
     ``queue_snapshot`` - intake, consumer drain, wake, and status entries.

The Laravel-facing intake mechanics (HTTP, cursors, segment store) stay in
the worker layer (pyctl); each lane worker registers its intake callables
here at construction and this library delegates to them — the library
itself never imports upward.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Set

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.common.queue_center_contract import (
    audio_dedup_key,
    audio_dedup_key_from_task,
)
from pycore.pyutils.tts.audio_task_queue import AudioTaskQueue

# Lanes owned by the library (contract queue keys), built eagerly so the
# shared instance is fully initialized at pycore boot.
AUDIO_QUEUE_LANES = ("word_audio", "sentence_audio")


class AudioQueueCenter:
    """Globally shared owner of the per-lane whole-Queue (Part1 + Part2)."""

    def __init__(self) -> None:
        self._queues: Dict[str, AudioTaskQueue] = {}
        # INTERNAL Part1/Part2 split state: per-lane Part1 membership sets,
        # shared BY REFERENCE with the lane queues' ordering resolvers.
        self._part1_keys: Dict[str, Set[str]] = {}
        # Registered Laravel-intake callables per lane (dependency injection
        # from the worker layer; the library never imports pyctl).
        self._intake: Dict[str, Dict[str, Callable[..., Any]]] = {}
        init_serialized_owner(
            self,
            "tts.audio_queue_center",
            "AudioQueueCenterState",
        )
        for lane in AUDIO_QUEUE_LANES:
            part1_keys: Set[str] = set()
            self._part1_keys[lane] = part1_keys
            self._queues[lane] = AudioTaskQueue(
                queue_name=lane,
                task_type=lane,
                dedup_key_of=(
                    lambda task, lane_key=lane: audio_dedup_key_from_task(task, lane_key)
                ),
                part1_keys=part1_keys,
            )

    # -------------------- lane wiring (worker layer) --------------------

    def queue_for(self, lane: str) -> Optional[AudioTaskQueue]:
        """Return the shared lane queue (whole-Queue; ownership stays here)."""
        return self._queues.get(str(lane or "").strip())

    @serialized_method
    def register_lane_intake(
        self,
        lane: str,
        initializer: Optional[Callable[[], Dict[str, Any]]] = None,
        diff_applier: Optional[Callable[[], Dict[str, Any]]] = None,
        head_ticket_applier: Optional[Callable[[Any, int], None]] = None,
        waker: Optional[Callable[..., None]] = None,
    ) -> None:
        """Register one lane's Laravel-intake callables (worker layer)."""
        entry = self._intake.setdefault(str(lane or "").strip(), {})
        if initializer is not None:
            entry["initializer"] = initializer
        if diff_applier is not None:
            entry["diff_applier"] = diff_applier
        if head_ticket_applier is not None:
            entry["head_ticket_applier"] = head_ticket_applier
        if waker is not None:
            entry["waker"] = waker

    def _wake(self, lane: str, prefer_remote: bool = False) -> None:
        """INTERNAL: wake the lane's registered pull entry (M5 request_pull)."""
        waker = (self._intake.get(lane) or {}).get("waker")
        if waker is not None:
            waker(prefer_remote=prefer_remote)

    # -------------------- M1/M2: Laravel intake (fills/updates Part2) --------------------

    def initialize_from_laravel(self, lane: str) -> Dict[str, Any]:
        """M1: fetch Laravel's initial state and initialize the queue.

        Actually FILLS Part2 (bootstrap full order + mirror) through the
        lane's registered initializer.
        """
        initializer = (self._intake.get(str(lane or "").strip()) or {}).get("initializer")
        if initializer is None:
            return {"success": False, "error": f"no Laravel intake registered for lane {lane}"}
        return initializer()

    def apply_laravel_diff(self, lane: str) -> Dict[str, Any]:
        """M2: the TIMED Laravel diff receive entry.

        When the diff carries changes, only the diff portion is updated —
        actually a Part2 update (stage new rows, drop vanished, re-align
        order) through the lane's registered diff applier.
        """
        diff_applier = (self._intake.get(str(lane or "").strip()) or {}).get("diff_applier")
        if diff_applier is None:
            return {"success": False, "error": f"no Laravel intake registered for lane {lane}"}
        return diff_applier()

    def apply_head_ticket(self, lane: str, task_id: Any, queue_position: int) -> bool:
        """M2 realtime: one Laravel ``{queue}_head`` ticket.

        Because wordnew notifies Laravel first, a head ticket DEFAULTS to
        landing in Part2. Whole-Queue dedup: an entry already held in Part1
        keeps its single front copy (the ticket never demotes it).
        """
        queue = self.queue_for(lane)
        if queue is None:
            return False
        moved = queue.move_to_head(task_id, queue_position)
        applier = (self._intake.get(str(lane or "").strip()) or {}).get("head_ticket_applier")
        if applier is not None:
            applier(task_id, int(queue_position or 0))
        if moved:
            self._wake(str(lane or "").strip(), prefer_remote=True)
        return moved

    # -------------------- M3: pycore self-promotion (fills Part1) --------------------

    def promote_local_head(self, lane: str, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """M3: pycore self-promotion — FILLS Part1 DIRECTLY.

        ``items``: ``[{language, text, content_id?, md5?}, ...]`` (the
        canonical dedup key is computed with the ONE contract helper).
        Whole-Queue dedup: an item whose single copy already sits in the
        queue is claimed into Part1 (front position wins); an item already
        in Part1 is refreshed in place. Never touches Laravel.
        """
        lane = str(lane or "").strip()
        queue = self.queue_for(lane)
        if queue is None:
            return {"success": False, "error": f"unknown lane {lane}"}
        keys: Set[str] = set()
        for item in items:
            if not isinstance(item, dict):
                continue
            key = audio_dedup_key(
                lane,
                item.get("language"),
                item.get("text"),
                item.get("content_id"),
                item.get("md5"),
            )
            if key.split(":", 1)[-1]:
                keys.add(key)
        if not keys:
            return {"success": False, "error": "no promotable items"}
        self._part1_keys.setdefault(lane, set()).update(keys)
        claimed = queue.claim_part1(keys)
        self._wake(lane, prefer_remote=True)
        ColorPrint.green(
            f"[AudioQueue] {lane} local promote: part1_keys={len(keys)} claimed={claimed}"
        )
        return {
            "success": True,
            "lane": lane,
            "promoted": len(keys),
            "claimed": claimed,
        }

    # -------------------- M4/M5: reads, intake, drain, wake, status --------------------

    def get_head(self, lane: str, limit: int = 1) -> List[Dict[str, Any]]:
        """M4: read the current queue-head value(s) WITHOUT consuming them."""
        queue = self.queue_for(lane)
        if queue is None:
            return []
        return queue.head_preview(limit)

    def accept_task(self, lane: str, task: Dict[str, Any]) -> bool:
        """M5 intake: admit one task into the whole Queue (dedup + part rank)."""
        queue = self.queue_for(lane)
        return bool(queue and queue.push(task))

    def pop_next(self, lane: str) -> Optional[Dict[str, Any]]:
        """M5 consumer entry: pop the whole-Queue head (Part1 first)."""
        queue = self.queue_for(lane)
        return queue.pop() if queue is not None else None

    def complete(self, lane: str, task: Dict[str, Any]) -> None:
        """M5 consumer entry: mark one popped task terminal."""
        queue = self.queue_for(lane)
        if queue is not None:
            queue.complete(task)

    def request_pull(self, lane: str, prefer_remote: bool = False) -> None:
        """M5 wake entry: re-run the lane's Laravel intake (M1/M2)."""
        self._wake(str(lane or "").strip(), prefer_remote=prefer_remote)

    def queue_snapshot(self, lane: str) -> Dict[str, Any]:
        """M5 status read: whole-Queue size, Part1 size, head preview.

        The Part1/Part2 split is INTERNAL: external surfaces receive this
        as ONE queue's status, never as per-part data.
        """
        lane = str(lane or "").strip()
        queue = self.queue_for(lane)
        if queue is None:
            return {}
        return {
            "lane": lane,
            "queued": len(queue),
            "part1_keys": len(self._part1_keys.get(lane) or ()),
            "head": queue.head_preview(5),
        }


audio_queue_center = AudioQueueCenter()


__all__ = ["AUDIO_QUEUE_LANES", "AudioQueueCenter", "audio_queue_center"]
