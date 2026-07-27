# -*- coding: utf-8 -*-
"""
TranslationWorkerService (slimmed) + global singleton accessor.

The concrete Laravel-pulled translation worker. Split out of the former
translation_worker_service.py monolith (2252 lines) per the AGENTS.md Modular rule.
Only the worker-specific glue lives here; the shared Laravel scaffold is in
base_laravel_worker.py, lane gating in lane_gating.py, the word-dedup cache in
done_words_cache.py, the per-backend heap + fast-drain in task_heap.py, and the
per-lane task processing in handlers/. No engine logic moved.

Public API (preserved verbatim - consumed across callmodule_main, event_handlers,
assist_router, queue_overview_router, task_center_router, queue_monitor_service,
translation_ws_client_service):
  TranslationWorkerService, get_translation_worker_service,
  poll_once, get_status, get_queue_status, mark_words_done, partition_words,
  done_words_count.
"""

import os
import socket
import time
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
# Internal imports at file top (PYTHON_PYCORE.md §1.4). task_manager is stdlib-only.
from pycore.pyctl.desktop.task_manager import get_task_manager

from .base_laravel_worker import BaseLaravelWorkerService
from . import lane_gating
from .done_words_cache import DoneWordsCache
from .task_heap import TaskHeap
from .handlers import (
    translation as h_translation,
    stt as h_stt,
    media as h_media,
    ai_translate as h_ai_translate,
    prompt_translate as h_prompt_translate,
)

from pycore.callmodule.callmodule_config import Config as _Cfg


