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

from pycore.pyfoundations.network_constants import HTTP_USER_AGENT
from pycore.pyutils.tts.engine_policy import truncate_command_text
from pycore.pyutils.tts.tts_engine import TTSEngine, TTSSynthesisRequest
from pycore.pyutils.common.http_client import http_client
from pycore.pyutils.tts.tts_http import TTS_HTTP_TRANSPORT_ERRORS, content_type

GTTS_WEB_URL = "https://translate.google.com/translate_tts"
_REFERER = "https://translate.google.com/"
# (connect, read) timeouts (seconds).
_HTTP_TIMEOUT_S = (8.0, 30.0)
# The endpoint rejects long inputs; word/short-sentence use only.
_MAX_CHARS = 200
# Two-letter language -> translate_tts "tl" code (fallback: the code itself).
_TL_BY_LANG = {
    "en": "en",
    "zh": "zh-CN",
    "ja": "ja",
    "ko": "ko",
    "es": "es",
    "fr": "fr",
}


def _tl(lang: str) -> str:
    code = (lang or "en").strip().lower() or "en"
    return _TL_BY_LANG.get(code, code)


class GttsWebEngine(TTSEngine):
    def describe_command(self, text: str, lang: str, output: Path) -> str:
        """A complete curl command equivalent to the synthesis request."""
        return shlex.join([
            "curl", "--fail", "--location", "--get", "--output", str(output),
            "--user-agent", HTTP_USER_AGENT, "--referer", _REFERER,
            "--data-urlencode", "ie=UTF-8",
            "--data-urlencode", "client=tw-ob",
            "--data-urlencode", f"tl={_tl(lang)}",
            "--data-urlencode", f"q={truncate_command_text((text or '').strip())}",
            GTTS_WEB_URL,
        ])

    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        """GET translate_tts and save the MP3; over-cap text is refused."""
        self.clear_error()
        cleaned = (request.text or "").strip()
        if not cleaned:
            return False
        if len(cleaned) > _MAX_CHARS:
            self._last_synth_error.set(f"text over {_MAX_CHARS}-char cap ({len(cleaned)})")
            return False
        try:
            resp = http_client.get(
                GTTS_WEB_URL,
                query={"ie": "UTF-8", "client": "tw-ob", "tl": _tl(request.language), "q": cleaned},
                headers={"User-Agent": HTTP_USER_AGENT, "Referer": _REFERER},
                timeout=_HTTP_TIMEOUT_S,
            )
        except TTS_HTTP_TRANSPORT_ERRORS as exc:
            return self.fail(f"GET {GTTS_WEB_URL} failed: {exc}")
        return self.write_audio_stream(resp.status_code, content_type(resp), resp.content, Path(request.output_path))


gtts_web_engine = GttsWebEngine("gtts_web")


__all__ = ["GTTS_WEB_URL", "GttsWebEngine", "gtts_web_engine"]
