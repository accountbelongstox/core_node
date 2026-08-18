# -*- coding: utf-8 -*-
"""Queue Center local worker controls and local task details."""

from typing import Any, Dict, List, Optional

from pycore.pyfoundations.third_party.api import get_third_package_pydantic
from pycore.pyctl.assist.assist_settings import set_assist_capability
from pycore.pyctl.assist.capability_sync import apply_assist_runtime
from pycore.pyctl.assist.wiring import bind_selected_endpoint_for_workers
from pycore.pyctl.desktop.task_manager import task_manager
from pycore.pyctl.queue_center.control_service import (
    normalize_control_name,
    record_control_intent,
)
from pycore.pyctl.queue_center.lane_registry import lane_capability
from pycore.pyctl.queue_center.snapshot_service import queue_center_snapshot_service
from pycore.pyctl.tts.sentence_audio_auto import (
    get_status as get_sentence_audio_status,
)
from pycore.pyctl.tts.sentence_audio_auto import warm_engine_after_enable
from pycore.pyctl.tts.word_tts_auto import get_status as get_word_audio_status

pydantic = get_third_package_pydantic()
BaseModel = pydantic.BaseModel


class QueueCenterControlRequest(BaseModel):
    enabled: bool
    laravel_endpoint: Optional[str] = None
    requested_by: Optional[str] = None
    reason: Optional[str] = None
    graceful_stop: bool = False


def set_queue_center_control(
    control_name: str,
    req: QueueCenterControlRequest,
) -> Dict[str, Any]:
    """Apply one frontend-requested Queue Center lane control.

    One flow for every lane: record the intent, flip the capability through the
    shared assist control plane, and let apply_assist_runtime reconcile the
    heartbeat callbacks and the explicit lane lifecycle (immediate stop
    releases claimed-but-unstarted tasks back to Laravel's pending queue).
    """
    enabled = bool(req.enabled)
    canonical_name = normalize_control_name(control_name)
    capability = lane_capability(canonical_name)
    if not capability:
        return {
            "success": False,
            "control": canonical_name,
            "enabled": False,
            "error": "UNKNOWN_QUEUE_CENTER_LANE",
        }

    endpoint: Optional[str] = None
    requested_endpoint = (req.laravel_endpoint or "").strip()
    if enabled and requested_endpoint:
        endpoint_result = bind_selected_endpoint_for_workers(requested_endpoint)
        if not endpoint_result.get("success"):
            return {
                "success": False,
                "control": canonical_name,
                "enabled": False,
                "error": endpoint_result.get("error")
                or "LARAVEL_ENDPOINT_BIND_FAILED",
            }
        endpoint = endpoint_result.get("endpoint")

    requested_by = (
        req.requested_by.strip()
        if isinstance(req.requested_by, str) and req.requested_by.strip()
        else "user"
    )
    record_control_intent(
        canonical_name,
        enabled,
        requested_by=requested_by,
        reason=req.reason,
        graceful_stop=req.graceful_stop,
    )

    settings = set_assist_capability(capability, enabled)
    runtime = apply_assist_runtime(settings, graceful_stop=req.graceful_stop)
    errors: List[str] = list(runtime.get("errors") or [])

    result: Dict[str, Any] = {"config": settings}
    if canonical_name == "word_audio":
        status = get_word_audio_status()
        result = {"ok": not bool(status.get("error")), "status": status}
    elif canonical_name == "sentence_audio":
        if enabled:
            warm_engine_after_enable()
        status = get_sentence_audio_status()
        result = {"ok": not bool(status.get("error")), "status": status}
    if isinstance(result.get("status"), dict) and result["status"].get("error"):
        errors.append(str(result["status"]["error"]))

    payload: Dict[str, Any] = {
        "success": not errors,
        "control": canonical_name,
        "enabled": enabled,
        "requested_by": requested_by,
        "graceful_stop": req.graceful_stop,
        "laravel_endpoint": endpoint,
        "result": result,
    }
    if errors:
        payload["error"] = "; ".join(errors)
        payload["errors"] = errors
    return payload


def get_local_task_detail(task_id: str) -> Dict[str, Any]:
    """Return one local pyctl TaskManager record."""
    task = task_manager.get_task(task_id)
    if not task:
        raise ValueError(f"Task not found: {task_id}")
    return {"success": True, "task": task.to_dict()}


def get_queue_center_snapshot(refresh: bool = False) -> Dict[str, Any]:
    """Return the Pycore-owned cached Queue Center state."""
    return queue_center_snapshot_service.get_snapshot(request_refresh=refresh)
