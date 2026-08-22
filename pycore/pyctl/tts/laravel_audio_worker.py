# -*- coding: utf-8 -*-
"""
Persistent TTS audio workers for contract-owned typed queues.

Enabled workers pull and accept typed Laravel tasks without depending on the
React UI lifecycle. The RPC ``accept_task`` route remains as a compatible
manual dispatch surface.

------------------------------------------------------------------------------
Laravel typed pull/accept/result contract
------------------------------------------------------------------------------
  Pull:    POST /api/worker/tasks/{taskType}/pull
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

  The completed global-task result carries audio_base64 only when a domain
  report endpoint cannot be addressed. A successful domain upload is the
  durable audio step; the result then carries identity and provenance only.

------------------------------------------------------------------------------
Architecture (persistent worker kernel)
------------------------------------------------------------------------------
  * Singleton per lane on top of BaseLaravelWorkerService, plus one shared
    durable delivery outbox for domain uploads, terminal results, and history.
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
from functools import partial
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
from pycore.pyutils.laravel.progress_upload import laravel_progress_uploader
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
    http_transfer_contract,
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
from pycore.pyutils.tts.audio_delivery_outbox import (
    AUDIO_DELIVERY_PROCESS_ID,
    audio_delivery_outbox,
)


# --------------------------------------------------------------------------- #
# Constants                                                                    #
# --------------------------------------------------------------------------- #
_OUTBOX_BATCH_LIMIT = 32
_OUTBOX_PARALLEL_LIMIT = 4
_OUTBOX_IDLE_WAIT_SECONDS = 15.0

# TTL for the cached engine probe (tts_status() probes EVERY engine; far too
# expensive per task). Retired-worker value.
_ENGINE_PROBE_TTL_S = 60.0

_SENTENCE_CONCURRENCY_LIMIT = max(
    1,
    int(QUEUE_CENTER_DIFF_DELIVERY["consumer_batch_limits"]["sentence_audio"]),
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
            worker._record_task_result(success)
            worker._log_cycle_task_result(task, success)
            worker._queue.complete(task)
    return {
        "processed": processed,
        "succeeded": succeeded,
        "failed": failed,
    }


def _run_audio_delivery(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Deliver one durable outbox row on a shared task-group lane."""
    worker = payload["worker"]
    return worker._deliver_outbox_row(payload["record"])


