# -*- coding: utf-8 -*-
"""
Qwen3TTS RPC v2 Routes — FIX V3

Registers all WebSocket RPC handlers for the Qwen3TTS subsystem:
  - health / capabilities (discovery)
  - model.load            (warm-up)
  - synthesis.submit/status/cancel (synthesis lifecycle)
  - operation.snapshot/events (V5 operation readout)

The synthesis handlers invoke qwen3tts_service via asyncio.to_thread so the
async event loop is never blocked by the synthesis work.
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_QWEN_HEALTH,
    UI_QWEN_CAPABILITIES,
    UI_QWEN_MODEL_LOAD,
    UI_QWEN_MODEL_STATUS,
    UI_QWEN_SYNTHESIS_SUBMIT,
    UI_QWEN_SYNTHESIS_STATUS,
    UI_QWEN_SYNTHESIS_CANCEL,
    UI_QWEN_OPERATION_SNAPSHOT,
    UI_QWEN_OPERATION_EVENTS,
)


def _get_qwen_service():
    """Lazy import to avoid startup cost if Qwen is not configured."""
    from pycore.pyutils.tts.qwen3tts_service import get_qwen3tts_service
    return get_qwen3tts_service()


def register_qwen_rpc_routes(server) -> None:
    """Register all Qwen3TTS RPC v2 WebSocket handlers."""

    # ------------------------------------------------------------------
    # ui.qwen.health — liveness probe (no model load required)
    # ------------------------------------------------------------------
    async def qwen_health_handler(params: Dict[str, Any], request_id: str, context) -> Dict[str, Any]:
        try:
            svc = await asyncio.to_thread(_get_qwen_service)
            health = await asyncio.to_thread(svc.health)
            return {"success": True, "data": health}
        except Exception as exc:
            return {"success": False, "error": {"code": "qwen_health_error", "message": str(exc)}}

    server.route(name=UI_QWEN_HEALTH, handler=qwen_health_handler, sync=False)

    # ------------------------------------------------------------------
    # ui.qwen.capabilities — list supported speakers/languages/params
    # ------------------------------------------------------------------
    async def qwen_capabilities_handler(params: Dict[str, Any], request_id: str, context) -> Dict[str, Any]:
        try:
            svc = await asyncio.to_thread(_get_qwen_service)
            caps = await asyncio.to_thread(svc.get_capabilities)
            return {"success": True, "data": caps}
        except Exception as exc:
            return {"success": False, "error": {"code": "qwen_capabilities_error", "message": str(exc)}}

    server.route(name=UI_QWEN_CAPABILITIES, handler=qwen_capabilities_handler, sync=False)

    # ------------------------------------------------------------------
    # ui.qwen.model.load — trigger warm-up (idempotent)
    # params: { force_reload?: bool }
    # ------------------------------------------------------------------
    async def qwen_model_load_handler(params: Dict[str, Any], request_id: str, context) -> Dict[str, Any]:
        force_reload: bool = bool(params.get("force_reload", False))
        try:
            svc = await asyncio.to_thread(_get_qwen_service)
            result = await asyncio.to_thread(svc.load_model, force_reload)
            return {"success": True, "data": result}
        except Exception as exc:
            return {"success": False, "error": {"code": "qwen_model_load_error", "message": str(exc)}}

    server.route(name=UI_QWEN_MODEL_LOAD, handler=qwen_model_load_handler, sync=False)

    # ------------------------------------------------------------------
    # ui.qwen.model.status — quick model-load status (no side effects)
    # ------------------------------------------------------------------
    async def qwen_model_status_handler(params: Dict[str, Any], request_id: str, context) -> Dict[str, Any]:
        try:
            svc = await asyncio.to_thread(_get_qwen_service)
            status = await asyncio.to_thread(svc.model_status)
            return {"success": True, "data": status}
        except Exception as exc:
            return {"success": False, "error": {"code": "qwen_model_status_error", "message": str(exc)}}

    server.route(name=UI_QWEN_MODEL_STATUS, handler=qwen_model_status_handler, sync=False)

    # ------------------------------------------------------------------
    # ui.qwen.synthesis.submit — enqueue one synthesis job
    # params: { scope: str, text: str, speaker?: str, language?: str, ... }
    # ------------------------------------------------------------------
    async def qwen_synthesis_submit_handler(params: Dict[str, Any], request_id: str, context) -> Dict[str, Any]:
        scope: str = params.get("scope", "")
        text: str = params.get("text", "")
        if not scope or not text:
            return {"success": False, "error": {"code": "missing_params", "message": "scope and text are required"}}
        try:
            svc = await asyncio.to_thread(_get_qwen_service)
            result = await asyncio.to_thread(svc.submit_synthesis, scope, params)
            return {"success": True, "data": result}
        except Exception as exc:
            return {"success": False, "error": {"code": "qwen_synthesis_submit_error", "message": str(exc)}}

    server.route(name=UI_QWEN_SYNTHESIS_SUBMIT, handler=qwen_synthesis_submit_handler, sync=False)

    # ------------------------------------------------------------------
    # ui.qwen.synthesis.status — poll an in-flight job
    # params: { operation_id: str }
    # ------------------------------------------------------------------
    async def qwen_synthesis_status_handler(params: Dict[str, Any], request_id: str, context) -> Dict[str, Any]:
        operation_id: str = params.get("operation_id", "")
        scope: str = params.get("scope", "")
        try:
            svc = await asyncio.to_thread(_get_qwen_service)
            status = await asyncio.to_thread(svc.get_synthesis_status, operation_id=operation_id or None, scope=scope or None)
            return {"success": True, "data": status}
        except Exception as exc:
            return {"success": False, "error": {"code": "qwen_synthesis_status_error", "message": str(exc)}}

    server.route(name=UI_QWEN_SYNTHESIS_STATUS, handler=qwen_synthesis_status_handler, sync=False)

    # ------------------------------------------------------------------
    # ui.qwen.synthesis.cancel — request cancellation
    # params: { operation_id: str }
    # ------------------------------------------------------------------
    async def qwen_synthesis_cancel_handler(params: Dict[str, Any], request_id: str, context) -> Dict[str, Any]:
        operation_id: str = params.get("operation_id", "")
        if not operation_id:
            return {"success": False, "error": {"code": "missing_params", "message": "operation_id is required"}}
        try:
            svc = await asyncio.to_thread(_get_qwen_service)
            result = await asyncio.to_thread(svc.cancel_synthesis, operation_id)
            return {"success": True, "data": result}
        except Exception as exc:
            return {"success": False, "error": {"code": "qwen_synthesis_cancel_error", "message": str(exc)}}

    server.route(name=UI_QWEN_SYNTHESIS_CANCEL, handler=qwen_synthesis_cancel_handler, sync=False)

    # ------------------------------------------------------------------
    # ui.qwen.operation.snapshot — full V5 operation snapshot
    # params: { operation_id?: str, scope?: str }
    # ------------------------------------------------------------------
    async def qwen_operation_snapshot_handler(params: Dict[str, Any], request_id: str, context) -> Dict[str, Any]:
        operation_id: str = params.get("operation_id", "")
        scope: str = params.get("scope", "")
        try:
            from pycore.callmodule.services.operation_service import OperationService
            svc = OperationService()
            snapshot = svc.get_snapshot(op_id=operation_id or None, scope=scope or None)
            if not snapshot:
                return {"success": False, "error": {"code": "not_found", "message": "No operation found"}}
            return {"success": True, "data": snapshot}
        except Exception as exc:
            return {"success": False, "error": {"code": "qwen_operation_snapshot_error", "message": str(exc)}}

    server.route(name=UI_QWEN_OPERATION_SNAPSHOT, handler=qwen_operation_snapshot_handler, sync=False)

    # ------------------------------------------------------------------
    # ui.qwen.operation.events — paginated event log
    # params: { operation_id: str, since_seq?: int, limit?: int }
    # ------------------------------------------------------------------
    async def qwen_operation_events_handler(params: Dict[str, Any], request_id: str, context) -> Dict[str, Any]:
        operation_id: str = params.get("operation_id", "")
        since_seq: int = int(params.get("since_seq", 0))
        limit: int = int(params.get("limit", 100))
        if not operation_id:
            return {"success": False, "error": {"code": "missing_params", "message": "operation_id is required"}}
        try:
            from pycore.callmodule.services.operation_service import OperationService
            svc = OperationService()
            events = svc.list_events(operation_id, since_seq=since_seq, limit=limit)
            return {
                "success": True,
                "data": {
                    "events": [
                        {
                            "seq": e.seq,
                            "event_id": e.event_id,
                            "level": e.level,
                            "type": e.event_type,
                            "message": e.message,
                            "item_id": e.item_id,
                            "revision": e.revision,
                            "created_at": e.created_at,
                        }
                        for e in events
                    ],
                    "count": len(events),
                },
            }
        except Exception as exc:
            return {"success": False, "error": {"code": "qwen_operation_events_error", "message": str(exc)}}

    server.route(name=UI_QWEN_OPERATION_EVENTS, handler=qwen_operation_events_handler, sync=False)

    ColorPrint.green("[Qwen3TTS] Registered RPC v2 routes (FIX V3)")


__all__ = ["register_qwen_rpc_routes"]
