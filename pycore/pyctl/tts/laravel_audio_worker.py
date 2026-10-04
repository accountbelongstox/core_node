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
    phrase_audio:   {text, content(alias), language, content_id}

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
    phrase:   POST /api/app_qy_v1/ai_tools/tts/phrase/report
              {content_id, language, text, worker_id, success, audio|audio_base64,
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
    (<app_cache>/sentence_audio/<lang>/<content_id>[_variant].mp3 - the local
    retained copy, never deleted). Fresh output is validated with the shared
    validate_mp3 mirror of the server checks and saved to the cache.
  * Logging only via ColorPrint. Networking via laravel_client (lazy
    third-party requests). All imports at file top (PYTHON_PYCORE.md).
"""

import time
from typing import (
    Any,
    Dict,
    List,
    Optional,
    Tuple,
)

# ColorPrint is the only allowed logger in pycore services.
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint, format_duration_hms
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyfoundations.serialized_worker import (
    SerializedValue,
    map_bus_tasks,
    start_bus_task,
)
# Rule section 4: all inter-thread data exchange goes through the global bus.
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.system_paths import get_app_cache_dir
# Unified pycore->Laravel HTTP gateway (times + logs + records every request).
from pycore.pyutils.common.service_config import (
    PYSERVICE_STARTED_MONOTONIC,
    TTS_SENTENCE_WORKER_CONCURRENCY,
    TTS_WORKER_CONCURRENCY,
)
from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_CAPABILITIES_BY_ROLE,
    GLOBAL_TASK_PROGRESS_TOTAL,
    GLOBAL_TASK_TYPES_BY_KEY,
    queue_center_endpoint,
    lane_state_code,
    task_execution_type,
    task_types_for_claimant,
)
from pycore.pyctl.assist.assist_settings import assist_capability_enabled
from pycore.pyctl.laravel.worker.event_log import WorkerEventLog
from pycore.pyctl.laravel.worker_base import (
    ASSIST_BLOCKED,
    BaseLaravelWorkerService,
)
from pycore.pyutils.tts.audio_queue_model import LOCAL_SOURCE_LEASE
from pycore.pyctl.tts.word_audio_backend_progress import (
    word_audio_backend_progress,
)
from pycore.pyctl.tts.laravel_audio_worker_state import (
    LaravelAudioWorkerStateMixin,
    TASK_OUTCOME_COMPLETED,
    TASK_OUTCOME_SKIPPED,
)
from pycore.pyctl.tts.laravel_audio_worker_execution import (
    LaravelAudioWorkerExecutionMixin,
)
from pycore.pyctl.tts.laravel_audio_worker_reporting import (
    LaravelAudioWorkerReportingMixin,
)
from pycore.pyctl.tts.laravel_audio_worker_engine import (
    LaravelAudioWorkerEngineMixin,
    engine_memory_pauses,
)
# ONE entry point for synthesis; local-first engine priority and edge's
# process-wide serialization live inside the orchestrator.
from pycore.pyutils.tts import runtime_profile
from pycore.pyutils.tts.batch import batch_constants
from pycore.pyutils.tts.batch.kokoro_live import live_view as kokoro_live_view
from pycore.pyutils.tts.qwen.config import ENGINE_NAME as QWEN3TTS_ENGINE
from pycore.pyutils.tts.audio_queue_center import audio_queue_center
from pycore.pyutils.tts import audio_queue_cache
from pycore.pyctl.tts.laravel_audio_delivery import audio_lane_delivery
from pycore.pyctl.tts.audio_lane_leases import AudioLaneLeases
from pycore.pyctl.laravel.worker.work_leases import WORK_LEASE_LANES
from pycore.pyutils.laravel.delivery_outbox import laravel_delivery_outbox



# An idle fan-out lane re-checks the queue at least this often while a peer works.
LANE_IDLE_WAIT_SECONDS = 2.0


def _run_audio_synth_lane(payload: Dict[str, Any]) -> Dict[str, int]:
    """Drain one synth lane; payload and result travel through THREAD_BUS."""
    worker = payload["worker"]
    processed = succeeded = failed = skipped = 0
    while True:
        if not worker._await_engine_memory():
            break
        task = worker._pop_lane_task()
        if task is None:
            if worker._await_lane_work():
                continue
            break
        try:
            processed += 1
            started = time.monotonic()
            outcome = worker._process_claimed(task)
            if outcome == TASK_OUTCOME_SKIPPED:
                # Claim rejected / duplicate dispatch: never synthesized, so the
                # lifetime counters and backend progress stay untouched.
                skipped += 1
            else:
                success = outcome == TASK_OUTCOME_COMPLETED
                if success:
                    succeeded += 1
                else:
                    failed += 1
                worker._record_task_result(success, time.monotonic() - started, bool(task.get("_cache_hit")))
            worker._log_cycle_task_result(task, outcome)
            worker._complete_queued_task(task, outcome)
        finally:
            worker._adjust_busy_lanes(-1)
    return {
        "processed": processed,
        "succeeded": succeeded,
        "failed": failed,
        "skipped": skipped,
    }


# assist.reason_code while the lane's engine waits for host memory.
ASSIST_BLOCK_ENGINE_MEMORY_PAUSED = lane_state_code("assist_reason_codes", "ENGINE_MEMORY_PAUSED")


class BaseLaravelAudioWorker(
    LaravelAudioWorkerStateMixin,
    LaravelAudioWorkerExecutionMixin,
    LaravelAudioWorkerReportingMixin,
    LaravelAudioWorkerEngineMixin,
    BaseLaravelWorkerService,
):
    """Shared word/sentence/phrase persistent Laravel audio worker.

    Lane-specific config lives in class attributes; the concrete singletons
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
    # True for the lanes synthesized in batches by the word-batch engine
    # (word, phrase; contract AUDIO_BATCH_LANES): batch drain, quiet console.
    BATCH_LANE = True
    # Worker label of the lane's task-history records (the lane's heartbeat callback).
    HISTORY_WORKER = "tts_queue_poller"
    ASSIST_CAPABILITY = "tts"
    WORKER_ID_PREFIX = "pycore"
    WORKER_NAME_TAG = "word-audio"
    LOG_PREFIX = "[WordAudioWorker]"
    STATE_OWNER_KEY = "tts.word_audio_worker.state"
    STATE_OWNER_NAME = "WordAudioWorkerState"
    STATE_OWNER_TIMEOUT = 180.0
    REPORT_PATH = queue_center_endpoint("audio_word_report")
    CONCURRENCY_DEFAULT = TTS_WORKER_CONCURRENCY
    CONCURRENCY_LIMIT = 8
    PROGRESS_EVENTS_ENABLED = False

    def _on_laravel_online(self, base_url: str) -> None:
        """Flush generated local audio before admitting more remote work."""
        laravel_delivery_outbox.kick(self._delivery_kind)

    def __init__(self):
        """Initialize the worker (idempotent - safe to call repeatedly)."""
        if getattr(self, "_initialized", False):
            return

        self._init_base_laravel()
        self.worker_name = f"pycore-{self.WORKER_NAME_TAG}-{self.worker_id}"
        self._log_prefix = self.LOG_PREFIX

        # 0 = use the per-engine recommended value (pyutils/tts/tts_concurrency).
        self._concurrency = max(0, self.CONCURRENCY_DEFAULT)
        self._speaker = ""

        # The lane queue is owned by the shared audio queue library
        # (Queue = Part1 + Part2); this worker consumes it, never constructs
        # it. Part2 work comes from this node's Laravel work leases.
        self._queue = audio_queue_center.queue_for(self.QUEUE_KEY)
        self._leases = AudioLaneLeases(self)
        audio_queue_center.register_lane_intake(
            self.QUEUE_KEY,
            waker=self.request_pull,
            settled=self._leases.settled,
            blocked=self._lane_blocked,
        )

        # ONE drain cycle at a time; lifecycle state is exchanged through THREAD_BUS.
        self._cycle_signal = f"laravel_audio_worker.cycle_running.{self.LANE}"
        THREAD_BUS.signal(self._cycle_signal, False)
        # Atomic single-flight guard of the drain cycle (the signal above is
        # the observable state only).
        self._drain_guard = SerializedValue(False, f"{self.LANE.title()}AudioDrainGuardThread")
        # Fan-out lanes that hold a popped task, and the wake signal that
        # tells idle lanes of a running cycle that new work arrived.
        self._busy_lanes = 0
        self._work_signal = f"laravel_audio_worker.work_arrived.{self.LANE}"
        THREAD_BUS.register_shutdown_handler(
            self.wake_memory_wait,
            priority=60,
            name=f"{self.LANE}_audio_memory_wait",
        )

        # Engine probe cache (60s TTL) - see _engine_plan().
        self._engine_probe_cache: Optional[str] = None
        self._usable_engines_cache: List[str] = []
        self._engine_probe_ts = 0.0
        # {engine, parallel}: the planned engine's reported parallel capacity.
        self._engine_capacity = SerializedValue({}, f"{self.LANE.title()}AudioEngineCapacityThread")

        # Lifetime + live counters (introspection / FE status).
        self._total_claimed = 0
        self._total_succeeded = 0
        self._total_failed = 0
        self._total_duration_s = 0.0
        self._synth_claimed = 0
        self._synth_duration_s = 0.0
        self._processing = 0
        self._current_tasks: Dict[Any, Dict[str, Any]] = {}
        self._event_log = WorkerEventLog(self.STATE_OWNER_NAME)
        self._last_cycle_summary: Dict[str, Any] = {}
        # Throttle marker for the idle event (epoch seconds of the last one).
        self._last_idle_event_ts = 0.0
        # Scratch dir for synthesized/uploaded word MP3s (cleaned per task) and
        # the persistent sentence cache root (retained local copy).
        self._tmp_dir = str(TMP_DIR / "pycore_tts_worker")
        self._cache_dir = str(get_app_cache_dir() / "sentence_audio")

        self._initialized = True
        # Registration only; the outbox flushes rows left by a previous
        # process when it starts (service startup path).
        self._delivery_kind = audio_lane_delivery.register(self)
        ColorPrint.green(
            f"{self._log_prefix} Service initialized (worker_id={self.worker_id}, "
            f"enabled={assist_capability_enabled(self.ASSIST_CAPABILITY)})"
        )

    # -------------------- dynamic log prefix (shared by both lanes) --------------------

    @property
    def _log_prefix(self) -> str:
        """Dynamic prefix: "[<Tag> <service uptime HH:MM:SS>] <remote tier> <local runtime>".

        Uptime is anchored at the ONE central pyservice start constant
        (service_config.PYSERVICE_STARTED_MONOTONIC) so every lane measures
        from the same service boot, and renders through the shared
        format_duration_hms. The local runtime label mirrors THIS
        lane's own lifetime counters (word and sentence are separate worker
        instances - totals and average durations never mix) accumulated
        since that same boot; the remote tier label (remote_en=done/total)
        appears only on contract-tiered lanes.
        """
        elapsed = time.monotonic() - PYSERVICE_STARTED_MONOTONIC
        parts = [f"[{self.LOG_PREFIX.strip('[]')} {format_duration_hms(elapsed)}]"]
        tier_label = self._remote_language_tier_label()
        if tier_label:
            parts.append(tier_label)
        parts.append(self._local_runtime_label())
        return " ".join(parts)

    @_log_prefix.setter
    def _log_prefix(self, value: str) -> None:
        # Both __init__ layers assign the static LOG_PREFIX; the shared
        # dynamic property replaces it, so the assignment is discarded.
        del value

    # -------------------- identity / lanes --------------------

    def _effective_processor_types(self) -> List[str]:
        """Audio is claimed only from its queue-position ordered lane."""
        return [task_execution_type(self.QUEUE_KEY)]

    def _effective_capabilities(self) -> List[str]:
        return [GLOBAL_TASK_CAPABILITIES_BY_ROLE[self.CAPABILITY]]

    def _pull_task_types(self) -> List[str]:
        """Laravel global tasks of the lane (e.g. article_audio); the gap
        lanes themselves arrive through work leases."""
        if not self._is_enabled():
            return []
        return [task_type for task_type in self._contract_task_types() if task_type not in WORK_LEASE_LANES]

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

    def _assist_activity(self) -> Tuple[bool, Optional[str], str]:
        """Working while a drain cycle runs or a task synthesizes; blocked
        while the lane's engine waits for host memory."""
        engine = self._planned_engine()
        running = bool(THREAD_BUS.get_signal(self._cycle_signal, False)) or int(self._processing) > 0
        if engine and engine_memory_pauses.paused(engine):
            return False, engine, ASSIST_BLOCK_ENGINE_MEMORY_PAUSED
        return running, engine, ""

    def _is_enabled(self) -> bool:
        """Lane enable state: the persisted assist capability (UI toggle).

        The persistent pull callback runs only while this toggle is on; this is
        also a defense-in-depth guard on the compatibility accept entry."""
        return assist_capability_enabled(self.ASSIST_CAPABILITY)

    # -------------------- events / counters --------------------

    def _log_cycle_task_result(self, task: Dict[str, Any], outcome: str) -> None:
        """Write one compact terminal line; the word lane adds the canonical
        backend-table progress."""
        if not self.BATCH_LANE:
            return
        tracks_backend = self.LANE == "word"
        payload = task.get("payload") if isinstance(task.get("payload"), dict) else {}
        word = str(payload.get("word") or payload.get("text") or payload.get("content") or "").strip()
        language = str(payload.get("language") or "en").strip().lower() or "en"
        if outcome == TASK_OUTCOME_SKIPPED:
            # The task was dropped before synthesis (claim rejected or
            # duplicate dispatch): audit the drop without recording a result.
            self._log_event(
                "task_skipped",
                str(task.get("_skip_reason") or "skipped before synthesis"),
                {
                    "task_id": task.get("task_id"),
                    "word": word,
                    "text": word,
                    "language": language,
                    "stage": "skipped",
                },
            )
            return
        success = outcome == TASK_OUTCOME_COMPLETED
        if bool(task.get("_delivery_staged")):
            if tracks_backend and task.get("_local_source") and task.get("_local_source") != LOCAL_SOURCE_LEASE:
                # A node-local clip is generated and served from the local
                # cache already; its Laravel delivery is background outbox
                # work and neither blocks nor counts as this task's failure.
                word_audio_backend_progress.record_result(True)
            self._log_event(
                "delivery_staged",
                "audio cached; durable Laravel delivery is pending "
                f"(reason={self.QUEUE_KEY}_delivery)",
                {
                    "task_id": task.get("task_id"),
                    "stage": "uploading",
                    "current_provider": task.get("_terminal_provider"),
                },
            )
            return
        provider = str(task.get("_terminal_provider") or "").strip()
        info: Dict[str, Any] = {
            "task_id": task.get("task_id"),
            "word": word,
            "text": word,
            "language": language,
            "stage": "completed" if success else "failed",
            "progress": GLOBAL_TASK_PROGRESS_TOTAL if success else 0,
            "progress_total": GLOBAL_TASK_PROGRESS_TOTAL,
        }
        if tracks_backend:
            backend_progress = word_audio_backend_progress.record_result(success)
            info["backend_progress_current"] = int(backend_progress.get("current") or 0)
            info["backend_progress_total"] = int(backend_progress.get("total") or 0)
        if provider:
            info["current_provider"] = provider
        detail = f"via {provider}" if success and provider else (
            "completed" if success else "failed"
        )
        self._log_event("task_done" if success else "task_fail", detail, info)

    def _complete_queued_task(self, task: Dict[str, Any], outcome: str) -> None:
        """Report one popped task's terminal outcome to the shared queue library.

        The library releases the whole-Queue dedup/Part1 state and records the
        outcome for owners watching the item (orchestration fill progress).
        """
        if task.get("_cache_hit"):
            self._leases.note_cached(task)
        audio_queue_center.complete(
            self.QUEUE_KEY,
            task,
            ok=outcome == TASK_OUTCOME_COMPLETED,
            provider=str(task.get("_terminal_provider") or ""),
            error=str(task.get("_skip_reason") or task.get("_batch_audio_error") or ""),
        )

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
            endpoint = (base_url or "").strip() or self.active_base_url()
            queued_task = dict(task)
            if self.LANE != "word" and not str(queued_task.get("task_type") or "").strip():
                queued_task["task_type"] = self.QUEUE_KEY
            if self._queue.contains(queued_task):
                return {
                    "success": True,
                    "task_id": task.get("task_id"),
                    "duplicate": True,
                }
            concurrency, _engine = self._effective_concurrency()
            # Capacity is the in-flight work, never the queued leased batch.
            local_load = max(0, int(self._processing))
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
            queued = audio_queue_center.accept_task(self.QUEUE_KEY, queued_task)
            self._start_drain()
            return {
                "success": True,
                "task_id": task.get("task_id"),
                "duplicate": not queued,
            }
        except Exception as e:  # noqa: BLE001 - RPC entry must never raise
            ColorPrint.red(f"{self._log_prefix} accept_task error: {e}")
            return {"success": False, "error": str(e)}

    def _start_drain(self) -> None:
        """Spawn ONE background drain cycle (non-reentrant via the cycle signal)."""
        if THREAD_BUS.is_shutdown_requested():
            return
        if not self._drain_guard.compare_and_set(False, True):
            # The running cycle drains the whole heap; its idle fan-out lanes
            # take the new work.
            THREAD_BUS.signal(self._work_signal, True)
            return
        THREAD_BUS.signal(self._cycle_signal, True)
        try:
            start_bus_task(self._drain_cycle, thread_name=f"{self.LANE}-audio-worker-cycle")
        except Exception as e:  # noqa: BLE001
            THREAD_BUS.signal(self._cycle_signal, False)
            self._drain_guard.set(False)
            ColorPrint.red(f"{self._log_prefix} drain start error: {e}")

    def request_start(self) -> None:
        """Clear the lane stop and resume the kept Queue (local Part1 items;
        leased work is claimed afresh)."""
        super().request_start()
        if len(self._queue) > 0:
            self._start_drain()

    def request_stop(self, graceful: bool = True) -> None:
        """Graceful: finish the leased batch, claim nothing new. Immediate:
        every lease goes back to the pool at once."""
        super().request_stop(graceful)
        if not graceful:
            self._leases.release_all("lane_halted")

    def release_leases(self, reason: str) -> None:
        """Lane activation: free leases a previous process of this worker
        id still holds before claiming."""
        self._leases.release_all(reason)

    def capacity_per_hour(self) -> int:
        """Items this lane can synthesize per hour: parallel slots over the
        mean synthesis time (cache-served tasks excluded). Seeds the lease batch
        independently of how much work the node was given (0 before the first
        synthesized task)."""
        claimed = int(self._synth_claimed)
        if claimed <= 0 or self._synth_duration_s <= 0:
            return 0
        parallel = batch_constants.group_size() if self.BATCH_LANE else self._effective_concurrency()[0]
        return int(max(1, parallel) * 3600.0 * claimed / self._synth_duration_s)

    def _pop_lane_task(self) -> Optional[Dict[str, Any]]:
        """Pop the next task for a fan-out lane. The lane counts as busy from
        before the pop, so its peers never see an empty queue and no busy lane
        in the same instant; a lane that popped nothing is not busy."""
        self._adjust_busy_lanes(1)
        task = audio_queue_center.pop_next(self.QUEUE_KEY)
        if task is None:
            self._adjust_busy_lanes(-1)
        elif len(self._queue) > 0:
            THREAD_BUS.signal(self._work_signal, True)
        return task

    def _await_lane_work(self) -> bool:
        """An idle fan-out lane waits for new work while a peer still works
        (leases arrive during a cycle and must not run on one lane only).
        False when the lane should end: no peer is busy, halt or shutdown."""
        if self._busy_lane_count() <= 0 or self._lane_halt_requested() or THREAD_BUS.is_shutdown_requested():
            return False
        THREAD_BUS.wait_signal(self._work_signal, timeout=LANE_IDLE_WAIT_SECONDS)
        THREAD_BUS.clear_signal(self._work_signal)
        return True

    def _lane_blocked(self) -> bool:
        return self._assist_state()["state"] == ASSIST_BLOCKED

    def poll_diff_once(self) -> Dict[str, Any]:
        """Heartbeat: start a lease round when one is due, then the Laravel
        task diff of the lane's other task types."""
        if self._leases.due():
            self.request_pull()
        return super().poll_diff_once()

    def run_pull_cycle(self, prefer_remote: bool = False) -> Dict[str, Any]:
        """One intake cycle: the lease round (a realtime wake claims at once),
        then the bounded pull of the lane's Laravel task types."""
        lease = self._leases.tick(urgent=prefer_remote)
        return {**super().run_pull_cycle(prefer_remote=prefer_remote), "lease": lease}

    def _drain_cycle(self) -> None:
        """One ordered drain cycle over the local dispatch heap. Runs on a
        background bus thread and is fully exception-safe."""
        processed = succeeded = failed = skipped = 0
        try:
            if len(self._queue) == 0:
                return

            if not self.BATCH_LANE:
                self.refresh_engine_capacity()
            concurrency, engine = self._effective_concurrency()
            if self.BATCH_LANE:
                batch_size = batch_constants.group_size()
                while True:
                    if not self._await_engine_memory():
                        break
                    tasks = []
                    for _index in range(batch_size):
                        task = audio_queue_center.pop_next(self.QUEUE_KEY)
                        if task is None:
                            break
                        tasks.append(task)
                    if not tasks:
                        break
                    self._log_event(
                        "batch",
                        f"Kokoro batch size={len(tasks)} device={runtime_profile.WORD_BATCH_DEVICE}",
                    )
                    outcomes = self._process_claimed_batch(tasks)
                    for entry in outcomes:
                        task = entry["task"]
                        outcome = entry["outcome"]
                        processed += 1
                        if outcome == TASK_OUTCOME_SKIPPED:
                            skipped += 1
                        else:
                            success = outcome == TASK_OUTCOME_COMPLETED
                            if success:
                                succeeded += 1
                            else:
                                failed += 1
                            self._record_task_result(
                                success,
                                time.monotonic() - float(entry["started"]),
                                bool(task.get("_cache_hit")),
                            )
                        self._log_cycle_task_result(task, outcome)
                        self._complete_queued_task(task, outcome)
            elif concurrency > 1 and len(self._queue) > 1:
                self._log_event(
                    "parallel",
                    f"fan-out x{concurrency} (planned={engine or '?'}, usable_engines={len(self._usable_engines_cache)})",
                )
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
                    skipped += int(result.get("skipped") or 0)
            else:
                while True:
                    if not self._await_engine_memory():
                        break
                    task = audio_queue_center.pop_next(self.QUEUE_KEY)
                    if task is None:
                        break
                    processed += 1
                    started = time.monotonic()
                    outcome = self._process_claimed(task)
                    if outcome == TASK_OUTCOME_SKIPPED:
                        skipped += 1
                    else:
                        success = outcome == TASK_OUTCOME_COMPLETED
                        if success:
                            succeeded += 1
                        else:
                            failed += 1
                        self._record_task_result(success, time.monotonic() - started, bool(task.get("_cache_hit")))
                    self._log_cycle_task_result(task, outcome)
                    self._complete_queued_task(task, outcome)
                    if concurrency > 1 and len(self._queue) > 1:
                        # Work arrived while this cycle ran one at a time:
                        # end it so the follow-up cycle fans out.
                        break

            if processed == 0:
                return

            self._record_cycle(processed, succeeded, failed)
            # Drain-cycle completion boundary: persist the whole-Queue snapshot
            # so a restart never resurrects the tasks this cycle consumed.
            audio_queue_center.persist_snapshot(
                self.QUEUE_KEY, source=audio_queue_cache.SOURCE_DRAIN
            )
            queue_progress = self._queue_progress.get(self.QUEUE_KEY, {})
            line = (
                f"{self._log_prefix} Cycle summary: "
                f"progress={int(queue_progress.get('done') or 0)}/"
                f"{int(queue_progress.get('total') or 0)} "
                f"succeeded={succeeded} failed={failed}"
            )
            if skipped:
                line += f" skipped={skipped}"
            (ColorPrint.green if failed == 0 else ColorPrint.yellow)(line)
            self._log_event(
                "cycle_summary",
                f"processed={processed} ok={succeeded} fail={failed} skipped={skipped}",
                mirror=not self.BATCH_LANE,
            )
        except Exception as e:  # noqa: BLE001 - never raise out of the cycle thread
            ColorPrint.red(f"{self._log_prefix} Cycle error: {e}")
        finally:
            THREAD_BUS.signal(self._cycle_signal, False)
            self._drain_guard.set(False)
            if len(self._queue) > 0 and not self._lane_halt_requested():
                # Tasks dispatched mid-cycle remain queued - run ONE follow-up
                # drain so they are not stuck behind the next RPC dispatch.
                self._start_drain()
            elif self._is_enabled() and not self._lane_halt_requested() and self._pull_capacity() > 0:
                self.request_pull()

    # -------------------- introspection --------------------

    def _delivery_outbox_stats(self) -> Dict[str, Any]:
        """Outbox stats; a failing store read degrades to an error field so
        the lane status stays readable."""
        try:
            return laravel_delivery_outbox.stats(self._delivery_kind)
        except Exception as e:  # noqa: BLE001 - status must never raise
            ColorPrint.yellow(f"{self._log_prefix} outbox stats read failed ({self._delivery_kind}): {e}")
            return {"kind": self._delivery_kind, "error": str(e)}

    def live_counts(self) -> Dict[str, Any]:
        """Cheap queue counters for the live monitor (no outbox or sqlite read)."""
        counts: Dict[str, Any] = {
            "queued": len(self._queue),
            "processing": int(self._state_snapshot()["processing"]),
            "cycle_running": bool(THREAD_BUS.get_signal(self._cycle_signal, False)),
        }
        if self.LANE == "word":
            counts["backend_progress"] = word_audio_backend_progress.snapshot()
        return counts

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
            "inflight_tasks": self.inflight_count(),
            "result_backlog": self._result_backlog(),
            "circuit_open": self.results_blocked(),
            **self.intake_status(),
            "initialized": self._initialized,
            "delivery_outbox_running": laravel_delivery_outbox.running(self._delivery_kind),
            "delivery_outbox": self._delivery_outbox_stats(),
            "usable_engines": list(self._usable_engines_cache),
            "planned_engine": (
                runtime_profile.WORD_BATCH_ENGINE
                if self.BATCH_LANE
                else self._required_engine() or self._engine_probe_cache or None
            ),
        }
        if self.BATCH_LANE:
            status["batch_running"] = running
            status["batch_engine"] = runtime_profile.WORD_BATCH_ENGINE
            status["batch_profile"] = runtime_profile.WORD_BATCH_PROFILE
            status["batch_device"] = runtime_profile.WORD_BATCH_DEVICE
            status["batch_size"] = batch_constants.group_size()
            status["kokoro_live"] = kokoro_live_view()
        if self.LANE == "word":
            status["backend_progress"] = word_audio_backend_progress.snapshot()
        status["queue_progress"] = dict(self._queue_progress.get(self.QUEUE_KEY) or {})
        status["work_leases"] = self._leases.status()
        return status

    def lane_payload(self, task_type: str) -> Dict[str, Any]:
        return {**super().lane_payload(task_type), "leases": self._leases.status()}


