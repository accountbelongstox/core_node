# -*- coding: utf-8 -*-
"""Manual Google and AI translation workflows (the translation gateway).

Local-models-only nodes (Colab/Kaggle) switch every handler to local AI
translation; the response shape stays the same with ``provider: local_ai``."""

import importlib.metadata
from typing import Any, Dict

import pycore.pyctl.ai.translate_history as translate_history
from pycore.pyctl.ai.ai_gateway import generate_text
from pycore.pyfoundations.notebook_policy import local_models_only
from pycore.pyutils.common.keyset_cursor import keyset_request
from pycore.pyutils.common.model_boot import model_boot
from pycore.pyutils.common.model_manifest import CATEGORY_TRANSLATE
from pycore.pyutils.translator.google_translator import (
    googletrans_available,
    GoogleTranslator,
)
from pycore.pyutils.translator.translation_cache import translation_cache
import pycore.pyctl.translation.local_ai_translator as local_ai_translator


RECOMMENDED_GOOGLETRANS_VERSION = "4.0.0-rc1"


def _google_unavailable_error() -> str:
    block_reason = model_boot.reason("google", CATEGORY_TRANSLATE)
    if block_reason:
        return f"google translate is blocked: {block_reason}"
    if not googletrans_available():
        return "googletrans is not installed"
    return ""


def _local_translation(text: str, source: str, target: str, origin: str) -> Dict[str, Any]:
    """Gateway answer from local AI translation (google/ai response shape)."""
    result = local_ai_translator.translate(text, target, source)
    if not result.get("success"):
        return {
            "success": False,
            "provider": result["provider"],
            "model": result["model"],
            "error": result.get("error") or "local AI translate failed",
        }
    translated = str(result.get("text") or "")
    translate_history.record(
        source=result["src"],
        target=result["dest"],
        text=text,
        engine=result["provider"],
        result=translated,
        origin=origin,
    )
    return {
        "success": True,
        "provider": result["provider"],
        "model": result["model"],
        "original_text": text,
        "translated_text": translated,
        "src": result["src"],
        "dest": result["dest"],
        "src_lang": result["src"],
        "dest_lang": result["dest"],
        "pronunciation": None,
        "from_cache": False,
    }


def status() -> Dict[str, Any]:
    version = None
    if googletrans_available():
        version = importlib.metadata.version("googletrans")
    return {
        "available": not _google_unavailable_error(),
        "boot": model_boot.record("google", CATEGORY_TRANSLATE),
        "library": "googletrans",
        "version": version,
        "service_url": "translate.googleapis.com",
        "cache_dir": str(translation_cache.root),
        "cache_count": translation_cache.count(),
        "recommended_version": RECOMMENDED_GOOGLETRANS_VERSION,
        "local_ai": {
            "provider": local_ai_translator.LOCAL_AI_TRANSLATE_PROVIDER,
            "available": not local_ai_translator.unavailable_reason(),
            "reason": local_ai_translator.unavailable_reason(),
            "gateway_default": local_models_only(),
        },
    }

async def translate_single(params: Dict[str, Any], *, origin: str = "rpc") -> Dict[str, Any]:
    """Stable single-text Google translation handler (origin is keyword-only so
    the HTTP dispatcher only passes the params dict)."""
    text = str(params.get("text") or "").strip()
    source = str(params.get("src") or "auto")
    target = str(params.get("dest") or "en")
    if local_models_only():
        return _local_translation(text, source, target, origin)
    unavailable = _google_unavailable_error()
    if unavailable:
        return {"success": False, "provider": "google", "error": unavailable}
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
    if local_models_only():
        return {
            "success": True,
            "provider": local_ai_translator.LOCAL_AI_TRANSLATE_PROVIDER,
            "src": source,
            "dest": target,
            "results": [_local_translation(text, source, target, "rpc") for text in texts],
        }
    unavailable = _google_unavailable_error()
    if unavailable:
        return {"success": False, "provider": "google", "error": unavailable}
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
    unavailable = _google_unavailable_error()
    if unavailable:
        return {"success": False, "provider": "google", "error": unavailable}
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
    if local_models_only():
        return _local_translation(text, source, target, "ui")
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
    after, limit = keyset_request(params or {})
    return {"success": True, **translate_history.list_history(after, limit)}

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

