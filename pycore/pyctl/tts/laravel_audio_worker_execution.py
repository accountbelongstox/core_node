# -*- coding: utf-8 -*-
"""Synthesis and durable result delivery for Laravel audio workers."""

import os
import time
from functools import partial
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pycore.pyutils.tts.tts_orchestrator as tts_orchestrator
from pycore.pyutils.tts.tts_status import engine_chunked
from pycore.pyctl.desktop.task_manager import task_manager as shared_task_manager
from pycore.pyfoundations.tasks import TaskStatus
from pycore.pyctl.task_history.store import append_record
from pycore.pyctl.tts.laravel_audio_worker_state import (
    TASK_OUTCOME_COMPLETED,
    TASK_OUTCOME_FAILED,
    TASK_OUTCOME_SKIPPED,
)
from pycore.pyctl.tts.word_audio_backend_progress import word_audio_backend_progress

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_app_cache_dir
from pycore.pyutils.common.queue_center_contract import GLOBAL_TASK_TYPES_BY_KEY
from pycore.pyutils.tts.audio_validation import validate_mp3
from pycore.pyutils.tts.batch import kokoro_batch
from pycore.pyutils.tts import runtime_profile
from pycore.pyutils.tts.qwen.config import ENGINE_NAME as QWEN3TTS_ENGINE
from pycore.pyutils.tts.word_audio_cache import find_cached, get_cache_path

_SENTENCE_HISTORY_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["sentence_audio"]["key"]


