# -*- coding: utf-8 -*-
"""Durable delivery outbox shared by Laravel audio worker lanes."""

import copy
import os
import time
import uuid
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


__all__ = [
    "AUDIO_DELIVERY_PROCESS_ID",
    "AudioDeliveryOutbox",
    "audio_delivery_outbox",
]
