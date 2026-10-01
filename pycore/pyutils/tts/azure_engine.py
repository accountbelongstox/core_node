# -*- coding: utf-8 -*-
"""
Azure Speech cloud TTS engine — the orchestrator's API fallback.

Used ONLY when every higher-priority engine (gptsovits / melotts / sherpa /
edge / streamelements / gtts_web) is unavailable or fails: see tts_orchestrator
priority (azure is last). Azure's free
F0 tier gives ~0.5M neural characters/month and throttles with HTTP 429 once
exhausted (it never auto-charges), which the orchestrator treats as a normal
engine failure and reports upward.

Secrets (via the standard indexed secret loader, env-overridable):
  AZURE_SPEECH_KEY      - F0/S0 resource key (indexed _1.._5 then bare)
  AZURE_SPEECH_REGION   - resource region, e.g. "eastus"  (default: eastus)

Writes MP3 directly (Audio24Khz48KBitRateMonoMp3) — no ffmpeg needed. This is the
first of the pluggable free-cloud SDKs; add google_tts_engine.py / polly_engine.py
the same way and append to the orchestrator priority tuple.
"""

from pathlib import Path
from typing import Any, Optional
from xml.sax.saxutils import escape

from pycore.pyfoundations.api_secrets import azure_speech_key, azure_speech_region
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_speechsdk
from pycore.pyutils.tts.edge.config import TTSConfig
from pycore.pyutils.tts.engine_policy import tts_locale
from pycore.pyutils.common.azure_speech_quota_state import (
    clear_tts_quota_issue,
    is_tts_quota_blocked,
    mark_tts_quota_exceeded,
)
from pycore.pyutils.tts.tts_engine import TTSEngine, TTSSynthesisRequest
from pycore.pyutils.tts.tts_reason_codes import TTS_REASON_QUOTA_EXHAUSTED, tts_reason

# The Speech SDK signals transport and auth failures with these exception types.
# Cancellation details that mean the free-tier quota is used up (F0 throttles
# with 429 / quota text and never auto-charges).
_QUOTA_MARKERS = ("quota", "exceed", "usage limit", "429", "too many requests")
_SDK_ERRORS = (RuntimeError, OSError, ValueError)


def _voice(lang: Optional[str]) -> str:
    return TTSConfig.resolve_voice(tts_locale(lang), gender="female")


def _ssml(text: str, lang: Optional[str], rate: Optional[str]) -> str:
    """Wrap text in SSML so a percent or named rate maps to prosody@rate."""
    inner = escape(text)
    if rate:
        inner = f'<prosody rate="{escape(str(rate).strip())}">{inner}</prosody>'
    return (
        f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        f'xml:lang="{tts_locale(lang)}"><voice name="{_voice(lang)}">{inner}</voice></speak>'
    )


class AzureTTSEngine(TTSEngine):
    def secrets_ready(self) -> bool:
        # Single key-reading center (api_secrets) keeps the legacy key names.
        return bool(azure_speech_key() and azure_speech_region())

    def disabled_reason(self) -> Optional[Any]:
        blocked, error = is_tts_quota_blocked()
        if blocked:
            return tts_reason(TTS_REASON_QUOTA_EXHAUSTED, engine=self.name, detail=error or "")
        return super().disabled_reason()

    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        """Azure Speech to MP3 (Audio24Khz48KBitRateMonoMp3, no ffmpeg)."""
        self.clear_error()
        lang = request.language
        if not self.available() or not _voice(lang):
            return self.fail(str(self.unavailable_reason() or "no azure voice for language"))
        speechsdk = get_third_package_speechsdk()
        output = Path(request.output_path)
        try:
            speech_config = speechsdk.SpeechConfig(subscription=azure_speech_key(), region=azure_speech_region())
            speech_config.set_speech_synthesis_output_format(
                speechsdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3)
            speech_config.speech_synthesis_voice_name = _voice(lang)
            output.parent.mkdir(parents=True, exist_ok=True)
            synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)
            result = synthesizer.speak_ssml_async(_ssml(request.text, lang, request.rate)).get()
        except Exception as exc:  # noqa: BLE001
            ColorPrint.red(f"[azure-tts] synth of {len(request.text or '')} chars failed: {exc}")
            return self.fail(str(exc))
        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            audio_data = bytes(result.audio_data)
            if not audio_data:
                return self.fail("azure returned empty audio")
            output.write_bytes(audio_data)
            clear_tts_quota_issue()
            return True
        # Surface the real reason (429 quota, auth, region) for the orchestrator log.
        detail = ""
        if result.reason == speechsdk.ResultReason.Canceled:
            cancel = speechsdk.SpeechSynthesisCancellationDetails(result)
            detail = f" ({cancel.reason}: {cancel.error_details})"
            if any(marker in str(cancel.error_details or "").lower() for marker in _QUOTA_MARKERS):
                mark_tts_quota_exceeded(str(cancel.error_details))
        return self.fail(f"not completed: {result.reason}{detail}")


azure_engine = AzureTTSEngine("azure")


__all__ = ["AzureTTSEngine", "azure_engine"]
