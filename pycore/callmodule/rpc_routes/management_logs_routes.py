# -*- coding: utf-8 -*-
"""
RPC Routes for logs (FIX V8)

Provides management UI access to:
  - ui.laravel.logs_snapshot  — current mirrored log snapshot
  - ui.laravel.logs_refresh   — trigger an immediate poll
  - ui.laravel.logs_status    — service health + cursor state
  - ui.laravel.logs_records   — paginated record access
  - ui.laravel.logs_cancel    — cancel an in-flight poll
  - ui.logs.clear_logs        — clear in-memory log buffer (legacy)
  - ui.logs.get_log_stats     — stats on the log ring buffer (legacy)
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_LOGS_CLEAR_LOGS,
    UI_LOGS_GET_LOG_STATS,
    UI_LARAVEL_LOGS_SNAPSHOT,
    UI_LARAVEL_LOGS_REFRESH,
    UI_LARAVEL_LOGS_STATUS,
    UI_LARAVEL_LOGS_RECORDS,
    UI_LARAVEL_LOGS_CANCEL,
)
from pycore.callmodule.services.laravel_log_mirror_service import get_laravel_log_mirror_service


def register_management_logs_routes(server) -> None:
    """Register WS RPC handlers for log management (FIX V8)."""

    # ------------------------------------------------------------------
    # Legacy: clear_logs / get_log_stats (stub — pycore has no ring buffer yet)
    # ------------------------------------------------------------------
    async def clear_logs_handler(params: Dict[str, Any], request_id: str, context) -> Dict[str, Any]:
        # TODO: purge laravel mirror entries if requested
        return {"success": True, "data": {"cleared": True}}

    server.route(name=UI_LOGS_CLEAR_LOGS, handler=clear_logs_handler, sync=False)

    async def get_log_stats_handler(params: Dict[str, Any], request_id: str, context) -> Dict[str, Any]:
        try:
            service = get_laravel_log_mirror_service()
            snapshot = await asyncio.to_thread(service.get_snapshot)
            entries = snapshot.get("data", {}).get("entries", [])
            return {
                "success": True,
                "data": {
                    "entry_count": len(entries),
                    "stale": snapshot.get("data", {}).get("stale", False),
                    "revision": snapshot.get("data", {}).get("revision", 0),
                },
            }
        except Exception as exc:
            return {"success": False, "error": {"code": "get_log_stats_error", "message": str(exc)}}

    server.route(name=UI_LOGS_GET_LOG_STATS, handler=get_log_stats_handler, sync=False)

    # ------------------------------------------------------------------
    # ui.laravel.logs_snapshot — current full mirror snapshot
    # ------------------------------------------------------------------
    async def laravel_logs_snapshot_handler(params: Dict[str, Any], request_id: str, context) -> Dict[str, Any]:
        try:
            service = get_laravel_log_mirror_service()
            return await asyncio.to_thread(service.get_snapshot)
        except Exception as exc:
            return {"success": False, "error": {"code": "logs_snapshot_error", "message": str(exc)}}

    server.route(name=UI_LARAVEL_LOGS_SNAPSHOT, handler=laravel_logs_snapshot_handler, sync=False)

    # ------------------------------------------------------------------
    # ui.laravel.logs_refresh — trigger an immediate poll (fire-and-forget)
    # ------------------------------------------------------------------
    async def laravel_logs_refresh_handler(params: Dict[str, Any], request_id: str, context) -> Dict[str, Any]:
        try:
            service = get_laravel_log_mirror_service()
            idempotency_key = str(params.get("idempotency_key") or request_id or "")
            result = await asyncio.to_thread(service.refresh_via_operation, idempotency_key or None)
            return {"success": bool(result.get("success")), "data": result}
        except Exception as exc:
            return {"success": False, "error": {"code": "logs_refresh_error", "message": str(exc)}}

    server.route(name=UI_LARAVEL_LOGS_REFRESH, handler=laravel_logs_refresh_handler, sync=False)

    # ------------------------------------------------------------------
    # ui.laravel.logs_status — poll/cursor health without fetching entries
    # ------------------------------------------------------------------
    async def laravel_logs_status_handler(params: Dict[str, Any], request_id: str, context) -> Dict[str, Any]:
        try:
            service = get_laravel_log_mirror_service()
            snapshot = await asyncio.to_thread(service.get_snapshot)
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
        except Exception as exc:
            return {"success": False, "error": {"code": "logs_status_error", "message": str(exc)}}

    server.route(name=UI_LARAVEL_LOGS_STATUS, handler=laravel_logs_status_handler, sync=False)

    # ------------------------------------------------------------------
    # ui.laravel.logs_records — paginated access to mirrored entries
    # params: { offset?: int, limit?: int, level?: str }
    # ------------------------------------------------------------------
    async def laravel_logs_records_handler(params: Dict[str, Any], request_id: str, context) -> Dict[str, Any]:
        offset: int = int(params.get("offset", 0))
        limit: int = min(int(params.get("limit", 100)), 500)
        level_filter: str = params.get("level", "")
        try:
            service = get_laravel_log_mirror_service()
            snapshot = await asyncio.to_thread(service.get_snapshot)
            entries = snapshot.get("data", {}).get("entries", [])
            if level_filter:
                entries = [e for e in entries if str(e.get("level", "")).lower() == level_filter.lower()]
            total = len(entries)
            page = entries[offset: offset + limit]
            return {
                "success": True,
                "data": {
                    "records": page,
                    "total": total,
                    "offset": offset,
                    "limit": limit,
                },
            }
        except Exception as exc:
            return {"success": False, "error": {"code": "logs_records_error", "message": str(exc)}}

    server.route(name=UI_LARAVEL_LOGS_RECORDS, handler=laravel_logs_records_handler, sync=False)

    # ------------------------------------------------------------------
    # ui.laravel.logs_cancel — mark mirror service as cancelled/idle
    # (no long-running poll to cancel, but provides UI affordance)
    # ------------------------------------------------------------------
    async def laravel_logs_cancel_handler(params: Dict[str, Any], request_id: str, context) -> Dict[str, Any]:
        return {"success": True, "data": {"status": "cancelled", "note": "No active poll to cancel"}}

    server.route(name=UI_LARAVEL_LOGS_CANCEL, handler=laravel_logs_cancel_handler, sync=False)

    ColorPrint.green("[LogMirror] Registered logs RPC routes (FIX V8)")


__all__ = ["register_management_logs_routes"]
