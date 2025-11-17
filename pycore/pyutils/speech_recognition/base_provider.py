#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Base Speech Recognition Provider

Abstract base class for speech recognition providers.
All providers must implement these methods.
"""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, Any, Optional, Callable


class BaseSpeechRecognitionProvider(ABC):
    """
    Abstract base class for speech recognition providers

    All speech recognition providers must inherit from this class
    and implement the required methods.
    """

    @abstractmethod
    def initialize(self) -> bool:
        """
        Initialize the speech recognition provider

        Returns:
            bool: True if initialization successful, False otherwise
        """
        pass

    @abstractmethod
    def recognize_from_file(
        self,
        audio_file: Path,
        language: str = "zh-CN"
    ) -> Dict[str, Any]:
        """
        Recognize speech from audio file

        Args:
            audio_file: Path to audio file
            language: Recognition language (e.g., "zh-CN", "en-US")

        Returns:
            Dict with keys:
                - success: bool - Whether recognition succeeded
                - text: str - Recognized text
                - confidence: float - Confidence score (0.0 to 1.0)
                - language: str - Language used
                - provider: str - Provider name
                - error: str - Error message if failed
        """
        pass

    @abstractmethod
    def recognize_continuous(
        self,
        audio_source: Any,
        language: str = "zh-CN",
        on_recognizing: Optional[Callable[[str], None]] = None,
        on_recognized: Optional[Callable[[str, float], None]] = None,
        on_error: Optional[Callable[[str], None]] = None
    ) -> bool:
        """
        Continuous speech recognition from audio source

        Args:
            audio_source: Audio source (device, stream, etc.)
            language: Recognition language
            on_recognizing: Callback for intermediate results (text)
            on_recognized: Callback for final results (text, confidence)
            on_error: Callback for errors (error_message)

        Returns:
            bool: True if started successfully
        """
        pass

    @abstractmethod
    def stop_recognition(self) -> bool:
        """
        Stop continuous recognition

        Returns:
            bool: True if stopped successfully
        """
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """
        Check if provider is available

        Returns:
            bool: True if provider can be used
        """
        pass

    @abstractmethod
    def get_supported_languages(self) -> list[str]:
        """
        Get list of supported languages

        Returns:
            list: List of language codes (e.g., ["zh-CN", "en-US"])
        """
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """
        Get provider name

        Returns:
            str: Provider name (e.g., "Azure", "Google", "Local")
        """
        pass