class BaseLaravelAudioWorker(BaseLaravelWorkerService):
    """Shared word/sentence persistent Laravel audio worker.

    Lane-specific config lives in class attributes; the two concrete singletons
    at the bottom differ ONLY in those attributes. Lifecycle:
      typed pull or compatibility accept_task() -> record type/endpoint + push into
      the shared ordered heap -> start ONE background drain cycle (skipped
      while the previous cycle runs) -> drain by queue order (one serial lane
      or bounded parallel lanes) -> per task: cache check -> synthesize ->
      validate -> durable cache/outbox. Independent delivery task groups send
      domain reports and global results without blocking synthesis lanes.
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
        self._outbox_signal = f"laravel_audio_worker.outbox_running.{self.LANE}"
        THREAD_BUS.signal(self._outbox_signal, False)

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
        self._event_revision = 0
        self._last_cycle_summary: Dict[str, Any] = {}
        # Throttle marker for the idle event (epoch seconds of the last one).
        self._last_idle_event_ts = 0.0
        # Scratch dir for synthesized/uploaded word MP3s (cleaned per task) and
        # the persistent sentence cache root (retained local copy).
        self._tmp_dir = str(TMP_DIR / "pycore_tts_worker")
        self._cache_dir = str(get_app_cache_dir() / "sentence_audio")

        self._initialized = True
        self._start_outbox_drain()
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
        return max(0, concurrency - self._queue.active_count())

    def _diff_pull_capacity(self) -> int:
        concurrency, _engine = self._effective_concurrency()
        return max(0, concurrency - self._queue.active_count())

    def _lease_capacity(self) -> int:
        concurrency, _engine = self._effective_concurrency()
        return concurrency

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
        self._event_revision += 1
        entry["id"] = self._event_revision
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
            if info.get("upload_transferred_bytes") is not None:
                entry["upload_transferred_bytes"] = int(
                    info.get("upload_transferred_bytes") or 0
                )
                entry["upload_total_bytes"] = int(
                    info.get("upload_total_bytes") or 0
                )
                entry["upload_progress"] = float(
                    info.get("upload_progress") or 0.0
                )
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
    def _mark_qwen_progress(
        self,
        task_id: Any,
        attempt: Optional[int],
        progress: int,
        value: Dict[str, Any],
    ) -> bool:
        current = self._current_tasks.get(self._current_task_key(task_id, attempt))
        if current is None:
            return False
        revision = int(value.get("progress_revision") or 0)
        changed = (
            int(current.get("qwen_progress_revision") or 0) != revision
            or int(current.get("progress") or 0) != progress
        )
        current["stage"] = "synthesizing"
        current["progress"] = progress
        current["current_provider"] = QWEN3TTS_ENGINE
        current["qwen_progress_revision"] = revision
        current["qwen_progress"] = int(value.get("progress") or 0)
        current["qwen_progress_total"] = int(value.get("progress_total") or 0)
        current["qwen_progress_phase"] = str(value.get("progress_phase") or "")
        return changed

    def _report_qwen_progress(
        self,
        info: Dict[str, Any],
        value: Dict[str, Any],
    ) -> None:
        completed = max(0, int(value.get("progress") or 0))
        total = max(0, int(value.get("progress_total") or 0))
        base = int(GLOBAL_TASK_PROGRESS_STAGES["synthesizing"])
        ceiling = int(GLOBAL_TASK_PROGRESS_STAGES["uploading"]) - 1
        progress = (
            base + round((ceiling - base) * min(1.0, completed / total))
            if total > 0
            else base
        )
        phase = str(value.get("progress_phase") or value.get("status") or "queued")
        info["stage"] = "synthesizing"
        info["progress"] = progress
        info["progress_total"] = _PROGRESS_TOTAL
        info["current_provider"] = QWEN3TTS_ENGINE
        info["qwen_progress_revision"] = int(value.get("progress_revision") or 0)
        info["qwen_progress"] = completed
        info["qwen_progress_total"] = total
        info["qwen_progress_phase"] = phase
        changed = self._mark_qwen_progress(
            info.get("task_id"),
            info.get("attempt"),
            progress,
            value,
        )
        if not changed:
            return
        self._log_event(
            "progress",
            f"qwen phase={phase} chunks={completed}/{total}",
            info,
            mirror=self.LANE != "word",
        )
        self._post_result(
            info.get("task_id"),
            "processing",
            result={
                "stage": "synthesizing",
                "engine": QWEN3TTS_ENGINE,
                "qwen_progress_revision": int(value.get("progress_revision") or 0),
                "qwen_progress": completed,
                "qwen_progress_total": total,
                "qwen_progress_phase": phase,
            },
            progress=progress,
            attempts=1,
            attempt=info.get("attempt"),
        )

    @serialized_method
    def _mark_upload_progress(
        self,
        task_id: Any,
        attempt: Optional[int],
        progress: int,
        record: Dict[str, Any],
        provider: str,
    ) -> bool:
        current = self._current_tasks.get(self._current_task_key(task_id, attempt))
        if current is None:
            return False
        transferred = int(record.get("transferred_bytes") or 0)
        changed = int(current.get("upload_transferred_bytes") or 0) != transferred
        current["stage"] = "uploading"
        current["progress"] = progress
        current["current_provider"] = provider
        current["upload_transferred_bytes"] = transferred
        current["upload_total_bytes"] = int(record.get("total_bytes") or 0)
        current["upload_progress"] = float(record.get("progress") or 0.0)
        return changed

    def _report_upload_progress(
        self,
        info: Dict[str, Any],
        provider: str,
        record: Dict[str, Any],
    ) -> None:
        upload_progress = min(100.0, max(0.0, float(record.get("progress") or 0.0)))
        transferred_bytes = int(record.get("transferred_bytes") or 0)
        previous_transferred_bytes = int(info.get("upload_transferred_bytes") or 0)
        base = int(GLOBAL_TASK_PROGRESS_STAGES["uploading"])
        ceiling = int(GLOBAL_TASK_PROGRESS_STAGES["finalizing"]) - 1
        progress = base + round((ceiling - base) * upload_progress / 100.0)
        info["stage"] = "uploading"
        info["progress"] = progress
        info["progress_total"] = _PROGRESS_TOTAL
        info["current_provider"] = provider
        info["upload_transferred_bytes"] = transferred_bytes
        info["upload_total_bytes"] = int(record.get("total_bytes") or 0)
        info["upload_progress"] = upload_progress
        current_changed = self._mark_upload_progress(
            info.get("task_id"),
            info.get("attempt"),
            progress,
            record,
            provider,
        )
        changed = current_changed or transferred_bytes != previous_transferred_bytes
        if changed:
            self._log_event(
                "progress",
                (
                    f"upload={upload_progress:g}% "
                    f"bytes={info['upload_transferred_bytes']}/{info['upload_total_bytes']}"
                ),
                info,
                mirror=self.LANE != "word",
            )

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
        self._last_cycle_summary = {
            "processed": processed,
            "succeeded": succeeded,
            "failed": failed,
            "at": int(time.time()),
        }
        return dict(self._last_cycle_summary)

    @serialized_method
    def _record_task_result(self, success: bool) -> None:
        """Update lifetime counters as soon as one task reaches a terminal state."""
        self._total_claimed += 1
        if success:
            self._total_succeeded += 1
        else:
            self._total_failed += 1

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
            "event_count": len(self._events),
            "event_revision": self._event_revision,
            "total_claimed": self._total_claimed,
            "total_succeeded": self._total_succeeded,
            "total_failed": self._total_failed,
            "last_cycle": dict(self._last_cycle_summary),
        }

    def get_event_page(self, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """Return one newest-first worker-event page without bloating status."""
        normalized_page = max(1, int(page or 1))
        normalized_size = min(40, max(5, int(page_size or 20)))
        events = list(self._events)
        total = len(events)
        page_count = max(1, (total + normalized_size - 1) // normalized_size)
        normalized_page = min(normalized_page, page_count)
        offset = (normalized_page - 1) * normalized_size
        return {
            "items": [
                dict(event)
                for event in events[offset:offset + normalized_size]
            ],
            "page": normalized_page,
            "page_size": normalized_size,
            "pages": page_count,
            "total": total,
            "revision": self._event_revision,
        }

    # -------------------- inflight guard --------------------

    @serialized_method
    def _claim_inflight(self, task: Dict[str, Any]) -> bool:
        """Mark one task in-flight; False when a duplicate is already running.

        Audio work owns its entry until the minimum task step releases it. A
        fixed deadline can expire during valid Qwen or upload progress and run
        the same idempotency key concurrently inside one Pycore process.
        """
        task_key = self._task_execution_key(task)
        if task_key in self._inflight:
            return False
        self._inflight[task_key] = float("inf")
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
                "md5": str(payload.get("md5") or "").strip()
                or hashlib.md5(text.encode("utf-8")).hexdigest(),
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

        if kind == "article":
            cache_path = os.path.join(
                str(get_app_cache_dir() / "article_audio"),
                language,
                f"{info.get('md5') or 'audio'}_{QWEN3TTS_ENGINE}.mp3",
            )
            os.makedirs(os.path.dirname(cache_path), exist_ok=True)
            if os.path.exists(cache_path) and os.path.getsize(cache_path) > 0:
                ok_cache, _why = validate_mp3(cache_path)
                if ok_cache:
                    return True, cache_path, QWEN3TTS_ENGINE, "", False
            result = tts_orchestrator.synthesize(
                info["text"],
                language,
                Path(cache_path),
                accent=accent,
                gender=info.get("gender") or None,
                priority_profile="agent_history",
                required_engine=QWEN3TTS_ENGINE,
                client_job_id=(
                    f"queue-center:{info.get('task_id')}:{info.get('attempt', 0)}"
                ),
                progress_callback=partial(self._report_qwen_progress, info),
            )
            provider = result.get("engine") or QWEN3TTS_ENGINE
            if not result.get("success"):
                return False, cache_path, provider, result.get("error") or "synthesis failed", False
            ok, why = validate_mp3(cache_path)
            if not ok:
                return False, cache_path, provider, f"invalid audio from {provider}: {why}", False
            return True, cache_path, provider, "", False

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
                progress_callback=partial(self._report_qwen_progress, info),
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
                    return True, cache_path, planned_engine, "", False

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
            cache_path = get_cache_path(info["word"], language, provider)
            if os.path.exists(cache_path) and os.path.getsize(cache_path) > 0:
                try:
                    os.remove(out_path)
                except OSError:
                    pass
                return True, cache_path, provider, "", False
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
        """POST one report through the shared durable offset upload contract."""
        fields = self._report_fields(info, success, provider, error)
        report_base_url = self._task_base_url(info.get("task_id"))
        try:
            if success:
                audio_bytes = Path(audio_path).read_bytes()
                receipt = laravel_progress_uploader.upload(
                    self.REPORT_PATH,
                    audio_bytes,
                    base_url=report_base_url,
                    params=fields,
                    progress_callback=partial(
                        self._report_upload_progress,
                        info,
                        provider,
                    ),
                )
                return (
                    bool(receipt.get("upload_complete")),
                    "ok" if receipt.get("upload_complete") else "upload incomplete",
                )
            else:
                resp = laravel_client.post(
                    self.REPORT_PATH,
                    base_url=report_base_url,
                    data=fields,
                    activity_timeout=http_transfer_contract(),
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

    def _upload_report(
        self,
        info: Dict[str, Any],
        provider: str,
        audio_path: str,
    ) -> Optional[Tuple[bool, str]]:
        """Upload the MP3 to the domain report endpoint.

        Returns ``(ok, detail)``, or None when the lane has no addressable
        domain endpoint for this task (word without dict_row_id, article) —
        the audio then travels ONLY inside the global task result.
        """
        if self.LANE == "sentence":
            return self._post_report(
                info,
                True,
                provider,
                audio_path=audio_path,
            )
        if info["kind"] != "word" or not info.get("dict_row_id"):
            return None
        return self._post_report(
            info,
            True,
            provider,
            audio_path=audio_path,
        )

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

    @staticmethod
    def _outbox_retry_delay(attempts: int) -> float:
        exponent = max(0, min(int(attempts) - 1, 8))
        return min(_UPLOAD_RETRY_MAX_SECONDS, _UPLOAD_RETRY_INITIAL_SECONDS * (2 ** exponent))

    @staticmethod
    def _terminal_report_error(detail: str) -> bool:
        normalized = str(detail or "").lower()
        return normalized.startswith("server validation rejected") or normalized.startswith(
            "unknown task on server"
        ) or normalized.startswith("http 4")

    def _stage_delivery(
        self,
        info: Dict[str, Any],
        provider: str,
        audio_path: str,
        local_task_id: Optional[str],
    ) -> Dict[str, Any]:
        delivery_id = audio_delivery_outbox.delivery_id(
            self.LANE,
            info.get("task_id"),
            int(info.get("attempt") or 0),
        )
        cache_root = Path(get_app_cache_dir()).resolve()
        source_path = Path(audio_path).resolve()
        source_sha256 = hashlib.sha256(source_path.read_bytes()).hexdigest()
        retained_audio_path = (
            cache_root
            / "audio_delivery"
            / self.LANE
            / hashlib.sha1(delivery_id.encode("utf-8")).hexdigest()
            / f"{source_sha256}.mp3"
        )
        retained_audio_path.parent.mkdir(parents=True, exist_ok=True)
        if not retained_audio_path.is_file():
            shutil.copy2(str(source_path), str(retained_audio_path))
        record = {
            "delivery_id": delivery_id,
            "lane": self.LANE,
            "task_id": info.get("task_id"),
            "task_type": info.get("task_type") or self.QUEUE_KEY,
            "attempt": int(info.get("attempt") or 0),
            "base_url": self._task_base_url(info.get("task_id")),
            "provider": provider,
            "audio_path": str(retained_audio_path),
            "audio_sha256": source_sha256,
            "info": dict(info),
            "local_task_id": local_task_id or "",
            "local_process_id": AUDIO_DELIVERY_PROCESS_ID,
            "status": "pending",
            "domain_uploaded": False,
            "domain_delivery_finished": False,
            "result_accepted": False,
            "history_recorded": False,
        }

        return audio_delivery_outbox.put(record)

    def _start_outbox_drain(self) -> None:
        if THREAD_BUS.is_shutdown_requested() or THREAD_BUS.get_signal(self._outbox_signal, False):
            return
        THREAD_BUS.signal(self._outbox_signal, True)
        try:
            start_bus_task(
                self._drain_delivery_outbox,
                thread_name=f"{self.LANE}-audio-delivery-outbox",
            )
        except Exception as exc:  # noqa: BLE001
            THREAD_BUS.signal(self._outbox_signal, False)
            ColorPrint.red(f"{self._log_prefix} outbox start error: {exc}")

    def retry_delivery_outbox(self) -> Dict[str, Any]:
        retried = audio_delivery_outbox.retry_dead_letters(self.LANE)
        self._start_outbox_drain()
        return {"success": True, "retried": retried, "outbox": audio_delivery_outbox.stats(self.LANE)}

    def _drain_delivery_outbox(self) -> None:
        try:
            while not THREAD_BUS.is_shutdown_requested():
                stats = audio_delivery_outbox.stats(self.LANE)
                if int(stats.get("pending") or 0) <= 0:
                    return
                ready = audio_delivery_outbox.list_ready(self.LANE, _OUTBOX_BATCH_LIMIT)
                if not ready:
                    time.sleep(_OUTBOX_IDLE_WAIT_SECONDS)
                    continue
                lane_count = min(_OUTBOX_PARALLEL_LIMIT, len(ready))
                map_bus_tasks(
                    _run_audio_delivery,
                    [{"worker": self, "record": row} for row in ready],
                    max_workers=lane_count,
                    thread_prefix=f"{self.LANE.title()}AudioDelivery",
                )
        except Exception as exc:  # noqa: BLE001
            ColorPrint.red(f"{self._log_prefix} outbox cycle error: {exc}")
        finally:
            THREAD_BUS.signal(self._outbox_signal, False)
            if (
                not THREAD_BUS.is_shutdown_requested()
                and int(audio_delivery_outbox.stats(self.LANE).get("pending") or 0) > 0
            ):
                self._start_outbox_drain()

    def _deliver_outbox_row(self, record: Dict[str, Any]) -> Dict[str, Any]:
        delivery_id = str(record.get("delivery_id") or "")
        owner = f"{AUDIO_DELIVERY_PROCESS_ID}:{delivery_id}:{time.monotonic_ns()}"
        claimed = audio_delivery_outbox.claim(delivery_id, owner)
        if not claimed:
            return {"delivery_id": delivery_id, "processed": False}

        info = dict(claimed.get("info") or {})
        task_id = claimed.get("task_id")
        provider = str(claimed.get("provider") or "")
        audio_path = str(claimed.get("audio_path") or "")
        task_type = str(claimed.get("task_type") or self.QUEUE_KEY)
        base_url = str(claimed.get("base_url") or self.api_url)
        attempts = int(claimed.get("delivery_attempts") or 0) + 1
        retry_delay = self._outbox_retry_delay(attempts)
        audio_delivery_outbox.patch(
            delivery_id,
            {"delivery_attempts": attempts, "last_attempt_at": time.time()},
            owner=owner,
        )
        self._remember_task_types(
            [{"task_id": task_id, "task_type": task_type}],
            base_url,
        )

        if not audio_path or not os.path.isfile(audio_path):
            error = "cached audio is missing"
            audio_delivery_outbox.mark_dead_letter(delivery_id, owner, error)
            self._append_delivery_failure_history(
                info,
                provider,
                audio_path,
                error,
                delivery_id,
            )
            return {"delivery_id": delivery_id, "processed": True, "success": False}

        domain_uploaded = bool(claimed.get("domain_uploaded"))
        domain_delivery_finished = bool(
            claimed.get("domain_delivery_finished", domain_uploaded)
        )
        domain_error = str(claimed.get("domain_upload_error") or "")
        if not domain_delivery_finished:
            uploaded = self._upload_report(
                info,
                provider,
                audio_path,
            )
            if uploaded is not None and not uploaded[0]:
                error = uploaded[1]
                if self._terminal_report_error(error):
                    domain_delivery_finished = True
                    domain_error = error
                    audio_delivery_outbox.patch(
                        delivery_id,
                        {
                            "domain_delivery_finished": True,
                            "domain_uploaded": False,
                            "domain_upload_error": error,
                            "last_error": "",
                        },
                        owner=owner,
                    )
                    self._log_event(
                        "upload_terminal",
                        f"domain upload unavailable; global result fallback: {error}",
                        info,
                        mirror=self.LANE != "word",
                    )
                else:
                    audio_delivery_outbox.release(
                        delivery_id,
                        owner,
                        error=error,
                        retry_at=time.time() + retry_delay,
                    )
                    self._log_event(
                        "upload_retry",
                        f"attempt={attempts} retry_in={retry_delay:.0f}s error={error}",
                        info,
                    )
                    return {"delivery_id": delivery_id, "processed": True, "success": False}
            else:
                domain_delivery_finished = True
                domain_uploaded = uploaded is not None
                domain_error = ""
                audio_delivery_outbox.patch(
                    delivery_id,
                    {
                        "domain_delivery_finished": True,
                        "domain_uploaded": domain_uploaded,
                        "domain_upload_error": "",
                        "last_error": "",
                    },
                    owner=owner,
                )
                self._log_event(
                    "upload_done" if domain_uploaded else "upload_skipped",
                    (
                        f"backend accepted audio (attempt={attempts})"
                        if domain_uploaded
                        else "domain upload is not required; using global result"
                    ),
                    info,
                    mirror=self.LANE != "word",
                )

        info["backend_uploaded"] = domain_uploaded
        if domain_error:
            info["backend_upload_error"] = domain_error

        result_accepted = bool(claimed.get("result_accepted"))
        if not result_accepted:
            result = self._build_success_result(
                info,
                provider,
                audio_path,
                include_audio=not (
                    domain_uploaded
                    and str(info.get("kind") or "") in ("word", "sentence")
                ),
            )
            posted = self._post_result(
                task_id,
                "completed",
                result=result,
                progress=100,
                attempts=1,
                attempt=info.get("attempt"),
            )
            if not posted:
                info["backend_result_accepted"] = False
                self._mark_backend_result(task_id, False, info.get("attempt"))
                if str(task_id) not in self._task_type_by_id:
                    error = "completed result rejected because task ownership changed"
                    audio_delivery_outbox.mark_dead_letter(delivery_id, owner, error)
                    self._append_delivery_failure_history(
                        info,
                        provider,
                        audio_path,
                        error,
                        delivery_id,
                    )
                    return {"delivery_id": delivery_id, "processed": True, "success": False}
                audio_delivery_outbox.release(
                    delivery_id,
                    owner,
                    error="Laravel result endpoint unavailable",
                    retry_at=time.time() + retry_delay,
                )
                return {"delivery_id": delivery_id, "processed": True, "success": False}
            result_accepted = True
            audio_delivery_outbox.patch(
                delivery_id,
                {"result_accepted": True, "last_error": ""},
                owner=owner,
            )

        info["backend_uploaded"] = domain_uploaded
        info["backend_result_accepted"] = result_accepted
        self._mark_backend_result(task_id, True, info.get("attempt"))
        self._set_task_progress(info, "completed", provider)
        history_recorded = bool(claimed.get("history_recorded"))
        if not history_recorded:
            history_recorded = self._append_history(
                info,
                provider,
                audio_path,
                delivery_id,
            )
            if not history_recorded:
                audio_delivery_outbox.release(
                    delivery_id,
                    owner,
                    error="local task history is unavailable",
                    retry_at=time.time() + retry_delay,
                )
                return {"delivery_id": delivery_id, "processed": True, "success": False}
            audio_delivery_outbox.patch(
                delivery_id,
                {"history_recorded": True, "last_error": ""},
                owner=owner,
            )
        audio_delivery_outbox.complete(delivery_id, owner)
        local_task_id = str(claimed.get("local_task_id") or "")
        if str(claimed.get("local_process_id") or "") == AUDIO_DELIVERY_PROCESS_ID:
            self._finish_local_task(
                local_task_id or None,
                True,
                provider=provider,
                audio_path=audio_path,
                text=(info.get("text") or "")[:120],
                language=info.get("language") or "",
            )
        if self.LANE == "word":
            word_audio_backend_progress.record_result(True)
        self._log_event(
            "delivery_done",
            f"via {provider}; backend_upload={'ok' if domain_uploaded else 'fallback'}; result=ok",
            info,
            mirror=self.LANE != "word",
        )
        return {"delivery_id": delivery_id, "processed": True, "success": True}

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

    def _build_success_result(
        self,
        info: Dict[str, Any],
        provider: str,
        audio_path: str,
        include_audio: bool = True,
    ) -> Dict[str, Any]:
        """Build the minimum completed-result step after durable audio delivery."""
        audio_base64 = ""

        if include_audio:
            with open(audio_path, "rb") as fh:
                audio_base64 = base64.b64encode(fh.read()).decode("ascii")

        if self.LANE == "sentence":
            result: Dict[str, Any] = {
                "audio_base64": audio_base64,
                "domain_audio_persisted": not include_audio,
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

        translation = {
            "word": info["word"],
            "md5": info.get("md5") or "",
            "provider": provider,
            "accent": info.get("accent") or "unknown",
        }
        if include_audio:
            translation["audio_base64"] = audio_base64
            translation["audio_mime"] = "audio/mpeg"
        return {
            "translations": [translation],
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
        """Synthesize one task and stage its independent durable delivery."""
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

                delivery = self._stage_delivery(info, provider, audio_path, local_id)
                task["_delivery_staged"] = True
                self._report_progress(
                    info,
                    "uploading",
                    provider,
                )
                self._log_event(
                    "delivery_queued",
                    f"via {provider}; delivery_id={delivery.get('delivery_id')}",
                    info,
                    mirror=self.LANE != "word",
                )
                self._start_outbox_drain()
                return True
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

    def _append_history(
        self,
        info: Dict[str, Any],
        provider: str,
        audio_path: str,
        delivery_id: str,
    ) -> bool:
        """Persist one completed audio record with cache and upload attribution."""
        history_audio_path = audio_path
        if info.get("kind") == "word":
            cache_path = get_cache_path(info.get("word") or "", info.get("language") or "en", provider)
            if os.path.exists(cache_path):
                history_audio_path = cache_path
        audio_bytes = (
            os.path.getsize(history_audio_path)
            if history_audio_path and os.path.exists(history_audio_path)
            else 0
        )
        try:
            append_record({
                "record_id": f"audio-delivery:{delivery_id}",
                "task_id": info.get("task_id"),
                "task_type": info.get("task_type") or self.QUEUE_KEY,
                "worker": "tts_sentence_worker" if self.LANE == "sentence" else "tts_queue_poller",
                "title": (info.get("text") or "")[:120],
                "content": info.get("text"),
                "language": info.get("language"),
                "success": True,
                "detail": {
                    "provider": provider,
                    "engine": provider,
                    "audio_path": history_audio_path,
                    "audio_bytes": audio_bytes,
                    "queue_position": info.get("queue_position"),
                    "variant_key": info.get("variant_key") or "",
                    "accent": info.get("accent"),
                    "gender": info.get("gender"),
                    "source": "tts",
                    "audio_kind": info.get("kind"),
                    "multi_sentence_audio": tts_orchestrator.engine_chunked(provider),
                    "laravel_audio_uploaded": bool(info.get("backend_uploaded")),
                    "laravel_audio_upload_error": info.get("backend_upload_error") or "",
                    "laravel_result_accepted": bool(info.get("backend_result_accepted")),
                    "text": (info.get("text") or "")[:120],
                },
            })
            return True
        except Exception:  # noqa: BLE001
            return False

    def _append_delivery_failure_history(
        self,
        info: Dict[str, Any],
        provider: str,
        audio_path: str,
        error: str,
        delivery_id: str,
    ) -> None:
        """Persist a non-retryable delivery failure without deleting cached audio."""
        audio_bytes = (
            os.path.getsize(audio_path)
            if audio_path and os.path.exists(audio_path)
            else 0
        )
        if self.LANE == "word":
            word_audio_backend_progress.record_result(False)
        try:
            append_record({
                "record_id": f"audio-delivery:{delivery_id}",
                "task_id": info.get("task_id"),
                "task_type": info.get("task_type") or self.QUEUE_KEY,
                "worker": "tts_sentence_worker" if self.LANE == "sentence" else "tts_queue_poller",
                "title": (info.get("text") or "")[:120],
                "content": info.get("text"),
                "language": info.get("language"),
                "success": False,
                "error": str(error or "")[:500],
                "detail": {
                    "provider": provider,
                    "engine": provider,
                    "audio_path": audio_path,
                    "audio_bytes": audio_bytes,
                    "audio_kind": info.get("kind"),
                    "multi_sentence_audio": tts_orchestrator.engine_chunked(provider),
                    "laravel_audio_uploaded": bool(info.get("backend_uploaded")),
                    "laravel_result_accepted": False,
                    "delivery_status": "dead_letter",
                },
            })
        except Exception:  # noqa: BLE001
            pass

    # -------------------- RPC accept entry / drain cycle --------------------

    def _log_cycle_task_result(self, task: Dict[str, Any], success: bool) -> None:
        """Write one compact terminal line with canonical backend-table progress."""
        if self.LANE != "word":
            return
        if bool(task.get("_delivery_staged")):
            self._log_event(
                "delivery_staged",
                "audio cached; durable Laravel delivery is pending",
                {
                    "task_id": task.get("task_id"),
                    "stage": "uploading",
                    "progress": int(GLOBAL_TASK_PROGRESS_STAGES["uploading"]),
                    "progress_total": _PROGRESS_TOTAL,
                    "current_provider": task.get("_terminal_provider"),
                },
            )
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
            local_capacity = concurrency
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
                        success = self._process_claimed(task)
                        if success:
                            succeeded += 1
                        else:
                            failed += 1
                    finally:
                        self._record_task_result(success)
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
            "event_count": state["event_count"],
            "event_revision": state["event_revision"],
            "total_claimed": state["total_claimed"],
            "total_succeeded": state["total_succeeded"],
            "total_failed": state["total_failed"],
            "last_cycle": state["last_cycle"],
            "inflight_tasks": len(self._inflight),
            "circuit_open": self._circuit_is_open(),
            "result_5xx_streak": self._result_5xx_streak,
            "initialized": self._initialized,
            "delivery_outbox_running": bool(
                THREAD_BUS.get_signal(self._outbox_signal, False)
            ),
            "delivery_outbox": audio_delivery_outbox.stats(self.LANE),
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
    CONCURRENCY_LIMIT = 1


laravel_word_audio_worker = LaravelWordAudioWorker(LARAVEL_WORKER_API_URL)
laravel_sentence_audio_worker = LaravelSentenceAudioWorker(LARAVEL_WORKER_API_URL)
