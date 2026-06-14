# -*- coding: utf-8 -*-
"""
TTS Queue Worker Service (formerly a placeholder "queue poller")

A pycore worker that drives laravel_main's word-generation TTS queue. Each
heartbeat tick it CLAIMS a batch of pending word tasks, synthesizes an MP3 per
task with the TTS orchestrator (engine priority edge -> sherpa -> melotts ->
gptsovits, built into pyutils/tts/tts_orchestrator.py) and REPORTS each result
back — a multipart MP3 upload on success, a `success=false` + error otherwise.

------------------------------------------------------------------------------
Laravel contract (laravel_main, app_qy_v1 — the laravel side is DONE)
------------------------------------------------------------------------------
  POST {base}/api/app_qy_v1/ai_tools/tts/worker/claim          (json)
       { worker_id: str, language?: str, limit?: int <= 50 }
       -> { success, data: { count, tasks: [ { task_id:int, type:'word',
              content:str, md5:str, language:str, audio_relative_path:str } ],
              lock_stale_minutes: 10 } }
       Claimed rows are locked for 10 minutes; finish them or they re-pend.

  POST {base}/api/app_qy_v1/ai_tools/tts/worker/report         (multipart)
       fields: task_id:int, worker_id:str, success:'true'|'false',
               provider:str, error?:str, audio: file (MP3, required on success)
       -> 200 {success:true, status:'completed', audio_path}
        | 422 validation reject (empty / <100 bytes / not MP3)
        | 404 unknown task.
       Failure reports send success='false' + error and NO file.

------------------------------------------------------------------------------
Architecture (mirrors translation_worker_service.py conventions)
------------------------------------------------------------------------------
  * Singleton service registered as a PyHeartbeat callback (interval 60s),
    toggled at runtime via POST /api/heartbeat/enable|disable/tts_queue_poller.
    ENABLED ON START by default (Config.TTS_WORKER_ENABLED_ON_START, env
    PYCORE_TTS_WORKER=1|0); batch size via Config.TTS_WORKER_BATCH (env
    PYCORE_TTS_WORKER_BATCH, default 10, server cap 50).
  * The heartbeat callback (poll_and_process) stays LIGHT: it only hands the
    claim+synthesize+report batch to ONE background daemon thread. A
    non-reentrant in-flight guard ensures at most one batch runs at a time —
    which also guarantees the tasks are processed SEQUENTIALLY (edge-tts has a
    process-wide no-concurrency lock; tasks must NEVER synth in parallel, so we
    deliberately do NOT fan tasks out to the TaskManager like the translation
    worker does).
  * Laravel base URL resolves the SAME way the media-sync service does: via the
    stored-first LaravelEndpointManager (probe persisted endpoint -> parallel
    sweep -> persist + cache), so worker and sync always agree on the host.
  * Local validation MIRRORS the server's checks (exists, >=100 bytes, starts
    with b'ID3' or an MPEG frame-sync 0xFF/0xEx) so bad output is reported as a
    failure with an error message instead of being uploaded and 422-rejected.
  * Logging only via ColorPrint (pycore rule). Laravel being down logs ONE
    concise warning per state change (warn-once + green recovery line), never a
    traceback per tick. Networking uses the lazily-loaded third-party
    ``requests`` accessor (never a bare import).
  * All imports at file top (PYTHON_PYCORE.md §1.4); callmodule -> pyutils /
    pyfoundations only (never the reverse).
"""

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
# Env-backed callmodule config (TTS_WORKER_* knobs live beside the translation
# worker's in callmodule_config/config.py).
from pycore.callmodule.callmodule_config import Config
# Stored-first multi-endpoint manager — the SAME base-URL resolution the
# media-sync service (services/sync/laravel_media_sync.py) uses.
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    get_laravel_endpoint_manager,
)
# ONE entry point for synthesis; engine priority (edge -> sherpa -> melotts ->
# gptsovits) and edge's process-wide serialization live inside the orchestrator.
from pycore.pyutils.tts import tts_orchestrator


# --------------------------------------------------------------------------- #
# Constants                                                                    #
# --------------------------------------------------------------------------- #
CLAIM_PATH = "/api/app_qy_v1/ai_tools/tts/worker/claim"
REPORT_PATH = "/api/app_qy_v1/ai_tools/tts/worker/report"

