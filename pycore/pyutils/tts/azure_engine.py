# -*- coding: utf-8 -*-
"""
Azure Speech cloud TTS engine — the orchestrator's API fallback.

Used ONLY when every local engine (edge / sherpa / melotts / gptsovits) is
unavailable or fails: see tts_orchestrator priority (azure is last). Azure's free
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

import os
from pathlib import Path
from typing import Optional
from xml.sax.saxutils import escape

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.secret_manager import get_secret_key, get_secret_key_indexed

try:  # optional third-party (already in pycore requirements)
    import azure.cognitiveservices.speech as _speechsdk
    _AZURE_SDK_AVAILABLE = True
except Exception:  # noqa: BLE001 — SDK absent / import error -> engine simply unavailable
    _speechsdk = None
    _AZURE_SDK_AVAILABLE = False

# locale + a known-good neural voice per language (female, language-learning friendly).
_VOICE_BY_LANG = {
    "en": "en-US-JennyNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
    "ja": "ja-JP-NanamiNeural",
    "ko": "ko-KR-SunHiNeural",
    "es": "es-ES-ElviraNeural",
    "fr": "fr-FR-DeniseNeural",
}
_LOCALE_BY_LANG = {
    "en": "en-US", "zh": "zh-CN", "ja": "ja-JP",
    "ko": "ko-KR", "es": "es-ES", "fr": "fr-FR",
}


def _key() -> str:
    # The "Special Software Environment Variables" manager stores the Azure Speech
    # subscription key under AZURE_SPEECH_KEYA (Key A) / AZURE_SPEECH_KEYB (Key B),
    # indexed _1.._5 — the SAME names the legacy azure_speech STT reads. Older code
    # used a bare AZURE_SPEECH_KEY; try the real names first, keep the old as fallback.
    return (get_secret_key_indexed("AZURE_SPEECH_KEYA")
            or get_secret_key_indexed("AZURE_SPEECH_KEYB")
            or get_secret_key_indexed("AZURE_SPEECH_KEY")
            or get_secret_key("AZURE_SPEECH_KEY")
            or "")


def _region() -> str:
    return (get_secret_key("AZURE_SPEECH_REGION")
            or get_secret_key_indexed("AZURE_SPEECH_REGION")
            or os.environ.get("AZURE_SPEECH_REGION")
            or "eastus")


def available() -> bool:
    """SDK importable AND a key+region are configured (no network round-trip)."""
    return bool(_AZURE_SDK_AVAILABLE and _key() and _region())


def _voice(lang: Optional[str]) -> str:
    return _VOICE_BY_LANG.get((lang or "en").lower(), "en-US-JennyNeural")


def _ssml(text: str, lang: Optional[str], rate: Optional[str]) -> str:
    """Wrap text in SSML so a percent rate (e.g. '-20%') maps to prosody@rate."""
    locale = _LOCALE_BY_LANG.get((lang or "en").lower(), "en-US")
    voice = _voice(lang)
    inner = escape(text)
    if rate:
        r = str(rate).strip()
        if not r.endswith("%") and not r.startswith(("+", "-")):
            r = r  # allow named rates ("slow"/"fast") too
        inner = f'<prosody rate="{escape(r)}">{inner}</prosody>'
    return (
        f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        f'xml:lang="{locale}"><voice name="{voice}">{inner}</voice></speak>'
    )


def synthesize(text: str, lang: str, output_mp3: Path, rate: Optional[str] = None) -> bool:
    """Synthesize ``text`` to ``output_mp3`` via Azure Speech. False on any failure."""
    if not available():
        return False
    key, region = _key(), _region()
    try:
        speech_config = _speechsdk.SpeechConfig(subscription=key, region=region)
        speech_config.set_speech_synthesis_output_format(
            _speechsdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3)
        speech_config.speech_synthesis_voice_name = _voice(lang)
        output_mp3.parent.mkdir(parents=True, exist_ok=True)
        audio_config = _speechsdk.audio.AudioOutputConfig(filename=str(output_mp3))
        synthesizer = _speechsdk.SpeechSynthesizer(
            speech_config=speech_config, audio_config=audio_config)
        result = synthesizer.speak_ssml_async(_ssml(text, lang, rate)).get()
    except Exception as e:  # noqa: BLE001
        ColorPrint.red(f"[azure-tts] synth error: {e}")
        return False

    if result.reason == _speechsdk.ResultReason.SynthesizingAudioCompleted:
        return output_mp3.exists() and output_mp3.stat().st_size > 0
    # Surface the real reason (429 quota, auth, region) for the orchestrator log.
    detail = ""
    if result.reason == _speechsdk.ResultReason.Canceled:
        cancel = _speechsdk.CancellationDetails(result)
        detail = f" ({cancel.reason}: {cancel.error_details})"
    ColorPrint.yellow(f"[azure-tts] not completed: {result.reason}{detail}")
    return False


__all__ = ["available", "synthesize"]
