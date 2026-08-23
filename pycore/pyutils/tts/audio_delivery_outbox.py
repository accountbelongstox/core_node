# -*- coding: utf-8 -*-
"""Durable delivery outbox shared by Laravel audio worker lanes."""

import copy
import hashlib
import os
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.common.user_data_store import user_data_store


AUDIO_DELIVERY_OUTBOX_SECTION = "audio_delivery_outbox"
AUDIO_DELIVERY_OUTBOX_SCHEMA = 2
AUDIO_DELIVERY_PROCESS_ID = f"{os.getpid()}:{uuid.uuid4().hex}"
DEFAULT_LEASE_SECONDS = 180.0


def _now() -> float:
    return time.time()


class AudioDeliveryOutbox:
    """Persist generated audio until Laravel delivery and local history finish."""

    def __init__(self) -> None:
        init_serialized_owner(
            self,
            "tts.audio_delivery_outbox",
            "AudioDeliveryOutboxState",
        )

    @staticmethod
    def delivery_id(lane: str, task_id: Any, attempt: int) -> str:
        return f"{str(lane or '').strip()}:{str(task_id or '').strip()}:{max(0, int(attempt))}"

    @staticmethod
    def retry_delay(attempts: int, initial_seconds: float, maximum_seconds: float) -> float:
        exponent = max(0, min(int(attempts) - 1, 8))
        return min(float(maximum_seconds), float(initial_seconds) * (2 ** exponent))

    def stage_audio(
        self,
        record: Dict[str, Any],
        audio_path: str,
        cache_root: Path,
    ) -> Dict[str, Any]:
        """Retain immutable audio before advancing the durable delivery steps."""
        lane = str(record.get("lane") or "").strip()
        task_id = record.get("task_id")
        attempt = max(0, int(record.get("attempt") or 0))
        delivery_id = self.delivery_id(lane, task_id, attempt)
        source_path = Path(audio_path).resolve()
        source_sha256 = hashlib.sha256(source_path.read_bytes()).hexdigest()
        retained_audio_path = (
            Path(cache_root).resolve()
            / "audio_delivery"
            / lane
            / hashlib.sha1(delivery_id.encode("utf-8")).hexdigest()
            / f"{source_sha256}.mp3"
        )
        retained_audio_path.parent.mkdir(parents=True, exist_ok=True)
        if not retained_audio_path.is_file():
            shutil.copy2(str(source_path), str(retained_audio_path))
        staged_record = copy.deepcopy(record)
        staged_record.update({
            "delivery_id": delivery_id,
            "audio_path": str(retained_audio_path),
            "audio_sha256": source_sha256,
        })
        return self.put(staged_record)

    @staticmethod
    def _load_records() -> Dict[str, Dict[str, Any]]:
        section = user_data_store.get_section(AUDIO_DELIVERY_OUTBOX_SECTION) or {}
        records = section.get("records")
        if not isinstance(records, dict):
            return {}
        return {
            str(key): dict(value)
            for key, value in records.items()
            if isinstance(value, dict)
        }

    @staticmethod
    def _save_records(records: Dict[str, Dict[str, Any]]) -> None:
        user_data_store.set_section(
            AUDIO_DELIVERY_OUTBOX_SECTION,
            {
                "schema": AUDIO_DELIVERY_OUTBOX_SCHEMA,
                "records": {
                    str(row["delivery_id"]): row
                    for row in records.values()
                    if row.get("delivery_id")
                },
                "updated_at": _now(),
            },
        )

    @serialized_method
    def put(self, record: Dict[str, Any]) -> Dict[str, Any]:
        records = self._load_records()
        delivery_id = str(record.get("delivery_id") or "").strip()
        if not delivery_id:
            raise ValueError("audio delivery requires delivery_id")
        current = records.get(delivery_id, {})
        row = copy.deepcopy(current)
        row.update(copy.deepcopy(record))
        row["delivery_id"] = delivery_id
        row["schema"] = AUDIO_DELIVERY_OUTBOX_SCHEMA
        row.setdefault("created_at", _now())
        row.setdefault("domain_uploaded", False)
        row.setdefault(
            "domain_delivery_finished",
            bool(row.get("domain_uploaded")),
        )
        row.setdefault("result_accepted", False)
        row.setdefault("history_recorded", False)
        row.setdefault("delivery_attempts", 0)
        row.setdefault("retry_at", 0.0)
        if current:
            row["created_at"] = float(current.get("created_at") or row["created_at"])
            row["status"] = str(current.get("status") or "pending")
            row["domain_uploaded"] = bool(current.get("domain_uploaded"))
            row["domain_delivery_finished"] = bool(
                current.get(
                    "domain_delivery_finished",
                    current.get("domain_uploaded"),
                )
            )
            row["result_accepted"] = bool(current.get("result_accepted"))
            row["history_recorded"] = bool(current.get("history_recorded"))
            row["delivery_attempts"] = max(
                int(current.get("delivery_attempts") or 0),
                int(row.get("delivery_attempts") or 0),
            )
            current_audio_path = str(current.get("audio_path") or "")
            if current_audio_path and os.path.isfile(current_audio_path):
                row["audio_path"] = current_audio_path
                row["audio_sha256"] = str(current.get("audio_sha256") or "")
            for lease_key in ("lease_owner", "lease_process", "lease_until"):
                if lease_key in current:
                    row[lease_key] = current[lease_key]
        row["updated_at"] = _now()
        records[delivery_id] = row
        self._save_records(records)
        return copy.deepcopy(row)

    @serialized_method
    def claim(
        self,
        delivery_id: str,
        owner: str,
        process_id: str = AUDIO_DELIVERY_PROCESS_ID,
        lease_seconds: float = DEFAULT_LEASE_SECONDS,
    ) -> Optional[Dict[str, Any]]:
        records = self._load_records()
        row = records.get(str(delivery_id))
        now = _now()
        if not row or str(row.get("status") or "pending") == "dead_letter":
            return None
        lease_until = float(row.get("lease_until") or 0)
        lease_process = str(row.get("lease_process") or "")
        if lease_until > now and lease_process == process_id:
            return None
        row["lease_owner"] = str(owner)
        row["lease_process"] = str(process_id)
        row["lease_until"] = now + max(1.0, float(lease_seconds))
        row["updated_at"] = now
        records[str(delivery_id)] = row
        self._save_records(records)
        return copy.deepcopy(row)

    @serialized_method
    def patch(
        self,
        delivery_id: str,
        patch: Dict[str, Any],
        owner: str = "",
    ) -> Optional[Dict[str, Any]]:
        records = self._load_records()
        row = records.get(str(delivery_id))
        if not row:
            return None
        if owner and str(row.get("lease_owner") or "") != str(owner):
            return None
        row.update(copy.deepcopy(patch))
        row["updated_at"] = _now()
        records[str(delivery_id)] = row
        self._save_records(records)
        return copy.deepcopy(row)

    @serialized_method
    def release(
        self,
        delivery_id: str,
        owner: str,
        *,
        error: str = "",
        retry_at: float = 0.0,
    ) -> Optional[Dict[str, Any]]:
        records = self._load_records()
        row = records.get(str(delivery_id))
        if not row or str(row.get("lease_owner") or "") != str(owner):
            return None
        row.update({
            "last_error": str(error or "")[:500],
            "retry_at": max(0.0, float(retry_at)),
            "lease_owner": "",
            "lease_process": "",
            "lease_until": 0.0,
            "updated_at": _now(),
        })
        records[str(delivery_id)] = row
        self._save_records(records)
        return copy.deepcopy(row)

    @serialized_method
    def complete(self, delivery_id: str, owner: str = "") -> bool:
        records = self._load_records()
        row = records.get(str(delivery_id))
        if not row:
            return False
        if owner and str(row.get("lease_owner") or "") != str(owner):
            return False
        records.pop(str(delivery_id), None)
        self._save_records(records)
        return True

    @serialized_method
    def mark_dead_letter(self, delivery_id: str, owner: str, error: str) -> bool:
        records = self._load_records()
        row = records.get(str(delivery_id))
        if not row or str(row.get("lease_owner") or "") != str(owner):
            return False
        row.update({
            "status": "dead_letter",
            "last_error": str(error or "")[:500],
            "retry_at": 0.0,
            "lease_owner": "",
            "lease_process": "",
            "lease_until": 0.0,
            "updated_at": _now(),
        })
        records[str(delivery_id)] = row
        self._save_records(records)
        return True

    @serialized_method
    def list_ready(self, lane: str, limit: int = 100) -> List[Dict[str, Any]]:
        now = _now()
        rows = [
            row
            for row in self._load_records().values()
            if str(row.get("lane") or "") == str(lane)
            and str(row.get("status") or "pending") != "dead_letter"
            and float(row.get("retry_at") or 0) <= now
            and (
                float(row.get("lease_until") or 0) <= now
                or str(row.get("lease_process") or "") != AUDIO_DELIVERY_PROCESS_ID
            )
        ]
        rows.sort(key=lambda row: float(row.get("created_at") or 0))
        return [copy.deepcopy(row) for row in rows[:max(1, int(limit))]]

    @serialized_method
    def retry_dead_letters(self, lane: str) -> int:
        records = self._load_records()
        changed = 0
        for row in records.values():
            if str(row.get("lane") or "") != str(lane):
                continue
            if str(row.get("status") or "pending") != "dead_letter":
                continue
            row["status"] = "pending"
            row["retry_at"] = 0.0
            row["last_error"] = ""
            row["updated_at"] = _now()
            changed += 1
        if changed:
            self._save_records(records)
        return changed

    @serialized_method
    def stats(self, lane: str) -> Dict[str, Any]:
        rows = [
            row
            for row in self._load_records().values()
            if str(row.get("lane") or "") == str(lane)
        ]
        pending_rows = [
            row for row in rows if str(row.get("status") or "pending") != "dead_letter"
        ]
        oldest = min(
            (float(row.get("created_at") or 0) for row in pending_rows),
            default=0.0,
        )
        next_retry = min(
            (float(row.get("retry_at") or 0) for row in pending_rows),
            default=0.0,
        )
        return {
            "total": len(rows),
            "pending": len(pending_rows),
            "pending_domain_upload": sum(
                1
                for row in pending_rows
                if not bool(
                    row.get(
                        "domain_delivery_finished",
                        row.get("domain_uploaded"),
                    )
                )
            ),
            "pending_result": sum(
                1
                for row in pending_rows
                if bool(
                    row.get(
                        "domain_delivery_finished",
                        row.get("domain_uploaded"),
                    )
                )
                and not bool(row.get("result_accepted"))
            ),
            "pending_history": sum(
                1
                for row in pending_rows
                if bool(row.get("result_accepted"))
                and not bool(row.get("history_recorded"))
            ),
            "dead_letter": sum(
                1 for row in rows if str(row.get("status") or "") == "dead_letter"
            ),
            "oldest_pending_at": oldest or None,
            "next_retry_at": next_retry or None,
        }


