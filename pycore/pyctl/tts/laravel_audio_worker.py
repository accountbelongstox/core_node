# -*- coding: utf-8 -*-
"""
Laravel-pulled TTS audio workers (word_audio + sentence_audio).

These two singleton workers replace the retired domain-claim workers
(``word_queue_poller_service.py`` / ``sentence_worker_service.py``): instead of
claiming rows through the dedicated ``/ai_tools/tts/worker/claim`` and
``/ai_tools/tts/sentence/claim`` endpoints, they claim global_tasks through the
generic worker API (``/api/worker/tasks/{taskType}/pull`` with long-poll) exactly like the
translation worker, synthesize locally with the shared TTS orchestrator, upload
the MP3 through the EXISTING report endpoints, and complete the global task.

------------------------------------------------------------------------------
Laravel contract (laravel_main queue center — Phase A)
------------------------------------------------------------------------------
  Claim:   GET  /api/worker/tasks/{taskType}/pull?worker_id=&wait=30   (long-poll)
           word lane:     processor_types [remote_audio, remote_fast],
                          capability "audio"          (task_type word_audio)
           sentence lane: processor_types [remote_sentence_audio, remote_fast],
                          capability "sentence_audio" (task_type sentence_audio)
  Result:  POST /api/worker/tasks/{taskType}/result   (processing/completed/failed)

  Task payloads (global_task.payload):
    word_audio:     {word, content(alias), language, md5, audio_relative_path,
                     accent?, dict_row_id?}
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
Architecture (mirrors translation worker + retired TTS worker conventions)
------------------------------------------------------------------------------
  * Singleton per lane on top of BaseLaravelWorkerService (pull with inline
    worker identity / result with retry + circuit breaker + conn-fail
    single-hint logging).
  * The heartbeat callback (poll_and_process) stays LIGHT: it hands ONE
    claim+drain cycle to a background bus thread (non-reentrant via a
    THREAD_BUS signal). Pulled tasks are merged into ONE shared priority heap
    (server returns priority DESC; the heap preserves that across batches);
    serial engines drain on one lane, parallel-safe engines fan out to bounded
    lanes via map_bus_tasks (retired-worker pattern).
  * Local caches are honored BEFORE synthesis: word cache
    (pyutils/tts/word_audio_cache.py) and the persistent sentence cache
    (<app_cache>/sentence_audio/<lang>/<content_id>[_variant].mp3 — the local
    retained copy, never deleted). Fresh output is validated with the shared
    validate_mp3 mirror of the server checks and saved to the cache.
  * Bump wakes (SSE word_audio.priority / sentence.priority routed by
    pyctl/translation/http_event_client_service.py, and the queue-priority
    commands) call prioritize_word / notify_bump / notify_batch_bump, which
    re-key the local heap where possible and spawn an immediate cycle.
  * Logging only via ColorPrint. Networking via laravel_client (lazy
    third-party requests). All imports at file top (PYTHON_PYCORE.md).
"""

import base64
import hashlib
import os
import shutil
import socket
import tempfile
import time
from collections import deque
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional, Tuple

# ColorPrint is the only allowed logger in pycore services.
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    map_bus_tasks,
    serialized_method,
    start_bus_task,
)
# Rule §4: all inter-thread data exchange goes through the global bus.
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.system_paths import get_app_cache_dir
# Live enable flag (the UI toggle lives on the heartbeat callback).
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
# Unified pycore->Laravel HTTP gateway (times + logs + records every request).
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.common.service_config import (
    LARAVEL_WORKER_API_URL,
    TTS_SENTENCE_WORKER_BATCH,
    TTS_SENTENCE_WORKER_CONCURRENCY,
    TTS_WORKER_BATCH,
    TTS_WORKER_CONCURRENCY,
)
from pycore.pyutils.common.endpoint_scoped_cache import EndpointScopedCache
from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_CAPABILITIES_BY_ROLE,
    GLOBAL_TASK_EXECUTION_TYPES_BY_ROLE,
    GLOBAL_TASK_TYPES_BY_KEY,
    task_execution_type,
)
from pycore.pyctl.assist.assist_settings import assist_capability_enabled
from pycore.pyctl.translation.worker.base_laravel_worker import (
    BaseLaravelWorkerService,
)
from pycore.pyctl.desktop.task_manager import task_manager as shared_task_manager
from pycore.pyctl.task_history.store import append_record
# ONE entry point for synthesis; local-first engine priority and edge's
# process-wide serialization live inside the orchestrator.
import pycore.pyutils.tts.tts_orchestrator as tts_orchestrator
from pycore.pyutils.tts.tts_concurrency import (
    effective_concurrency,
    recommended_concurrency,
)
from pycore.pyutils.tts.word_audio_cache import get_cache_path, save_to_cache
from pycore.pyutils.tts.audio_validation import validate_mp3
from pycore.pyutils.tts.sentence_priority_queue import SentencePriorityQueue


