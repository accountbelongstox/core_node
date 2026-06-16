# -*- coding: utf-8 -*-
"""
Assist-Laravel router — local HTTP face of the pyctl AssistWorker.

Endpoints (prefix /api/local/assist):
  GET  /status -> { enabled, capabilities, endpoint:{base_url,label}|null,
                    running, circuit:{open,cooldown_s}, poll_interval_s,
                    batch_limit, counters:{claimed,submitted,released,failures},
                    last_error, last_cycle_at,
                    laravel_status: <passthrough of the selected endpoint's
                    GET /api/app_qy_v1/assist/status; 2s timeout; null on
                    any failure> }
  POST /config -> persist {enabled?, capabilities?{cover?,tts?,translation?},
                    poll_interval_s? (5..600), batch_limit? (1..10)} to the
                    unified user-data store (section ``assist_laravel``) and
                    apply LIVE: start/stop the assist worker AND gate the
                    existing translation_worker heartbeat callback under the
                    same master toggle (enabled && capabilities.translation).
                    -> { ok, config }
  POST /cycle  -> run ONE claim->generate->submit cycle immediately.
                    400 while disabled. -> { ok, processed, submitted,
                    released, errors:[...] }

Endpoints are plain ``def`` (FastAPI threadpool) because claim/generate/submit
are blocking — same pattern as ai_image_router.
"""

from typing import Any, Dict, Optional

import fastapi
from pydantic import BaseModel

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyheartbeat import get_heartbeat_system
from pycore.pyctl.assist import (
    ASSIST_API_PREFIX,
    BATCH_LIMIT_MAX,
    BATCH_LIMIT_MIN,
    POLL_INTERVAL_MAX,
    POLL_INTERVAL_MIN,
    load_assist_settings,
    save_assist_settings,
)
from pycore.callmodule.services.assist_wiring import ensure_assist_worker_wired

router = fastapi.APIRouter(prefix="/api/local/assist",
                           tags=["Local Processing - Assist Laravel"])

# Passthrough probe of the selected endpoint's assist status (seconds).
_LARAVEL_STATUS_TIMEOUT = 2.0


class CapabilitiesPatch(BaseModel):
    # Each capability is optional — omitted keys keep their stored value.
    cover: Optional[bool] = None
    tts: Optional[bool] = None
    # poster claims movie/TV poster lookups (TMDB -> OMDB) for book/subtitle items.
    poster: Optional[bool] = None
    # translation gates the EXISTING TranslationWorkerService (no duplicate
    # claiming here — see assist_worker.py's module docstring).
    translation: Optional[bool] = None


class ConfigRequest(BaseModel):
    enabled: Optional[bool] = None
    capabilities: Optional[CapabilitiesPatch] = None
    poll_interval_s: Optional[int] = None  # 5..600
    batch_limit: Optional[int] = None      # 1..10


def _fetch_laravel_status(base_url: str) -> Optional[Dict[str, Any]]:
    """GET {base}/api/app_qy_v1/assist/status (2s timeout); None on failure."""
    try:
        requests = get_third_package_requests()
        resp = requests.get(f"{base_url}{ASSIST_API_PREFIX}/status",
                            timeout=_LARAVEL_STATUS_TIMEOUT)
        if resp.status_code == 200:
            data = resp.json()
            return data if isinstance(data, dict) else None
    except Exception:  # noqa: BLE001 — status passthrough is best-effort
        pass
    return None


def _apply_translation_gate(config: Dict[str, Any]) -> None:
    """
    Gate the EXISTING translation_worker heartbeat callback under the assist
    master toggle: enabled && capabilities.translation. Once the
    ``assist_laravel`` section exists (which a POST /config guarantees), the
    toggle rules — matching translation_worker_enabled_on_start()'s
    start-time decision. Best-effort: the callback may not be registered yet
    on an unusual startup ordering, in which case the start-time gate applies.
    """
    try:
        heartbeat = get_heartbeat_system()
        want = bool(config["enabled"]
                    and config["capabilities"].get("translation", True))
        if want:
            heartbeat.enable_callback("translation_worker")
        else:
            heartbeat.disable_callback("translation_worker")
        ColorPrint.blue(
            f"[AssistRouter] translation_worker callback "
            f"{'enabled' if want else 'disabled'} (assist master toggle)")
    except Exception as e:  # noqa: BLE001
        ColorPrint.yellow(f"[AssistRouter] Translation gate apply failed: {e}")


