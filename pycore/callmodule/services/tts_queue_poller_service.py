# -*- coding: utf-8 -*-
"""
TTS Queue Worker Service (formerly a placeholder "queue poller")

A pycore worker that drives laravel_main's word-generation TTS queue. Each
heartbeat tick it CLAIMS a batch of pending word tasks, synthesizes an MP3 per
task with the TTS orchestrator (local-first engine priority in
pyutils/tts/tts_orchestrator.py) and REPORTS each result
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
  * Singleton service registered as a PyHeartbeat callback (interval 60s).
    Pycore UI toggles it only through RPC v2 `ui.heartbeat_workers.config`;
    Pycore owns the callback and the Laravel claim/report HTTP calls.
    ENABLED ON START by default (Config.TTS_WORKER_ENABLED_ON_START, env
    PYCORE_TTS_WORKER=1|0); batch size via Config.TTS_WORKER_BATCH (env
    PYCORE_TTS_WORKER_BATCH, default 10, server cap 50).
  * The heartbeat callback (poll_and_process) stays LIGHT: it only hands the
    claim+synthesize+report batch to ONE background daemon thread. A
    non-reentrant in-flight guard ensures at most one batch runs at a time.
    Serial engines process that batch sequentially; parallel-safe engines use
    bounded named lanes derived from the selected engine's concurrency class.
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
# Live enable flag (the UI toggle lives on the heartbeat callback).
from pycore.pyheartbeat.heartbeat import get_heartbeat_system
# requests is a third-party dep — always obtained through the lazy accessor.
# Unified pycore->Laravel HTTP gateway (times + logs + records every request).
from pycore.callmodule.services.sync.laravel_client import get_laravel_client
# Env-backed callmodule config (TTS_WORKER_* knobs live beside the translation
# worker's in callmodule_config/config.py).
from pycore.callmodule.callmodule_config.config import Config
# Stored-first multi-endpoint manager — the SAME base-URL resolution the
# media-sync service (services/sync/laravel_media_sync.py) uses.
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    get_laravel_endpoint_manager,
    register_endpoint_change_listener,
)
# ONE entry point for synthesis; local-first engine priority and edge's
# process-wide serialization live inside the orchestrator.
import pycore.pyutils.tts.tts_orchestrator as tts_orchestrator
# Per-engine-class worker fan-out recommendation + clamping.
from pycore.callmodule.services.tts_concurrency import (
    effective_concurrency,
    recommended_concurrency,
)
from pycore.callmodule.services.tts_queue_worker_threads import (
    run_tts_worker_lane,
    task_deque,
)
from pycore.pyutils.tts.word_audio_cache import get_cache_path, save_to_cache


# --------------------------------------------------------------------------- #
# Constants                                                                    #
# --------------------------------------------------------------------------- #
CLAIM_PATH = "/api/app_qy_v1/ai_tools/tts/worker/claim"
REPORT_PATH = "/api/app_qy_v1/ai_tools/tts/worker/report"

# HTTP timeouts (seconds). Claim can scan the full word/sentence backlog on a
# large dictionary, so give it room; report uploads a small MP3.
_CLAIM_TIMEOUT = 60
_REPORT_TIMEOUT = 60

# Server-mirrored validation floor: the Laravel report endpoint 422-rejects
# anything below 100 bytes or without an MP3 signature.
_MIN_MP3_BYTES = 100

# Server hard cap on the claim batch (contract: limit <= 50).
_MAX_BATCH = 50

# TTL for the cached tts_status()/best_engine() probe: tts_status() probes ALL
# engines, which is far too expensive to run per task.
_ENGINE_PROBE_TTL_S = 60.0

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
      per task: synthesize MP3 -> validate locally -> report
      (multipart upload / failure) -> per-tick summary line.

    Idempotent: __init__ and registration are safe to run repeatedly; an
    unfinished claim re-pends server-side after lock_stale_minutes (10).
    """

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
        # Worker fan-out override: 0 = use the per-engine recommended value
        # (services/tts_concurrency.py). Live-settable via POST word-tts/config.
        self._concurrency = max(
            0, int(getattr(Config, "TTS_WORKER_CONCURRENCY", 0))
        )
        # Engine probe cache (60s TTL) — see _planned_engine().
        self._engine_probe_cache: Optional[str] = None
        self._engine_probe_ts = 0.0
        self._active_tasks = task_deque([])

        # ONE batch at a time; lifecycle state is exchanged through THREAD_BUS.
        self._batch_running_signal = f"tts_queue_poller.batch_running.{id(self)}"
        THREAD_BUS.signal(self._batch_running_signal, False)

        # Connection-failure bookkeeping — ONE concise warning per state change
        # instead of a traceback every tick (translation worker pattern).
        self._conn_fail_streak = 0
        self._conn_unreachable_warned = False

        # Lifetime counters (introspection only).
        self._total_claimed = 0
        self._total_succeeded = 0
        self._total_failed = 0
        self._last_tick_summary: Dict[str, Any] = {}
        # Activity event log for the FE (mirrors the sentence worker's shape).
        self._events: Deque[Dict[str, Any]] = deque(maxlen=80)
        # Throttle marker for the idle event (epoch seconds of the last one).
        self._last_idle_event_ts = 0.0
        init_serialized_owner(
            self,
            "tts.word_worker.state",
            "TTSWordState",
            timeout=180.0,
        )

        # Scratch dir for synthesized MP3s (cleaned per task).
        self._tmp_dir = os.path.join(tempfile.gettempdir(), "pycore_tts_worker")

        self._initialized = True
        # Register for immediate notification when the user switches endpoint so
        # the conn-fail warning is cleared and the next tick probes the new host.
        register_endpoint_change_listener(self.on_endpoint_changed)
        ColorPrint.green(
            f"[TTSWorker] Service initialized (worker_id={self.worker_id}, "
            f"batch={self.batch_size}, enabled_on_start={self.enabled})"
        )

    def on_endpoint_changed(self, new_url: str) -> None:
        """Reset conn-fail state when the user switches the Laravel endpoint.

        The TTS worker already resolves its base URL live via
        get_laravel_endpoint_manager().resolve() on each tick, so all we need is
        to clear the warn-once gate so any previous unreachable streak does not
        suppress the first log line on the new host.
        """
        self._conn_fail_streak = 0
        self._conn_unreachable_warned = False
        ColorPrint.blue(
            f"[TTSWorker] Endpoint changed \u2192 {new_url!r}; conn-fail state reset"
        )

    @serialized_method
    def _log_event(self, kind: str, detail: str, task: Optional[Dict[str, Any]] = None) -> None:
        """Append one activity event (newest first). Mirrors the sentence
        worker's shape minus the fields word tasks do not carry
        (content_id / priority)."""
        entry: Dict[str, Any] = {
            "at": int(time.time()),
            "kind": kind,
            "detail": detail[:240],
        }
        if task:
            entry["task_id"] = task.get("task_id")
            entry["language"] = task.get("language")
            text = (task.get("content") or "").strip()
            if text:
                entry["text_preview"] = text[:80]
        self._events.appendleft(entry)
        # Mirror every event into the live pycore_log stream (the deque alone
        # never reaches it): failures yellow, idle gray, everything else blue.
        label = f"[TTSWorker] {kind}"
        if task and task.get("task_id") is not None:
            label += f" task={task.get('task_id')}"
        line = f"{label}: {detail[:160]}" if detail else label
        if kind.endswith("_fail") or kind in ("report_reject", "synth_error"):
            ColorPrint.yellow(line)
        elif kind == "idle":
            ColorPrint.gray(line)
        else:
            ColorPrint.blue(line)

    @serialized_method
    def _record_batch(self, claimed: int, succeeded: int, failed: int) -> None:
        self._total_claimed += claimed
        self._total_succeeded += succeeded
        self._total_failed += failed
        self._last_tick_summary = {
            "claimed": claimed,
            "succeeded": succeeded,
            "failed": failed,
            "at": int(time.time()),
        }

    @serialized_method
    def _state_snapshot(self) -> Dict[str, Any]:
        return {
            "total_claimed": self._total_claimed,
            "total_succeeded": self._total_succeeded,
            "total_failed": self._total_failed,
            "last_tick": dict(self._last_tick_summary),
            "events": [dict(event) for event in list(self._events)[:40]],
        }

    @serialized_method
    def set_concurrency(self, concurrency: int) -> None:
        self._concurrency = max(0, int(concurrency))

    @serialized_method
    def get_concurrency(self) -> int:
        return self._concurrency

    # -------------------- engine probe / concurrency --------------------

    @serialized_method
    def _planned_engine(self) -> Optional[str]:
        """First usable engine in the selected Word Audio profile.

        ``tts_orchestrator.tts_status()`` probes EVERY engine — per-task calls
        stall synthesis on sequential availability checks, so the result is
        cached for _ENGINE_PROBE_TTL_S seconds (sentence worker pattern).
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
        for candidate in tts_orchestrator._priority("word"):
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
        """Effective + recommended fan-out for the current planned engine."""
        engine = self._planned_engine() or ""
        kind = self._engine_concurrency_class(engine)
        return {
            "concurrency": effective_concurrency(kind, self.get_concurrency()),
            "concurrency_recommended": recommended_concurrency(kind),
            "concurrency_engine": engine or None,
            "concurrency_class": kind,
        }

    @serialized_method
    def invalidate_engine_plan(self) -> None:
        """Apply a changed Word Audio engine order on the next worker cycle."""
        self._engine_probe_cache = None
        self._engine_probe_ts = 0.0

    def prioritize_word(self, md5: str, language: str) -> None:
        """Prioritize a visible word inside an already-claimed local batch."""
        self._active_tasks.prioritize(md5, language)

    def _next_active_task(
        self, tasks: Any
    ) -> Optional[Dict[str, Any]]:
        """Pop the newest visible-word ticket first, otherwise FIFO."""
        return tasks.pop()

    def _is_enabled(self) -> bool:
        """Live enable state: the PyHeartbeat callback flag (UI toggle) with the
        configured start-state as fallback when the heartbeat is unavailable."""
        try:
            return bool(
                get_heartbeat_system().is_callback_enabled("tts_queue_poller")
            )
        except Exception:  # noqa: BLE001 — heartbeat not up yet
            return self.enabled

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

    def _claim_tasks(self, base: str, limit: Optional[int] = None) -> Optional[List[Dict[str, Any]]]:
        """POST /tts/worker/claim. Returns the task list, or None when Laravel
        could not be reached / answered abnormally (logged per state change)."""
        batch = max(1, min(_MAX_BATCH, int(limit or self.batch_size)))
        try:
            resp = get_laravel_client().post(
                CLAIM_PATH,
                base_url=base,
                json={"worker_id": self.worker_id, "limit": batch},
                timeout=_CLAIM_TIMEOUT,
            )
        except Exception as e:
            reason = self._short_err(e)
            self._note_laravel_down(base, reason)
            self._log_event("claim_fail", reason)
            return None
        if resp.status_code != 200:
            reason = f"claim -> HTTP {resp.status_code}"
            self._note_laravel_down(base, reason)
            self._log_event("claim_fail", reason)
            return None
        self._note_laravel_ok(base)
        try:
            body = resp.json() or {}
        except ValueError:
            ColorPrint.yellow("[TTSWorker] Claim returned non-JSON body — skipping tick")
            self._log_event("claim_fail", "claim returned non-JSON body")
            return None
        data = body.get("data") if isinstance(body.get("data"), dict) else body
        return list((data or {}).get("tasks") or [])

    def fetch_queue_summary(self) -> Dict[str, Any]:
        """POST /tts/worker/claim with limit=0 — Laravel pending/leased counts."""
        base = self._base_url()
        if not base:
            return {}
        try:
            resp = get_laravel_client().post(
                CLAIM_PATH,
                base_url=base,
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
        task_id: Any,
        success: bool,
        provider: str,
        error: str = "",
        audio_path: str = "",
    ) -> Tuple[bool, str]:
        """POST /tts/worker/report (multipart upload on success, fields-only on
        failure). Returns ``(accepted, detail)``; never raises."""
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
                    resp = get_laravel_client().post(
                        REPORT_PATH,
                        base_url=base,
                        data=fields,
                        files={"audio": (os.path.basename(audio_path), fh, "audio/mpeg")},
                        timeout=_REPORT_TIMEOUT,
                    )
            else:
                resp = get_laravel_client().post(REPORT_PATH, base_url=base, data=fields,
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

    # -------------------- task processing --------------------

    def _process_task(self, base: str, task: Dict[str, Any]) -> bool:
        """Synthesize + validate + report ONE task. Fully self-contained (per-
        task tmp filename, own report call) so it is safe to run concurrently
        in the fan-out path. Returns True on success."""
        task_id = task.get("task_id")
        audio_path = ""
        try:
            self._log_event("synth_start", "", task)
            ok, audio_path, provider, err = self._synthesize_task(task)
            if ok:
                accepted, detail = self._report(
                    base, task_id, True, provider, audio_path=audio_path
                )
                if accepted:
                    self._log_event("synth_done", f"via {provider}", task)
                    ColorPrint.green(
                        f"[TTSWorker] Task {task_id} "
                        f"'{(task.get('content') or '')[:30]}' done via {provider}"
                    )
                    return True
                # Upload refused (e.g. server-side 422) — follow up with an
                # explicit failure report so the task fails fast instead of
                # waiting out the 10-minute lock.
                self._log_event("synth_fail", f"upload rejected: {detail}", task)
                ColorPrint.yellow(
                    f"[TTSWorker] Task {task_id} upload rejected ({detail})"
                )
                self._report(base, task_id, False, provider,
                             error=f"audio upload rejected: {detail}")
                return False
            self._log_event("synth_fail", err, task)
            ColorPrint.yellow(f"[TTSWorker] Task {task_id} failed: {err}")
            accepted, detail = self._report(
                base, task_id, False, provider, error=err
            )
            if not accepted:
                ColorPrint.yellow(
                    f"[TTSWorker] Failure report for task {task_id} "
                    f"not accepted ({detail}); lock will re-pend it"
                )
            return False
        except Exception as e:  # noqa: BLE001 — one task must not kill the batch
            ColorPrint.red(f"[TTSWorker] Task {task_id} error: {e}")
            return False
        finally:
            if audio_path:
                try:
                    os.remove(audio_path)
                except OSError:
                    pass

    def _process_batch(self) -> None:
        """Claim a batch and process every task. Serial engines (edge-tts holds
        a process-wide lock) keep the SEQUENTIAL loop; parallel-safe engines
        fan out to named lane Thread subclasses sized by the effective
        concurrency (services/tts_concurrency.py) — rule §4, no
        shared worker pool. Runs on a background daemon thread; fully
        exception-safe."""
        try:
            base = self._base_url()
            concurrency, engine = self._effective_concurrency()
            tasks = self._claim_tasks(base, limit=max(self.batch_size, concurrency))
            if tasks is None:
                return  # Laravel down / abnormal — claim_fail event already logged
            if not tasks:
                # Nothing pending — record an idle event so the FE sees the
                # worker IS cycling; throttled to one per 60s so the 80-entry
                # deque is not flooded by idle ticks.
                now = time.time()
                if now - self._last_idle_event_ts >= 60:
                    self._last_idle_event_ts = now
                    self._log_event("idle", "queue empty — nothing pending")
                return

            claimed = len(tasks)
            succeeded = 0
            failed = 0
            ColorPrint.blue(f"[TTSWorker] Claimed {claimed} task(s) from {base}")
            self._log_event("claimed", f"count={claimed} from {base}")

            self._active_tasks.replace(tasks)
            active_tasks = self._active_tasks
            if concurrency > 1 and claimed > 1:
                self._log_event(
                    "parallel", f"fan-out x{concurrency} (engine={engine or '?'})"
                )
                payloads = [
                    {"worker": self, "base": base, "tasks": active_tasks}
                    for _index in range(concurrency)
                ]
                results = map_bus_tasks(
                    run_tts_worker_lane,
                    payloads,
                    max_workers=concurrency,
                    thread_prefix="TTSWorkerLane",
                )
                for result in results:
                    succeeded += int(result.get("succeeded") or 0)
                    failed += int(result.get("failed") or 0)
            else:
                while True:
                    task = self._next_active_task(active_tasks)
                    if task is None:
                        break
                    if self._process_task(base, task):
                        succeeded += 1
                    else:
                        failed += 1

            self._record_batch(claimed, succeeded, failed)
            line = (f"[TTSWorker] Tick summary: claimed={claimed} "
                    f"succeeded={succeeded} failed={failed}")
            (ColorPrint.green if failed == 0 else ColorPrint.yellow)(line)
        except Exception as e:  # noqa: BLE001 — never raise out of the batch thread
            ColorPrint.red(f"[TTSWorker] Batch error: {e}")
        finally:
            THREAD_BUS.signal(self._batch_running_signal, False)

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

        planned_engine = self._planned_engine() or "edge"
        cache_path = get_cache_path(content, language, planned_engine)
        if os.path.exists(cache_path) and os.path.getsize(cache_path) > 0:
            ok_cache, _why = _validate_mp3(cache_path)
            if ok_cache:
                os.makedirs(self._tmp_dir, exist_ok=True)
                name = f"{task.get('task_id')}_{task.get('md5') or 'audio'}.mp3"
                out_path = os.path.join(self._tmp_dir, name)
                shutil.copy2(cache_path, out_path)
                return True, out_path, planned_engine, ""

        os.makedirs(self._tmp_dir, exist_ok=True)
        name = f"{task.get('task_id')}_{task.get('md5') or 'audio'}.mp3"
        out_path = os.path.join(self._tmp_dir, name)

        # Accent passthrough: the current word claim payload carries NO accent
        # field, so this is normally None (the word profile's accent-aware
        # engines then use their default voice); honored if a task ever has one.
        accent = (str(task.get("accent") or "").strip() or None)
        result = tts_orchestrator.synthesize(
            content,
            language,
            Path(out_path),
            accent=accent,
            priority_profile="word",
        )
        provider = result.get("engine") or (
            (result.get("tried") or ["none"])[-1]
        )
        if not result.get("success"):
            return False, out_path, provider, result.get("error") or "synthesis failed"

        ok, why = _validate_mp3(out_path)
        if not ok:
            return False, out_path, provider, f"invalid audio from {provider}: {why}"
        
        save_to_cache(content, language, provider, out_path)
        return True, out_path, provider, ""



    # -------------------- heartbeat callback --------------------

    def poll_and_process(self) -> None:
        """
        PyHeartbeat callback (every 60s when the callback is enabled).

        LIGHT by design: spawn one background batch thread; skip the tick when
        the previous batch is still running. The batch uses serial or bounded
        parallel lanes according to the selected engine. Enable/disable is governed by the PyHeartbeat callback
        flag (start-state from Config.TTS_WORKER_ENABLED_ON_START, runtime via
        RPC v2 ui.heartbeat_workers.config) — no second gate here.
        Exception-safe — it must never raise into the heartbeat loop.
        """
        try:
            if THREAD_BUS.get_signal(self._batch_running_signal, False):
                return  # previous batch still in flight
            THREAD_BUS.signal(self._batch_running_signal, True)

            start_bus_task(self._process_batch, thread_name="tts-worker-batch")
        except Exception as e:  # noqa: BLE001 — heartbeat must never see a raise
            THREAD_BUS.signal(self._batch_running_signal, False)
            ColorPrint.red(f"[TTSWorker] poll_and_process error: {e}")

    # -------------------- introspection --------------------

    def get_status(self) -> Dict[str, Any]:
        """Service status snapshot (read-only)."""
        running = bool(THREAD_BUS.get_signal(self._batch_running_signal, False))
        state = self._state_snapshot()
        return {
            "service": "TTS Queue Worker",
            "worker_id": self.worker_id,
            "enabled_on_start": self.enabled,
            # Live enable flag from the heartbeat callback (UI toggle) — unlike
            # enabled_on_start this reflects the CURRENT on/off state.
            "heartbeat_enabled": self._is_enabled(),
            "batch_size": self.batch_size,
            "batch_running": running,
            "base_url_override": self._base_override or None,
            "total_claimed": state["total_claimed"],
            "total_succeeded": state["total_succeeded"],
            "total_failed": state["total_failed"],
            "last_tick": state["last_tick"],
            "events": state["events"],
            "initialized": self._initialized,
        }


# Global singleton accessor function
class _TTSQueuePollerProvider:
    """Create and retain the worker on one THREAD_BUS state owner."""

    def __init__(self) -> None:
        self._worker: Optional[TTSQueuePollerService] = None
        init_serialized_owner(
            self,
            "tts.queue_poller.provider",
            "TTSQueuePollerProvider",
        )

    @serialized_method
    def get(self, laravel_api_url: str) -> TTSQueuePollerService:
        if self._worker is None:
            self._worker = TTSQueuePollerService(laravel_api_url)
        return self._worker


_tts_queue_poller_provider = _TTSQueuePollerProvider()


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
    return _tts_queue_poller_provider.get(laravel_api_url)
