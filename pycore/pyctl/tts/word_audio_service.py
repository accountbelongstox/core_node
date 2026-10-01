# -*- coding: utf-8 -*-
"""
Word pronunciation audio router — status + live test for the real-pronunciation chain.

Endpoints (prefix /api/local/word-audio):
  GET  /status  -> the 4 real sources (free_dictionary_api, wikimedia_commons,
                   cambridge_dictionary, forvo) with availability + requires-key
                   flags, whether a Forvo key is present, the separate static
                   Kokoro batch policy, and the supported accents. No
                   network call is made and the Forvo key is NEVER leaked.
  POST /test    -> run find_pronunciation(word, lang, accent) through the live
                   client and return the base64-encoded audio + the ACTUAL accent
                   obtained on a hit, or the miss shape on a clean miss. Never
                   raises (a source error returns the miss shape, not a 500); a
                   blank word returns 400.

Backed by pyutils/external_apis/word_audio_client.py (Free Dictionary API +
Wikimedia Commons + Cambridge Dictionary + Forvo). ``find_pronunciation`` returns
``{provider, mime, audio_bytes(RAW bytes), accent, source_id, meta}`` or None;
this router base64-encodes those RAW bytes into ``audio_base64`` before
returning.

Forvo presence is determined through ``get_secret_key_indexed`` without a
network call and without returning the key.

pycore rules honored: imports at file top (PYTHON_PYCORE.md §1.4), secrets only
via get_secret_key_indexed, logging only via ColorPrint, English-only strings.
"""

import base64
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.secret_manager import get_secret_key_indexed
from pycore.pyutils.external_apis.word_audio_client import find_pronunciation
from pycore.pyutils.tts import runtime_profile
from pycore.pyutils.tts.batch import batch_constants
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.common.queue_center_contract import (
    http_transfer_contract,
    queue_center_endpoint,
)


# --------------------------------------------------------------------------- #
# helpers                                                                      #
# --------------------------------------------------------------------------- #
def _forvo_key_present() -> bool:
    """True when a Forvo API key is configured (same check as word_audio_client).

    Never makes a network call and never returns the key itself.
    """
    return bool((get_secret_key_indexed("FORVO_API_KEY") or "").strip())


def _build_status() -> Dict[str, Any]:
    """Assemble the /status payload: the 4 real sources + Forvo key presence
    + TTS engine priority names (no availability probe — that is the TTS
    status router's job) + supported accents."""
    forvo_present = _forvo_key_present()
    return {
        "backend": "pycore",
        "sources": [
            {
                "key": "free_dictionary_api",
                "label": "Free Dictionary API",
                "available": True,
                "requires_key": False,
                "note": "English only, keyless public API; us/uk accent-tagged files",
            },
            {
                "key": "wikimedia_commons",
                "label": "Wikimedia Commons",
                "available": True,
                "requires_key": False,
                "note": "English only, community En-us/En-uk .ogg recordings",
            },
            {
                "key": "cambridge_dictionary",
                "label": "Cambridge Dictionary",
                "available": True,
                "requires_key": False,
                "note": "English only, public page audio; us/uk region blocks",
            },
            {
                "key": "forvo",
                "label": "Forvo (official API)",
                "available": forvo_present,
                "requires_key": True,
                "note": "Multi-language; requires FORVO_API_KEY; accent not guaranteed",
            },
        ],
        "forvo_key_present": forvo_present,
        # This endpoint is a real-recording lookup only. Missing dictionary
        # audio is handled by the separate Queue Center Kokoro batch lane.
        "tts_fallback": False,
        "tts_engines": [runtime_profile.WORD_BATCH_ENGINE],
        "batch_engine": runtime_profile.WORD_BATCH_ENGINE,
        "batch_profile": runtime_profile.WORD_BATCH_PROFILE,
        "batch_device": runtime_profile.WORD_BATCH_DEVICE,
        "batch_size": batch_constants.group_size(),
        "accents_supported": ["us", "uk"],
    }


# --------------------------------------------------------------------------- #
# request models                                                              #
# --------------------------------------------------------------------------- #


# --------------------------------------------------------------------------- #
# endpoints                                                                    #
# --------------------------------------------------------------------------- #
def status():
    """The 4 real pronunciation sources + Forvo key presence (no network call)."""
    return _build_status()


