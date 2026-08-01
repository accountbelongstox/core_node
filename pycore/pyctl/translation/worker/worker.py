# -*- coding: utf-8 -*-
"""
TranslationWorkerService (slimmed) + shared instance.

The concrete Laravel-pulled translation worker. Split out of the former
translation_worker_service.py monolith (2252 lines) per the AGENTS.md Modular rule.
Only the worker-specific glue lives here; the shared Laravel scaffold is in
base_laravel_worker.py, lane gating in lane_gating.py, the word-dedup cache in
done_words_cache.py, the per-backend heap + fast-drain in task_heap.py, and the
per-lane task processing in handlers/. No engine logic moved.

Public API (preserved verbatim - consumed across callmodule_main, event_handlers,
assist_router, queue_overview_router, task_center_router, queue_monitor_service,
translation_http_event_client_service):
  TranslationWorkerService, translation_worker_service,
  poll_once, get_status, get_queue_status, mark_words_done, partition_words,
  done_words_count.
"""

import os
import socket
import time
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
# Internal imports at file top (PYTHON_PYCORE.md §1.4). task_manager is stdlib-only.
from pycore.pyctl.desktop.task_manager import task_manager as shared_task_manager

from pycore.pyctl.translation.worker.base_laravel_worker import BaseLaravelWorkerService
import pycore.pyctl.translation.worker.lane_gating as lane_gating
from pycore.pyctl.translation.worker.done_words_cache import DoneWordsCache
from pycore.pyctl.translation.worker.task_heap import TaskHeap
import pycore.pyctl.translation.worker.handlers.ai_translate as h_ai_translate
import pycore.pyctl.translation.worker.handlers.audio as h_audio
import pycore.pyctl.translation.worker.handlers.media as h_media
import pycore.pyctl.translation.worker.handlers.prompt_translate as h_prompt_translate
import pycore.pyctl.translation.worker.handlers.stt as h_stt
import pycore.pyctl.translation.worker.handlers.translation as h_translation

from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_TYPES_BY_KEY,
    task_execution_type,
    task_local_label,
    task_types_for_execution,
)
from pycore.pyutils.common.service_config import LARAVEL_WORKER_API_URL


