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
  runs at shutdown).

Every mutation bumps the lane revision and publishes the THREAD_BUS signal
``AUDIO_QUEUE_CHANGED_SIGNAL`` so the pyctl lane-state publisher can push the
new state to the UI. The Laravel-facing intake mechanics stay in the worker
layer (pyctl), registered here as callables — the library never imports
upward.
"""

from __future__ import annotations

import hashlib
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Set

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.queue_center_contract import (
    audio_dedup_key,
    audio_dedup_key_from_task,
)
from pycore.pyutils.common.strtools.normalization import media_content_id
from pycore.pyutils.tts import audio_queue_cache
from pycore.pyutils.tts.audio_task_queue import AudioTaskQueue

# Lanes owned by the library (contract queue keys), built eagerly so the
# shared instance is fully initialized at pycore boot.
AUDIO_QUEUE_LANES = ("word_audio", "sentence_audio")
AUDIO_QUEUE_KIND_BY_LANE = {"word_audio": "word", "sentence_audio": "sentence"}
AUDIO_QUEUE_LANE_BY_KIND = {kind: lane for lane, kind in AUDIO_QUEUE_KIND_BY_LANE.items()}

# THREAD_BUS signal published on every lane mutation ({lane, revision, reason}).
AUDIO_QUEUE_CHANGED_SIGNAL = "audio_queue_center.changed"
_PERSIST_SIGNAL = "audio_queue_center.persist_requested"
_PERSIST_PAUSE_SIGNAL = "audio_queue_center.persist_pause"
_PERSIST_MIN_INTERVAL_SECONDS = 5.0

# Tracker states of Part1 items (observability only).
TRACK_QUEUED = "queued"
TRACK_PROCESSING = "processing"
TRACK_DONE = "done"
TRACK_FAILED = "failed"
TRACK_TERMINAL = (TRACK_DONE, TRACK_FAILED)
# settled_by value for items a lane worker popped (owners use their own id).
SETTLED_BY_LANE = "lane"
_TRACKED_TERMINAL_CAP = 5000
_LANE_VIEW_ITEM_LIMIT = 200

# Local task sources (``_local_source``): tasks without a Laravel
# global_tasks row (claim + global result are skipped by the lane workers).
LOCAL_SOURCE_ORCHESTRATION = "orchestration"
LOCAL_SOURCE_MANUAL = "manual"
LOCAL_SOURCE_FULL_SYNC = "full_sync"


def build_local_task(
    lane: str,
    language: str,
    text: str,
    source: str,
    base_url: str = "",
    extra_payload: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """ONE builder for pycore-local lane tasks (orchestration, manual promote,
    full pull). Payload shapes match the Laravel producers so the lane
    workers process them unchanged; ``_local_source`` skips claim/result."""
    lane = str(lane or "").strip()
    language = str(language or "").strip().lower()
    text = str(text or "").strip()
    if lane not in AUDIO_QUEUE_LANES or not language or not text:
        return None
    if lane == "sentence_audio":
        identity = media_content_id(text)
        payload: Dict[str, Any] = {
            "text": text,
            "content": text,
            "language": language,
            "content_id": identity,
        }
    else:
        identity = hashlib.md5(text.lower().encode("utf-8")).hexdigest()
        payload = {
            "word": text,
            "content": text,
            "language": language,
            "md5": identity,
        }
    payload.update(extra_payload or {})
    task: Dict[str, Any] = {
        "task_id": f"{source}-{AUDIO_QUEUE_KIND_BY_LANE[lane]}-{language}-{identity}",
        "task_type": lane,
        "payload": payload,
        "_local_source": str(source or LOCAL_SOURCE_MANUAL),
    }
    if base_url:
        task["_laravel_base_url"] = str(base_url)
    return task


def _task_text(task: Dict[str, Any]) -> str:
    payload = task.get("payload") if isinstance(task.get("payload"), dict) else {}
    return str(payload.get("word") or payload.get("text") or payload.get("content") or "")


def _task_language(task: Dict[str, Any]) -> str:
    payload = task.get("payload") if isinstance(task.get("payload"), dict) else {}
    return str(payload.get("language") or "")


class AudioQueuePersistThread(threading.Thread):
    """Debounced whole-Queue snapshot writer (library-owned).

    Waits for a dirty-lane signal, writes every dirty lane, then pauses
    ``_PERSIST_MIN_INTERVAL_SECONDS`` so bursts (full-pull pages, drain
    batches) coalesce into one write. A final flush runs at shutdown.
    """

    def __init__(self, center: "AudioQueueCenter") -> None:
        super().__init__(name="AudioQueuePersistThread", daemon=True)
        self._center = center

    def run(self) -> None:
        while not THREAD_BUS.is_shutdown_requested():
            THREAD_BUS.wait_signal(_PERSIST_SIGNAL)
            THREAD_BUS.clear_signal(_PERSIST_SIGNAL)
            self._center.flush_dirty()
            THREAD_BUS.wait_signal(_PERSIST_PAUSE_SIGNAL, timeout=_PERSIST_MIN_INTERVAL_SECONDS)


class AudioQueueCenter:
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
        pruned = queue.prune_absent(ordered_task_ids)
        if reordered or pruned:
            self.persist_snapshot(lane, source=audio_queue_cache.SOURCE_LARAVEL_INTAKE)
            self._notify(lane, "laravel_order")
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
        for task in tasks:
            if not isinstance(task, dict):
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

    # -------------------- M3: pycore self-promotion (fills Part1) --------------------

    @serialized_method
    def _record_part1(
        self,
        lane: str,
        keys: Set[str],
        meta: Dict[str, Dict[str, Any]],
        owner: str,
        source: str,
    ) -> None:
        """INTERNAL: Part1 membership + tracker entries for promoted keys."""
        self._part1_keys[lane].update(keys)
        tracked = self._tracked[lane]
        now = time.time()
        for key in keys:
            entry = tracked.get(key)
            if entry is None or entry["state"] in TRACK_TERMINAL:
                entry = {
                    "key": key,
                    "text": str((meta.get(key) or {}).get("text") or ""),
                    "language": str((meta.get(key) or {}).get("language") or ""),
                    "state": TRACK_QUEUED,
                    "owners": set(),
                    "source": source,
                    "provider": "",
                    "error": "",
                    "settled_by": "",
                    "updated_at": now,
                }
                tracked[key] = entry
            if owner:
                entry["owners"].add(owner)
            entry["updated_at"] = now

    def promote_local_head(
        self,
        lane: str,
        items: List[Dict[str, Any]],
        wake: bool = True,
        source: str = audio_queue_cache.SOURCE_LOCAL_PROMOTE,
        owner: str = "",
        local_source: str = "",
    ) -> Dict[str, Any]:
        """M3: pycore self-promotion — FILLS Part1 DIRECTLY.

        ``items``: ``[{language, text, content_id?, md5?, task?}, ...]``.
        Whole-Queue dedup: an item whose single copy already sits in the
        queue is claimed into Part1 (front position wins); an item carrying
        ``task`` that is not queued yet is inserted (landing in Part1 via
        the membership set). With ``local_source`` (pycore-manager manual
        promote) items without a task get a local task built for them;
        otherwise items neither queued nor carrying a task are skipped.
        ``owner`` (an orchestration task id) scopes the tracker so the
        owner's fill progress can be visualized. Never touches Laravel.
        """
        lane = str(lane or "").strip()
        queue = self.queue_for(lane)
        if queue is None:
            return {"success": False, "error": f"unknown lane {lane}"}
        keys: Set[str] = set()
        tasks_by_key: Dict[str, Dict[str, Any]] = {}
        meta: Dict[str, Dict[str, Any]] = {}
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
            if not key.split(":", 1)[-1]:
                continue
            keys.add(key)
            meta[key] = {"text": item.get("text"), "language": item.get("language")}
            task = item.get("task")
            if not isinstance(task, dict) and local_source:
                task = build_local_task(lane, str(item.get("language") or ""), str(item.get("text") or ""), local_source)
            if isinstance(task, dict):
                tasks_by_key[key] = task
        if not keys:
            return {"success": False, "error": "no promotable items"}
        taken = self._taken_keys(lane)
        eligible_keys = {
            key
            for key in keys
            if key in taken or key in tasks_by_key or queue.has_dedup_key(key)
        }
        self._record_part1(lane, eligible_keys, meta, str(owner or ""), source)
        inserted = 0
        for key, task in tasks_by_key.items():
            if key in taken or queue.has_dedup_key(key):
                continue  # whole-Queue dedup: the ONE existing copy is claimed below
            if queue.push(task):
                inserted += 1
        claimed = queue.claim_part1(eligible_keys)
        ColorPrint.green(
            f"[AudioQueue] {lane} local promote: part1_keys={len(eligible_keys)} "
            f"claimed={claimed} inserted={inserted} owner={owner or '-'}"
        )
        self.persist_snapshot(lane, source=source)
        self._notify(lane, "local_promote")
        if wake:
            self._wake(lane, prefer_remote=False)
        return {
            "success": True,
            "lane": lane,
            "promoted": len(eligible_keys),
            "claimed": claimed,
            "inserted": inserted,
            "keys": sorted(eligible_keys),
        }

    @serialized_method
    def _taken_keys(self, lane: str) -> Set[str]:
        return set(self._taken.get(lane) or {})

    @serialized_method
    def _record_taken(self, lane: str, taken: Dict[str, Dict[str, Any]], owner: str) -> None:
        now = time.time()
        for key, task in taken.items():
            self._taken[lane][key] = task
            entry = self._tracked[lane].get(key)
            if entry is not None:
                entry["state"] = TRACK_PROCESSING
                entry["settled_by"] = owner
                entry["updated_at"] = now

    @serialized_method
    def _tracked_state_map(self, lane: str, keys: Set[str]) -> Dict[str, Dict[str, Any]]:
        tracked = self._tracked.get(lane) or {}
        return {
            key: self._export_entry(tracked[key])
            for key in keys
            if key in tracked
        }

    def take_local(self, lane: str, keys: List[str], owner: str) -> Dict[str, List[str]]:
        """M3 owner-side: take the owner's Part1 items out of the heap to
        generate them itself (no lane worker generates them a second time).

        Returns ``{taken, inflight, absent}`` key lists: ``inflight`` keys
        are being processed by a lane worker or another owner (await them
        via ``tracked_states``); ``absent`` keys are not queued at all.
        """
        lane = str(lane or "").strip()
        queue = self.queue_for(lane)
        wanted = {str(key) for key in keys if str(key or "").strip()}
        if queue is None or not wanted:
            return {"taken": [], "inflight": [], "absent": sorted(wanted)}
        taken = queue.take_by_dedup_keys(wanted)
        if taken:
            self._record_taken(lane, taken, str(owner or ""))
            self._notify(lane, "local_take")
        states = self._tracked_state_map(lane, wanted - set(taken))
        inflight = sorted(
            key for key, entry in states.items() if entry["state"] == TRACK_PROCESSING
        )
        absent = sorted(wanted - set(taken) - set(inflight))
        return {"taken": sorted(taken), "inflight": inflight, "absent": absent}

    @serialized_method
    def _settle_state(
        self,
        lane: str,
        outcomes: Dict[str, Dict[str, Any]],
        settled_by: str,
    ) -> List[Dict[str, Any]]:
        """INTERNAL: tracker terminal + Part1 release; returns taken tasks to complete."""
        now = time.time()
        released: List[Dict[str, Any]] = []
        for key, outcome in outcomes.items():
            self._part1_keys[lane].discard(key)
            task = self._taken[lane].pop(key, None)
            if task is not None:
                released.append(task)
            entry = self._tracked[lane].get(key)
            if entry is None:
                continue
            ok = bool(outcome.get("ok"))
            entry["state"] = TRACK_DONE if ok else TRACK_FAILED
            entry["provider"] = str(outcome.get("provider") or entry.get("provider") or "")
            entry["error"] = "" if ok else str(outcome.get("error") or "")[:200]
            entry["settled_by"] = settled_by
            entry["updated_at"] = now
        self._evict_terminal(lane)
        return released

    def settle_local(self, lane: str, outcomes: Dict[str, Dict[str, Any]], owner: str) -> None:
        """M3 owner-side: record the owner's generation outcome per key
        (``{key: {ok, provider, error}}``); taken entries are completed and
        their Part1 membership released."""
        lane = str(lane or "").strip()
        queue = self.queue_for(lane)
        if queue is None or not outcomes:
            return
        for task in self._settle_state(lane, dict(outcomes), str(owner or "")):
            queue.complete(task)
        self.persist_snapshot(lane, source=audio_queue_cache.SOURCE_LOCAL_PROMOTE)
        self._notify(lane, "local_settle")

    @serialized_method
    def owner_counts(self, lane: str, owner: str) -> Dict[str, int]:
        """M3 read: one owner's Part1 fill counters (cheap; tracker only)."""
        counts = {TRACK_QUEUED: 0, TRACK_PROCESSING: 0, TRACK_DONE: 0, TRACK_FAILED: 0}
        owner = str(owner or "")
        for entry in (self._tracked.get(str(lane or "").strip()) or {}).values():
            if owner and owner in entry["owners"]:
                counts[entry["state"]] = counts.get(entry["state"], 0) + 1
        counts["total"] = sum(counts.values())
        return counts

    @serialized_method
    def _drop_owner(self, lane: str, owner: str) -> Set[str]:
        """INTERNAL: detach one owner; return still-queued keys nobody else owns."""
        orphaned: Set[str] = set()
        for key, entry in list(self._tracked[lane].items()):
            if owner not in entry["owners"]:
                continue
            entry["owners"].discard(owner)
            if entry["owners"] or entry["state"] != TRACK_QUEUED:
                continue
            if entry["source"] in (LOCAL_SOURCE_ORCHESTRATION, audio_queue_cache.SOURCE_LOCAL_PROMOTE):
                orphaned.add(key)
                self._tracked[lane].pop(key, None)
                self._part1_keys[lane].discard(key)
        return orphaned

    def release_owner(self, lane: str, owner: str) -> int:
        """M3 owner-side: an owner stopped (cancel / delete / finished).

        Its still-queued Part1 items that no other owner wants leave the
        whole Queue (never generated for nobody); items other owners or a
        lane worker hold are untouched. Returns the number dropped.
        """
        lane = str(lane or "").strip()
        queue = self.queue_for(lane)
        if queue is None or not owner:
            return 0
        orphaned = self._drop_owner(lane, str(owner))
        taken = queue.take_by_dedup_keys(orphaned) if orphaned else {}
        dropped = 0
        for task in taken.values():
            queue.complete(task)
            if str(task.get("_local_source") or "") in (LOCAL_SOURCE_ORCHESTRATION, LOCAL_SOURCE_MANUAL):
                dropped += 1
                continue
            # A Laravel/backlog item claimed into Part1 returns to Part2
            # (Part1 membership already released) instead of vanishing.
            queue.push(task)
        self.persist_snapshot(lane, source=audio_queue_cache.SOURCE_LOCAL_PROMOTE)
        self._notify(lane, "owner_released")
        return dropped

    def tracked_states(self, lane: str, keys: List[str]) -> Dict[str, Dict[str, Any]]:
        """M3 read: tracker entries for the given keys (absent keys omitted)."""
        return self._tracked_state_map(
            str(lane or "").strip(),
            {str(key) for key in keys if str(key or "").strip()},
        )

    def _evict_terminal(self, lane: str) -> None:
        """INTERNAL (owner thread): bound the terminal tracker history."""
        tracked = self._tracked[lane]
        if len(tracked) <= _TRACKED_TERMINAL_CAP:
            return
        terminal = [entry for entry in tracked.values() if entry["state"] in TRACK_TERMINAL]
        overflow = len(terminal) - _TRACKED_TERMINAL_CAP
        if overflow <= 0:
            return
        terminal.sort(key=lambda entry: entry["updated_at"])
        for entry in terminal[:overflow]:
            tracked.pop(entry["key"], None)

    @staticmethod
    def _export_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "key": entry["key"],
            "text": entry["text"],
            "language": entry["language"],
            "state": entry["state"],
            "owners": sorted(entry["owners"]),
            "source": entry["source"],
            "provider": entry["provider"],
            "error": entry["error"],
            "settled_by": entry["settled_by"],
            "updated_at": entry["updated_at"],
        }

    # -------------------- queue cache (INTERNAL persistence hooks) --------------------

    @serialized_method
    def _claim_restore(self, lane: str) -> bool:
        if lane in self._restored:
            return False
        self._restored.add(lane)
        return True

    def restore_from_cache(self, lane: str) -> Dict[str, Any]:
        """INTERNAL boot hook: restore the whole Queue from the local cache.

        Runs ONCE per process per lane, before any remote intake, so the lane
        drains even with Laravel offline (later activations reuse the live
        in-memory queue). Whole-Queue dedup applies on every restored task.
        Migration: full-pull backlog keys from older snapshots leave Part1 —
        the pulled backlog is a Part2 mirror (§5.2).
        """
        lane = str(lane or "").strip()
        queue = self.queue_for(lane)
        if queue is None:
            return {"success": False, "error": f"unknown lane {lane}"}
        if not self._claim_restore(lane):
            return {"success": True, "lane": lane, "restored": 0, "cached": False, "already_restored": True}
        snapshot = audio_queue_cache.load_snapshot(lane)
        if not snapshot:
            return {"success": True, "lane": lane, "restored": 0, "cached": False}
        tasks = snapshot.get("tasks") or []
        part1_tasks = {
            audio_dedup_key_from_task(task, lane): task
            for task in tasks
            if isinstance(task, dict)
            and str(task.get("_local_source") or "") != LOCAL_SOURCE_FULL_SYNC
        }
        part1_keys = {
            key for key in (snapshot.get("part1_keys") or set()) if key in part1_tasks
        }
        self._record_part1(
            lane,
            part1_keys,
            {
                key: {"text": _task_text(part1_tasks[key]), "language": _task_language(part1_tasks[key])}
                for key in part1_keys
            },
            "",
            audio_queue_cache.SOURCE_LOCAL_PROMOTE,
        )
        restored = 0
        for task in tasks:
            dedup_key = audio_dedup_key_from_task(task, lane)
            if dedup_key and queue.has_dedup_key(dedup_key):
                continue
            if queue.push(task):
                restored += 1
        claimed = queue.claim_part1(part1_keys)
        ColorPrint.green(
            f"[AudioQueue] {lane} cache restore: tasks={restored} "
            f"part1_keys={len(part1_keys)} claimed={claimed} "
            f"saved_at={snapshot.get('saved_at')} "
            f"source={snapshot.get('source')}"
        )
        self._notify(lane, "cache_restore")
        return {
            "success": True,
            "lane": lane,
            "restored": restored,
            "cached": True,
            "saved_at": snapshot.get("saved_at"),
            "source": snapshot.get("source"),
        }

    @serialized_method
    def persist_snapshot(self, lane: str, source: str = "") -> None:
        """INTERNAL: mark the lane's whole-Queue snapshot dirty (debounced write)."""
        lane = str(lane or "").strip()
        if lane not in self._queues:
            return
        self._dirty[lane] = str(source or self._dirty.get(lane) or "")
        THREAD_BUS.signal(_PERSIST_SIGNAL, True)

    @serialized_method
    def _take_dirty(self) -> Dict[str, Dict[str, Any]]:
        dirty = {
            lane: {
                "source": source,
                "part1_keys": set(self._part1_keys.get(lane) or set()),
            }
            for lane, source in self._dirty.items()
        }
        self._dirty.clear()
        return dirty

    def flush_dirty(self) -> None:
        """INTERNAL: write every dirty lane snapshot (persister thread / shutdown).

        The snapshot is the ENTIRE Queue in exact pop order (taken-but-unsettled
        owner items included, so a crash mid-generation keeps them) plus the
        INTERNAL Part1 membership set.
        """
        for lane, state in self._take_dirty().items():
            queue = self.queue_for(lane)
            if queue is None:
                continue
            tasks = queue.export_tasks() + list(self._taken_tasks(lane))
            audio_queue_cache.save_snapshot(
                lane,
                tasks,
                state["part1_keys"] & queue.active_dedup_keys(),
                state["source"],
            )

    @serialized_method
    def _taken_tasks(self, lane: str) -> List[Dict[str, Any]]:
        return [dict(task) for task in (self._taken.get(lane) or {}).values()]

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
        limit = max(1, min(_LANE_VIEW_ITEM_LIMIT, int(item_limit or 20)))
        parts = queue.part_view(limit)
        tracker = self._tracker_view(lane, str(owner or ""), limit)

        def _row(task: Dict[str, Any]) -> Dict[str, Any]:
            return {
                "task_id": str(task.get("task_id") or ""),
                "text": _task_text(task)[:160],
                "language": _task_language(task),
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
        if queue is None:
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
        entry["updated_at"] = time.time()
        return True

    def pop_next(self, lane: str) -> Optional[Dict[str, Any]]:
        """M5 consumer entry: pop the whole-Queue head (Part1 first)."""
        lane = str(lane or "").strip()
        queue = self.queue_for(lane)
        if queue is None:
            return None
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
        if dedup_key:
            self._settle_state(
                lane,
                {dedup_key: {"ok": bool(ok), "provider": provider, "error": error}},
                SETTLED_BY_LANE,
            )
        self._notify(lane, "complete")

    def request_pull(self, lane: str, prefer_remote: bool = False) -> None:
        """M5 wake entry: re-run the lane's Laravel intake (M1/M2)."""
        self._wake(str(lane or "").strip(), prefer_remote=prefer_remote)


audio_queue_center = AudioQueueCenter()


__all__ = [
    "AUDIO_QUEUE_CHANGED_SIGNAL",
    "AUDIO_QUEUE_KIND_BY_LANE",
    "AUDIO_QUEUE_LANE_BY_KIND",
    "AUDIO_QUEUE_LANES",
    "LOCAL_SOURCE_FULL_SYNC",
    "LOCAL_SOURCE_MANUAL",
    "LOCAL_SOURCE_ORCHESTRATION",
    "SETTLED_BY_LANE",
    "TRACK_DONE",
    "TRACK_FAILED",
    "TRACK_PROCESSING",
    "TRACK_QUEUED",
    "AudioQueueCenter",
    "audio_queue_center",
    "build_local_task",
]
