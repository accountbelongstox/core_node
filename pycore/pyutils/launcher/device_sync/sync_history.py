# -*- coding: utf-8 -*-
"""Bounded file-backed synchronization event history."""

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyutils.common.user_data_store import UserDataStore
from pycore.pyutils.launcher.device_sync.core.config import get_cache_dir
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
DEFAULT_CACHE_DIR = get_cache_dir()
STORE_FILE_NAME = "sync_events.json"
STORE_SECTION = "device_sync_events"
MAX_HISTORY_ENTRIES = 1000

EVENT_FILE_SYNC = "file_sync"
EVENT_MODE_CHANGE = "mode_change"
EVENT_DEVICE_ONLINE = "device_online"
EVENT_DEVICE_OFFLINE = "device_offline"
EVENT_SYNC_ENABLE = "sync_enable"
EVENT_SYNC_DISABLE = "sync_disable"
EVENT_CONFLICT_DETECTED = "conflict_detected"
EVENT_PRIMARY_VALIDATION = "primary_validation"

STATUS_SUCCESS = "success"
STATUS_FAILED = "failed"
STATUS_WARNING = "warning"


class SyncHistoryTracker:
    """Record a small synchronization history in an atomic JSON file."""

    def __init__(self, cache_dir: Optional[Path] = None, retention_days: int = 3):
        self.cache_dir = cache_dir or DEFAULT_CACHE_DIR
        self.retention_days = max(1, int(retention_days))
        self.store_path = self.cache_dir / STORE_FILE_NAME
        self.db_path = self.store_path
        self._store = UserDataStore(
            base_dir=self.cache_dir,
            file_name=STORE_FILE_NAME,
            defaults_dir=self.cache_dir / "defaults",
        )
        init_serialized_owner(self, "device_sync.history", "DeviceSyncHistory")
        self.cleanup_old_records()
        ColorPrint.info(f"Sync history tracker initialized: {self.store_path}")
        ColorPrint.info(f"Retention period: {self.retention_days} days")

    def _read(self) -> Dict[str, Any]:
        data = self._store.get_section(STORE_SECTION)
        return {
            "next_id": int(data.get("next_id") or 1),
            "entries": [
                dict(entry)
                for entry in data.get("entries") or []
                if isinstance(entry, dict)
            ],
        }

    def _retained_entries(self, entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        cutoff = (datetime.now() - timedelta(days=self.retention_days)).timestamp()
        retained = [
            entry
            for entry in entries
            if float(entry.get("timestamp_value") or 0.0) >= cutoff
        ]
        return retained[-MAX_HISTORY_ENTRIES:]

    def _write(self, data: Dict[str, Any]) -> None:
        data["entries"] = self._retained_entries(data["entries"])
        self._store.set_section(STORE_SECTION, data)

    @serialized_method
    def record_event(
        self,
        event_type: str,
        status: str,
        message: str,
        device_id: Optional[str] = None,
        device_name: Optional[str] = None,
        details: Optional[Dict] = None,
    ) -> None:
        """Record one synchronization event."""
        data = self._read()
        timestamp = datetime.now()
        entry_id = data["next_id"]
        data["next_id"] = entry_id + 1
        data["entries"].append({
            "id": entry_id,
            "timestamp": timestamp.isoformat(sep=" ", timespec="seconds"),
            "timestamp_value": timestamp.timestamp(),
            "event_type": event_type,
            "device_id": device_id,
            "device_name": device_name,
            "status": status,
            "message": message,
            "details": dict(details) if details else None,
            "created_at": timestamp.isoformat(sep=" ", timespec="seconds"),
        })
        self._write(data)
        ColorPrint.debug(f"Recorded event: {event_type} - {message}")

    @serialized_method
    def get_recent_history(
        self,
        limit: int = 100,
        event_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Return filtered history in newest-first order."""
        limit_value = max(0, int(limit))
        if limit_value == 0:
            return []
        entries = self._retained_entries(self._read()["entries"])
        if event_type:
            entries = [
                entry for entry in entries if entry.get("event_type") == event_type
            ]
        if status:
            entries = [entry for entry in entries if entry.get("status") == status]
        result = []
        for entry in reversed(entries[-limit_value:]):
            item = dict(entry)
            item.pop("timestamp_value", None)
            result.append(item)
        return result

    @serialized_method
    def get_statistics(self) -> Dict[str, Any]:
        """Return statistics derived from retained events."""
        entries = self._retained_entries(self._read()["entries"])
        events_by_type: Dict[str, int] = {}
        events_by_status: Dict[str, int] = {}
        cutoff_24h = (datetime.now() - timedelta(days=1)).timestamp()
        last_24h = 0
        for entry in entries:
            event_type = str(entry.get("event_type") or "")
            status = str(entry.get("status") or "")
            events_by_type[event_type] = events_by_type.get(event_type, 0) + 1
            events_by_status[status] = events_by_status.get(status, 0) + 1
            if float(entry.get("timestamp_value") or 0.0) >= cutoff_24h:
                last_24h += 1
        latest_event = None
        if entries:
            latest = entries[-1]
            latest_event = {
                "timestamp": latest.get("timestamp"),
                "event_type": latest.get("event_type"),
                "message": latest.get("message"),
            }
        return {
            "total_events": len(entries),
            "events_by_type": events_by_type,
            "events_by_status": events_by_status,
            "last_24h": last_24h,
            "latest_event": latest_event,
            "retention_days": self.retention_days,
            "db_path": str(self.db_path),
            "store_path": str(self.store_path),
        }

    @serialized_method
    def cleanup_old_records(self) -> None:
        """Remove events outside the configured retention window."""
        data = self._read()
        original_count = len(data["entries"])
        data["entries"] = self._retained_entries(data["entries"])
        removed_count = original_count - len(data["entries"])
        if removed_count > 0:
            self._write(data)
            ColorPrint.info(f"Cleaned up {removed_count} old sync records")

    def export_to_text(self, output_path: Optional[Path] = None) -> str:
        """Export retained history to a text file."""
        if not output_path:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = self.cache_dir / f"sync_history_{timestamp}.txt"

        history = self.get_recent_history(limit=MAX_HISTORY_ENTRIES)
        with output_path.open("w", encoding="utf-8") as file_handle:
            file_handle.write("=" * 80 + "\n")
            file_handle.write("Device Sync - History Export\n")
            file_handle.write(
                f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
            )
            file_handle.write("=" * 80 + "\n\n")
            for entry in history:
                file_handle.write(
                    f"[{entry['timestamp']}] {entry['event_type'].upper()}\n"
                )
                file_handle.write(f"  Status: {entry['status']}\n")
                file_handle.write(f"  Message: {entry['message']}\n")
                if entry.get("device_name"):
                    file_handle.write(f"  Device: {entry['device_name']}\n")
                if entry.get("details"):
                    details = json.dumps(entry["details"], indent=2)
                    file_handle.write(f"  Details: {details}\n")
                file_handle.write("\n")

        ColorPrint.info(f"Exported history to: {output_path}")
        return str(output_path)

    def close(self) -> None:
        """Apply final retention cleanup."""
        self.cleanup_old_records()
        ColorPrint.info("Sync history tracker closed")


def record_file_sync(
    tracker: SyncHistoryTracker,
    filename: str,
    success: bool,
    file_size: int = 0,
) -> None:
    """Record a file synchronization event."""
    tracker.record_event(
        event_type=EVENT_FILE_SYNC,
        status=STATUS_SUCCESS if success else STATUS_FAILED,
        message=f"{'Synced' if success else 'Failed to sync'}: {filename}",
        details={"filename": filename, "size": file_size},
    )


def record_mode_change(
    tracker: SyncHistoryTracker,
    old_mode: str,
    new_mode: str,
) -> None:
    """Record a synchronization mode change."""
    tracker.record_event(
        event_type=EVENT_MODE_CHANGE,
        status=STATUS_SUCCESS,
        message=f"Mode changed: {old_mode or 'NOT SET'} -> {new_mode}",
        details={"old_mode": old_mode, "new_mode": new_mode},
    )


def record_device_online(tracker: SyncHistoryTracker, device_info: Dict) -> None:
    """Record an online device event."""
    tracker.record_event(
        event_type=EVENT_DEVICE_ONLINE,
        status=STATUS_SUCCESS,
        message="Device came online",
        device_id=device_info.get("device_id"),
        device_name=device_info.get("hostname"),
        details={"ip": device_info.get("ip"), "mode": device_info.get("mode")},
    )


def record_device_offline(tracker: SyncHistoryTracker, device_info: Dict) -> None:
    """Record an offline device event."""
    tracker.record_event(
        event_type=EVENT_DEVICE_OFFLINE,
        status=STATUS_WARNING,
        message="Device went offline",
        device_id=device_info.get("device_id"),
        device_name=device_info.get("hostname"),
    )


def record_sync_enabled(tracker: SyncHistoryTracker, mode: str) -> None:
    """Record that synchronization was enabled."""
    tracker.record_event(
        event_type=EVENT_SYNC_ENABLE,
        status=STATUS_SUCCESS,
        message=f"Sync enabled (mode: {mode})",
        details={"mode": mode},
    )


def record_sync_disabled(
    tracker: SyncHistoryTracker,
    reason: str = "User request",
) -> None:
    """Record that synchronization was disabled."""
    tracker.record_event(
        event_type=EVENT_SYNC_DISABLE,
        status=STATUS_SUCCESS,
        message=f"Sync disabled: {reason}",
        details={"reason": reason},
    )


def record_conflict(tracker: SyncHistoryTracker, conflict_info: Dict) -> None:
    """Record a synchronization conflict."""
    count = conflict_info.get("count", 0)
    tracker.record_event(
        event_type=EVENT_CONFLICT_DETECTED,
        status=STATUS_FAILED,
        message=f"Conflict detected: {count} primary devices",
        details=conflict_info,
    )


def record_primary_validation(
    tracker: SyncHistoryTracker,
    success: bool,
    primary_count: int,
) -> None:
    """Record a primary-device validation result."""
    tracker.record_event(
        event_type=EVENT_PRIMARY_VALIDATION,
        status=STATUS_SUCCESS if success else STATUS_FAILED,
        message=f"Primary validation: {primary_count} primary device(s) found",
        details={"primary_count": primary_count, "valid": success},
    )
