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

Forvo / StreamElements presence is determined the SAME way their engines check
(get_secret_key_indexed from ``.secret_keys/.secret_ignore/``) WITHOUT any
network call and WITHOUT returning the key.

pycore rules honored: imports at file top (PYTHON_PYCORE.md §1.4), secrets only
via get_secret_key_indexed, logging only via ColorPrint, English-only strings.
"""

import base64
import threading
import traceback
from typing import Any, Dict, List, Optional

import fastapi
from pydantic import BaseModel

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.secret_manager import get_secret_key_indexed
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyutils.common.api_secrets import streamelements_key_present
from pycore.pyutils.external_apis.word_audio_client import find_pronunciation
from pycore.pyutils.tts.tts_orchestrator import TTS_ENGINE_PRIORITY, _priority
# Stored-first Laravel endpoint resolution - same plumbing the sentence-audio
# router uses to proxy laravel_main for the Puter.js word-audio batch surface.
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    get_laravel_endpoint_manager,
)

router = fastapi.APIRouter(prefix="/api/local/word-audio", tags=["Local Processing - Word Audio"])

# Larvel word-audio batch surface (proxied so the pycore-manager Queue Center
# bar edits laravel-owned data through pycore, matching the sentence-audio pattern).
_LARAVEL_MISSING_BATCH = "/api/app_qy_v1/word/audio/missing-batch"
_LARAVEL_UPLOAD = "/api/app_qy_v1/word/audio/upload"
_LARAVEL_FIX_WORD = "/api/app_qy_v1/word/fix-text"
_LARAVEL_BOOST = "/api/app_qy_v1/word/boost-priority"
# Youdao (朗文) public CDN: type=1 UK, type=2 US. No key needed.
_YOUDAO_URL = "http://dict.youdao.com/dictvoice"
_YOUDAO_TIMEOUT = 10

# In-memory cache for Youdao fetches. Keyed by "word:type".
# Avoids re-fetching the same word when the batch re-runs or auto-continues.
# Value: { audio_base64, mime, bytes } — evicted on process restart only.
_YOUDAO_CACHE: Dict[str, Dict[str, Any]] = {}
_YOUDAO_CACHE_LOCK = threading.Lock()
# 10 min - laravel batch endpoints can be slow / briefly unreachable; let the
# proxy wait instead of surfacing a read-timeout traceback on every tick.
_BATCH_TIMEOUT = 600


# --------------------------------------------------------------------------- #
# helpers                                                                      #
# --------------------------------------------------------------------------- #
def _forvo_key_present() -> bool:
    """True when a Forvo API key is configured (same check as word_audio_client).

    Never makes a network call and never returns the key itself.
    """
    return bool((get_secret_key_indexed("FORVO_API_KEY") or "").strip())


def _live_tts_priority() -> List[str]:
    """Runtime TTS engine priority (reflects Settings saves immediately).

    ``_priority()`` returns the module-level ``TTS_ENGINE_PRIORITY`` tuple that
    ``reload_tts_priority`` mutates at runtime; the imported constant is kept as
    a last-resort fallback so this endpoint never raises.
    """
    try:
        return list(_priority())
    except Exception:  # noqa: BLE001 - status endpoint must never break
        return list(TTS_ENGINE_PRIORITY)


def _build_status() -> Dict[str, Any]:
    """Assemble the /status payload: the 4 real sources + Forvo key presence
    + TTS engine priority names (no availability probe — that is the TTS
    status router's job) + supported accents."""
    forvo_present = _forvo_key_present()
    streamelements_present = streamelements_key_present()
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
        "streamelements_key_present": streamelements_present,
        "tts_fallback": True,
        # TTS fallback engine priority (local AI first; accent-aware: edge/streamelements).
        # Read at request time via _priority() so a Settings save (reload_tts_priority)
        # is reflected immediately; the imported constant is a last-resort fallback.
        "tts_engines": _live_tts_priority(),
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


# --------------------------------------------------------------------------- #
# Puter.js batch surface (proxy -> laravel)                                    #
# --------------------------------------------------------------------------- #

def _laravel_base() -> str:
    try:
        return get_laravel_endpoint_manager().resolve() or ""
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[WordAudio] laravel endpoint resolve failed: {exc}")
        return ""


@router.get("/missing-batch")
def missing_batch(limit: int = 1000, language: str = "en"):
    """GET /missing-batch?limit=1000&language=en -> laravel's missing-audio word
    list (has_audio=false, is_valid=true) for the browser-side Puter.js batch
    generator. pycore proxies laravel so the Queue Center bar talks only to pycore.
    Never raises - returns a graceful JSON on any error (no 500)."""
    try:
        base = _laravel_base()
        if not base:
            return {"success": False, "error": "laravel endpoint not configured", "words": []}
        requests = get_third_package_requests()
        resp = requests.get(
            base + _LARAVEL_MISSING_BATCH,
            params={"limit": max(1, min(int(limit), 100000)), "language": language or "en"},
            timeout=_BATCH_TIMEOUT,
        )
        if resp.status_code != 200:
            return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}", "words": []}
        try:
            return resp.json()
        except ValueError:
            return {"success": False, "error": "non-JSON response", "words": []}
    except Exception as exc:  # noqa: BLE001 - never 500; print full traceback
        ColorPrint.red(f"[WordAudio] /missing-batch failed: {exc}\n{traceback.format_exc()}")
        return {"success": False, "error": f"proxy error: {exc}", "words": []}


