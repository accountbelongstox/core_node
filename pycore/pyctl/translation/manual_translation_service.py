# -*- coding: utf-8 -*-
"""Manual Google and AI translation workflows."""

import importlib.metadata
from typing import Any, Dict

import pycore.pyctl.ai.translate_history as translate_history
from pycore.pyctl.ai.ai_gateway import generate_text
from pycore.pyfoundations.system_paths import map_web_path
from pycore.pyutils.translator.google_translator import (
    GOOGLETRANS_AVAILABLE,
    GoogleTranslator,
)


RECOMMENDED_GOOGLETRANS_VERSION = "4.0.0-rc1"


def _cache_count() -> int:
    base_path = map_web_path("pycore_db") / "translator_cache"
    if not base_path.is_dir():
        return 0
    return sum(1 for path in base_path.rglob("*.json") if path.is_file())

def status() -> Dict[str, Any]:
    version = None
    if GOOGLETRANS_AVAILABLE:
        version = importlib.metadata.version("googletrans")
    cache_path = map_web_path("pycore_db") / "translator_cache"
    return {
        "available": bool(GOOGLETRANS_AVAILABLE),
        "library": "googletrans",
        "version": version,
        "service_url": "translate.googleapis.com",
        "cache_dir": str(cache_path),
        "cache_count": _cache_count(),
        "recommended_version": RECOMMENDED_GOOGLETRANS_VERSION,
    }

async def translate_google(params: Dict[str, Any]) -> Dict[str, Any]:
    text = str(params.get("text") or "").strip()
    source = str(params.get("src") or "auto")
    target = str(params.get("dest") or "en")
    if not GOOGLETRANS_AVAILABLE:
        return {"provider": "google", "error": "googletrans is not installed"}
    if not text:
        return {"provider": "google", "error": "text is required"}
    async with GoogleTranslator() as translator:
        result = await translator.translate_single(
            text,
            src=source,
            dest=target,
            use_cache=bool(params.get("use_cache", True)),
        )
    if result.error:
        return {"provider": "google", "error": result.error}
    translated = str(result.translated_text or "")
    translate_history.record(
        source=str(result.src_lang or source),
        target=str(result.dest_lang or target),
        text=text,
        engine="google",
        result=translated,
        origin="ui",
    )
    return {
        "translated_text": translated,
        "src": result.src_lang,
        "dest": result.dest_lang,
        "pronunciation": result.pronunciation,
        "from_cache": bool(result.from_cache),
        "provider": "google",
    }

def translate_ai(params: Dict[str, Any]) -> Dict[str, Any]:
    text = str(params.get("text") or "").strip()
    source = str(params.get("src") or "auto")
    target = str(params.get("dest") or "en")
    if not text:
        return {"provider": "ai", "error": "text is required"}
    prompt = (
        f"Translate the following text from {source} to {target}. "
        f"Return ONLY the translation, no commentary.\n\n{text}"
    )
    result = generate_text(prompt=prompt, source="ui.translate.ai")
    if not result.get("success"):
        return {
            "provider": "ai",
            "model": result.get("model"),
            "error": result.get("error") or "AI translate failed",
        }
    translated = str(result.get("text") or "").strip()
    translate_history.record(
        source=source,
        target=target,
        text=text,
        engine="ai",
        result=translated,
        origin="ui",
    )
    return {
        "translated_text": translated,
        "provider": "ai",
        "model": result.get("model"),
    }

def history(params: Dict[str, Any]) -> Dict[str, Any]:
    limit = int(params.get("limit") or 50)
    return {"success": True, "entries": translate_history.list_history(limit)}

def history_delete(params: Dict[str, Any]) -> Dict[str, Any]:
    entry_id = str(params.get("id") or "")
    deleted = translate_history.delete_entry(entry_id) if entry_id else False
    return {"success": bool(deleted)}

def history_clear(_params: Dict[str, Any]) -> Dict[str, Any]:
    return {"success": True, "removed": translate_history.clear_history()}


__all__ = ["status", "translate_google", "translate_ai", "history", "history_delete", "history_clear"]