# HTTP timeouts (seconds). Claim is a cheap DB lock; report uploads a small MP3.
_CLAIM_TIMEOUT = 15
_REPORT_TIMEOUT = 60

# Server-mirrored validation floor: the Laravel report endpoint 422-rejects
# anything below 100 bytes or without an MP3 signature.
_MIN_MP3_BYTES = 100

# Server hard cap on the claim batch (contract: limit <= 50).
_MAX_BATCH = 50


def _validate_mp3(path: str) -> Tuple[bool, str]:
    """Local mirror of the server's MP3 validation. Returns ``(ok, error)``.

    Checks: file exists, >= 100 bytes, and starts with b'ID3' (ID3v2 tag) or an
    MPEG frame-sync (first byte 0xFF, second byte's top 3 bits set: 0xEx). Bad
    output must be reported as a FAILURE with this error, never uploaded.
    """
    if not (path and os.path.isfile(path)):
        return False, "no audio file produced"
    try:
        size = os.path.getsize(path)
        if size < _MIN_MP3_BYTES:
            return False, f"audio too small ({size} bytes < {_MIN_MP3_BYTES})"
        with open(path, "rb") as fh:
            head = fh.read(3)
    except OSError as e:
        return False, f"audio unreadable ({e})"
    if len(head) < 2:
        return False, "audio truncated (no header)"
    if head[:3] == b"ID3":
        return True, ""
    if head[0] == 0xFF and (head[1] & 0xE0) == 0xE0:
        return True, ""
    return False, f"not MP3 (header {head[:3].hex()})"