@router.post("/upload")
def upload_word_audio(payload: Dict[str, Any]):
    """POST /upload { md5, lang, audio_base64, provider?, accent?, cleaned_word? }
    -> proxy to laravel /word/audio/upload. The browser Puter.js generator posts
    each synthesized clip here; laravel validates + stores (fill-missing). Never
    raises - returns a graceful JSON on any error (no 500)."""
    try:
        base = _laravel_base()
        if not base:
            return {"success": False, "error": "laravel endpoint not configured"}
        requests = get_third_package_requests()
        resp = requests.post(base + _LARAVEL_UPLOAD, json=payload, timeout=_BATCH_TIMEOUT)
        if resp.status_code != 200:
            return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
        try:
            return resp.json()
        except ValueError:
            return {"success": False, "error": "non-JSON response"}
    except Exception as exc:  # noqa: BLE001 - never 500; print full traceback
        ColorPrint.red(f"[WordAudio] /upload failed: {exc}\n{traceback.format_exc()}")
        return {"success": False, "error": f"proxy error: {exc}"}


@router.get("/youdao")
def fetch_youdao(word: str, type: int = 2):
    """GET /youdao?word={word}&type={1|2}
    Proxy the Youdao (Longman CDN) audio endpoint for browser-side batch
    generation. type=1 -> UK, type=2 -> US. Cached in-process: the same
    word+type is never re-fetched within one pycore session. Returns
    { success, audio_base64, mime, cached? } or { success:false, error }.
    Never raises."""
    clean_word = (word or "").strip()
    if not clean_word:
        return {"success": False, "error": "word is required"}
    accent_type = 1 if int(type) == 1 else 2
    cache_key = f"{clean_word}:{accent_type}"
    with _YOUDAO_CACHE_LOCK:
        cached = _YOUDAO_CACHE.get(cache_key)
    if cached:
        return {**cached, "success": True, "cached": True}
    try:
        requests = get_third_package_requests()
        resp = requests.get(
            _YOUDAO_URL,
            params={"audio": clean_word, "type": accent_type},
            timeout=_YOUDAO_TIMEOUT,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
        )
        if resp.status_code != 200:
            return {"success": False, "error": f"HTTP {resp.status_code}"}
        raw = resp.content
        if not raw or len(raw) < 100:
            return {"success": False, "error": "empty or too-small audio response"}
        audio_b64 = base64.b64encode(raw).decode()
        ct = resp.headers.get("Content-Type", "audio/mpeg")
        entry: Dict[str, Any] = {"audio_base64": audio_b64, "mime": ct, "bytes": len(raw)}
        with _YOUDAO_CACHE_LOCK:
            _YOUDAO_CACHE[cache_key] = entry
        return {**entry, "success": True, "cached": False}
    except Exception as exc:  # noqa: BLE001 - never 500
        ColorPrint.yellow(f"[WordAudio] /youdao fetch failed for '{clean_word}': {exc}")
        return {"success": False, "error": str(exc)}


@router.post("/fix-word")
def fix_word_text(payload: Dict[str, Any]):
    """POST /fix-word { md5, lang, cleaned_word }
    Proxy to laravel /word/fix-text to update garbled word text (HTML/garbage
    replaced with '-') in the dictionary table. Never raises (no 500)."""
    try:
        base = _laravel_base()
        if not base:
            return {"success": False, "error": "laravel endpoint not configured"}
        requests = get_third_package_requests()
        resp = requests.post(base + _LARAVEL_FIX_WORD, json=payload, timeout=30)
        if resp.status_code not in (200, 400):
            return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
        try:
            return resp.json()
        except ValueError:
            return {"success": False, "error": "non-JSON response"}
    except Exception as exc:  # noqa: BLE001 - never 500
        ColorPrint.red(f"[WordAudio] /fix-word failed: {exc}\n{traceback.format_exc()}")
        return {"success": False, "error": f"proxy error: {exc}"}


@router.post("/boost-priority")
def boost_priority(payload: Dict[str, Any]):
    """POST /boost-priority { md5, lang }
    Bump a word to the front of the audio generation queue. Proxies to Laravel
    to increment tts_priority, then broadcasts 'word_audio_priority_boost' on
    the THREAD_BUS WS bus so the pycore-manager batch bar can reorder its
    in-memory pending list without a full re-fetch. Never raises (no 500)."""
    md5 = (payload.get("md5") or "").strip()
    lang = (payload.get("lang") or "").strip()
    if not md5 or not lang:
        return {"success": False, "error": "md5 and lang are required"}
    try:
        base = _laravel_base()
        if base:
            requests = get_third_package_requests()
            try:
                resp = requests.post(
                    base + _LARAVEL_BOOST,
                    json={"md5": md5, "lang": lang},
                    timeout=10,
                )
                laravel_ok = resp.status_code == 200
            except Exception as le:  # noqa: BLE001
                ColorPrint.yellow(f"[WordAudio] boost laravel call failed: {le}")
                laravel_ok = False
        else:
            laravel_ok = False
        # Broadcast regardless of laravel result: the batch bar reorders in-memory.
        try:
            THREAD_BUS.trigger_event("word_audio_priority_boost", {"md5": md5, "lang": lang})
        except Exception as be:  # noqa: BLE001
            ColorPrint.yellow(f"[WordAudio] boost THREAD_BUS broadcast failed: {be}")
        ColorPrint.blue(f"[WordAudio] priority boost: md5={md5} lang={lang} laravel_ok={laravel_ok}")
        return {"success": True, "laravel_updated": laravel_ok, "md5": md5, "lang": lang}
    except Exception as exc:  # noqa: BLE001 - never 500
        ColorPrint.red(f"[WordAudio] /boost-priority failed: {exc}\n{traceback.format_exc()}")
        return {"success": False, "error": f"proxy error: {exc}"}
