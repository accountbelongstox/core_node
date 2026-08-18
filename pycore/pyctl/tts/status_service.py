# -*- coding: utf-8 -*-
"""
TTS status and control application service.

Endpoints (prefix /api/local/tts):
  GET  /status[?refresh=1]  -> live edge-tts availability + version.
  POST /test                -> live synth for ONE engine (not /api/local/ai/*).
  GET  /settings            -> synth timeout + managed server options.
  POST /settings            -> persist TTS tuning.
  POST /server              -> start/stop ONE subprocess TTS API server.

AI chat/image routes live under /api/local/ai/* — do not reuse them for TTS tests.
STT/OCR mirrors: /api/local/stt/test, /api/local/ocr/test.

The edge endpoint periodically returns HTTP 403 (rate-limit / regional block).
Normal status reads never synthesize or start a background probe. An explicit
refresh runs the live check and caches its result.
"""

from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.user_data_store import user_data_store
from pycore.pyutils.tts.edge.client import (
    edge_tts_client,
    get_synth_timeout,
    set_synth_timeout,
)
import pycore.pyctl.ai.speech_history as speech_history
from pycore.pyfoundations.api_secrets import streamelements_key_present
from pycore.pyutils.tts.tts_orchestrator import (
    invalidate_tts_status_cache,
    tts_status as orchestrator_status,
)
from pycore.pyutils.tts.tts_orchestrator import (
    get_edge_cooldown_seconds,
    set_edge_cooldown_seconds,
    tts_test as orchestrator_test,
)
from pycore.pyutils.tts.tts_service_manager import (
    apply_server_settings,
    get_server_settings,
    is_server_engine,
    set_engine_enabled,
    start_server,
    stop_server,
)
from pycore.pyutils.common.status_snapshot_cache import (
    STATUS_SNAPSHOT_TTS_KEY,
    status_snapshot_cache,
)

# Settings-adjustable TTS tuning is persisted in user_data.json under this section
# and re-applied to the engines on import, so a saved override survives restarts.
_TTS_SECTION = "tts"


def _load_persisted_tts_settings() -> None:
    """Apply persisted synth timeout / edge cooldown to the engines (best-effort)."""
    try:
        section = user_data_store.get_section(_TTS_SECTION) or {}
    except Exception:
        return
    if section.get("synth_timeout_s") is not None:
        set_synth_timeout(section["synth_timeout_s"])
    if section.get("edge_cooldown_s") is not None:
        set_edge_cooldown_seconds(section["edge_cooldown_s"])


_load_persisted_tts_settings()


def _build_status(refresh: int = 0):
    """
    TTS status: the known edge-tts state (version/availability) plus the
    multi-engine orchestrator's priority/availability (chattts -> cosyvoice ->
    gptsovits -> f5tts -> melotts -> sherpa -> edge -> …).

    Returns:
        { success,
          providers: [ {name, available, version, proxy, error, cached} ],
          best: str|None,
          engines: [ {name, priority, available, note} ] }                   # orchestrator
    """
    client = edge_tts_client
    # A live edge probe is a real synth round-trip that can hang for seconds.
    # Normal status reads only peek; explicit refresh is the only probe trigger.
    if refresh:
        edge = client.test_availability(force=True)
    else:
        edge = client.peek_availability()
    edge = edge or {"available": None, "version": None, "proxy": False,
                    "error": None, "cached": False, "pending": True}
    orch = orchestrator_status(refresh=bool(refresh))
    engines = list(orch.get("engines") or [])
    for entry in engines:
        if entry.get("name") != "edge":
            continue
        entry["version"] = edge.get("version") or entry.get("version")
        entry["live_available"] = edge.get("available")
        entry["proxy"] = edge.get("proxy", False)
        entry["probe_error"] = edge.get("error")
        entry["probe_cached"] = edge.get("cached", False)
        entry["probe_pending"] = edge.get("pending", False)
        break
    return {
        "success": True,
        # Deprecated: edge live probe is merged into engines[].name=="edge".
        "providers": [
            {
                "name": "edge",
                "available": edge.get("available", False),
                "version": edge.get("version"),
                "proxy": edge.get("proxy", False),
                "error": edge.get("error"),
                "cached": edge.get("cached", False),
                "pending": edge.get("pending", False),
            }
        ],
        "best": orch.get("best"),
        # The engine the NEXT synth would actually use (honours the edge cooldown).
        "active": orch.get("active"),
        # Seconds left on the edge-tts failure cooldown (0 = not cooling). When > 0,
        # synthesis is falling back to the offline engine until it elapses.
        "edge_cooldown_remaining": orch.get("edge_cooldown_remaining", 0),
        # Whether STREAMELEMENTS_API_KEY exists in .secret_keys (value never returned).
        "streamelements_key_present": streamelements_key_present(),
        # Per-engine: name, priority, available, note, version (+ edge live probe).
        "engines": engines,
    }


