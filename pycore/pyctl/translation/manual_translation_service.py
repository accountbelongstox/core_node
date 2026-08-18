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

async def translate_single(params: Dict[str, Any], *, origin: str = "rpc") -> Dict[str, Any]:
    """Stable single-text Google translation handler (origin is keyword-only so
    the HTTP dispatcher only passes the params dict)."""
    text = str(params.get("text") or "").strip()
    source = str(params.get("src") or "auto")
    target = str(params.get("dest") or "en")
    if not GOOGLETRANS_AVAILABLE:
        return {"success": False, "provider": "google", "error": "googletrans is not installed"}
    if not text:
        return {"success": False, "provider": "google", "error": "text is required"}
    async with GoogleTranslator() as translator:
        result = await translator.translate_single(
            text,
            src=source,
            dest=target,
            use_cache=bool(params.get("use_cache", True)),
        )
    if result.error:
        return {"success": False, "provider": "google", "error": result.error}
    translated = str(result.translated_text or "")
    translate_history.record(
        source=str(result.src_lang or source),
        target=str(result.dest_lang or target),
        text=text,
        engine="google",
        result=translated,
        origin=origin,
    )
    return {
        "success": True,
        "provider": "google",
        "original_text": result.original_text,
        "translated_text": translated,
        "src": result.src_lang,
        "dest": result.dest_lang,
        "src_lang": result.src_lang,
        "dest_lang": result.dest_lang,
        "pronunciation": result.pronunciation,
        "from_cache": bool(result.from_cache),
    }

async def translate_batch(params: Dict[str, Any]) -> Dict[str, Any]:
    """Stable batch Google translation handler (single target language)."""
    texts = params.get("texts") or []
    if isinstance(texts, str):
        texts = [texts]
    texts = [str(text) for text in texts]
    source = str(params.get("src") or "auto")
    target = str(params.get("dest") or "en")
    if not GOOGLETRANS_AVAILABLE:
        return {"success": False, "provider": "google", "error": "googletrans is not installed"}
    if not texts:
        return {"success": False, "provider": "google", "error": "texts is required"}
    async with GoogleTranslator() as translator:
        results = await translator.translate_batch(
            texts,
            src=source,
            dest=target,
            use_cache=bool(params.get("use_cache", True)),
        )
    return {
        "success": True,
        "provider": "google",
        "src": source,
        "dest": target,
        "results": [result.to_dict() for result in results],
    }

async def detect_language(params: Dict[str, Any]) -> Dict[str, Any]:
    """Stable language detection handler."""
    text = str(params.get("text") or "").strip()
    if not GOOGLETRANS_AVAILABLE:
        return {"success": False, "provider": "google", "error": "googletrans is not installed"}
    if not text:
        return {"success": False, "provider": "google", "error": "text is required"}
    async with GoogleTranslator() as translator:
        result = await translator.detect_language(text)
    if result.get("error"):
        return {"success": False, "provider": "google", **result}
    return {"success": True, "provider": "google", **result}

async def translate_google(params: Dict[str, Any]) -> Dict[str, Any]:
    return await translate_single(params, origin="ui")

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


__all__ = [
    "status",
    "translate_single",
    "translate_batch",
    "detect_language",
    "translate_google",
    "translate_ai",
    "history",
    "history_delete",
    "history_clear",
]

