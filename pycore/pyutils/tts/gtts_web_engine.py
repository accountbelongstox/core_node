# -*- coding: utf-8 -*-
"""
Google Translate web TTS engine — free keyless HTTP endpoint (no gtts pip dep).

``GET https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=<tl>
&q=<text>`` (the same endpoint the gTTS library wraps) returns an MP3 stream
when sent with a normal browser User-Agent. Hard ~200-character cap — longer
text is rejected by the endpoint, so this engine returns False and the
orchestrator falls through. No accent promise: the voice/accent Google picks
is not selectable, so the orchestrator reports accent "unknown" for it.

Availability is a cheap local check (HTTP client importable) — no network
probe.
"""

import shlex
from pathlib import Path
from typing import Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_requests

GTTS_WEB_URL = "https://translate.google.com/translate_tts"
# (connect, read) timeouts (seconds).
_HTTP_TIMEOUT: Tuple[int, int] = (8, 30)
# The endpoint rejects long inputs; word/short-sentence use only.
_MAX_CHARS = 200
# A normal browser User-Agent — the endpoint answers 403 to bare clients.
_BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
# Two-letter language -> translate_tts "tl" code (fallback: the code itself).
_TL_BY_LANG = {
    "en": "en",
    "zh": "zh-CN",
    "ja": "ja",
    "ko": "ko",
    "es": "es",
    "fr": "fr",
}


def available() -> bool:
    """Cheap check: HTTP client importable (keyless endpoint, no network probe)."""
    try:
        return get_third_package_requests() is not None
    except Exception:  # noqa: BLE001 — engine simply unavailable
        return False


def describe_command(text: str, lang: str, output_mp3: Path) -> str:
    """Return a complete curl command equivalent to the synthesis request."""
    cleaned = (text or "").strip()
    code = (lang or "en").strip().lower() or "en"
    tl = _TL_BY_LANG.get(code, code)
    command = [
        "curl",
        "--fail",
        "--location",
        "--get",
        "--output",
        str(output_mp3),
        "--user-agent",
        _BROWSER_USER_AGENT,
        "--referer",
        "https://translate.google.com/",
        "--data-urlencode",
        "ie=UTF-8",
        "--data-urlencode",
        "client=tw-ob",
        "--data-urlencode",
        f"tl={tl}",
        "--data-urlencode",
        f"q={cleaned}",
        GTTS_WEB_URL,
    ]
    return shlex.join(command)


def synthesize(text: str, lang: str, output_mp3: Path) -> bool:
    """GET translate_tts and save the MP3. False on any failure or over-cap text."""
    cleaned = (text or "").strip()
    if not cleaned:
        return False
    if len(cleaned) > _MAX_CHARS:
        ColorPrint.gray(
            f"[gtts-web] text over {_MAX_CHARS}-char cap ({len(cleaned)}); skipping")
        return False
    code = (lang or "en").strip().lower() or "en"
    tl = _TL_BY_LANG.get(code, code)
    try:
        requests = get_third_package_requests()
        if requests is None:
            return False
        resp = requests.get(
            GTTS_WEB_URL,
            params={"ie": "UTF-8", "client": "tw-ob", "tl": tl, "q": cleaned},
            headers={
                "User-Agent": _BROWSER_USER_AGENT,
                "Referer": "https://translate.google.com/",
            },
            timeout=_HTTP_TIMEOUT,
        )
        if resp.status_code != 200 or not resp.content:
            ColorPrint.yellow(f"[gtts-web] HTTP {resp.status_code}; no audio")
            return False
        ctype = (resp.headers.get("Content-Type") or "").lower()
        if "audio" not in ctype and "octet-stream" not in ctype:
            # An error body (html) instead of the mp3 stream.
            ColorPrint.yellow(f"[gtts-web] unexpected content-type '{ctype}'")
            return False
        output_mp3 = Path(output_mp3)
        output_mp3.parent.mkdir(parents=True, exist_ok=True)
        output_mp3.write_bytes(resp.content)
        return output_mp3.stat().st_size > 0
    except Exception as e:  # noqa: BLE001
        ColorPrint.yellow(f"[gtts-web] synth failed: {e}")
        return False


__all__ = ["available", "describe_command", "synthesize"]