@router.get("/status")
def assist_status():
    """
    Full assist snapshot: persisted settings, selected endpoint, worker run
    state + counters, and a best-effort passthrough of the selected Laravel
    endpoint's own /assist/status (null when unreachable within 2s).
    """
    worker = ensure_assist_worker_wired()
    settings = load_assist_settings()
    endpoint = worker.resolve_endpoint()
    laravel_status = (
        _fetch_laravel_status(endpoint["base_url"])
        if endpoint and endpoint.get("base_url") else None
    )
    worker_state = worker.get_status()
    return {
        "enabled": settings["enabled"],
        "capabilities": settings["capabilities"],
        "endpoint": endpoint,
        "running": worker_state["running"],
        "circuit": worker_state["circuit"],
        "poll_interval_s": settings["poll_interval_s"],
        "batch_limit": settings["batch_limit"],
        "counters": worker_state["counters"],
        "last_error": worker_state["last_error"],
        "last_cycle_at": worker_state["last_cycle_at"],
        "claimer": worker_state["claimer"],
        "laravel_status": laravel_status,
    }


@router.post("/config")
def assist_config(req: ConfigRequest):
    """
    Persist a settings patch to user_data.json (section ``assist_laravel``)
    and apply it live: start/stop the assist polling loop and gate the
    translation worker. 400 on out-of-range numbers.
    """
    if req.poll_interval_s is not None and not (
            POLL_INTERVAL_MIN <= req.poll_interval_s <= POLL_INTERVAL_MAX):
        raise fastapi.HTTPException(
            status_code=400,
            detail=f"poll_interval_s must be {POLL_INTERVAL_MIN}..{POLL_INTERVAL_MAX}")
    if req.batch_limit is not None and not (
            BATCH_LIMIT_MIN <= req.batch_limit <= BATCH_LIMIT_MAX):
        raise fastapi.HTTPException(
            status_code=400,
            detail=f"batch_limit must be {BATCH_LIMIT_MIN}..{BATCH_LIMIT_MAX}")

    patch: Dict[str, Any] = {}
    if req.enabled is not None:
        patch["enabled"] = bool(req.enabled)
    if req.poll_interval_s is not None:
        patch["poll_interval_s"] = req.poll_interval_s
    if req.batch_limit is not None:
        patch["batch_limit"] = req.batch_limit
    if req.capabilities is not None:
        caps = {k: v for k, v in req.capabilities.dict().items() if v is not None}
        if caps:
            patch["capabilities"] = caps

    config = save_assist_settings(patch)

    # Apply live: start/stop the assist loop + gate the translation worker.
    worker = ensure_assist_worker_wired()
    if config["enabled"]:
        worker.start()
    else:
        worker.stop()
    _apply_translation_gate(config)

    ColorPrint.green(f"[AssistRouter] Config applied: {config}")
    return {"ok": True, "config": config}


@router.post("/cycle")
def assist_cycle():
    """
    Run ONE claim->generate->submit cycle immediately (synchronous; serialized
    against the background loop). 400 while the worker is disabled — enable it
    first via POST /api/local/assist/config.
    """
    settings = load_assist_settings()
    if not settings["enabled"]:
        raise fastapi.HTTPException(
            status_code=400,
            detail="assist worker is disabled — enable it via POST /api/local/assist/config")
    worker = ensure_assist_worker_wired()
    result = worker.run_cycle(settings)
    return {
        "ok": result["ok"],
        "processed": result["processed"],
        "submitted": result["submitted"],
        "released": result["released"],
        "errors": result["errors"],
    }
