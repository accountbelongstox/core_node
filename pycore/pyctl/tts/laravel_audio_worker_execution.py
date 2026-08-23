# -*- coding: utf-8 -*-
"""Synthesis and durable result delivery for Laravel audio workers."""

import base64
import os
import time
from functools import partial
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from pycore.pyctl.desktop.task_manager import task_manager as shared_task_manager
from pycore.pyctl.task_history.store import append_record
from pycore.pyctl.tts.word_audio_backend_progress import word_audio_backend_progress
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import map_bus_tasks, start_bus_task
from pycore.pyfoundations.system_paths import get_app_cache_dir
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_PROGRESS_STAGES,
    GLOBAL_TASK_PROGRESS_TOTAL,
    GLOBAL_TASK_TYPES_BY_KEY,
    QUEUE_CENTER_DIFF_DELIVERY,
    http_transfer_contract,
)
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.progress_upload import laravel_progress_uploader
from pycore.pyutils.tts.audio_delivery_outbox import (
    AUDIO_DELIVERY_PROCESS_ID,
    audio_delivery_executor,
    audio_delivery_outbox,
)
from pycore.pyutils.tts.audio_validation import validate_mp3
from pycore.pyutils.tts.qwen.config import ENGINE_NAME as QWEN3TTS_ENGINE
from pycore.pyutils.tts.word_audio_cache import get_cache_path, save_to_cache
import pycore.pyutils.tts.tts_orchestrator as tts_orchestrator

_OUTBOX_BATCH_LIMIT = 32
_OUTBOX_PARALLEL_LIMIT = 4
_OUTBOX_IDLE_WAIT_SECONDS = 15.0
_UPLOAD_RETRY_INITIAL_SECONDS = max(
    1.0,
    float(QUEUE_CENTER_DIFF_DELIVERY["consumer_upload_retry"]["initial_seconds"]),
)
_UPLOAD_RETRY_MAX_SECONDS = max(
    _UPLOAD_RETRY_INITIAL_SECONDS,
    float(QUEUE_CENTER_DIFF_DELIVERY["consumer_upload_retry"]["maximum_seconds"]),
)
_LANG_INDEX = {
    "en": 1, "zh": 2, "ja": 3, "ko": 4, "vi": 5,
    "lo": 6, "fr": 7, "de": 8, "es": 9,
}
_TYPE_DIGIT_WORD = 1
_SENTENCE_HISTORY_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["sentence_audio"]["key"]


def encode_word_report_task_id(dict_row_id: int, language: str) -> int:
    lang_index = _LANG_INDEX.get(str(language or "").lower(), 0)
    return int(dict_row_id) * 1000 + _TYPE_DIGIT_WORD * 100 + lang_index


def _run_audio_delivery(payload: Dict[str, Any]) -> Dict[str, Any]:
    worker = payload["worker"]
    return worker._deliver_outbox_row(payload["record"])


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
        info["progress_total"] = GLOBAL_TASK_PROGRESS_TOTAL
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

    def _stage_delivery(
        self,
        info: Dict[str, Any],
        provider: str,
        audio_path: str,
        local_task_id: Optional[str],
    ) -> Dict[str, Any]:
        return audio_delivery_outbox.stage_audio({
            "lane": self.LANE,
            "task_id": info.get("task_id"),
            "task_type": info.get("task_type") or self.QUEUE_KEY,
            "attempt": int(info.get("attempt") or 0),
            "base_url": self._task_base_url(info.get("task_id")),
            "provider": provider,
            "info": dict(info),
            "local_task_id": local_task_id or "",
            "local_process_id": AUDIO_DELIVERY_PROCESS_ID,
            "status": "pending",
            "domain_uploaded": False,
            "domain_delivery_finished": False,
            "result_accepted": False,
            "history_recorded": False,
        }, audio_path, get_app_cache_dir())

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
        return audio_delivery_executor.deliver(
            self,
            record,
            _UPLOAD_RETRY_INITIAL_SECONDS,
            _UPLOAD_RETRY_MAX_SECONDS,
        )

    def _record_backend_delivery_success(self) -> None:
        if self.LANE == "word":
            word_audio_backend_progress.record_result(True)

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


__all__ = ["LaravelAudioWorkerExecutionMixin", "encode_word_report_task_id"]