class LaravelWordAudioWorker(BaseLaravelAudioWorker):
    """Word-audio lane: global_tasks task_type word_audio on remote_audio."""

    LANE = "word"
    QUEUE_KEY = GLOBAL_TASK_TYPES_BY_KEY["word_audio"]["key"]
    CAPABILITY = "audio"
    PRIORITY_PROFILE = runtime_profile.WORD_BATCH_PROFILE
    ASSIST_CAPABILITY = "tts"
    WORKER_NAME_TAG = "word-audio"
    LOG_PREFIX = "[WordAudioWorker]"
    STATE_OWNER_KEY = "tts.word_audio_worker.state"
    STATE_OWNER_NAME = "WordAudioWorkerState"
    STATE_OWNER_TIMEOUT = 180.0
    REPORT_PATH = queue_center_endpoint("audio_word_report")
    CONCURRENCY_DEFAULT = TTS_WORKER_CONCURRENCY
    LOG_ACCEPTED_RESULTS = False
    PROGRESS_EVENTS_ENABLED = True

    def record_queue_progress(self, task_type: str, progress: Any) -> None:
        super().record_queue_progress(task_type, progress)
        if task_type == self.QUEUE_KEY and isinstance(progress, dict):
            word_audio_backend_progress.apply_template(progress)


