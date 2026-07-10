# -*- coding: utf-8 -*-
"""
TTS Sentence-Audio Worker Service

A pycore worker that drives laravel_main's SENTENCE-library audio queue. It
mirrors the word-generation worker (``tts_queue_poller_service.py``) but adds the
single-priority-queue requirement of the sentence-audio pipeline (§5.3): every
sentence task claimed — across ANY number of claim batches — is merged into ONE
in-process max-heap keyed on ``priority``, so a high-priority user request always
jumps ahead of lower-priority backfill regardless of which batch it arrived in.

------------------------------------------------------------------------------
Laravel contract (laravel_main, app_qy_v1 — see SENTENCE_AUDIO_GENERATION_PIPELINE.md)
------------------------------------------------------------------------------
  POST {base}/api/app_qy_v1/ai_tools/tts/sentence/claim          (json)   §4.1
       { worker_id: str, language?: str, limit?: int <= 50 }
       -> { success, data: { count, lock_stale_minutes,
              tasks: [ { task_id:int, type:'sentence', sentence_id:str,
                content_id:str|null, content:str, language:str,
                audio_relative_path:str, priority:int } ] } }
       Selection = has_audio=false AND not leased, ordered priority DESC, id ASC.

  POST {base}/api/app_qy_v1/ai_tools/tts/sentence/report         (multipart)  §4.2
       success: { task_id, worker_id, sentence_id, success:'true',
                  provider:str, audio: file (MP3, required on success) }
       failure: { task_id, worker_id, sentence_id, success:'false',
                  provider, error }
       -> 200 {success:true,...} | 422 validation reject | 404 unknown task.

------------------------------------------------------------------------------
Architecture (mirrors tts_queue_poller_service.py conventions)
------------------------------------------------------------------------------
  * Singleton service registered as a PyHeartbeat callback (interval
    Config.TTS_SENTENCE_WORKER_INTERVAL), toggled at runtime via
    POST /api/heartbeat/enable|disable/tts_sentence_worker. ENABLED ON START by
    default (Config.TTS_SENTENCE_WORKER_ENABLED_ON_START, env
    PYCORE_TTS_SENTENCE_WORKER=1|0); batch size via
    Config.TTS_SENTENCE_WORKER_BATCH (env PYCORE_TTS_SENTENCE_WORKER_BATCH).
  * The heartbeat callback (poll_and_process) stays LIGHT: it hands one
    claim+drain cycle to ONE background daemon thread. A non-reentrant in-flight
    guard ensures at most one cycle runs at a time, which also guarantees
    sentences are synthesized SEQUENTIALLY (edge-tts holds a process-wide
    no-concurrency lock — tasks must never synth in parallel).
  * §5.3 single priority queue: each cycle claims a batch and PUSHES every task
    into a shared heapq ordered by (-priority, seq). The cycle then POPS items
    by priority and synthesizes them one at a time. Because the heap persists on
    the instance, a high-priority task claimed in a later batch can still be
    popped before lower-priority leftovers — exactly the "user request outranks
    backfill regardless of claim batch" rule.
  * Laravel base URL resolves via the stored-first LaravelEndpointManager (same
    resolution the word worker + media-sync use).
  * Local MP3 validation REUSES the word worker's ``_validate_mp3`` (exists,
    >= 100 bytes, ID3 / 0xFF frame-sync) so bad output is reported as a failure
    instead of being uploaded and 422-rejected.
  * Logging only via ColorPrint. Laravel-down logs ONE concise warning per state
    change (warn-once + green recovery line), never a traceback per tick.
    Networking uses the lazy third-party ``requests`` accessor.
  * All imports at file top (PYTHON_PYCORE.md §1.4); callmodule -> pyutils /
    pyfoundations only.
"""

