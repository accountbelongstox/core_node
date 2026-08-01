# -*- coding: utf-8 -*-
"""Assist-Laravel application service — persisted control plane for queue workers."""

from __future__ import annotations

import traceback
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
from pycore.pyctl.assist.assist_settings import ASSIST_API_PREFIX, load_assist_settings, save_assist_settings
from pycore.pyutils.common.service_config import (
    LARAVEL_WORKER_API_URL,
    TRANSLATION_QUEUE_BUMP_TTL_SECONDS,
)
from pycore.pyctl.assist.capability_sync import apply_assist_runtime
from pycore.pyctl.assist.wiring import resolve_selected_endpoint_for_ui
from pycore.pyctl.queue_center.translation_monitor_service import queue_monitor_service
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyctl.translation.worker.worker import translation_worker_service
from pycore.pyctl.tts.laravel_audio_worker import laravel_word_audio_worker
from pycore.pyctl.tts.laravel_audio_worker import laravel_sentence_audio_worker

_LARAVEL_STATUS_TIMEOUT = 6.0
_RUNTIME_CALLBACKS = (
    "translation_worker",
    "translation_queue_monitor",
    "translation_http_event_client",
    "sentence_queue_monitor",
    "tts_queue_poller",
    "tts_sentence_worker",
    "subtitle_search_worker",
)


def _laravel_reachable_from_monitor() -> bool:
    try:
        snap = queue_monitor_service.get_snapshot(refresh=False)
        return bool(snap.get("laravel_reachable"))
    except Exception:  # noqa: BLE001
        return False


def _fetch_laravel_status(base_url: str) -> Optional[Dict[str, Any]]:
    try:
        resp = laravel_client.get(
            f"{ASSIST_API_PREFIX}/status",
            base_url=base_url,
            timeout=_LARAVEL_STATUS_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            return data if isinstance(data, dict) else None
    except Exception:  # noqa: BLE001
        pass
    return None


def _runtime_running() -> bool:
    heartbeat = shared_heartbeat_system
    for name in _RUNTIME_CALLBACKS:
        try:
            if heartbeat.is_callback_enabled(name):
                return True
        except Exception:  # noqa: BLE001
            continue
    return False


def assist_status(include_laravel: bool = True) -> Dict[str, Any]:
    try:
        settings = load_assist_settings()
        laravel_reachable = _laravel_reachable_from_monitor()
        endpoint = resolve_selected_endpoint_for_ui(monitor_reachable=laravel_reachable)
        laravel_status = (
            _fetch_laravel_status(endpoint["base_url"])
            if include_laravel and laravel_reachable and endpoint and endpoint.get("base_url")
            else None
        )
        return {
            "enabled": settings["enabled"],
            "capabilities": settings["capabilities"],
            "endpoint": endpoint,
            "laravel_reachable": laravel_reachable,
            "running": _runtime_running(),
            "circuit": {"open": False, "cooldown_s": 0},
            "counters": {"claimed": 0, "submitted": 0, "released": 0, "failures": 0},
            "last_error": None,
            "last_cycle_at": None,
            "claimer": None,
            "laravel_status": laravel_status,
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


def assist_cycle() -> Dict[str, Any]:
    settings = load_assist_settings()
    if not settings["enabled"]:
        return {"success": False, "error": "queue processing is disabled — enable it first"}

    caps = settings.get("capabilities") or {}
    triggered = 0
    errors = []
    if (
        caps.get("translation")
        or caps.get("ai_translate")
        or caps.get("subtitle")
        or caps.get("stt")
    ):
        try:
            translation_worker_service.poll_once()
            triggered += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"translation: {exc}")
    if caps.get("tts"):
        try:
            laravel_word_audio_worker.poll_and_process()
            triggered += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"word_audio: {exc}")
    if caps.get("sentence_audio"):
        try:
            laravel_sentence_audio_worker.poll_and_process()
            triggered += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"sentence_audio: {exc}")

    return {
        "ok": not errors,
        "processed": triggered,
        "submitted": 0,
        "released": 0,
        "errors": errors,
    }
