# -*- coding: utf-8 -*-
"""Queue and Laravel-facing support for the sentence-audio worker."""

import heapq
import os
import time
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.callmodule.services.sync.laravel_client import get_laravel_client
from pycore.callmodule.services.tts_concurrency import (
    effective_concurrency,
    recommended_concurrency,
)
from pycore.pyctl.desktop.task_manager import get_task_manager
from pycore.pyutils.tts import tts_orchestrator

CLAIM_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/claim"
REPORT_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/report"
_CLAIM_TIMEOUT = 60
_REPORT_TIMEOUT = 60
_MAX_BATCH = 50
_ENGINE_PROBE_TTL_S = 60.0


class SentencePriorityQueue:
    """In-process max-heap on ``priority`` with FIFO tie-break by claim order.

    heapq is a MIN-heap, so the key is ``(-priority, seq)``: higher priority is
    popped first, and within an equal priority the earliest-claimed item (lowest
    monotonic ``seq``) wins — preserving FIFO across all claim batches.

    Rule §4: queue operations execute on one THREAD_BUS-backed state owner.
    """

    def __init__(self) -> None:
        self._heap: List[Tuple[int, int, Dict[str, Any]]] = []
        self._seq = 0
        init_serialized_owner(self, "tts.priority_queue", "TTSPriorityQueueState")

    @serialized_method
    def push(self, task: Dict[str, Any]) -> None:
        """Add one task; ``priority`` defaults to 0 when absent/non-numeric."""
        try:
            priority = int(task.get("priority") or 0)
        except (TypeError, ValueError):
            priority = 0
        heapq.heappush(self._heap, (-priority, self._seq, task))
        self._seq += 1

    @serialized_method
    def pop(self) -> Optional[Dict[str, Any]]:
        """Pop the highest-priority task (FIFO within equal priority), or None."""
        if not self._heap:
            return None
        return heapq.heappop(self._heap)[2]

    @serialized_method
    def bump(self, content_id: str, language: str, priority: int) -> bool:
        """Re-key the queued task matching content_id+language to ``priority``.

        heapq has no decrease-key; the heap holds at most a few claim batches,
        so a full heapify after mutating the one entry is the simple correct
        move. Returns True when a matching queued entry was found and re-keyed.
        """
        try:
            new_priority = int(priority)
        except (TypeError, ValueError):
            return False
        for index, (_neg, seq, task) in enumerate(self._heap):
            cid = task.get("content_id") or task.get("sentence_id") or ""
            lang = task.get("language") or ""
            if str(cid) == str(content_id) and str(lang) == str(language):
                task["priority"] = new_priority
                self._heap[index] = (-new_priority, seq, task)
                heapq.heapify(self._heap)
                return True
        return False

    @serialized_method
    def __len__(self) -> int:
        return len(self._heap)


class TTSSentenceWorkerApiMixin:
    @serialized_method
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

        label = f"[TTSSentenceWorker] {kind}"
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
    def _mark_task_started(self, task: Dict[str, Any]) -> None:
        self._current_tasks[task.get("task_id")] = dict(task)
        self._processing += 1

    @serialized_method
    def _update_task_variant(
        self,
        task_id: Any,
        index: int,
        count: int,
        key: str,
        provider: str,
    ) -> None:
        current = self._current_tasks.get(task_id)
        if current is None:
            return
        current["current_variant_index"] = index
        current["variant_count"] = count
        current["current_variant_key"] = key
        current["current_provider"] = provider

    @serialized_method
    def _mark_task_finished(self, task_id: Any) -> None:
        self._current_tasks.pop(task_id, None)
        self._processing = max(0, self._processing - 1)

    @serialized_method
    def _record_cycle(self, processed: int, succeeded: int, failed: int) -> Dict[str, Any]:
        self._total_claimed += processed
        self._total_succeeded += succeeded
        self._total_failed += failed
        self._last_cycle_summary = {
            "processed": processed,
            "succeeded": succeeded,
            "failed": failed,
            "at": int(time.time()),
        }
        return dict(self._last_cycle_summary)

    @serialized_method
    def _state_snapshot(self) -> Dict[str, Any]:
        return {
            "processing": self._processing,
            "current_tasks": [dict(task) for task in self._current_tasks.values()],
            "events": [dict(event) for event in list(self._events)[:40]],
            "total_claimed": self._total_claimed,
            "total_succeeded": self._total_succeeded,
            "total_failed": self._total_failed,
            "last_cycle": dict(self._last_cycle_summary),
        }

    @serialized_method
    def set_concurrency(self, concurrency: int) -> None:
        self._concurrency = max(0, int(concurrency))

    @serialized_method
    def get_concurrency(self) -> int:
        return self._concurrency

    def _claim_tasks(self, base: str, limit: Optional[int] = None) -> Optional[List[Dict[str, Any]]]:
        """POST /tts/sentence/claim. Returns the task list, or None when Laravel
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
            ColorPrint.yellow(
                "[TTSSentenceWorker] Claim returned non-JSON body — skipping tick"
            )
            self._log_event("claim_fail", "claim returned non-JSON body")
            return None
        data = body.get("data") if isinstance(body.get("data"), dict) else body
        return list((data or {}).get("tasks") or [])

    def fetch_queue_summary(self) -> Dict[str, Any]:
        """POST /tts/sentence/claim with limit=0 — Laravel pending/leased counts."""
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
                    resp = get_laravel_client().post(
                        REPORT_PATH,
                        base_url=base,
                        data=fields,
                        files={"audio": (os.path.basename(audio_path), fh, "audio/mpeg")},
                        timeout=_REPORT_TIMEOUT,
                    )
            else:
                resp = get_laravel_client().post(
                    REPORT_PATH, base_url=base, data=fields, timeout=_REPORT_TIMEOUT
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

    @serialized_method
    def _planned_engine(self) -> Optional[str]:
        """Active/best TTS engine with a 60s TTL cache.

        ``tts_orchestrator.tts_status()`` probes EVERY engine — per-task calls
        (the old behavior) stall synthesis on 16 sequential availability
        checks, so the result is cached for _ENGINE_PROBE_TTL_S seconds.
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
        for candidate in tts_orchestrator._priority("sentence"):
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
        return tts_orchestrator._ENGINE_CONCURRENCY.get(engine or "", "serial")

    def _effective_concurrency(self) -> Tuple[int, str]:
        engine = self._planned_engine() or ""
        kind = self._engine_concurrency_class(engine)
        return effective_concurrency(kind, self.get_concurrency()), engine

    def concurrency_status(self) -> Dict[str, Any]:
        engine = self._planned_engine() or ""
        kind = self._engine_concurrency_class(engine)
        return {
            "concurrency": effective_concurrency(kind, self.get_concurrency()),
            "concurrency_recommended": recommended_concurrency(kind),
            "concurrency_engine": engine or None,
            "concurrency_class": kind,
        }

    def _begin_local_task(self, task: Dict[str, Any]) -> Optional[str]:
        """Register one sentence job in pyctl TaskManager for the 任务队列 tab."""
        try:
            tm = get_task_manager()
            content = (task.get("content") or "").strip()
            language = (task.get("language") or "en").strip() or "en"
            preview = content[:120] if content else ""
            planned_engine = self._planned_engine()
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