import heapq
import os
import socket
import tempfile
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ColorPrint is the only allowed logger in pycore services.
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
# requests is a third-party dep — always obtained through the lazy accessor.
from pycore.pyfoundations.third_party import get_third_package_requests
# Env-backed callmodule config (TTS_SENTENCE_WORKER_* knobs live beside the word
# worker's TTS_WORKER_* in callmodule_config/config.py).
from pycore.callmodule.callmodule_config import Config
# Stored-first multi-endpoint manager — the SAME base-URL resolution the
# word worker and media-sync service use.
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    get_laravel_endpoint_manager,
)
# ONE entry point for synthesis; engine priority (edge -> sherpa -> melotts ->
# gptsovits -> azure) and edge's process-wide serialization live in the orchestrator.
from pycore.pyutils.tts import tts_orchestrator
# REUSE the word worker's local MP3 validation (identical to the server's check).
from pycore.callmodule.services.tts_queue_poller_service import _validate_mp3


# --------------------------------------------------------------------------- #
# Constants                                                                    #
# --------------------------------------------------------------------------- #
CLAIM_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/claim"
REPORT_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/report"

# HTTP timeouts (seconds). Claim is a cheap DB lock; report uploads a small MP3.
_CLAIM_TIMEOUT = 15
_REPORT_TIMEOUT = 60

# Server hard cap on the claim batch (contract: limit <= 50).
_MAX_BATCH = 50


class _PriorityQueue:
    """In-process max-heap on ``priority`` with FIFO tie-break by claim order.

    heapq is a MIN-heap, so the key is ``(-priority, seq)``: higher priority is
    popped first, and within an equal priority the earliest-claimed item (lowest
    monotonic ``seq``) wins — preserving FIFO across all claim batches.
    """

    def __init__(self) -> None:
        self._heap: List[Tuple[int, int, Dict[str, Any]]] = []
        self._seq = 0
        self._lock = threading.Lock()

    def push(self, task: Dict[str, Any]) -> None:
        """Add one task; ``priority`` defaults to 0 when absent/non-numeric."""
        try:
            priority = int(task.get("priority") or 0)
        except (TypeError, ValueError):
            priority = 0
        with self._lock:
            heapq.heappush(self._heap, (-priority, self._seq, task))
            self._seq += 1

    def pop(self) -> Optional[Dict[str, Any]]:
        """Pop the highest-priority task (FIFO within equal priority), or None."""
        with self._lock:
            if not self._heap:
                return None
            return heapq.heappop(self._heap)[2]

    def __len__(self) -> int:
        with self._lock:
            return len(self._heap)


