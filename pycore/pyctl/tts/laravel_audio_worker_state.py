# -*- coding: utf-8 -*-
"""State, progress, and payload normalization for Laravel audio workers."""

import hashlib
import os
import time
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import serialized_method
from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_PROGRESS_STAGES,
    GLOBAL_TASK_PROGRESS_TOTAL,
)
from pycore.pyutils.tts.qwen.config import ENGINE_NAME as QWEN3TTS_ENGINE


class LaravelAudioWorkerStateMixin:
    """Own bounded worker state and task-shape normalization."""

    @serialized_method
    def _log_event(
        self,
        kind: str,
        detail: str,
        info: Optional[Dict[str, Any]] = None,
        mirror: bool = True,
    ) -> None:
        """Append one activity event (newest first) + mirror to the live log."""
        entry: Dict[str, Any] = {
            "at": int(time.time()),
            "kind": kind,
            "detail": (detail or "")[:240],
        }
        self._event_revision += 1
        entry["id"] = self._event_revision
        if info:
            entry["task_id"] = info.get("task_id")
            entry["task_display_id"] = self._display_task_id(info.get("task_id"))
            entry["language"] = info.get("language")
            if info.get("content_id"):
                entry["content_id"] = info.get("content_id")
            text = (info.get("text") or info.get("word") or "").strip()
            if text:
                entry["text_preview"] = text[:80]
            started = float(info.get("_started_monotonic") or 0.0)
            if started > 0:
                entry["elapsed_seconds"] = round(max(0.0, time.monotonic() - started), 2)
            if "backend_uploaded" in info:
                entry["backend_uploaded"] = bool(info.get("backend_uploaded"))
            if "backend_result_accepted" in info:
                entry["backend_result_accepted"] = bool(info.get("backend_result_accepted"))
            if info.get("stage"):
                entry["stage"] = info.get("stage")
            if info.get("progress") is not None:
                entry["progress"] = int(info.get("progress") or 0)
                entry["progress_total"] = int(
                    info.get("progress_total") or GLOBAL_TASK_PROGRESS_TOTAL
                )
            if info.get("current_provider"):
                entry["current_provider"] = info.get("current_provider")
            if info.get("upload_transferred_bytes") is not None:
                entry["upload_transferred_bytes"] = int(
                    info.get("upload_transferred_bytes") or 0
                )
                entry["upload_total_bytes"] = int(
                    info.get("upload_total_bytes") or 0
                )
                entry["upload_progress"] = float(
                    info.get("upload_progress") or 0.0
                )
            if self.LANE == "word":
                entry["backend_progress_current"] = int(
                    info.get("backend_progress_current") or 0
                )
                entry["backend_progress_total"] = int(
                    info.get("backend_progress_total") or 0
                )
        self._events.appendleft(entry)
        if not mirror:
            return

        label = f"{self._log_prefix} {kind}"
        if info and info.get("task_id") is not None:
            label += f" task={self._display_task_id(info.get('task_id'))}"
        if info:
            text = str(info.get("text") or info.get("word") or "").strip()
            if text:
                content_label = "word" if self.LANE == "word" else "text"
                label += f" {content_label}={text[:40]!r}"
            if self.LANE == "word":
                backend_progress_current = int(info.get("backend_progress_current") or 0)
                backend_progress_total = int(info.get("backend_progress_total") or 0)
                label += f" progress={backend_progress_current}/{backend_progress_total}"
            elif info.get("progress") is not None:
                progress = int(info.get("progress") or 0)
                progress_total = int(info.get("progress_total") or GLOBAL_TASK_PROGRESS_TOTAL)
                label += f" progress={progress}/{progress_total}"
        line = f"{label}: {detail[:160]}" if detail else label
        # First-use events stay blue; ongoing progress/idle pings are gray;
        # terminal successes are green; failures stay yellow.
        if kind.endswith("_fail") or kind in ("report_reject", "synth_error"):
            ColorPrint.yellow(line)
        elif kind in ("progress", "idle"):
            ColorPrint.gray(line)
        elif kind.endswith("_done"):
            ColorPrint.green(line)
        else:
            ColorPrint.blue(line)

    @serialized_method
    def _mark_task_started(self, task_id: Any, info: Dict[str, Any]) -> None:
        current = dict(info)
        current["_started_monotonic"] = time.monotonic()
        current["stage"] = "accepted"
        current["progress"] = GLOBAL_TASK_PROGRESS_STAGES["accepted"]
        current["progress_total"] = GLOBAL_TASK_PROGRESS_TOTAL
        current["task_display_id"] = self._display_task_id(task_id)
        current["backend_uploaded"] = False
        current["backend_result_accepted"] = False
        info["_started_monotonic"] = current["_started_monotonic"]
        info["stage"] = current["stage"]
        info["progress"] = current["progress"]
        info["progress_total"] = current["progress_total"]
        info["backend_uploaded"] = False
        info["backend_result_accepted"] = False
        current_key = self._current_task_key(task_id, info.get("attempt"))
        self._current_tasks[current_key] = current
        self._processing += 1

    @serialized_method
    def _mark_task_progress(
        self,
        task_id: Any,
        stage: str,
        progress: int,
        provider: str = "",
        attempt: Optional[int] = None,
    ) -> bool:
        current = self._current_tasks.get(self._current_task_key(task_id, attempt))
        if current is None:
            return False
        changed = current.get("stage") != stage or current.get("progress") != progress
        current["stage"] = stage
        current["progress"] = progress
        current["backend_uploaded"] = stage in ("finalizing", "completed")
        if provider:
            changed = changed or current.get("current_provider") != provider
            current["current_provider"] = provider
        return changed

    @serialized_method
    def _mark_qwen_progress(
        self,
        task_id: Any,
        attempt: Optional[int],
        progress: int,
        value: Dict[str, Any],
    ) -> bool:
        current = self._current_tasks.get(self._current_task_key(task_id, attempt))
        if current is None:
            return False
        revision = int(value.get("progress_revision") or 0)
        changed = (
            int(current.get("qwen_progress_revision") or 0) != revision
            or int(current.get("progress") or 0) != progress
        )
        current["stage"] = "synthesizing"
        current["progress"] = progress
        current["current_provider"] = QWEN3TTS_ENGINE
        current["qwen_progress_revision"] = revision
        current["qwen_progress"] = int(value.get("progress") or 0)
        current["qwen_progress_total"] = int(value.get("progress_total") or 0)
        current["qwen_progress_phase"] = str(value.get("progress_phase") or "")
        return changed

    def _report_qwen_progress(
        self,
        info: Dict[str, Any],
        value: Dict[str, Any],
    ) -> None:
        completed = max(0, int(value.get("progress") or 0))
        total = max(0, int(value.get("progress_total") or 0))
        base = int(GLOBAL_TASK_PROGRESS_STAGES["synthesizing"])
        ceiling = int(GLOBAL_TASK_PROGRESS_STAGES["uploading"]) - 1
        progress = (
            base + round((ceiling - base) * min(1.0, completed / total))
            if total > 0
            else base
        )
        phase = str(value.get("progress_phase") or value.get("status") or "queued")
        info["stage"] = "synthesizing"
        info["progress"] = progress
        info["progress_total"] = GLOBAL_TASK_PROGRESS_TOTAL
        info["current_provider"] = QWEN3TTS_ENGINE
        info["qwen_progress_revision"] = int(value.get("progress_revision") or 0)
        info["qwen_progress"] = completed
        info["qwen_progress_total"] = total
        info["qwen_progress_phase"] = phase
        changed = self._mark_qwen_progress(
            info.get("task_id"),
            info.get("attempt"),
            progress,
            value,
        )
        if not changed:
            return
        self._log_event(
            "progress",
            f"qwen phase={phase} chunks={completed}/{total}",
            info,
            mirror=self.LANE != "word",
        )
        self._post_result(
            info.get("task_id"),
            "processing",
            result={
                "stage": "synthesizing",
                "engine": QWEN3TTS_ENGINE,
                "qwen_progress_revision": int(value.get("progress_revision") or 0),
                "qwen_progress": completed,
                "qwen_progress_total": total,
                "qwen_progress_phase": phase,
            },
            progress=progress,
            attempts=1,
            attempt=info.get("attempt"),
        )

    @serialized_method
    def _mark_upload_progress(
        self,
        task_id: Any,
        attempt: Optional[int],
        progress: int,
        record: Dict[str, Any],
        provider: str,
    ) -> bool:
        current = self._current_tasks.get(self._current_task_key(task_id, attempt))
        if current is None:
            return False
        transferred = int(record.get("transferred_bytes") or 0)
        changed = int(current.get("upload_transferred_bytes") or 0) != transferred
        current["stage"] = "uploading"
        current["progress"] = progress
        current["current_provider"] = provider
        current["upload_transferred_bytes"] = transferred
        current["upload_total_bytes"] = int(record.get("total_bytes") or 0)
        current["upload_progress"] = float(record.get("progress") or 0.0)
        return changed

    def _report_upload_progress(
        self,
        info: Dict[str, Any],
        provider: str,
        record: Dict[str, Any],
    ) -> None:
        upload_progress = min(100.0, max(0.0, float(record.get("progress") or 0.0)))
        transferred_bytes = int(record.get("transferred_bytes") or 0)
        previous_transferred_bytes = int(info.get("upload_transferred_bytes") or 0)
        base = int(GLOBAL_TASK_PROGRESS_STAGES["uploading"])
        ceiling = int(GLOBAL_TASK_PROGRESS_STAGES["finalizing"]) - 1
        progress = base + round((ceiling - base) * upload_progress / 100.0)
        info["stage"] = "uploading"
        info["progress"] = progress
        info["progress_total"] = GLOBAL_TASK_PROGRESS_TOTAL
        info["current_provider"] = provider
        info["upload_transferred_bytes"] = transferred_bytes
        info["upload_total_bytes"] = int(record.get("total_bytes") or 0)
        info["upload_progress"] = upload_progress
        current_changed = self._mark_upload_progress(
            info.get("task_id"),
            info.get("attempt"),
            progress,
            record,
            provider,
        )
        changed = current_changed or transferred_bytes != previous_transferred_bytes
        if changed:
            self._log_event(
                "progress",
                (
                    f"upload={upload_progress:g}% "
                    f"bytes={info['upload_transferred_bytes']}/{info['upload_total_bytes']}"
                ),
                info,
                mirror=self.LANE != "word",
            )

    @serialized_method
    def _mark_backend_result(
        self,
        task_id: Any,
        accepted: bool,
        attempt: Optional[int] = None,
    ) -> None:
        current = self._current_tasks.get(self._current_task_key(task_id, attempt))
        if current is not None:
            current["backend_result_accepted"] = bool(accepted)

    @serialized_method
    def _mark_task_finished(self, task_id: Any, attempt: Optional[int] = None) -> None:
        self._current_tasks.pop(self._current_task_key(task_id, attempt), None)
        self._processing = max(0, self._processing - 1)

    @staticmethod
    def _current_task_key(task_id: Any, attempt: Optional[int]) -> str:
        return f"{task_id}:{max(0, int(attempt or 0))}"

    @serialized_method
    def _record_cycle(self, processed: int, succeeded: int, failed: int) -> Dict[str, Any]:
        self._last_cycle_summary = {
            "processed": processed,
            "succeeded": succeeded,
            "failed": failed,
            "at": int(time.time()),
        }
        return dict(self._last_cycle_summary)

    @serialized_method
    def _record_task_result(self, success: bool) -> None:
        """Update lifetime counters as soon as one task reaches a terminal state."""
        self._total_claimed += 1
        if success:
            self._total_succeeded += 1
        else:
            self._total_failed += 1

    def _state_snapshot(self) -> Dict[str, Any]:
        """Read the current counters without entering the worker queue."""
        try:
            current_tasks = []
            now = time.monotonic()
            for task in list(self._current_tasks.values()):
                current = dict(task)
                started = float(current.pop("_started_monotonic", 0.0) or 0.0)
                current["elapsed_seconds"] = round(max(0.0, now - started), 2) if started else 0.0
                current_tasks.append(current)
        except RuntimeError:
            current_tasks = []
        return {
            "processing": self._processing,
            "current_tasks": current_tasks,
            "event_count": len(self._events),
            "event_revision": self._event_revision,
            "total_claimed": self._total_claimed,
            "total_succeeded": self._total_succeeded,
            "total_failed": self._total_failed,
            "last_cycle": dict(self._last_cycle_summary),
        }

    def get_event_page(self, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """Return one newest-first worker-event page without bloating status."""
        normalized_page = max(1, int(page or 1))
        normalized_size = min(40, max(5, int(page_size or 20)))
        events = list(self._events)
        total = len(events)
        page_count = max(1, (total + normalized_size - 1) // normalized_size)
        normalized_page = min(normalized_page, page_count)
        offset = (normalized_page - 1) * normalized_size
        return {
            "items": [
                dict(event)
                for event in events[offset:offset + normalized_size]
            ],
            "page": normalized_page,
            "page_size": normalized_size,
            "pages": page_count,
            "total": total,
            "revision": self._event_revision,
        }

    # -------------------- inflight guard --------------------

    @serialized_method
    def _claim_inflight(self, task: Dict[str, Any]) -> bool:
        """Mark one task in-flight; False when a duplicate is already running.

        Audio work owns its entry until the minimum task step releases it. A
        fixed deadline can expire during valid Qwen or upload progress and run
        the same idempotency key concurrently inside one Pycore process.
        """
        task_key = self._task_execution_key(task)
        if task_key in self._inflight:
            return False
        self._inflight[task_key] = float("inf")
        return True

    @serialized_method
    def _release_inflight(self, task: Dict[str, Any]) -> None:
        self._inflight.pop(self._task_execution_key(task), None)

    @staticmethod
    def _task_attempt(task: Dict[str, Any]) -> int:
        raw_attempt = task.get("retry_count")
        return max(0, int(raw_attempt)) if isinstance(raw_attempt, int) else 0

    @classmethod
    def _task_execution_key(cls, task: Dict[str, Any]) -> str:
        return f"{task.get('task_id')}:{cls._task_attempt(task)}"

    # -------------------- payload normalization --------------------

    def _accepts_task(self, task: Dict[str, Any]) -> bool:
        """Lane guard: a mis-tagged task of another lane is reported failed so
        Laravel re-routes it, never silently processed with the wrong shape."""
        task_type = str(task.get("task_type") or "")
        return task_type in self._contract_task_types()

    def _normalize(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Tolerate missing optional fields; required-field gaps become an
        ``error`` entry the caller reports as a failed task."""
        payload = task.get("payload") if isinstance(task.get("payload"), dict) else {}
        task_type = str(task.get("task_type") or "")
        language = (str(payload.get("language") or "en").strip() or "en").lower()
        info: Dict[str, Any] = {
            "task_id": task.get("task_id"),
            "task_type": task_type,
            "attempt": self._task_attempt(task),
            "queue_position": task.get("queue_position"),
            "language": language,
        }

        if self.LANE == "sentence":
            text = str(payload.get("text") or payload.get("content") or "").strip()
            content_id = str(
                payload.get("content_id") or payload.get("hash") or ""
            ).strip()
            info.update({
                "kind": "sentence",
                "text": text,
                "content_id": content_id,
                "variant_key": str(payload.get("variant_key") or "").strip(),
                "accent": str(payload.get("accent") or "").strip() or None,
                # The sentence profile keeps the retired worker's default voice.
                "gender": "female",
                "engine_profile": str(payload.get("engine_profile") or "").strip() or None,
                "preferred_engine": str(payload.get("preferred_engine") or "").strip() or None,
                "speaker": str(payload.get("speaker") or self._speaker or "").strip() or None,
            })
            if not text:
                info["error"] = "sentence_audio payload carried no text"
            elif not content_id:
                info["error"] = "sentence_audio payload carried no content_id"
            return info

        if task_type != self.QUEUE_KEY:
            # article_audio shares the remote_audio lane: plain content synth,
            # no domain report endpoint (the result carries audio_base64).
            text = str(payload.get("content") or payload.get("text") or "").strip()
            info.update({
                "kind": "article",
                "text": text,
                "md5": str(payload.get("md5") or "").strip()
                or hashlib.md5(text.encode("utf-8")).hexdigest(),
                "accent": str(payload.get("accent") or "").strip() or None,
                "gender": str(payload.get("gender") or "").strip() or None,
            })
            if not text:
                info["error"] = f"{task_type} payload carried no content"
            return info

        word = str(payload.get("word") or payload.get("content") or "").strip()
        md5 = str(payload.get("md5") or "").strip()
        if not md5 and word:
            md5 = hashlib.md5(word.encode("utf-8")).hexdigest()
        dict_row_id: Optional[int] = None
        raw_row_id = payload.get("dict_row_id")
        if raw_row_id not in (None, ""):
            try:
                dict_row_id = int(raw_row_id)
            except (TypeError, ValueError):
                dict_row_id = None
        info.update({
            "kind": "word",
            "word": word,
            "text": word,
            "md5": md5,
            "accent": str(payload.get("accent") or "").strip() or None,
            "gender": str(payload.get("gender") or "").strip() or None,
            "dict_row_id": dict_row_id,
        })
        if not word:
            info["error"] = "word_audio payload carried no word/content"
        return info

    # -------------------- cache + synthesis --------------------

    def _sentence_cache_path(self, info: Dict[str, Any]) -> str:
        """Persistent cache path scoped by content, variant, and required engine."""
        key = (info.get("content_id") or "audio").strip()
        vkey = (info.get("variant_key") or "").strip()
        suffix = f"_{vkey}" if vkey else ""
        engine_suffix = f"_{self.REQUIRED_ENGINE}" if self.REQUIRED_ENGINE else ""
        speaker = str(info.get("speaker") or "").strip()
        speaker_suffix = f"_{hashlib.sha1(speaker.encode('utf-8')).hexdigest()[:10]}" if speaker else ""
        return os.path.join(
            self._cache_dir,
            info["language"],
            f"{key}{suffix}{engine_suffix}{speaker_suffix}.mp3",
        )


__all__ = ["LaravelAudioWorkerStateMixin"]
