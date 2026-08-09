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
import tempfile
import traceback
from collections import OrderedDict
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyfoundations.secret_manager import get_secret_key_indexed
from pycore.pyfoundations.third_party.api import get_third_package_requests
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.api_secrets import streamelements_key_present
from pycore.pyutils.external_apis.word_audio_client import find_pronunciation
from pycore.pyutils.tts.tts_orchestrator import TTS_ENGINE_PRIORITY, _priority
from pycore.pyutils.tts.edge.client import edge_tts_client
# Stored-first Laravel endpoint resolution for worker-side task integration.
from pycore.pyutils.laravel.endpoint_manager import (
    laravel_endpoint_manager,
)
# Unified pycore->Laravel HTTP gateway (times + logs + records every call).
from pycore.pyutils.laravel.client import laravel_client

# Laravel word-audio surfaces retained for worker-side task integration.
_LARAVEL_MISSING_BATCH = "/api/app_qy_v1/word/audio/missing-batch"
_LARAVEL_UPLOAD = "/api/app_qy_v1/word/audio/upload"
_LARAVEL_FIX_WORD = "/api/app_qy_v1/word/fix-text"
_LARAVEL_WORD_MEDIA = "/api/app_qy_v1/word/{lang}/{word}/media"
# Youdao (朗文) public CDN: type=1 UK, type=2 US. No key needed.
_YOUDAO_URL = "http://dict.youdao.com/dictvoice"
_YOUDAO_TIMEOUT = 10

# In-memory LRU cache for Youdao fetches, capped at 500 entries. Keyed by
# "word:type". Avoids re-fetching the same word when the batch re-runs or
# auto-continues. Value: { audio_base64, mime, bytes } — a hit moves the entry
# to the end; the oldest entry is evicted beyond the cap.
_YOUDAO_CACHE_MAX = 500
_YOUDAO_CACHE_SIGNAL = 'callmodule.word_audio.youdao_cache'
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
        return laravel_endpoint_manager.resolve() or ""
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[WordAudio] laravel endpoint resolve failed: {exc}")
        return ""


