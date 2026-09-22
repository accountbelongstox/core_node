# -*- coding: utf-8 -*-
"""Durable delivery outbox shared by Laravel audio worker lanes."""

import copy
import hashlib
import os
import shutil
import threading
import time
import uuid
from pathlib import Path
from contextlib import contextmanager
from functools import partial, wraps
from typing import Any, Dict, Iterator, List, Optional

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.system_paths import APP_CONFIG_DIR
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.user_data_store import UserDataStore, user_data_store
from pycore.pyutils.common.durable_record_store import open_record_store
from pycore.pyutils.common.http_progress_upload import http_progress_client


AUDIO_DELIVERY_OUTBOX_SECTION = "audio_delivery_outbox"
AUDIO_DELIVERY_OUTBOX_SCHEMA = 2
AUDIO_DELIVERY_PROCESS_ID = f"{os.getpid()}:{uuid.uuid4().hex}"
DEFAULT_LEASE_SECONDS = 180.0
AUDIO_DELIVERY_OUTBOX_FILE = "audio_delivery_outbox.json"
AUDIO_DELIVERY_OUTBOX_DEFAULTS = APP_CONFIG_DIR / "audio_delivery_outbox_empty_defaults"
ACTIVE_AUDIO_DELIVERY_PREFIX = "tts.audio_delivery.active"
# Durable per-identity receipt retained after a task record completes, so any
# later attempt of the same audio inherits the finished domain upload instead
# of re-transferring identical bytes.
DOMAIN_RECEIPT_PREFIX = "__domain_receipt__:"
SIBLING_IN_FLIGHT_DEFER_SECONDS = 1.0


def _now() -> float:
    return time.time()


def _active_delivery(owner: str) -> bool:
    worker = THREAD_BUS.get_signal(f"{ACTIVE_AUDIO_DELIVERY_PREFIX}.{owner}")
    return worker is not None and worker.is_alive()


def _delivery_available(row: Dict[str, Any], now: float) -> bool:
    if str(row.get("lease_process") or "") == AUDIO_DELIVERY_PROCESS_ID and _active_delivery(str(row.get("lease_owner") or "")):
        return False
    return float(row.get("lease_until") or 0) <= now


def _record_transaction(method: Any) -> Any:
    @wraps(method)
    def transaction(instance: Any, /, *args: Any, **kwargs: Any) -> Any:
        with instance._record_store().transaction():
            return method(instance, *args, **kwargs)
    return transaction