class TTSSentenceWorkerService:
    """
    TTS sentence-audio worker (Singleton).

    Lifecycle per heartbeat tick (when enabled):
      poll_and_process() -> spawn ONE background cycle thread (skipped if the
      previous cycle is still running) -> claim up to ``batch_size`` sentence
      tasks -> PUSH all into the shared priority queue -> POP by priority and,
      per task SEQUENTIALLY: synthesize MP3 -> validate locally -> report
      (multipart upload / failure) -> per-cycle summary line.

    Idempotent: __init__ and registration are safe to run repeatedly; an
    unfinished claim re-pends server-side after lock_stale_minutes.
    """

    _instance: Optional["TTSSentenceWorkerService"] = None
    _instance_lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        """Singleton — one sentence-audio worker per process."""
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, laravel_api_url: str = ""):
        """
        Initialize the worker (idempotent — safe to call repeatedly).

        Args:
            laravel_api_url: optional explicit Laravel base URL OVERRIDE. Empty
                (the default) means resolve via the stored-first
                LaravelEndpointManager — the same resolution media-sync uses.
        """
        if getattr(self, "_initialized", False):
            return

        self._base_override = (laravel_api_url or "").strip().rstrip("/")
        self.worker_id = self._build_worker_id()
        # Config knobs (env: PYCORE_TTS_SENTENCE_WORKER / _BATCH / _INTERVAL).
        # `enabled` is the configured START-STATE; the live on/off switch is the
        # PyHeartbeat callback flag (heartbeat management router).
        self.enabled = bool(
            getattr(Config, "TTS_SENTENCE_WORKER_ENABLED_ON_START", True)
        )
        self.batch_size = max(
            1, min(_MAX_BATCH, int(getattr(Config, "TTS_SENTENCE_WORKER_BATCH", 10)))
        )

        # §5.3 ONE shared priority queue across ALL claim batches.
        self._queue = _PriorityQueue()

        # ONE cycle at a time: also guarantees SEQUENTIAL synthesis (edge-tts
        # must never run concurrently).
        self._cycle_running = False
        self._cycle_lock = threading.Lock()

        # Connection-failure bookkeeping — ONE concise warning per state change
        # instead of a traceback every tick.
        self._conn_fail_streak = 0
        self._conn_unreachable_warned = False

        # Lifetime + live counters (introspection / FE status).
        self._total_claimed = 0
        self._total_succeeded = 0
        self._total_failed = 0
        # `processing` = the task currently mid-synthesis (0 or 1, sequential).
        self._processing = 0
        # `leased` = claimed-but-not-yet-synthesized (still in the queue).
        self._last_cycle_summary: Dict[str, Any] = {}

        # Scratch dir for synthesized MP3s (cleaned per task).
        self._tmp_dir = os.path.join(tempfile.gettempdir(), "pycore_tts_sentence_worker")

        self._initialized = True
        ColorPrint.green(
            f"[TTSSentenceWorker] Service initialized (worker_id={self.worker_id}, "
            f"batch={self.batch_size}, enabled_on_start={self.enabled})"
        )

    # -------------------- identity / plumbing --------------------

    @staticmethod
    def _build_worker_id() -> str:
        """Stable, hostname-based worker id ('pycore-sentence-<host>').

        A distinct prefix from the word worker so Laravel leases the two queues
        independently. PYCORE_WORKER_INSTANCE disambiguates two pycore processes
        on the same host (same env the word/translation workers honour).
        """
        host = socket.gethostname() or "host"
        safe = "".join(c if (c.isalnum() or c in "-_") else "-" for c in host).lower()
        instance = (os.getenv("PYCORE_WORKER_INSTANCE") or "").strip()
        if instance:
            safe_instance = "".join(
                c if (c.isalnum() or c in "-_") else "-" for c in instance
            ).lower()
            return f"pycore-sentence-{safe}-{safe_instance}"
        return f"pycore-sentence-{safe}"

    def _base_url(self) -> str:
        """Laravel base URL — explicit override, else endpoint-manager resolve."""
        if self._base_override:
            return self._base_override
        return get_laravel_endpoint_manager().resolve()

    @staticmethod
    def _requests():
        """Lazily obtain the third-party requests module (pycore rule)."""
        return get_third_package_requests()

    @staticmethod
    def _short_err(exc: Exception) -> str:
        """Condense a noisy requests exception into a one-line reason."""
        name = type(exc).__name__
        text = str(exc)
        low = text.lower()
        if "refused" in low or "ConnectionRefused" in name:
            return "connection refused (Laravel not listening)"
        if "timed out" in low or "timeout" in low:
            return "timed out"
        if "max retries" in low or "failed to establish" in low:
            return "host unreachable"
        if "getaddrinfo" in low or "name or service not known" in low:
            return "host not resolvable"
        return text.splitlines()[0][:120] if text else name

    def _note_laravel_ok(self, base: str) -> None:
        """A Laravel call succeeded — emit ONE recovery line if we were down."""
        if self._conn_unreachable_warned:
            ColorPrint.green(
                f"[TTSSentenceWorker] Laravel reachable again at {base} "
                f"(after {self._conn_fail_streak} failed tick(s))"
            )
        self._conn_fail_streak = 0
        self._conn_unreachable_warned = False

    def _note_laravel_down(self, base: str, reason: str) -> None:
        """A Laravel call failed — warn ONCE, then stay quiet until recovery."""
        self._conn_fail_streak += 1
        if not self._conn_unreachable_warned:
            self._conn_unreachable_warned = True
            ColorPrint.yellow(
                f"[TTSSentenceWorker] Laravel unreachable at {base} ({reason}). "
                "Will keep retrying quietly each tick."
            )

    # -------------------- Laravel worker API --------------------

    def _claim_tasks(self, base: str) -> Optional[List[Dict[str, Any]]]:
        """POST /tts/sentence/claim. Returns the task list, or None when Laravel
        could not be reached / answered abnormally (logged per state change)."""
        requests = self._requests()
        try:
            resp = requests.post(
                base + CLAIM_PATH,
                json={"worker_id": self.worker_id, "limit": self.batch_size},
                timeout=_CLAIM_TIMEOUT,
            )
        except Exception as e:
            self._note_laravel_down(base, self._short_err(e))
            return None
        if resp.status_code != 200:
            self._note_laravel_down(base, f"claim -> HTTP {resp.status_code}")
            return None
        self._note_laravel_ok(base)
        try:
            body = resp.json() or {}
        except ValueError:
            ColorPrint.yellow(
                "[TTSSentenceWorker] Claim returned non-JSON body — skipping tick"
            )
            return None
        data = body.get("data") if isinstance(body.get("data"), dict) else body
        return list((data or {}).get("tasks") or [])

    def fetch_queue_summary(self) -> Dict[str, Any]:
        """POST /tts/sentence/claim with limit=0 — Laravel pending/leased counts."""
        base = self._base_url()
        if not base:
            return {}
        requests = self._requests()
        try:
            resp = requests.post(
                base + CLAIM_PATH,
                json={"worker_id": self.worker_id, "limit": 0},
                timeout=_CLAIM_TIMEOUT,
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
        if not isinstance(data, dict):
            return {}
        return {
            "pending": int(data.get("pending") or 0),
            "leased": int(data.get("leased") or 0),
            "count": int(data.get("count") or 0),
        }

    def _report(
        self,
        base: str,
        task: Dict[str, Any],
        success: bool,
        provider: str,
        error: str = "",
        audio_path: str = "",
        variant_key: str = "",
    ) -> Tuple[bool, str]:
        """POST /tts/sentence/report (multipart upload on success, fields-only on
        failure). Returns ``(accepted, detail)``; never raises."""
        requests = self._requests()
        content_id = (task.get("content_id") or task.get("sentence_id") or "").strip()
        language = (task.get("language") or "en").strip() or "en"
        task_id = task.get("task_id")
        fields = {
            "task_id": str(task_id),
            "worker_id": self.worker_id,
            "content_id": content_id,
            "language": language,
            "sentence_id": (task.get("sentence_id") or content_id or ""),
            "success": "true" if success else "false",
            "provider": provider or "none",
        }
        if variant_key:
            fields["variant_key"] = variant_key
        if not success:
            fields["error"] = (error or "unknown error")[:500]
        try:
            if success:
                with open(audio_path, "rb") as fh:
                    resp = requests.post(
                        base + REPORT_PATH,
                        data=fields,
                        files={"audio": (os.path.basename(audio_path), fh, "audio/mpeg")},
                        timeout=_REPORT_TIMEOUT,
                    )
            else:
                resp = requests.post(
                    base + REPORT_PATH, data=fields, timeout=_REPORT_TIMEOUT
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

    # -------------------- task processing (SEQUENTIAL, by priority) --------------------

    def _synthesize_variant(
        self,
        task: Dict[str, Any],
        variant: Dict[str, Any],
    ) -> Tuple[bool, str, str, str]:
        """Generate one variant MP3. Returns (ok, path, provider, error)."""
        content = (task.get("content") or "").strip()
        language = (task.get("language") or "en").strip() or "en"
        if not content:
            return False, "", "none", "task has empty content"

        accent = variant.get("accent")
        gender = variant.get("gender") or "female"
        vkey = (variant.get("key") or "").strip()
        os.makedirs(self._tmp_dir, exist_ok=True)
        key = task.get("content_id") or task.get("sentence_id") or "audio"
        suffix = f"_{vkey}" if vkey else ""
        name = f"{task.get('task_id')}_{key}{suffix}.mp3"
        out_path = os.path.join(self._tmp_dir, name)

        result = tts_orchestrator.synthesize(
            content, language, Path(out_path),
            accent=accent if accent else None,
            gender=gender,
        )
        provider = result.get("engine") or ((result.get("tried") or ["none"])[-1])
        if not result.get("success"):
            return False, out_path, provider, result.get("error") or "synthesis failed"

        ok, why = _validate_mp3(out_path)
        if not ok:
            return False, out_path, provider, f"invalid audio from {provider}: {why}"
        return True, out_path, provider, ""

    def _synthesize_task(self, task: Dict[str, Any]) -> Tuple[bool, str, str, str]:
        """Generate the primary sentence MP3 (first variant only)."""
        variants = task.get("variants") or [{"key": "", "accent": None, "gender": "female"}]
        primary = variants[0] if variants else {"key": "", "accent": None, "gender": "female"}
        return self._synthesize_variant(task, primary)

    def _process_one(self, base: str, task: Dict[str, Any]) -> bool:
        """Synthesize + report ONE task (all language variants). Returns True on primary success."""
        task_id = task.get("task_id")
        variants = task.get("variants") or [{"key": "", "accent": None, "gender": "female"}]
        primary_ok = False
        audio_paths: List[str] = []
        with self._cycle_lock:
            self._processing += 1
        try:
            for variant in variants:
                ok, audio_path, provider, err = self._synthesize_variant(task, variant)
                if audio_path:
                    audio_paths.append(audio_path)
                vkey = (variant.get("key") or "").strip()
                if ok:
                    accepted, detail = self._report(
                        base, task, True, provider, audio_path=audio_path, variant_key=vkey
                    )
                    if accepted and not vkey:
                        primary_ok = True
                        ColorPrint.green(
                            f"[TTSSentenceWorker] Task {task_id} "
                            f"'{(task.get('content') or '')[:30]}' "
                            f"(p={task.get('priority')}) done via {provider}"
                        )
                    elif not accepted:
                        ColorPrint.yellow(
                            f"[TTSSentenceWorker] Task {task_id} variant '{vkey or 'primary'}' "
                            f"upload rejected ({detail})"
                        )
                else:
                    ColorPrint.yellow(
                        f"[TTSSentenceWorker] Task {task_id} variant '{vkey or 'primary'}' failed: {err}"
                    )
                    self._report(base, task, False, provider, error=err, variant_key=vkey)
            if not primary_ok and variants:
                return False
            return primary_ok
        except Exception as e:  # noqa: BLE001 — one task must not kill the cycle
            ColorPrint.red(f"[TTSSentenceWorker] Task {task_id} error: {e}")
            return False
        finally:
            with self._cycle_lock:
                self._processing = max(0, self._processing - 1)
            for audio_path in audio_paths:
                if audio_path:
                    try:
                        os.remove(audio_path)
                    except OSError:
                        pass

    def _run_cycle(self) -> None:
        """One claim + priority-drain cycle. Claims a batch, merges it into the
        shared priority queue, then POPS and processes every queued task
        SEQUENTIALLY by priority (edge-tts holds a process-wide lock — tasks must
        never synth in parallel). Runs on a background daemon thread; fully
        exception-safe."""
        try:
            base = self._base_url()
            tasks = self._claim_tasks(base)
            if tasks is None:
                # Laravel down / abnormal — already logged per state change. Still
                # drain any leftover queued items so prior batches make progress.
                if len(self._queue) == 0:
                    return
            else:
                for task in tasks:
                    self._queue.push(task)
                if tasks:
                    ColorPrint.blue(
                        f"[TTSSentenceWorker] Claimed {len(tasks)} task(s) from {base} "
                        f"(queue depth now {len(self._queue)})"
                    )

            if len(self._queue) == 0:
                return  # nothing pending — stay quiet

            processed = 0
            succeeded = 0
            failed = 0
            while True:
                task = self._queue.pop()
                if task is None:
                    break
                processed += 1
                if self._process_one(base, task):
                    succeeded += 1
                else:
                    failed += 1

            if processed == 0:
                return

            self._total_claimed += processed
            self._total_succeeded += succeeded
            self._total_failed += failed
            self._last_cycle_summary = {
                "processed": processed,
                "succeeded": succeeded,
                "failed": failed,
                "at": int(time.time()),
            }
            line = (
                f"[TTSSentenceWorker] Cycle summary: processed={processed} "
                f"succeeded={succeeded} failed={failed}"
            )
            (ColorPrint.green if failed == 0 else ColorPrint.yellow)(line)
        except Exception as e:  # noqa: BLE001 — never raise out of the cycle thread
            ColorPrint.red(f"[TTSSentenceWorker] Cycle error: {e}")
        finally:
            with self._cycle_lock:
                self._cycle_running = False

    # -------------------- heartbeat callback --------------------

    def poll_and_process(self) -> None:
        """
        PyHeartbeat callback (every Config.TTS_SENTENCE_WORKER_INTERVAL seconds
        when the callback is enabled).

        LIGHT by design: spawn one background cycle thread; skip the tick when
        the previous cycle is still running (keeps synthesis strictly
        sequential and the single priority queue coherent). Enable/disable is
        governed by the PyHeartbeat callback flag (start-state from
        Config.TTS_SENTENCE_WORKER_ENABLED_ON_START, runtime via
        /api/heartbeat/enable|disable/tts_sentence_worker). Exception-safe — it
        must never raise into the heartbeat loop.
        """
        try:
            with self._cycle_lock:
                if self._cycle_running:
                    return  # previous cycle still in flight — stay sequential
                self._cycle_running = True

            threading.Thread(
                target=self._run_cycle,
                daemon=True,
                name="tts-sentence-worker-cycle",
            ).start()
        except Exception as e:  # noqa: BLE001 — heartbeat must never see a raise
            with self._cycle_lock:
                self._cycle_running = False
            ColorPrint.red(f"[TTSSentenceWorker] poll_and_process error: {e}")

    # -------------------- introspection --------------------

    def get_status(self) -> Dict[str, Any]:
        """Service status snapshot (read-only).

        Surfaces the §4.4 counts for the FE: ``queued`` (waiting in the priority
        heap), ``leased`` (claimed-but-unsynthesized — same as queued depth in
        this in-process model), and ``processing`` (the one task mid-synthesis).
        """
        with self._cycle_lock:
            running = self._cycle_running
            processing = self._processing
        queued = len(self._queue)
        return {
            "service": "TTS Sentence-Audio Worker",
            "worker_id": self.worker_id,
            "enabled_on_start": self.enabled,
            "batch_size": self.batch_size,
            "cycle_running": running,
            "base_url_override": self._base_override or None,
            # §4.4 queue counts for the FE.
            "queued": queued,
            "leased": queued,
            "processing": processing,
            "total_claimed": self._total_claimed,
            "total_succeeded": self._total_succeeded,
            "total_failed": self._total_failed,
            "last_cycle": dict(self._last_cycle_summary),
            "initialized": self._initialized,
        }


# Global singleton accessor function
def get_tts_sentence_worker_service(laravel_api_url: str = "") -> TTSSentenceWorkerService:
    """
    Get the TTS Sentence-Audio Worker singleton (idempotent).

    Args:
        laravel_api_url: optional explicit Laravel base URL OVERRIDE; empty
            means resolve via the stored-first LaravelEndpointManager (the same
            resolution the word worker and media-sync service use).

    Returns:
        The shared TTSSentenceWorkerService instance.
    """
    return TTSSentenceWorkerService(laravel_api_url)
