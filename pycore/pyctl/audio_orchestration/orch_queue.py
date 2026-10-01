# -*- coding: utf-8 -*-
"""
Orchestration queue: tasks generate on their own, nobody has to press a button.

A task becomes a *candidate* when it is created or changed, when pycore starts,
and (as a safety net) on a slow full scan. The heartbeat tick evaluates the
candidates in creation order and starts one as soon as its prerequisites are met
(the sentence source is ready and ffmpeg exists); inside the started run every
segment is assembled - and, for a video task, rendered - the moment its own
resources are all resolved (``orch_generate``). Rules:

  * new task            - a draft that was never started        -> generation
  * interrupted task    - status ``generating`` without a job    -> resume
  * videos missing      - a finished video task with segments that were never
                          rendered                               -> video render
  * preset changed      - a finished video task whose preset was edited
                                                                  -> video re-render
  * retry               - a task that failed only because some resources could
                          not be produced (segment with missing / no audio) is
                          resumed with backoff, at most ``MAX_AUTO_RETRIES``
                          times and only while the failure is recent (an
                          unstable TTS service is the usual cause); only the
                          unresolved resources are attempted again
  * a task the user cancelled is NOT restarted by the queue (the manual route
    forces a run); ``auto_generate: false`` on a task opts out.

One run per source at a time (``MAX_CONCURRENT_PER_SOURCE``): a book that takes
hours never holds back the short prompt tasks, while each source still shares
the resource lanes (TTS engines) fairly; the rest of the candidates report
``queued``. The
state of every candidate (queued / waiting / running) lives in memory and is
merged into the task summaries; a state change is written to the task log once,
and never for a task whose run is active (the run owns its record).
"""

import time
from collections import Counter
from typing import (
    Any,
    Dict,
    List,
    Set,
)

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method, start_bus_task
from pycore.pyheartbeat import heartbeat_system
from pycore.pyutils.common.ffmpeg.ffmpeg_runtime import ffmpeg_runtime

from pycore.pyctl.audio_orchestration import (
    orch_events,
    orch_generate,
    orch_messages as msg,
    orch_sources,
    orch_store,
)

CALLBACK_NAME = "audio_orch_queue"
TICK_SECONDS = 5
FULL_SCAN_EVERY_TICKS = 12
MAX_CONCURRENT_PER_SOURCE = 1
MAX_AUTO_RETRIES = 3
RETRY_BACKOFF_SECONDS = 60
RETRY_WINDOW_SECONDS = 24 * 3600
RETRYABLE_SEGMENT_ERRORS = (msg.ORCH_MSG_SEGMENT_MISSING_ITEMS, msg.ORCH_MSG_SEGMENT_NO_AUDIO)

STATE_IDLE = "idle"
STATE_QUEUED = "queued"
STATE_WAITING = "waiting"
STATE_RUNNING = "running"

REASON_NEW = "new"
REASON_INTERRUPTED = "interrupted"
REASON_VIDEOS = "videos"
REASON_RERENDER = "rerender"
REASON_RETRY = "retry"

WAIT_FFMPEG = "ffmpeg"
WAIT_SENTENCES = "sentences"


