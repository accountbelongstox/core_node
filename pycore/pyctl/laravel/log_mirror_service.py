# -*- coding: utf-8 -*-
from __future__ import annotations

import time
from typing import Any, Dict, Optional

from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.laravel.remote_cursor_store import (
    RemoteCursor,
    RemoteCursorStore,
    remote_cursor_store,
)
from pycore.pyutils.rpc_v2.delivery import rpc_delivery_service

class LaravelLogMirrorService:
    """
    Service to poll Laravel logs and mirror them locally.
    Uses a file-backed remote cursor to track the last fetched position.
    """

    def __init__(self, repo: Optional[RemoteCursorStore] = None) -> None:
        self.repo = repo or remote_cursor_store
        init_serialized_owner(self, "laravel.log_mirror.state", "LaravelLogMirror")
        self._is_polling = False

    @serialized_method
    def poll_once(self) -> None:
        """Poll the Laravel log endpoint for new entries."""
        if self._is_polling:
            return
        self._is_polling = True
        try:
            self._do_poll()
        finally:
            self._is_polling = False

    def _do_poll(self) -> None:
        base_url = laravel_endpoint_manager.resolve().rstrip("/")
        if not base_url:
            return

        source_id = base_url
        cursor_obj = self.repo.get_remote_cursor("laravel_logs", source_id)
        
        if not cursor_obj:
            cursor_obj = RemoteCursor(
                source_type="laravel_logs",
                source_id=source_id,
                cursor_json={},
                snapshot_json={"entries": [], "stale": False},
                revision=0,
                timestamps={"last_success_at": 0, "last_attempt_at": 0},
                error_json=None,
            )

        cursor_obj.timestamps["last_attempt_at"] = time.time()

        # Prepare query params
        params = {"limit": 200, "max_bytes": 262144}
        if cursor_obj.cursor_json and "file_id" in cursor_obj.cursor_json:
            params["file_id"] = cursor_obj.cursor_json["file_id"]
            if "offset" in cursor_obj.cursor_json:
                params["offset"] = cursor_obj.cursor_json["offset"]

        try:
            # The internal route is /api/internal/pycore/logs/latest
            url = f"{base_url}/api/internal/pycore/logs/latest"
            
            resp = laravel_client.get(url, params=params, timeout=10)
            
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    # Update cursor
                    if "next_cursor" in data:
                        cursor_obj.cursor_json = data["next_cursor"]
                    
                    # Merge entries (keep last 500)
                    existing_entries = cursor_obj.snapshot_json.get("entries", [])
                    new_entries = data.get("entries", [])
                    
                    if new_entries:
                        # Append new entries and truncate
                        all_entries = existing_entries + new_entries
                        # Keep only the last 500 entries
                        if len(all_entries) > 500:
                            all_entries = all_entries[-500:]
                        
                        cursor_obj.snapshot_json["entries"] = all_entries
                        cursor_obj.snapshot_json["source_updated_at"] = data.get("source_updated_at")
                        cursor_obj.revision += 1
                        self._publish_snapshot_updated(source_id, cursor_obj.revision)

                    cursor_obj.snapshot_json["stale"] = False
                    cursor_obj.timestamps["last_success_at"] = time.time()
                    cursor_obj.error_json = None
                else:
                    cursor_obj.snapshot_json["stale"] = True
                    cursor_obj.error_json = {"error": data.get("error", "Unknown API error")}
            else:
                cursor_obj.snapshot_json["stale"] = True
                cursor_obj.error_json = {"error": f"HTTP {resp.status_code}", "body": resp.text[:200]}
                
        except Exception as e:
            cursor_obj.snapshot_json["stale"] = True
            cursor_obj.error_json = {"error": str(e), "type": type(e).__name__}
            
        finally:
            self.repo.save_remote_cursor(cursor_obj)

    def _publish_snapshot_updated(self, source_id: str, revision: int) -> None:
        payload = {
            "source_id": source_id,
            "revision": revision,
            "topic": BusSignals.LARAVEL_LOGS_SNAPSHOT_UPDATED,
        }
        THREAD_BUS.trigger_event(BusSignals.LARAVEL_LOGS_CHANGED, payload)
        rpc_delivery_service.publish_topic(
            BusSignals.LARAVEL_LOGS_SNAPSHOT_UPDATED,
            payload,
            audience="*",
            entity_type="laravel_logs",
            entity_id=source_id,
            revision=revision,
        )

    @serialized_method
    def refresh(self) -> Dict[str, Any]:
        """Refresh the bounded Laravel log snapshot."""
        self._do_poll()
        base_url = laravel_endpoint_manager.resolve().rstrip("/")
        if not base_url:
            return {"success": False, "error": "No active Laravel endpoint"}
        cursor_obj = self.repo.get_remote_cursor("laravel_logs", base_url)
        if cursor_obj is None:
            return {"success": False, "error": "Laravel log snapshot unavailable"}
        return {
            "success": cursor_obj.error_json is None,
            "revision": cursor_obj.revision,
            "error": cursor_obj.error_json,
        }

    @serialized_method
    def get_snapshot(self) -> Dict[str, Any]:
        """Get the current log snapshot for the active endpoint."""
        base_url = laravel_endpoint_manager.resolve().rstrip("/")
        if not base_url:
            return {"success": False, "error": "No active Laravel endpoint"}

        cursor_obj = self.repo.get_remote_cursor("laravel_logs", base_url)
        if not cursor_obj:
            return {
                "success": True,
                "data": {
                    "source_id": base_url,
                    "entries": [],
                    "stale": False,
                    "revision": 0,
                    "timestamps": {},
                }
            }

        return {
            "success": True,
            "data": {
                "source_id": base_url,
                "entries": cursor_obj.snapshot_json.get("entries", []),
                "stale": cursor_obj.snapshot_json.get("stale", False),
                "source_updated_at": cursor_obj.snapshot_json.get("source_updated_at"),
                "revision": cursor_obj.revision,
                "timestamps": cursor_obj.timestamps,
                "error": cursor_obj.error_json,
            }
        }

    def get_status(self) -> Dict[str, Any]:
        snapshot = self.get_snapshot()
        data = snapshot.get("data", {})
        return {
            "success": True,
            "data": {
                "source_id": data.get("source_id"),
                "stale": data.get("stale", False),
                "revision": data.get("revision", 0),
                "source_updated_at": data.get("source_updated_at"),
                "timestamps": data.get("timestamps", {}),
                "error": data.get("error"),
                "entry_count": len(data.get("entries", [])),
            },
        }

    def get_records(self, params: Dict[str, Any]) -> Dict[str, Any]:
        offset = max(0, int(params.get("offset", 0)))
        limit = max(1, min(int(params.get("limit", 100)), 500))
        level_filter = str(params.get("level") or "").lower()
        search_filter = str(params.get("search") or "").lower()
        category_filter = str(params.get("category") or "").lower()
        start_time = str(params.get("start_time") or "")
        end_time = str(params.get("end_time") or "")
        snapshot = self.get_snapshot()
        entries = snapshot.get("data", {}).get("entries", [])
        if level_filter:
            entries = [
                entry
                for entry in entries
                if str(entry.get("level") or "").lower() == level_filter
            ]
        if search_filter:
            entries = [
                entry
                for entry in entries
                if search_filter in str(entry.get("message") or "").lower()
            ]
        if category_filter:
            entries = [
                entry
                for entry in entries
                if str(entry.get("category") or "").lower() == category_filter
            ]
        if start_time:
            entries = [
                entry
                for entry in entries
                if str(entry.get("timestamp") or "") >= start_time
            ]
        if end_time:
            entries = [
                entry
                for entry in entries
                if str(entry.get("timestamp") or "") <= end_time
            ]
        return {
            "success": True,
            "data": {
                "records": entries[offset:offset + limit],
                "total": len(entries),
                "offset": offset,
                "limit": limit,
            },
        }

    @serialized_method
    def clear_logs(self) -> Dict[str, Any]:
        base_url = laravel_endpoint_manager.resolve().rstrip("/")
        if not base_url:
            return {"success": False, "error": "No active Laravel endpoint"}
        cursor = self.repo.get_remote_cursor("laravel_logs", base_url)
        if cursor is None:
            return {"success": True, "data": {"cleared": 0}}
        entries = cursor.snapshot_json.get("entries", [])
        cursor.snapshot_json["entries"] = []
        cursor.revision += 1
        self.repo.save_remote_cursor(cursor)
        self._publish_snapshot_updated(base_url, cursor.revision)
        return {"success": True, "data": {"cleared": len(entries)}}

    @staticmethod
    def cancel() -> Dict[str, Any]:
        return {
            "success": True,
            "data": {
                "status": "cancelled",
                "note": "No active poll to cancel",
            },
        }


laravel_log_mirror_service = LaravelLogMirrorService()