def status(refresh: int = 0):
    """Return the shared cached TTS status unless a live refresh is requested."""
    should_refresh = bool(refresh)
    return status_snapshot_cache.get(
        STATUS_SNAPSHOT_TTS_KEY,
        lambda: _build_status(refresh),
        refresh=should_refresh,
    )


def test(params: Optional[Dict[str, Any]] = None):
    """Live synth test for ONE engine (or the best available)."""
    p = params or {}
    ColorPrint.yellow("[DEPRECATED] Direct TTS test entry; use the HTTP controller")
    result = orchestrator_test(
        engine=p.get("engine"),
        text=p.get("text"),
        language=str(p.get("language") or "en"),
        rate=p.get("rate"),
    )
    try:
        entry = speech_history.record_test_result("tts", result, source="tts-test")
        if entry:
            result["record_id"] = entry["id"]
    except Exception as e:  # noqa: BLE001 — history is best-effort
        ColorPrint.yellow(f"[tts] could not record test audio: {e}")
    return result


def get_settings():
    """Current Settings-adjustable TTS tuning + managed local server options."""
    srv = get_server_settings()
    return {
        "success": True,
        "synth_timeout_s": get_synth_timeout(),
        "edge_cooldown_s": get_edge_cooldown_seconds(),
        "server_auto_manage": srv.get("server_auto_manage"),
        "server_single_active": srv.get("server_single_active"),
        "server_idle_shutdown_s": srv.get("server_idle_shutdown_s"),
        "server_enabled": srv.get("server_enabled"),
    }


def post_settings(params: Optional[Dict[str, Any]] = None):
    """Update + persist synth timeout / edge cooldown / managed server options."""
    req = params or {}
    patch = {}
    if req.get("synth_timeout_s") is not None:
        patch["synth_timeout_s"] = set_synth_timeout(req["synth_timeout_s"])
    if req.get("edge_cooldown_s") is not None:
        patch["edge_cooldown_s"] = set_edge_cooldown_seconds(req["edge_cooldown_s"])
    if patch:
        try:
            section = user_data_store.get_section(_TTS_SECTION) or {}
            section.update(patch)
            user_data_store.set_section(_TTS_SECTION, section)
        except Exception as e:
            ColorPrint.yellow(f"[tts] failed to persist tts settings: {e}")
    server_patch: Dict[str, Any] = {}
    if req.get("server_auto_manage") is not None:
        server_patch["server_auto_manage"] = req["server_auto_manage"]
    if req.get("server_single_active") is not None:
        server_patch["server_single_active"] = req["server_single_active"]
    if req.get("server_idle_shutdown_s") is not None:
        server_patch["server_idle_shutdown_s"] = req["server_idle_shutdown_s"]
    if req.get("server_enabled") is not None:
        server_patch["server_enabled"] = req["server_enabled"]
    srv = apply_server_settings(server_patch) if server_patch else get_server_settings()
    invalidate_tts_status_cache()
    return {
        "success": True,
        "synth_timeout_s": get_synth_timeout(),
        "edge_cooldown_s": get_edge_cooldown_seconds(),
        "server_auto_manage": srv.get("server_auto_manage"),
        "server_single_active": srv.get("server_single_active"),
        "server_idle_shutdown_s": srv.get("server_idle_shutdown_s"),
        "server_enabled": srv.get("server_enabled"),
    }


def post_server_action(params: Optional[Dict[str, Any]] = None):
    """Enable/disable or start/stop ONE managed local TTS server engine."""
    req = params or {}
    engine = str(req.get("engine") or "").strip().lower()
    if not is_server_engine(engine):
        return {"success": False, "error": f"Unknown server engine: {req.get('engine')}"}
    try:
        if req.get("enabled") is not None:
            result = set_engine_enabled(
                engine,
                bool(req["enabled"]),
                start_now=bool(req.get("start")),
            )
        elif req.get("start") is True:
            result = start_server(engine)
        elif req.get("start") is False:
            result = stop_server(engine)
        else:
            result = get_server_settings()
        invalidate_tts_status_cache(engine)
        return result
    except Exception as e:  # noqa: BLE001
        return {"success": False, "error": str(e)}
