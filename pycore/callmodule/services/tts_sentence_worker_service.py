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
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional, Tuple

# ColorPrint is the only allowed logger in pycore services.
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_app_cache_dir
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
# ONE entry point for synthesis; local-first engine priority and edge's
# process-wide serialization live in the orchestrator.
from pycore.pyutils.tts import tts_orchestrator
# REUSE the word worker's local MP3 validation (identical to the server's check).
from pycore.callmodule.services.tts_queue_poller_service import _validate_mp3
from pycore.callmodule.services.task_history_store import append_record
from pycore.pyctl.desktop.task_manager import get_task_manager


# --------------------------------------------------------------------------- #
# Constants                                                                    #
# --------------------------------------------------------------------------- #
CLAIM_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/claim"
REPORT_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/report"

# HTTP timeouts (seconds). Claim can scan the full word/sentence backlog on a
# large dictionary, so give it room; report uploads a small MP3.
_CLAIM_TIMEOUT = 60
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
        self._current_task: Optional[Dict[str, Any]] = None
        self._events: Deque[Dict[str, Any]] = deque(maxlen=80)

        # Persistent local cache for synthesized sentence MP3s (keyed by
        # lang/content_id/variant_key). A claimed sentence whose cache file is
        # still valid is reported straight from cache - no re-synth - and the
        # file is NEVER deleted (it is the local copy the pipeline must retain
        # and re-report if laravel ever loses it).
        self._cache_dir = str(get_app_cache_dir() / "sentence_audio")

        self._initialized = True
        ColorPrint.green(
            f"[TTSSentenceWorker] Service initialized (worker_id={self.worker_id}, "
            f"batch={self.batch_size}, enabled_on_start={self.enabled})"
        )

    def _log_event(self, kind: str, detail: str, task: Optional[Dict[str, Any]] = None) -> None:
        entry: Dict[str, Any] = {
            "at": int(time.time()),
            "kind": kind,
            "detail": detail[:240],
        }
        if task:
            entry["task_id"] = task.get("task_id")
            entry["content_id"] = task.get("content_id") or task.get("sentence_id")
            entry["language"] = task.get("language")
            entry["priority"] = task.get("priority")
            text = (task.get("content") or "").strip()
            if text:
                entry["text_preview"] = text[:80]
        self._events.appendleft(entry)

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
        variant: Optional[Dict[str, Any]] = None,
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
        vmeta = variant if isinstance(variant, dict) else {}
        if vmeta.get("accent"):
            fields["accent"] = str(vmeta["accent"])
        if vmeta.get("gender"):
            fields["gender"] = str(vmeta["gender"])
        fields["source"] = str(vmeta.get("source") or "tts")
        fields["voice_type"] = str(vmeta.get("voice_type") or "machine")
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

    # -------------------- TaskManager (任务队列 UI) --------------------

    def _patch_local_sentence_task(
        self,
        local_id: Optional[str],
        *,
        progress: Optional[int] = None,
        status: Optional[str] = None,
        result_patch: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> None:
        if not local_id:
            return
        try:
            get_task_manager().patch_task(
                local_id,
                progress=progress,
                status=status,
                result_patch=result_patch,
                error=error,
            )
        except Exception:  # noqa: BLE001
            pass

    def _begin_local_task(self, task: Dict[str, Any]) -> Optional[str]:
        """Register one sentence job in pyctl TaskManager for the 任务队列 tab."""
        try:
            tm = get_task_manager()
            content = (task.get("content") or "").strip()
            language = (task.get("language") or "en").strip() or "en"
            preview = content[:120] if content else ""
            planned_engine = (
                tts_orchestrator.tts_status().get("active")
                or tts_orchestrator.best_engine()
            )
            planned_cmd = tts_orchestrator.describe_synth_command(
                planned_engine or "pending",
                preview or "…",
                language,
            )
            local_id = tm.create_task(
                task_type="sentence_audio",
                input_data={
                    "remote_task_id": task.get("task_id"),
                    "content_id": task.get("content_id") or task.get("sentence_id"),
                    "content": content[:500] if content else None,
                    "content_preview": preview or None,
                    "language": language,
                    "priority": task.get("priority"),
                    "_worker": "tts_sentence_worker",
                },
            )
            self._patch_local_sentence_task(
                local_id,
                progress=5,
                status="processing",
                result_patch={
                    "remote_task_id": task.get("task_id"),
                    "engine": planned_engine,
                    "synth_command": planned_cmd,
                    "text": preview,
                    "language": language,
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
        engine: str = "",
        synth_command: str = "",
        audio_path: str = "",
        text: str = "",
        language: str = "",
    ) -> None:
        if not local_id:
            return
        try:
            tm = get_task_manager()
            if success:
                tm.complete_task(local_id, {
                    "ok": True,
                    "provider": provider or None,
                    "engine": engine or provider or None,
                    "synth_command": synth_command or None,
                    "audio_path": audio_path or None,
                    "text": text or None,
                    "language": language or None,
                })
            else:
                tm.fail_task(local_id, error or "synthesis or upload failed")
        except Exception:  # noqa: BLE001
            pass

    # -------------------- task processing (SEQUENTIAL, by priority) --------------------

    def _cache_path_for(self, task: Dict[str, Any], variant: Dict[str, Any]) -> str:
        """Persistent cache path for one variant:
        ``<cache_dir>/<lang>/<content_id>[_<variant_key>].mp3`` (mirrors the
        laravel on-disk layout so a cache hit maps 1:1 to a server file)."""
        language = (task.get("language") or "en").strip() or "en"
        key = (task.get("content_id") or task.get("sentence_id") or "audio").strip()
        vkey = (variant.get("key") or "").strip()
        suffix = f"_{vkey}" if vkey else ""
        return os.path.join(self._cache_dir, language, f"{key}{suffix}.mp3")

    def _synthesize_variant(
        self,
        task: Dict[str, Any],
        variant: Dict[str, Any],
    ) -> Tuple[bool, str, str, str, str]:
        """Generate one variant MP3. Returns (ok, path, provider, error, synth_command)."""
        content = (task.get("content") or "").strip()
        language = (task.get("language") or "en").strip() or "en"
        if not content:
            return False, "", "none", "task has empty content", ""

        accent = variant.get("accent")
        gender = variant.get("gender") or "female"
        out_path = self._cache_path_for(task, variant)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        # Cache hit -> report straight from disk (no re-synth). The cache file is
        # the local retained copy; never deleted.
        if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
            ok_cache, _why = _validate_mp3(out_path)
            if ok_cache:
                return True, out_path, "cache", "", f"sentence cache hit: {out_path}"

        result = tts_orchestrator.synthesize(
            content, language, Path(out_path),
            accent=accent if accent else None,
            gender=gender,
            priority_profile="sentence",
        )
        provider = result.get("engine") or ((result.get("tried") or ["none"])[-1])
        synth_command = str(result.get("synth_command") or "")
        local_id = getattr(self, "_current_local_tm_id", None)
        if local_id:
            planned = (
                tts_orchestrator.tts_status().get("active")
                or tts_orchestrator.best_engine()
                or provider
                or "pending"
            )
            if not synth_command:
                synth_command = tts_orchestrator.describe_synth_command(
                    planned, content[:120], language, Path(out_path),
                    accent=accent if accent else None, gender=gender,
                )
            self._patch_local_sentence_task(
                local_id,
                progress=15,
                status="processing",
                result_patch={
                    "engine": provider or planned,
                    "synth_command": synth_command,
                    "text": content[:120],
                    "language": language,
                },
            )
        if not result.get("success"):
            return False, out_path, provider, result.get("error") or "synthesis failed", synth_command

        ok, why = _validate_mp3(out_path)
        if not ok:
            return False, out_path, provider, f"invalid audio from {provider}: {why}", synth_command
        if local_id:
            self._patch_local_sentence_task(
                local_id,
                progress=85,
                status="processing",
                result_patch={
                    "engine": provider,
                    "synth_command": synth_command,
                    "audio_path": out_path,
                    "text": content[:120],
                    "language": language,
                },
            )
        return True, out_path, provider, "", synth_command

    def _synthesize_task(self, task: Dict[str, Any]) -> Tuple[bool, str, str, str, str]:
        """Generate the primary sentence MP3 (first variant only)."""
        variants = task.get("variants") or [{"key": "", "accent": None, "gender": "female"}]
        primary = variants[0] if variants else {"key": "", "accent": None, "gender": "female"}
        return self._synthesize_variant(task, primary)

    def _process_one(self, base: str, task: Dict[str, Any]) -> bool:
        """Synthesize + report ONE task (all language variants). Returns True on primary success."""
        task_id = task.get("task_id")
        self._current_task = dict(task)
        self._log_event("synth_start", f"priority={task.get('priority')}", task)
        local_tm_id = self._begin_local_task(task)
        self._current_local_tm_id = local_tm_id
        variants = task.get("variants") or [{"key": "", "accent": None, "gender": "female"}]
        primary_ok = False
        last_provider = ""
        last_synth_command = ""
        last_audio_path = ""
        fail_reason = ""
        audio_paths: List[str] = []
        content_preview = ((task.get("content") or "").strip())[:120]
        task_language = (task.get("language") or "en").strip() or "en"
        with self._cycle_lock:
            self._processing += 1
        try:
            content = (task.get("content") or "").strip()
            # Phase 1 - resolve every variant (cache hit OR synthesize_variants batch).
            # synthesize_variants() uses the qwen3tts batch list API when qwen3tts is
            # available AND first in the sentence chain, so all variants generate at
            # max parallel speed; it falls back to per-variant sequential synth otherwise.
            results_by_index: List[Optional[Tuple[bool, str, str, str, str]]] = [None] * len(variants)
            uncached_variants: List[Dict[str, Any]] = []
            uncached_paths: List[str] = []
            uncached_indices: List[int] = []
            for _i, variant in enumerate(variants):
                cache_path = self._cache_path_for(task, variant)
                os.makedirs(os.path.dirname(cache_path), exist_ok=True)
                if os.path.exists(cache_path) and os.path.getsize(cache_path) > 0:
                    ok_c, _why = _validate_mp3(cache_path)
                    if ok_c:
                        results_by_index[_i] = (True, cache_path, "cache", "",
                                                f"sentence cache hit: {cache_path}")
                        continue
                uncached_variants.append(variant)
                uncached_paths.append(cache_path)
                uncached_indices.append(_i)
            if uncached_variants:
                vr = tts_orchestrator.synthesize_variants(
                    content, task_language, uncached_variants,
                    [Path(p) for p in uncached_paths], priority_profile="sentence",
                )
                for _j, variant in enumerate(uncached_variants):
                    _i = uncached_indices[_j]
                    path = uncached_paths[_j]
                    res = vr[_j] if _j < len(vr) else {}
                    ok = bool(res.get("success"))
                    provider = res.get("provider") or "none"
                    err = "" if ok else (res.get("error") or "synthesis failed")
                    cmd = res.get("synth_command") or ""
                    results_by_index[_i] = (ok, path, provider, err, cmd)
            # Phase 2 - report each variant in order.
            for _i, variant in enumerate(variants):
                ok, audio_path, provider, err, synth_cmd = results_by_index[_i] or (
                    False, "", "none", "no result", "")
                last_provider = provider or last_provider
                if synth_cmd:
                    last_synth_command = synth_cmd
                if audio_path:
                    audio_paths.append(audio_path)
                    if ok and not last_audio_path:
                        last_audio_path = audio_path
                vkey = (variant.get("key") or "").strip()
                # Live detail for the FE: which variant + provider is in flight
                # (the Sentence tab "synthesizing" line shows this so the user sees
                # qwen3tts parallel batch progress per variant).
                try:
                    self._current_task["current_variant_index"] = _i + 1
                    self._current_task["variant_count"] = len(variants)
                    self._current_task["current_variant_key"] = vkey or "primary"
                    self._current_task["current_provider"] = provider or "pending"
                except Exception:  # noqa: BLE001
                    pass
                if ok:
                    vmeta = {
                        "accent": variant.get("accent"),
                        "gender": variant.get("gender") or "female",
                        "source": "tts",
                        "voice_type": "neural" if provider in ("edge", "azure") else "machine",
                    }
                    accepted, detail = self._report(
                        base, task, True, provider, audio_path=audio_path,
                        variant_key=vkey, variant=vmeta,
                    )
                    if accepted and not vkey:
                        primary_ok = True
                        self._log_event("synth_done", f"via {provider}", task)
                        try:
                            append_record({
                                "task_type": "sentence_audio",
                                "worker": "tts_sentence_worker",
                                "title": (task.get("content") or "")[:120],
                                "content": task.get("content"),
                                "language": task.get("language"),
                                "success": True,
                                "detail": {
                                    "provider": provider,
                                    "engine": provider,
                                    "synth_command": synth_cmd or last_synth_command,
                                    "audio_path": audio_path,
                                    "priority": task.get("priority"),
                                    "variant_key": vkey,
                                    "accent": vmeta.get("accent"),
                                    "gender": vmeta.get("gender"),
                                    "source": vmeta.get("source"),
                                    "text": content_preview,
                                },
                            })
                        except Exception:  # noqa: BLE001
                            pass
                        ColorPrint.green(
                            f"[TTSSentenceWorker] Task {task_id} "
                            f"'{(task.get('content') or '')[:30]}' "
                            f"(p={task.get('priority')}) done via {provider}"
                        )
                    elif not accepted:
                        fail_reason = detail or "upload rejected"
                        ColorPrint.yellow(
                            f"[TTSSentenceWorker] Task {task_id} variant '{vkey or 'primary'}' "
                            f"upload rejected ({detail})"
                        )
                else:
                    fail_reason = err or fail_reason
                    self._log_event("synth_fail", err, task)
                    ColorPrint.yellow(
                        f"[TTSSentenceWorker] Task {task_id} variant '{vkey or 'primary'}' failed: {err}"
                    )
                    self._report(base, task, False, provider, error=err, variant_key=vkey)
            if not primary_ok and variants:
                return False
            return primary_ok
        except Exception as e:  # noqa: BLE001 — one task must not kill the cycle
            fail_reason = str(e)
            self._log_event("synth_error", str(e), task)
            ColorPrint.red(f"[TTSSentenceWorker] Task {task_id} error: {e}")
            return False
        finally:
            self._finish_local_task(
                local_tm_id,
                primary_ok,
                provider=last_provider,
                error=fail_reason,
                engine=last_provider,
                synth_command=last_synth_command,
                audio_path=last_audio_path,
                text=content_preview,
                language=task_language,
            )
            self._current_local_tm_id = None
            self._current_task = None
            with self._cycle_lock:
                self._processing = max(0, self._processing - 1)
            # NOTE: synthesized MP3s live in the persistent cache dir and are NEVER
            # deleted here - they are the local retained copy (re-reported if laravel
            # ever loses the file). The cache_path_for layout mirrors laravel's disk.

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
                    self._log_event("claimed", f"count={len(tasks)} from {base}")
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
            self._log_event(
                "cycle_summary",
                f"processed={processed} ok={succeeded} fail={failed}",
            )
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
            current = dict(self._current_task) if self._current_task else None
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
            "current_task": current,
            "events": list(self._events)[:40],
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