class LaravelAudioWorkerExecutionMixin:
    """Own synthesis and each minimum durable delivery transition."""

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

        if kind == "word" and info.get("_batch_audio_error"):
            return (
                False,
                "",
                runtime_profile.WORD_BATCH_ENGINE,
                str(info["_batch_audio_error"]),
                False,
            )
        if kind == "word" and info.get("_batch_audio_path"):
            batch_path = str(info["_batch_audio_path"])
            valid, detail = validate_mp3(batch_path)
            if valid:
                return (
                    True,
                    batch_path,
                    runtime_profile.WORD_BATCH_ENGINE,
                    "",
                    bool(info.get("_batch_audio_cleanup")),
                )
            return (
                False,
                batch_path,
                runtime_profile.WORD_BATCH_ENGINE,
                f"invalid batch audio: {detail}",
                bool(info.get("_batch_audio_cleanup")),
            )

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
                required_engine=self._required_engine() or QWEN3TTS_ENGINE,
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
                    return True, out_path, self._required_engine() or "cache", "", False
            result = tts_orchestrator.synthesize(
                info["text"],
                language,
                Path(out_path),
                accent=accent,
                gender=info.get("gender") or None,
                priority_profile=self.PRIORITY_PROFILE,
                required_engine=self._required_engine(),
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

        # Word cache hits remain reusable regardless of their historical
        # provider. A cache miss must have been prepared by the Kokoro batch
        # entry above; there is deliberately no per-word synthesis fallback.
        planned_engine = (
            runtime_profile.WORD_BATCH_ENGINE
            if kind == "word"
            else self._planned_engine() or "none"
        )
        if kind == "word":
            # Unified any-provider cache: audio produced by ANY engine - the
            # audio-orchestration pipeline included - is reused, never
            # re-synthesized just because the planned engine changed.
            cached_path = find_cached(info["word"], language)
            if cached_path is not None and os.path.getsize(str(cached_path)) > 0:
                ok_cache, _why = validate_mp3(str(cached_path))
                if ok_cache:
                    return True, str(cached_path), planned_engine, "", False
            return (
                False,
                "",
                runtime_profile.WORD_BATCH_ENGINE,
                "word audio requires Kokoro batch preparation",
                False,
            )

        # Non-word lane scratch output.
        os.makedirs(self._tmp_dir, exist_ok=True)
        out_path = os.path.join(
            self._tmp_dir, f"{info.get('task_id')}_{info.get('md5') or 'audio'}.mp3"
        )
        profile = "sentence"
        result = tts_orchestrator.synthesize(
            info["text"],
            language,
            Path(out_path),
            accent=accent,
            gender=info.get("gender") or None,
            priority_profile=profile,
            excluded_engines=(),
        )
        provider = result.get("engine") or ((result.get("tried") or ["none"])[-1])
        if not result.get("success"):
            return False, out_path, provider, result.get("error") or "synthesis failed", True
        ok, why = validate_mp3(out_path)
        if not ok:
            return False, out_path, provider, f"invalid audio from {provider}: {why}", True
        return True, out_path, provider, "", True

    # -------------------- domain report endpoints (file transport) --------------------


    # -------------------- global task result --------------------


    # -------------------- per-task processing --------------------


    def _prepare_word_batch(self, tasks: List[Dict[str, Any]]) -> None:
        """Generate every uncached word through the pinned Kokoro batch path."""
        groups: Dict[str, List[Tuple[Dict[str, Any], Dict[str, Any]]]] = {}
        for task in tasks:
            info = self._normalize(task)
            if info.get("error") or info.get("kind") != "word":
                continue
            cached_path = find_cached(info["word"], info["language"])
            if cached_path is not None and validate_mp3(str(cached_path))[0]:
                continue
            groups.setdefault(info["language"], []).append((task, info))

        for language, entries in groups.items():
            output_dir = Path(self._tmp_dir) / (
                f"word-batch-{language}-{time.time_ns()}"
            )
            outcomes = kokoro_batch.synthesize_words_to_cache(
                [info["word"] for _task, info in entries],
                language,
                output_dir,
                [str(info.get("md5") or "") for _task, info in entries],
            )
            for (task, _info), outcome in zip(entries, outcomes):
                if not outcome["ok"]:
                    task["_batch_audio_error"] = outcome["error"]
                    continue
                task["_batch_audio_path"] = outcome["audio_path"]
                task["_batch_audio_cleanup"] = outcome["scratch"]

    def _process_claimed_batch(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Claim a queue slice, synthesize it once as a batch, then deliver rows."""
        claimed: List[Tuple[Dict[str, Any], float]] = []
        outcomes: List[Dict[str, Any]] = []
        for task in tasks:
            started = time.monotonic()
            if not self._claim_inflight(task):
                task["_skip_reason"] = "duplicate dispatch already in flight"
                outcomes.append({"task": task, "outcome": TASK_OUTCOME_SKIPPED, "started": started})
                continue
            if not task.get("_local_source") and not self._ensure_laravel_claim(task):
                task["_skip_reason"] = "Laravel claim rejected - task is gone or owned elsewhere"
                self._release_inflight(task)
                outcomes.append({"task": task, "outcome": TASK_OUTCOME_SKIPPED, "started": started})
                continue
            claimed.append((task, started))

        try:
            try:
                self._prepare_word_batch([task for task, _started in claimed])
            except Exception as exc:  # noqa: BLE001 - fail the whole atomic batch
                detail = str(exc)[:200]
                ColorPrint.yellow(f"{self._log_prefix} Kokoro batch of {len(claimed)} failed: {detail}")
                for task, _started in claimed:
                    task["_batch_audio_error"] = f"Kokoro batch synthesis failed: {detail}"
            for task, started in claimed:
                outcome = (
                    TASK_OUTCOME_COMPLETED
                    if self._process_task(task)
                    else TASK_OUTCOME_FAILED
                )
                outcomes.append({"task": task, "outcome": outcome, "started": started})
        finally:
            for task, _started in claimed:
                self._release_inflight(task)
        return outcomes

    def _process_claimed(self, task: Dict[str, Any]) -> str:
        """Inflight-guard + process one queued task (lane entry point).

        Returns a TASK_OUTCOME_* role. SKIPPED means the task never reached
        synthesis: either a duplicate dispatch is already in flight, or the
        just-in-time Laravel claim was rejected (the row vanished or belongs
        to another worker) and the task was dropped from the local queue. A
        skipped task is NOT a success - the drain cycle must not count it
        into the ok/fail counters or the backend progress, and must not log
        it as completed.
        """
        if not self._claim_inflight(task):
            task["_skip_reason"] = "duplicate dispatch already in flight"
            ColorPrint.gray(
                f"{self._log_prefix} Task {self._display_task_id(task.get('task_id'))} "
                "already in flight - skipping duplicate"
            )
            return TASK_OUTCOME_SKIPPED
        try:
            # Full-sync lanes claim just-in-time here: the claim lease then
            # covers only the short processing window, and 404/409 rows are
            # dropped before any synthesis work happens. Locally sourced
            # tasks (word-audio full pull) have no global_tasks row to claim.
            if not task.get("_local_source") and not self._ensure_laravel_claim(task):
                task["_skip_reason"] = (
                    "Laravel claim rejected - task is gone or owned elsewhere"
                )
                return TASK_OUTCOME_SKIPPED
            return (
                TASK_OUTCOME_COMPLETED
                if self._process_task(task)
                else TASK_OUTCOME_FAILED
            )
        finally:
            self._release_inflight(task)

    def _process_task(self, task: Dict[str, Any]) -> bool:
        """Synthesize one task and stage its independent durable delivery."""
        task_id = task.get("task_id")
        info: Optional[Dict[str, Any]] = None
        local_id: Optional[str] = None
        started = False
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
                self._post_task_result(
                    task,
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
            for field in (
                "_batch_audio_path",
                "_batch_audio_cleanup",
                "_batch_audio_error",
            ):
                if field in task:
                    info[field] = task[field]
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
                self._post_task_result(
                    task,
                    task_id,
                    "failed",
                    error=info["error"],
                    attempt=info.get("attempt"),
                )
                self._log_event("synth_fail", info["error"], info)
                return False

            self._mark_task_started(task_id, info)
            started = True
            order_detail = f"queue_position={task.get('queue_position')}"
            self._log_event(
                "synth_start",
                order_detail,
                info,
                mirror=self.LANE != "word",
            )
            if self.LANE == "sentence":
                local_id = self._begin_local_task(info)
                sentence_text = str(info.get("text") or "")
                sentence_text = sentence_text.replace("\r", " ").replace("\n", " ").strip()
                ColorPrint.cyan(
                    f"{self._log_prefix} Generating sentence "
                    f"task={self._display_task_id(task_id)} "
                    f"queue_position={task.get('queue_position')} text={sentence_text}"
                )
            self._report_progress(
                info,
                "synthesizing",
                self._required_engine() or "",
            )

            ok, audio_path, provider, err, cleanup = self._resolve_audio(info)
            task["_terminal_provider"] = provider
            try:
                if not ok:
                    self._report_failure(info, provider, err)
                    self._post_task_result(
                        task,
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
                return True
            finally:
                if cleanup and audio_path:
                    try:
                        os.remove(audio_path)
                    except OSError:
                        pass
        except Exception as e:  # noqa: BLE001 - one task must not kill the cycle
            ColorPrint.red(
                f"{self._log_prefix} Task {self._display_task_id(task_id)} error: {e}"
            )
            self._post_task_result(
                task,
                task_id,
                "failed",
                error=str(e),
                attempt=self._task_attempt(task),
            )
            self._finish_local_task(local_id, False, error=str(e))
            return False
        finally:
            # Only a started task holds a `processing` slot to give back.
            if started:
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
                status=TaskStatus.RUNNING.value,
                result_patch={
                    "remote_task_id": info.get("task_id"),
                    "text": preview,
                    "language": info.get("language"),
                },
            )
            return local_id
        except Exception as exc:  # noqa: BLE001 - TaskManager is best-effort for UI
            ColorPrint.yellow(f"{self._log_prefix} local task register failed: {exc}")
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
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"{self._log_prefix} local task finish failed ({local_id}): {exc}")

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
                    "multi_sentence_audio": engine_chunked(provider),
                    "laravel_audio_uploaded": bool(info.get("backend_uploaded")),
                    "laravel_audio_upload_error": info.get("backend_upload_error") or "",
                    "laravel_result_accepted": bool(info.get("backend_result_accepted")),
                    "text": (info.get("text") or "")[:120],
                },
            })
            return True
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"{self._log_prefix} history append failed ({delivery_id}): {exc}")
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
                    "multi_sentence_audio": engine_chunked(provider),
                    "laravel_audio_uploaded": bool(info.get("backend_uploaded")),
                    "laravel_result_accepted": False,
                    "delivery_status": "dead_letter",
                },
            })
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"{self._log_prefix} dead-letter history append failed: {exc}")

    # -------------------- RPC accept entry / drain cycle --------------------


__all__ = ["LaravelAudioWorkerExecutionMixin"]
