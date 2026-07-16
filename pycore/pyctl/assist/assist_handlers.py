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
from pycore.pyutils.external_apis.movie_poster_client import (
    COVER_DELEGATED_TO_MCP_CHROME,
    POSTER_DELEGATED_TO_MCP_CHROME,
    parse_title_year,
)

from .assist_payload import (
    _looks_like_mp3,
    _speed_to_rate,
    _SXXEXX_LOOKS_RAW_RE,
)


def _tts_history_detail(text: str, language: str, rate: str,
                        engine: str, audio_bytes: int,
                        cached: bool = False,
                        synth_command: Optional[str] = None) -> Dict[str, Any]:
    """Build the task-history detail for a finished TTS item (includes cache path)."""
    audio_path = result_cache.get_bytes_path("tts", text, language, rate or "")
    detail: Dict[str, Any] = {
        "text": text,
        "language": language,
        "engine": engine,
        "mime": "audio/mpeg",
        "audio_bytes": audio_bytes,
    }
    if audio_path:
        detail["audio_path"] = audio_path
    if cached:
        detail["cached"] = True
        parts = "/".join((text, language, rate or ""))
        detail["synth_command"] = synth_command or (
            f'result_cache hit: tts/{parts} -> {audio_path or "?"}')
    elif synth_command:
        detail["synth_command"] = synth_command
    return detail


def _handle_cover(ctx, base: str, item: Dict[str, Any], result: Dict[str, Any]) -> None:
    """cover item — DISABLED in pycore.

    AI cover generation is delegated to apps/mcp-chrome (Google Images via task center).
    Release immediately so Laravel can re-lease to mcp-chrome.
    """
    item_id = item.get("id")
    payload = item.get("payload") or {}
    name = (payload.get("name") or "").strip()
    prompt = (payload.get("prompt") or "").strip()
    title = name or prompt[:60] or f"cover#{item_id}"
    detail = {
        "delegated_to": "apps/mcp-chrome",
        "laravel_item_id": item_id,
    }
    if name:
        detail["name"] = name
    if prompt:
        detail["prompt"] = prompt[:200]

    ColorPrint.blue(f"[AssistWorker] cover#{item_id} deferred — {COVER_DELEGATED_TO_MCP_CHROME}")
    ctx._release(base, "cover", item_id, COVER_DELEGATED_TO_MCP_CHROME, result)
    ctx._record_history("cover", title, False, detail, error=COVER_DELEGATED_TO_MCP_CHROME)

    # --- Legacy AI cover generation (disabled) ---
    # out = ctx._image_generator(prompt=prompt, size=size, source="assist-cover")
    # cached = result_cache.get_bytes("cover", prompt, size or "")


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
        ctx._record_history(
            "tts", title, True,
            _tts_history_detail(text, language, rate or "",
                                meta.get("engine") or "cache", len(data),
                                cached=True),
        )
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
        ctx._record_history(
            "tts", title, True,
            _tts_history_detail(text, language, rate or "", engine, len(audio),
                                synth_command=synth.get("synth_command")),
        )
    finally:
        try:
            tmp.unlink()
        except OSError:
            pass


def _handle_poster(ctx, base: str, item: Dict[str, Any], result: Dict[str, Any]) -> None:
    """poster item — DISABLED in pycore.

    Poster search is delegated to apps/mcp-chrome (Google Images via the extension
    task center). Release immediately so Laravel can re-lease to mcp-chrome.
    """
    item_id = item.get("id")
    payload = item.get("payload") or {}
    media_type = (payload.get("media_type") or item.get("media_type") or "").strip()
    title = (payload.get("title") or "").strip()

    year = payload.get("year")
    try:
        year = int(year) if year not in (None, "") else None
    except (TypeError, ValueError):
        year = None

    query_title = title
    if title:
        looks_raw = ("." in title or "_" in title
                     or bool(_SXXEXX_LOOKS_RAW_RE.search(title)))
        if looks_raw:
            parsed_title, parsed_year = parse_title_year(title)
            if parsed_title:
                query_title = parsed_title
            if year is None and parsed_year is not None:
                year = parsed_year

    hist_title = f"{query_title}{f' ({year})' if year else ''}" if query_title else f"poster#{item_id}"
    detail = {
        "media_type": media_type,
        "year": year,
        "delegated_to": "apps/mcp-chrome",
        "laravel_item_id": item_id,
    }
    if title:
        detail["raw_title"] = title

    ColorPrint.blue(f"[AssistWorker] poster#{item_id} deferred — {POSTER_DELEGATED_TO_MCP_CHROME}")
    ctx._release(base, "poster", item_id, POSTER_DELEGATED_TO_MCP_CHROME, result,
                 extra={"media_type": media_type})
    ctx._record_history("poster", hist_title, False, detail, error=POSTER_DELEGATED_TO_MCP_CHROME)

    # --- Legacy TMDB/OMDB fetch (disabled; retained for reference) ---
    # hit = find_poster(query_title, year=year)
    # cached = result_cache.get_bytes("poster", query_title, year or "")
