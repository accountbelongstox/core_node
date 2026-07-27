# -*- coding: utf-8 -*-
"""
Local engine live-test RPC — direct WS handlers for TTS/STT/OCR/AI tests.

These mirror POST /api/local/{tts,stt,ocr}/test and POST /api/local/ai/chat
but run in-process on a worker thread (no loopback HTTP). Long cold-start model
engines (Qwen3-TTS, Bark, etc.) can take several minutes, so these routes use
THREAD_BUS workers to avoid blocking the WS event loop.

Routes:
  local.tts.test   { engine?, text?, language?, rate?, accent?,
                     gender?, speaker?, instruct?, voice?, description?,
                     cfg_value?, timesteps?, speaker_id?, prompt_text?,
                     prompt_lang?, speed? }
  local.stt.test   { engine?, language?, text?, model? }
  local.ocr.test   { engine?, image_data?, image_path?, lang?,
                     model_type?, languages? }
  local.ai.chat    { provider, messages, model?, source? }
  local.ai.image.test { provider, prompt?, size?, model? }

  local.tts.status  {}          -> TTS engine list with quota/cooldown
  local.stt.status  {}          -> STT engine list
  local.ocr.status  {}          -> OCR engine list
  local.ai.status   {}          -> AI gateway status
"""

import asyncio
from typing import Any, Dict, List

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    LOCAL_AI_CHAT,
    LOCAL_AI_IMAGE_TEST,
    LOCAL_AI_STATUS,
    LOCAL_OCR_STATUS,
    LOCAL_OCR_TEST,
    LOCAL_STT_STATUS,
    LOCAL_STT_TEST,
    LOCAL_TTS_STATUS,
    LOCAL_TTS_TEST,
)
from pycore.pyfoundations.serialized_worker import await_bus_task
from pycore.pyctl.ai import speech_history
from pycore.pyctl.ai.ai_gateway import generate_image, generate_text, gateway_status
from pycore.pyutils.common.api_secrets import streamelements_key_present
from pycore.pyutils.edge_tts.edge_tts_client import get_edge_tts_client
from pycore.pyutils.ocr_cluster import ocr_status as ocr_orchestrator_status
from pycore.pyutils.ocr_cluster import ocr_test
from pycore.pyutils.stt import stt_status as stt_orchestrator_status
from pycore.pyutils.stt import stt_test as stt_orchestrator_test
from pycore.pyutils.tts import tts_status as tts_orchestrator_status
from pycore.pyutils.tts.tts_orchestrator import get_edge_cooldown_seconds
from pycore.pyutils.tts.tts_orchestrator import tts_test as tts_orchestrator_test
from pycore.pyutils.tts.tts_service_manager import get_server_settings


# ---- TTS test ----------------------------------------------------------------

def _tts_test(params: Dict[str, Any]) -> Dict[str, Any]:
    params = params or {}
    result = tts_orchestrator_test(
        engine=params.get("engine"),
        text=params.get("text"),
        language=params.get("language") or "en",
        rate=params.get("rate"),
        accent=params.get("accent"),
        # Per-engine extra params — ignored by engines that don't use them.
        gender=params.get("gender"),
        speaker=params.get("speaker"),
        instruct=params.get("instruct"),
        voice=params.get("voice"),
        description=params.get("description"),
        cfg_value=_float_param(params, "cfg_value"),
        timesteps=_int_param(params, "timesteps"),
        speaker_id=params.get("speaker_id"),
        prompt_text=params.get("prompt_text"),
        prompt_lang=params.get("prompt_lang"),
        speed=_float_param(params, "speed"),
    )
    try:
        entry = speech_history.record_test_result("tts", result, source="tts-test")
        if entry:
            result["record_id"] = entry["id"]
    except Exception as exc:  # noqa: BLE001 — history is best-effort
        ColorPrint.yellow(f"[local.tts.test] could not record test audio: {exc}")
    return result


# ---- STT test ----------------------------------------------------------------

def _stt_test(params: Dict[str, Any]) -> Dict[str, Any]:
    params = params or {}
    result = stt_orchestrator_test(
        engine=params.get("engine"),
        language=params.get("language") or "en",
        text=params.get("text"),
        model=params.get("model"),
    )
    try:
        entry = speech_history.record_test_result("stt", result, source="stt-test")
        if entry:
            result["record_id"] = entry["id"]
    except Exception as exc:  # noqa: BLE001 — history is best-effort
        ColorPrint.yellow(f"[local.stt.test] could not record test audio: {exc}")
    return result


# ---- OCR test ----------------------------------------------------------------

def _ocr_test(params: Dict[str, Any]) -> Dict[str, Any]:

    params = params or {}
    languages = params.get("languages")
    if isinstance(languages, list):
        languages = [str(l) for l in languages]
    return ocr_test(
        engine=params.get("engine"),
        image_path=params.get("image_path"),
        image_data=params.get("image_data"),
        lang=params.get("lang"),
        model_type=params.get("model_type"),
        languages=languages,
    )


# ---- AI chat test ------------------------------------------------------------

def _ai_chat(params: Dict[str, Any]) -> Dict[str, Any]:
    """Single chat turn through the AI gateway (auto dispatch or explicit provider)."""

    params = params or {}
    provider = params.get("provider")
    messages = params.get("messages")
    model = params.get("model")
    source = params.get("source") or "test-popup"

    if not messages:
        # Accept a flat "message" string for quick test prompts.
        msg_text = params.get("message") or "Reply with one short sentence introducing yourself."
        messages = [{"role": "user", "content": msg_text}]

    result = generate_text(
        provider=provider,
        messages=messages,
        model=model,
        source=source,
    )
    return result