# --------------------------------------------------------------------------- #
# Constants                                                                    #
# --------------------------------------------------------------------------- #
# Long-poll hold for /api/worker/tasks/{taskType}/pull (contract long_poll_seconds: 30).
_LONG_POLL_SECONDS = 30

# Report uploads carry a small MP3; give them room (retired-worker value).
_REPORT_TIMEOUT = 60
_QUEUE_OVERVIEW_TIMEOUT = 10

# ONE shared /api/queue-center/overview cache for BOTH lanes (word + sentence):
# the payload is global, so a single 30s cache replaces the per-caller private
# caches that fetched the same endpoint twice per Queue Center snapshot.
_QUEUE_OVERVIEW_CACHE = EndpointScopedCache(ttl_s=30.0, stale_max_s=300.0)

# Hard caps so a stuck engine fails the task and frees the lane instead of
# wedging the cycle thread forever (_cycle_signal would never clear otherwise).
_TASK_TIMEOUT_DEFAULT_SECONDS = 300.0
_TASK_TIMEOUT_MAX_SECONDS = 900.0
_TASK_TIMEOUT_GRACE_SECONDS = 30.0
# Bound for ONE parallel synth-lane wait (map_bus_tasks timeout).
_SYNTH_LANE_TIMEOUT_SECONDS = 300.0

# Server hard cap on a claim batch (contract: limit <= 50). Status display only —
# the generic pull API sizes the batch server-side.
_MAX_BATCH = 50

