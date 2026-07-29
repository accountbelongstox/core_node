# -*- coding: utf-8 -*-
"""Native RPC v2 routes for Google / AI translate (pycore-manager Translate page)."""

from __future__ import annotations

import asyncio
import importlib.metadata
from typing import Any, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_TRANSLATE_STATUS,
    UI_TRANSLATE_TRANSLATE,
    UI_TRANSLATE_AI,
    UI_TRANSLATE_HISTORY,
    UI_TRANSLATE_HISTORY_DELETE,
    UI_TRANSLATE_HISTORY_CLEAR,
)
from pycore.pyctl.ai.ai_gateway import generate_text
import pycore.pyctl.ai.translate_history as translate_history
from pycore.pyfoundations.system_paths import map_web_path
from pycore.pyutils.translator.google_translator import (
    GOOGLETRANS_AVAILABLE,
    GoogleTranslator,
)

_RECOMMENDED = "4.0.0-rc1"


def _cache_count() -> int:
    base = map_web_path("pycore_db") / "translator_cache"
    if not base.is_dir():
        return 0
    n = 0
    for p in base.rglob("*.json"):
        if p.is_file():
            n += 1
    return n


def _status() -> Dict[str, Any]:
    version = None
    if GOOGLETRANS_AVAILABLE:
        try:
            version = importlib.metadata.version("googletrans")
        except Exception:  # noqa: BLE001
            version = None
    cache_dir = str(map_web_path("pycore_db") / "translator_cache")
    return {
        "available": bool(GOOGLETRANS_AVAILABLE),
        "library": "googletrans",
        "version": version,
        "service_url": "translate.googleapis.com",
        "cache_dir": cache_dir,
        "cache_count": _cache_count(),
        "recommended_version": _RECOMMENDED,
    }


def _translate_google(text: str, src: str, dest: str, use_cache: bool) -> Dict[str, Any]:
    if not GOOGLETRANS_AVAILABLE:
        return {"provider": "google", "error": "googletrans is not installed"}
    text = (text or "").strip()
    if not text:
        return {"provider": "google", "error": "text is required"}

    async def _run():
        async with GoogleTranslator() as gt:
            return await gt.translate_single(text, src=src, dest=dest, use_cache=use_cache)

    try:
        result = asyncio.run(_run())
    except Exception as exc:  # noqa: BLE001
        return {"provider": "google", "error": str(exc)}
    if result.error:
        return {"provider": "google", "error": result.error}
    out = {
        "translated_text": result.translated_text,
        "src": result.src_lang,
        "dest": result.dest_lang,
        "pronunciation": result.pronunciation,
        "from_cache": bool(result.from_cache),
        "provider": "google",
    }
    try:
        translate_history.record(
            source=str(result.src_lang or src),
            target=str(result.dest_lang or dest),
            text=text,
            engine="google",
            result=str(result.translated_text or ""),
            origin="ui",
        )
    except Exception:  # noqa: BLE001
        pass
    return out


def _translate_ai(text: str, src: str, dest: str) -> Dict[str, Any]:
    text = (text or "").strip()
    if not text:
        return {"provider": "ai", "error": "text is required"}
    prompt = (
        f"Translate the following text from {src} to {dest}. "
        f"Return ONLY the translation, no commentary.\n\n{text}"
    )
    res = generate_text(prompt=prompt, source="ui.translate.ai")
    if not res.get("success"):
        return {
            "provider": "ai",
            "model": res.get("model"),
            "error": res.get("error") or "AI translate failed",
        }
    translated = str(res.get("text") or "").strip()
    out = {
        "translated_text": translated,
        "provider": "ai",
        "model": res.get("model"),
    }
    try:
        translate_history.record(
            source=src,
            target=dest,
            text=text,
            engine="ai",
            result=translated,
            origin="ui",
        )
    except Exception:  # noqa: BLE001
        pass
    return out


def register_local_translate_routes(server):
    """Register WS RPC handlers."""

    async def status_handler(params, request_id, context):
        return await asyncio.to_thread(_status)

    server.route(name=UI_TRANSLATE_STATUS, handler=status_handler, sync=False)

    async def translate_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            _translate_google,
            str(params.get("text") or ""),
            str(params.get("src") or "auto"),
            str(params.get("dest") or "en"),
            bool(params.get("use_cache", True)),
        )

    server.route(name=UI_TRANSLATE_TRANSLATE, handler=translate_handler, sync=False)

    async def translate_ai_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            _translate_ai,
            str(params.get("text") or ""),
            str(params.get("src") or "auto"),
            str(params.get("dest") or "en"),
        )

    server.route(name=UI_TRANSLATE_AI, handler=translate_ai_handler, sync=False)

    async def history_handler(params, request_id, context):
        params = params or {}
        limit = int(params.get("limit") or 50)

        def _run():
            return {"success": True, "entries": translate_history.list_history(limit)}

        return await asyncio.to_thread(_run)

    server.route(name=UI_TRANSLATE_HISTORY, handler=history_handler, sync=False)

    async def history_delete_handler(params, request_id, context):
        params = params or {}
        entry_id = str(params.get("id") or "")

        def _run():
            ok = translate_history.delete_entry(entry_id) if entry_id else False
            return {"success": bool(ok)}

        return await asyncio.to_thread(_run)

    server.route(name=UI_TRANSLATE_HISTORY_DELETE, handler=history_delete_handler, sync=False)

    async def history_clear_handler(params, request_id, context):
        def _run():
            removed = translate_history.clear_history()
            return {"success": True, "removed": removed}

        return await asyncio.to_thread(_run)

    server.route(name=UI_TRANSLATE_HISTORY_CLEAR, handler=history_clear_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered translate RPC routes")


__all__ = ["register_local_translate_routes"]