class TTSQueuePollerService:
    """
    TTS queue worker (Singleton).

    Lifecycle per heartbeat tick (when enabled):
      poll_and_process() -> spawn ONE background batch thread (skipped if the
      previous batch is still running) -> claim up to `batch_size` tasks ->
      per task SEQUENTIALLY: synthesize MP3 -> validate locally -> report
      (multipart upload / failure) -> per-tick summary line.

    Idempotent: __init__ and registration are safe to run repeatedly; an
    unfinished claim re-pends server-side after lock_stale_minutes (10).
    """

    _instance: Optional["TTSQueuePollerService"] = None
    _instance_lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        """Singleton — one TTS worker per process."""
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
        # Config knobs (env: PYCORE_TTS_WORKER / PYCORE_TTS_WORKER_BATCH).
        # `enabled` is the configured START-STATE; the live on/off switch is the
        # PyHeartbeat callback flag (heartbeat management router).
        self.enabled = bool(getattr(Config, "TTS_WORKER_ENABLED_ON_START", True))
        self.batch_size = max(1, min(_MAX_BATCH,
                                     int(getattr(Config, "TTS_WORKER_BATCH", 10))))

        # ONE batch at a time: also guarantees SEQUENTIAL task processing
        # (edge-tts must never run concurrently).
        self._batch_running = False
        self._batch_lock = threading.Lock()

        # Connection-failure bookkeeping — ONE concise warning per state change
        # instead of a traceback every tick (translation worker pattern).
        self._conn_fail_streak = 0
        self._conn_unreachable_warned = False

        # Lifetime counters (introspection only).
        self._total_claimed = 0
        self._total_succeeded = 0
        self._total_failed = 0
        self._last_tick_summary: Dict[str, Any] = {}

        # Scratch dir for synthesized MP3s (cleaned per task).
        self._tmp_dir = os.path.join(tempfile.gettempdir(), "pycore_tts_worker")

        self._initialized = True
        ColorPrint.green(
            f"[TTSWorker] Service initialized (worker_id={self.worker_id}, "
            f"batch={self.batch_size}, enabled_on_start={self.enabled})"
        )

    # -------------------- identity / plumbing --------------------

    @staticmethod
    def _build_worker_id() -> str:
        """Stable, hostname-based worker id ('pycore-<host>').

        Laravel locks claimed rows per worker_id. Two pycore processes on the
        SAME host should set PYCORE_WORKER_INSTANCE (same env the translation
        worker honours) so their ids do not collide.
        """
        host = socket.gethostname() or "host"
        safe = "".join(c if (c.isalnum() or c in "-_") else "-" for c in host).lower()
        instance = (os.getenv("PYCORE_WORKER_INSTANCE") or "").strip()
        if instance:
            safe_instance = "".join(
                c if (c.isalnum() or c in "-_") else "-" for c in instance
            ).lower()
            return f"pycore-{safe}-{safe_instance}"
        return f"pycore-{safe}"

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
                f"[TTSWorker] Laravel reachable again at {base} "
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
                f"[TTSWorker] Laravel unreachable at {base} ({reason}). "
                "Will keep retrying quietly each tick."
            )

    # -------------------- Laravel worker API --------------------

    def _claim_tasks(self, base: str) -> Optional[List[Dict[str, Any]]]:
        """POST /tts/worker/claim. Returns the task list, or None when Laravel
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
            ColorPrint.yellow("[TTSWorker] Claim returned non-JSON body — skipping tick")
            return None
        data = body.get("data") if isinstance(body.get("data"), dict) else body
        return list((data or {}).get("tasks") or [])

    def _report(
        self,
        base: str,
        task_id: Any,
        success: bool,
        provider: str,
        error: str = "",
        audio_path: str = "",
    ) -> Tuple[bool, str]:
        """POST /tts/worker/report (multipart upload on success, fields-only on
        failure). Returns ``(accepted, detail)``; never raises."""
        requests = self._requests()
        fields = {
            "task_id": str(task_id),
            "worker_id": self.worker_id,
            "success": "true" if success else "false",
            "provider": provider or "none",
        }
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
                resp = requests.post(base + REPORT_PATH, data=fields,
                                     timeout=_REPORT_TIMEOUT)
        except Exception as e:
            return False, self._short_err(e)
        if resp.status_code == 200:
            return True, "ok"
        if resp.status_code == 422:
            return False, f"server validation rejected: {resp.text[:200]}"
        if resp.status_code == 404:
            return False, "unknown task on server (404)"
        return False, f"HTTP {resp.status_code}: {resp.text[:200]}"

    # -------------------- task processing (SEQUENTIAL) --------------------

    def _synthesize_task(self, task: Dict[str, Any]) -> Tuple[bool, str, str, str]:
        """Generate + locally validate one task's MP3.

        Returns ``(ok, audio_path, provider, error)``. ``audio_path`` is a temp
        file the caller must clean up. The local validation mirrors the server
        so invalid output becomes a failure REPORT, not a doomed upload.
        """
        content = (task.get("content") or "").strip()
        language = (task.get("language") or "en").strip() or "en"
        if not content:
            return False, "", "none", "task has empty content"

        os.makedirs(self._tmp_dir, exist_ok=True)
        name = f"{task.get('task_id')}_{task.get('md5') or 'audio'}.mp3"
        out_path = os.path.join(self._tmp_dir, name)

        result = tts_orchestrator.synthesize(content, language, Path(out_path))
        provider = result.get("engine") or (
            (result.get("tried") or ["none"])[-1]
        )
        if not result.get("success"):
            return False, out_path, provider, result.get("error") or "synthesis failed"

        ok, why = _validate_mp3(out_path)
        if not ok:
            return False, out_path, provider, f"invalid audio from {provider}: {why}"
        return True, out_path, provider, ""

    def _process_batch(self) -> None:
        """Claim a batch and process every task SEQUENTIALLY (edge-tts holds a
        process-wide lock — tasks must never synth in parallel). Runs on a
        background daemon thread; fully exception-safe."""
        try:
            base = self._base_url()
            tasks = self._claim_tasks(base)
            if tasks is None:
                return  # Laravel down / abnormal — already logged per state change
            if not tasks:
                return  # nothing pending — stay quiet

            claimed = len(tasks)
            succeeded = 0
            failed = 0
            ColorPrint.blue(f"[TTSWorker] Claimed {claimed} task(s) from {base}")

            for task in tasks:
                task_id = task.get("task_id")
                audio_path = ""
                try:
                    ok, audio_path, provider, err = self._synthesize_task(task)
                    if ok:
                        accepted, detail = self._report(
                            base, task_id, True, provider, audio_path=audio_path
                        )
                        if accepted:
                            succeeded += 1
                            ColorPrint.green(
                                f"[TTSWorker] Task {task_id} "
                                f"'{(task.get('content') or '')[:30]}' done via {provider}"
                            )
                        else:
                            # Upload refused (e.g. server-side 422) — follow up
                            # with an explicit failure report so the task fails
                            # fast instead of waiting out the 10-minute lock.
                            failed += 1
                            ColorPrint.yellow(
                                f"[TTSWorker] Task {task_id} upload rejected ({detail})"
                            )
                            self._report(base, task_id, False, provider,
                                         error=f"audio upload rejected: {detail}")
                    else:
                        failed += 1
                        ColorPrint.yellow(f"[TTSWorker] Task {task_id} failed: {err}")
                        accepted, detail = self._report(
                            base, task_id, False, provider, error=err
                        )
                        if not accepted:
                            ColorPrint.yellow(
                                f"[TTSWorker] Failure report for task {task_id} "
                                f"not accepted ({detail}); lock will re-pend it"
                            )
                except Exception as e:  # noqa: BLE001 — one task must not kill the batch
                    failed += 1
                    ColorPrint.red(f"[TTSWorker] Task {task_id} error: {e}")
                finally:
                    if audio_path:
                        try:
                            os.remove(audio_path)
                        except OSError:
                            pass

            self._total_claimed += claimed
            self._total_succeeded += succeeded
            self._total_failed += failed
            self._last_tick_summary = {
                "claimed": claimed, "succeeded": succeeded, "failed": failed,
                "at": int(time.time()),
            }
            line = (f"[TTSWorker] Tick summary: claimed={claimed} "
                    f"succeeded={succeeded} failed={failed}")
            (ColorPrint.green if failed == 0 else ColorPrint.yellow)(line)
        except Exception as e:  # noqa: BLE001 — never raise out of the batch thread
            ColorPrint.red(f"[TTSWorker] Batch error: {e}")
        finally:
            with self._batch_lock:
                self._batch_running = False

    # -------------------- heartbeat callback --------------------

    def poll_and_process(self) -> None:
        """
        PyHeartbeat callback (every 60s when the callback is enabled).

        LIGHT by design: spawn one background batch thread; skip the tick when
        the previous batch is still running (keeps task processing strictly
        sequential). Enable/disable is governed by the PyHeartbeat callback
        flag (start-state from Config.TTS_WORKER_ENABLED_ON_START, runtime via
        /api/heartbeat/enable|disable/tts_queue_poller) — no second gate here.
        Exception-safe — it must never raise into the heartbeat loop.
        """
        try:
            with self._batch_lock:
                if self._batch_running:
                    return  # previous batch still in flight — stay sequential
                self._batch_running = True

            threading.Thread(
                target=self._process_batch,
                daemon=True,
                name="tts-worker-batch",
            ).start()
        except Exception as e:  # noqa: BLE001 — heartbeat must never see a raise
            with self._batch_lock:
                self._batch_running = False
            ColorPrint.red(f"[TTSWorker] poll_and_process error: {e}")

    # -------------------- introspection --------------------

    def get_status(self) -> Dict[str, Any]:
        """Service status snapshot (read-only)."""
        with self._batch_lock:
            running = self._batch_running
        return {
            "service": "TTS Queue Worker",
            "worker_id": self.worker_id,
            "enabled_on_start": self.enabled,
            "batch_size": self.batch_size,
            "batch_running": running,
            "base_url_override": self._base_override or None,
            "total_claimed": self._total_claimed,
            "total_succeeded": self._total_succeeded,
            "total_failed": self._total_failed,
            "last_tick": dict(self._last_tick_summary),
            "initialized": self._initialized,
        }


# Global singleton accessor function
def get_tts_queue_poller_service(laravel_api_url: str = "") -> TTSQueuePollerService:
    """
    Get the TTS Queue Worker singleton (idempotent).

    Args:
        laravel_api_url: optional explicit Laravel base URL OVERRIDE; empty
            means resolve via the stored-first LaravelEndpointManager (the same
            resolution the media-sync service uses).

    Returns:
        The shared TTSQueuePollerService instance.
    """
    return TTSQueuePollerService(laravel_api_url)
