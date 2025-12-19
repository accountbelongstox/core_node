#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Base Speech Recognition Provider

Shared abstract base for Azure Speech recognition components so both STT
and TTS helpers live under the same module.
"""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, Optional, Callable, List


class BaseSpeechRecognitionProvider(ABC):
    """Abstract base class for speech recognition providers."""

    @abstractmethod
    def initialize(self) -> bool:
        """Initialize provider resources."""

    @abstractmethod
    def recognize_from_file(self, audio_file: Path, language: str = "zh-CN") -> Dict[str, Any]:
        """Run single-shot recognition for an audio file."""

    @abstractmethod
    def recognize_continuous(
        self,
        audio_source: Any,
        language: str = "zh-CN",
        on_recognizing: Optional[Callable[[str], None]] = None,
        on_recognized: Optional[Callable[[str, float], None]] = None,
        on_error: Optional[Callable[[str], None]] = None,
    ) -> bool:
        """Start continuous recognition stream."""

    @abstractmethod
    def stop_recognition(self) -> bool:
        """Stop continuous recognition."""

    @abstractmethod
    def is_available(self) -> bool:
        """Return True when provider can be used."""

    @abstractmethod
    def get_supported_languages(self) -> List[str]:
        """List supported locales."""

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return provider identifier."""