def missing_batch(limit: int = 1000, language: str = "en"):
    """GET /missing-batch?limit=1000&language=en -> laravel's missing-audio word
    list (has_audio=false, is_valid=true) for the browser-side Puter.js batch
    generator. pycore proxies laravel so the Queue Center bar talks only to pycore.
    Never raises - returns a graceful JSON on any error (no 500)."""
    try:
        base = _laravel_base()
        if not base:
            return {"success": False, "error": "laravel endpoint not configured", "words": []}
        resp = laravel_client.get(
            _LARAVEL_MISSING_BATCH,
            base_url=base,
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


def word_audio_media(word: str, language: str = "en"):
    """Stream a Laravel-owned word audio file through pycore."""
    base = _laravel_base()
    clean_word = (word or "").strip()
    clean_language = (language or "en").strip() or "en"
    if not base or not clean_word:
        return {"success": False, "error": "Word audio unavailable"}
    media_path = _LARAVEL_WORD_MEDIA.format(
        lang=quote(clean_language, safe=""),
        word=quote(clean_word, safe=""),
    )
    metadata_response = laravel_client.get(media_path, base_url=base, timeout=30)
    if metadata_response.status_code != 200:
        return {"success": False, "error": "Word media lookup failed", "status_code": metadata_response.status_code}
    metadata = metadata_response.json()
    data = metadata.get("data") if isinstance(metadata, dict) else None
    audio_url = data.get("audio_url") if isinstance(data, dict) else metadata.get("url") if isinstance(metadata, dict) else None
    if not isinstance(audio_url, str) or not audio_url:
        return {"success": False, "error": "Word audio unavailable"}
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


def upload_word_audio(payload: Dict[str, Any]):
    """POST /upload { md5, lang, audio_base64, provider?, accent?, cleaned_word? }
    -> proxy to laravel /word/audio/upload. The browser Puter.js generator posts
    each synthesized clip here; laravel validates + stores (fill-missing). Never
    raises - returns a graceful JSON on any error (no 500)."""
    try:
        base = _laravel_base()
        if not base:
            return {"success": False, "error": "laravel endpoint not configured"}
        resp = laravel_client.post(_LARAVEL_UPLOAD, base_url=base, json=payload, timeout=_BATCH_TIMEOUT)
        if resp.status_code != 200:
            return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
        try:
            return resp.json()
        except ValueError:
            return {"success": False, "error": "non-JSON response"}
    except Exception as exc:  # noqa: BLE001 - never 500; print full traceback
        ColorPrint.red(f"[WordAudio] /upload failed: {exc}\n{traceback.format_exc()}")
        return {"success": False, "error": f"proxy error: {exc}"}


def fetch_youdao(word: str, type: int = 2):
    """GET /youdao?word={word}&type={1|2}
    Proxy the Youdao (Longman CDN) audio endpoint for browser-side batch
    generation. type=1 -> UK, type=2 -> US. Cached in-process (LRU, max 500
    entries): the same word+type is not re-fetched while it stays in the
    cache. Returns
    { success, audio_base64, mime, cached? } or { success:false, error }.
    Never raises."""
    clean_word = (word or "").strip()
    if not clean_word:
        return {"success": False, "error": "word is required"}
    accent_type = 1 if int(type) == 1 else 2
    cache_key = f"{clean_word}:{accent_type}"
    cache = OrderedDict(
        THREAD_BUS.get_signal(_YOUDAO_CACHE_SIGNAL, ()) or ()
    )
    cached = cache.get(cache_key)
    if cached:
        cache.move_to_end(cache_key)
        THREAD_BUS.signal(_YOUDAO_CACHE_SIGNAL, tuple(cache.items()))
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
        cache = OrderedDict(
            THREAD_BUS.get_signal(_YOUDAO_CACHE_SIGNAL, ()) or ()
        )
        cache[cache_key] = entry
        cache.move_to_end(cache_key)
        while len(cache) > _YOUDAO_CACHE_MAX:
            cache.popitem(last=False)
        THREAD_BUS.signal(_YOUDAO_CACHE_SIGNAL, tuple(cache.items()))
        return {**entry, "success": True, "cached": False}
    except Exception as exc:  # noqa: BLE001 - never 500
        ColorPrint.yellow(f"[WordAudio] /youdao fetch failed for '{clean_word}': {exc}")
        return {"success": False, "error": str(exc)}


# Default edge-tts voice per lang+accent combo.
_EDGE_VOICE_MAP: Dict[str, str] = {
    "en:us": "en-US-JennyNeural",
    "en:uk": "en-GB-SoniaNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
    "ja": "ja-JP-NanamiNeural",
    "ko": "ko-KR-SunHiNeural",
    "fr": "fr-FR-DeniseNeural",
    "de": "de-DE-KatjaNeural",
    "es": "es-ES-ElviraNeural",
}


def _pick_edge_voice(lang: str, accent: str) -> str:
    key = f"{lang}:{accent}" if lang == "en" else lang
    return _EDGE_VOICE_MAP.get(key, _EDGE_VOICE_MAP.get(lang, "en-US-JennyNeural"))







def edge_synth(word: str, lang: str = "en", accent=None):
    """POST /edge-synth {word, lang, accent?}
    Synthesize word audio via edge-tts and return base64 audio.
    Uses a temp file (edge-tts writes to path). Never raises — returns
    {success:false, error} on any failure."""
    word = (word or "").strip()
    if not word:
        return {"success": False, "error": "word is required"}
    lang = (lang or "en").strip() or "en"
    accent = (accent or "").strip().lower()
    accent = accent if accent in ("us", "uk") else "us"
    voice = _pick_edge_voice(lang, accent)
    tmp_path: Optional[Path] = None
    try:
        client = edge_tts_client
        with tempfile.NamedTemporaryFile(
            suffix=".mp3",
            delete=False,
            dir=str(TMP_DIR),
        ) as tmp:
            tmp_path = Path(tmp.name)
        ok = client.synthesize(word, voice, tmp_path)
        if not ok or not tmp_path.exists() or tmp_path.stat().st_size == 0:
            return {"success": False, "error": "edge-tts synthesis failed"}
        raw = tmp_path.read_bytes()
        audio_b64 = base64.b64encode(raw).decode()
        return {"success": True, "audio_base64": audio_b64, "accent": accent, "bytes": len(raw), "mime": "audio/mpeg"}
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[WordAudio] /edge-synth failed for '{word}': {exc}")
        return {"success": False, "error": str(exc)}
    finally:
        if tmp_path and tmp_path.exists():
            try:
                tmp_path.unlink()
            except Exception:  # noqa: BLE001
                pass


def fix_word_text(payload: Dict[str, Any]):
    """POST /fix-word { md5, lang, cleaned_word }
    Proxy to laravel /word/fix-text to update garbled word text (HTML/garbage
    replaced with '-') in the dictionary table. Never raises (no 500)."""
    try:
        base = _laravel_base()
        if not base:
            return {"success": False, "error": "laravel endpoint not configured"}
        resp = laravel_client.post(_LARAVEL_FIX_WORD, base_url=base, json=payload, timeout=30)
        if resp.status_code not in (200, 400):
            return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
        try:
            return resp.json()
        except ValueError:
            return {"success": False, "error": "non-JSON response"}
    except Exception as exc:  # noqa: BLE001 - never 500
        ColorPrint.red(f"[WordAudio] /fix-word failed: {exc}\n{traceback.format_exc()}")
        return {"success": False, "error": f"proxy error: {exc}"}
