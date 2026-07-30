# -*- coding: utf-8 -*-
"""Qwen3TTS workflows and durable event publication for the Pycore UI."""

from typing import Any, Dict, Optional

from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
import pycore.pyctl.tts.qwen.operation_service as qwen_operations
from pycore.pyutils.common.operation_service import operation_service as operations
from pycore.pyutils.rpc_v2.delivery import http_event_delivery_service
import pycore.pyutils.tts.qwen.engine as qwen_engine
from pycore.pyutils.tts.qwen.config import ENGINE_NAME, QUEUE_EVENT_NAME
from pycore.pyutils.tts.tts_service_manager import (
    prepare_server_for_use,
    server_runtime_status,
    start_server,
    stop_server,
)


def _prepare(
    force_start: bool = False,
    force_restart: bool = False,
) -> Optional[str]:
    if force_restart:
        stop_server(ENGINE_NAME)
    if force_start or force_restart:
        result = start_server(ENGINE_NAME)
        if not result.get("success"):
            return str(result.get("error") or "qwen3tts start failed")
        return None
    if not prepare_server_for_use(ENGINE_NAME):
        return "qwen3tts service failed to start"
    return None

def _publish_queue_event(event: Dict[str, Any]) -> None:
    payload = dict(event or {})
    sequence = int(payload.get("seq") or 0)
    job_id = str(payload.get("job_id") or "unknown")
    instance_id = str(payload.get("instance_id") or "unknown")
    event_name = str(payload.get("event") or "")
    http_event_delivery_service.publish_topic(
        BusSignals.QWEN_QUEUE_CHANGED,
        payload,
        audience="*",
        event_id=f"qwen3tts-queue-{instance_id}-{sequence}-{job_id}",
        entity_type="qwen3tts_queue",
        entity_id=job_id,
        revision=sequence,
    )
    terminal_topics = {
        "queue.job.completed": BusSignals.QWEN_JOB_COMPLETED,
        "queue.job.failed": BusSignals.QWEN_JOB_FAILED,
    }
    topic = terminal_topics.get(event_name)
    if topic is None:
        return
    http_event_delivery_service.publish_topic(
        topic,
        payload,
        audience="*",
        event_id=f"qwen3tts-terminal-{instance_id}-{sequence}-{job_id}",
        entity_type="qwen3tts_job",
        entity_id=job_id,
        revision=sequence,
    )

def register_event_bridge() -> None:
    THREAD_BUS.register_event_handler(
        QUEUE_EVENT_NAME,
        _publish_queue_event,
    )

def health(_params: Dict[str, Any]) -> Dict[str, Any]:
    health = qwen_engine.health()
    if health is None:
        return {
            "success": False,
            "error": {
                "code": "qwen_unavailable",
                "message": "qwen3tts service is offline",
            },
        }
    return {"success": True, "data": health}

def capabilities(_params: Dict[str, Any]) -> Dict[str, Any]:
    capabilities = qwen_engine.get_capabilities()
    if capabilities is None:
        return {
            "success": False,
            "error": {
                "code": "qwen_unavailable",
                "message": "qwen3tts service is offline",
            },
        }
    return {"success": True, "data": capabilities}

def model_load(params: Dict[str, Any]) -> Dict[str, Any]:
    prepare_error = _prepare(
        force_start=True,
        force_restart=bool(params.get("force_reload", False)),
    )
    if prepare_error:
        return {
            "success": False,
            "error": {
                "code": "qwen_start_error",
                "message": prepare_error,
            },
        }
    result = qwen_engine.load_model()
    if result is None or not result.get("ok"):
        return {
            "success": False,
            "error": {
                "code": "qwen_model_load_error",
                "message": str((result or {}).get("error") or "model load failed"),
            },
        }
    return {"success": True, "data": result}

def model_status(_params: Dict[str, Any]) -> Dict[str, Any]:
    runtime = server_runtime_status(ENGINE_NAME)
    return {
        "success": True,
        "data": {
            "running": bool(runtime.get("server_running")),
            "base_url": qwen_engine.base_url(),
            "health": qwen_engine.health() or {},
            "capabilities": qwen_engine.get_capabilities() or {},
            "runtime": runtime,
        },
    }

def synthesis_submit(params: Dict[str, Any]) -> Dict[str, Any]:
    scope = str(params.get("scope") or "")
    text = str(params.get("text") or "")
    if not scope or not text:
        return {
            "success": False,
            "error": {
                "code": "missing_params",
                "message": "scope and text are required",
            },
        }
    prepare_error = _prepare()
    if prepare_error:
        return {
            "success": False,
            "error": {
                "code": "qwen_start_error",
                "message": prepare_error,
            },
        }
    return {
        "success": True,
        "data": qwen_operations.submit(scope, params),
    }

def synthesis_status(params: Dict[str, Any]) -> Dict[str, Any]:
    status = qwen_operations.status(
        operation_id=str(params.get("operation_id") or "") or None,
        scope=str(params.get("scope") or "") or None,
    )
    if not status:
        return {
            "success": False,
            "error": {
                "code": "not_found",
                "message": "No synthesis operation found",
            },
        }
    return {"success": True, "data": status}

def synthesis_cancel(params: Dict[str, Any]) -> Dict[str, Any]:
    operation_id = str(params.get("operation_id") or "")
    if not operation_id:
        return {
            "success": False,
            "error": {
                "code": "missing_params",
                "message": "operation_id is required",
            },
        }
    return {
        "success": True,
        "data": qwen_operations.cancel(operation_id),
    }

def operation_snapshot(params: Dict[str, Any]) -> Dict[str, Any]:
    snapshot = operations.get_snapshot(
        op_id=str(params.get("operation_id") or "") or None,
        scope=str(params.get("scope") or "") or None,
        include_results=True,
    )
    if not snapshot:
        return {
            "success": False,
            "error": {"code": "not_found", "message": "No operation found"},
        }
    return {"success": True, "data": snapshot}

def operation_events(params: Dict[str, Any]) -> Dict[str, Any]:
    operation_id = str(params.get("operation_id") or "")
    if not operation_id:
        return {
            "success": False,
            "error": {
                "code": "missing_params",
                "message": "operation_id is required",
            },
        }
    events = operations.list_events(
        operation_id,
        since_seq=int(params.get("since_seq", 0)),
        limit=int(params.get("limit", 100)),
    )
    return {
        "success": True,
        "data": {
            "events": [
                {
                    "seq": event.seq,
                    "event_id": event.event_id,
                    "level": event.level,
                    "type": event.event_type,
                    "message": event.message,
                    "item_id": event.item_id,
                    "revision": event.revision,
                    "created_at": event.created_at,
                }
                for event in events
            ],
            "count": len(events),
        },
    }


__all__ = ["register_event_bridge", "health", "capabilities", "model_load", "model_status", "synthesis_submit", "synthesis_status", "synthesis_cancel", "operation_snapshot", "operation_events"]