class TranslationWorkerService(BaseLaravelWorkerService):
    """
    Translation worker (singleton) that drives the Laravel worker-task pipeline.

    Lifecycle:
      - Each enabled poll sends the stable worker identity with the queue pull.
        Laravel discovers or refreshes the worker in that same request.
      - poll_once() pulls tasks and dispatches each task to a TaskManager background thread so the
        actual translation + result POST never blocks the heartbeat thread.
    """

    # These values come from config/queue_center_contract.json through the
    # Python adapter. The aligned Laravel, Pycore UI/Laravel-manager, and
    # mcp-chrome adapters are named in queue_center_contract.py; change the JSON,
    # never this worker, when a shared task lane changes.
    WORD_TRANSLATION_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["word_translation"]["key"]
    PROMPT_TRANSLATION_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["prompt_translation"]["key"]
    SUBTITLE_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["subtitle_search"]["key"]
    WORD_AUDIO_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["word_audio"]["key"]
    ARTICLE_AUDIO_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["article_audio"]["key"]
    SENTENCE_AUDIO_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["sentence_audio"]["key"]
    TRANSLATION_FAST_PROCESSOR_TYPE = task_execution_type("word_media")
    TRANSLATION_PROCESSOR_TYPE = task_execution_type(WORD_TRANSLATION_TASK_TYPE)
    SUBTITLE_EXECUTION_TYPE = task_execution_type(SUBTITLE_TASK_TYPE)
    AUDIO_EXECUTION_TYPE = task_execution_type(WORD_AUDIO_TASK_TYPE)
    SENTENCE_AUDIO_EXECUTION_TYPE = task_execution_type(SENTENCE_AUDIO_TASK_TYPE)
    STT_EXECUTION_TYPE = task_execution_type("stt")
    STT_TASK_TYPES = task_types_for_execution(STT_EXECUTION_TYPE)

    # Base processor types always advertised (fast + legacy translation). The
    # dedicated lanes are appended live by _effective_processor_types() when their
    # Config kill-switch AND layered user-data/assist toggle are on.
    PROCESSOR_TYPES = [TRANSLATION_FAST_PROCESSOR_TYPE, TRANSLATION_PROCESSOR_TYPE]

    DEFAULT_PROVIDER = "google"

    # Fast-drain burst cadence (overridden from Config at init).
    TRANSLATION_FAST_POLL_INTERVAL = 0.5
    TRANSLATION_FAST_DRAIN_WINDOW = 4.0
    TRANSLATION_FAST_POLL_JITTER = 0.25

    @staticmethod
    def _build_worker_id() -> str:
        """Stable, hostname-based worker id (same across restarts on a host).

        Overrides the base generic form with the translation-specific
        ``pycore-translate-`` prefix so existing Laravel-side worker_id
        accounting is unchanged.

        MULTI-INSTANCE NOTE: Laravel keys claims/heartbeats by worker_id, so two
        pycore processes on the SAME host must not share one. Atomic task claim
        still prevents double work either way, but a shared id corrupts per-worker
        accounting (current_task_id, completed/failed counters) and offline
        detection. When running more than one pycore per host, set
        PYCORE_WORKER_INSTANCE to a stable per-instance tag (e.g. its rpc port);
        it is appended to the id. Single-instance hosts need no env and keep the
        old stable id.
        """
        host = socket.gethostname() or "host"
        safe = "".join(c if (c.isalnum() or c in "-_") else "-" for c in host).lower()
        instance = (os.getenv("PYCORE_WORKER_INSTANCE") or "").strip()
        if instance:
            safe_instance = "".join(
                c if (c.isalnum() or c in "-_") else "-" for c in instance
            ).lower()
            return f"pycore-translate-{safe}-{safe_instance}"
        return f"pycore-translate-{safe}"

    def __init__(self, laravel_api_url: str = "http://127.0.0.1:9000"):
        """
        Initialize the worker (idempotent - safe to call repeatedly).

        Args:
            laravel_api_url: Laravel worker-API base URL (no trailing slash).
        """
        if getattr(self, "_initialized", False):
            return

        # Shared Laravel-worker scaffold (candidates, api_url, worker_id,
        # registration/conn-fail/circuit/inflight state, _http_timeout).
        self._init_base_laravel(laravel_api_url)
        self.worker_name = f"pycore-translation-{self.worker_id}"
        self._log_prefix = "[TranslationWorker]"

        # Prompt-translation AI pause: when every AI provider is exhausted we stop
        # producing translations until monotonic time() passes this deadline.
        self._prompt_ai_pause_until = 0.0

        # ---- Multi-pycore WORD-LEVEL coordination (Phase C) ----
        self._done_words_cache = DoneWordsCache(ttl=120)

        # ---- Unified-task fast lane (2026-06-21) ----
        # Last processor types and capabilities accepted by a queue pull.
        self._advertised_processor_types: Optional[List[str]] = None
        self._advertised_capabilities: Optional[List[str]] = None
        # Per-backend priority heap + jittered fast-drain burst (reuses
        # SentencePriorityQueue, extended to per-backend routing by TaskHeap).
        self._task_heap = TaskHeap(self)
        # Latest fast/urgent counters parsed from pull/heartbeat responses.
        self._pending_fast = 0
        self._pending_urgent = 0
        # Pull fast-poll knobs from Config (fall back to class defaults).
        try:
            self.TRANSLATION_FAST_POLL_INTERVAL = float(
                os.getenv(
                    "PYCORE_TRANSLATION_FAST_POLL_INTERVAL",
                    str(self.TRANSLATION_FAST_POLL_INTERVAL),
                )
            )
            self.TRANSLATION_FAST_DRAIN_WINDOW = float(
                os.getenv(
                    "PYCORE_TRANSLATION_FAST_DRAIN_WINDOW",
                    str(self.TRANSLATION_FAST_DRAIN_WINDOW),
                )
            )
            self.TRANSLATION_FAST_POLL_JITTER = float(
                os.getenv(
                    "PYCORE_TRANSLATION_FAST_POLL_JITTER",
                    str(self.TRANSLATION_FAST_POLL_JITTER),
                )
            )
        except Exception:
            pass

        self._initialized = True
        ColorPrint.green(
            f"[TranslationWorker] Service initialized "
            f"(worker_id={self.worker_id}, candidates={self._candidates})"
        )

    # -------------------- word-level coordination (multi-pycore) --------------------
    # Public API: delegated to DoneWordsCache (consumed by the HTTP event client +
    # get_status). Kept as methods so the public surface is unchanged.

    def mark_words_done(
        self,
        words: List[str],
        source_language: str,
        target_language: str,
        ttl_seconds: Optional[int] = None,
    ) -> None:
        """Record words as already translated (this or another pycore) for a short TTL."""
        self._done_words_cache.mark_words_done(words, source_language, target_language, ttl_seconds)

    def partition_words(
        self,
        words: List[str],
        source_language: str,
        target_language: str,
    ):
        """Split words into (to_translate, already_done) using the done-words set."""
        return self._done_words_cache.partition_words(words, source_language, target_language)

    def done_words_count(self) -> int:
        """Number of live (non-expired) entries in the done-words set."""
        return self._done_words_cache.done_words_count()

    # -------------------- capability / lane gating (live toggles) --------------------

    def _effective_capabilities(self) -> List[str]:
        """Capabilities advertised on register AND status (delegates to lane_gating)."""
        return lane_gating.effective_capabilities()

    def _effective_processor_types(self) -> List[str]:
        """The lane set advertised this tick (delegates to lane_gating)."""
        return lane_gating.effective_processor_types(self)

    def _effective_task_types(self) -> List[str]:
        """Task types pulled via the typed pull route, primary LAST.

        Mirrors the lane gates: translation toggle -> prompt_translation +
        word_translation (word_translation last = holds the long-poll budget),
        subtitle toggle -> subtitle_search, stt toggle -> the stt lane types.
        Audio types are intentionally absent: the dedicated audio workers own
        those routes now.
        """
        types: List[str] = []
        if lane_gating.translation_enabled():
            types.append(self.PROMPT_TRANSLATION_TASK_TYPE)
        if lane_gating.subtitle_enabled():
            types.append(self.SUBTITLE_TASK_TYPE)
        if lane_gating.stt_enabled():
            types.extend(self.STT_TASK_TYPES)
        if lane_gating.translation_enabled():
            types.append(self.WORD_TRANSLATION_TASK_TYPE)
        return types

    # -------------------- payload hygiene --------------------

    @staticmethod
    def _normalize_words(raw_words: Any) -> List[str]:
        """Coerce a task's payload.words into a clean list of strings.

        Delegates to handlers.translation.normalize_words. Kept as a static method
        for traceability with the original monolith's internal call sites.
        """
        return h_translation.normalize_words(raw_words)

    # -------------------- task processing --------------------

    def _start_lease_keepalive(self, task: Dict[str, Any], lease_seconds: int) -> None:
        """Ping 'processing' while a task executes so Laravel's lease tracks real work.

        d.txt 7: a long task (cold TTS engine start, a large word batch) can
        outlive the ``timeout_at`` lease; the reaper then reassigns it and the
        late result is rejected 409 ('task reassigned / not ours'), wasting the
        work. The ping carries NO progress field — the backend leaves the
        stored progress untouched and only extends the lease.
        """
        task_id = task.get("task_id")
        interval = max(15.0, min(120.0, float(lease_seconds) / 3.0))

        def _keepalive() -> None:
            while not task.get("_lease_stop"):
                # Condition-based wait on a never-signalled name — a pure
                # cancellable timer, no sleep-poll (threading standard).
                THREAD_BUS.wait_signal(
                    "translation.worker.lease_keepalive", timeout=interval
                )
                if task.get("_lease_stop"):
                    return
                try:
                    # attempts=1: a lost ping costs nothing, the next one lands.
                    self._post_result(task_id, "processing", attempts=1)
                except Exception:  # noqa: BLE001 - keep-alive must never raise
                    pass

        try:
            start_bus_task(
                _keepalive,
                thread_name=f"TaskLeaseKeepAlive-{str(task_id)[:8]}",
            )
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[TranslationWorker] lease keep-alive start failed ({exc})")


    def _process_task(self, task: Dict[str, Any]) -> None:
        """
        Process one claimed task and POST its result. Runs on a TaskManager
        background thread (off the heartbeat thread). Any failure -> POST 'failed'
        so Laravel re-routes/re-pends; nothing is ever silently dropped.

        Dispatch order (unified client) - delegates to the per-lane handlers:
          - capability == 'ai_translate'  -> ai_translate.ai_translate_words
          - task_type == 'subtitle_search'-> media.process_subtitle_search_task
          - task_type == 'prompt_translation' -> prompt_translate.process_prompt_translation_task
          - task_type word_audio/article_audio -> audio.process_audio_task
          - task_type == 'sentence_audio' -> audio.process_audio_task
          - task_type in STT_TASK_TYPES   -> stt.process_stt_task
          - task_type word_translation/'' -> translation.process_word_translation
          - anything else                 -> 'failed' (re-route)
        """
        task_id = task.get("task_id")
        try:
            task_type = task.get("task_type")
            capability = task.get("capability")

            # AI-translate capability: race on the shared fast lane. task_type stays
            # word_translation; only the PATH differs (AI gateway vs Google).
            if capability == "ai_translate":
                h_ai_translate.ai_translate_words(self, task)
                return

            if task_type == self.SUBTITLE_TASK_TYPE:
                h_media.process_subtitle_search_task(self, task)
                return
            if task_type == self.PROMPT_TRANSLATION_TASK_TYPE:
                h_prompt_translate.process_prompt_translation_task(self, task)
                return
            if task_type in (
                self.WORD_AUDIO_TASK_TYPE,
                self.ARTICLE_AUDIO_TASK_TYPE,
                self.SENTENCE_AUDIO_TASK_TYPE,
            ):
                h_audio.process_audio_task(self, task)
                return
            if task_type in self.STT_TASK_TYPES:
                h_stt.process_stt_task(self, task)
                return

            # The pull claims by execution_type, so a mis-tagged task of another
            # task_type can land here. Translating it would post a result shape
            # its real processor does not understand - report failed instead so
            # Laravel retries it toward the right consumer.
            if task_type not in (None, "", self.WORD_TRANSLATION_TASK_TYPE):
                ColorPrint.yellow(
                    f"[TranslationWorker] Task {task_id} has unsupported "
                    f"task_type '{task_type}' - reporting failed so it can be re-routed"
                )
                self._post_result(
                    task_id,
                    "failed",
                    error=(
                        f"pycore translation worker only processes word_translation "
                        f"tasks (got task_type={task_type!r})"
                    ),
                )
                return

            h_translation.process_word_translation(self, task)
        except Exception as e:
            ColorPrint.red(f"[TranslationWorker] Task {task_id} failed: {e}")
            self._post_result(task_id, "failed", error=str(e))
        finally:
            task["_lease_stop"] = True
            self._release_inflight(task_id)

    # -------------------- local task accounting --------------------

    def _record_task(
        self,
        task: Dict[str, Any],
        task_type: str,
        status: str,
        posted_back: bool = True,
        error: Optional[str] = None,
    ) -> None:
        """Best-effort local accounting hook for a processed task (never raises)."""
        try:
            ColorPrint.blue(
                f"[TranslationWorker] recorded {task_type} task "
                f"{task.get('task_id')} -> {status}"
                + (f" (posted_back={posted_back})" if not posted_back else "")
                + (f" error={error}" if error else "")
            )
        except Exception:
            pass

    def _patch_local_task(
        self,
        task: Dict[str, Any],
        progress: Optional[int] = None,
        status: Optional[str] = None,
        result_patch: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> None:
        """Push live synthesis progress/result into the pyctl TaskManager row."""
        local_id = task.get("_local_task_id")
        if not local_id:
            return
        try:
            shared_task_manager.patch_task(
                local_id,
                progress=progress,
                status=status,
                result_patch=result_patch,
                error=error,
            )
        except Exception:
            pass

    @staticmethod
    def _local_task_label(task: Dict[str, Any]) -> str:
        """Map a pulled task to the local TaskManager lane label for the UI.

        Each new unified task_type gets its own lane so the local task-center UI can
        distinguish them; ai_translate keeps the translation lane (task_type stays
        word_translation).
        """
        return task_local_label(task.get("task_type"), task.get("capability"))

    def _purge_inflight_locked(self, now: float) -> None:
        """Drop inflight entries whose deadline has passed.

        A hung executor (semaphore block or stalled engine) would otherwise keep a
        task_id blacklisted forever, so a re-offered task (after Laravel's lease
        timeout) could never be re-claimed by this worker until restart.

        State-owner serialization keeps the scan and removals in one operation.
        The name remains for the existing task_heap.py call site.
        """
        expired = [tid for tid, dl in list(self._inflight.items()) if dl <= now]
        for tid in expired:
            self._inflight.pop(tid, None)

    @serialized_method
    def _release_inflight(self, task_id: Any) -> None:
        self._inflight.pop(task_id, None)

    @serialized_method
    def _fast_drain_snapshot(self) -> Dict[str, Any]:
        return {
            "registered": self._registered,
            "api_url": self.api_url,
            "pending_fast": self._pending_fast,
            "poll_interval": self.TRANSLATION_FAST_POLL_INTERVAL,
            "drain_window": self.TRANSLATION_FAST_DRAIN_WINDOW,
            "poll_jitter": self.TRANSLATION_FAST_POLL_JITTER,
        }

    @serialized_method
    def _dispatch(self, task: Dict[str, Any]) -> None:
        """
        Hand a task to a background thread via the pyctl desktop TaskManager so the
        heartbeat thread is never blocked by network + translation latency. Mirrors
        VideoExtractController.start()'s use of execute_task.
        """
        task_id = task.get("task_id")
        now = time.monotonic()
        self._purge_inflight_locked(now)
        ttl = int(task.get("timeout_seconds") or self.INFLIGHT_DEFAULT_TTL)
        deadline = now + max(ttl, self.INFLIGHT_DEFAULT_TTL)
        task["_lease_stop"] = False
        self._start_lease_keepalive(task, max(ttl, self.INFLIGHT_DEFAULT_TTL))
        # The state owner makes the duplicate claim check and update indivisible.
        existing = self._inflight.setdefault(task_id, deadline)
        if existing is not deadline:
            if existing > now:
                return  # already being processed
            self._inflight[task_id] = deadline

        try:
            tm = shared_task_manager
            payload = task.get("payload") or {}
            words = h_translation.words_from_payload(payload)
            content_preview = h_translation.format_words_preview(words)
            input_data = {
                "remote_task_id": task_id,
                "app_name": task.get("app_name"),
                "task_type": task.get("task_type"),
                "execution_type": task.get("execution_type"),
                "capability": task.get("capability"),
                "words": words,
                "content": (
                    payload.get("content")
                    or payload.get("text")
                    or payload.get("word")
                    or (words[0] if len(words) == 1 else None)
                ),
                "content_preview": content_preview or None,
                "md5": payload.get("md5"),
                "language": payload.get("language"),
                "target_language": payload.get("target_language"),
                "priority": task.get("priority"),
            }
            local_task_id = tm.create_task(
                task_type=self._local_task_label(task),
                input_data=input_data,
                estimated_time=None,
            )
            task["_local_task_id"] = local_task_id

            def executor(_local_task):
                self._process_task(task)
                local_id = task.get("_local_task_id")
                if not local_id:
                    return {"remote_task_id": task_id, "dispatched": True}
                live = tm.get_task(local_id)
                if not live:
                    return {"remote_task_id": task_id, "dispatched": True}
                if live.status == "failed":
                    err = live.error or "failed"
                    tm.fail_task(local_id, err)
                    return live.result if isinstance(live.result, dict) else {
                        "remote_task_id": task_id, "error": err,
                    }
                if isinstance(live.result, dict) and live.result:
                    return dict(live.result)
                return {"remote_task_id": task_id, "dispatched": True}

            tm.execute_task(local_task_id, executor)
        except Exception as e:
            # If the TaskManager is unavailable, fall back to a plain daemon thread so
            # the worker still functions (heartbeat thread stays unblocked either way).
            # The fallback task and its payload are delivered through THREAD_BUS.
            ColorPrint.yellow(
                f"[TranslationWorker] TaskManager dispatch failed ({e}); using thread fallback"
            )
            start_bus_task(
                self._process_task,
                task,
                thread_name=f"TranslateTask-{task_id}-Thread",
            )

    # -------------------- heartbeat callback --------------------

    def poll_once(self) -> None:
        """PyHeartbeat callback (invoked every ~interval seconds WHEN ENABLED).

        LIGHT: single-flight guard + hand the poll cycle to a THREAD_BUS task
        thread. The cycle's network I/O used to run
        on the serialized state-owner thread via @serialized_method; against a
        dead endpoint one poll occupied the owner for >60s, so every concurrent
        get_status and the next heartbeat tick raised 'Serialized operation
        timed out: translation.worker.state.*'. Now neither the heartbeat
        thread nor the state owner blocks on network.
        """
        if THREAD_BUS.get_signal("translation.worker.poll_running", False):
            return
        THREAD_BUS.signal("translation.worker.poll_running", True)

        def _guarded_cycle():
            try:
                self._poll_cycle()
            finally:
                THREAD_BUS.signal("translation.worker.poll_running", False)

        try:
            start_bus_task(_guarded_cycle, thread_name="translation-worker-poll")
        except Exception as e:
            THREAD_BUS.signal("translation.worker.poll_running", False)
            ColorPrint.red(f"[TranslationWorker] poll_once error: {e}")

    def _poll_cycle(self) -> None:
        """
        PyHeartbeat callback (invoked every ~interval seconds WHEN ENABLED).

        Light by design: pull tasks with inline worker identity, then dispatch each
        to a background thread. Idempotent and exception-safe - it must never
        raise into the heartbeat loop.
        """
        try:
            # Circuit breaker: while the backend is persistently rejecting results
            # (HTTP 5xx), STOP pulling new
            # work - translating more only burns LLM calls for results the backend
            # cannot store and re-floods it. The cooldown expires on its own so the
            # worker auto-probes; any accepted result resets it (_note_result_*).
            if self._circuit_is_open():
                return

            # Pull with wait=0 (immediate). Laravel orders by priority desc; we ALSO
            # fold the batch into the per-backend priority heap and drain highest
            # first so a bumped task processes ahead of older lower-priority ones.
            tasks = self._pull_tasks(wait=0)
            base = self.api_url
            if tasks:
                ColorPrint.green(f"[TranslationWorker] Pulled {len(tasks)} task(s)")
                # Every pulled task is already CLAIMED for this worker by Laravel's
                # atomic assign - enqueue everything; _process_task answers
                # unsupported types with 'failed' so they re-route, never leak.
                self._task_heap.enqueue_tasks(base, tasks)
                for task in self._task_heap.drain_heap(base):
                    self._dispatch(task)

            # A pending_fast signal from this pull arms a jittered
            # fast-drain burst so interactive requests are claimed near-instantly.
            self._task_heap.maybe_start_fast_drain(self._pending_fast)
        except Exception as e:
            ColorPrint.red(f"[TranslationWorker] poll_once error: {e}")

    # -------------------- introspection --------------------

    def get_status(self) -> Dict[str, Any]:
        """Service status snapshot (read-only)."""
        inflight = len(self._inflight)
        return {
            "service": "Translation Worker",
            "api_url": self.api_url,
            "worker_id": self.worker_id,
            "processor_types": self._effective_processor_types(),
            "capabilities": self._effective_capabilities(),
            "provider": self.DEFAULT_PROVIDER,
            "registered": self._registered,
            "inflight_tasks": inflight,
            "done_words_cached": self.done_words_count(),
            "initialized": self._initialized,
            # Circuit breaker: open while the backend persistently rejects results.
            "circuit_open": self._circuit_is_open(),
            "result_5xx_streak": self._result_5xx_streak,
            # Fast-lane signal snapshot.
            "pending_fast": self._pending_fast,
            "pending_urgent": self._pending_urgent,
            "heap_depth": self._task_heap.depth(),
        }

    def get_queue_status(self) -> Dict[str, Any]:
        """Fast-lane / queue snapshot for routers + local UI.

        Surfaces the latest pending_fast / pending_urgent counters (from pull +
        heartbeat), the per-backend claimed-task heap depth, the fast-drain burst
        state, and the advertised lanes/capabilities - so the task-center overview is
        not blind to the interactive fast lane.
        """
        per_backend = self._task_heap.per_backend_depth()
        inflight = len(self._inflight)
        return {
            "api_url": self.api_url,
            "registered": self._registered,
            "pending_fast": self._pending_fast,
            "pending_urgent": self._pending_urgent,
            "heap_depth": sum(per_backend.values()),
            "heap_per_backend": per_backend,
            "fast_drain_active": self._task_heap.is_fast_drain_active(),
            "inflight_tasks": inflight,
            "processor_types": self._effective_processor_types(),
            "capabilities": self._effective_capabilities(),
        }


translation_worker_service = TranslationWorkerService(LARAVEL_WORKER_API_URL)