class AudioDeliveryOutbox:
    """Persist generated audio until Laravel delivery and local history finish."""

    def __init__(self) -> None:
        self._store = UserDataStore(file_name=AUDIO_DELIVERY_OUTBOX_FILE, defaults_dir=AUDIO_DELIVERY_OUTBOX_DEFAULTS)
        self._records_store: Any = None
        init_serialized_owner(
            self,
            "tts.audio_delivery_outbox",
            "AudioDeliveryOutboxState",
        )

    @contextmanager
    def delivery_scope(self, delivery_id: str, owner: str) -> Iterator[None]:
        active_signal = f"{ACTIVE_AUDIO_DELIVERY_PREFIX}.{owner}"
        THREAD_BUS.signal(active_signal, threading.current_thread())
        try:
            with http_progress_client.transfer_scope(partial(self.renew, delivery_id, owner)):
                yield
        finally:
            THREAD_BUS.clear_signal(active_signal)

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
        # Records sharing one domain identity deliver the same bytes to the
        # same endpoint; key the retained copy by identity so repeats reuse it.
        retained_key = str(record.get("delivery_identity") or "").strip() or delivery_id
        source_path = Path(audio_path).resolve()
        source_sha256 = hashlib.sha256(source_path.read_bytes()).hexdigest()
        retained_audio_path = (
            Path(cache_root).resolve()
            / "audio_delivery"
            / lane
            / hashlib.sha1(retained_key.encode("utf-8")).hexdigest()
            / f"{source_sha256}.mp3"
        )
        retained_audio_path.parent.mkdir(parents=True, exist_ok=True)
        if retained_audio_path.is_file():
            retained_sha256 = hashlib.sha256(
                retained_audio_path.read_bytes()
            ).hexdigest()
            if retained_sha256 != source_sha256:
                raise ValueError("retained audio digest conflicts with the staged step")
        else:
            shutil.copy2(str(source_path), str(retained_audio_path))
        staged_record = copy.deepcopy(record)
        staged_record.update({
            "delivery_id": delivery_id,
            "audio_path": str(retained_audio_path),
            "audio_sha256": source_sha256,
        })
        return self.put(staged_record)

    def _record_store(self) -> Any:
        if self._records_store is None:
            self._records_store = open_record_store(self._store.path.with_suffix(".sqlite3"))
        if not self._records_store.migration_complete():
            section = self._store.get_section(AUDIO_DELIVERY_OUTBOX_SECTION) or {}
            records = section.get("records") or {}
            legacy = {} if section.get("legacy_migrated") else user_data_store.get_section(AUDIO_DELIVERY_OUTBOX_SECTION).get("records") or {}
            combined = {
                **(legacy if isinstance(legacy, dict) else {}),
                **(records if isinstance(records, dict) else {}),
            }
            self._records_store.import_once({
                str(row["delivery_id"]): dict(row) for row in combined.values()
                if isinstance(row, dict) and row.get("delivery_id")
            })
        return self._records_store

    def _load_records(self) -> Dict[str, Dict[str, Any]]:
        return self._record_store().records()

    def _save_record(self, row: Dict[str, Any]) -> None:
        self._record_store().put(str(row["delivery_id"]), row)

    def _identity_siblings(self, row: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Other live records (and retained domain receipts) that deliver the
        same bytes to the same domain endpoint as ``row``."""
        identity = str(row.get("delivery_identity") or "").strip()
        if not identity:
            return []
        lane = str(row.get("lane") or "")
        sha256 = str(row.get("audio_sha256") or "")
        self_id = str(row.get("delivery_id") or "")
        return [
            sibling
            for sibling in self._load_records().values()
            if str(sibling.get("delivery_id") or "") != self_id
            and str(sibling.get("lane") or "") == lane
            and str(sibling.get("delivery_identity") or "").strip() == identity
            and (not sha256 or str(sibling.get("audio_sha256") or "") == sha256)
            and str(sibling.get("status") or "pending") != "dead_letter"
        ]

    @staticmethod
    def _inherit_domain_state(row: Dict[str, Any], siblings: List[Dict[str, Any]]) -> None:
        """A sibling (or retained receipt) whose domain delivery already finished
        makes ``row`` skip its own byte transfer - durable dedup held in the
        store itself, not in any time-window cache."""
        if bool(row.get("domain_delivery_finished", row.get("domain_uploaded"))):
            return
        for sibling in siblings:
            if bool(sibling.get("domain_delivery_finished", sibling.get("domain_uploaded"))):
                row["domain_delivery_finished"] = True
                row["domain_uploaded"] = bool(sibling.get("domain_uploaded"))
                row["domain_upload_error"] = str(sibling.get("domain_upload_error") or "")
                return

    def _retain_domain_receipt(self, row: Dict[str, Any]) -> None:
        """Keep a durable per-identity receipt after the task record completes
        so later attempts of the same audio never re-upload the bytes."""
        identity = str(row.get("delivery_identity") or "").strip()
        if not identity or not bool(row.get("domain_delivery_finished", row.get("domain_uploaded"))):
            return
        receipt_id = (
            DOMAIN_RECEIPT_PREFIX
            + str(row.get("lane") or "")
            + ":"
            + hashlib.sha1(identity.encode("utf-8")).hexdigest()
        )
        self._save_record({
            "delivery_id": receipt_id,
            "lane": row.get("lane"),
            "delivery_identity": identity,
            "audio_sha256": row.get("audio_sha256"),
            "status": "completed",
            "tombstone": True,
            "domain_uploaded": bool(row.get("domain_uploaded")),
            "domain_delivery_finished": True,
            "domain_upload_error": str(row.get("domain_upload_error") or ""),
            "retry_at": 0.0,
            "lease_owner": "",
            "lease_process": "",
            "lease_until": 0.0,
            "created_at": float(row.get("created_at") or _now()),
            "updated_at": _now(),
        })

    @serialized_method
    @_record_transaction
    def put(self, record: Dict[str, Any]) -> Dict[str, Any]:
        delivery_id = str(record.get("delivery_id") or "").strip()
        if not delivery_id:
            raise ValueError("audio delivery requires delivery_id")
        current = self._record_store().get(delivery_id) or {}
        current_sha256 = str(current.get("audio_sha256") or "")
        proposed_sha256 = str(record.get("audio_sha256") or "")
        if current_sha256 and proposed_sha256 and current_sha256 != proposed_sha256:
            raise ValueError("audio delivery digest conflicts with the idempotent step")
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
        self._inherit_domain_state(row, self._identity_siblings(row))
        row["updated_at"] = _now()
        self._save_record(row)
        return copy.deepcopy(row)

    @serialized_method
    @_record_transaction
    def claim(
        self,
        delivery_id: str,
        owner: str,
        process_id: str = AUDIO_DELIVERY_PROCESS_ID,
        lease_seconds: float = DEFAULT_LEASE_SECONDS,
    ) -> Optional[Dict[str, Any]]:
        row = self._record_store().get(str(delivery_id))
        now = _now()
        if not row or str(row.get("status") or "pending") == "dead_letter":
            return None
        if not _delivery_available(row, now):
            return None
        siblings = self._identity_siblings(row)
        for sibling in siblings:
            if not _delivery_available(sibling, now):
                # A sibling is already transferring the same bytes; defer so
                # only ONE upload per domain identity is ever in flight.
                row["retry_at"] = now + SIBLING_IN_FLIGHT_DEFER_SECONDS
                row["updated_at"] = now
                self._save_record(row)
                return None
        self._inherit_domain_state(row, siblings)
        row["lease_owner"] = str(owner)
        row["lease_process"] = str(process_id)
        row["lease_until"] = now + max(1.0, float(lease_seconds))
        row["updated_at"] = now
        self._save_record(row)
        return copy.deepcopy(row)

    @serialized_method
    @_record_transaction
    def renew(self, delivery_id: str, owner: str, progress: Dict[str, Any]) -> None:
        row = self._record_store().get(str(delivery_id))
        now = _now()
        if row is None or str(row.get("lease_owner") or "") != owner:
            raise RuntimeError("Audio delivery ownership changed during upload")
        if float(row.get("lease_until") or 0) - now > DEFAULT_LEASE_SECONDS / 2:
            return
        row["lease_until"] = now + DEFAULT_LEASE_SECONDS
        row["updated_at"] = now
        self._save_record(row)

    @serialized_method
    @_record_transaction
    def patch(
        self,
        delivery_id: str,
        patch: Dict[str, Any],
        owner: str = "",
    ) -> Optional[Dict[str, Any]]:
        row = self._record_store().get(str(delivery_id))
        if not row:
            if owner:
                raise RuntimeError("Audio delivery record disappeared during delivery")
            return None
        if owner and str(row.get("lease_owner") or "") != str(owner):
            raise RuntimeError("Audio delivery ownership changed during delivery")
        row.update(copy.deepcopy(patch))
        self._inherit_domain_state(row, self._identity_siblings(row))
        row["updated_at"] = _now()
        self._save_record(row)
        return copy.deepcopy(row)

    @serialized_method
    @_record_transaction
    def release(
        self,
        delivery_id: str,
        owner: str,
        *,
        error: str = "",
        retry_at: float = 0.0,
    ) -> Optional[Dict[str, Any]]:
        row = self._record_store().get(str(delivery_id))
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
        self._save_record(row)
        return copy.deepcopy(row)

    @serialized_method
    def pending_counts(self, lane: str, field: str) -> Dict[str, int]:
        records = self._load_records()
        counts = {}
        for row in records.values():
            key = str(row.get(field) or "")
            if row.get("lane") == lane and key and not row.get("tombstone"):
                counts[key] = counts.get(key, 0) + 1
        return counts

    @serialized_method
    @_record_transaction
    def complete(self, delivery_id: str, owner: str = "") -> bool:
        row = self._record_store().get(str(delivery_id))
        if not row:
            return False
        if owner and str(row.get("lease_owner") or "") != str(owner):
            return False
        self._retain_domain_receipt(row)
        self._record_store().delete(str(delivery_id))
        return True

    @serialized_method
    @_record_transaction
    def mark_dead_letter(self, delivery_id: str, owner: str, error: str) -> bool:
        row = self._record_store().get(str(delivery_id))
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
        self._save_record(row)
        return True

    @serialized_method
    def list_ready(self, lane: str, limit: int = 100) -> List[Dict[str, Any]]:
        now = _now()
        rows = [
            row
            for row in self._load_records().values()
            if str(row.get("lane") or "") == str(lane)
            and not row.get("tombstone")
            and str(row.get("status") or "pending") != "dead_letter"
            and float(row.get("retry_at") or 0) <= now
            and _delivery_available(row, now)
        ]
        rows.sort(key=lambda row: float(row.get("created_at") or 0))
        return [copy.deepcopy(row) for row in rows[:max(1, int(limit))]]

    @serialized_method
    @_record_transaction
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
            self._save_record(row)
            changed += 1
        return changed

    @serialized_method
    @_record_transaction
    def hurry_pending(self, lane: str) -> int:
        """Reset the retry backoff of every waiting row of the lane so a
        reconnect flush delivers offline-generated audio immediately instead
        of waiting out the exponential delay."""
        now = _now()
        changed = 0
        for row in self._load_records().values():
            if str(row.get("lane") or "") != str(lane) or row.get("tombstone"):
                continue
            if str(row.get("status") or "pending") == "dead_letter":
                continue
            if float(row.get("retry_at") or 0) <= now:
                continue
            row["retry_at"] = 0.0
            row["updated_at"] = now
            self._save_record(row)
            changed += 1
        return changed

    @serialized_method
    def stats(self, lane: str) -> Dict[str, Any]:
        rows = [
            row
            for row in self._load_records().values()
            if str(row.get("lane") or "") == str(lane)
            and not row.get("tombstone")
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
            or (
                normalized.startswith("http 4")
                and not normalized.startswith(("http 408", "http 409", "http 425", "http 429"))
            )
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
        try:
            with audio_delivery_outbox.delivery_scope(delivery_id, owner):
                return self._deliver(handler, record, owner, initial_retry_seconds, maximum_retry_seconds)
        except Exception as error:
            retry_delay = audio_delivery_outbox.retry_delay(
                int(record.get("delivery_attempts") or 0) + 1,
                initial_retry_seconds,
                maximum_retry_seconds,
            )
            audio_delivery_outbox.release(
                delivery_id, owner, error=str(error), retry_at=time.time() + retry_delay,
            )
            raise

    def _deliver(
        self, handler: Any, record: Dict[str, Any], owner: str,
        initial_retry_seconds: float, maximum_retry_seconds: float,
    ) -> Dict[str, Any]:
        delivery_id = str(record.get("delivery_id") or "")
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
        if (
            not result_accepted
            and domain_delivery_finished
            and str(info.get("_local_source") or "")
        ):
            # Locally sourced tasks (word-audio full pull) have no global_tasks
            # row to close: the domain report above IS the whole delivery, so
            # the global result step is skipped once the domain upload reached
            # a terminal state (accepted OR terminally rejected).
            result_accepted = True
            audio_delivery_outbox.patch(
                delivery_id,
                {"result_accepted": True, "last_error": ""},
                owner=owner,
            )
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
        if not audio_delivery_outbox.complete(delivery_id, owner):
            raise RuntimeError("Audio delivery ownership changed before completion")
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
