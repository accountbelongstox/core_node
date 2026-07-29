# -*- coding: utf-8 -*-
from __future__ import annotations

import asyncio
from typing import Any, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.services.operation_service import OperationService
from pycore.callmodule.services.operation_event_service import OperationEventService

UI_OPERATION_SNAPSHOT = "ui.operation.snapshot"
UI_OPERATION_EVENTS = "ui.operation.events"
UI_OPERATION_CANCEL = "ui.operation.cancel"


def _params(raw: Any) -> Dict[str, Any]:
    return raw if isinstance(raw, dict) else {}


async def _run(fn, *args, **kwargs):
    if kwargs:
        return await asyncio.to_thread(lambda: fn(*args, **kwargs))
    return await asyncio.to_thread(fn, *args)


def register_operation_routes(server):
    """Register WS RPC handlers for operations."""
    op_service = OperationService()
    event_service = OperationEventService()

    async def snapshot_handler(params, request_id, context):
        p = _params(params)
        op_id = str(p.get("operation_id") or p.get("id") or "")
        scope = str(p.get("scope") or "")
        if not op_id and not scope:
            return {"success": False, "error": "missing operation_id or scope"}
        
        snapshot = await _run(op_service.get_snapshot, op_id=op_id, scope=scope)
        if not snapshot:
            return {"success": False, "error": "operation not found"}

        # Agent-history pipeline UI expects a durable records list alongside the
        # latest operation. Attach it here so the frontend can drop polling.
        effective_scope = scope
        if not effective_scope:
            try:
                op = await _run(
                    op_service.get_operation,
                    snapshot.get("operation", {}).get("id") or "",
                )
                effective_scope = getattr(op, "scope", "") if op else ""
            except Exception:
                effective_scope = ""
        if effective_scope in ("agent_history", "agent_history_pipeline"):
            try:
                import pycore.callmodule.services.agent_history_article_records as records

                snapshot = dict(snapshot)
                snapshot["records"] = await _run(records.list_records, 100)
            except Exception:
                snapshot = dict(snapshot)
                snapshot["records"] = []

        return {"success": True, "data": snapshot}

    server.route(name=UI_OPERATION_SNAPSHOT, handler=snapshot_handler, sync=False)

    async def events_handler(params, request_id, context):
        p = _params(params)
        op_id = str(p.get("operation_id") or p.get("id") or "")
        since_seq = int(p.get("since_seq") or 0)
        limit = int(p.get("limit") or 100)
        
        if not op_id:
            return {"success": False, "error": "missing operation_id"}
            
        events = await _run(event_service.get_events, op_id, since_seq, limit)
        return {
            "success": True, 
            "data": {
                "events": [
                    {
                        "seq": e.seq,
                        "level": e.level,
                        "type": e.event_type,
                        "message": e.message,
                        "created_at": e.created_at,
                    }
                    for e in events
                ]
            }
        }

    server.route(name=UI_OPERATION_EVENTS, handler=events_handler, sync=False)

    async def cancel_handler(params, request_id, context):
        p = _params(params)
        op_id = str(p.get("operation_id") or p.get("id") or "")
        reason = str(p.get("reason") or "Cancelled by user")
        
        if not op_id:
            return {"success": False, "error": "missing operation_id"}
            
        await _run(op_service.cancel_operation, op_id, reason)
        return {"success": True, "data": {"status": "cancel_requested"}}

    server.route(name=UI_OPERATION_CANCEL, handler=cancel_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered operation RPC routes")

__all__ = ["register_operation_routes"]
