# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Any, Dict

from pycore.pyutils.common.operation_service import operation_service
from pycore.pyutils.common.operation_event_service import operation_event_service
from pycore.pyutils.rpc_v2.delivery import http_event_delivery_service
from pycore.callmodule.rpc_routes import route_names


def _publish_operation_event(topic, payload, audience, event_id):
    http_event_delivery_service.publish_topic(
        topic,
        payload,
        audience=audience,
        event_id=event_id,
    )


def _params(raw: Any) -> Dict[str, Any]:
    return raw if isinstance(raw, dict) else {}


def register_operation_routes(server):
    """Register HTTP controllers for operations."""
    operation_service.set_event_publisher(_publish_operation_event)

    def snapshot_handler(params, request_id, context):
        p = _params(params)
        op_id = str(p.get("operation_id") or p.get("id") or "")
        scope = str(p.get("scope") or "")
        include_items = bool(p.get("include_items", True))
        include_results = bool(p.get("include_results", False))
        if not op_id and not scope:
            return {"success": False, "error": "missing operation_id or scope"}
        
        snapshot = operation_service.get_snapshot(
            op_id=op_id,
            scope=scope,
            include_items=include_items,
            include_results=include_results,
        )
        if not snapshot:
            return {"success": False, "error": "operation not found"}

        return {"success": True, "data": snapshot}

    server.post(name=route_names.UI_OPERATION_SNAPSHOT, handler=snapshot_handler)

    def events_handler(params, request_id, context):
        p = _params(params)
        op_id = str(p.get("operation_id") or p.get("id") or "")
        since_seq = int(p.get("since_seq") or 0)
        limit = int(p.get("limit") or 100)
        
        if not op_id:
            return {"success": False, "error": "missing operation_id"}
            
        events = operation_event_service.get_events(op_id, since_seq, limit)
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

    server.post(name=route_names.UI_OPERATION_EVENTS, handler=events_handler)

    def cancel_handler(params, request_id, context):
        p = _params(params)
        op_id = str(p.get("operation_id") or p.get("id") or "")
        reason = str(p.get("reason") or "Cancelled by user")
        
        if not op_id:
            return {"success": False, "error": "missing operation_id"}
            
        operation_service.cancel_operation(op_id, reason)
        return {"success": True, "data": {"status": "cancel_requested"}}

    server.post(name=route_names.UI_OPERATION_CANCEL, handler=cancel_handler)
