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
    the unified Assist user settings. Batch size uses the deployment default
    Config.TTS_SENTENCE_WORKER_BATCH (env PYCORE_TTS_SENTENCE_WORKER_BATCH).
  * The heartbeat callback (poll_and_process) stays LIGHT: it hands one
    claim+drain cycle to ONE background daemon thread. A non-reentrant in-flight
    guard ensures at most one cycle runs at a time. Serial engines such as
    edge-tts use one lane; parallel-safe or managed-server engines use the
    bounded concurrency selected by the shared TTS policy.
  * §5.3 single priority queue: each cycle claims a batch and PUSHES every task
    into a shared heapq ordered by (-priority, seq). Every synthesis lane POPS
    atomically from that same heap, preserving priority at dispatch even when
    a parallel engine completes tasks out of order. Because the heap persists,
    a high-priority task claimed later still outranks lower-priority leftovers.
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

import os
import socket
import time
from collections import deque
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional, Tuple

# ColorPrint is the only allowed logger in pycore services.
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_app_cache_dir
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    map_bus_tasks,
    serialized_method,
    start_bus_task,
)
# Rule §4: all inter-thread data exchange goes through the global bus.
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
# Live enable flag for bump-wake (UI toggle lives on the heartbeat callback).
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
# Env-backed callmodule config (TTS_SENTENCE_WORKER_* knobs live beside the word
# worker's TTS_WORKER_* in callmodule_config/config.py).
from pycore.pyutils.common.service_config import (
    TTS_SENTENCE_WORKER_BATCH,
    TTS_SENTENCE_WORKER_CONCURRENCY,
)
from pycore.pyctl.assist.assist_settings import assist_capability_enabled
# Stored-first multi-endpoint manager — the SAME base-URL resolution the
# word worker and media-sync service use.
from pycore.pyutils.laravel.endpoint_manager import (
    laravel_endpoint_manager,
)
# ONE entry point for synthesis; local-first engine priority and edge's
# process-wide serialization live in the orchestrator.
import pycore.pyutils.tts.tts_orchestrator as tts_orchestrator
from pycore.pyctl.tts.word_queue_poller_service import _validate_mp3
from pycore.pyctl.task_history.store import append_record
from pycore.pyutils.common.queue_center_contract import GLOBAL_TASK_TYPES_BY_KEY
from pycore.pyctl.tts.sentence_worker_support import (
    SentencePriorityQueue,
    TTSSentenceWorkerApiMixin,
)


# --------------------------------------------------------------------------- #
# Constants                                                                    #
# --------------------------------------------------------------------------- #
# Server hard cap on the claim batch (contract: limit <= 50).
_MAX_BATCH = 50
_SENTENCE_AUDIO_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["sentence_audio"]["key"]

# THREAD_BUS signal with the latest cycle summary (FE/diagnostics).
_BUS_CYCLE_SUMMARY = "tts_sentence_worker.cycle_summary"


def _run_sentence_synth_lane(payload: Dict[str, Any]) -> Dict[str, int]:
    """Drain one synth lane; payload and result travel through THREAD_BUS."""
    worker = payload["worker"]
    base = payload["base"]
    processed = succeeded = failed = 0
    while True:
        task = worker._queue.pop()
        if task is None:
            break
        processed += 1
        if worker._process_one(base, task):
            succeeded += 1
        else:
            failed += 1
    return {
        "processed": processed,
        "succeeded": succeeded,
        "failed": failed,
    }


