# -*- coding: utf-8 -*-
"""Assist-Laravel application service — persisted control plane for queue workers."""

from __future__ import annotations

import traceback
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
from pycore.pyctl.assist.assist_settings import load_assist_settings, save_assist_settings
from pycore.pyutils.common.service_config import (
    LARAVEL_WORKER_API_URL,
    TRANSLATION_QUEUE_BUMP_TTL_SECONDS,
)
from pycore.pyctl.assist.capability_sync import apply_assist_runtime
from pycore.pyctl.assist.wiring import (
    bind_selected_endpoint_for_workers,
    resolve_selected_endpoint_for_ui,
)
from pycore.pyctl.translation.worker.worker import translation_worker_service
from pycore.pyctl.tts.laravel_audio_worker import laravel_word_audio_worker
from pycore.pyctl.tts.laravel_audio_worker import laravel_sentence_audio_worker

_RUNTIME_CALLBACKS = (
    "translation_worker",
    "tts_queue_poller",
    "tts_sentence_worker",
    "subtitle_search_worker",
)


def _runtime_running() -> bool:
    heartbeat = shared_heartbeat_system
    for name in _RUNTIME_CALLBACKS:
        try:
            if heartbeat.is_callback_enabled(name):
                return True
        except Exception:  # noqa: BLE001
            continue
    return False


def assist_status(include_laravel: bool = False) -> Dict[str, Any]:
    try:
        settings = load_assist_settings()
        translation_status = translation_worker_service.get_status()
        word_status = laravel_word_audio_worker.get_status()
        sentence_status = laravel_sentence_audio_worker.get_status()
        worker_statuses = (translation_status, word_status, sentence_status)
        endpoint = resolve_selected_endpoint_for_ui(monitor_reachable=False)
        processor_enabled = bool(
            settings["enabled"] and any(settings["capabilities"].values())
        )
        return {
            "enabled": settings["enabled"],
            "capabilities": settings["capabilities"],
            "endpoint": endpoint,
            "running": _runtime_running(),
            "processor_enabled": processor_enabled,
            "circuit": {"open": False, "cooldown_s": 0},
            "counters": {
                "claimed": sum(int(item.get("total_claimed") or 0) for item in worker_statuses),
                "submitted": sum(int(item.get("total_succeeded") or 0) for item in worker_statuses),
                "released": 0,
                "failures": sum(int(item.get("total_failed") or 0) for item in worker_statuses),
            },
            "last_error": None,
            "last_cycle_at": None,
            "claimer": None,
            "laravel_status": None,
        }
    except Exception as exc:  # noqa: BLE001
        tb = traceback.format_exc()
        ColorPrint.red(f"[AssistRouter] /status failed: {exc}\n{tb}")
        return {
            "enabled": False,
            "capabilities": {},
            "endpoint": None,
            "laravel_reachable": False,
            "running": False,
            "processor_enabled": False,
            "circuit": {"open": False, "cooldown_s": 0},
            "counters": {},
            "last_error": f"status error: {exc}",
            "last_cycle_at": None,
            "claimer": None,
            "laravel_status": None,
            "_status_error": str(exc),
        }


def assist_config(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    req = params or {}
    endpoint = str(req.get("laravel_endpoint") or "").strip()
    if endpoint:
        endpoint_result = bind_selected_endpoint_for_workers(endpoint)
        if not endpoint_result.get("success"):
            return {
                "success": False,
                "ok": False,
                "error": endpoint_result.get("error") or "LARAVEL_ENDPOINT_BIND_FAILED",
            }
    patch: Dict[str, Any] = {}
    if req.get("enabled") is not None:
        patch["enabled"] = bool(req["enabled"])
    caps_in = req.get("capabilities")
    if isinstance(caps_in, dict):
        caps = {k: v for k, v in caps_in.items() if v is not None}
        if caps:
            patch["capabilities"] = caps
    config = save_assist_settings(patch)
    runtime = apply_assist_runtime(config)
    errors = list(runtime.get("errors") or []) if isinstance(runtime, dict) else []
    success = bool(runtime.get("ok", True)) if isinstance(runtime, dict) else True
    ColorPrint.green(f"[AssistRouter] Config applied: {config}")
    result: Dict[str, Any] = {
        "success": success,
        "ok": success,
        "config": config,
        **config,
    }
    if errors:
        result["errors"] = errors
        result["error"] = "; ".join(errors)
    return result


def assist_cycle(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    req = params or {}
    endpoint_result = bind_selected_endpoint_for_workers(
        str(req.get("laravel_endpoint") or "")
    )
    if not endpoint_result.get("success"):
        return {
            "success": False,
            "ok": False,
            "error": endpoint_result.get("error") or "LARAVEL_ENDPOINT_BIND_FAILED",
        }
    settings = load_assist_settings()
    if not settings["enabled"]:
        return {"success": False, "error": "queue processing is disabled — enable it first"}

    results = [
        translation_worker_service.pull_once(),
        laravel_word_audio_worker.pull_once(),
        laravel_sentence_audio_worker.pull_once(),
    ]
    return {
        "ok": True,
        "processed": sum(int(result.get("processed") or 0) for result in results),
        "submitted": sum(int(result.get("processed") or 0) for result in results),
        "released": 0,
        "errors": [],
        "workers": results,
    }
