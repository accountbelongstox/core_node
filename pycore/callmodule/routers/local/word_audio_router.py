# -*- coding: utf-8 -*-
"""
Word pronunciation audio router — status + live test for the real-pronunciation chain.

Endpoints (prefix /api/local/word-audio):
  GET  /status  -> the 4 real sources (free_dictionary_api, wikimedia_commons,
                   cambridge_dictionary, forvo) with availability + requires-key
                   flags, whether a Forvo key is present, the tts_fallback flag,
                   the TTS engine priority list and the supported accents. No
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

Forvo presence is determined the SAME way word_audio_client checks it
(get_secret_key_indexed('FORVO_API_KEY')) WITHOUT any network call and WITHOUT
returning the key.

pycore rules honored: imports at file top (PYTHON_PYCORE.md §1.4), secrets only
via get_secret_key_indexed, logging only via ColorPrint, English-only strings.
"""

import base64
from typing import Any, Dict, Optional

import fastapi
from pydantic import BaseModel

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.secret_manager import get_secret_key_indexed
from pycore.pyutils.external_apis.word_audio_client import find_pronunciation
from pycore.pyutils.tts.tts_orchestrator import TTS_ENGINE_PRIORITY

router = fastapi.APIRouter(prefix="/api/local/word-audio", tags=["Local Processing - Word Audio"])


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
        "tts_fallback": True,
        # TTS fallback engine priority (accent-aware: edge/streamelements).
        "tts_engines": list(TTS_ENGINE_PRIORITY),
        "accents_supported": ["us", "uk"],
    }


# --------------------------------------------------------------------------- #
# request models                                                              #
# --------------------------------------------------------------------------- #
class WordAudioTestRequest(BaseModel):
    # Word to look up (required, non-empty).
    word: str
    # BCP-47-ish language code; defaults to English.
    lang: str = "en"
    # Preferred accent ("us"|"uk"); anything else means no preference.
    accent: Optional[str] = None


# --------------------------------------------------------------------------- #
# endpoints                                                                    #
# --------------------------------------------------------------------------- #
@router.get("/status")
def status():
    """The 4 real pronunciation sources + Forvo key presence (no network call)."""
    return _build_status()


@router.post("/test")
def test(req: WordAudioTestRequest):
    """Run a live pronunciation lookup and return base64 audio on a hit.

    Never raises — a blank word returns 400; a clean miss or any source error
    returns the ``{success:false, provider:null, ...}`` miss shape. The hit
    shape's ``accent`` is the accent ACTUALLY obtained ("us"|"uk"|"unknown"),
    which may differ from ``accent_requested`` when only a fallback existed.
    """
    word = (req.word or "").strip()
    if not word:
        raise fastapi.HTTPException(status_code=400, detail="word is required")
    lang = (req.lang or "en").strip() or "en"
    accent = (req.accent or "").strip().lower()
    accent_requested = accent if accent in ("us", "uk") else None

    try:
        result = find_pronunciation(word, lang, accent=accent_requested)
    except Exception as exc:  # noqa: BLE001 - find_pronunciation already guards; belt-and-suspenders
        ColorPrint.yellow(f"[WordAudio] test lookup failed ({exc})")
        result = None

    if not result:
        return {
            "success": False,
            "provider": None,
            "accent": None,
            "accent_requested": accent_requested,
            "message": (
                f"No real pronunciation found for '{word}' ({lang}); "
                "the TTS fallback would handle it."
            ),
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
