# -*- coding: utf-8 -*-
"""
StreamElements TTS engine — free keyless HTTP endpoint (Amazon Polly voices).

``GET https://api.streamelements.com/kappa/v2/speech?voice=<voice>&text=<text>``
returns an MP3 stream directly — no SDK, no key, no pip dependency (plain HTTP
via get_third_package_requests). English only, accent-aware:
accent "us" -> Joanna, "uk" -> Amy; non-English text returns False so the
orchestrator falls through to the next engine.

Availability is a cheap local check (HTTP client importable) — no network
probe; a failed request simply returns False and the orchestrator falls
through.
"""

from pathlib import Path
from typing import Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests

STREAMELEMENTS_SPEECH_URL = "https://api.streamelements.com/kappa/v2/speech"
# (connect, read) timeouts (seconds).
_HTTP_TIMEOUT: Tuple[int, int] = (8, 60)
_VOICE_BY_ACCENT = {"us": "Joanna", "uk": "Amy"}


def available() -> bool:
    """Cheap check: HTTP client importable (keyless endpoint, no network probe)."""
    try:
        return get_third_package_requests() is not None
    except Exception:  # noqa: BLE001 — engine simply unavailable
        return False


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
    voice = _VOICE_BY_ACCENT.get((accent or "us").strip().lower(), "Joanna")
    try:
        requests = get_third_package_requests()
        if requests is None:
            return False
        resp = requests.get(
            STREAMELEMENTS_SPEECH_URL,
            params={"voice": voice, "text": cleaned},
            timeout=_HTTP_TIMEOUT,
        )
        if resp.status_code != 200 or not resp.content:
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


__all__ = ["available", "synthesize"]
