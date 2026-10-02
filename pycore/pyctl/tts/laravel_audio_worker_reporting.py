# -*- coding: utf-8 -*-
"""Laravel domain reports, task progress and durable result delivery of the audio workers."""

import base64
import time
from functools import partial
from pathlib import Path
from typing import (
    Any,
    Dict,
    Optional,
    Tuple,
)
from pycore.pyctl.tts.laravel_audio_delivery import audio_lane_delivery
from pycore.pyctl.tts.word_audio_backend_progress import word_audio_backend_progress
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_PROGRESS_STAGES,
    GLOBAL_TASK_PROGRESS_TOTAL,
    http_transfer_contract,
    queue_center_endpoint,
)
from pycore.pyutils.common.status_snapshot_cache import VersionedSnapshotCache
from pycore.pyutils.common.http_client import RESPONSE_CONTROL, redacted_http_error
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.progress_upload import laravel_progress_uploader


_LANG_INDEX = {
    "en": 1, "zh": 2, "ja": 3, "ko": 4, "vi": 5,
    "lo": 6, "fr": 7, "de": 8, "es": 9,
}
_TYPE_DIGIT_WORD = 1
# Per-word "backend already has the audio" probe (skip duplicate uploads when
# the queue re-issues tasks for rows whose file already exists on Laravel).
_WORD_MEDIA_PROBE_TIMEOUT = 15
_WORD_MEDIA_PROBE_CACHE_MAX = 5000
_WORD_MEDIA_PROBE_CACHE_TTL = float(http_transfer_contract()["dedup_window_seconds"])
_word_media_probe_cache = VersionedSnapshotCache(max_entries=_WORD_MEDIA_PROBE_CACHE_MAX)


def _word_media_path(word: str, language: str) -> str:
    return queue_center_endpoint(
        "audio_word_media",
        lang=str(language or "en").strip().lower(),
        word=str(word or "").strip().lower(),
    )


def encode_word_report_task_id(dict_row_id: int, language: str) -> int:
    lang_index = _LANG_INDEX.get(str(language or "").lower(), 0)
    return int(dict_row_id) * 1000 + _TYPE_DIGIT_WORD * 100 + lang_index


