# -*- coding: utf-8 -*-
"""Part1 of the audio whole-Queue: pycore self-promotion and the owner-side
take / settle / release tracking (observability tracker per lane)."""

import time
from typing import Any, Dict, List, Set, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.queue_center_contract import audio_dedup_key
from pycore.pyutils.tts import audio_queue_cache
from pycore.pyutils.tts.audio_queue_model import (
    AUDIO_QUEUE_LANES,
    LOCAL_SOURCE_MANUAL,
    LOCAL_SOURCE_ORCHESTRATION,
    TRACK_DONE,
    TRACK_FAILED,
    TRACK_PROCESSING,
    TRACK_QUEUED,
    TRACK_TERMINAL,
    TRACKED_TERMINAL_CAP,
    bind_task_server,
    build_local_task,
    owner_signal,
    task_for_selected_server,
)


class AudioQueuePart1Mixin:
    """Part1 promotion and tracking of AudioQueueCenter (owner-thread state:
    ``_part1_keys``, ``_tracked``, ``_taken``)."""

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
                    "queued_at": now,
                    "started_at": None,
                    "finished_at": None,
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
                task = build_local_task(
                    lane, str(item.get("language") or ""), str(item.get("text") or ""), local_source,
                    md5=str(item.get("md5") or ""),
                )
            if isinstance(task, dict) and task_for_selected_server(bind_task_server(task)):
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
                entry["started_at"] = now
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
    ) -> Tuple[List[Dict[str, Any]], Set[str]]:
        """INTERNAL: tracker terminal + Part1 release; returns the taken tasks
        to complete and the owners watching the settled keys."""
        now = time.time()
        released: List[Dict[str, Any]] = []
        owners: Set[str] = set()
        for key, outcome in outcomes.items():
            self._part1_keys[lane].discard(key)
            task = self._taken[lane].pop(key, None)
            if task is not None:
                released.append(task)
            entry = self._tracked[lane].get(key)
            if entry is None:
                continue
            owners.update(entry["owners"])
            ok = bool(outcome.get("ok"))
            entry["state"] = TRACK_DONE if ok else TRACK_FAILED
            entry["provider"] = str(outcome.get("provider") or entry.get("provider") or "")
            entry["error"] = "" if ok else str(outcome.get("error") or "")[:200]
            entry["settled_by"] = settled_by
            entry["started_at"] = entry.get("started_at") or now
            entry["finished_at"] = now
            entry["updated_at"] = now
        self._evict_terminal(lane)
        return released, owners

    @staticmethod
    def _wake_owners(lane: str, owners: Set[str]) -> None:
        for owner in owners:
            if owner:
                THREAD_BUS.signal(owner_signal(lane, owner), time.time())

    def wake_owner(self, owner: str) -> None:
        """Wake an owner waiting on any lane (e.g. its task was cancelled)."""
        for lane in AUDIO_QUEUE_LANES:
            self._wake_owners(lane, {str(owner or "")})

    def settle_local(self, lane: str, outcomes: Dict[str, Dict[str, Any]], owner: str) -> None:
        """M3 owner-side: record the owner's generation outcome per key
        (``{key: {ok, provider, error}}``); taken entries are completed and
        their Part1 membership released."""
        lane = str(lane or "").strip()
        queue = self.queue_for(lane)
        if queue is None or not outcomes:
            return
        released, owners = self._settle_state(lane, dict(outcomes), str(owner or ""))
        for task in released:
            queue.complete(task)
        self.persist_snapshot(lane, source=audio_queue_cache.SOURCE_LOCAL_PROMOTE)
        self._notify(lane, "local_settle")
        self._wake_owners(lane, owners)

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
        self._wake_owners(lane, {str(owner)})
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
        if len(tracked) <= TRACKED_TERMINAL_CAP:
            return
        terminal = [entry for entry in tracked.values() if entry["state"] in TRACK_TERMINAL]
        overflow = len(terminal) - TRACKED_TERMINAL_CAP
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
            "queued_at": entry.get("queued_at"),
            "started_at": entry.get("started_at"),
            "finished_at": entry.get("finished_at"),
            "updated_at": entry["updated_at"],
        }


__all__ = ["AudioQueuePart1Mixin"]