class TTSSentenceWorkerService(TTSSentenceWorkerApiMixin):
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
        # Batch sizing remains a deployment default. Lifecycle always comes
        # from the live user-settings map and its heartbeat callback.
        self.batch_size = max(
            1, min(_MAX_BATCH, TTS_SENTENCE_WORKER_BATCH)
        )
        self._concurrency = max(
            0, TTS_SENTENCE_WORKER_CONCURRENCY
        )

        # §5.3 ONE shared priority queue across ALL claim batches.
        self._queue = SentencePriorityQueue()

        # ONE cycle at a time; lifecycle state is exchanged through THREAD_BUS.
        self._cycle_running_signal = f"tts_sentence_worker.cycle_running.{id(self)}"
        THREAD_BUS.signal(self._cycle_running_signal, False)

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
        # In-flight tasks keyed by task_id and owned by the serialized worker.
        self._current_tasks: Dict[Any, Dict[str, Any]] = {}
        self._events: Deque[Dict[str, Any]] = deque(maxlen=80)
        # Throttle marker for the idle event (epoch seconds of the last one).
        self._last_idle_event_ts = 0.0
        init_serialized_owner(
            self,
            "tts.sentence_worker.state",
            "TTSSentenceState",
            timeout=180.0,
        )

        # Persistent local cache for synthesized sentence MP3s (keyed by
        # lang/content_id/variant_key). A claimed sentence whose cache file is
        # still valid is reported straight from cache - no re-synth - and the
        # file is NEVER deleted (it is the local copy the pipeline must retain
        # and re-report if laravel ever loses it).
        self._cache_dir = str(get_app_cache_dir() / "sentence_audio")

        # Engine probe cache (60s TTL) — see _planned_engine().
        self._engine_probe_cache: Optional[str] = None
        self._engine_probe_ts = 0.0

        self._initialized = True
        # Register for immediate notification when the user switches endpoint so
        # the conn-fail warning is cleared and the next cycle tick probes the new host.
        laravel_endpoint_manager.register_endpoint_change_listener(
            self.on_endpoint_changed
        )
        ColorPrint.green(
            f"[TTSSentenceWorker] Service initialized (worker_id={self.worker_id}, "
            f"batch={self.batch_size}, "
            f"enabled={assist_capability_enabled('sentence_audio')})"
        )

    def on_endpoint_changed(self, new_url: str) -> None:
        """Reset conn-fail state when the user switches the Laravel endpoint.

        The sentence worker resolves its base URL live on each cycle, so only
        the warn-once gate needs clearing to let the first request to the new
        host produce a normal log line (error or success).
        """
        self._conn_fail_streak = 0
        self._conn_unreachable_warned = False
        ColorPrint.blue(
            f"[TTSSentenceWorker] Endpoint changed \u2192 {new_url!r}; conn-fail state reset"
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
        return laravel_endpoint_manager.resolve()

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
        local_id: Optional[str] = None,
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
        if local_id:
            planned = (
                self._planned_engine()
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

    def _synthesize_task(
        self,
        task: Dict[str, Any],
        local_id: Optional[str] = None,
    ) -> Tuple[bool, str, str, str, str]:
        """Generate the primary sentence MP3 (first variant only)."""
        variants = task.get("variants") or [{"key": "", "accent": None, "gender": "female"}]
        primary = variants[0] if variants else {"key": "", "accent": None, "gender": "female"}
        return self._synthesize_variant(task, primary, local_id=local_id)

    def _process_one(self, base: str, task: Dict[str, Any]) -> bool:
        """Synthesize + report ONE task (all language variants). Returns True on primary success."""
        task_id = task.get("task_id")
        start_time = time.time()
        self._mark_task_started(task)
        self._log_event("synth_start", f"priority={task.get('priority')}", task)
        local_tm_id = self._begin_local_task(task)
        variants = task.get("variants") or [{"key": "", "accent": None, "gender": "female"}]
        primary_ok = False
        last_provider = ""
        last_synth_command = ""
        last_audio_path = ""
        fail_reason = ""
        audio_paths: List[str] = []
        content_preview = ((task.get("content") or "").strip())[:120]
        task_language = (task.get("language") or "en").strip() or "en"
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
                self._update_task_variant(
                    task_id,
                    _i + 1,
                    len(variants),
                    vkey or "primary",
                    provider or "pending",
                )
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
                                # History uses the same task key as Laravel and
                                # both UIs; the JSON contract owns the value.
                                "task_type": _SENTENCE_AUDIO_TASK_TYPE,
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
                        elapsed = time.time() - start_time
                        ColorPrint.green(
                            f"[TTSSentenceWorker +{elapsed:.2f}s] Task {task_id} "
                            f"'{content_preview}' "
                            f"(p={task.get('priority')}) done via {provider}"
                        )
                    elif not accepted:
                        fail_reason = detail or "upload rejected"
                        self._log_event("report_reject", fail_reason, task)
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
            self._mark_task_finished(task_id)
            # NOTE: synthesized MP3s live in the persistent cache dir and are NEVER
            # deleted here - they are the local retained copy (re-reported if laravel
            # ever loses the file). The cache_path_for layout mirrors laravel's disk.

    def _run_cycle(self) -> None:
        """One claim + priority-drain cycle. Claims a batch, merges it into the
        shared priority queue, then drains it through one serial lane or bounded
        parallel lanes according to the selected engine. All lanes pop from the
        same priority heap. Runs on a background daemon thread and is fully
        exception-safe."""
        try:
            base = self._base_url()
            concurrency, engine = self._effective_concurrency()
            tasks = self._claim_tasks(base, limit=max(self.batch_size, concurrency))
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
                # Empty queue — record an idle event so the FE sees the worker
                # IS cycling; throttled to one per 60s so the 80-entry deque
                # is not flooded by idle ticks.
                now = time.time()
                if now - self._last_idle_event_ts >= 60:
                    self._last_idle_event_ts = now
                    self._log_event("idle", "queue empty — nothing pending")
                return

            processed = 0
            succeeded = 0
            failed = 0

            def _pop_and_process() -> Tuple[int, int, int]:
                p = s = f = 0
                while True:
                    task = self._queue.pop()
                    if task is None:
                        break
                    p += 1
                    if self._process_one(base, task):
                        s += 1
                    else:
                        f += 1
                return p, s, f

            if concurrency > 1:
                payloads = [
                    {"worker": self, "base": base}
                    for _index in range(concurrency)
                ]
                results = map_bus_tasks(
                    _run_sentence_synth_lane,
                    payloads,
                    max_workers=concurrency,
                    thread_prefix="TTSSentenceSynth",
                )
                for result in results:
                    processed += int(result.get("processed") or 0)
                    succeeded += int(result.get("succeeded") or 0)
                    failed += int(result.get("failed") or 0)
            else:
                processed, succeeded, failed = _pop_and_process()

            if processed == 0:
                return

            cycle_summary = self._record_cycle(processed, succeeded, failed)
            THREAD_BUS.signal(_BUS_CYCLE_SUMMARY, cycle_summary)
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
            THREAD_BUS.signal(self._cycle_running_signal, False)

    # -------------------- heartbeat callback --------------------

    def poll_and_process(self) -> None:
        """
        PyHeartbeat callback (every Config.TTS_SENTENCE_WORKER_INTERVAL seconds
        when the callback is enabled).

        LIGHT by design: spawn one background cycle thread; skip the tick when
        the previous cycle is still running (keeps synthesis strictly
        sequential and the single priority queue coherent). Enable/disable is
        governed by the PyHeartbeat callback flag synchronized from the
        in-memory user settings map. Exception-safe — it
        must never raise into the heartbeat loop.
        """
        try:
            if THREAD_BUS.get_signal(self._cycle_running_signal, False):
                return  # previous cycle still in flight — stay sequential
            THREAD_BUS.signal(self._cycle_running_signal, True)

            start_bus_task(self._run_cycle, thread_name="tts-sentence-worker-cycle")
        except Exception as e:  # noqa: BLE001 — heartbeat must never see a raise
            THREAD_BUS.signal(self._cycle_running_signal, False)
            ColorPrint.red(f"[TTSSentenceWorker] poll_and_process error: {e}")

    # -------------------- priority-bump wake (SSE sentence.priority) --------------------

    def notify_bump(self, content_id: str, language: str, priority: int) -> None:
        """Handle a sentence.priority bump: re-key the matching queued task (if
        it is still sitting in the priority heap) and wake an idle worker so the
        bumped sentence is claimed without waiting for the next interval tick.
        Exception-safe — a bump must never break the caller (SSE loop)."""
        try:
            if self._queue.bump(content_id, language, priority):
                ColorPrint.blue(
                    f"[TTSSentenceWorker] Re-keyed queued sentence "
                    f"{language}:{content_id} -> priority {priority}"
                )
            self._wake_if_idle()
        except Exception as e:  # noqa: BLE001
            ColorPrint.yellow(f"[TTSSentenceWorker] notify_bump error: {e}")

    def notify_batch_bump(self) -> None:
        """Aggregate bump (no per-row payload) — wake only. The next claim
        already selects ORDER BY priority DESC server-side, so no re-key."""
        try:
            self._wake_if_idle()
        except Exception as e:  # noqa: BLE001
            ColorPrint.yellow(f"[TTSSentenceWorker] notify_batch_bump error: {e}")

    def _wake_if_idle(self) -> None:
        """Spawn a poll_and_process cycle on a daemon thread when the worker is
        enabled and no cycle is in flight (poll_and_process is non-reentrant,
        so this is equivalent to the laravel run-once nudge)."""
        if not self._is_enabled():
            return
        if THREAD_BUS.get_signal(self._cycle_running_signal, False):
            return  # in-flight cycle already pops by (re-keyed) priority
        start_bus_task(self.poll_and_process, thread_name="tts-sentence-worker-bump")

    def _is_enabled(self) -> bool:
        """Live enable state: the PyHeartbeat callback flag (UI toggle) with the
        configured start-state as fallback when the heartbeat is unavailable."""
        try:
            return bool(
                shared_heartbeat_system.is_callback_enabled("tts_sentence_worker")
            )
        except Exception:  # noqa: BLE001 — heartbeat not up yet
            return assist_capability_enabled("sentence_audio")

    # -------------------- introspection --------------------

    def get_status(self) -> Dict[str, Any]:
        """Service status snapshot (read-only).

        Surfaces the §4.4 counts for the FE: ``queued`` (waiting in the priority
        heap), ``leased`` (claimed-but-unsynthesized — same as queued depth in
        this in-process model), and ``processing`` (the one task mid-synthesis).
        """
        running = bool(THREAD_BUS.get_signal(self._cycle_running_signal, False))
        state = self._state_snapshot()
        processing = int(state["processing"])
        current_tasks = state["current_tasks"]
        current = current_tasks[0] if current_tasks else None
        # Stable "lang:content_id" keys for the in-flight tasks so the queue
        # snapshot endpoint can mark awaiting rows as processing.
        current_keys = []
        for ct in current_tasks:
            if not isinstance(ct, dict):
                continue
            lang = str(ct.get("language") or "").strip()
            cid = str(ct.get("content_id") or ct.get("sentence_id") or "").strip()
            if lang and cid:
                current_keys.append(f"{lang}:{cid}")
        queued = len(self._queue)
        return {
            "service": "TTS Sentence-Audio Worker",
            "worker_id": self.worker_id,
            "enabled_on_start": assist_capability_enabled("sentence_audio"),
            # Live enable flag from the heartbeat callback (UI toggle) — unlike
            # enabled_on_start this reflects the CURRENT on/off state.
            "heartbeat_enabled": self._is_enabled(),
            "batch_size": self.batch_size,
            "cycle_running": running,
            "base_url_override": self._base_override or None,
            # §4.4 queue counts for the FE.
            "queued": queued,
            "leased": queued,
            "processing": processing,
            "current_task": current,
            "current_keys": current_keys,
            "events": state["events"],
            "total_claimed": state["total_claimed"],
            "total_succeeded": state["total_succeeded"],
            "total_failed": state["total_failed"],
            "last_cycle": state["last_cycle"],
            "initialized": self._initialized,
        }


tts_sentence_worker_service = TTSSentenceWorkerService()
