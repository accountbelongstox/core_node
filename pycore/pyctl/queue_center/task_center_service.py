# -*- coding: utf-8 -*-
"""Queue Center local worker controls and local task details."""

from typing import Any, Dict, List, Optional

from pycore.pyfoundations.third_party.api import get_third_package_pydantic
from pycore.pyctl.assist.assist_settings import load_assist_settings
from pycore.pyctl.assist.service import assist_config
from pycore.pyctl.assist.wiring import bind_selected_endpoint_for_workers
from pycore.pyctl.desktop.task_manager import task_manager
from pycore.pyctl.queue_center.control_service import (
    normalize_control_name,
    record_control_intent,
)
from pycore.pyctl.queue_center.snapshot_service import queue_center_snapshot_service
from pycore.pyctl.tts.sentence_audio_auto import (
    apply_auto_start as apply_sentence_auto_start,
)
from pycore.pyctl.tts.word_tts_auto import (
    apply_auto_start as apply_word_auto_start,
)

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
    """Apply one frontend-requested Queue Center worker control."""
    enabled = bool(req.enabled)
    canonical_name = normalize_control_name(control_name)
    endpoint_result: Dict[str, Any] = {}
    if enabled:
        endpoint_result = bind_selected_endpoint_for_workers(
            req.laravel_endpoint or ""
        )
        if not endpoint_result.get("success"):
            return {
                "success": False,
                "control": canonical_name,
                "enabled": False,
                "error": endpoint_result.get("error")
                or "LARAVEL_ENDPOINT_BIND_FAILED",
            }

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

    errors: List[str] = []
    result: Dict[str, Any] = {}
    if canonical_name == "assist_translation":
        assist_state = load_assist_settings()
        capabilities = dict(assist_state.get("capabilities") or {})
        capabilities.update({"translation": False, "ai_translate": False})
        result = assist_config({
            "enabled": bool(any(capabilities.values())),
            "capabilities": capabilities,
        })
        if result.get("success") is False:
            errors.extend(list(result.get("errors") or []))
            if result.get("error") and result.get("error") not in errors:
                errors.append(str(result["error"]))
    elif canonical_name == "word_audio":
        status = apply_word_auto_start(enabled)
        result = {"ok": not bool(status.get("error")), "status": status}
        if status.get("error"):
            errors.append(str(status["error"]))
    elif canonical_name == "sentence_audio":
        status = apply_sentence_auto_start(enabled)
        result = {"ok": not bool(status.get("error")), "status": status}
        if status.get("error"):
            errors.append(str(status["error"]))

    payload: Dict[str, Any] = {
        "success": not errors,
        "control": canonical_name,
        "enabled": enabled,
        "requested_by": requested_by,
        "graceful_stop": req.graceful_stop,
        "laravel_endpoint": endpoint_result.get("endpoint"),
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
