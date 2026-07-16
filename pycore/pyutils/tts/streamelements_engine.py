# -*- coding: utf-8 -*-
"""
StreamElements TTS engine — Amazon Polly voices via HTTP.

``GET https://api.streamelements.com/kappa/v2/speech?voice=<voice>&text=<text>&key=<key>``
returns an MP3 stream. Requires ``STREAMELEMENTS_API_KEY`` in
``.secret_keys/.secret_ignore/`` (indexed ``_1.._5`` then bare), read via
``get_secret_key_indexed`` — same path as ``FORVO_API_KEY``. Without a key the
engine is disabled at startup (``available()`` False) so the orchestrator never
pays a 401 round-trip.

English only, accent-aware: accent "us" -> Joanna, "uk" -> Amy; non-English
text returns False so the orchestrator falls through to the next engine.
"""

from pathlib import Path
from typing import Optional, Tuple
import time

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyutils.common.api_secrets import streamelements_api_key

STREAMELEMENTS_SPEECH_URL = "https://api.streamelements.com/kappa/v2/speech"
# (connect, read) timeouts (seconds).
_HTTP_TIMEOUT: Tuple[int, int] = (8, 60)
_VOICE_BY_ACCENT = {"us": "Joanna", "uk": "Amy"}
_WARNED_MISSING_KEY = False
_AUTH_COOLDOWN_S = 300.0
_cooldown_until = 0.0


def in_cooldown() -> bool:
    return time.monotonic() < _cooldown_until


def cooldown_remaining() -> float:
    rem = _cooldown_until - time.monotonic()
    return max(0.0, rem)


def _set_auth_cooldown() -> None:
    global _cooldown_until
    _cooldown_until = time.monotonic() + _AUTH_COOLDOWN_S


def _key() -> str:
    return (streamelements_api_key() or "").strip()


def available() -> bool:
    """HTTP client importable AND STREAMELEMENTS_API_KEY configured (no network)."""
    if in_cooldown():
        return False
    if not _key():
        return False
    try:
        return get_third_package_requests() is not None
    except Exception:  # noqa: BLE001 — engine simply unavailable
        return False


def disabled_reason() -> Optional[str]:
    """Human-readable why this engine is off; None when usable."""
    if in_cooldown():
        rem = cooldown_remaining()
        return f"auth failure cooldown ({rem:.0f}s remaining)"
    if not _key():
        return "STREAMELEMENTS_API_KEY not in .secret_keys — engine disabled"
    try:
        if get_third_package_requests() is None:
            return "HTTP client (requests) unavailable"
    except Exception:  # noqa: BLE001
        return "HTTP client (requests) unavailable"
    return None


def warn_if_disabled() -> bool:
    """Startup hint when the key is missing. Returns True when disabled. Idempotent."""
    global _WARNED_MISSING_KEY
    reason = disabled_reason()
    if reason is None:
        return False
    if not _WARNED_MISSING_KEY:
        _WARNED_MISSING_KEY = True
        ColorPrint.yellow(
            f"[streamelements] {reason}. "
            "Set STREAMELEMENTS_API_KEY via Special Software env manager "
            "(writes .secret_keys/.secret_ignore/STREAMELEMENTS_API_KEY_1); "
            "otherwise the orchestrator skips this engine."
        )
    return True


def synthesize(text: str, lang: str, output_mp3: Path, accent: Optional[str] = None) -> bool:
    """GET the speech endpoint and save the MP3. False on any failure.

    ``accent`` "uk" selects Amy, anything else Joanna (US). Non-English
    ``lang`` returns False (this endpoint only exposes English voices here).
    """
    cleaned = (text or "").strip()
    if not cleaned:
        return False
    if not (lang or "en").strip().lower().startswith("en"):
        return False
    api_key = _key()
    if not api_key:
        warn_if_disabled()
        return False
    voice = _VOICE_BY_ACCENT.get((accent or "us").strip().lower(), "Joanna")
    try:
        requests = get_third_package_requests()
    except Exception:  # noqa: BLE001
        return False
    if requests is None:
        return False
    try:
        resp = requests.get(
            STREAMELEMENTS_SPEECH_URL,
            params={"voice": voice, "text": cleaned, "key": api_key},
            timeout=_HTTP_TIMEOUT,
        )
        if resp.status_code != 200 or not resp.content:
            if resp.status_code in (401, 403):
                _set_auth_cooldown()
                ColorPrint.yellow(
                    f"[streamelements] HTTP {resp.status_code}; auth rejected — "
                    f"cooldown {_AUTH_COOLDOWN_S:.0f}s"
                )
            else:
                ColorPrint.yellow(f"[streamelements] HTTP {resp.status_code}; no audio")
            return False
        ctype = (resp.headers.get("Content-Type") or "").lower()
        if "audio" not in ctype and "octet-stream" not in ctype:
            # An error body (json/html) instead of the mp3 stream.
            ColorPrint.yellow(f"[streamelements] unexpected content-type '{ctype}'")
            return False
        output_mp3 = Path(output_mp3)
        output_mp3.parent.mkdir(parents=True, exist_ok=True)
        output_mp3.write_bytes(resp.content)
        return output_mp3.stat().st_size > 0
    except Exception as e:  # noqa: BLE001
        ColorPrint.yellow(f"[streamelements] synth failed: {e}")
        return False


__all__ = [
    "available",
    "synthesize",
    "disabled_reason",
    "warn_if_disabled",
    "in_cooldown",
    "cooldown_remaining",
]
