# -*- coding: utf-8 -*-
"""
Assist-Laravel router — persisted control plane for canonical queue workers.

Endpoints (prefix /api/local/assist):
  GET  /status -> { enabled, capabilities, endpoint:{base_url,label}|null,
                    running,
                    laravel_status: <passthrough of the selected endpoint's
                    GET /api/app_qy_v1/assist/status; 6s timeout; null on
                    any failure> }
  POST /config -> persist {enabled?, capabilities?{tts?,translation?}} to the
                    unified user-data store (section ``assist_laravel``) and
                    apply live to the dedicated heartbeat workers.
                    -> { ok, config }
  POST /cycle  -> wake one pass of every enabled canonical worker.

Endpoints are plain ``def`` (FastAPI threadpool) because claim/generate/submit
are blocking — same pattern as ai_image_router.
"""

from typing import Any, Dict, Optional
import traceback

import fastapi
from pydantic import BaseModel

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyheartbeat import get_heartbeat_system
from pycore.pyctl.assist import (
    ASSIST_API_PREFIX,
    load_assist_settings,
    save_assist_settings,
)
from pycore.callmodule.services.queue_monitor_service import get_queue_monitor_service
from pycore.callmodule.services.translation_worker.worker import (
    get_translation_worker_service,
)
from pycore.callmodule.services.tts_queue_poller_service import (
    get_tts_queue_poller_service,
)
from pycore.callmodule.services.tts_sentence_worker_service import (
    get_tts_sentence_worker_service,
)
from pycore.callmodule.callmodule_config import Config
from pycore.callmodule.services.assist_wiring import (
    resolve_selected_endpoint_for_ui,
)
from pycore.callmodule.services.assist_capability_sync import apply_assist_runtime
# Unified pycore->Laravel HTTP gateway (times + logs + records every call).
from pycore.callmodule.services.sync.laravel_client import get_laravel_client

router = fastapi.APIRouter(prefix="/api/local/assist",
                           tags=["Local Processing - Assist Laravel"])

# Passthrough probe of the selected endpoint's assist status (seconds).
# Remote (tailscale/cloud) endpoints exceed 2s on a cold hit — 6s keeps the
# status from falsely reporting the backend as down.
_LARAVEL_STATUS_TIMEOUT = 6.0
_RUNTIME_CALLBACKS = (
    "translation_worker",
    "tts_queue_poller",
    "tts_sentence_worker",
    "subtitle_search_worker",
)


class CapabilitiesPatch(BaseModel):
    # Each capability is optional — omitted keys keep their stored value. These
    # are the per-capability assist toggles the Queue Center exposes; each gates a
    # real canonical worker or lane. Translation, audio, sentence audio, subtitle, STT and AI
    # translation are pycore-owned. Image and cover work belongs to mcp-chrome.
    translation: Optional[bool] = None
    ai_translate: Optional[bool] = None
    tts: Optional[bool] = None
    sentence_audio: Optional[bool] = None
    subtitle: Optional[bool] = None
    stt: Optional[bool] = None


class ConfigRequest(BaseModel):
    enabled: Optional[bool] = None
    capabilities: Optional[CapabilitiesPatch] = None


def _laravel_reachable_from_monitor() -> bool:
    """Cached queue-monitor reachability — no endpoint resolve on this path."""
    try:
        snap = get_queue_monitor_service(
            laravel_api_url=Config.LARAVEL_WORKER_API_URL,
            bump_ttl_seconds=Config.TRANSLATION_QUEUE_BUMP_TTL_SECONDS,
        ).get_snapshot(refresh=False)
        return bool(snap.get("laravel_reachable"))
    except Exception:  # noqa: BLE001 — best-effort
        return False


def _fetch_laravel_status(base_url: str) -> Optional[Dict[str, Any]]:
    """GET {base}/api/app_qy_v1/assist/status (6s timeout); None on failure."""
    try:
        resp = get_laravel_client().get(
            f"{ASSIST_API_PREFIX}/status",
            base_url=base_url,
            timeout=_LARAVEL_STATUS_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            return data if isinstance(data, dict) else None
    except Exception:  # noqa: BLE001 — status passthrough is best-effort
        pass
    return None


def _runtime_running() -> bool:
    """Whether at least one canonical capability worker is enabled."""
    heartbeat = get_heartbeat_system()
    for name in _RUNTIME_CALLBACKS:
        try:
            if heartbeat.is_callback_enabled(name):
                return True
        except Exception:  # noqa: BLE001
            continue
    return False


def _apply_translation_gate(config: Dict[str, Any]) -> None:
    """Legacy alias — full runtime sync replaces translation-only gate."""
    apply_assist_runtime(config)


@router.get("/status")
def assist_status(include_laravel: bool = True):
    """
    Full assist snapshot: persisted settings, selected endpoint, worker run
    state + counters, and a best-effort passthrough of the selected Laravel
    endpoint's own /assist/status (null when unreachable within 6s).
    """
    try:
        settings = load_assist_settings()
        laravel_reachable = _laravel_reachable_from_monitor()
        endpoint = resolve_selected_endpoint_for_ui(monitor_reachable=laravel_reachable)
        laravel_status = (
            _fetch_laravel_status(endpoint["base_url"])
            if include_laravel and laravel_reachable and endpoint and endpoint.get("base_url") else None
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
    except Exception as exc:  # noqa: BLE001 - never 500; print full traceback
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


@router.post("/config")
def assist_config(req: ConfigRequest):
    """
    Persist a settings patch to user_data.json (section ``assist_laravel``)
    and apply it live to the canonical queue workers. 400 on invalid numbers.
    """
    patch: Dict[str, Any] = {}
    if req.enabled is not None:
        patch["enabled"] = bool(req.enabled)
    if req.capabilities is not None:
        caps = {k: v for k, v in req.capabilities.dict().items() if v is not None}
        if caps:
            patch["capabilities"] = caps

    config = save_assist_settings(patch)

    # The control plane owns capability intent; each queue has one consumer.
    _apply_translation_gate(config)

    ColorPrint.green(f"[AssistRouter] Config applied: {config}")
    return {"ok": True, "config": config}


@router.post("/cycle")
def assist_cycle():
    """
    Trigger one pass of each enabled canonical worker.
    """
    settings = load_assist_settings()
    if not settings["enabled"]:
        raise fastapi.HTTPException(
            status_code=400,
            detail="queue processing is disabled — enable it first")

    caps = settings.get("capabilities") or {}
    triggered = 0
    errors = []
    if (
        caps.get("translation", True)
        or caps.get("ai_translate", True)
        or caps.get("subtitle", False)
        or caps.get("stt", False)
    ):
        try:
            get_translation_worker_service(Config.LARAVEL_WORKER_API_URL).poll_once()
            triggered += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"translation: {exc}")
    if caps.get("tts", True):
        try:
            get_tts_queue_poller_service().poll_and_process()
            triggered += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"word_audio: {exc}")
    if caps.get("sentence_audio", True):
        try:
            get_tts_sentence_worker_service().poll_and_process()
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
