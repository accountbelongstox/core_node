#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Azure Speech Recognition Provider

Implements speech-to-text using Azure Cognitive Services Speech SDK.
"""

import sys
import threading
from pathlib import Path
from typing import Dict, Any, Optional, Callable

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.secret_manager import get_secret_key
from pycore.pyfoundations.third_party import get_third_package_speechsdk, get_third_package_numpy

speechsdk = get_third_package_speechsdk()
np = get_third_package_numpy()
from pycore.pyutils.speech_recognition.base_provider import BaseSpeechRecognitionProvider


class AzureSpeechRecognitionProvider(BaseSpeechRecognitionProvider):
    """
    Azure Speech Recognition Provider

    Uses Azure Cognitive Services Speech SDK for speech-to-text.
    Supports both file-based and continuous recognition.
    """

    def __init__(self):
        """Initialize Azure Speech Recognition Provider"""
        self.speech_key = None
        self.speech_region = None
        self.speech_config = None
        self._initialized = False
        self._is_recognizing = False
        self._recognizer = None

    def initialize(self) -> bool:
        """Initialize Azure Speech SDK with credentials"""
        if self._initialized:
            return True

        if speechsdk is None:
            ColorPrint.red("[AzureSTT] Azure Speech SDK not available")
            ColorPrint.yellow("[AzureSTT] Install with: pip install azure-cognitiveservices-speech")
            return False

        # Load credentials
        self.speech_key = get_secret_key("AZURE_SPEECH_KEYA_1")
        if not self.speech_key:
            self.speech_key = get_secret_key("AZURE_SPEECH_KEYB_1")

        if not self.speech_key:
            ColorPrint.yellow("[AzureSTT] Azure Speech key not found")
            ColorPrint.yellow("[AzureSTT] Set AZURE_SPEECH_KEYA_1 or AZURE_SPEECH_KEYB_1")
            return False

        self.speech_region = get_secret_key("AZURE_SPEECH_REGION_1")
        if not self.speech_region:
            ColorPrint.red("[AzureSTT] AZURE_SPEECH_REGION_1 not found")
            return False

        # Create speech config
        self.speech_config = speechsdk.SpeechConfig(
            subscription=self.speech_key,
            region=self.speech_region
        )

        self._initialized = True
        ColorPrint.blue(f"[AzureSTT] Initialized - Region: {self.speech_region}")
        return True

    def recognize_from_file(
        self,
        audio_file: Path,
        language: str = "zh-CN"
    ) -> Dict[str, Any]:
        """
        Recognize speech from audio file

        Args:
            audio_file: Path to audio file (WAV, MP3, etc.)
            language: Recognition language (default: zh-CN)

        Returns:
            Dict with recognition results
        """
        if not self.initialize():
            return {
                'success': False,
                'text': '',
                'confidence': 0.0,
                'language': language,
                'provider': 'Azure',
                'error': 'Failed to initialize Azure Speech SDK'
            }

        if not audio_file.exists():
            return {
                'success': False,
                'text': '',
                'confidence': 0.0,
                'language': language,
                'provider': 'Azure',
                'error': f'Audio file not found: {audio_file}'
            }

        # Set recognition language
        self.speech_config.speech_recognition_language = language

        # Create audio config from file
        audio_config = speechsdk.audio.AudioConfig(filename=str(audio_file))

        # Create speech recognizer
        recognizer = speechsdk.SpeechRecognizer(
            speech_config=self.speech_config,
            audio_config=audio_config
        )

        # Perform recognition
        result = recognizer.recognize_once()

        # Process result
        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            # Get confidence if available
            confidence = 0.95  # Default high confidence
            if hasattr(result, 'best') and result.best:
                confidence = result.best[0].confidence

            return {
                'success': True,
                'text': result.text,
                'confidence': confidence,
                'language': language,
                'provider': 'Azure',
                'error': ''
            }

        elif result.reason == speechsdk.ResultReason.NoMatch:
            return {
                'success': False,
                'text': '',
                'confidence': 0.0,
                'language': language,
                'provider': 'Azure',
                'error': 'No speech could be recognized'
            }

        elif result.reason == speechsdk.ResultReason.Canceled:
            cancellation = result.cancellation_details
            error_msg = f"Recognition canceled: {cancellation.reason}"
            if cancellation.reason == speechsdk.CancellationReason.Error:
                error_msg += f" - {cancellation.error_details}"

            return {
                'success': False,
                'text': '',
                'confidence': 0.0,
                'language': language,
                'provider': 'Azure',
                'error': error_msg
            }

        return {
            'success': False,
            'text': '',
            'confidence': 0.0,
            'language': language,
            'provider': 'Azure',
            'error': f'Unknown result reason: {result.reason}'
        }

    def recognize_continuous(
        self,
        audio_source: Any,
        language: str = "zh-CN",
        on_recognizing: Optional[Callable[[str], None]] = None,
        on_recognized: Optional[Callable[[str, float], None]] = None,
        on_error: Optional[Callable[[str], None]] = None
    ) -> bool:
        """
        Start continuous speech recognition

        Args:
            audio_source: Audio source (device index, stream, etc.)
            language: Recognition language
            on_recognizing: Callback for intermediate results
            on_recognized: Callback for final results
            on_error: Callback for errors

        Returns:
            bool: True if started successfully
        """
        if not self.initialize():
            if on_error:
                on_error("Failed to initialize Azure Speech SDK")
            return False

        if self._is_recognizing:
            if on_error:
                on_error("Recognition already in progress")
            return False

        # Set recognition language
        self.speech_config.speech_recognition_language = language

        # Create audio config based on source type
        if isinstance(audio_source, int):
            # Device index - use default microphone
            audio_config = None  # None uses default microphone
        elif isinstance(audio_source, speechsdk.audio.PushAudioInputStream):
            # Push stream
            audio_config = speechsdk.audio.AudioConfig(stream=audio_source)
        else:
            # Use default microphone
            audio_config = None

        # Create speech recognizer
        self._recognizer = speechsdk.SpeechRecognizer(
            speech_config=self.speech_config,
            audio_config=audio_config
        )

        # Setup event handlers
        def recognizing_handler(evt):
            """Intermediate result handler"""
            if evt.result.text and on_recognizing:
                on_recognizing(evt.result.text)
                sys.stdout.flush()

        def recognized_handler(evt):
            """Final result handler"""
            if evt.result.reason == speechsdk.ResultReason.RecognizedSpeech:
                if evt.result.text and on_recognized:
                    confidence = 0.95
                    if hasattr(evt.result, 'best') and evt.result.best:
                        confidence = evt.result.best[0].confidence
                    on_recognized(evt.result.text, confidence)
                    sys.stdout.flush()

        def canceled_handler(evt):
            """Cancellation handler"""
            if on_error:
                error_msg = f"Recognition canceled: {evt.result.cancellation_details.reason}"
                if evt.result.cancellation_details.reason == speechsdk.CancellationReason.Error:
                    error_msg += f" - {evt.result.cancellation_details.error_details}"
                on_error(error_msg)
                sys.stdout.flush()
            self._is_recognizing = False

        def stopped_handler(evt):
            """Session stopped handler"""
            self._is_recognizing = False

        # Connect event handlers
        self._recognizer.recognizing.connect(recognizing_handler)
        self._recognizer.recognized.connect(recognized_handler)
        self._recognizer.canceled.connect(canceled_handler)
        self._recognizer.session_stopped.connect(stopped_handler)

        # Start continuous recognition
        self._recognizer.start_continuous_recognition_async()
        self._is_recognizing = True

        ColorPrint.blue(f"[AzureSTT] Started continuous recognition - Language: {language}")
        return True

    def stop_recognition(self) -> bool:
        """Stop continuous recognition"""
        if not self._is_recognizing or not self._recognizer:
            return False

        self._recognizer.stop_continuous_recognition_async()
        self._is_recognizing = False
        ColorPrint.blue("[AzureSTT] Stopped continuous recognition")
        return True

    def is_available(self) -> bool:
        """Check if Azure provider is available"""
        if speechsdk is None:
            return False

        # Check if credentials are available
        key = get_secret_key("AZURE_SPEECH_KEYA_1")
        if not key:
            key = get_secret_key("AZURE_SPEECH_KEYB_1")
        if not key:
            return False

        region = get_secret_key("AZURE_SPEECH_REGION_1")
        if not region:
            return False

        return True

    def get_supported_languages(self) -> list[str]:
        """Get list of supported languages"""
        return [
            "zh-CN",  # Chinese (Simplified)
            "zh-TW",  # Chinese (Traditional)
            "en-US",  # English (US)
            "en-GB",  # English (UK)
            "ja-JP",  # Japanese
            "ko-KR",  # Korean
            "de-DE",  # German
            "fr-FR",  # French
            "es-ES",  # Spanish
            "ru-RU",  # Russian
            "it-IT",  # Italian
            "pt-BR",  # Portuguese (Brazil)
            "ar-SA",  # Arabic
            "hi-IN",  # Hindi
        ]

    def get_provider_name(self) -> str:
        """Get provider name"""
        return "Azure"