# ---- AI image test -----------------------------------------------------------

def _ai_image_test(params: Dict[str, Any]) -> Dict[str, Any]:
    """Single image generation through the AI gateway for one provider."""

    params = params or {}
    return generate_image(
        provider=params.get("provider"),
        prompt=params.get("prompt") or "A minimalist test image.",
        size=params.get("size"),
        model=params.get("model"),
        source="test-popup",
    )


# ---- Status routes -----------------------------------------------------------

def _tts_status(params: Dict[str, Any]) -> Dict[str, Any]:
    """TTS engine status list with per-engine quota/cooldown/availability."""
    params = params or {}
    refresh = params.get("refresh", 0)

    client = get_edge_tts_client()
    if refresh:
        edge = client.test_availability(force=True)
    else:
        edge = client.peek_availability()
        if edge is None:
            client.ensure_background_probe()
    edge = edge or {"available": None, "version": None, "proxy": False,
                    "error": None, "cached": False, "pending": True}
    orch = tts_orchestrator_status()
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
        "active": orch.get("active"),
        "edge_cooldown_remaining": orch.get("edge_cooldown_remaining", 0),
        "streamelements_key_present": streamelements_key_present(),
        "engines": engines,
    }


def _stt_status(params: Dict[str, Any]) -> Dict[str, Any]:
    """STT engine availability + priority (+ Azure free-F0 quota note)."""
    return stt_orchestrator_status()


def _ocr_status(params: Dict[str, Any]) -> Dict[str, Any]:
    """OCR engine availability snapshot."""
    return ocr_orchestrator_status()


def _ai_status(params: Dict[str, Any]) -> Dict[str, Any]:
    """AI gateway status (providers, tiers, quotas, cooldowns, task records)."""
    return gateway_status()


# ---- Helpers -----------------------------------------------------------------

def _float_param(params: Dict[str, Any], key: str) -> Any:
    """Return the param value as a float, or None if missing / not numeric."""
    v = params.get(key)
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _int_param(params: Dict[str, Any], key: str) -> Any:
    """Return the param value as an int, or None if missing / not numeric."""
    v = params.get(key)
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


# ---- Registration ------------------------------------------------------------

def register_local_engine_test_routes(server):
    """Register all local engine test + status routes on the rpc_v2 WS server."""

    # -- live tests (long-running, cold-start safe) --
    async def local_tts_test(params, request_id, context):
        return await await_bus_task(_tts_test, params or {}, timeout=None)

    async def local_stt_test(params, request_id, context):
        return await await_bus_task(_stt_test, params or {}, timeout=None)

    async def local_ocr_test(params, request_id, context):
        return await await_bus_task(_ocr_test, params or {}, timeout=None)

    async def local_ai_chat(params, request_id, context):
        return await await_bus_task(_ai_chat, params or {}, timeout=None)

    async def local_ai_image_test(params, request_id, context):
        return await await_bus_task(_ai_image_test, params or {}, timeout=None)

    server.route(
        name=LOCAL_TTS_TEST,
        handler=local_tts_test,
        sync=False,
        description="Live TTS synth test for one engine (cold-start safe, per-engine params)",
    )
    server.route(
        name=LOCAL_STT_TEST,
        handler=local_stt_test,
        sync=False,
        description="Live STT round-trip test for one engine",
    )
    server.route(
        name=LOCAL_OCR_TEST,
        handler=local_ocr_test,
        sync=False,
        description="Live OCR recognition test for one engine",
    )
    server.route(
        name=LOCAL_AI_CHAT,
        handler=local_ai_chat,
        sync=False,
        description="Live AI chat test (one turn through the gateway)",
    )
    server.route(
        name=LOCAL_AI_IMAGE_TEST,
        handler=local_ai_image_test,
        sync=False,
        description="Live AI image generation test for one provider",
    )

    # -- status (fast reads, no network) --
    async def local_tts_status(params, request_id, context):
        return await asyncio.to_thread(_tts_status, params or {})

    async def local_stt_status(params, request_id, context):
        return await asyncio.to_thread(_stt_status, params or {})

    async def local_ocr_status(params, request_id, context):
        return await asyncio.to_thread(_ocr_status, params or {})

    async def local_ai_status(params, request_id, context):
        return await asyncio.to_thread(_ai_status, params or {})

    server.route(
        name=LOCAL_TTS_STATUS,
        handler=local_tts_status,
        sync=False,
        description="TTS engine list with per-engine quota/cooldown/availability",
    )
    server.route(
        name=LOCAL_STT_STATUS,
        handler=local_stt_status,
        sync=False,
        description="STT engine availability snapshot",
    )
    server.route(
        name=LOCAL_OCR_STATUS,
        handler=local_ocr_status,
        sync=False,
        description="OCR engine availability snapshot",
    )
    server.route(
        name=LOCAL_AI_STATUS,
        handler=local_ai_status,
        sync=False,
        description="AI gateway status (providers, tiers, quotas)",
    )

    ColorPrint.green(
        "[ConfigBuilder] Registered local.tts.test + local.stt.test + local.ocr.test "
        "+ local.ai.chat + local.ai.image.test + 4 status RPC routes"
    )


__all__ = ["register_local_engine_test_routes"]
