# -*- coding: utf-8 -*-
"""
Sentence-audio synthesis cache — content-addressed dedup for the SENTENCE TTS path.

A sentence request whose synthesis inputs are identical to a previous one returns
the already-synthesized file instead of paying for another (often GPU-heavy) synth.
The cache is keyed by a sha256 of the STABLE tuple of everything that changes the
produced audio:

    key = sha256( text | lang | speaker | instruct | engine | format | model_id )

Cache directory (CENTRAL path map — never hardcode a disk path):

    map_web_path('cache') / 'pycore' / 'tts_sentence_cache'
    (Windows: D:\\www\\cache\\pycore\\tts_sentence_cache,
     Linux:   <web-base>/www/cache/pycore/tts_sentence_cache)

Files are named ``<key>.<ext>`` (e.g. ``<hash>.mp3`` / ``<hash>.wav``). Writes are
atomic (temp file + ``os.replace``) so concurrent readers only ever observe a
fully-written file — the cache is safe for parallel worker/assist/router callers.
It is idempotent: storing an already-present key is a no-op that returns the path.

Wired into ``tts_orchestrator.synthesize()`` at the sentence entry (not the low-level
engine), so every sentence entry point (tts_sentence_worker, assist sentence_audio
lane, sentence_audio_router, sentence_audio_auto) shares one cache.
See development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md.
"""

import hashlib
import os
import tempfile
from pathlib import Path
from typing import Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import map_web_path

# Central cache root sub-path (under map_web_path('cache')).
_CACHE_SUBPATH = ("pycore", "tts_sentence_cache")
# Field separator that cannot appear in normal text (unit separator).
_KEY_SEP = "\x1f"


def cache_dir() -> Path:
    """Resolve (and create) the sentence-audio cache directory from the central
    path map. NEVER hardcodes a disk path — always via ``map_web_path('cache')``."""
    directory = map_web_path("cache")
    for segment in _CACHE_SUBPATH:
        directory = directory / segment
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _norm_ext(ext: Optional[str]) -> str:
    """Normalize an extension to a bare lower-case token ('mp3', 'wav')."""
    value = (ext or "mp3").strip().lower().lstrip(".")
    return value or "mp3"


def make_key(
    text: str,
    lang: Optional[str],
    speaker: Optional[str],
    instruct: Optional[str],
    engine: Optional[str],
    fmt: Optional[str],
    model_id: Optional[str],
) -> str:
    """sha256 hex of the stable synthesis-input tuple. Any field that changes the
    produced audio is part of the key, so distinct requests never collide and
    identical requests always map to the same file."""
    parts = (
        (text or "").strip(),
        (lang or "en").strip().lower(),
        (speaker or "").strip(),
        (instruct or "").strip(),
        (engine or "").strip().lower(),
        _norm_ext(fmt),
        (model_id or "").strip(),
    )
    raw = _KEY_SEP.join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def cached_path(key: str, ext: str) -> Optional[Path]:
    """Return the cached file for ``key`` if it exists and is non-empty, else None."""
    if not key:
        return None
    path = cache_dir() / f"{key}.{_norm_ext(ext)}"
    try:
        if path.exists() and path.stat().st_size > 0:
            return path
    except OSError:
        return None
    return None


def store(key: str, ext: str, data_bytes: bytes) -> Path:
    """Persist ``data_bytes`` under ``<key>.<ext>`` and return the path (idempotent).

    Atomic (temp file + ``os.replace``) so concurrent readers never see a partial
    file. Re-storing an already-present, non-empty key is a no-op."""
    extension = _norm_ext(ext)
    directory = cache_dir()
    final = directory / f"{key}.{extension}"
    try:
        if final.exists() and final.stat().st_size > 0:
            return final
    except OSError:
        pass
    fd, tmp = tempfile.mkstemp(dir=str(directory), suffix=f".{extension}.tmp")
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data_bytes or b"")
        os.replace(tmp, final)
    except OSError:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
    return final


def lookup_or_none(
    text: str,
    lang: Optional[str] = None,
    speaker: Optional[str] = None,
    instruct: Optional[str] = None,
    engine: Optional[str] = None,
    fmt: Optional[str] = None,
    model_id: Optional[str] = None,
) -> Optional[Path]:
    """Convenience: build the key from the synthesis params and return the cached
    file (or None on miss). No synthesis is performed here."""
    key = make_key(text, lang, speaker, instruct, engine, fmt, model_id)
    return cached_path(key, fmt or "mp3")


def store_result(
    text: str,
    lang: Optional[str],
    speaker: Optional[str],
    instruct: Optional[str],
    engine: Optional[str],
    fmt: Optional[str],
    model_id: Optional[str],
    data_bytes: bytes,
) -> Path:
    """Convenience: build the key from the synthesis params and store the bytes."""
    key = make_key(text, lang, speaker, instruct, engine, fmt, model_id)
    return store(key, fmt or "mp3", data_bytes)


__all__ = [
    "cache_dir",
    "make_key",
    "cached_path",
    "store",
    "lookup_or_none",
    "store_result",
]