class LaravelSentenceAudioWorker(BaseLaravelAudioWorker):
    """Sentence-audio lane: global_tasks task_type sentence_audio on remote_sentence_audio.

    SPECIAL OPTIMIZATION (specially optimized script):
    this lane is contract-tiered (queue_center_contract.json language_priority
    = ["en"]) so the remote Laravel claim head completes ALL English sentence
    tasks before any other language, and every log line mirrors the remote
    English completion progress pulled from Laravel (progress.languages).
    Do not generalize this lane's logging/tiering away - it is intentionally
    optimized for the English-first sentence backlog requirement.
    """

    LANE = "sentence"
    BATCH_LANE = False
    HISTORY_WORKER = "tts_sentence_worker"
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
    REPORT_PATH = queue_center_endpoint("audio_sentence_report")
    CONCURRENCY_DEFAULT = TTS_SENTENCE_WORKER_CONCURRENCY
    # Qwen3-TTS is a managed HTTP server with its own FIFO queue; allow the
    # shared worker fan-out to keep multiple local sentences in flight.
    CONCURRENCY_LIMIT = 3
    CAPACITY_BUFFER_FACTOR = 2


class LaravelPhraseAudioWorker(BaseLaravelAudioWorker):
    """Phrase-audio lane: work leases of lane phrase_audio on remote_phrase_audio.

    Word-batch lane: the same CPU Kokoro batch engine and drain as the word
    lane, no sentence quality floor; clips are identified by the media
    content id and delivered through the phrase report (``audio_phrase_report``)."""

    LANE = "phrase"
    BATCH_LANE = True
    HISTORY_WORKER = "tts_phrase_worker"
    QUEUE_KEY = GLOBAL_TASK_TYPES_BY_KEY["phrase_audio"]["key"]
    RESULT_TASK_TYPE = QUEUE_KEY
    CAPABILITY = "phrase_audio"
    PRIORITY_PROFILE = runtime_profile.WORD_BATCH_PROFILE
    ASSIST_CAPABILITY = "phrase_audio"
    WORKER_ID_PREFIX = "pycore-phrase"
    WORKER_NAME_TAG = "phrase-audio"
    LOG_PREFIX = "[PhraseAudioWorker]"
    STATE_OWNER_KEY = "tts.phrase_audio_worker.state"
    STATE_OWNER_NAME = "PhraseAudioWorkerState"
    STATE_OWNER_TIMEOUT = 180.0
    REPORT_PATH = queue_center_endpoint("audio_phrase_report")
    CONCURRENCY_DEFAULT = TTS_WORKER_CONCURRENCY
    LOG_ACCEPTED_RESULTS = False
    PROGRESS_EVENTS_ENABLED = True


laravel_word_audio_worker = LaravelWordAudioWorker()
laravel_sentence_audio_worker = LaravelSentenceAudioWorker()
laravel_phrase_audio_worker = LaravelPhraseAudioWorker()