def test(word: str, lang: str = "en", accent=None):
    """Run a live pronunciation lookup and return base64 audio on a hit.

    Never raises — a blank word returns 400; a clean miss or any source error
    returns the ``{success:false, provider:null, ...}`` miss shape. The hit
    shape's ``accent`` is the accent ACTUALLY obtained ("us"|"uk"|"unknown"),
    which may differ from ``accent_requested`` when only a fallback existed.
    """
    word = (word or "").strip()
    if not word:
        return {"success": False, "error": "word is required"}
    lang = (lang or "en").strip() or "en"
    accent = (accent or "").strip().lower()
    accent_requested = accent if accent in ("us", "uk") else None

    result = find_pronunciation(word, lang, accent=accent_requested)

    if not result:
        return {
            "success": False,
            "provider": None,
            "accent": None,
            "accent_requested": accent_requested,
            "message_code": "REAL_PRONUNCIATION_NOT_FOUND",
        }

    raw = result.get("audio_bytes") or b""
    return {
        "success": True,
        "provider": result.get("provider"),
        "mime": result.get("mime") or "audio/mpeg",
        "audio_base64": base64.b64encode(raw).decode(),
        "source_id": result.get("source_id") or "",
        "accent": result.get("accent") or "unknown",
        "accent_requested": accent_requested,
        "meta": result.get("meta") or {},
        "bytes": len(raw),
    }


# --------------------------------------------------------------------------- #
# Puter.js batch surface (proxy -> laravel)                                    #
# --------------------------------------------------------------------------- #

def word_audio_media(word: str, language: str = "en", base_url: Optional[str] = None, metadata_only: bool = False):
    """Stream a Laravel-owned word audio file through pycore."""
    base = base_url or None
    clean_word = (word or "").strip()
    clean_language = (language or "en").strip() or "en"
    if not clean_word:
        return {"success": False, "error": "Word audio unavailable"}
    media_path = queue_center_endpoint("audio_word_media", lang=clean_language, word=clean_word)
    metadata_response = laravel_client.get(media_path, base_url=base, params={"passive": "1"}, timeout=30)
    if metadata_response.status_code != 200:
        return {"success": False, "error": "Word media lookup failed", "status_code": metadata_response.status_code}
    metadata = metadata_response.json()
    data = metadata.get("data") if isinstance(metadata, dict) else None
    audio_url = data.get("audio_url") if isinstance(data, dict) else metadata.get("url") if isinstance(metadata, dict) else None
    if not isinstance(audio_url, str) or not audio_url:
        return {"success": False, "error": "Word audio unavailable"}
    if metadata_only:
        return {"success": True, "exists": True, "audio_url": audio_url}
    audio_response = laravel_client.get(audio_url, base_url=base, timeout=60)
    if audio_response.status_code != 200:
        return {"success": False, "error": "Word audio fetch failed", "status_code": audio_response.status_code}
    media_type = (audio_response.headers.get("Content-Type") or "audio/mpeg").split(";", 1)[0]
    raw = audio_response.content or b""
    return {
        "success": True,
        "media_type": media_type,
        "content_base64": base64.b64encode(raw).decode("ascii"),
        "bytes": len(raw),
    }


def upload_word_audio(payload: Dict[str, Any], base_url: Optional[str] = None):
    """POST /upload { md5, lang, audio_base64, provider?, accent?, cleaned_word? }
    -> proxy to laravel /word/audio/upload. The browser Puter.js generator posts
    each synthesized clip here; laravel validates + stores (fill-missing). Never
    raises - returns a graceful JSON on any error (no 500)."""
    try:
        resp = laravel_client.post(
            queue_center_endpoint("audio_word_upload"),
            base_url=base_url or None,
            json=payload,
            activity_timeout=http_transfer_contract(),
        )
    except OSError as exc:
        ColorPrint.red(f"[WordAudio] upload failed (base={base_url or 'resolved'}): {exc}")
        return {"success": False, "error": f"proxy error: {exc}"}
    try:
        body = resp.json()
    except ValueError:
        body = None
    if resp.status_code == 200:
        return body if body is not None else {"success": False, "error": "non-JSON response"}
    if isinstance(body, dict):
        detail = dict(body)
        detail.setdefault("success", False)
        detail["http_status"] = resp.status_code
        if not detail.get("error"):
            detail["error"] = detail.get("message") or f"HTTP {resp.status_code}"
        return detail
    return {
        "success": False,
        "error": f"HTTP {resp.status_code}: {resp.text[:200]}",
        "http_status": resp.status_code,
    }
