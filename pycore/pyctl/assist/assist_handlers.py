# -*- coding: utf-8 -*-
"""
Assist-Laravel item handlers (cover / tts / poster).

Extracted verbatim (behavior-preserving) from the former assist_worker.py
monolith. Each handler is a module-level function taking a narrow ``ctx`` -
the AssistWorker instance - and calling ONLY its encapsulated collaborators:

    ctx.claimer              stable claimer id (str)
    ctx._image_generator     injected pyctl.ai.generate_image callable (cover)
    ctx._submit(base, body, result)        POST /assist/submit
    ctx._release(base, type, id, err, result, extra=None)  POST /assist/release
    ctx._record_history(capability, title, ok, detail=None, error=None)

Handlers NEVER reach into the worker's locks (_thread_lock / _cycle_lock /
_state_lock) or the parallel TTS-track thread - submit/release/record_history
own their own locking. This keeps the singleton + dual-lock state isolated in
assist_worker.AssistWorker (see RISK note there).
"""

import base64
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common import result_cache
from pycore.pyutils.tts import tts_orchestrator
from pycore.pyutils.external_apis.movie_poster_client import find_poster, parse_title_year

from .assist_payload import (
    _looks_like_mp3,
    _size_to_aspect,
    _speed_to_rate,
    _SXXEXX_LOOKS_RAW_RE,
)


def _handle_cover(ctx, base: str, item: Dict[str, Any], result: Dict[str, Any]) -> None:
    """cover item: payload {name, prompt, size:'WxH', filename} -> image."""
    item_id = item.get("id")
    payload = item.get("payload") or {}
    if ctx._image_generator is None:
        ctx._release(base, "cover", item_id,
                     "image generator not wired (app layer did not configure pyctl.ai)",
                     result)
        return
    prompt = (payload.get("prompt") or "").strip()
    name = (payload.get("name") or "").strip()
    if not prompt:
        if not name:
            ctx._release(base, "cover", item_id, "empty cover prompt", result)
            ctx._record_history("cover", name or "cover", False, error="empty cover prompt")
            return
        prompt = f"Book cover illustration for '{name}'"
    size = _size_to_aspect(payload.get("size"))
    title = name or prompt[:60]

    # CACHE: an identical cover (prompt + size) is reused instead of re-paying
    # for AI image generation - the "same task -> use cache" goal.
    cached = result_cache.get_bytes("cover", prompt, size or "")
    if cached is not None:
        data, meta = cached
        ctx._submit(base, {
            "type": "cover", "id": item_id,
            "image_base64": base64.b64encode(data).decode("ascii"),
            "mime": meta.get("mime") or "image/png", "claimer": ctx.claimer,
            "provider": (meta.get("provider") or "cache"), "model": meta.get("model") or "",
            "latency_ms": 0,
        }, result)
        ColorPrint.green(f"[AssistWorker] cover#{item_id} cache hit ({title})")
        ctx._record_history("cover", title, True, {"cached": True, "provider": meta.get("provider")})
        return

    out = ctx._image_generator(prompt=prompt, size=size, source="assist-cover")
    if out.get("success") and out.get("image_base64"):
        # Store the raw bytes so the next identical claim is a cache hit.
        try:
            result_cache.set_bytes(
                "cover", base64.b64decode(out["image_base64"]), prompt, size or "",
                meta={"mime": out.get("mime") or "image/png",
                      "provider": out.get("provider") or "", "model": out.get("model") or ""})
        except Exception:  # noqa: BLE001 - caching is best-effort
            pass
        ctx._submit(base, {
            "type": "cover",
            "id": item_id,
            "image_base64": out["image_base64"],
            "mime": out.get("mime") or "image/png",
            "claimer": ctx.claimer,
            # Provenance for the detailed cover record on Laravel.
            "provider": out.get("provider") or "",
            "model": out.get("model") or "",
            "latency_ms": int(out["latency_ms"]) if out.get("latency_ms") is not None else None,
        }, result)
        ctx._record_history("cover", title, True,
                            {"provider": out.get("provider"), "model": out.get("model")})
    else:
        ctx._release(base, "cover", item_id,
                     out.get("error") or "image generation failed", result)
        ctx._record_history("cover", title, False, error=out.get("error") or "image generation failed")


