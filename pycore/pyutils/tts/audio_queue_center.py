# -*- coding: utf-8 -*-
"""Shared audio queue library: ONE whole-Queue per lane = Part1 + Part2.

INDEPENDENT class library, instantiated once at pycore initialization and
GLOBALLY SHARED (``audio_queue_center`` below). Lane workers, audio
orchestration, the lane-state publisher, and RPC controllers import this
instance — none of them constructs a queue or embeds the implementation.

Queue model (binding: docs_fix/REQUIREMENTS_20260926_AUDIO_ORCH_QUEUE_STATE_DRIVEN.md
§5.2, refining docs_fix/REQUIREMENTS_20260922_AUDIO_QUEUE_HEAD_PART1_PART2.md):
  * Queue ALWAYS = Part1 + Part2, one whole-Queue heap per lane; every
    mutation and every dedup runs against the whole Queue.
  * Part1 = pycore-local priority. Filled ONLY by audio orchestration
    (manifest misses, words and sentences as local tasks) and the
    pycore-manager manual promote (``promote_local_head``).
  * Part2 = the Laravel backlog: Laravel's queue mirror (M1/M2/head tickets)
    and pycore's full pull of the dictionary backlog (``accept_backlog``). A
    Part2 ticket never demotes a Part1 member.
  * Part1 items are TRACKED for observability (queued -> processing ->
    done | failed, owners, provider, settled_by). The split may be
    VISUALIZED through ``lane_view``; actors never address a part.
  * One generator per item: an owner ``take_local``s its Part1 items before
    generating them and ``settle_local``s the outcome; items a lane worker
    already popped settle through ``complete``.
  * Direction: Laravel -> pycore only. This library NEVER sends head state
    to Laravel.

Public API (the ONLY external surface; everything else is library-internal):
  M1 ``initialize_from_laravel(lane)``  - initial Laravel state -> fills Part2.
  M2 ``apply_laravel_diff(lane)`` / ``apply_backlog_order(lane, ids)`` -
     timed diff entry -> Part2 update; ``apply_head_ticket`` - realtime
     {queue}_head ticket -> Part2; ``accept_backlog`` - pycore full-pull
     mirror of the Laravel backlog -> Part2.
  M3 ``promote_local_head(lane, items, owner)`` - pycore self-promotion ->
     fills Part1; ``take_local`` / ``settle_local`` / ``tracked_states`` -
     owner-side generation of its own Part1 items.
  M4 ``get_head`` / ``queued_count`` / ``lane_view`` / ``revision`` - reads.
  M5 ``accept_task`` / ``pop_next`` / ``complete`` / ``request_pull`` -
     intake, consumer drain, and wake entries.
  INTERNAL persistence hooks: ``restore_from_cache(lane)`` (once per process,
  before any remote intake) and ``persist_snapshot(lane, source)`` (marks the
  lane dirty; the persister thread writes it debounced, and a final flush
  runs at shutdown). ``restore_complete(lane)`` / ``wait_for_restore(lane,
  timeout)`` let a lane's own remote-intake starter (state-driven, no
  polling) hold off until that lane's cache-first restore has finished.

Every mutation bumps the lane revision and publishes the THREAD_BUS signal
``AUDIO_QUEUE_CHANGED_SIGNAL`` so the pyctl lane-state publisher can push the
new state to the UI. The Laravel-facing intake mechanics stay in the worker
layer (pyctl), registered here as callables — the library never imports
upward.
"""

from __future__ import annotations

