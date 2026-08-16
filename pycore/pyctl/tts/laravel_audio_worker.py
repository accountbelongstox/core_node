# -*- coding: utf-8 -*-
"""
Persistent TTS audio workers for contract-owned typed queues.

Enabled workers pull and accept typed Laravel tasks without depending on the
React UI lifecycle. The RPC ``accept_task`` route remains as a compatible
manual dispatch surface.

------------------------------------------------------------------------------
Laravel typed pull/accept/result contract
------------------------------------------------------------------------------
  Pull:    GET  /api/worker/tasks/{taskType}/pull
  Accept:  POST /api/worker/tasks/{taskType}/accept
  Result:  POST /api/worker/tasks/{taskType}/result   (processing/completed/failed)

  Task payloads (global_task.payload, delivered by Laravel typed pull):
    word_audio:     {word, content(alias), language, md5, audio_relative_path,
                     accent?, dict_row_id?}
    article_audio:  {content, language, md5}
    sentence_audio: {text, content(alias), language, content_id, variant_key?,
                     accent?, engine_profile?, preferred_engine?}

  File transport (UNCHANGED report endpoints, multipart, field ``audio``):
    word:     POST /api/app_qy_v1/ai_tools/tts/worker/report
              {task_id:int(encoded), worker_id, success, audio|audio_base64,
               provider?, error?}
              task_id = dict_row_id*1000 + typeDigit*100 + langIndex
              (AppQyV1DictionaryTTSCoordinator::encodeTaskId, typeDigit word=1).
              When the payload carries no dict_row_id the domain report is
              skipped and the audio is delivered ONLY through the global task
              result (WordTranslationTaskProcessor ingests translations[]
              audio_base64 fill-missing).
    sentence: POST /api/app_qy_v1/ai_tools/tts/sentence/report
              {content_id, language, worker_id, success, audio|audio_base64,
               variant_key?, accent?, gender?, source?, voice_type?,
               provider?, error?}

  The completed global-task result ALSO carries audio_base64 (the Laravel
  task processors ingest it idempotently, fill-missing), so the audio lands
  even when a domain report endpoint cannot be addressed.

------------------------------------------------------------------------------
Architecture (persistent worker kernel)
------------------------------------------------------------------------------
  * Singleton per lane on top of BaseLaravelWorkerService (result upload with
    retry + circuit breaker).
  * Typed pull or the compatibility accept_task() entry records the task
    type/endpoint, pushes it into ONE shared ordered heap, and starts ONE drain
    (non-reentrant via a THREAD_BUS signal). Serial engines drain on one lane,
    parallel-safe engines fan out to bounded lanes via map_bus_tasks
    (retired-worker pattern).
  * Local caches are honored BEFORE synthesis: word cache
    (pyutils/tts/word_audio_cache.py) and the persistent sentence cache
    (<app_cache>/sentence_audio/<lang>/<content_id>[_variant].mp3 — the local
    retained copy, never deleted). Fresh output is validated with the shared
    validate_mp3 mirror of the server checks and saved to the cache.
  * Logging only via ColorPrint. Networking via laravel_client (lazy
    third-party requests). All imports at file top (PYTHON_PYCORE.md).
"""

import base64
import hashlib
import os
import shutil
import time
from collections import deque
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional, Tuple

# ColorPrint is the only allowed logger in pycore services.
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyfoundations.serialized_worker import (
    map_bus_tasks,
    serialized_method,
    start_bus_task,
)
# Rule §4: all inter-thread data exchange goes through the global bus.
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.system_paths import get_app_cache_dir
# Unified pycore->Laravel HTTP gateway (times + logs + records every request).
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.common.service_config import (
    LARAVEL_WORKER_API_URL,
    TTS_SENTENCE_WORKER_CONCURRENCY,
    TTS_WORKER_CONCURRENCY,
)
from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_CAPABILITIES_BY_ROLE,
    GLOBAL_TASK_PROGRESS_STAGES,
    GLOBAL_TASK_TYPES_BY_KEY,
    QUEUE_CENTER_DIFF_DELIVERY,
    queue_consumer_slice_limit,
    task_execution_type,
    task_types_for_claimant,
)
from pycore.pyctl.assist.assist_settings import assist_capability_enabled
from pycore.pyctl.laravel.worker_base import (
    BaseLaravelWorkerService,
)
from pycore.pyctl.desktop.task_manager import task_manager as shared_task_manager
from pycore.pyctl.task_history.store import append_record
from pycore.pyctl.tts.word_audio_backend_progress import (
    word_audio_backend_progress,
)
# ONE entry point for synthesis; local-first engine priority and edge's
# process-wide serialization live inside the orchestrator.
import pycore.pyutils.tts.tts_orchestrator as tts_orchestrator
from pycore.pyutils.tts.tts_concurrency import (
    effective_concurrency,
    recommended_concurrency,
)
from pycore.pyutils.tts.word_audio_cache import get_cache_path, save_to_cache
from pycore.pyutils.tts.audio_validation import validate_mp3
from pycore.pyutils.tts.qwen.config import ENGINE_NAME as QWEN3TTS_ENGINE
from pycore.pyutils.tts.audio_task_queue import AudioTaskQueue


# --------------------------------------------------------------------------- #
# Constants                                                                    #
# --------------------------------------------------------------------------- #
# Report uploads carry a small MP3; give them room (retired-worker value).
_REPORT_TIMEOUT = 60

# Hard caps so a stuck engine fails the task and frees the lane instead of
# wedging the cycle thread forever (_cycle_signal would never clear otherwise).
_TASK_TIMEOUT_DEFAULT_SECONDS = 300.0
_TASK_TIMEOUT_MAX_SECONDS = 900.0
_TASK_TIMEOUT_GRACE_SECONDS = 30.0
# Bound for ONE parallel synth-lane wait (map_bus_tasks timeout).
_SYNTH_LANE_TIMEOUT_SECONDS = 300.0

# TTL for the cached engine probe (tts_status() probes EVERY engine; far too
# expensive per task). Retired-worker value.
_ENGINE_PROBE_TTL_S = 60.0

_SENTENCE_CONCURRENCY_LIMIT = max(
    1,
    int(QUEUE_CENTER_DIFF_DELIVERY["consumer_batch_limits"]["sentence_audio"]),
)
_SENTENCE_TASK_TIMEOUT_SECONDS = max(
    1,
    int(QUEUE_CENTER_DIFF_DELIVERY["consumer_task_timeout_seconds"]["sentence_audio"]),
)
_UPLOAD_RETRY_INITIAL_SECONDS = max(
    1.0,
    float(QUEUE_CENTER_DIFF_DELIVERY["consumer_upload_retry"]["initial_seconds"]),
)
_UPLOAD_RETRY_MAX_SECONDS = max(
    _UPLOAD_RETRY_INITIAL_SECONDS,
    float(QUEUE_CENTER_DIFF_DELIVERY["consumer_upload_retry"]["maximum_seconds"]),
)
_PROGRESS_TOTAL = 100

# Report task_id codec — MUST mirror
# AppQyV1DictionaryTTSCoordinator::encodeTaskId (append-only registries).
_LANG_INDEX = {
    "en": 1, "zh": 2, "ja": 3, "ko": 4, "vi": 5,
    "lo": 6, "fr": 7, "de": 8, "es": 9,
}
_TYPE_DIGIT_WORD = 1

_SENTENCE_HISTORY_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["sentence_audio"]["key"]


def encode_word_report_task_id(dict_row_id: int, language: str) -> int:
    """Coordinator-encoded word report task id: rowId*1000 + typeDigit*100 + langIndex."""
    lang_index = _LANG_INDEX.get(str(language or "").lower(), 0)
    return int(dict_row_id) * 1000 + _TYPE_DIGIT_WORD * 100 + lang_index


