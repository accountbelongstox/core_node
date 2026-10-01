# -*- coding: utf-8 -*-
"""
TranslationWorkerService + shared persistent worker instance.

The concrete translation worker. Split out of the former
translation_worker_service.py monolith (2252 lines) per the AGENTS.md Modular
rule. Only the worker-specific glue lives here; the shared Laravel result-upload
scaffold is in pyctl/laravel/worker_base.py, lane gating in lane_gating.py, the
word-dedup cache in done_words_cache.py, and the per-lane task processing in
handlers/. No engine logic moved.

Enabled task categories are pulled from Laravel by Pycore even when the UI is
closed. The UI remains the persisted control plane for switches and endpoint
selection.

Public API:
  TranslationWorkerService, translation_worker_service,
  accept_task, get_status, mark_words_done, partition_words, done_words_count.
"""

from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from pycore.pyctl.laravel.worker.handler_worker import LaravelHandlerWorker
import pycore.pyctl.translation.worker.lane_gating as lane_gating
from pycore.pyctl.translation.worker.done_words_cache import DoneWordsCache
import pycore.pyctl.translation.worker.handlers.audio as h_audio
import pycore.pyctl.translation.worker.handlers.media as h_media
import pycore.pyctl.translation.worker.handlers.prompt_translate as h_prompt_translate
import pycore.pyctl.translation.worker.handlers.stt as h_stt
import pycore.pyctl.translation.worker.handlers.translation as h_translation

from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_EXECUTION_TYPES_BY_ROLE,
    GLOBAL_TASK_TYPES_BY_KEY,
    task_execution_type,
    task_types_for_execution,
)


class TranslationWorkerService(LaravelHandlerWorker):
    """
    Translation worker (singleton) processing Laravel typed tasks.

    Lifecycle:
      - The persistent Pycore callback pulls and accepts enabled task types.
      - accept_task() remains available for compatibility RPC callers.
      - Task processing and result upload run on TaskManager background threads.
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
    # The shared fast lane is the contract's remote_fast execution type (there
    # is no "word_media" task type; resolving one fell back to remote_translation).
    TRANSLATION_FAST_PROCESSOR_TYPE = GLOBAL_TASK_EXECUTION_TYPES_BY_ROLE["remote_fast"]
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
    STATE_OWNER_KEY = "translation.worker.state"
    STATE_OWNER_NAME = "TranslationWorkerState"
    WORKER_ID_PREFIX = "pycore-translate"

    DEFAULT_PROVIDER = "google"

    def __init__(self):
        """Initialize the worker (idempotent - safe to call repeatedly)."""
        if getattr(self, "_initialized", False):
            return

        self._init_base_laravel()
        self._init_handler_worker()
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
            f"(worker_id={self.worker_id}, endpoint={self.active_base_url()})"
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

    def _pull_task_types(self) -> List[str]:
        task_types: List[str] = []
        if lane_gating.translation_enabled():
            task_types.append(self.PROMPT_TRANSLATION_TASK_TYPE)
        if lane_gating.subtitle_enabled():
            task_types.append(self.SUBTITLE_TASK_TYPE)
        if lane_gating.stt_enabled():
            task_types.extend(self.STT_TASK_TYPES)
        return list(dict.fromkeys(task_types))

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
        Process one dispatched task and POST its result. Runs on a TaskManager
        background thread (off the RPC thread). Any failure -> POST 'failed'
        so Laravel re-routes/re-pends; nothing is ever silently dropped.

        Dispatch order (unified client) - delegates to the per-lane handlers:
          - task_type == 'subtitle_search'-> media.process_subtitle_search_task
          - task_type == 'prompt_translation' -> prompt_translate.process_prompt_translation_task
          - task_type == 'word_audio' -> audio.process_audio_task
          - task_type == 'sentence_audio' -> audio.process_audio_task
          - task_type in STT_TASK_TYPES   -> stt.process_stt_task
          - anything else                 -> 'failed' (re-route)
        """
        task_id = task.get("task_id")
        try:
            task_type = task.get("task_type")
            capability = task.get("capability")

            if task_type == self.WORD_TRANSLATION_TASK_TYPE or capability in (
                "translate",
                "ai_translate",
                "puter_translate",
            ):
                self._submit_result(
                    task_id,
                    "failed",
                    error="Word translation tasks are handled by Chrome",
                )
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

            if task_type not in (None, ""):
                ColorPrint.yellow(
                    f"[TranslationWorker] Task {task_id} has unsupported "
                    f"task_type '{task_type}' - reporting failed so it can be re-routed"
                )
                self._submit_result(
                    task_id,
                    "failed",
                    error=(
                        f"pycore translation worker does not process "
                        f"task_type={task_type!r}"
                    ),
                )
                return

            self._submit_result(
                task_id,
                "failed",
                error="Untyped translation tasks are handled by Chrome",
            )
        except Exception as e:
            ColorPrint.red(f"[TranslationWorker] Task {task_id} failed: {e}")
            self._submit_result(task_id, "failed", error=str(e))
        finally:
            task["_lease_stop"] = True
            self._release_inflight(task_id)

    def _local_input(self, task: Dict[str, Any]) -> Dict[str, Any]:
        payload = task.get("payload") or {}
        words = h_translation.words_from_payload(payload)
        local_input = super()._local_input(task)
        local_input.update({
            "words": words,
            "content": local_input["content"] or (words[0] if len(words) == 1 else None),
            "content_preview": h_translation.format_words_preview(words) or local_input["content_preview"],
            "md5": payload.get("md5"),
        })
        return local_input

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
            "result_backlog": self._result_backlog(),
            "circuit_open": self.results_blocked(),
        }


translation_worker_service = TranslationWorkerService()
