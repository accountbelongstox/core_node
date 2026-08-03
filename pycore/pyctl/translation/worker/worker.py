# -*- coding: utf-8 -*-
"""
TranslationWorkerService (compute-only) + shared instance.

The concrete translation worker. Split out of the former
translation_worker_service.py monolith (2252 lines) per the AGENTS.md Modular
rule. Only the worker-specific glue lives here; the shared Laravel result-upload
scaffold is in base_laravel_worker.py, lane gating in lane_gating.py, the
word-dedup cache in done_words_cache.py, and the per-lane task processing in
handlers/. No engine logic moved.

Exchange-hub architecture (FIX_20260802_UI_EXCHANGE_HUB_ARCHITECTURE.md):
pycore never pulls, claims, or heartbeats Laravel. The UI pump accepts tasks
from Laravel and dispatches them to pycore over RPC (accept_task); pycore
processes them and uploads ONLY the result (status + payload) through
base_laravel_worker._post_result.

Public API:
  TranslationWorkerService, translation_worker_service,
  accept_task, get_status, mark_words_done, partition_words, done_words_count.
"""

import socket
import time
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.serialized_worker import (
    serialized_method,
    start_bus_task,
)
# Internal imports at file top (PYTHON_PYCORE.md §1.4). task_manager is stdlib-only.
from pycore.pyctl.desktop.task_manager import task_manager as shared_task_manager

from pycore.pyctl.translation.worker.base_laravel_worker import BaseLaravelWorkerService
import pycore.pyctl.translation.worker.lane_gating as lane_gating
from pycore.pyctl.translation.worker.done_words_cache import DoneWordsCache
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
from pycore.pyutils.common.service_config import (
    LARAVEL_WORKER_API_URL,
    PYCORE_WORKER_INSTANCE,
)


