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

import time
from collections import deque
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
from pycore.pyutils.common.service_config import (
    LARAVEL_WORKER_API_URL,
    TTS_SENTENCE_WORKER_CONCURRENCY,
    TTS_WORKER_CONCURRENCY,
)
from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_CAPABILITIES_BY_ROLE,
    GLOBAL_TASK_PROGRESS_STAGES,
    GLOBAL_TASK_PROGRESS_TOTAL,
    GLOBAL_TASK_TYPES_BY_KEY,
    task_execution_type,
    task_types_for_claimant,
)
from pycore.pyctl.assist.assist_settings import assist_capability_enabled
from pycore.pyctl.laravel.worker_base import (
    BaseLaravelWorkerService,
)
from pycore.pyctl.tts.word_audio_backend_progress import (
    word_audio_backend_progress,
)
from pycore.pyctl.tts.laravel_audio_worker_state import (
    LaravelAudioWorkerStateMixin,
)
from pycore.pyctl.tts.laravel_audio_worker_execution import (
    LaravelAudioWorkerExecutionMixin,
)
# ONE entry point for synthesis; local-first engine priority and edge's
# process-wide serialization live inside the orchestrator.
import pycore.pyutils.tts.tts_orchestrator as tts_orchestrator
from pycore.pyutils.tts.tts_concurrency import (
    effective_concurrency,
    recommended_concurrency,
)
from pycore.pyutils.tts.qwen.config import ENGINE_NAME as QWEN3TTS_ENGINE
from pycore.pyutils.tts.audio_task_queue import AudioTaskQueue
from pycore.pyutils.tts.audio_delivery_outbox import audio_delivery_outbox


# TTL for the cached engine probe (tts_status() probes EVERY engine; far too
# expensive per task). Retired-worker value.
_ENGINE_PROBE_TTL_S = 60.0

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


class BaseLaravelAudioWorker(
    LaravelAudioWorkerStateMixin,
    LaravelAudioWorkerExecutionMixin,
    BaseLaravelWorkerService,
):
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
            task_type=self.QUEUE_KEY,
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
                    "progress_total": GLOBAL_TASK_PROGRESS_TOTAL,
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
            "progress": GLOBAL_TASK_PROGRESS_TOTAL if success else 0,
            "progress_total": GLOBAL_TASK_PROGRESS_TOTAL,
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
    """Sentence-audio lane: global_tasks task_type sentence_audio on remote_sentence_audio.

    SPECIAL OPTIMIZATION (specially optimized script, 特殊优化的脚本):
    this lane is contract-tiered (queue_center_contract.json language_priority
    = ["en"]) so the remote Laravel claim head completes ALL English sentence
    tasks before any other language, and every log line mirrors the remote
    English completion progress pulled from Laravel (progress language_tiers).
    Do not generalize this lane's logging/tiering away — it is intentionally
    optimized for the English-first sentence backlog requirement.
    """

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

    def __init__(self, laravel_api_url: str = ""):
        # Uptime anchor for the dynamic log prefix; set before the base
        # __init__ so the very first line already carries elapsed time.
        self._log_started_monotonic = time.monotonic()
        super().__init__(laravel_api_url)

    @property
    def _log_prefix(self) -> str:
        """Dynamic prefix with worker uptime: [SentenceAudioWorker +0.00s].

        SPECIAL OPTIMIZATION (specially optimized script): the prefix carries
        the remote language-tier completion (remote_en=done/total) so every
        log line from this worker — task events AND infrastructure lines —
        mirrors the remote English sentence backlog progress.
        """
        started = getattr(self, "_log_started_monotonic", None)
        elapsed = time.monotonic() - started if started is not None else 0.0
        prefix = f"[SentenceAudioWorker +{max(0.0, elapsed):.2f}s]"
        tier_label = self._remote_language_tier_label()
        return f"{prefix} {tier_label}" if tier_label else prefix

    @_log_prefix.setter
    def _log_prefix(self, value: str) -> None:
        # The base __init__ assigns the static prefix; this lane replaces it
        # with the dynamic uptime prefix above.
        del value
    STATE_OWNER_KEY = "tts.sentence_audio_worker.state"
    STATE_OWNER_NAME = "SentenceAudioWorkerState"
    REPORT_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/report"
    CONCURRENCY_DEFAULT = TTS_SENTENCE_WORKER_CONCURRENCY
    CONCURRENCY_LIMIT = 1


laravel_word_audio_worker = LaravelWordAudioWorker(LARAVEL_WORKER_API_URL)
laravel_sentence_audio_worker = LaravelSentenceAudioWorker(LARAVEL_WORKER_API_URL)
