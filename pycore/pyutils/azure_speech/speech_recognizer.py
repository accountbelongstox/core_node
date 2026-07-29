#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speech Recognizer facade hosted under azure_speech.
"""

from pathlib import Path
from typing import Any, Callable, Dict, Optional, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    SerializedSingletonProvider,
    init_serialized_owner,
    serialized_method,
)
from pycore.pyutils.common.stt_base_provider import BaseSpeechRecognitionProvider
from pycore.pyutils.azure_speech.stt_provider import AzureSpeechRecognitionProvider


class SpeechRecognizer:
    """Unified interface that manages available STT providers."""

    def __init__(self):
        self._providers: Dict[str, BaseSpeechRecognitionProvider] = {}
        self._current_provider: Optional[str] = None
        self._initialized = False
        init_serialized_owner(
            self,
            "azure_speech.recognizer.state",
            "SpeechRecognizerState",
            timeout=300.0,
        )

    @serialized_method
    def initialize(self) -> bool:
        if self._initialized:
            return True

        azure_provider = AzureSpeechRecognitionProvider()
        if azure_provider.is_available():
            self._providers["azure"] = azure_provider
            self._current_provider = "azure"
            ColorPrint.green("[SpeechRecognizer] Azure provider available")

        if not self._providers:
            ColorPrint.red("[SpeechRecognizer] No speech recognition providers available")
            return False

        self._initialized = True
        ColorPrint.blue(f"[SpeechRecognizer] Initialized with {len(self._providers)} provider(s)")
        return True

    @serialized_method
    def set_provider(self, provider_name: str) -> bool:
        if provider_name not in self._providers:
            ColorPrint.red(f"[SpeechRecognizer] Provider not available: {provider_name}")
            return False
        self._current_provider = provider_name
        ColorPrint.blue(f"[SpeechRecognizer] Active provider: {provider_name}")
        return True

    @serialized_method
    def get_current_provider(self) -> Optional[BaseSpeechRecognitionProvider]:
        if not self.initialize():
            return None
        if not self._current_provider:
            return None
        return self._providers.get(self._current_provider)

    @serialized_method
    def recognize_from_file(
        self,
        audio_file: str | Path,
        language: str = "zh-CN",
        provider: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not self.initialize():
            return self._error("No providers available", language, "None")

        if provider:
            if provider not in self._providers:
                return self._error(f"Provider not available: {provider}", language, provider)
            active_provider = self._providers[provider]
        else:
            active_provider = self.get_current_provider()
            if not active_provider:
                return self._error("No active provider", language, "None")

        audio_path = Path(audio_file) if isinstance(audio_file, str) else audio_file
        return active_provider.recognize_from_file(audio_path, language)

    @serialized_method
    def start_continuous_recognition(
        self,
        audio_source: Any = None,
        language: str = "zh-CN",
        on_recognizing: Optional[Callable[[str], None]] = None,
        on_recognized: Optional[Callable[[str, float], None]] = None,
        on_error: Optional[Callable[[str], None]] = None,
        provider: Optional[str] = None,
    ) -> bool:
        if not self.initialize():
            if on_error:
                on_error("No providers available")
            return False

        if provider:
            active_provider = self._providers.get(provider)
            if not active_provider:
                if on_error:
                    on_error(f"Provider not available: {provider}")
                return False
        else:
            active_provider = self.get_current_provider()
            if not active_provider:
                if on_error:
                    on_error("No active provider")
                return False

        return active_provider.recognize_continuous(
            audio_source=audio_source,
            language=language,
            on_recognizing=on_recognizing,
            on_recognized=on_recognized,
            on_error=on_error,
        )

    @serialized_method
    def stop_recognition(self, provider: Optional[str] = None) -> bool:
        if provider:
            selected = self._providers.get(provider)
            if not selected:
                return False
            return selected.stop_recognition()
        active = self.get_current_provider()
        if not active:
            return False
        return active.stop_recognition()

    @serialized_method
    def get_available_providers(self) -> List[str]:
        self.initialize()
        return list(self._providers.keys())

    @serialized_method
    def get_supported_languages(self, provider: Optional[str] = None) -> List[str]:
        if provider:
            selected = self._providers.get(provider)
            if not selected:
                return []
            return selected.get_supported_languages()
        active = self.get_current_provider()
        if not active:
            return []
        return active.get_supported_languages()

    def _error(self, message: str, language: str, provider: str) -> Dict[str, Any]:
        return {
            "success": False,
            "text": "",
            "confidence": 0.0,
            "language": language,
            "provider": provider,
            "error": message,
        }


_SPEECH_RECOGNIZER_PROVIDER = SerializedSingletonProvider(
    SpeechRecognizer,
    "azure_speech.recognizer.provider",
    "SpeechRecognizerProvider",
)


def get_speech_recognizer() -> SpeechRecognizer:
    return _SPEECH_RECOGNIZER_PROVIDER.get()

SPEECH_RECOGNITION_AVAILABLE = True
speech_recognizer = get_speech_recognizer()