import time
from typing import Any, Callable, Dict, List, Optional, Set

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.queue_center_contract import audio_dedup_key_from_task
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.tts import audio_queue_cache
from pycore.pyutils.tts.audio_queue_model import (
    AUDIO_QUEUE_CHANGED_SIGNAL,
    AUDIO_QUEUE_LANES,
    LANE_VIEW_ITEM_LIMIT,
    PRUNED_SETTLE_ERROR,
    SERVER_NOT_SELECTED_ERROR,
    SETTLED_BY_LANE,
    TRACK_DONE,
    TRACK_FAILED,
    TRACK_PROCESSING,
    TRACK_QUEUED,
    bind_task_server,
    task_for_selected_server,
    task_language,
    task_text,
)
from pycore.pyutils.tts.audio_queue_part1 import AudioQueuePart1Mixin
from pycore.pyutils.tts.audio_queue_persistence import AudioQueuePersistThread, AudioQueuePersistenceMixin
from pycore.pyutils.tts.audio_task_queue import AudioTaskQueue


class AudioQueueCenter(AudioQueuePart1Mixin, AudioQueuePersistenceMixin):
    """Globally shared owner of the per-lane whole-Queue (Part1 + Part2)."""

    def __init__(self) -> None:
        self._queues: Dict[str, AudioTaskQueue] = {}
        # INTERNAL Part1/Part2 split state: per-lane Part1 membership sets,
        # shared BY REFERENCE with the lane queues' ordering resolvers.
        self._part1_keys: Dict[str, Set[str]] = {}
        # Part1 observability tracker: lane -> key -> entry (owner thread only).
        self._tracked: Dict[str, Dict[str, Dict[str, Any]]] = {}
        # Tasks an owner took out of the heap and has not settled yet.
        self._taken: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self._revision: Dict[str, int] = {}
        self._dirty: Dict[str, str] = {}
        self._restored: Set[str] = set()
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
            self._tracked[lane] = {}
            self._taken[lane] = {}
            self._revision[lane] = 0
            self._queues[lane] = AudioTaskQueue(
                queue_name=lane,
                task_type=lane,
                dedup_key_of=(
                    lambda task, lane_key=lane: audio_dedup_key_from_task(task, lane_key)
                ),
                part1_keys=part1_keys,
            )
        self._persister = AudioQueuePersistThread(self)
        self._persister.start()
        THREAD_BUS.register_shutdown_handler(
            self.flush_dirty,
            priority=70,
            name="audio_queue_center_persist",
        )
        laravel_endpoint_manager.register_endpoint_change_listener(
            lambda _url: self.retain_selected_server()
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

    @serialized_method
    def _intake_callable(self, lane: str, name: str) -> Optional[Callable[..., Any]]:
        return (self._intake.get(lane) or {}).get(name)

    def _wake(self, lane: str, prefer_remote: bool = False) -> None:
        """INTERNAL: wake the lane's registered pull entry (M5 request_pull)."""
        waker = self._intake_callable(lane, "waker")
        if waker is not None:
            waker(prefer_remote=prefer_remote)

    # -------------------- change signal (observability) --------------------

    @serialized_method
    def _bump_revision(self, lane: str) -> int:
        self._revision[lane] = int(self._revision.get(lane) or 0) + 1
        return self._revision[lane]

    def _notify(self, lane: str, reason: str) -> None:
        """INTERNAL: bump the lane revision and signal the lane-state publisher."""
        revision = self._bump_revision(lane)
        THREAD_BUS.signal(
            AUDIO_QUEUE_CHANGED_SIGNAL,
            {"lane": lane, "revision": revision, "reason": reason, "at": time.time()},
        )

    def note_state_change(self, lane: str, reason: str) -> None:
        """M4 hook: a lane-level state outside the heap changed (switch,
        full pull progress, worker lifecycle) — republish the lane state."""
        lane = str(lane or "").strip()
        if lane in self._queues:
            self._notify(lane, reason)

    @serialized_method
    def revision(self, lane: str) -> int:
        """M4: monotonic per-lane state revision (UI stale-state guard)."""
        return int(self._revision.get(str(lane or "").strip()) or 0)

    # -------------------- M1/M2: Laravel intake (fills/updates Part2) --------------------

    def initialize_from_laravel(self, lane: str) -> Dict[str, Any]:
        """M1: fetch Laravel's initial state and initialize the queue.

        Actually FILLS Part2 (bootstrap full order + mirror) through the
        lane's registered initializer.
        """
        lane = str(lane or "").strip()
        initializer = self._intake_callable(lane, "initializer")
        if initializer is None:
            return {"success": False, "error": f"no Laravel intake registered for lane {lane}"}
        return initializer()

    def apply_laravel_diff(self, lane: str) -> Dict[str, Any]:
        """M2: the TIMED Laravel diff receive entry (Part2 update)."""
        lane = str(lane or "").strip()
        diff_applier = self._intake_callable(lane, "diff_applier")
        if diff_applier is None:
            return {"success": False, "error": f"no Laravel intake registered for lane {lane}"}
        result = diff_applier()
        self.persist_snapshot(lane, source=audio_queue_cache.SOURCE_LARAVEL_INTAKE)
        self._notify(lane, "laravel_diff")
        return result

    def apply_backlog_order(self, lane: str, ordered_task_ids: List[Any]) -> Dict[str, int]:
        """M2: re-align Part2 with Laravel's authoritative pending claim order.

        Mirrored entries absent from the order are pruned (they were finished
        or claimed elsewhere). Local entries (``_local_source``) and Part1
        members keep their place.
        """
        lane = str(lane or "").strip()
        queue = self.queue_for(lane)
        if queue is None:
            return {"reordered": 0, "pruned": 0}
        reordered = queue.reorder(ordered_task_ids)
        pruned, pruned_part1 = queue.prune_absent(ordered_task_ids)
        owners: Set[str] = set()
        if pruned_part1:
            # A Part1 owner watching a pruned entry must not wait forever:
            # its tracker entry settles (failed -> the owner resolves the
            # item itself, e.g. downloads the audio produced elsewhere).
            _released, owners = self._settle_state(
                lane,
                {key: {"ok": False, "error": PRUNED_SETTLE_ERROR} for key in pruned_part1},
                SETTLED_BY_LANE,
            )
        if reordered or pruned:
            self.persist_snapshot(lane, source=audio_queue_cache.SOURCE_LARAVEL_INTAKE)
            self._notify(lane, "laravel_order")
        self._wake_owners(lane, owners)
        return {"reordered": reordered, "pruned": pruned}

    def apply_head_ticket(
        self,
        lane: str,
        task_id: Any,
        queue_position: int,
        dedup_key: Any = "",
    ) -> bool:
        """M2 realtime: one Laravel ``{queue}_head`` ticket (Part2).

        Resolution order: exact task_id first; dedup identity fallback for
        lanes filled by pycore's full pull. A Part1 member keeps its single
        front copy (the ticket never demotes it).
        """
        lane = str(lane or "").strip()
        queue = self.queue_for(lane)
        if queue is None:
            return False
        moved = queue.move_to_head(task_id, queue_position)
        if not moved and str(dedup_key or "").strip():
            moved = queue.move_to_head_by_dedup_key(dedup_key, queue_position)
        applier = self._intake_callable(lane, "head_ticket_applier")
        if applier is not None:
            applier(task_id, int(queue_position or 0))
        if moved:
            self._notify(lane, "head_ticket")
            self._wake(lane, prefer_remote=True)
        return moved

    def accept_backlog(
        self,
        lane: str,
        tasks: List[Dict[str, Any]],
        source: str = audio_queue_cache.SOURCE_FULL_SYNC,
    ) -> Dict[str, Any]:
        """M2: pycore full-pull mirror of the Laravel backlog -> Part2.

        Whole-Queue dedup: an identity already queued (either part) keeps
        its ONE existing copy. Never touches Part1 membership.
        """
        lane = str(lane or "").strip()
        queue = self.queue_for(lane)
        if queue is None:
            return {"success": False, "error": f"unknown lane {lane}", "inserted": 0}
        inserted = 0
        selected = laravel_endpoint_manager.selected_server_matcher()
        for task in tasks:
            if not isinstance(task, dict) or not task_for_selected_server(bind_task_server(task), selected):
                continue
            dedup_key = audio_dedup_key_from_task(task, lane)
            if dedup_key and queue.has_dedup_key(dedup_key):
                continue
            if queue.push(task):
                inserted += 1
        if inserted:
            self.persist_snapshot(lane, source=source)
            self._notify(lane, "backlog")
        return {"success": True, "lane": lane, "inserted": inserted}

    # -------------------- M4/M5: reads, intake, drain, wake, status --------------------

    def get_head(self, lane: str, limit: int = 1) -> List[Dict[str, Any]]:
        """M4: read the current queue-head value(s) WITHOUT consuming them."""
        queue = self.queue_for(lane)
        if queue is None:
            return []
        return queue.head_preview(limit)

    def queued_count(self, lane: str) -> int:
        """M4: O(1) whole-Queue size for status surfaces."""
        queue = self.queue_for(lane)
        return len(queue) if queue is not None else 0

    @serialized_method
    def _tracker_view(self, lane: str, owner: str, item_limit: int) -> Dict[str, Any]:
        counts = {TRACK_QUEUED: 0, TRACK_PROCESSING: 0, TRACK_DONE: 0, TRACK_FAILED: 0}
        owner_counts = dict(counts)
        owner_items: List[Dict[str, Any]] = []
        for entry in (self._tracked.get(lane) or {}).values():
            counts[entry["state"]] = counts.get(entry["state"], 0) + 1
            if owner and owner in entry["owners"]:
                owner_counts[entry["state"]] = owner_counts.get(entry["state"], 0) + 1
                owner_items.append(entry)
        # Active items first (processing, queued), then the latest settled.
        rank = {TRACK_PROCESSING: 0, TRACK_QUEUED: 1, TRACK_FAILED: 2, TRACK_DONE: 3}
        owner_items.sort(key=lambda entry: (rank.get(entry["state"], 9), -entry["updated_at"]))
        return {
            "revision": int(self._revision.get(lane) or 0),
            "tracked": counts,
            "owner": {
                "id": owner,
                "counts": owner_counts,
                "total": sum(owner_counts.values()),
                "items": [self._export_entry(entry) for entry in owner_items[:item_limit]],
            } if owner else None,
        }

    def lane_view(self, lane: str, owner: str = "", item_limit: int = 20) -> Dict[str, Any]:
        """M4: read-only Part1 / Part2 / whole-Queue view for visualization.

        ``owner`` scopes the tracker to one orchestration task (its missing
        resources and their fill states). Never exposes a mutation surface.
        """
        lane = str(lane or "").strip()
        queue = self.queue_for(lane)
        if queue is None:
            return {}
        limit = max(1, min(LANE_VIEW_ITEM_LIMIT, int(item_limit or 20)))
        parts = queue.part_view(limit)
        tracker = self._tracker_view(lane, str(owner or ""), limit)

        def _row(task: Dict[str, Any]) -> Dict[str, Any]:
            return {
                "task_id": str(task.get("task_id") or ""),
                "text": task_text(task)[:160],
                "language": task_language(task),
                "local_source": str(task.get("_local_source") or ""),
            }

        return {
            "lane": lane,
            "revision": tracker["revision"],
            "queued": parts["queued"],
            "part1": parts["part1"],
            "part2": parts["part2"],
            "taken": len(self._taken_keys(lane)),
            "part1_head": [_row(task) for task in parts["part1_head"]],
            "part2_head": [_row(task) for task in parts["part2_head"]],
            "tracked": tracker["tracked"],
            "owner": tracker["owner"],
        }

    def queue_snapshot(self, lane: str) -> Dict[str, Any]:
        """M4 status read: whole-Queue size, Part1 size, head preview."""
        view = self.lane_view(lane, item_limit=5)
        if not view:
            return {}
        return {
            "lane": view["lane"],
            "queued": view["queued"],
            "part1_keys": view["part1"],
            "head": self.get_head(lane, 5),
        }

    def accept_task(self, lane: str, task: Dict[str, Any]) -> bool:
        """M5 intake: admit one task with whole-Queue canonical dedup."""
        lane = str(lane or "").strip()
        queue = self.queue_for(lane)
        if queue is None or not task_for_selected_server(bind_task_server(task)):
            return False
        dedup_key = audio_dedup_key_from_task(task, lane)
        if dedup_key and queue.has_dedup_key(dedup_key):
            return False
        pushed = queue.push(task)
        if pushed:
            self._notify(lane, "accept")
        return pushed

    @serialized_method
    def _mark_lane_processing(self, lane: str, key: str) -> bool:
        entry = self._tracked[lane].get(key)
        if entry is None:
            return False
        entry["state"] = TRACK_PROCESSING
        entry["settled_by"] = SETTLED_BY_LANE
        entry["started_at"] = time.time()
        entry["updated_at"] = entry["started_at"]
        return True

    def pop_next(self, lane: str) -> Optional[Dict[str, Any]]:
        """M5 consumer entry: pop the whole-Queue head (Part1 first); a task
        of another Laravel server is settled as not selected, never run."""
        lane = str(lane or "").strip()
        queue = self.queue_for(lane)
        if queue is None:
            return None
        task = queue.pop()
        while task is not None and not task_for_selected_server(task):
            self.complete(lane, task, ok=False, error=SERVER_NOT_SELECTED_ERROR)
            task = queue.pop()
        if task is None:
            return None
        dedup_key = audio_dedup_key_from_task(task, lane)
        if dedup_key:
            self._mark_lane_processing(lane, dedup_key)
        self._notify(lane, "pop")
        return task

    def complete(
        self,
        lane: str,
        task: Dict[str, Any],
        ok: bool = True,
        provider: str = "",
        error: str = "",
    ) -> None:
        """M5 consumer entry: mark one popped task terminal.

        Part1 membership describes live queue entries, not historical words:
        it is released at the terminal boundary; the tracker records the
        lane worker's outcome for the owners watching that item.
        """
        lane = str(lane or "").strip()
        queue = self.queue_for(lane)
        if queue is None:
            return
        queue.complete(task)
        dedup_key = audio_dedup_key_from_task(task, lane)
        owners: Set[str] = set()
        if dedup_key:
            _released, owners = self._settle_state(
                lane,
                {dedup_key: {"ok": bool(ok), "provider": provider, "error": error}},
                SETTLED_BY_LANE,
            )
        self._notify(lane, "complete")
        self._wake_owners(lane, owners)

    def retain_selected_server(self) -> Dict[str, int]:
        """Selection switch: drop every queued task of another Laravel server
        from each lane (Part1 owners watching one are settled as failed and
        resolve the item themselves). Returns the dropped count per lane."""
        dropped: Dict[str, int] = {}
        selected = laravel_endpoint_manager.selected_server_matcher()
        for lane in AUDIO_QUEUE_LANES:
            queue = self.queue_for(lane)
            if queue is None:
                continue
            pruned, pruned_part1 = queue.prune_where(lambda task: not task_for_selected_server(task, selected))
            owners: Set[str] = set()
            if pruned_part1:
                _released, owners = self._settle_state(
                    lane,
                    {key: {"ok": False, "error": SERVER_NOT_SELECTED_ERROR} for key in pruned_part1},
                    SETTLED_BY_LANE,
                )
            if pruned:
                ColorPrint.yellow(f"[AudioQueue] {lane} dropped {pruned} task(s) of a Laravel server that is not selected")
                self.persist_snapshot(lane, source=audio_queue_cache.SOURCE_LARAVEL_INTAKE)
                self._notify(lane, "server_switch")
            self._wake_owners(lane, owners)
            dropped[lane] = pruned
        return dropped

    def request_pull(self, lane: str, prefer_remote: bool = False) -> None:
        """M5 wake entry: re-run the lane's Laravel intake (M1/M2)."""
        self._wake(str(lane or "").strip(), prefer_remote=prefer_remote)


audio_queue_center = AudioQueueCenter()


__all__ = ["AudioQueueCenter", "audio_queue_center"]