class OrchQueue:
    """Candidate set + single-flight tick (THREAD_BUS-backed owner state)."""

    def __init__(self) -> None:
        self._candidates: Set[str] = set()
        self._rerender: Set[str] = set()
        self._states: Dict[str, Dict[str, Any]] = {}
        self._ticking = False
        self._ticks = 0
        self._started = False
        init_serialized_owner(self, "audio_orchestration.queue", "AudioOrchQueueState")

    # ------------------------------------------------------------------ #
    # owner state                                                         #
    # ------------------------------------------------------------------ #
    @serialized_method
    def _add(self, task_ids: List[str]) -> None:
        self._candidates.update(task_id for task_id in task_ids if task_id)

    @serialized_method
    def _discard(self, task_id: str) -> None:
        self._candidates.discard(task_id)

    @serialized_method
    def _flag_rerender(self, task_id: str) -> None:
        self._rerender.add(task_id)

    @serialized_method
    def _take_rerender(self, task_id: str) -> bool:
        wanted = task_id in self._rerender
        self._rerender.discard(task_id)
        return wanted

    @serialized_method
    def _wants_rerender(self, task_id: str) -> bool:
        return task_id in self._rerender

    @serialized_method
    def state_of(self, task_id: str) -> Dict[str, Any]:
        """Queue state of one task (``{state, waiting, reason}``; idle default)."""
        return dict(self._states.get(task_id) or {"state": STATE_IDLE, "waiting": [], "reason": ""})

    @serialized_method
    def states_of(self, task_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """Queue states of many tasks in one owner hop (list views)."""
        idle = {"state": STATE_IDLE, "waiting": [], "reason": ""}
        return {task_id: dict(self._states.get(task_id) or idle) for task_id in task_ids}

    @serialized_method
    def _set_state(self, task_id: str, state: Dict[str, Any]) -> bool:
        """Store a state; True when it differs from the stored one."""
        current = self._states.get(task_id) or {"state": STATE_IDLE, "waiting": [], "reason": ""}
        if all(current.get(key) == state.get(key) for key in ("state", "waiting", "reason")):
            return False
        if state["state"] == STATE_IDLE:
            self._states.pop(task_id, None)
        else:
            self._states[task_id] = state
        return True

    @serialized_method
    def _snapshot(self) -> List[str]:
        return sorted(self._candidates)

    @serialized_method
    def _begin_tick(self) -> int:
        """-1 when a tick is already running, else the tick number."""
        if self._ticking:
            return -1
        self._ticking = True
        self._ticks += 1
        return self._ticks

    @serialized_method
    def _end_tick(self) -> None:
        self._ticking = False

    @serialized_method
    def _mark_started(self) -> bool:
        if self._started:
            return False
        self._started = True
        return True

    # ------------------------------------------------------------------ #
    # lifecycle                                                           #
    # ------------------------------------------------------------------ #
    def start(self) -> None:
        """Service startup (route registration): schedule the heartbeat tick and
        put every task that may need work on the candidate list. Idempotent."""
        if not self._mark_started():
            return
        heartbeat_system.register_callback(
            name=CALLBACK_NAME, callback=self.tick, interval=TICK_SECONDS, enabled=True,
        )
        self._recover_interrupted()
        self._scan()
        ColorPrint.blue(f"[AudioOrchQueue] registered: tick every {TICK_SECONDS}s, {MAX_CONCURRENT_PER_SOURCE} concurrent run per source")

    def enqueue(self, task_id: str, rerender_videos: bool = False) -> None:
        """A task was created or changed: evaluate it now (off the caller's
        thread). ``rerender_videos`` asks for all its videos to be rendered
        again (its preset changed)."""
        task_id = str(task_id or "")
        if rerender_videos:
            self._flag_rerender(task_id)
        self._add([task_id])
        start_bus_task(self.tick, thread_name="AudioOrchQueueTick")

    def _scan(self) -> None:
        self._add([
            str(task.get("task_id") or "") for task in orch_store.list_tasks()
            if self._action(task)[0] != STATE_IDLE
        ])

    def _recover_interrupted(self) -> None:
        """Startup: a task still ``generating`` lost its run with the previous
        process. The queue resumes it from its manifest; a task that opted out of
        automatic generation is marked failed (interrupted) instead, once."""
        for task in orch_store.list_tasks():
            task_id = str(task.get("task_id") or "")
            if str(task.get("status") or "") != "generating" or orch_generate.is_running(task_id):
                continue
            if task.get("auto_generate") is False:
                orch_store.patch_run_fields(task_id, {
                    "status": "failed",
                    "progress": {
                        **(task.get("progress") or {}),
                        **msg.progress_fields(msg.ORCH_MSG_GENERATION_INTERRUPTED),
                    },
                })
                orch_store.append_task_event(task, msg.ORCH_MSG_GENERATION_INTERRUPTED)
                orch_events.publish_task_changed(orch_store.get_task(task_id) or task)

    # ------------------------------------------------------------------ #
    # evaluation                                                          #
    # ------------------------------------------------------------------ #
    @staticmethod
    def _needs_video(task: Dict[str, Any]) -> bool:
        return (
            orch_sources.wants_video(task)
            and str(task.get("status") or "") == "done"
            and any(
                segment.get("status") == "done" and segment.get("timeline") and not segment.get("video_status")
                for segment in task.get("segments") or []
            )
        )

    @staticmethod
    def _retry_due(task: Dict[str, Any]) -> bool:
        """A failure caused by unresolved resources, recent enough, with retries
        left and its backoff over."""
        if not any(
            segment.get("status") == "failed" and segment.get("error") in RETRYABLE_SEGMENT_ERRORS
            for segment in task.get("segments") or []
        ):
            return False
        retries = int(task.get("auto_retries") or 0)
        finished = float(task.get("generation_finished_at") or 0.0)
        now = time.time()
        return (
            retries < MAX_AUTO_RETRIES
            and now - finished <= RETRY_WINDOW_SECONDS
            and now >= finished + RETRY_BACKOFF_SECONDS * (2 ** retries)
        )

    def _action(self, task: Dict[str, Any]) -> tuple:
        """``(state, reason)``: what the queue would do with this task now,
        ignoring capacity and prerequisites."""
        if task.get("auto_generate") is False:
            return STATE_IDLE, ""
        status = str(task.get("status") or "")
        if status == "done" and orch_sources.wants_video(task) and self._wants_rerender(str(task.get("task_id") or "")):
            return STATE_QUEUED, REASON_RERENDER
        if status == "generating":
            return STATE_QUEUED, REASON_INTERRUPTED
        if status == "draft" and not task.get("generation_started_at"):
            return STATE_QUEUED, REASON_NEW
        if status == "failed" and self._retry_due(task):
            return STATE_QUEUED, REASON_RETRY
        if self._needs_video(task):
            return STATE_QUEUED, REASON_VIDEOS
        return STATE_IDLE, ""

    @staticmethod
    def prerequisites(task: Dict[str, Any], reason: str) -> List[str]:
        """What the task still waits for (empty = ready to start)."""
        waiting: List[str] = []
        if ffmpeg_runtime.binaries().ffmpeg is None:
            waiting.append(WAIT_FFMPEG)
        if reason not in (REASON_VIDEOS, REASON_RERENDER) and orch_sources.cached_task_sentences(task) is None:
            # Book sentences still syncing (the read starts the sync); a text
            # task always carries its own.
            waiting.append(WAIT_SENTENCES)
        return waiting

    def _record(self, task: Dict[str, Any], state: str, waiting: List[str], reason: str) -> None:
        task_id = str(task.get("task_id") or "")
        if not self._set_state(task_id, {"state": state, "waiting": waiting, "reason": reason}):
            return
        if orch_generate.is_running(task_id):
            return
        if state == STATE_WAITING:
            orch_store.append_task_event(task, msg.ORCH_MSG_QUEUE_WAITING, waiting=",".join(waiting))
        elif state == STATE_QUEUED:
            orch_store.append_task_event(task, msg.ORCH_MSG_QUEUE_QUEUED)
        else:
            return
        orch_events.publish_task_changed(task, str(task.get("status") or ""))

    # ------------------------------------------------------------------ #
    # tick                                                                #
    # ------------------------------------------------------------------ #
    def tick(self) -> None:
        """Start what is ready, in creation order, within the run capacity."""
        number = self._begin_tick()
        if number < 0:
            return
        if number % FULL_SCAN_EVERY_TICKS == 0:
            self._scan()
        running = Counter(
            orch_sources.task_source(orch_store.get_task(task_id) or {}) for task_id in orch_generate.running_task_ids()
        )
        for task_id in sorted(self._snapshot(), key=self._created_at):
            task = orch_store.get_task(task_id)
            if task is None:
                self._discard(task_id)
                continue
            if orch_generate.is_running(task_id):
                self._set_state(task_id, {
                    "state": STATE_RUNNING, "waiting": [], "reason": self.state_of(task_id).get("reason") or "",
                })
                continue
            state, reason = self._action(task)
            if state == STATE_IDLE:
                self._record(task, STATE_IDLE, [], "")
                self._discard(task_id)
                continue
            waiting = self.prerequisites(task, reason)
            if waiting:
                self._record(task, STATE_WAITING, waiting, reason)
                continue
            source = orch_sources.task_source(task)
            if running[source] >= MAX_CONCURRENT_PER_SOURCE:
                self._record(task, STATE_QUEUED, [], reason)
                continue
            if self._start(task, reason):
                running[source] += 1
        self._end_tick()

    @staticmethod
    def _created_at(task_id: str) -> float:
        task = orch_store.get_task(task_id) or {}
        return float(task.get("created_at") or 0.0)

    def _start(self, task: Dict[str, Any], reason: str) -> bool:
        task_id = str(task["task_id"])
        if reason in (REASON_VIDEOS, REASON_RERENDER):
            result = orch_generate.start_video_render(task_id, force=(reason == REASON_RERENDER))
            self._take_rerender(task_id)
        elif reason == REASON_RETRY:
            orch_store.patch_run_fields(task_id, {"auto_retries": int(task.get("auto_retries") or 0) + 1})
            result = orch_generate.start_generation(task_id, automatic=True)
        else:
            result = orch_generate.start_generation(task_id, resume=(reason == REASON_INTERRUPTED), automatic=True)
        if result.get("success"):
            self._set_state(task_id, {"state": STATE_RUNNING, "waiting": [], "reason": reason})
            return True
        ColorPrint.yellow(f"[AudioOrchQueue] {task_id} not started ({reason}): {result.get('error')}")
        return False


orch_queue = OrchQueue()

__all__ = ["orch_queue", "OrchQueue", "CALLBACK_NAME"]