def _run_audio_synth_lane(payload: Dict[str, Any]) -> Dict[str, int]:
    """Drain one synth lane; payload and result travel through THREAD_BUS."""
    worker = payload["worker"]
    processed = succeeded = failed = 0
    while True:
        if worker._lane_halt_requested():
            break
        task = worker._queue.pop()
        if task is None:
            break
        processed += 1
        success = False
        try:
            success = worker._process_claimed(task)
            if success:
                succeeded += 1
            else:
                failed += 1
        finally:
            worker._log_cycle_task_result(task, success)
            worker._queue.complete(task)
    return {
        "processed": processed,
        "succeeded": succeeded,
        "failed": failed,
    }


def _run_single_claimed(payload: Dict[str, Any]) -> bool:
    """Run ONE claimed task on a bus thread (bounded by the caller's timeout)."""
    worker = payload["worker"]
    return bool(worker._process_claimed(payload["task"]))


class BaseLaravelAudioWorker(BaseLaravelWorkerService):
    """Shared word/sentence persistent Laravel audio worker.

    Lane-specific config lives in class attributes; the two concrete singletons
    at the bottom differ ONLY in those attributes. Lifecycle:
      typed pull or compatibility accept_task() -> record type/endpoint + push into
      the shared ordered heap -> start ONE background drain cycle (skipped
      while the previous cycle runs) -> drain by queue order (one serial lane
      or bounded parallel lanes) -> per task: cache check -> synthesize ->
      validate -> domain report upload -> global task result.
    """

    # ---- lane config (overridden by the concrete subclasses) ----
    LANE = "word"
    QUEUE_KEY = "word_audio"
    CAPABILITY = "audio"
    PRIORITY_PROFILE = "word"
    REQUIRED_ENGINE: Optional[str] = None
    ASSIST_CAPABILITY = "tts"
    WORKER_ID_PREFIX = "pycore"
    WORKER_NAME_TAG = "word-audio"
    LOG_PREFIX = "[WordAudioWorker]"
    STATE_OWNER_KEY = "tts.word_audio_worker.state"
    STATE_OWNER_NAME = "WordAudioWorkerState"
    STATE_OWNER_TIMEOUT = 180.0
    REPORT_PATH = "/api/app_qy_v1/ai_tools/tts/worker/report"
    CONCURRENCY_DEFAULT = TTS_WORKER_CONCURRENCY
    CONCURRENCY_LIMIT = 8
    TASK_TIMEOUT_MIN_SECONDS = 0
    BOUNDED_PROCESSING = True
    PROGRESS_EVENTS_ENABLED = False

    def __init__(self, laravel_api_url: str = ""):
        """Initialize the worker (idempotent — safe to call repeatedly)."""
        if getattr(self, "_initialized", False):
            return

        # Shared Laravel-worker scaffold (candidates, api_url, worker_id,
        # circuit/inflight state).
        self._init_base_laravel(laravel_api_url or LARAVEL_WORKER_API_URL)
        self.worker_name = f"pycore-{self.WORKER_NAME_TAG}-{self.worker_id}"
        self._log_prefix = self.LOG_PREFIX

        # 0 = use the per-engine recommended value (pyutils/tts/tts_concurrency).
        self._concurrency = max(0, self.CONCURRENCY_DEFAULT)
        self._speaker = ""

        self._queue = AudioTaskQueue(
            queue_name=self.LANE,
        )

        # ONE drain cycle at a time; lifecycle state is exchanged through THREAD_BUS.
        self._cycle_signal = f"laravel_audio_worker.cycle_running.{self.LANE}"
        THREAD_BUS.signal(self._cycle_signal, False)

        # Engine probe cache (60s TTL) — see _planned_engine().
        self._engine_probe_cache: Optional[str] = None
        self._engine_probe_ts = 0.0

        # Lifetime + live counters (introspection / FE status).
        self._total_claimed = 0
        self._total_succeeded = 0
        self._total_failed = 0
        self._processing = 0
        self._current_tasks: Dict[Any, Dict[str, Any]] = {}
        self._events: Deque[Dict[str, Any]] = deque(maxlen=80)
        self._last_cycle_summary: Dict[str, Any] = {}
        # Throttle marker for the idle event (epoch seconds of the last one).
        self._last_idle_event_ts = 0.0
        # Scratch dir for synthesized/uploaded word MP3s (cleaned per task) and
        # the persistent sentence cache root (retained local copy).
        self._tmp_dir = str(TMP_DIR / "pycore_tts_worker")
        self._cache_dir = str(get_app_cache_dir() / "sentence_audio")

        self._initialized = True
        ColorPrint.green(
            f"{self._log_prefix} Service initialized (worker_id={self.worker_id}, "
            f"enabled={assist_capability_enabled(self.ASSIST_CAPABILITY)})"
        )

    # -------------------- identity / lanes --------------------

    def _effective_processor_types(self) -> List[str]:
        """Audio is claimed only from its queue-position ordered lane."""
        return [task_execution_type(self.QUEUE_KEY)]

    def _effective_capabilities(self) -> List[str]:
        return [GLOBAL_TASK_CAPABILITIES_BY_ROLE[self.CAPABILITY]]

    def _pull_task_types(self) -> List[str]:
        if not self._is_enabled():
            return []
        return self._contract_task_types()

    def _contract_task_types(self) -> List[str]:
        capability = GLOBAL_TASK_CAPABILITIES_BY_ROLE[self.CAPABILITY]
        return list(task_types_for_claimant("pycore", capability))

    def _pull_capacity(self) -> int:
        concurrency, _engine = self._effective_concurrency()
        slice_limit = queue_consumer_slice_limit(self.QUEUE_KEY)
        reserve = max(0, int(QUEUE_CENTER_DIFF_DELIVERY.get("head_reserve") or 0))
        target = max(concurrency, concurrency + max(1, slice_limit) - reserve)
        return max(0, target - self._queue.active_count())

    def _diff_pull_capacity(self) -> int:
        concurrency, _engine = self._effective_concurrency()
        slice_limit = queue_consumer_slice_limit(self.QUEUE_KEY)
        target = concurrency + max(1, slice_limit)
        return max(0, target - self._queue.active_count())

    def _is_enabled(self) -> bool:
        """Lane enable state: the persisted assist capability (UI toggle).

        The persistent pull callback runs only while this toggle is on; this is
        also a defense-in-depth guard on the compatibility accept entry."""
        return assist_capability_enabled(self.ASSIST_CAPABILITY)

    # -------------------- engine probe / concurrency --------------------

    @serialized_method
    def _planned_engine(self) -> Optional[str]:
        """First usable engine in this lane's priority profile (60s TTL cache).

        ``tts_orchestrator.tts_status()`` probes EVERY engine — per-task calls
        stall synthesis on sequential availability checks, so the result is
        cached for _ENGINE_PROBE_TTL_S seconds (retired-worker pattern).
        """
        if self.REQUIRED_ENGINE:
            return self.REQUIRED_ENGINE
        now = time.monotonic()
        if (
            self._engine_probe_cache is not None
            and now - self._engine_probe_ts < _ENGINE_PROBE_TTL_S
        ):
            return self._engine_probe_cache or None
        status = tts_orchestrator.tts_status(refresh=True)
        entries = {
            str(row.get("name") or ""): row
            for row in status.get("engines", [])
            if isinstance(row, dict)
        }
        engine = ""
        for candidate in tts_orchestrator._priority(self.PRIORITY_PROFILE):
            row = entries.get(candidate) or {}
            concurrency_class = self._engine_concurrency_class(candidate)
            usable = bool(row.get("available")) or (
                concurrency_class == "server" and bool(row.get("installed"))
            )
            if not usable or float(row.get("cooldown_remaining") or 0) > 0:
                continue
            engine = candidate
            break
        self._engine_probe_cache = engine
        self._engine_probe_ts = now
        return engine or None

    @staticmethod
    def _engine_concurrency_class(engine: Optional[str]) -> str:
        """Concurrency class of the planned engine; unknown -> serial (safe)."""
        return tts_orchestrator.engine_concurrency(engine or "")

    def _effective_concurrency(self) -> Tuple[int, str]:
        """(effective fan-out, planned engine). Serial engines always give 1."""
        engine = self._planned_engine() or ""
        kind = self._engine_concurrency_class(engine)
        concurrency = effective_concurrency(kind, self.get_concurrency())
        return min(self.CONCURRENCY_LIMIT, concurrency), engine

    def concurrency_status(self) -> Dict[str, Any]:
        """Return cached planning data without probing engines on a status RPC."""
        engine = self.REQUIRED_ENGINE or self._engine_probe_cache or ""
        kind = self._engine_concurrency_class(engine)
        return {
            "concurrency": min(
                self.CONCURRENCY_LIMIT,
                effective_concurrency(kind, self._concurrency),
            ),
            "concurrency_recommended": min(
                self.CONCURRENCY_LIMIT,
                recommended_concurrency(kind),
            ),
            "concurrency_limit": self.CONCURRENCY_LIMIT,
            "concurrency_engine": engine or None,
            "concurrency_class": kind,
        }

    @serialized_method
    def set_concurrency(self, concurrency: int) -> None:
        self._concurrency = max(0, int(concurrency))

    def get_concurrency(self) -> int:
        return self._concurrency

    @serialized_method
    def set_speaker(self, speaker: str) -> None:
        self._speaker = str(speaker or "").strip()

    def get_speaker(self) -> str:
        return self._speaker

    @serialized_method
    def invalidate_engine_plan(self) -> None:
        """Apply a changed engine order on the next worker cycle."""
        self._engine_probe_cache = None
        self._engine_probe_ts = 0.0

    # -------------------- events / counters --------------------

    @serialized_method
    def _log_event(
        self,
        kind: str,
        detail: str,
        info: Optional[Dict[str, Any]] = None,
        mirror: bool = True,
    ) -> None:
        """Append one activity event (newest first) + mirror to the live log."""
        entry: Dict[str, Any] = {
            "at": int(time.time()),
            "kind": kind,
            "detail": (detail or "")[:240],
        }
        if info:
            entry["task_id"] = info.get("task_id")
            entry["task_display_id"] = self._display_task_id(info.get("task_id"))
            entry["language"] = info.get("language")
            if info.get("content_id"):
                entry["content_id"] = info.get("content_id")
            text = (info.get("text") or info.get("word") or "").strip()
            if text:
                entry["text_preview"] = text[:80]
            started = float(info.get("_started_monotonic") or 0.0)
            if started > 0:
                entry["elapsed_seconds"] = round(max(0.0, time.monotonic() - started), 2)
            if "backend_uploaded" in info:
                entry["backend_uploaded"] = bool(info.get("backend_uploaded"))
            if "backend_result_accepted" in info:
                entry["backend_result_accepted"] = bool(info.get("backend_result_accepted"))
            if info.get("stage"):
                entry["stage"] = info.get("stage")
            if info.get("progress") is not None:
                entry["progress"] = int(info.get("progress") or 0)
                entry["progress_total"] = int(
                    info.get("progress_total") or _PROGRESS_TOTAL
                )
            if info.get("current_provider"):
                entry["current_provider"] = info.get("current_provider")
            if self.LANE == "word":
                entry["backend_progress_current"] = int(
                    info.get("backend_progress_current") or 0
                )
                entry["backend_progress_total"] = int(
                    info.get("backend_progress_total") or 0
                )
        self._events.appendleft(entry)
        if not mirror:
            return

        label = f"{self._log_prefix} {kind}"
        if info and info.get("task_id") is not None:
            label += f" task={self._display_task_id(info.get('task_id'))}"
        if info:
            text = str(info.get("text") or info.get("word") or "").strip()
            if text:
                content_label = "word" if self.LANE == "word" else "text"
                label += f" {content_label}={text[:40]!r}"
            if self.LANE == "word":
                backend_progress_current = int(info.get("backend_progress_current") or 0)
                backend_progress_total = int(info.get("backend_progress_total") or 0)
                label += f" progress={backend_progress_current}/{backend_progress_total}"
            elif info.get("progress") is not None:
                progress = int(info.get("progress") or 0)
                progress_total = int(info.get("progress_total") or _PROGRESS_TOTAL)
                label += f" progress={progress}/{progress_total}"
        line = f"{label}: {detail[:160]}" if detail else label
        if kind.endswith("_fail") or kind in ("report_reject", "synth_error"):
            ColorPrint.yellow(line)
        elif kind == "idle":
            ColorPrint.gray(line)
        elif kind in ("synth_done", "task_done"):
            ColorPrint.green(line)
        else:
            ColorPrint.blue(line)

    @serialized_method
    def _mark_task_started(self, task_id: Any, info: Dict[str, Any]) -> None:
        current = dict(info)
        current["_started_monotonic"] = time.monotonic()
        current["stage"] = "accepted"
        current["progress"] = GLOBAL_TASK_PROGRESS_STAGES["accepted"]
        current["progress_total"] = _PROGRESS_TOTAL
        current["task_display_id"] = self._display_task_id(task_id)
        current["backend_uploaded"] = False
        current["backend_result_accepted"] = False
        info["_started_monotonic"] = current["_started_monotonic"]
        info["stage"] = current["stage"]
        info["progress"] = current["progress"]
        info["progress_total"] = current["progress_total"]
        info["backend_uploaded"] = False
        info["backend_result_accepted"] = False
        current_key = self._current_task_key(task_id, info.get("attempt"))
        self._current_tasks[current_key] = current
        self._processing += 1

    @serialized_method
    def _mark_task_progress(
        self,
        task_id: Any,
        stage: str,
        progress: int,
        provider: str = "",
        attempt: Optional[int] = None,
    ) -> bool:
        current = self._current_tasks.get(self._current_task_key(task_id, attempt))
        if current is None:
            return False
        changed = current.get("stage") != stage or current.get("progress") != progress
        current["stage"] = stage
        current["progress"] = progress
        current["backend_uploaded"] = stage in ("finalizing", "completed")
        if provider:
            changed = changed or current.get("current_provider") != provider
            current["current_provider"] = provider
        return changed

    @serialized_method
    def _mark_backend_result(
        self,
        task_id: Any,
        accepted: bool,
        attempt: Optional[int] = None,
    ) -> None:
        current = self._current_tasks.get(self._current_task_key(task_id, attempt))
        if current is not None:
            current["backend_result_accepted"] = bool(accepted)

    @serialized_method
    def _mark_task_finished(self, task_id: Any, attempt: Optional[int] = None) -> None:
        self._current_tasks.pop(self._current_task_key(task_id, attempt), None)
        self._processing = max(0, self._processing - 1)

    @staticmethod
    def _current_task_key(task_id: Any, attempt: Optional[int]) -> str:
        return f"{task_id}:{max(0, int(attempt or 0))}"

    @serialized_method
    def _record_cycle(self, processed: int, succeeded: int, failed: int) -> Dict[str, Any]:
        self._total_claimed += processed
        self._total_succeeded += succeeded
        self._total_failed += failed
        self._last_cycle_summary = {
            "processed": processed,
            "succeeded": succeeded,
            "failed": failed,
            "at": int(time.time()),
        }
        return dict(self._last_cycle_summary)

    def _state_snapshot(self) -> Dict[str, Any]:
        """Read the current counters without entering the worker queue."""
        try:
            current_tasks = []
            now = time.monotonic()
            for task in list(self._current_tasks.values()):
                current = dict(task)
                started = float(current.pop("_started_monotonic", 0.0) or 0.0)
                current["elapsed_seconds"] = round(max(0.0, now - started), 2) if started else 0.0
                current_tasks.append(current)
        except RuntimeError:
            current_tasks = []
        return {
            "processing": self._processing,
            "current_tasks": current_tasks,
            "events": [dict(event) for event in list(self._events)[:40]],
            "total_claimed": self._total_claimed,
            "total_succeeded": self._total_succeeded,
            "total_failed": self._total_failed,
            "last_cycle": dict(self._last_cycle_summary),
        }

    # -------------------- inflight guard --------------------

    @serialized_method
    def _claim_inflight(self, task: Dict[str, Any]) -> bool:
        """Mark one task in-flight; False when a duplicate is already running.

        Entries carry a deadline (now + task.timeout_seconds, default
        INFLIGHT_DEFAULT_TTL) and expired entries are purged before the check,
        so a re-offered task (after Laravel's lease timeout) can be claimed
        again even if an earlier executor hung (base pattern).
        """
        now = time.monotonic()
        expired = [tid for tid, dl in list(self._inflight.items()) if dl <= now]
        for tid in expired:
            self._inflight.pop(tid, None)
        task_key = self._task_execution_key(task)
        if task_key in self._inflight:
            return False
        ttl = int(task.get("timeout_seconds") or self.INFLIGHT_DEFAULT_TTL)
        self._inflight[task_key] = now + max(ttl, self.INFLIGHT_DEFAULT_TTL)
        return True

    @serialized_method
    def _release_inflight(self, task: Dict[str, Any]) -> None:
        self._inflight.pop(self._task_execution_key(task), None)

    @staticmethod
    def _task_attempt(task: Dict[str, Any]) -> int:
        raw_attempt = task.get("retry_count")
        return max(0, int(raw_attempt)) if isinstance(raw_attempt, int) else 0

    @classmethod
    def _task_execution_key(cls, task: Dict[str, Any]) -> str:
        return f"{task.get('task_id')}:{cls._task_attempt(task)}"

    # -------------------- payload normalization --------------------

    def _accepts_task(self, task: Dict[str, Any]) -> bool:
        """Lane guard: a mis-tagged task of another lane is reported failed so
        Laravel re-routes it, never silently processed with the wrong shape."""
        task_type = str(task.get("task_type") or "")
        return task_type in self._contract_task_types()

    def _normalize(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Tolerate missing optional fields; required-field gaps become an
        ``error`` entry the caller reports as a failed task."""
        payload = task.get("payload") if isinstance(task.get("payload"), dict) else {}
        task_type = str(task.get("task_type") or "")
        language = (str(payload.get("language") or "en").strip() or "en").lower()
        info: Dict[str, Any] = {
            "task_id": task.get("task_id"),
            "task_type": task_type,
            "attempt": self._task_attempt(task),
            "queue_position": task.get("queue_position"),
            "language": language,
        }

        if self.LANE == "sentence":
            text = str(payload.get("text") or payload.get("content") or "").strip()
            content_id = str(
                payload.get("content_id") or payload.get("hash") or ""
            ).strip()
            info.update({
                "kind": "sentence",
                "text": text,
                "content_id": content_id,
                "variant_key": str(payload.get("variant_key") or "").strip(),
                "accent": str(payload.get("accent") or "").strip() or None,
                # The sentence profile keeps the retired worker's default voice.
                "gender": "female",
                "engine_profile": str(payload.get("engine_profile") or "").strip() or None,
                "preferred_engine": str(payload.get("preferred_engine") or "").strip() or None,
                "speaker": str(payload.get("speaker") or self._speaker or "").strip() or None,
            })
            if not text:
                info["error"] = "sentence_audio payload carried no text"
            elif not content_id:
                info["error"] = "sentence_audio payload carried no content_id"
            return info

        if task_type != self.QUEUE_KEY:
            # article_audio shares the remote_audio lane: plain content synth,
            # no domain report endpoint (the result carries audio_base64).
            text = str(payload.get("content") or payload.get("text") or "").strip()
            info.update({
                "kind": "article",
                "text": text,
                "accent": str(payload.get("accent") or "").strip() or None,
                "gender": str(payload.get("gender") or "").strip() or None,
            })
            if not text:
                info["error"] = f"{task_type} payload carried no content"
            return info

        word = str(payload.get("word") or payload.get("content") or "").strip()
        md5 = str(payload.get("md5") or "").strip()
        if not md5 and word:
            md5 = hashlib.md5(word.encode("utf-8")).hexdigest()
        dict_row_id: Optional[int] = None
        raw_row_id = payload.get("dict_row_id")
        if raw_row_id not in (None, ""):
            try:
                dict_row_id = int(raw_row_id)
            except (TypeError, ValueError):
                dict_row_id = None
        info.update({
            "kind": "word",
            "word": word,
            "text": word,
            "md5": md5,
            "accent": str(payload.get("accent") or "").strip() or None,
            "gender": str(payload.get("gender") or "").strip() or None,
            "dict_row_id": dict_row_id,
        })
        if not word:
            info["error"] = "word_audio payload carried no word/content"
        return info

    # -------------------- cache + synthesis --------------------

    def _sentence_cache_path(self, info: Dict[str, Any]) -> str:
        """Persistent cache path scoped by content, variant, and required engine."""
        key = (info.get("content_id") or "audio").strip()
        vkey = (info.get("variant_key") or "").strip()
        suffix = f"_{vkey}" if vkey else ""
        engine_suffix = f"_{self.REQUIRED_ENGINE}" if self.REQUIRED_ENGINE else ""
        speaker = str(info.get("speaker") or "").strip()
        speaker_suffix = f"_{hashlib.sha1(speaker.encode('utf-8')).hexdigest()[:10]}" if speaker else ""
        return os.path.join(
            self._cache_dir,
            info["language"],
            f"{key}{suffix}{engine_suffix}{speaker_suffix}.mp3",
        )

    def _resolve_audio(self, info: Dict[str, Any]) -> Tuple[bool, str, str, str, bool]:
        """Generate (or reuse) one task's MP3.

        Returns ``(ok, audio_path, provider, error, cleanup)``. ``cleanup``
        marks a scratch file the caller must delete; cache files are retained.
        The local validation mirrors the server so invalid output becomes a
        failure REPORT, not a doomed upload.
        """
        kind = info["kind"]
        language = info["language"]
        accent = info.get("accent") or None

        if kind == "sentence":
            out_path = self._sentence_cache_path(info)
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            # Cache hit -> report straight from disk (no re-synth).
            if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
                ok_cache, _why = validate_mp3(out_path)
                if ok_cache:
                    return True, out_path, self.REQUIRED_ENGINE or "cache", "", False
            result = tts_orchestrator.synthesize(
                info["text"],
                language,
                Path(out_path),
                accent=accent,
                gender=info.get("gender") or None,
                priority_profile=self.PRIORITY_PROFILE,
                required_engine=self.REQUIRED_ENGINE,
                speaker=info.get("speaker"),
                client_job_id=(
                    f"queue-center:{info.get('task_id')}:{info.get('attempt', 0)}"
                ),
            )
            provider = result.get("engine") or ((result.get("tried") or ["none"])[-1])
            if not result.get("success"):
                return False, out_path, provider, result.get("error") or "synthesis failed", False
            ok, why = validate_mp3(out_path)
            if not ok:
                return False, out_path, provider, f"invalid audio from {provider}: {why}", False
            return True, out_path, provider, "", False

        # word / article: scratch output (the word lane also fills the word cache).
        planned_engine = self._planned_engine() or "edge"
        if kind == "word":
            cache_path = get_cache_path(info["word"], language, planned_engine)
            if os.path.exists(cache_path) and os.path.getsize(cache_path) > 0:
                ok_cache, _why = validate_mp3(cache_path)
                if ok_cache:
                    os.makedirs(self._tmp_dir, exist_ok=True)
                    out_path = os.path.join(
                        self._tmp_dir, f"{info.get('task_id')}_{info.get('md5') or 'audio'}.mp3"
                    )
                    shutil.copy2(cache_path, out_path)
                    return True, out_path, planned_engine, "", True

        os.makedirs(self._tmp_dir, exist_ok=True)
        out_path = os.path.join(
            self._tmp_dir, f"{info.get('task_id')}_{info.get('md5') or 'audio'}.mp3"
        )
        profile = self.PRIORITY_PROFILE if kind == "word" else "sentence"
        result = tts_orchestrator.synthesize(
            info["text"],
            language,
            Path(out_path),
            accent=accent,
            gender=info.get("gender") or None,
            priority_profile=profile,
        )
        provider = result.get("engine") or ((result.get("tried") or ["none"])[-1])
        if not result.get("success"):
            return False, out_path, provider, result.get("error") or "synthesis failed", True
        ok, why = validate_mp3(out_path)
        if not ok:
            return False, out_path, provider, f"invalid audio from {provider}: {why}", True
        if kind == "word":
            save_to_cache(info["word"], language, provider, out_path)
        return True, out_path, provider, "", True

    # -------------------- domain report endpoints (file transport) --------------------

    def _report_fields(self, info: Dict[str, Any], success: bool, provider: str, error: str = "") -> Dict[str, str]:
        """Exact multipart field set of this lane's report endpoint (validators:
        AppQyV1TTSWorkerController::report / AppQyV1SentenceAudioController::report)."""
        if self.LANE == "sentence":
            fields = {
                "content_id": str(info.get("content_id") or ""),
                "language": str(info.get("language") or "en"),
                "worker_id": self.worker_id,
                "success": "true" if success else "false",
                "provider": provider or "none",
            }
            if info.get("variant_key"):
                fields["variant_key"] = str(info["variant_key"])
            if info.get("accent"):
                fields["accent"] = str(info["accent"])
            if info.get("gender"):
                fields["gender"] = str(info["gender"])
            fields["source"] = "tts"
            fields["voice_type"] = "neural" if provider in ("edge", "azure") else "machine"
        else:
            fields = {
                "task_id": str(encode_word_report_task_id(info["dict_row_id"], info["language"])),
                "worker_id": self.worker_id,
                "success": "true" if success else "false",
                "provider": provider or "none",
            }
        if not success:
            fields["error"] = (error or "unknown error")[:500]
        return fields

    def _post_report(
        self,
        info: Dict[str, Any],
        success: bool,
        provider: str,
        error: str = "",
        audio_path: str = "",
    ) -> Tuple[bool, str]:
        """POST this lane's report endpoint (multipart upload on success,
        fields-only on failure). Returns ``(accepted, detail)``; never raises."""
        fields = self._report_fields(info, success, provider, error)
        report_base_url = self._task_base_url(info.get("task_id"))
        try:
            if success:
                with open(audio_path, "rb") as fh:
                    resp = laravel_client.post(
                        self.REPORT_PATH,
                        base_url=report_base_url,
                        data=fields,
                        files={"audio": (os.path.basename(audio_path), fh, "audio/mpeg")},
                        timeout=_REPORT_TIMEOUT,
                    )
            else:
                resp = laravel_client.post(
                    self.REPORT_PATH,
                    base_url=report_base_url,
                    data=fields,
                    timeout=_REPORT_TIMEOUT,
                )
        except Exception as e:
            return False, self._short_err(e)
        if resp.status_code == 200:
            return True, "ok"
        if resp.status_code == 422:
            return False, f"server validation rejected: {resp.text[:200]}"
        if resp.status_code == 404:
            return False, "unknown task on server (404)"
        return False, f"HTTP {resp.status_code}: {resp.text[:200]}"

    def _upload_report(self, info: Dict[str, Any], provider: str, audio_path: str) -> Optional[Tuple[bool, str]]:
        """Upload the MP3 to the domain report endpoint.

        Returns ``(ok, detail)``, or None when the lane has no addressable
        domain endpoint for this task (word without dict_row_id, article) —
        the audio then travels ONLY inside the global task result.
        """
        if self.LANE == "sentence":
            return self._post_report(info, True, provider, audio_path=audio_path)
        if info["kind"] != "word" or not info.get("dict_row_id"):
            return None
        return self._post_report(info, True, provider, audio_path=audio_path)

    def _set_task_progress(
        self,
        info: Dict[str, Any],
        stage: str,
        provider: str = "",
    ) -> int:
        progress = int(GLOBAL_TASK_PROGRESS_STAGES[stage])
        info["stage"] = stage
        info["progress"] = progress
        info["progress_total"] = _PROGRESS_TOTAL
        info["backend_uploaded"] = stage in ("finalizing", "completed")
        if provider:
            info["current_provider"] = provider
        changed = self._mark_task_progress(
            info.get("task_id"),
            stage,
            progress,
            provider,
            info.get("attempt"),
        )
        if changed and self.PROGRESS_EVENTS_ENABLED and stage != "completed":
            self._log_event(
                "progress",
                stage,
                info,
                mirror=self.LANE != "word",
            )
        return progress

    def _report_progress(
        self,
        info: Dict[str, Any],
        stage: str,
        provider: str = "",
    ) -> bool:
        task_id = info.get("task_id")
        progress = self._set_task_progress(info, stage, provider)
        result = {
            "stage": stage,
            "engine": provider or self.REQUIRED_ENGINE or self._planned_engine(),
            "backend_uploaded": stage in ("finalizing", "completed"),
        }
        if self.LANE == "sentence" and self._speaker:
            result["speaker"] = self._speaker
        return self._post_result(
            task_id,
            "processing",
            result=result,
            progress=progress,
            attempts=1,
            attempt=info.get("attempt"),
        )

    def _upload_report_until_accepted(
        self,
        info: Dict[str, Any],
        provider: str,
        audio_path: str,
    ) -> Tuple[bool, str]:
        """Retry the durable backend audio upload until accepted or shutdown."""
        attempt = 0
        delay = _UPLOAD_RETRY_INITIAL_SECONDS
        while not THREAD_BUS.is_shutdown_requested():
            attempt += 1
            uploaded = self._upload_report(info, provider, audio_path)
            if uploaded is None:
                info["backend_uploaded"] = True
                return True, "not_required"
            if uploaded[0]:
                info["backend_uploaded"] = True
                self._log_event(
                    "upload_done",
                    f"backend accepted audio (attempt={attempt})",
                    info,
                    mirror=self.LANE != "word",
                )
                return True, uploaded[1]
            info["backend_uploaded"] = False
            self._log_event(
                "upload_retry",
                f"attempt={attempt} retry_in={delay:.0f}s error={uploaded[1]}",
                info,
            )
            self._report_progress(
                info,
                "uploading",
                provider,
            )
            time.sleep(delay)
            delay = min(_UPLOAD_RETRY_MAX_SECONDS, delay * 2)
        return False, "shutdown requested before backend upload completed"

    def _post_completed_until_accepted(
        self,
        info: Dict[str, Any],
        result: Dict[str, Any],
        provider: str,
    ) -> bool:
        """Retry the terminal Queue Center result until accepted or ownership is lost."""
        task_id = info.get("task_id")
        delay = _UPLOAD_RETRY_INITIAL_SECONDS
        attempt = 0
        while not THREAD_BUS.is_shutdown_requested():
            attempt += 1
            if self._post_result(
                task_id,
                "completed",
                result=result,
                progress=100,
                attempt=info.get("attempt"),
            ):
                info["backend_result_accepted"] = True
                self._mark_backend_result(task_id, True, info.get("attempt"))
                self._set_task_progress(info, "completed", provider)
                return True
            info["backend_result_accepted"] = False
            self._mark_backend_result(task_id, False, info.get("attempt"))
            if str(task_id) not in self._task_type_by_id:
                self._log_event(
                    "result_reassigned",
                    "completed result stopped because task ownership changed",
                    info,
                )
                return False
            self._log_event(
                "result_retry",
                f"attempt={attempt} retry_in={delay:.0f}s",
                info,
            )
            self._report_progress(
                info,
                "finalizing",
                provider,
            )
            time.sleep(delay)
            delay = min(_UPLOAD_RETRY_MAX_SECONDS, delay * 2)
        return False

    def _report_failure(self, info: Optional[Dict[str, Any]], provider: str, error: str) -> None:
        """Best-effort domain failure report so the canonical row fails fast
        instead of waiting out its lock (retired-worker behavior)."""
        if not info:
            return
        if self.LANE != "sentence" and (info.get("kind") != "word" or not info.get("dict_row_id")):
            return
        try:
            accepted, detail = self._post_report(info, False, provider, error=error)
            if not accepted:
                ColorPrint.yellow(
                    f"{self._log_prefix} Failure report for task "
                    f"{self._display_task_id(info.get('task_id'))} "
                    f"not accepted ({detail})"
                )
        except Exception as e:  # noqa: BLE001 — failure reporting is best-effort
            ColorPrint.yellow(f"{self._log_prefix} Failure report error: {e}")

    # -------------------- global task result --------------------

    def _build_success_result(self, info: Dict[str, Any], provider: str, audio_path: str) -> Dict[str, Any]:
        """Completed-result body; carries audio_base64 so the Laravel task
        processor can ingest the audio idempotently (fill-missing) even when
        the domain report endpoint was not addressable."""
        with open(audio_path, "rb") as fh:
            audio_base64 = base64.b64encode(fh.read()).decode("ascii")

        if self.LANE == "sentence":
            result: Dict[str, Any] = {
                "audio_base64": audio_base64,
                "mime": "audio/mpeg",
                "provider": provider,
                "source": "tts",
                "voice_type": "neural" if provider in ("edge", "azure") else "machine",
            }
            for field in ("variant_key", "accent", "gender"):
                value = info.get(field)
                if value:
                    result[field] = value
            if info.get("speaker"):
                result["speaker"] = info["speaker"]
            return result

        if info["kind"] == "article":
            return {
                "audio_base64": audio_base64,
                "mime": "audio/mpeg",
                "provider": provider,
            }

        return {
            "translations": [{
                "word": info["word"],
                "md5": info.get("md5") or "",
                "audio_base64": audio_base64,
                "audio_mime": "audio/mpeg",
                "provider": provider,
                "accent": info.get("accent") or "unknown",
            }],
            "provider": provider,
        }

    # -------------------- per-task processing --------------------

    def _process_claimed(self, task: Dict[str, Any]) -> bool:
        """Inflight-guard + process one queued task (lane entry point)."""
        if not self._claim_inflight(task):
            ColorPrint.gray(
                f"{self._log_prefix} Task {self._display_task_id(task.get('task_id'))} "
                "already in flight - skipping duplicate"
            )
            return True
        try:
            return self._process_task(task)
        finally:
            self._release_inflight(task)

    def _process_task(self, task: Dict[str, Any]) -> bool:
        """Synthesize + upload + complete ONE claimed task. Runs on a lane
        thread (off the heartbeat thread). Any failure -> POST 'failed' so
        Laravel re-routes/re-pends; nothing is ever silently dropped."""
        task_id = task.get("task_id")
        info: Optional[Dict[str, Any]] = None
        local_id: Optional[str] = None
        try:
            if self.LANE == "sentence" and not str(task.get("task_type") or "").strip():
                task["task_type"] = self.QUEUE_KEY
            # The UI may dispatch a backlog larger than the bounded registry.
            # Re-register at execution time from the queued task itself so all
            # progress and terminal posts always retain their typed route.
            task_base_url = str(
                task.get("_laravel_base_url") or self._task_base_url(task_id)
            ).strip()
            self._remember_task_types([task], task_base_url)
            if not self._accepts_task(task):
                ColorPrint.yellow(
                    f"{self._log_prefix} Task {self._display_task_id(task_id)} has unsupported "
                    f"task_type {task.get('task_type')!r} / capability "
                    f"{task.get('capability')!r} - reporting failed so it can be re-routed"
                )
                self._post_result(
                    task_id,
                    "failed",
                    error=(
                        f"pycore {self.LANE} audio worker only processes "
                        f"{self._contract_task_types()} tasks "
                        f"(got task_type={task.get('task_type')!r})"
                    ),
                    attempt=self._task_attempt(task),
                )
                return False

            info = self._normalize(task)
            if self.LANE == "word":
                backend_progress = word_audio_backend_progress.snapshot()
                info["backend_progress_current"] = int(
                    backend_progress.get("current") or 0
                )
                info["backend_progress_total"] = int(
                    backend_progress.get("total") or 0
                )
            if info.get("error"):
                self._report_failure(info, "none", info["error"])
                self._post_result(
                    task_id,
                    "failed",
                    error=info["error"],
                    attempt=info.get("attempt"),
                )
                self._log_event("synth_fail", info["error"], info)
                return False

            self._mark_task_started(task_id, info)
            order_detail = f"queue_position={task.get('queue_position')}"
            self._log_event(
                "synth_start",
                order_detail,
                info,
                mirror=self.LANE != "word",
            )
            if self.LANE == "sentence":
                local_id = self._begin_local_task(info)
            self._report_progress(
                info,
                "synthesizing",
                self.REQUIRED_ENGINE or "",
            )

            ok, audio_path, provider, err, cleanup = self._resolve_audio(info)
            task["_terminal_provider"] = provider
            try:
                if not ok:
                    self._report_failure(info, provider, err)
                    self._post_result(
                        task_id,
                        "failed",
                        error=err,
                        attempt=info.get("attempt"),
                    )
                    self._log_event("synth_fail", err, info)
                    self._finish_local_task(local_id, False, provider=provider, error=err)
                    return False

                self._report_progress(
                    info,
                    "uploading",
                    provider,
                )
                uploaded, detail = self._upload_report_until_accepted(info, provider, audio_path)
                if not uploaded:
                    self._report_failure(info, provider, f"audio upload rejected: {detail}")
                    self._post_result(
                        task_id,
                        "failed",
                        error=f"audio upload failed: {detail}",
                        attempt=info.get("attempt"),
                    )
                    self._log_event("report_reject", detail, info)
                    self._finish_local_task(local_id, False, provider=provider, error=detail)
                    return False

                self._report_progress(
                    info,
                    "finalizing",
                    provider,
                )
                result = self._build_success_result(info, provider, audio_path)
                posted = self._post_completed_until_accepted(info, result, provider)
                self._log_event(
                    "synth_done",
                    f"via {provider}; backend_upload=ok; result={'ok' if posted else 'not_accepted'}",
                    info,
                    mirror=self.LANE != "word",
                )
                self._append_history(info, provider, audio_path)
                self._finish_local_task(
                    local_id, True, provider=provider, audio_path=audio_path,
                    text=(info.get("text") or "")[:120], language=info.get("language") or "",
                )
                return posted
            finally:
                if cleanup and audio_path:
                    try:
                        os.remove(audio_path)
                    except OSError:
                        pass
        except Exception as e:  # noqa: BLE001 — one task must not kill the cycle
            ColorPrint.red(
                f"{self._log_prefix} Task {self._display_task_id(task_id)} error: {e}"
            )
            self._post_result(
                task_id,
                "failed",
                error=str(e),
                attempt=self._task_attempt(task),
            )
            self._finish_local_task(local_id, False, error=str(e))
            return False
        finally:
            if info is not None:
                self._mark_task_finished(task_id, info.get("attempt"))

    # -------------------- TaskManager / history (sentence lane, UI parity) --------------------

    def _begin_local_task(self, info: Dict[str, Any]) -> Optional[str]:
        """Register one sentence job in pyctl TaskManager for the task-queue tab."""
        try:
            preview = (info.get("text") or "")[:120]
            local_id = shared_task_manager.create_task(
                task_type=_SENTENCE_HISTORY_TASK_TYPE,
                input_data={
                    "remote_task_id": info.get("task_id"),
                    "content_id": info.get("content_id"),
                    "content": (info.get("text") or "")[:500] or None,
                    "content_preview": preview or None,
                    "language": info.get("language"),
                    "queue_position": info.get("queue_position"),
                    "_worker": "tts_sentence_worker",
                },
            )
            shared_task_manager.patch_task(
                local_id,
                progress=5,
                status="processing",
                result_patch={
                    "remote_task_id": info.get("task_id"),
                    "text": preview,
                    "language": info.get("language"),
                },
            )
            return local_id
        except Exception:  # noqa: BLE001 — TaskManager is best-effort for UI
            return None

    def _finish_local_task(
        self,
        local_id: Optional[str],
        success: bool,
        *,
        provider: str = "",
        error: str = "",
        audio_path: str = "",
        text: str = "",
        language: str = "",
    ) -> None:
        if not local_id:
            return
        try:
            if success:
                shared_task_manager.complete_task(local_id, {
                    "ok": True,
                    "provider": provider or None,
                    "engine": provider or None,
                    "audio_path": audio_path or None,
                    "text": text or None,
                    "language": language or None,
                })
            else:
                shared_task_manager.fail_task(local_id, error or "synthesis or upload failed")
        except Exception:  # noqa: BLE001
            pass

    def _append_history(self, info: Dict[str, Any], provider: str, audio_path: str) -> None:
        """Sentence-lane completed-history record (retired-worker parity)."""
        if self.LANE != "sentence":
            return
        try:
            append_record({
                "task_type": _SENTENCE_HISTORY_TASK_TYPE,
                "worker": "tts_sentence_worker",
                "title": (info.get("text") or "")[:120],
                "content": info.get("text"),
                "language": info.get("language"),
                "success": True,
                "detail": {
                    "provider": provider,
                    "engine": provider,
                    "audio_path": audio_path,
                    "queue_position": info.get("queue_position"),
                    "variant_key": info.get("variant_key") or "",
                    "accent": info.get("accent"),
                    "gender": info.get("gender"),
                    "source": "tts",
                    "text": (info.get("text") or "")[:120],
                },
            })
        except Exception:  # noqa: BLE001
            pass

    # -------------------- RPC accept entry / drain cycle --------------------

    def _log_cycle_task_result(self, task: Dict[str, Any], success: bool) -> None:
        """Write one compact terminal line with canonical backend-table progress."""
        if self.LANE != "word":
            return
        backend_progress = word_audio_backend_progress.record_result(success)
        payload = task.get("payload") if isinstance(task.get("payload"), dict) else {}
        word = str(payload.get("word") or payload.get("content") or "").strip()
        language = str(payload.get("language") or "en").strip().lower() or "en"
        provider = str(task.get("_terminal_provider") or "").strip()
        info: Dict[str, Any] = {
            "task_id": task.get("task_id"),
            "word": word,
            "text": word,
            "language": language,
            "stage": "completed" if success else "failed",
            "progress": _PROGRESS_TOTAL if success else 0,
            "progress_total": _PROGRESS_TOTAL,
            "backend_progress_current": int(backend_progress.get("current") or 0),
            "backend_progress_total": int(backend_progress.get("total") or 0),
        }
        if provider:
            info["current_provider"] = provider
        detail = f"via {provider}" if success and provider else (
            "completed" if success else "failed"
        )
        self._log_event("task_done" if success else "task_fail", detail, info)

    def set_cached_task_head(self, task_id: Any, queue_position: int) -> None:
        """Apply one queue-head ticket to persistent and in-process caches."""
        super().set_cached_task_head(task_id, queue_position)
        self._queue.move_to_head(task_id, queue_position)

    def accept_task(self, task: Dict[str, Any], base_url: str = "") -> Dict[str, Any]:
        """Queue one typed-pull or compatibility-RPC task for synthesis.

        The task type and Laravel base URL are recorded for the typed result
        route. Exception-safe so compatibility RPC callers are not interrupted.
        """
        if not isinstance(task, dict) or task.get("task_id") in (None, ""):
            return {"success": False, "error": "task with task_id is required"}
        if not self._is_enabled() or self._lane_halt_requested():
            return {"success": False, "error": f"{self.LANE} audio lane is disabled"}
        try:
            endpoint = (base_url or "").strip() or self.api_url
            queued_task = dict(task)
            if self.LANE == "sentence" and not str(queued_task.get("task_type") or "").strip():
                queued_task["task_type"] = self.QUEUE_KEY
            if self._queue.contains(queued_task):
                return {
                    "success": True,
                    "task_id": task.get("task_id"),
                    "duplicate": True,
                }
            concurrency, _engine = self._effective_concurrency()
            local_load = self._queue.active_count()
            slice_limit = queue_consumer_slice_limit(self.QUEUE_KEY)
            local_capacity = concurrency + max(1, slice_limit)
            if local_load >= local_capacity:
                return {
                    "success": False,
                    "retryable": True,
                    "error": f"{self.LANE} audio worker is at configured concurrency capacity",
                    "capacity": local_capacity,
                    "queued": len(self._queue),
                    "processing": max(0, int(self._processing)),
                }
            queued_task["_laravel_base_url"] = endpoint
            self._remember_task_types([queued_task], endpoint)
            queued = self._queue.push(queued_task)
            self._start_drain()
            return {
                "success": True,
                "task_id": task.get("task_id"),
                "duplicate": not queued,
            }
        except Exception as e:  # noqa: BLE001 — RPC entry must never raise
            ColorPrint.red(f"{self._log_prefix} accept_task error: {e}")
            return {"success": False, "error": str(e)}

    def _start_drain(self) -> None:
        """Spawn ONE background drain cycle (non-reentrant via the cycle signal)."""
        if THREAD_BUS.is_shutdown_requested():
            return
        if THREAD_BUS.get_signal(self._cycle_signal, False):
            return  # previous cycle still in flight — it drains the whole heap
        THREAD_BUS.signal(self._cycle_signal, True)
        try:
            start_bus_task(self._drain_cycle, thread_name=f"{self.LANE}-audio-worker-cycle")
        except Exception as e:  # noqa: BLE001
            THREAD_BUS.signal(self._cycle_signal, False)
            ColorPrint.red(f"{self._log_prefix} drain start error: {e}")

    def _task_time_cap(self, task: Dict[str, Any]) -> float:
        """Hard cap for ONE queued task: the server-side timeout_seconds
        (bounded to a sane ceiling) plus a small grace for the result upload."""
        try:
            server_cap = float((task or {}).get("timeout_seconds") or 0)
        except (TypeError, ValueError):
            server_cap = 0.0
        if server_cap <= 0:
            server_cap = _TASK_TIMEOUT_DEFAULT_SECONDS
        server_cap = max(server_cap, float(self.TASK_TIMEOUT_MIN_SECONDS))
        return min(server_cap, _TASK_TIMEOUT_MAX_SECONDS) + _TASK_TIMEOUT_GRACE_SECONDS

    def _process_claimed_bounded(self, task: Dict[str, Any]) -> bool:
        """Process ONE queued task on a bus thread under a hard time cap.

        A stuck engine must fail the task and free the lane — an unbounded
        inline call would wedge the cycle thread and _cycle_signal would never
        clear, killing the lane until restart."""
        if not self.BOUNDED_PROCESSING:
            return self._process_claimed(task)
        cap = self._task_time_cap(task)
        try:
            results = map_bus_tasks(
                _run_single_claimed,
                [{"worker": self, "task": task}],
                max_workers=1,
                thread_prefix=f"{self.LANE.title()}AudioTask",
                timeout=cap,
            )
        except Exception as e:  # noqa: BLE001 — hard cap or lane failure
            ColorPrint.red(
                f"{self._log_prefix} Task exceeded its {cap:.0f}s hard cap "
                f"({e}); failing it to free the lane"
            )
            return False
        return bool(results and results[0])

    def _drop_queued_tasks(self) -> List[Dict[str, Any]]:
        """Pop every queued-but-unstarted heap task for an immediate stop."""
        dropped: List[Dict[str, Any]] = []
        while True:
            task = self._queue.pop()
            if task is None:
                break
            self._queue.complete(task)
            dropped.append(task)
        return dropped

    def _drain_cycle(self) -> None:
        """One ordered drain cycle over the local dispatch heap. Runs on a
        background bus thread and is fully exception-safe."""
        processed = succeeded = failed = 0
        try:
            if len(self._queue) == 0:
                return

            concurrency, engine = self._effective_concurrency()
            if concurrency > 1 and len(self._queue) > 1:
                self._log_event("parallel", f"fan-out x{concurrency} (engine={engine or '?'})")
                payloads = [{"worker": self} for _index in range(concurrency)]
                results = map_bus_tasks(
                    _run_audio_synth_lane,
                    payloads,
                    max_workers=concurrency,
                    thread_prefix=f"{self.LANE.title()}AudioSynth",
                    timeout=_SYNTH_LANE_TIMEOUT_SECONDS,
                )
                for result in results:
                    processed += int(result.get("processed") or 0)
                    succeeded += int(result.get("succeeded") or 0)
                    failed += int(result.get("failed") or 0)
            else:
                while True:
                    if self._lane_halt_requested():
                        break
                    task = self._queue.pop()
                    if task is None:
                        break
                    processed += 1
                    success = False
                    try:
                        success = self._process_claimed_bounded(task)
                        if success:
                            succeeded += 1
                        else:
                            failed += 1
                    finally:
                        self._log_cycle_task_result(task, success)
                        self._queue.complete(task)

            if processed == 0:
                return

            self._record_cycle(processed, succeeded, failed)
            queue_progress = self._queue_progress.get(self.QUEUE_KEY, {})
            line = (
                f"{self._log_prefix} Cycle summary: "
                f"progress={int(queue_progress.get('completed') or 0)}/"
                f"{int(queue_progress.get('total') or 0)} "
                f"succeeded={succeeded} failed={failed}"
            )
            (ColorPrint.green if failed == 0 else ColorPrint.yellow)(line)
            self._log_event(
                "cycle_summary",
                f"processed={processed} ok={succeeded} fail={failed}",
                mirror=self.LANE != "word",
            )
        except Exception as e:  # noqa: BLE001 — never raise out of the cycle thread
            ColorPrint.red(f"{self._log_prefix} Cycle error: {e}")
        finally:
            THREAD_BUS.signal(self._cycle_signal, False)
            if len(self._queue) > 0 and not self._lane_halt_requested():
                # Tasks dispatched mid-cycle remain queued - run ONE follow-up
                # drain so they are not stuck behind the next RPC dispatch.
                self._start_drain()
            elif self._is_enabled() and not self._lane_halt_requested() and self._pull_capacity() > 0:
                self.request_pull()

    # -------------------- introspection --------------------

    def get_status(self) -> Dict[str, Any]:
        """Service status snapshot (read-only, pycore-local worker state only)."""
        running = bool(THREAD_BUS.get_signal(self._cycle_signal, False))
        state = self._state_snapshot()
        current_tasks = state["current_tasks"]
        current = current_tasks[0] if current_tasks else None
        current_keys = []
        for ct in current_tasks:
            if not isinstance(ct, dict):
                continue
            lang = str(ct.get("language") or "").strip()
            key = str(ct.get("content_id") or ct.get("md5") or "").strip()
            if lang and key:
                current_keys.append(f"{lang}:{key}")
        queued = len(self._queue)
        status = {
            "service": f"Laravel {self.LANE.title()}-Audio Worker",
            "worker_id": self.worker_id,
            "worker_name": self.worker_name,
            "selected_speaker": self._speaker or None,
            "processor_types": self._effective_processor_types(),
            "capabilities": self._effective_capabilities(),
            "enabled": self._is_enabled(),
            "cycle_running": running,
            "queued": queued,
            "processing": int(state["processing"]),
            "current_task": current,
            "current_tasks": current_tasks,
            "current_keys": current_keys,
            "events": state["events"],
            "total_claimed": state["total_claimed"],
            "total_succeeded": state["total_succeeded"],
            "total_failed": state["total_failed"],
            "last_cycle": state["last_cycle"],
            "inflight_tasks": len(self._inflight),
            "circuit_open": self._circuit_is_open(),
            "result_5xx_streak": self._result_5xx_streak,
            "initialized": self._initialized,
        }
        if self.LANE == "word":
            status["backend_progress"] = word_audio_backend_progress.snapshot()
        status["queue_progress"] = dict(self._queue_progress.get(self.QUEUE_KEY) or {})
        return status


class LaravelWordAudioWorker(BaseLaravelAudioWorker):
    """Word-audio lane: global_tasks task_type word_audio on remote_audio."""

    LANE = "word"
    QUEUE_KEY = GLOBAL_TASK_TYPES_BY_KEY["word_audio"]["key"]
    CAPABILITY = "audio"
    PRIORITY_PROFILE = "word"
    ASSIST_CAPABILITY = "tts"
    WORKER_NAME_TAG = "word-audio"
    LOG_PREFIX = "[WordAudioWorker]"
    STATE_OWNER_KEY = "tts.word_audio_worker.state"
    STATE_OWNER_NAME = "WordAudioWorkerState"
    STATE_OWNER_TIMEOUT = 180.0
    REPORT_PATH = "/api/app_qy_v1/ai_tools/tts/worker/report"
    CONCURRENCY_DEFAULT = TTS_WORKER_CONCURRENCY
    LOG_ACCEPTED_RESULTS = False
    PROGRESS_EVENTS_ENABLED = True

    def _pull_once(self, prefer_remote: bool = False) -> Dict[str, Any]:
        base_url = self._sync_laravel_endpoint(self.api_url)
        try:
            word_audio_backend_progress.refresh(base_url)
        except Exception as exc:  # noqa: BLE001 - progress is best-effort metadata
            ColorPrint.yellow(
                f"{self._log_prefix} Backend table progress refresh failed: {exc}"
            )
        return super()._pull_once(prefer_remote=prefer_remote)


class LaravelSentenceAudioWorker(BaseLaravelAudioWorker):
    """Sentence-audio lane: global_tasks task_type sentence_audio on remote_sentence_audio."""

    LANE = "sentence"
    QUEUE_KEY = GLOBAL_TASK_TYPES_BY_KEY["sentence_audio"]["key"]
    RESULT_TASK_TYPE = QUEUE_KEY
    CAPABILITY = "sentence_audio"
    PRIORITY_PROFILE = "sentence"
    REQUIRED_ENGINE = QWEN3TTS_ENGINE
    ASSIST_CAPABILITY = "sentence_audio"
    WORKER_ID_PREFIX = "pycore-sentence"
    WORKER_NAME_TAG = "sentence-audio"
    LOG_PREFIX = "[SentenceAudioWorker]"
    STATE_OWNER_KEY = "tts.sentence_audio_worker.state"
    STATE_OWNER_NAME = "SentenceAudioWorkerState"
    REPORT_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/report"
    CONCURRENCY_DEFAULT = TTS_SENTENCE_WORKER_CONCURRENCY
    CONCURRENCY_LIMIT = _SENTENCE_CONCURRENCY_LIMIT
    TASK_TIMEOUT_MIN_SECONDS = _SENTENCE_TASK_TIMEOUT_SECONDS
    BOUNDED_PROCESSING = False


laravel_word_audio_worker = LaravelWordAudioWorker(LARAVEL_WORKER_API_URL)
laravel_sentence_audio_worker = LaravelSentenceAudioWorker(LARAVEL_WORKER_API_URL)
