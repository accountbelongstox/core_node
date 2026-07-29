#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Azure Speech Recognition Provider

Uses Azure Cognitive Services Speech SDK for speech-to-text.
"""

from pathlib import Path
from typing import Any, Callable, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.api_secrets import azure_speech_key, azure_speech_region
from pycore.pyfoundations.third_party.api import get_third_package_speechsdk
from pycore.pyfoundations.third_party.api import get_third_package_numpy

from pycore.pyutils.common.stt_base_provider import BaseSpeechRecognitionProvider
from pycore.pyutils.azure_speech.quota_state import (
    mark_stt_quota_exceeded,
    clear_stt_quota_issue,
    is_stt_quota_blocked,
)

speechsdk = get_third_package_speechsdk()
np = get_third_package_numpy()


class AzureSpeechRecognitionProvider(BaseSpeechRecognitionProvider):
    """Speech recognition provider backed by Azure Cognitive Services."""

    def __init__(self):
        self.speech_key = None
        self.speech_region = None
        self.speech_config = None
        self._initialized = False
        self._is_recognizing = False
        self._recognizer = None
        # Track recognition session state without explicit locks

    def initialize(self) -> bool:
        if self._initialized:
            return True

        if speechsdk is None:
            ColorPrint.red("[AzureSTT] Azure Speech SDK not available")
            ColorPrint.yellow("[AzureSTT] Install with: pip install azure-cognitiveservices-speech")
            return False

        self.speech_key = azure_speech_key()
        if not self.speech_key:
            ColorPrint.yellow("[AzureSTT] Azure Speech key not found (set AZURE_SPEECH_KEY)")
            return False

        self.speech_region = azure_speech_region()
        if not self.speech_region:
            ColorPrint.red("[AzureSTT] AZURE_SPEECH_REGION not found")
            return False

        self.speech_config = speechsdk.SpeechConfig(
            subscription=self.speech_key,
            region=self.speech_region,
        )

        self._initialized = True
        ColorPrint.blue(f"[AzureSTT] Initialized - Region: {self.speech_region}")
        return True

    def recognize_from_file(self, audio_file: Path, language: str = "zh-CN") -> Dict[str, Any]:
        if not self.initialize():
            return self._failure("Failed to initialize Azure Speech SDK", language)

        if not audio_file.exists():
            return self._failure(f"Audio file not found: {audio_file}", language)

        self.speech_config.speech_recognition_language = language
        audio_config = speechsdk.audio.AudioConfig(filename=str(audio_file))
        recognizer = speechsdk.SpeechRecognizer(
            speech_config=self.speech_config,
            audio_config=audio_config,
        )

        result = recognizer.recognize_once()
        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            confidence = 0.95
            if hasattr(result, "best") and result.best:
                confidence = result.best[0].confidence
            clear_stt_quota_issue()
            return {
                "success": True,
                "text": result.text,
                "confidence": confidence,
                "language": language,
                "provider": "Azure",
                "error": "",
            }

        if result.reason == speechsdk.ResultReason.NoMatch:
            return self._failure("No speech could be recognized", language)

        if result.reason == speechsdk.ResultReason.Canceled:
            cancellation = result.cancellation_details
            error_msg = f"Recognition canceled: {cancellation.reason}"
            if cancellation.reason == speechsdk.CancellationReason.Error:
                details = cancellation.error_details or ""
                error_msg += f" - {details}"
                self._maybe_mark_quota_error(details)
            return self._failure(error_msg, language)

        return self._failure(f"Unknown result reason: {result.reason}", language)

    def recognize_continuous(
        self,
        audio_source: Any,
        language: str = "zh-CN",
        on_recognizing: Optional[Callable[[str], None]] = None,
        on_recognized: Optional[Callable[[str, float], None]] = None,
        on_error: Optional[Callable[[str], None]] = None,
    ) -> bool:
        if not self.initialize():
            if on_error:
                on_error("Failed to initialize Azure Speech SDK")
            return False

        if self._is_recognizing:
            if on_error:
                on_error("Recognition already in progress")
            return False
        self._is_recognizing = True

        self.speech_config.speech_recognition_language = language

        if audio_source is None:
            audio_config = speechsdk.audio.AudioConfig(use_default_microphone=True)
        elif isinstance(audio_source, int):
            audio_config = speechsdk.audio.AudioConfig(device_name=str(audio_source))
        elif isinstance(audio_source, str):
            audio_path = Path(audio_source)
            if audio_path.exists():
                audio_config = speechsdk.audio.AudioConfig(filename=str(audio_path))
            else:
                audio_config = speechsdk.audio.AudioConfig(device_name=audio_source)
        elif hasattr(audio_source, "__class__") and audio_source.__class__.__name__.endswith("AudioInputStream"):
            audio_config = speechsdk.audio.AudioConfig(stream=audio_source)
        else:
            audio_path = Path(audio_source)
            if audio_path.exists():
                audio_config = speechsdk.audio.AudioConfig(filename=str(audio_path))
            else:
                audio_config = speechsdk.audio.AudioConfig(device_name=str(audio_source))

        recognizer = speechsdk.SpeechRecognizer(
            speech_config=self.speech_config,
            audio_config=audio_config,
        )
        self._recognizer = recognizer

        def _recognizing_handler(evt):
            if on_recognizing and evt.result.text:
                on_recognizing(evt.result.text)

        def _recognized_handler(evt):
            if on_recognized and evt.result.text:
                confidence = getattr(evt.result, "confidence", 0.0) or 0.0
                on_recognized(evt.result.text, confidence)

        def _canceled_handler(evt):
            if on_error:
                error_message = evt.reason
                if evt.reason == speechsdk.CancellationReason.Error:
                    error_details = evt.error_details or ""
                    error_message = f"{error_message}: {error_details}"
                    self._maybe_mark_quota_error(error_details)
                on_error(error_message)
            self.stop_recognition()

        recognizer.recognizing.connect(_recognizing_handler)
        recognizer.recognized.connect(_recognized_handler)
        recognizer.canceled.connect(_canceled_handler)

        try:
            recognizer.start_continuous_recognition()
            ColorPrint.blue("[AzureSTT] Continuous recognition started")
            return True
        except Exception as exc:
            self._is_recognizing = False
            self._maybe_mark_quota_error(str(exc))
            if on_error:
                on_error(str(exc))
            return False

    def stop_recognition(self) -> bool:
        if not self._recognizer or not self._is_recognizing:
            return False

        try:
            self._recognizer.stop_continuous_recognition()
        finally:
            self._is_recognizing = False
            self._recognizer = None
        ColorPrint.blue("[AzureSTT] Continuous recognition stopped")
        return True

    def is_available(self) -> bool:
        return self.initialize() and not self.has_quota_issue()

    def has_quota_issue(self) -> bool:
        blocked, _ = is_stt_quota_blocked()
        return blocked

    def get_supported_languages(self) -> list[str]:
        if not np:
            return ["zh-CN", "en-US", "ja-JP"]
        return [
            "zh-CN",
            "zh-TW",
            "en-US",
            "en-GB",
            "ja-JP",
            "ko-KR",
            "fr-FR",
            "de-DE",
            "es-ES",
        ]

    def get_provider_name(self) -> str:
        return "Azure"

    def _failure(self, message: str, language: str) -> Dict[str, Any]:
        return {
            "success": False,
            "text": "",
            "confidence": 0.0,
            "language": language,
            "provider": "Azure",
            "error": message,
        }

    def _maybe_mark_quota_error(self, error_details: str) -> None:
        if not error_details:
            return
        lowered = error_details.lower()
        if "quota" in lowered or "exceed" in lowered or "usage limit" in lowered:
            mark_stt_quota_exceeded(error_details)
        else:
            clear_stt_quota_issue()
