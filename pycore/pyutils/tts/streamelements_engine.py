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

import time
from pathlib import Path
from typing import Any, Optional

from pycore.pyfoundations.api_secrets import streamelements_api_key
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedValue
from pycore.pyutils.tts.tts_engine import TTSEngine, TTSSynthesisRequest
from pycore.pyutils.common.http_client import http_client
from pycore.pyutils.tts.tts_http import TTS_HTTP_TRANSPORT_ERRORS, content_type
from pycore.pyutils.tts.tts_reason_codes import TTS_REASON_AUTH_COOLDOWN, tts_reason

STREAMELEMENTS_SPEECH_URL = "https://api.streamelements.com/kappa/v2/speech"
# (connect, read) timeouts (seconds).
_HTTP_TIMEOUT_S = (8.0, 60.0)
_VOICE_BY_ACCENT = {"us": "Joanna", "uk": "Amy"}
_AUTH_COOLDOWN_S = 300.0
_AUTH_REJECTED = (401, 403)


class StreamElementsEngine(TTSEngine):
    boot_secrets_first = True

    def __init__(self, name: str) -> None:
        super().__init__(name)
        self._warned_missing_key = SerializedValue(False, "StreamElementsWarningState")
        self._cooldown_until = SerializedValue(0.0, "StreamElementsCooldownState")

    def in_cooldown(self) -> bool:
        return time.monotonic() < float(self._cooldown_until.get())

    def cooldown_remaining(self) -> float:
        return max(0.0, float(self._cooldown_until.get()) - time.monotonic())

    def secrets_ready(self) -> bool:
        return bool(streamelements_api_key())

    def disabled_reason(self) -> Optional[Any]:
        if self.in_cooldown():
            return tts_reason(TTS_REASON_AUTH_COOLDOWN, engine=self.name, seconds=round(self.cooldown_remaining()))
        return super().disabled_reason()

    def warn_if_disabled(self) -> bool:
        """Startup hint when the key is missing. True when disabled. Idempotent."""
        reason = self.unavailable_reason()
        if reason is None:
            return False
        if self._warned_missing_key.compare_and_set(False, True):
            ColorPrint.yellow(
                f"[streamelements] {reason}. Set STREAMELEMENTS_API_KEY via Special Software "
                "env manager (writes .secret_keys/.secret_ignore/STREAMELEMENTS_API_KEY_1); "
                "otherwise the orchestrator skips this engine."
            )
        return True

    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        """English only: accent "uk" selects Amy, anything else Joanna (US)."""
        self.clear_error()
        cleaned = (request.text or "").strip()
        if not cleaned or not (request.language or "en").strip().lower().startswith("en"):
            return False
        api_key = streamelements_api_key()
        if not api_key:
            self.warn_if_disabled()
            return False
        voice = _VOICE_BY_ACCENT.get((request.accent or "us").strip().lower(), "Joanna")
        try:
            resp = http_client.get(
                STREAMELEMENTS_SPEECH_URL,
                query={"voice": voice, "text": cleaned, "key": api_key},
                timeout=_HTTP_TIMEOUT_S,
            )
        except TTS_HTTP_TRANSPORT_ERRORS as exc:
            return self.fail(f"speech request failed: {type(exc).__name__}")
        if resp.status_code in _AUTH_REJECTED:
            self._cooldown_until.set(time.monotonic() + _AUTH_COOLDOWN_S)
            return self.fail(f"HTTP {resp.status_code}; auth rejected - cooldown {_AUTH_COOLDOWN_S:.0f}s")
        return self.write_audio_stream(resp.status_code, content_type(resp), resp.content, Path(request.output_path))


streamelements_engine = StreamElementsEngine("streamelements")


__all__ = ["STREAMELEMENTS_SPEECH_URL", "StreamElementsEngine", "streamelements_engine"]
