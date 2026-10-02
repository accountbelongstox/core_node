# -*- coding: utf-8 -*-
"""Whole-Queue persistence of the audio queue center: cache-first restore
once per lane and the debounced snapshot writer."""

import threading
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.queue_center_contract import audio_dedup_key_from_task
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.tts import audio_queue_cache
from pycore.pyutils.tts.audio_queue_model import (
    AUDIO_LANE_RESTORE_WAIT_TIMEOUT_SECONDS,
    EPHEMERAL_LOCAL_SOURCES,
    PERSIST_MIN_INTERVAL_SECONDS,
    PERSIST_PAUSE_SIGNAL,
    PERSIST_SIGNAL,
    bind_task_server,
    restore_signal_name,
    task_for_selected_server,
    task_language,
    task_text,
)

# One-shot migration: snapshots written before work leases hold the retired
# full-pull mirror (up to the whole backlog); those rows are dropped on
# restore, the lane leases its work instead.
_DROPPED_ON_RESTORE = (*EPHEMERAL_LOCAL_SOURCES, "full_sync")


def _persistable(task: Dict[str, Any]) -> bool:
    return str(task.get("_local_source") or "") not in _DROPPED_ON_RESTORE


class AudioQueuePersistThread(threading.Thread):
    """Debounced whole-Queue snapshot writer (library-owned).

    Waits for a dirty-lane signal, writes every dirty lane, then pauses
    ``PERSIST_MIN_INTERVAL_SECONDS`` so bursts (lease batches, drain
    batches) coalesce into one write. A final flush runs at shutdown.
    """

    def __init__(self, center: "AudioQueuePersistenceMixin") -> None:
        super().__init__(name="AudioQueuePersistThread", daemon=True)
        self._center = center

    def run(self) -> None:
        while not THREAD_BUS.is_shutdown_requested():
            THREAD_BUS.wait_signal(PERSIST_SIGNAL)
            THREAD_BUS.clear_signal(PERSIST_SIGNAL)
            self._center.flush_dirty()
            THREAD_BUS.wait_signal(PERSIST_PAUSE_SIGNAL, timeout=PERSIST_MIN_INTERVAL_SECONDS)


class AudioQueuePersistenceMixin:
    """Restore / persist hooks of AudioQueueCenter (owner-thread state:
    ``_restored``, ``_dirty``)."""

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
        Leased rows are never restored (leases are released at lane start).
        """
        lane = str(lane or "").strip()
        queue = self.queue_for(lane)
        if queue is None:
            return {"success": False, "error": f"unknown lane {lane}"}
        if not self._claim_restore(lane):
            return {"success": True, "lane": lane, "restored": 0, "cached": False, "already_restored": True}
        snapshot = audio_queue_cache.load_snapshot(lane)
        if not snapshot:
            self._signal_restore_complete(lane)
            return {"success": True, "lane": lane, "restored": 0, "cached": False}
        selected = laravel_endpoint_manager.selected_server_matcher()
        cached = [
            bind_task_server(task) for task in (snapshot.get("tasks") or [])
            if isinstance(task, dict) and _persistable(task)
        ]
        tasks = [task for task in cached if task_for_selected_server(task, selected)]
        part1_tasks = {audio_dedup_key_from_task(task, lane): task for task in tasks}
        part1_keys = {
            key for key in (snapshot.get("part1_keys") or set()) if key in part1_tasks
        }
        self._record_part1(
            lane,
            part1_keys,
            {
                key: {"text": task_text(part1_tasks[key]), "language": task_language(part1_tasks[key])}
                for key in part1_keys
            },
            "",
            audio_queue_cache.SOURCE_LOCAL_PROMOTE,
        )
        # ONE owner transaction for the whole snapshot (push dedups on the
        # whole Queue); per-task round trips stalled boot for minutes.
        restored = queue.push_many(tasks)
        claimed = queue.claim_part1(part1_keys)
        ColorPrint.green(
            f"[AudioQueue] {lane} cache restore: tasks={restored} "
            f"other_server_dropped={len(cached) - len(tasks)} "
            f"part1_keys={len(part1_keys)} claimed={claimed} "
            f"saved_at={snapshot.get('saved_at')} "
            f"source={snapshot.get('source')}"
        )
        self._notify(lane, "cache_restore")
        self._signal_restore_complete(lane)
        return {
            "success": True,
            "lane": lane,
            "restored": restored,
            "cached": True,
            "saved_at": snapshot.get("saved_at"),
            "source": snapshot.get("source"),
        }

    @staticmethod
    def _signal_restore_complete(lane: str) -> None:
        THREAD_BUS.signal(restore_signal_name(lane), True)

    def restore_complete(self, lane: str) -> bool:
        """True once ``restore_from_cache(lane)`` has finished."""
        return bool(THREAD_BUS.has_signal(restore_signal_name(lane)))

    def wait_for_restore(
        self, lane: str, timeout: Optional[float] = AUDIO_LANE_RESTORE_WAIT_TIMEOUT_SECONDS,
    ) -> bool:
        """Block until this lane's cache-first restore finishes (condition-
        driven, no polling); True once signaled, False on timeout. A caller
        about to make this lane's first remote call waits on this so the
        local cache always loads before any remote access (R6/§5.4). A lane
        whose switch is OFF never restores, so callers only wait for a lane
        they know is being (or about to be) activated. A False return means
        the restore never signaled within the bound - the caller should log
        it (this library never sees why: the boot chain not running for the
        lane, or a stalled restore)."""
        return bool(THREAD_BUS.wait_signal(restore_signal_name(lane), timeout=timeout))

    @serialized_method
    def persist_snapshot(self, lane: str, source: str = "") -> None:
        """INTERNAL: mark the lane's whole-Queue snapshot dirty (debounced write)."""
        lane = str(lane or "").strip()
        if lane not in self._queues:
            return
        self._dirty[lane] = str(source or self._dirty.get(lane) or "")
        THREAD_BUS.signal(PERSIST_SIGNAL, True)

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
            entries = queue.export_entries()
            entries.sort(key=lambda entry: entry[0])
            tasks = [task for _order, task in entries if _persistable(task)]
            tasks += [task for task in self._taken_tasks(lane) if _persistable(task)]
            audio_queue_cache.save_snapshot(
                lane,
                tasks,
                state["part1_keys"] & queue.active_dedup_keys(),
                state["source"],
            )

    @serialized_method
    def _taken_tasks(self, lane: str) -> List[Dict[str, Any]]:
        return [dict(task) for task in (self._taken.get(lane) or {}).values()]


__all__ = ["AudioQueuePersistThread", "AudioQueuePersistenceMixin"]
