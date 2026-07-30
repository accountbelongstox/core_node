# -*- coding: utf-8 -*-
"""Bounded file-backed records for device synchronization activity."""

import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.serialized_worker import (
    SerializedSingletonProvider,
    init_serialized_owner,
    serialized_method,
)
from pycore.pyutils.common.user_data_store import UserDataStore
from pycore.pyutils.launcher.device_sync.core.config import get_cache_dir


STORE_FILE_NAME = "sync_records.json"
STORE_SECTION = "device_sync_records"
MAX_SESSIONS = 200
MAX_TRANSFERS = 1000
MAX_SCANS = 200
MAX_CONNECTIONS = 500


def _format_timestamp(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")


def _recent_items(items: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
    limit_value = max(0, int(limit))
    if limit_value == 0:
        return []
    return items[-limit_value:]


class SyncRecordStore:
    """Keep small, bounded synchronization records in an atomic JSON file."""

    def __init__(self):
        cache_dir = get_cache_dir()
        self.store_path = cache_dir / STORE_FILE_NAME
        self._store = UserDataStore(
            base_dir=cache_dir,
            file_name=STORE_FILE_NAME,
            defaults_dir=cache_dir / "defaults",
        )
        init_serialized_owner(
            self,
            "device_sync.database.state",
            "DeviceSyncDatabaseStateThread",
            timeout=300.0,
        )

    def _read(self) -> Dict[str, Any]:
        data = self._store.get_section(STORE_SECTION)
        return {
            "next_session_id": int(data.get("next_session_id") or 1),
            "sessions": list(data.get("sessions") or []),
            "transfers": list(data.get("transfers") or []),
            "scans": list(data.get("scans") or []),
            "connections": list(data.get("connections") or []),
            "stats": dict(data.get("stats") or {}),
        }

    def _write(self, data: Dict[str, Any]) -> None:
        data["sessions"] = data["sessions"][-MAX_SESSIONS:]
        data["transfers"] = data["transfers"][-MAX_TRANSFERS:]
        data["scans"] = data["scans"][-MAX_SCANS:]
        data["connections"] = data["connections"][-MAX_CONNECTIONS:]
        self._store.set_section(STORE_SECTION, data)

    @serialized_method
    def create_session(self, session_type: str, device_id: str) -> int:
        """Create a synchronization session and return its stable ID."""
        data = self._read()
        session_id = data["next_session_id"]
        data["next_session_id"] = session_id + 1
        data["sessions"].append({
            "id": session_id,
            "session_type": session_type,
            "start_time": time.time(),
            "end_time": None,
            "device_id": device_id,
            "status": "active",
            "files_scanned": 0,
            "files_transferred": 0,
            "bytes_transferred": 0,
            "error_message": None,
        })
        self._write(data)
        return session_id

    @serialized_method
    def update_session(
        self,
        session_id: int,
        status: str,
        files_scanned: Optional[int] = None,
        files_transferred: Optional[int] = None,
        bytes_transferred: Optional[int] = None,
        error_message: Optional[str] = None,
    ) -> None:
        """Update one retained synchronization session."""
        data = self._read()
        for session in data["sessions"]:
            if session.get("id") != session_id:
                continue
            session["status"] = status
            session["end_time"] = time.time()
            if files_scanned is not None:
                session["files_scanned"] = files_scanned
            if files_transferred is not None:
                session["files_transferred"] = files_transferred
            if bytes_transferred is not None:
                session["bytes_transferred"] = bytes_transferred
            if error_message is not None:
                session["error_message"] = error_message
            break
        self._write(data)

    @serialized_method
    def record_transfer(
        self,
        session_id: Optional[int],
        operation: str,
        file_path: str,
        file_size: int,
        status: str,
        remote_device: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> None:
        """Record one bounded file-transfer result."""
        data = self._read()
        data["transfers"].append({
            "session_id": session_id,
            "timestamp": time.time(),
            "operation": operation,
            "file_path": file_path,
            "file_size": file_size,
            "status": status,
            "remote_device": remote_device,
            "error_message": error_message,
        })
        stats = data["stats"]
        stats["total_transfers"] = int(stats.get("total_transfers") or 0) + 1
        self._write(data)

    @serialized_method
    def record_scan(
        self,
        scan_type: str,
        files_found: int,
        duration_seconds: float,
        scan_node_modules: bool,
    ) -> None:
        """Record one bounded file scan."""
        data = self._read()
        data["scans"].append({
            "timestamp": time.time(),
            "scan_type": scan_type,
            "files_found": files_found,
            "duration_seconds": duration_seconds,
            "scan_node_modules": bool(scan_node_modules),
        })
        stats = data["stats"]
        stats["total_scans"] = int(stats.get("total_scans") or 0) + 1
        self._write(data)

    @serialized_method
    def record_connection(
        self,
        connection_type: str,
        remote_ip: str,
        remote_device_id: Optional[str] = None,
        remote_hostname: Optional[str] = None,
        request_path: Optional[str] = None,
    ) -> None:
        """Record one bounded client connection event."""
        data = self._read()
        data["connections"].append({
            "timestamp": time.time(),
            "connection_type": connection_type,
            "remote_ip": remote_ip,
            "remote_device_id": remote_device_id,
            "remote_hostname": remote_hostname,
            "request_path": request_path,
        })
        stats = data["stats"]
        stats["total_connections"] = int(stats.get("total_connections") or 0) + 1
        self._write(data)

    @serialized_method
    def get_recent_transfers(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Return recent transfers in newest-first order."""
        transfers = _recent_items(self._read()["transfers"], limit)
        return [
            {
                "timestamp": _format_timestamp(float(item["timestamp"])),
                "operation": item.get("operation"),
                "file_path": item.get("file_path"),
                "file_size": item.get("file_size"),
                "status": item.get("status"),
                "remote_device": item.get("remote_device"),
            }
            for item in reversed(transfers)
        ]

    @serialized_method
    def get_recent_scans(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Return recent scans in newest-first order."""
        scans = _recent_items(self._read()["scans"], limit)
        return [
            {
                "timestamp": _format_timestamp(float(item["timestamp"])),
                "scan_type": item.get("scan_type"),
                "files_found": item.get("files_found"),
                "duration_seconds": item.get("duration_seconds"),
                "scan_node_modules": bool(item.get("scan_node_modules")),
            }
            for item in reversed(scans)
        ]

    @serialized_method
    def get_recent_connections(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Return recent connections in newest-first order."""
        connections = _recent_items(self._read()["connections"], limit)
        return [
            {
                "timestamp": _format_timestamp(float(item["timestamp"])),
                "connection_type": item.get("connection_type"),
                "remote_ip": item.get("remote_ip"),
                "remote_device_id": item.get("remote_device_id"),
                "remote_hostname": item.get("remote_hostname"),
                "request_path": item.get("request_path"),
            }
            for item in reversed(connections)
        ]

    @serialized_method
    def get_stats(self) -> Dict[str, Any]:
        """Return cumulative counts and retained 24-hour transfer statuses."""
        data = self._read()
        stats = data["stats"]
        threshold = time.time() - 86400
        recent_transfers: Dict[str, int] = {}
        for item in data["transfers"]:
            if float(item.get("timestamp") or 0.0) <= threshold:
                continue
            status = str(item.get("status") or "")
            recent_transfers[status] = recent_transfers.get(status, 0) + 1
        return {
            "total_transfers": int(stats.get("total_transfers") or 0),
            "total_scans": int(stats.get("total_scans") or 0),
            "total_connections": int(stats.get("total_connections") or 0),
            "recent_transfers_24h": recent_transfers,
        }


_SYNC_DATABASE_PROVIDER = SerializedSingletonProvider(
    SyncRecordStore,
    "device_sync.database.provider",
    "DeviceSyncDatabaseProviderThread",
    timeout=300.0,
)


SyncDatabase = SyncRecordStore


def get_sync_record_store() -> SyncRecordStore:
    """Get the shared device synchronization record store."""
    return _SYNC_DATABASE_PROVIDER.get()


def get_sync_database() -> SyncRecordStore:
    """Return the record store through the legacy accessor name."""
    return get_sync_record_store()