audio_delivery_outbox = AudioDeliveryOutbox()


class AudioDeliveryExecutor:
    """Advance each independently idempotent Laravel audio delivery step."""

    @staticmethod
    def _terminal_report_error(detail: str) -> bool:
        normalized = str(detail or "").lower()
        return (
            normalized.startswith("server validation rejected")
            or normalized.startswith("unknown task on server")
            or normalized.startswith("http 4")
        )

    def deliver(
        self,
        handler: Any,
        record: Dict[str, Any],
        initial_retry_seconds: float,
        maximum_retry_seconds: float,
    ) -> Dict[str, Any]:
        delivery_id = str(record.get("delivery_id") or "")
        owner = f"{AUDIO_DELIVERY_PROCESS_ID}:{delivery_id}:{time.monotonic_ns()}"
        claimed = audio_delivery_outbox.claim(delivery_id, owner)
        if not claimed:
            return {"delivery_id": delivery_id, "processed": False}

        info = dict(claimed.get("info") or {})
        task_id = claimed.get("task_id")
        provider = str(claimed.get("provider") or "")
        audio_path = str(claimed.get("audio_path") or "")
        task_type = str(claimed.get("task_type") or handler.QUEUE_KEY)
        base_url = str(claimed.get("base_url") or handler.api_url)
        attempts = int(claimed.get("delivery_attempts") or 0) + 1
        retry_delay = audio_delivery_outbox.retry_delay(
            attempts,
            initial_retry_seconds,
            maximum_retry_seconds,
        )
        audio_delivery_outbox.patch(
            delivery_id,
            {"delivery_attempts": attempts, "last_attempt_at": time.time()},
            owner=owner,
        )
        handler._remember_task_types(
            [{"task_id": task_id, "task_type": task_type}],
            base_url,
        )

        if not audio_path or not os.path.isfile(audio_path):
            error = "cached audio is missing"
            audio_delivery_outbox.mark_dead_letter(delivery_id, owner, error)
            handler._append_delivery_failure_history(
                info,
                provider,
                audio_path,
                error,
                delivery_id,
            )
            return {"delivery_id": delivery_id, "processed": True, "success": False}

        domain_uploaded = bool(claimed.get("domain_uploaded"))
        domain_delivery_finished = bool(
            claimed.get("domain_delivery_finished", domain_uploaded)
        )
        domain_error = str(claimed.get("domain_upload_error") or "")
        if not domain_delivery_finished:
            uploaded = handler._upload_report(info, provider, audio_path)
            if uploaded is not None and not uploaded[0]:
                error = uploaded[1]
                if self._terminal_report_error(error):
                    domain_delivery_finished = True
                    domain_error = error
                    audio_delivery_outbox.patch(
                        delivery_id,
                        {
                            "domain_delivery_finished": True,
                            "domain_uploaded": False,
                            "domain_upload_error": error,
                            "last_error": "",
                        },
                        owner=owner,
                    )
                    handler._log_event(
                        "upload_terminal",
                        f"domain upload unavailable; global result fallback: {error}",
                        info,
                        mirror=handler.LANE != "word",
                    )
                else:
                    audio_delivery_outbox.release(
                        delivery_id,
                        owner,
                        error=error,
                        retry_at=time.time() + retry_delay,
                    )
                    handler._log_event(
                        "upload_retry",
                        f"attempt={attempts} retry_in={retry_delay:.0f}s error={error}",
                        info,
                    )
                    return {"delivery_id": delivery_id, "processed": True, "success": False}
            else:
                domain_delivery_finished = True
                domain_uploaded = uploaded is not None
                domain_error = ""
                audio_delivery_outbox.patch(
                    delivery_id,
                    {
                        "domain_delivery_finished": True,
                        "domain_uploaded": domain_uploaded,
                        "domain_upload_error": "",
                        "last_error": "",
                    },
                    owner=owner,
                )
                handler._log_event(
                    "upload_done" if domain_uploaded else "upload_skipped",
                    (
                        f"backend accepted audio (attempt={attempts})"
                        if domain_uploaded
                        else "domain upload is not required; using global result"
                    ),
                    info,
                    mirror=handler.LANE != "word",
                )

        info["backend_uploaded"] = domain_uploaded
        if domain_error:
            info["backend_upload_error"] = domain_error

        result_accepted = bool(claimed.get("result_accepted"))
        if not result_accepted:
            result = handler._build_success_result(
                info,
                provider,
                audio_path,
                include_audio=not (
                    domain_uploaded
                    and str(info.get("kind") or "") in ("word", "sentence")
                ),
            )
            posted = handler._post_result(
                task_id,
                "completed",
                result=result,
                progress=100,
                attempts=1,
                attempt=info.get("attempt"),
            )
            if not posted:
                info["backend_result_accepted"] = False
                handler._mark_backend_result(task_id, False, info.get("attempt"))
                if str(task_id) not in handler._task_type_by_id:
                    error = "completed result rejected because task ownership changed"
                    audio_delivery_outbox.mark_dead_letter(delivery_id, owner, error)
                    handler._append_delivery_failure_history(
                        info,
                        provider,
                        audio_path,
                        error,
                        delivery_id,
                    )
                    return {"delivery_id": delivery_id, "processed": True, "success": False}
                audio_delivery_outbox.release(
                    delivery_id,
                    owner,
                    error="Laravel result endpoint unavailable",
                    retry_at=time.time() + retry_delay,
                )
                return {"delivery_id": delivery_id, "processed": True, "success": False}
            result_accepted = True
            audio_delivery_outbox.patch(
                delivery_id,
                {"result_accepted": True, "last_error": ""},
                owner=owner,
            )

        info["backend_uploaded"] = domain_uploaded
        info["backend_result_accepted"] = result_accepted
        handler._mark_backend_result(task_id, True, info.get("attempt"))
        handler._set_task_progress(info, "completed", provider)
        history_recorded = bool(claimed.get("history_recorded"))
        if not history_recorded:
            history_recorded = handler._append_history(
                info,
                provider,
                audio_path,
                delivery_id,
            )
            if not history_recorded:
                audio_delivery_outbox.release(
                    delivery_id,
                    owner,
                    error="local task history is unavailable",
                    retry_at=time.time() + retry_delay,
                )
                return {"delivery_id": delivery_id, "processed": True, "success": False}
            audio_delivery_outbox.patch(
                delivery_id,
                {"history_recorded": True, "last_error": ""},
                owner=owner,
            )
        audio_delivery_outbox.complete(delivery_id, owner)
        local_task_id = str(claimed.get("local_task_id") or "")
        if str(claimed.get("local_process_id") or "") == AUDIO_DELIVERY_PROCESS_ID:
            handler._finish_local_task(
                local_task_id or None,
                True,
                provider=provider,
                audio_path=audio_path,
                text=(info.get("text") or "")[:120],
                language=info.get("language") or "",
            )
        handler._record_backend_delivery_success()
        handler._log_event(
            "delivery_done",
            f"via {provider}; backend_upload={'ok' if domain_uploaded else 'fallback'}; result=ok",
            info,
            mirror=handler.LANE != "word",
        )
        return {"delivery_id": delivery_id, "processed": True, "success": True}


audio_delivery_executor = AudioDeliveryExecutor()


__all__ = [
    "AUDIO_DELIVERY_PROCESS_ID",
    "AudioDeliveryExecutor",
    "AudioDeliveryOutbox",
    "audio_delivery_executor",
    "audio_delivery_outbox",
]