class TranslationWorkerService(BaseLaravelWorkerService):
    """
    Translation worker (singleton) that drives the Laravel worker-task pipeline.

    Lifecycle:
      - First poll (or get_*): registers with Laravel (/api/worker/register) using a
        stable hostname-based worker_id. Registration is retried on later polls if
        it has not yet succeeded (Laravel may not be up at start).
      - Each heartbeat tick (when enabled): poll_once() sends a heartbeat, pulls
        tasks, and dispatches each task to a TaskManager background thread so the
        actual translation + result POST never blocks the heartbeat thread.
    """

    # ---- Execution-type lanes (must equal GlobalTask::EXECUTION_TYPES) ----
    # The shared interactive fast lane both pycore and chrome register for.
    TRANSLATION_FAST_PROCESSOR_TYPE = "remote_fast"
    # The legacy dedicated translation lane (still advertised for back-compat).
    TRANSLATION_PROCESSOR_TYPE = "remote_translation"
    # Dedicated pycore-only retrieval/generation lanes (knob-gated, see config).
    SUBTITLE_EXECUTION_TYPE = "remote_subtitle"
    # Speech-to-text lane (remote_stt). Laravel defines EXECUTION_REMOTE_STT +
    # CAPABILITY_STT and routes stt=>pycore; advertised only while the assist
    # 'stt' toggle is on (off by default - see lane_gating.stt_enabled).
    STT_EXECUTION_TYPE = "remote_stt"

    # task_type tags carried in payloads on these lanes.
    # STT task_type tags accepted on the remote_stt lane.
    STT_TASK_TYPES = ("stt", "audio_transcribe")

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
        # Last advertised processor-type set; re-register fires when it changes
        # (live toggle of a dedicated lane).
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
                getattr(_Cfg, "TRANSLATION_FAST_POLL_INTERVAL",
                        self.TRANSLATION_FAST_POLL_INTERVAL))
            self.TRANSLATION_FAST_DRAIN_WINDOW = float(
                getattr(_Cfg, "TRANSLATION_FAST_DRAIN_WINDOW",
                        self.TRANSLATION_FAST_DRAIN_WINDOW))
            self.TRANSLATION_FAST_POLL_JITTER = float(
                getattr(_Cfg, "TRANSLATION_FAST_POLL_JITTER",
                        self.TRANSLATION_FAST_POLL_JITTER))
        except Exception:
            pass

        self._initialized = True
        ColorPrint.green(
            f"[TranslationWorker] Service initialized "
            f"(worker_id={self.worker_id}, candidates={self._candidates})"
        )

    # -------------------- word-level coordination (multi-pycore) --------------------
    # Public API: delegated to DoneWordsCache (consumed by translation_ws_client +
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

    # -------------------- payload hygiene --------------------

    @staticmethod
    def _normalize_words(raw_words: Any) -> List[str]:
        """Coerce a task's payload.words into a clean list of strings.

        Delegates to handlers.translation.normalize_words. Kept as a static method
        for traceability with the original monolith's internal call sites.
        """
        return h_translation.normalize_words(raw_words)

    # -------------------- task processing --------------------

    def _process_task(self, task: Dict[str, Any]) -> None:
        """
        Process one claimed task and POST its result. Runs on a TaskManager
        background thread (off the heartbeat thread). Any failure -> POST 'failed'
        so Laravel re-routes/re-pends; nothing is ever silently dropped.

        Dispatch order (unified client) - delegates to the per-lane handlers:
          - capability == 'ai_translate'  -> ai_translate.ai_translate_words
          - task_type == 'subtitle_search'-> media.process_subtitle_search_task
          - task_type == 'prompt_translation' -> prompt_translate.process_prompt_translation_task
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

            if task_type == "subtitle_search":
                h_media.process_subtitle_search_task(self, task)
                return
            if task_type == "prompt_translation":
                h_prompt_translate.process_prompt_translation_task(self, task)
                return
            if task_type in self.STT_TASK_TYPES:
                h_stt.process_stt_task(self, task)
                return

            # The pull claims by execution_type, so a mis-tagged task of another
            # task_type can land here. Translating it would post a result shape
            # its real processor does not understand - report failed instead so
            # Laravel retries it toward the right consumer.
            if task_type not in (None, "", "word_translation"):
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
            get_task_manager().patch_task(
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
        if task.get("capability") == "ai_translate":
            return "remote_ai_translate"
        return {
            "word_audio": "remote_audio",
            "word_media": "remote_image",
            "subtitle_search": "remote_subtitle",
            "poster": "remote_poster",
            "sentence_audio": "remote_sentence_audio",
        }.get(task.get("task_type"), "remote_translation")

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
        # The state owner makes the duplicate claim check and update indivisible.
        existing = self._inflight.setdefault(task_id, deadline)
        if existing is not deadline:
            if existing > now:
                return  # already being processed
            self._inflight[task_id] = deadline

        try:
            tm = get_task_manager()
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
        thread. The cycle's network I/O (register/heartbeat/pull) used to run
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

        Light by design: ensure registration, send heartbeat, pull tasks, dispatch
        each to a background thread. Idempotent and exception-safe - it must never
        raise into the heartbeat loop.
        """
        try:
            if not self._register():
                return  # not registered yet (Laravel down) - try again next tick

            # Live-toggle re-registration: if a dedicated lane was enabled/disabled
            # since the last register, re-advertise the new processor-type set so
            # Laravel starts/stops handing those lanes to this worker immediately.
            processor_types = self._effective_processor_types()
            capabilities = self._effective_capabilities()
            if (self._advertised_processor_types is not None
                    and (processor_types != self._advertised_processor_types
                         or capabilities != self._advertised_capabilities)):
                ColorPrint.blue(
                    "[TranslationWorker] advertised lanes/capabilities changed - re-registering")
                self._registered = False
                if not self._register():
                    return

            self._heartbeat()

            # Circuit breaker: while the backend is persistently rejecting results
            # (HTTP 5xx), keep heartbeating (stay registered) but STOP pulling new
            # work - translating more only burns LLM calls for results the backend
            # cannot store and re-floods it. The cooldown expires on its own so the
            # worker auto-probes; any accepted result resets it (_note_result_*).
            if self._circuit_is_open():
                return

            # Pull with wait=0 (immediate). Laravel orders by priority desc; we ALSO
            # fold the batch into the per-backend priority heap and drain highest
            # first so a bumped task processes ahead of older lower-priority ones.
            base = self.api_url
            tasks = self._pull_tasks(base, wait=0)
            if tasks:
                ColorPrint.green(f"[TranslationWorker] Pulled {len(tasks)} task(s)")
                # Every pulled task is already CLAIMED for this worker by Laravel's
                # atomic assign - enqueue everything; _process_task answers
                # unsupported types with 'failed' so they re-route, never leak.
                self._task_heap.enqueue_tasks(base, tasks)
                for task in self._task_heap.drain_heap(base):
                    self._dispatch(task)

            # A pending_fast signal (from this pull or the heartbeat) arms a jittered
            # fast-drain burst so interactive requests are claimed near-instantly.
            self._task_heap.maybe_start_fast_drain(self._pending_fast)
        except Exception as e:
            ColorPrint.red(f"[TranslationWorker] poll_once error: {e}")

    # -------------------- introspection --------------------

    @serialized_method
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

    @serialized_method
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


class _TranslationWorkerProvider:
    """Create the translation worker singleton on a THREAD_BUS state owner."""

    def __init__(self) -> None:
        self._worker: Optional[TranslationWorkerService] = None
        init_serialized_owner(
            self,
            "translation.worker.provider",
            "TranslationWorkerProvider",
            timeout=60.0,
        )

    @serialized_method
    def get(self, laravel_api_url: str) -> TranslationWorkerService:
        if self._worker is None:
            self._worker = TranslationWorkerService(laravel_api_url)
        return self._worker


_translation_worker_provider = _TranslationWorkerProvider()

def get_translation_worker_service(
    laravel_api_url: str = "http://127.0.0.1:9000",
) -> TranslationWorkerService:
    """
    Get the TranslationWorkerService singleton (idempotent).

    Args:
        laravel_api_url: Laravel worker-API base URL.

    Returns:
        The shared TranslationWorkerService instance.
    """
    return _translation_worker_provider.get(laravel_api_url)