class LaravelAudioWorkerReportingMixin:
    """Own the domain report, progress and result delivery transitions."""

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
                    reason=f"{self.LANE}_audio_delivery",
                )
                return (
                    bool(receipt.get("upload_complete")),
                    "ok" if receipt.get("upload_complete") else "upload incomplete",
                )
            else:
                resp = laravel_client.post(
                    self.REPORT_PATH,
                    base_url=report_base_url,
                    data=fields, response=RESPONSE_CONTROL,
                )
        except Exception as e:  # noqa: BLE001
            ColorPrint.yellow(f"{self._log_prefix} report POST failed ({self.REPORT_PATH}, base={report_base_url}): {e}")
            return False, redacted_http_error(e)
        if resp.status_code == 200:
            return True, "ok"
        if resp.status_code == 422:
            return False, f"server validation rejected: {resp.text[:200]}"
        if resp.status_code == 404:
            return False, "unknown task on server (404)"
        return False, f"HTTP {resp.status_code}: {resp.text[:200]}"

    def _backend_word_audio_present(self, word: str, language: str, base_url: str) -> bool:
        """Probe Laravel's per-word media endpoint: True when the backend already
        stores an audio file for this word (its reportWordResult would hit the
        already_done short-circuit, so re-uploading the bytes is pure waste).
        Answers are cached in-process; transport errors fail open (upload as
        usual)."""
        clean_word = str(word or "").strip().lower()
        if not clean_word:
            return False
        media_path = _word_media_path(clean_word, language)
        cache_key = f"{base_url}|{media_path}"
        cached = _word_media_probe_cache.peek(cache_key)
        if cached is not None and time.monotonic() - cached["observed_at"] < _WORD_MEDIA_PROBE_CACHE_TTL:
            return bool(cached["present"])
        present = False
        try:
            resp = laravel_client.get(
                media_path,
                base_url=base_url or None,
                timeout=_WORD_MEDIA_PROBE_TIMEOUT,
                log_line=False,
            )
            body = resp.json() if resp.status_code == 200 else None
        except Exception as exc:  # noqa: BLE001 - probe failure must never block delivery
            ColorPrint.yellow(f"[AudioWorker] word media probe failed ({media_path}): {exc}")
            return False
        data = body.get("data") if isinstance(body, dict) else None
        present = bool(data.get("audio_url")) if isinstance(data, dict) else False
        _word_media_probe_cache.put(cache_key, {"present": present, "observed_at": time.monotonic()})
        return present

    @staticmethod
    def _cache_word_audio_present(word: str, language: str, base_url: str) -> None:
        """Record a just-uploaded word audio as present on the backend."""
        cache_key = f"{base_url}|{_word_media_path(word, language)}"
        _word_media_probe_cache.put(cache_key, {"present": True, "observed_at": time.monotonic()})

    def _upload_report(
        self,
        info: Dict[str, Any],
        provider: str,
        audio_path: str,
    ) -> Optional[Tuple[bool, str]]:
        """Upload the MP3 to the domain report endpoint.

        Returns ``(ok, detail)``, or None when the lane has no addressable
        domain endpoint for this task (word without dict_row_id, article) -
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
        report_base_url = self._task_base_url(info.get("task_id"))
        if self._backend_word_audio_present(
            str(info.get("word") or ""),
            str(info.get("language") or "en"),
            report_base_url,
        ):
            # The deterministic backend file already exists: skip the byte
            # transfer and report delivery as if uploaded, so the global
            # result omits the audio payload too (no duplicate upload).
            ColorPrint.gray(
                f"{self._log_prefix} backend already has word audio "
                f"'{str(info.get('word') or '')[:40]}'; skipping duplicate upload"
            )
            return True, "backend already has the audio"
        uploaded = self._post_report(
            info,
            True,
            provider,
            audio_path=audio_path,
        )
        if uploaded[0]:
            self._cache_word_audio_present(
                str(info.get("word") or ""),
                str(info.get("language") or "en"),
                report_base_url,
            )
        return uploaded

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
        if stage != "completed":
            info["backend_uploaded"] = False
        if provider:
            info["current_provider"] = provider
        self._touch_progress(info)
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
            "engine": provider or self._required_engine() or self._planned_engine(),
            "backend_uploaded": stage in ("finalizing", "completed"),
        }
        if self.LANE == "sentence" and self._speaker:
            result["speaker"] = self._speaker
        # Audio progress is persisted locally and finalized by the durable
        # outbox. Never hold a synthesis lane on a Laravel progress request.
        if self.LANE in ("sentence", "word"):
            return True
        return self._post_result(
            task_id,
            "processing",
            result=result,
            progress=progress,
            attempt=info.get("attempt"),
        ).accepted

    def _delivery_identity(self, info: Dict[str, Any]) -> str:
        """Stable domain-report identity shared by every attempt of one audio.

        Records carrying the same identity deliver the SAME bytes to the SAME
        domain endpoint; the outbox dedupes them durably (no time windows).
        """
        if self.LANE == "sentence":
            content_id = str(info.get("content_id") or "").strip()
            if not content_id:
                return ""
            variant = str(info.get("variant_key") or "").strip()
            language = str(info.get("language") or "en").strip().lower() or "en"
            return f"{self.REPORT_PATH}:{content_id}:{language}:{variant}"
        if info.get("kind") != "word" or not info.get("dict_row_id"):
            return ""
        return (
            f"{self.REPORT_PATH}:"
            f"{encode_word_report_task_id(info['dict_row_id'], info['language'])}"
        )

    def _stage_delivery(
        self,
        info: Dict[str, Any],
        provider: str,
        audio_path: str,
        local_task_id: Optional[str],
    ) -> Dict[str, Any]:
        return audio_lane_delivery.stage(self, info, provider, audio_path, local_task_id or "")

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
        except Exception as e:  # noqa: BLE001 - failure reporting is best-effort
            ColorPrint.yellow(f"{self._log_prefix} Failure report error: {e}")

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

    def _post_task_result(self, task: Dict[str, Any], *args: Any, **kwargs: Any) -> bool:
        """Global result post for one queued task.

        Locally sourced tasks (``_local_source``: leased rows, orchestration) have
        no global_tasks row: the post would 404, so it is skipped - delivery
        is the domain report + durable outbox instead.
        """
        if task.get("_local_source"):
            return True
        return self._submit_result(*args, **kwargs)


__all__ = ["LaravelAudioWorkerReportingMixin", "encode_word_report_task_id"]