def _handle_tts(ctx, base: str, item: Dict[str, Any], result: Dict[str, Any]) -> None:
    """tts item: payload {text, language, voice_type, speed,
    audio_relative_path} -> MP3 via the TTS orchestrator.

    The Laravel contract requires MP3 (>=100 bytes). The orchestrator's
    engines all target an .mp3 output, but a misbehaving engine that emits
    WAV/empty bytes is caught by the magic-byte sniff and RELEASED with a
    clear 'produced non-mp3' error - never submitted as invalid audio.
    (voice_type is informational: the orchestrator picks its voice from
    ``language``; the engine that produced the audio is reported back as
    ``voice``.)
    """
    item_id = item.get("id")
    payload = item.get("payload") or {}
    text = (payload.get("text") or "").strip()
    if not text:
        ctx._release(base, "tts", item_id, "empty tts text", result)
        ctx._record_history("tts", "", False, error="empty tts text")
        return
    language = (payload.get("language") or "en").strip() or "en"
    rate = _speed_to_rate(payload.get("speed"))
    title = text[:60]

    # CACHE: identical audio (text + language + rate) is reused instead of
    # re-synthesizing - the "same task -> use cache" goal. The key folds in
    # voice/speed (rate), which the legacy TTS DB cache omitted.
    cached = result_cache.get_bytes("tts", text, language, rate or "")
    if cached is not None:
        data, meta = cached
        ctx._submit(base, {
            "type": "tts", "id": item_id,
            "audio_base64": base64.b64encode(data).decode("ascii"),
            "mime": "audio/mpeg", "voice": meta.get("engine") or "cache",
            "engine": meta.get("engine") or "cache", "latency_ms": 0,
            "claimer": ctx.claimer,
        }, result)
        ColorPrint.green(f"[AssistWorker] tts#{item_id} cache hit ({title})")
        ctx._record_history("tts", title, True, {"cached": True, "engine": meta.get("engine")})
        return

    fd, tmp_path = tempfile.mkstemp(prefix="assist_tts_", suffix=".mp3")
    os.close(fd)
    tmp = Path(tmp_path)
    try:
        synth = tts_orchestrator.synthesize(text, language, tmp, rate=rate)
        if not synth.get("success"):
            ctx._release(base, "tts", item_id,
                         synth.get("error") or "tts synthesis failed", result)
            ctx._record_history("tts", title, False,
                                error=synth.get("error") or "tts synthesis failed")
            return
        engine = synth.get("engine") or "unknown"
        audio = tmp.read_bytes() if tmp.exists() else b""
        if len(audio) < 100 or not _looks_like_mp3(audio):
            ctx._release(
                base, "tts", item_id,
                f"engine '{engine}' produced non-mp3 audio "
                f"({len(audio)} bytes) - not submitting invalid bytes", result)
            ctx._record_history("tts", title, False,
                                error=f"engine '{engine}' produced non-mp3 audio")
            return
        # Store for reuse before submitting.
        try:
            result_cache.set_bytes("tts", audio, text, language, rate or "",
                                   meta={"engine": engine, "language": language})
        except Exception:  # noqa: BLE001 - caching is best-effort
            pass
        ctx._submit(base, {
            "type": "tts",
            "id": item_id,
            "audio_base64": base64.b64encode(audio).decode("ascii"),
            "mime": "audio/mpeg",
            "voice": engine,
            # Provenance: the real engine that synthesized this audio, folded
            # into the tts_provider record on Laravel.
            "engine": engine,
            "latency_ms": int(synth["latency_ms"]) if synth.get("latency_ms") is not None else None,
            "claimer": ctx.claimer,
        }, result)
        ctx._record_history("tts", title, True, {"engine": engine, "language": language})
    finally:
        try:
            tmp.unlink()
        except OSError:
            pass