class TranslationWorkerService(BaseLaravelWorkerService):
    """
    Translation worker (singleton) processing UI-dispatched tasks.

    Lifecycle:
      - The UI pump accepts a task from Laravel and calls accept_task() over RPC.
      - accept_task() records the task type/endpoint for the typed result route
        and dispatches the task to a TaskManager background thread so the
        actual translation + result POST never blocks the RPC thread.
    """

    # These values come from config/queue_center_contract.json through the
    # Python adapter. The aligned Laravel, Pycore UI/Laravel-manager, and
    # mcp-chrome adapters are named in queue_center_contract.py; change the JSON,
    # never this worker, when a shared task lane changes.
    WORD_TRANSLATION_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["word_translation"]["key"]
    PROMPT_TRANSLATION_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["prompt_translation"]["key"]
    SUBTITLE_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["subtitle_search"]["key"]
    WORD_AUDIO_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["word_audio"]["key"]
    SENTENCE_AUDIO_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["sentence_audio"]["key"]
    TRANSLATION_FAST_PROCESSOR_TYPE = task_execution_type("word_media")
    TRANSLATION_PROCESSOR_TYPE = task_execution_type(WORD_TRANSLATION_TASK_TYPE)
    SUBTITLE_EXECUTION_TYPE = task_execution_type(SUBTITLE_TASK_TYPE)
    AUDIO_EXECUTION_TYPE = task_execution_type(WORD_AUDIO_TASK_TYPE)
    SENTENCE_AUDIO_EXECUTION_TYPE = task_execution_type(SENTENCE_AUDIO_TASK_TYPE)
    STT_EXECUTION_TYPE = task_execution_type("stt")
    STT_TASK_TYPES = task_types_for_execution(STT_EXECUTION_TYPE)

    # Base processor types (fast + legacy translation). The dedicated lanes are
    # appended live by _effective_processor_types() when their Config kill-switch
    # AND layered user-data/assist toggle are on.
    PROCESSOR_TYPES = [TRANSLATION_FAST_PROCESSOR_TYPE, TRANSLATION_PROCESSOR_TYPE]

    DEFAULT_PROVIDER = "google"

    @staticmethod
    def _build_worker_id() -> str:
        """Stable, hostname-based worker id (same across restarts on a host).

        Overrides the base generic form with the translation-specific
        ``pycore-translate-`` prefix so existing Laravel-side worker_id
        accounting is unchanged.

        MULTI-INSTANCE NOTE: Laravel keys results by worker_id, so two pycore
        processes on the SAME host must not share one. For multiple pycore
        processes on one host, configure PYCORE_WORKER_INSTANCE with a stable
        per-instance tag; it is appended to the id. Single-instance hosts keep
        the original stable id.
        """
        host = socket.gethostname() or "host"
        safe = "".join(c if (c.isalnum() or c in "-_") else "-" for c in host).lower()
        instance = PYCORE_WORKER_INSTANCE.strip()
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
        # circuit/inflight state).
        self._init_base_laravel(laravel_api_url)
        self.worker_name = f"pycore-translation-{self.worker_id}"
        self._log_prefix = "[TranslationWorker]"

        # Prompt-translation AI pause: when every AI provider is exhausted we stop
        # producing translations until monotonic time() passes this deadline.
        self._prompt_ai_pause_until = 0.0

        # ---- Multi-pycore WORD-LEVEL coordination (Phase C) ----
        self._done_words_cache = DoneWordsCache(ttl=120)

        self._initialized = True
        ColorPrint.green(
            f"[TranslationWorker] Service initialized "
            f"(worker_id={self.worker_id}, candidates={self._candidates})"
        )

    # -------------------- word-level coordination (multi-pycore) --------------------
    # Public API: delegated to DoneWordsCache. Kept as methods so the public
    # surface is unchanged.

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
        """Capabilities this worker can process (delegates to lane_gating)."""
        return lane_gating.effective_capabilities()

    def _effective_processor_types(self) -> List[str]:
        """The lane set this worker can process (delegates to lane_gating)."""
        return lane_gating.effective_processor_types(self)

    # -------------------- payload hygiene --------------------

    @staticmethod
    def _normalize_words(raw_words: Any) -> List[str]:
        """Coerce a task's payload.words into a clean list of strings.

        Delegates to handlers.translation.normalize_words. Kept as a static method
        for traceability with the original monolith's internal call sites.
        """
        return h_translation.normalize_words(raw_words)

    # -------------------- RPC accept entry --------------------

    def accept_task(self, task: Dict[str, Any], base_url: str = "") -> Dict[str, Any]:
        """RPC accept entry: take ONE UI-dispatched task and process it.

        The UI pump has already accepted (claimed) the task from Laravel; this
        worker only processes it and uploads the result. The task type and the
        Laravel base URL are recorded for the typed result route.
        """
        if not isinstance(task, dict) or task.get("task_id") in (None, ""):
            return {"success": False, "error": "task with task_id is required"}
        endpoint = (base_url or "").strip() or self.api_url
        self._remember_task_types([task], endpoint)
        self._dispatch(task)
        return {"success": True, "task_id": task.get("task_id")}

    # -------------------- task processing --------------------

    def _start_lease_keepalive(self, task: Dict[str, Any], lease_seconds: int) -> None:
        """Ping 'processing' while a task executes so Laravel's lease tracks real work.

        A long task (cold TTS engine start, a large word batch) can outlive the
        ``timeout_at`` lease; the reaper then reassigns it and the late result
        is rejected 409 ('task reassigned / not ours'), wasting the work. The
        ping carries NO progress field - the backend leaves the stored progress
        untouched and only extends the lease.
        """
        task_id = task.get("task_id")
        interval = max(15.0, min(120.0, float(lease_seconds) / 3.0))

        def _keepalive() -> None:
            while not task.get("_lease_stop"):
                # Condition-based wait on a never-signalled name - a pure
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
        Process one dispatched task and POST its result. Runs on a TaskManager
        background thread (off the RPC thread). Any failure -> POST 'failed'
        so Laravel re-routes/re-pends; nothing is ever silently dropped.

        Dispatch order (unified client) - delegates to the per-lane handlers:
          - capability == 'ai_translate'  -> ai_translate.ai_translate_words
          - task_type == 'subtitle_search'-> media.process_subtitle_search_task
          - task_type == 'prompt_translation' -> prompt_translate.process_prompt_translation_task
          - task_type == 'word_audio' -> audio.process_audio_task
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
                self.SENTENCE_AUDIO_TASK_TYPE,
            ):
                h_audio.process_audio_task(self, task)
                return
            if task_type in self.STT_TASK_TYPES:
                h_stt.process_stt_task(self, task)
                return

            # A mis-tagged task of another task_type can land here. Translating
            # it would post a result shape its real processor does not
            # understand - report failed instead so Laravel retries it toward
            # the right consumer.
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
        """Map a dispatched task to the local TaskManager lane label for the UI.

        Each new unified task_type gets its own lane so the local task-center UI can
        distinguish them; ai_translate keeps the translation lane (task_type stays
        word_translation).
        """
        return task_local_label(task.get("task_type"), task.get("capability"))

    def _purge_inflight_locked(self, now: float) -> None:
        """Drop inflight entries whose deadline has passed.

        A hung executor (semaphore block or stalled engine) would otherwise keep a
        task_id blacklisted forever, so a re-dispatched task could never be
        accepted by this worker until restart.

        State-owner serialization keeps the scan and removals in one operation.
        """
        expired = [tid for tid, dl in list(self._inflight.items()) if dl <= now]
        for tid in expired:
            self._inflight.pop(tid, None)

    @serialized_method
    def _release_inflight(self, task_id: Any) -> None:
        self._inflight.pop(task_id, None)

    @serialized_method
    def _dispatch(self, task: Dict[str, Any]) -> None:
        """
        Hand a task to a background thread via the pyctl desktop TaskManager so the
        RPC thread is never blocked by network + translation latency. Mirrors
        VideoExtractController.start()'s use of execute_task.
        """
        task_id = task.get("task_id")
        now = time.monotonic()
        self._purge_inflight_locked(now)
        ttl = int(task.get("timeout_seconds") or self.INFLIGHT_DEFAULT_TTL)
        deadline = now + max(ttl, self.INFLIGHT_DEFAULT_TTL)
        task["_lease_stop"] = False
        self._start_lease_keepalive(task, max(ttl, self.INFLIGHT_DEFAULT_TTL))
        # The state owner makes the duplicate dispatch check and update indivisible.
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
            # If the TaskManager is unavailable, fall back to a plain bus task so
            # the worker still functions (RPC thread stays unblocked either way).
            ColorPrint.yellow(
                f"[TranslationWorker] TaskManager dispatch failed ({e}); using thread fallback"
            )
            start_bus_task(
                self._process_task,
                task,
                thread_name=f"TranslateTask-{task_id}-Thread",
            )

    # -------------------- introspection --------------------

    def get_status(self) -> Dict[str, Any]:
        """Service status snapshot (read-only, pycore-local state only)."""
        inflight = len(self._inflight)
        return {
            "service": "Translation Worker",
            "worker_id": self.worker_id,
            "processor_types": self._effective_processor_types(),
            "capabilities": self._effective_capabilities(),
            "provider": self.DEFAULT_PROVIDER,
            "inflight_tasks": inflight,
            "done_words_cached": self.done_words_count(),
            "initialized": self._initialized,
            # Circuit breaker: open while the backend persistently rejects results.
            "circuit_open": self._circuit_is_open(),
            "result_5xx_streak": self._result_5xx_streak,
        }


translation_worker_service = TranslationWorkerService(LARAVEL_WORKER_API_URL)