# TTL for the cached engine probe (tts_status() probes EVERY engine; far too
# expensive per task). Retired-worker value.
_ENGINE_PROBE_TTL_S = 60.0

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
        task = worker._queue.pop()
        if task is None:
            break
        processed += 1
        if worker._process_claimed(task):
            succeeded += 1
        else:
            failed += 1
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
    """Shared word/sentence audio worker on the generic Laravel worker API.

    Lane-specific config lives in class attributes; the two concrete singletons
    at the bottom differ ONLY in those attributes. Lifecycle per heartbeat tick
    (when enabled):
      poll_and_process() -> spawn ONE background cycle thread (skipped while the
      previous cycle runs) -> long-poll pull with identity -> push all
      tasks into the shared priority heap -> drain by priority (one serial lane
      or bounded parallel lanes) -> per task: cache check -> synthesize ->
      validate -> domain report upload -> global task result.
    """

    # ---- lane config (overridden by the concrete subclasses) ----
    LANE = "word"
    QUEUE_KEY = "word_audio"
    CAPABILITY = "audio"
    EXTRA_TASK_TYPES: Tuple[str, ...] = ()
    PRIORITY_PROFILE = "word"
    HEARTBEAT_CALLBACK = "tts_queue_poller"
    ASSIST_CAPABILITY = "tts"
    WORKER_ID_PREFIX = "pycore"
    WORKER_NAME_TAG = "word-audio"
    LOG_PREFIX = "[WordAudioWorker]"
    STATE_OWNER_KEY = "tts.word_audio_worker.state"
    STATE_OWNER_NAME = "WordAudioWorkerState"
    STATE_OWNER_TIMEOUT = 180.0
    REPORT_PATH = "/api/app_qy_v1/ai_tools/tts/worker/report"
    BATCH_DEFAULT = TTS_WORKER_BATCH
    CONCURRENCY_DEFAULT = TTS_WORKER_CONCURRENCY

    def __init__(self, laravel_api_url: str = ""):
        """Initialize the worker (idempotent — safe to call repeatedly)."""
        if getattr(self, "_initialized", False):
            return

        # Shared Laravel-worker scaffold (candidates, api_url, worker_id,
        # registration/conn-fail/circuit/inflight state, _http_timeout).
        self._init_base_laravel(laravel_api_url or LARAVEL_WORKER_API_URL)
        self.worker_name = f"pycore-{self.WORKER_NAME_TAG}-{self.worker_id}"
        self._log_prefix = self.LOG_PREFIX

        # Batch/concurrency remain deployment defaults; lifecycle comes from the
        # live user-settings map and its heartbeat callback.
        self.batch_size = max(1, min(_MAX_BATCH, self.BATCH_DEFAULT))
        # 0 = use the per-engine recommended value (pyutils/tts/tts_concurrency).
        self._concurrency = max(0, self.CONCURRENCY_DEFAULT)

        # ONE shared priority queue across ALL pull batches (retired §5.3 model):
        # a high-priority task pulled later still outranks lower-priority leftovers.
        self._queue = SentencePriorityQueue()

        # ONE cycle at a time; lifecycle state is exchanged through THREAD_BUS.
        self._cycle_signal = f"laravel_audio_worker.cycle_running.{self.LANE}"
        THREAD_BUS.signal(self._cycle_signal, False)
        # Set when a wake arrives mid-cycle; the cycle finally-block starts ONE
        # follow-up cycle so the wake is not dropped behind the next heartbeat.
        self._repoll_signal = f"laravel_audio_worker.repoll_needed.{self.LANE}"
        THREAD_BUS.signal(self._repoll_signal, False)

        # Last advertised lane set (the pull refreshes it on success).
        self._advertised_processor_types: Optional[List[str]] = None
        self._advertised_capabilities: Optional[List[str]] = None
        # Fast-lane counters parsed from pull/heartbeat bodies.
        self._pending_fast = 0
        self._pending_urgent = 0

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
        self._tmp_dir = os.path.join(tempfile.gettempdir(), "pycore_tts_worker")
        self._cache_dir = str(get_app_cache_dir() / "sentence_audio")

        self._initialized = True
        ColorPrint.green(
            f"{self._log_prefix} Service initialized (worker_id={self.worker_id}, "
            f"batch={self.batch_size}, "
            f"enabled={assist_capability_enabled(self.ASSIST_CAPABILITY)})"
        )

    # -------------------- identity / lanes --------------------

    @classmethod
    def _build_worker_id(cls) -> str:
        """Stable, hostname-based worker id (per-lane prefix).

        Laravel keys claims/heartbeats by worker_id; two pycore processes on the
        SAME host should set PYCORE_WORKER_INSTANCE (same env the translation
        worker honours) so their ids do not collide.
        """
        prefix = getattr(cls, "WORKER_ID_PREFIX", "pycore-worker")
        host = socket.gethostname() or "host"
        safe = "".join(c if (c.isalnum() or c in "-_") else "-" for c in host).lower()
        instance = (os.getenv("PYCORE_WORKER_INSTANCE") or "").strip()
        if instance:
            safe_instance = "".join(
                c if (c.isalnum() or c in "-_") else "-" for c in instance
            ).lower()
            return f"{prefix}-{safe}-{safe_instance}"
        return f"{prefix}-{safe}"

    def _effective_processor_types(self) -> List[str]:
        """Dedicated lane + the shared fast lane (bumped/interactive tasks)."""
        return [
            task_execution_type(self.QUEUE_KEY),
            GLOBAL_TASK_EXECUTION_TYPES_BY_ROLE["remote_fast"],
        ]

    def _effective_capabilities(self) -> List[str]:
        return [GLOBAL_TASK_CAPABILITIES_BY_ROLE[self.CAPABILITY]]

    def _effective_task_types(self) -> List[str]:
        """Typed pull route types: extras first (quick-polled), the lane's own
        QUEUE_KEY last so it holds the long-poll budget."""
        return [*self.EXTRA_TASK_TYPES, self.QUEUE_KEY]

    def _is_enabled(self) -> bool:
        """Live enable state: the PyHeartbeat callback flag (UI toggle) with the
        user setting as fallback when the heartbeat is unavailable."""
        try:
            return bool(
                shared_heartbeat_system.is_callback_enabled(self.HEARTBEAT_CALLBACK)
            )
        except Exception:  # noqa: BLE001 — heartbeat not up yet
            return assist_capability_enabled(self.ASSIST_CAPABILITY)

    # -------------------- engine probe / concurrency --------------------

    @serialized_method
    def _planned_engine(self) -> Optional[str]:
        """First usable engine in this lane's priority profile (60s TTL cache).

        ``tts_orchestrator.tts_status()`` probes EVERY engine — per-task calls
        stall synthesis on sequential availability checks, so the result is
        cached for _ENGINE_PROBE_TTL_S seconds (retired-worker pattern).
        """
        now = time.monotonic()
        if (
            self._engine_probe_cache is not None
            and now - self._engine_probe_ts < _ENGINE_PROBE_TTL_S
        ):
            return self._engine_probe_cache or None
        status = tts_orchestrator.tts_status()
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
        return tts_orchestrator._ENGINE_CONCURRENCY.get(engine or "", "serial")

    def _effective_concurrency(self) -> Tuple[int, str]:
        """(effective fan-out, planned engine). Serial engines always give 1."""
        engine = self._planned_engine() or ""
        kind = self._engine_concurrency_class(engine)
        return effective_concurrency(kind, self.get_concurrency()), engine

    def concurrency_status(self) -> Dict[str, Any]:
        """Return cached planning data without probing engines on a status RPC."""
        engine = self._engine_probe_cache or ""
        kind = self._engine_concurrency_class(engine)
        return {
            "concurrency": effective_concurrency(kind, self._concurrency),
            "concurrency_recommended": recommended_concurrency(kind),
            "concurrency_engine": engine or None,
            "concurrency_class": kind,
        }

    @serialized_method
    def set_concurrency(self, concurrency: int) -> None:
        self._concurrency = max(0, int(concurrency))

    def get_concurrency(self) -> int:
        return self._concurrency

    @serialized_method
    def invalidate_engine_plan(self) -> None:
        """Apply a changed engine order on the next worker cycle."""
        self._engine_probe_cache = None
        self._engine_probe_ts = 0.0

    # -------------------- events / counters --------------------

    @serialized_method
    def _log_event(self, kind: str, detail: str, info: Optional[Dict[str, Any]] = None) -> None:
        """Append one activity event (newest first) + mirror to the live log."""
        entry: Dict[str, Any] = {
            "at": int(time.time()),
            "kind": kind,
            "detail": (detail or "")[:240],
        }
        if info:
            entry["task_id"] = info.get("task_id")
            entry["language"] = info.get("language")
            if info.get("content_id"):
                entry["content_id"] = info.get("content_id")
            text = (info.get("text") or info.get("word") or "").strip()
            if text:
                entry["text_preview"] = text[:80]
        self._events.appendleft(entry)

        label = f"{self._log_prefix} {kind}"
        if info and info.get("task_id") is not None:
            label += f" task={info.get('task_id')}"
        line = f"{label}: {detail[:160]}" if detail else label
        if kind.endswith("_fail") or kind in ("report_reject", "synth_error"):
            ColorPrint.yellow(line)
        elif kind == "idle":
            ColorPrint.gray(line)
        else:
            ColorPrint.blue(line)

    @serialized_method
    def _mark_task_started(self, task_id: Any, info: Dict[str, Any]) -> None:
        self._current_tasks[task_id] = dict(info)
        self._processing += 1

    @serialized_method
    def _mark_task_finished(self, task_id: Any) -> None:
        self._current_tasks.pop(task_id, None)
        self._processing = max(0, self._processing - 1)

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
            current_tasks = [dict(task) for task in list(self._current_tasks.values())]
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
        task_id = task.get("task_id")
        if task_id in self._inflight:
            return False
        ttl = int(task.get("timeout_seconds") or self.INFLIGHT_DEFAULT_TTL)
        self._inflight[task_id] = now + max(ttl, self.INFLIGHT_DEFAULT_TTL)
        return True

    @serialized_method
    def _release_inflight(self, task_id: Any) -> None:
        self._inflight.pop(task_id, None)

    # -------------------- payload normalization --------------------

    def _accepts_task(self, task: Dict[str, Any]) -> bool:
        """Lane guard: a mis-tagged task of another lane is reported failed so
        Laravel re-routes it, never silently processed with the wrong shape."""
        capability = str(task.get("capability") or "")
        if capability == self.CAPABILITY:
            return True
        task_type = str(task.get("task_type") or "")
        return task_type == self.QUEUE_KEY or task_type in self.EXTRA_TASK_TYPES

    def _normalize(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Tolerate missing optional fields; required-field gaps become an
        ``error`` entry the caller reports as a failed task."""
        payload = task.get("payload") if isinstance(task.get("payload"), dict) else {}
        task_type = str(task.get("task_type") or "")
        language = (str(payload.get("language") or "en").strip() or "en").lower()
        info: Dict[str, Any] = {
            "task_id": task.get("task_id"),
            "task_type": task_type,
            "priority": task.get("priority"),
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
        """Persistent cache path: <cache_dir>/<lang>/<content_id>[_variant].mp3
        (mirrors the laravel on-disk layout so a cache hit maps 1:1 to a server
        file). The file is the local retained copy; never deleted."""
        key = (info.get("content_id") or "audio").strip()
        vkey = (info.get("variant_key") or "").strip()
        suffix = f"_{vkey}" if vkey else ""
        return os.path.join(self._cache_dir, info["language"], f"{key}{suffix}.mp3")

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
                    return True, out_path, "cache", "", False
            result = tts_orchestrator.synthesize(
                info["text"],
                language,
                Path(out_path),
                accent=accent,
                gender=info.get("gender") or None,
                priority_profile=self.PRIORITY_PROFILE,
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
        try:
            if success:
                with open(audio_path, "rb") as fh:
                    resp = laravel_client.post(
                        self.REPORT_PATH,
                        base_url=self.api_url,
                        data=fields,
                        files={"audio": (os.path.basename(audio_path), fh, "audio/mpeg")},
                        timeout=_REPORT_TIMEOUT,
                    )
            else:
                resp = laravel_client.post(
                    self.REPORT_PATH,
                    base_url=self.api_url,
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
                    f"{self._log_prefix} Failure report for task {info.get('task_id')} "
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
                f"{self._log_prefix} Task {task.get('task_id')} already in flight — skipping duplicate"
            )
            return True
        try:
            return self._process_task(task)
        finally:
            self._release_inflight(task.get("task_id"))

    def _process_task(self, task: Dict[str, Any]) -> bool:
        """Synthesize + upload + complete ONE claimed task. Runs on a lane
        thread (off the heartbeat thread). Any failure -> POST 'failed' so
        Laravel re-routes/re-pends; nothing is ever silently dropped."""
        task_id = task.get("task_id")
        info: Optional[Dict[str, Any]] = None
        local_id: Optional[str] = None
        try:
            if not self._accepts_task(task):
                ColorPrint.yellow(
                    f"{self._log_prefix} Task {task_id} has unsupported "
                    f"task_type {task.get('task_type')!r} / capability "
                    f"{task.get('capability')!r} - reporting failed so it can be re-routed"
                )
                self._post_result(
                    task_id,
                    "failed",
                    error=(
                        f"pycore {self.LANE} audio worker only processes "
                        f"{self.QUEUE_KEY} tasks (got task_type={task.get('task_type')!r})"
                    ),
                )
                return False

            info = self._normalize(task)
            if info.get("error"):
                self._report_failure(info, "none", info["error"])
                self._post_result(task_id, "failed", error=info["error"])
                self._log_event("synth_fail", info["error"], info)
                return False

            self._mark_task_started(task_id, info)
            self._log_event("synth_start", f"priority={task.get('priority')}", info)
            if self.LANE == "sentence":
                local_id = self._begin_local_task(info)

            ok, audio_path, provider, err, cleanup = self._resolve_audio(info)
            try:
                if not ok:
                    self._report_failure(info, provider, err)
                    self._post_result(task_id, "failed", error=err)
                    self._log_event("synth_fail", err, info)
                    ColorPrint.yellow(f"{self._log_prefix} Task {task_id} failed: {err}")
                    self._finish_local_task(local_id, False, provider=provider, error=err)
                    return False

                uploaded = self._upload_report(info, provider, audio_path)
                if uploaded is not None and not uploaded[0]:
                    detail = uploaded[1]
                    self._report_failure(info, provider, f"audio upload rejected: {detail}")
                    self._post_result(task_id, "failed", error=f"audio upload failed: {detail}")
                    self._log_event("report_reject", detail, info)
                    ColorPrint.yellow(
                        f"{self._log_prefix} Task {task_id} upload rejected ({detail})"
                    )
                    self._finish_local_task(local_id, False, provider=provider, error=detail)
                    return False

                result = self._build_success_result(info, provider, audio_path)
                posted = self._post_result(task_id, "completed", result=result, progress=100)
                self._log_event("synth_done", f"via {provider}", info)
                ColorPrint.green(
                    f"{self._log_prefix} Task {task_id} "
                    f"'{(info.get('text') or '')[:30]}' done via {provider}"
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
            ColorPrint.red(f"{self._log_prefix} Task {task_id} error: {e}")
            self._post_result(task_id, "failed", error=str(e))
            self._finish_local_task(local_id, False, error=str(e))
            return False
        finally:
            if info is not None:
                self._mark_task_finished(task_id)

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
                    "priority": info.get("priority"),
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
                    "priority": info.get("priority"),
                    "variant_key": info.get("variant_key") or "",
                    "accent": info.get("accent"),
                    "gender": info.get("gender"),
                    "source": "tts",
                    "text": (info.get("text") or "")[:120],
                },
            })
        except Exception:  # noqa: BLE001
            pass

    # -------------------- heartbeat callback / cycle --------------------

    @staticmethod
    def _task_time_cap(task: Dict[str, Any]) -> float:
        """Hard cap for ONE claimed task: the server-side timeout_seconds
        (bounded to a sane ceiling) plus a small grace for the result upload."""
        try:
            server_cap = float((task or {}).get("timeout_seconds") or 0)
        except (TypeError, ValueError):
            server_cap = 0.0
        if server_cap <= 0:
            server_cap = _TASK_TIMEOUT_DEFAULT_SECONDS
        return min(server_cap, _TASK_TIMEOUT_MAX_SECONDS) + _TASK_TIMEOUT_GRACE_SECONDS

    def _process_claimed_bounded(self, task: Dict[str, Any]) -> bool:
        """Process ONE claimed task on a bus thread under a hard time cap.

        A stuck engine must fail the task and free the lane — an unbounded
        inline call would wedge the cycle thread and _cycle_signal would never
        clear, killing the lane until restart."""
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

    def poll_and_process(self) -> None:
        """PyHeartbeat callback (every configured interval WHEN ENABLED).

        LIGHT by design: spawn one background cycle thread; skip the tick when
        the previous cycle is still running. Exception-safe — it must never
        raise into the heartbeat loop.
        """
        try:
            if THREAD_BUS.get_signal(self._cycle_signal, False):
                return  # previous cycle still in flight
            THREAD_BUS.signal(self._cycle_signal, True)
            start_bus_task(self._run_cycle, thread_name=f"{self.LANE}-audio-worker-cycle")
        except Exception as e:  # noqa: BLE001 — heartbeat must never see a raise
            THREAD_BUS.signal(self._cycle_signal, False)
            ColorPrint.red(f"{self._log_prefix} poll_and_process error: {e}")

    def _run_cycle(self) -> None:
        """One long-poll pull + priority-drain cycle. Runs on a
        background bus thread and is fully exception-safe."""
        processed = succeeded = failed = 0
        try:
            # Circuit breaker: while the backend persistently rejects results,
            # stop claiming new work until the cooldown expires.
            if not self._circuit_is_open():
                # Leftovers drain first: only long-poll when the local priority
                # queue is empty, so a bumped task is never stuck behind a hold.
                wait = 0 if len(self._queue) > 0 else _LONG_POLL_SECONDS
                tasks = self._pull_tasks(wait=wait)
                for task in tasks:
                    self._queue.push(task)
                if tasks:
                    self._log_event("claimed", f"count={len(tasks)} from {self.api_url}")
                    ColorPrint.blue(
                        f"{self._log_prefix} Claimed {len(tasks)} task(s) from "
                        f"{self.api_url} (queue depth now {len(self._queue)})"
                    )

            if len(self._queue) == 0:
                # Throttled idle event so the FE sees the worker IS cycling.
                now = time.time()
                if now - self._last_idle_event_ts >= 60:
                    self._last_idle_event_ts = now
                    self._log_event("idle", "queue empty — nothing pending")
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
                    task = self._queue.pop()
                    if task is None:
                        break
                    processed += 1
                    if self._process_claimed_bounded(task):
                        succeeded += 1
                    else:
                        failed += 1

            if processed == 0:
                return

            self._record_cycle(processed, succeeded, failed)
            line = (
                f"{self._log_prefix} Cycle summary: processed={processed} "
                f"succeeded={succeeded} failed={failed}"
            )
            (ColorPrint.green if failed == 0 else ColorPrint.yellow)(line)
            self._log_event("cycle_summary", f"processed={processed} ok={succeeded} fail={failed}")
        except Exception as e:  # noqa: BLE001 — never raise out of the cycle thread
            ColorPrint.red(f"{self._log_prefix} Cycle error: {e}")
        finally:
            THREAD_BUS.signal(self._cycle_signal, False)
            if THREAD_BUS.get_signal(self._repoll_signal, False):
                # A wake arrived mid-cycle — run ONE follow-up cycle instead of
                # dropping the wake behind the next heartbeat tick. Clear the
                # flag FIRST so the follow-up cannot retrigger itself forever.
                THREAD_BUS.signal(self._repoll_signal, False)
                self._wake_if_idle()

    # -------------------- priority-bump wake (SSE / queue-priority commands) --------------------

    def prioritize_word(self, md5: str, language: str) -> None:
        """Word-audio bump: the server already re-ordered its queue, so a wake
        suffices (no local re-key — pulled tasks are priority-ordered)."""
        try:
            self._wake_if_idle()
        except Exception as e:  # noqa: BLE001
            ColorPrint.yellow(f"{self._log_prefix} prioritize_word error: {e}")

    def notify_bump(self, content_id: str, language: str, priority: int) -> None:
        """Sentence bump: re-key the matching queued task (if still in the
        heap) and wake an idle worker. Exception-safe — a bump must never
        break the caller (SSE loop)."""
        try:
            if self._queue.bump(content_id, language, priority):
                ColorPrint.blue(
                    f"{self._log_prefix} Re-keyed queued sentence "
                    f"{language}:{content_id} -> priority {priority}"
                )
            self._wake_if_idle()
        except Exception as e:  # noqa: BLE001
            ColorPrint.yellow(f"{self._log_prefix} notify_bump error: {e}")

    def notify_batch_bump(self) -> None:
        """Aggregate bump (no per-row payload) — wake only. The next pull
        already selects priority DESC server-side, so no re-key."""
        try:
            self._wake_if_idle()
        except Exception as e:  # noqa: BLE001
            ColorPrint.yellow(f"{self._log_prefix} notify_batch_bump error: {e}")

    def _wake_if_idle(self) -> None:
        """Spawn a poll_and_process cycle on a bus thread when the worker is
        enabled and no cycle is in flight (poll_and_process is non-reentrant).
        A wake arriving mid-cycle sets the repoll flag instead of being
        dropped; the running cycle's finally-block starts ONE follow-up."""
        if not self._is_enabled():
            return
        if THREAD_BUS.get_signal(self._cycle_signal, False):
            THREAD_BUS.signal(self._repoll_signal, True)
            return
        start_bus_task(self.poll_and_process, thread_name=f"{self.LANE}-audio-worker-bump")

    # -------------------- queue summary (FE status) --------------------

    def _fetch_queue_overview(self) -> Dict[str, Any]:
        """Raw /api/queue-center/overview payload (shared by both lanes)."""
        try:
            resp = laravel_client.get(
                "/api/queue-center/overview",
                base_url=self.api_url,
                timeout=_QUEUE_OVERVIEW_TIMEOUT,
            )
        except Exception:
            return {}
        if resp.status_code != 200:
            return {}
        try:
            body = resp.json() or {}
        except ValueError:
            return {}
        data = body.get("data") if isinstance(body.get("data"), dict) else body
        return data if isinstance(data, dict) else {}

    def fetch_queue_summary(self) -> Dict[str, Any]:
        """Laravel pending/leased counts for this lane's queue
        (GET /api/queue-center/overview, global_tasks tallies).

        The overview payload is global, so BOTH lanes read it through ONE
        shared module-level cache (~30s TTL, background refresh) — no more
        duplicate fetches through per-caller private caches."""
        base = self.api_url
        if not base:
            return {}
        data = _QUEUE_OVERVIEW_CACHE.get_or_refresh(base, self._fetch_queue_overview)
        queues = data.get("queues") if isinstance(data, dict) else None
        row = (queues or {}).get(self.QUEUE_KEY) or {}
        if not isinstance(row, dict):
            return {}
        return {
            "pending": int(row.get("pending") or 0),
            "leased": int(row.get("assigned") or 0) + int(row.get("processing") or 0),
            "count": int(row.get("total") or 0),
        }

    # -------------------- introspection --------------------

    def get_status(self) -> Dict[str, Any]:
        """Service status snapshot (read-only).

        Key superset of the retired word/sentence worker shapes so the Queue
        Center UI keeps working unchanged (batch_running == cycle_running;
        last_tick == last_cycle; queued == leased == priority-heap depth).
        """
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
        return {
            "service": f"Laravel {self.LANE.title()}-Audio Worker",
            "api_url": self.api_url,
            "worker_id": self.worker_id,
            "worker_name": self.worker_name,
            "processor_types": self._effective_processor_types(),
            "capabilities": self._effective_capabilities(),
            "registered": self._registered,
            "enabled_on_start": assist_capability_enabled(self.ASSIST_CAPABILITY),
            # Live enable flag from the heartbeat callback (UI toggle).
            "heartbeat_enabled": self._is_enabled(),
            "batch_size": self.batch_size,
            "batch_running": running,
            "cycle_running": running,
            "queued": queued,
            "leased": queued,
            "processing": int(state["processing"]),
            "current_task": current,
            "current_keys": current_keys,
            "events": state["events"],
            "total_claimed": state["total_claimed"],
            "total_succeeded": state["total_succeeded"],
            "total_failed": state["total_failed"],
            "last_tick": state["last_cycle"],
            "last_cycle": state["last_cycle"],
            "inflight_tasks": len(self._inflight),
            "circuit_open": self._circuit_is_open(),
            "result_5xx_streak": self._result_5xx_streak,
            "pending_fast": self._pending_fast,
            "pending_urgent": self._pending_urgent,
            "initialized": self._initialized,
        }


class LaravelWordAudioWorker(BaseLaravelAudioWorker):
    """Word-audio lane: global_tasks task_type word_audio on remote_audio."""

    LANE = "word"
    QUEUE_KEY = GLOBAL_TASK_TYPES_BY_KEY["word_audio"]["key"]
    CAPABILITY = "audio"
    EXTRA_TASK_TYPES = (GLOBAL_TASK_TYPES_BY_KEY["article_audio"]["key"],)
    PRIORITY_PROFILE = "word"
    HEARTBEAT_CALLBACK = "tts_queue_poller"
    ASSIST_CAPABILITY = "tts"
    WORKER_NAME_TAG = "word-audio"
    LOG_PREFIX = "[WordAudioWorker]"
    STATE_OWNER_KEY = "tts.word_audio_worker.state"
    STATE_OWNER_NAME = "WordAudioWorkerState"
    STATE_OWNER_TIMEOUT = 180.0
    REPORT_PATH = "/api/app_qy_v1/ai_tools/tts/worker/report"
    BATCH_DEFAULT = TTS_WORKER_BATCH
    CONCURRENCY_DEFAULT = TTS_WORKER_CONCURRENCY


class LaravelSentenceAudioWorker(BaseLaravelAudioWorker):
    """Sentence-audio lane: global_tasks task_type sentence_audio on remote_sentence_audio."""

    LANE = "sentence"
    QUEUE_KEY = GLOBAL_TASK_TYPES_BY_KEY["sentence_audio"]["key"]
    CAPABILITY = "sentence_audio"
    EXTRA_TASK_TYPES = ()
    PRIORITY_PROFILE = "sentence"
    HEARTBEAT_CALLBACK = "tts_sentence_worker"
    ASSIST_CAPABILITY = "sentence_audio"
    WORKER_ID_PREFIX = "pycore-sentence"
    WORKER_NAME_TAG = "sentence-audio"
    LOG_PREFIX = "[SentenceAudioWorker]"
    STATE_OWNER_KEY = "tts.sentence_audio_worker.state"
    STATE_OWNER_NAME = "SentenceAudioWorkerState"
    REPORT_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/report"
    BATCH_DEFAULT = TTS_SENTENCE_WORKER_BATCH
    CONCURRENCY_DEFAULT = TTS_SENTENCE_WORKER_CONCURRENCY


laravel_word_audio_worker = LaravelWordAudioWorker(LARAVEL_WORKER_API_URL)
laravel_sentence_audio_worker = LaravelSentenceAudioWorker(LARAVEL_WORKER_API_URL)