def _handle_poster(ctx, base: str, item: Dict[str, Any], result: Dict[str, Any]) -> None:
    """poster item: payload {title, year:int|null, filename} -> movie/TV
    poster bytes via the movie_poster_client (TMDB -> OMDB; CJK titles are
    translated to English internally).

    The Laravel title may already be clean; only run parse_title_year when
    the title still looks like a raw filename (contains scene tokens / an
    extension). The year comes from the payload when present, else from the
    parse. ``media_type`` ('book'|'subtitle') is carried back on BOTH the
    submit and the release so Laravel can route the result.
    """
    item_id = item.get("id")
    payload = item.get("payload") or {}
    media_type = (payload.get("media_type") or item.get("media_type") or "").strip()
    title = (payload.get("title") or "").strip()
    if not title:
        ctx._release(base, "poster", item_id,
                     "empty poster title", result,
                     extra={"media_type": media_type})
        return

    # Year: prefer the payload's explicit year; else parse from the title.
    year = payload.get("year")
    try:
        year = int(year) if year not in (None, "") else None
    except (TypeError, ValueError):
        year = None

    # Only re-parse when the title still looks like a raw filename (scene
    # separators, a known media/doc extension, or season/episode markers);
    # an already-clean Laravel title is passed straight through.
    query_title = title
    looks_raw = ("." in title or "_" in title
                 or bool(_SXXEXX_LOOKS_RAW_RE.search(title)))
    if looks_raw:
        parsed_title, parsed_year = parse_title_year(title)
        if parsed_title:
            query_title = parsed_title
        if year is None and parsed_year is not None:
            year = parsed_year

    hist_title = f"{query_title}{f' ({year})' if year else ''}"

    # CACHE: a poster for the same title+year is reused instead of re-querying
    # TMDB/OMDB (and re-downloading the image).
    cached = result_cache.get_bytes("poster", query_title, year or "")
    if cached is not None:
        data, meta = cached
        ctx._submit(base, {
            "type": "poster", "media_type": media_type, "id": item_id,
            "image_base64": base64.b64encode(data).decode("ascii"),
            "mime": meta.get("mime") or "image/jpeg", "claimer": ctx.claimer,
            "provider": (meta.get("provider") or "cache"),
            "source_id": meta.get("source_id") or "",
        }, result)
        ColorPrint.green(f"[AssistWorker] poster#{item_id} cache hit ({hist_title})")
        ctx._record_history("poster", hist_title, True, {"cached": True, "media_type": media_type})
        return

    hit = find_poster(query_title, year=year)
    if hit and hit.get("image_base64"):
        try:
            result_cache.set_bytes(
                "poster", base64.b64decode(hit["image_base64"]), query_title, year or "",
                meta={"mime": hit.get("mime") or "image/jpeg",
                      "provider": hit.get("provider") or "", "source_id": hit.get("source_id") or ""})
        except Exception:  # noqa: BLE001 - caching is best-effort
            pass
        ctx._submit(base, {
            "type": "poster",
            "media_type": media_type,
            "id": item_id,
            "image_base64": hit["image_base64"],
            "mime": hit.get("mime") or "image/jpeg",
            "claimer": ctx.claimer,
            # Provenance for the poster record on Laravel.
            "provider": hit.get("provider") or "",
            "source_id": hit.get("source_id") or "",
        }, result)
        ctx._record_history("poster", hist_title, True,
                            {"provider": hit.get("provider"), "media_type": media_type})
    else:
        ctx._release(base, "poster", item_id,
                     "poster not found (TMDB/OMDB)", result,
                     extra={"media_type": media_type})
        ctx._record_history("poster", hist_title, False,
                            {"media_type": media_type}, error="poster not found (TMDB/OMDB)")
