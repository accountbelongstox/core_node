# -*- coding: utf-8 -*-
from __future__ import annotations

import time
import json
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.database.repositories.state_repository import StateRepository
from pycore.database.models.state_models import RemoteCursor
from pycore.callmodule.services.sync.laravel_client import get_laravel_client
from pycore.callmodule.services.sync.laravel_endpoint_manager import resolve_laravel_base_url
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.callmodule.services.operation_service import OperationService
from pycore.pyutils.rpc_v2.server.rpc_delivery_service import get_rpc_delivery_service

class LaravelLogMirrorService:
    """
    Service to poll Laravel logs and mirror them locally.
    Uses the RemoteCursor table to track the last fetched position.
    """

    def __init__(self, repo: Optional[StateRepository] = None) -> None:
        self.repo = repo or StateRepository()
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
        base_url = resolve_laravel_base_url().rstrip("/")
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
            client = get_laravel_client()
            # The internal route is /api/internal/pycore/logs/latest
            url = f"{base_url}/api/internal/pycore/logs/latest"
            
            resp = client.get(url, params=params, timeout=10)
            
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
        payload = {"source_id": source_id, "revision": revision, "topic": "laravel.logs.snapshot.updated"}
        THREAD_BUS.trigger_event("laravel.logs.changed", payload)
        get_rpc_delivery_service().publish_topic(
            "laravel.logs.snapshot.updated",
            payload,
            audience="*",
            entity_type="laravel_logs",
            entity_id=source_id,
            revision=revision,
        )

    @serialized_method
    def refresh_via_operation(self, idempotency_key: Optional[str] = None) -> Dict[str, Any]:
        """Run a bounded refresh tracked as a V5 operation."""
        op_svc = OperationService()
        op = op_svc.create_or_get(
            kind="laravel_logs_refresh",
            scope="laravel_logs",
            idempotency_key=idempotency_key,
            initial_message="Laravel log refresh accepted",
        )
        op_svc.start(op.id, stage="load_cursor", message="Loading cursor")
        try:
            self._do_poll()
            op_svc.complete(op.id, message="Laravel log refresh completed")
            base_url = resolve_laravel_base_url().rstrip("/")
            cursor_obj = self.repo.get_remote_cursor("laravel_logs", base_url)
            revision = cursor_obj.revision if cursor_obj else op.revision
            if base_url:
                self._publish_snapshot_updated(base_url, revision)
            return {"success": True, "operation_id": op.id, "revision": revision}
        except Exception as exc:
            op_svc.fail(op.id, {"code": "refresh_failed", "message": str(exc)}, message=str(exc))
            return {"success": False, "operation_id": op.id, "error": str(exc)}

    @serialized_method
    def get_snapshot(self) -> Dict[str, Any]:
        """Get the current log snapshot for the active endpoint."""
        base_url = resolve_laravel_base_url().rstrip("/")
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


class _LaravelLogMirrorServiceProvider:
    def __init__(self) -> None:
        self._service: Optional[LaravelLogMirrorService] = None
        init_serialized_owner(self, "laravel.log_mirror.provider", "LaravelLogMirrorProvider")

    @serialized_method
    def get(self) -> LaravelLogMirrorService:
        if self._service is None:
            self._service = LaravelLogMirrorService()
        return self._service


_provider = _LaravelLogMirrorServiceProvider()

def get_laravel_log_mirror_service() -> LaravelLogMirrorService:
    return _provider.get()
