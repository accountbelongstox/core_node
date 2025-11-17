#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speech Recognizer

Main speech recognition interface that manages multiple providers.
Exports singleton instance for easy use.
"""

import threading
from pathlib import Path
from typing import Dict, Any, Optional, Callable

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.speech_recognition.base_provider import BaseSpeechRecognitionProvider
from pycore.pyutils.speech_recognition.azure_provider import AzureSpeechRecognitionProvider


class SpeechRecognizer:
    """
    Speech Recognizer - Main interface for speech-to-text

    Manages multiple speech recognition providers (Azure, Google, Local, etc.)
    and provides unified interface for all providers.

    Usage:
        from pycore.pyutils.speech_recognition import speech_recognizer

        # Recognize from file
        result = speech_recognizer.recognize_from_file("audio.wav", language="zh-CN")
        print(result['text'])

        # Continuous recognition
        def on_recognized(text, confidence):
            print(f"[{confidence:.2%}] {text}")

        speech_recognizer.start_continuous_recognition(
            audio_source=0,  # Default microphone
            language="zh-CN",
            on_recognized=on_recognized
        )
    """

    def __init__(self):
        """Initialize Speech Recognizer with available providers"""
        self._providers: Dict[str, BaseSpeechRecognitionProvider] = {}
        self._current_provider: Optional[str] = None
        self._initialized = False

    def initialize(self) -> bool:
        """
        Initialize speech recognizer with available providers

        Returns:
            bool: True if at least one provider is available
        """
        if self._initialized:
            return True

        # Try to initialize Azure provider
        azure_provider = AzureSpeechRecognitionProvider()
        if azure_provider.is_available():
            self._providers['azure'] = azure_provider
            self._current_provider = 'azure'
            ColorPrint.green("[SpeechRecognizer] Azure provider available")

        # Future: Add more providers here
        # google_provider = GoogleSpeechRecognitionProvider()
        # if google_provider.is_available():
        #     self._providers['google'] = google_provider

        if not self._providers:
            ColorPrint.red("[SpeechRecognizer] No speech recognition providers available")
            return False

        self._initialized = True
        ColorPrint.blue(f"[SpeechRecognizer] Initialized with {len(self._providers)} provider(s)")
        return True

    def set_provider(self, provider_name: str) -> bool:
        """
        Set active provider

        Args:
            provider_name: Provider name ("azure", "google", etc.)

        Returns:
            bool: True if provider set successfully
        """
        if provider_name not in self._providers:
            ColorPrint.red(f"[SpeechRecognizer] Provider not available: {provider_name}")
            return False

        self._current_provider = provider_name
        ColorPrint.blue(f"[SpeechRecognizer] Active provider: {provider_name}")
        return True

    def get_current_provider(self) -> Optional[BaseSpeechRecognitionProvider]:
        """Get current active provider"""
        if not self.initialize():
            return None

        if not self._current_provider:
            return None

        return self._providers.get(self._current_provider)

    def recognize_from_file(
        self,
        audio_file: str | Path,
        language: str = "zh-CN",
        provider: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Recognize speech from audio file

        Args:
            audio_file: Path to audio file
            language: Recognition language (default: zh-CN)
            provider: Specific provider to use (None = use current)

        Returns:
            Dict with recognition results:
                - success: bool
                - text: str
                - confidence: float
                - language: str
                - provider: str
                - error: str (if failed)
        """
        if not self.initialize():
            return {
                'success': False,
                'text': '',
                'confidence': 0.0,
                'language': language,
                'provider': 'None',
                'error': 'No providers available'
            }

        # Get provider
        if provider:
            if provider not in self._providers:
                return {
                    'success': False,
                    'text': '',
                    'confidence': 0.0,
                    'language': language,
                    'provider': provider,
                    'error': f'Provider not available: {provider}'
                }
            active_provider = self._providers[provider]
        else:
            active_provider = self.get_current_provider()
            if not active_provider:
                return {
                    'success': False,
                    'text': '',
                    'confidence': 0.0,
                    'language': language,
                    'provider': 'None',
                    'error': 'No active provider'
                }

        # Convert to Path
        audio_path = Path(audio_file) if isinstance(audio_file, str) else audio_file

        # Perform recognition
        return active_provider.recognize_from_file(audio_path, language)

    def start_continuous_recognition(
        self,
        audio_source: Any = None,
        language: str = "zh-CN",
        on_recognizing: Optional[Callable[[str], None]] = None,
        on_recognized: Optional[Callable[[str, float], None]] = None,
        on_error: Optional[Callable[[str], None]] = None,
        provider: Optional[str] = None
    ) -> bool:
        """
        Start continuous speech recognition

        Args:
            audio_source: Audio source (device index, stream, None=default mic)
            language: Recognition language
            on_recognizing: Callback for intermediate results (text)
            on_recognized: Callback for final results (text, confidence)
            on_error: Callback for errors (error_message)
            provider: Specific provider to use (None = use current)

        Returns:
            bool: True if started successfully
        """
        if not self.initialize():
            if on_error:
                on_error("No providers available")
            return False

        # Get provider
        if provider:
            if provider not in self._providers:
                if on_error:
                    on_error(f"Provider not available: {provider}")
                return False
            active_provider = self._providers[provider]
        else:
            active_provider = self.get_current_provider()
            if not active_provider:
                if on_error:
                    on_error("No active provider")
                return False

        # Start continuous recognition
        return active_provider.recognize_continuous(
            audio_source=audio_source,
            language=language,
            on_recognizing=on_recognizing,
            on_recognized=on_recognized,
            on_error=on_error
        )

    def stop_recognition(self, provider: Optional[str] = None) -> bool:
        """
        Stop continuous recognition

        Args:
            provider: Specific provider to stop (None = current)

        Returns:
            bool: True if stopped successfully
        """
        if provider:
            if provider not in self._providers:
                return False
            return self._providers[provider].stop_recognition()
        else:
            active_provider = self.get_current_provider()
            if not active_provider:
                return False
            return active_provider.stop_recognition()

    def get_available_providers(self) -> list[str]:
        """Get list of available providers"""
        self.initialize()
        return list(self._providers.keys())

    def get_supported_languages(self, provider: Optional[str] = None) -> list[str]:
        """
        Get list of supported languages

        Args:
            provider: Specific provider (None = current)

        Returns:
            list: List of language codes
        """
        if provider:
            if provider not in self._providers:
                return []
            return self._providers[provider].get_supported_languages()
        else:
            active_provider = self.get_current_provider()
            if not active_provider:
                return []
            return active_provider.get_supported_languages()


# Global singleton instance
_global_speech_recognizer: Optional[SpeechRecognizer] = None
_recognizer_lock = threading.Lock()


def get_speech_recognizer() -> SpeechRecognizer:
    """Get global speech recognizer singleton instance"""
    global _global_speech_recognizer
    with _recognizer_lock:
        if _global_speech_recognizer is None:
            _global_speech_recognizer = SpeechRecognizer()
        return _global_speech_recognizer
