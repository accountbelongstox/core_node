#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speech Manager

Orchestrates speech utilities from pyutils:
- Speech Recognition (STT) - pyutils.azure_speech
- Speech Synthesis (TTS) - pyutils.azure_speech / pyutils.edge_tts

Provides unified high-level interface for all speech operations.
"""

import asyncio
import hashlib
import shutil
from pathlib import Path
from typing import Dict, Any, Optional, Callable, Union

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_edge_tts
from pycore.pyfoundations.system_paths import map_web_path

from pycore.pyctl.speech.transcription_app import run_app
from pycore.pyctl.speech.transcription_app import run_app_dual_source

from pycore.pyutils.azure_speech import get_azure_speech_client
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)



edge_tts_module = get_third_package_edge_tts()
from pycore.pyutils.azure_speech import speech_recognizer, SPEECH_RECOGNITION_AVAILABLE
from pycore.database import database_manager, DATABASE_AVAILABLE
from pycore.database.models import SpeechTTSCacheModel, TableKeys


_ASYNC_WORK_QUEUE = 'pyctl.speech.manager.async'
_ASYNC_WORKER = SerializedWorkerThread(
    _ASYNC_WORK_QUEUE,
    'SpeechManagerAsyncThread',
)
_ASYNC_WORKER.start()


def _run_async_callable(callback: Callable) -> None:
    """Run one coroutine factory on the speech async owner thread."""
    asyncio.run(callback())


class SpeechManager:
    """
    Speech Manager - Unified interface for speech operations

    Combines multiple pyutils modules:
    - pyutils.azure_speech - STT operations
    - pyutils.azure_speech - Azure TTS
    - pyutils.edge_tts - Edge TTS

    This class orchestrates these utilities without re-implementing functionality.
    """

    def __init__(self):
        """Initialize Speech Manager"""
        self._initialized = False
        self._stt_available = SPEECH_RECOGNITION_AVAILABLE
        self._tts_available = False  # Will check on first use
        self._tts_cache_enabled = True  # Enable TTS cache by default
        self._default_tts_provider = "edge"  # Default to edge-tts (free)
        self._edge_tts_available = False
        self._azure_tts_available = False
        self._db_initialized = False
        self._cache_root = map_web_path("pycore_db") / "tts_static"
        self._initialize_cache_database()

    def initialize(self) -> bool:
        """
        Initialize speech manager

        Returns:
            bool: True if at least one service is available
        """
        if self._initialized:
            return True

        # Check STT availability
        if self._stt_available:
            ColorPrint.green("[SpeechManager] Speech Recognition (STT) available")
        else:
            ColorPrint.yellow("[SpeechManager] Speech Recognition (STT) not available")

        # Check TTS availability
        self._check_tts_availability()

        if not self._stt_available and not self._tts_available:
            ColorPrint.red("[SpeechManager] No speech services available")
            return False

        self._initialized = True
        ColorPrint.blue("[SpeechManager] Initialized")
        return True

    def _check_tts_availability(self):
        """Check if TTS services are available"""
        # Check Edge TTS (free, no credentials needed)
        self._edge_tts_available = self._check_edge_tts()

        # Check Azure Speech TTS
        self._azure_tts_available = self._check_azure_tts()

        self._tts_available = self._edge_tts_available or self._azure_tts_available

        if self._tts_available:
            ColorPrint.green("[SpeechManager] Text-to-Speech (TTS) available")
            # Default to edge-tts if available (free)
            if self._edge_tts_available:
                self._default_tts_provider = "edge"
                ColorPrint.blue("[SpeechManager] Default TTS: edge-tts (free)")
            else:
                self._default_tts_provider = "azure"
                ColorPrint.blue("[SpeechManager] Default TTS: azure")
        else:
            ColorPrint.yellow("[SpeechManager] Text-to-Speech (TTS) not available")

    def _check_azure_tts(self) -> bool:
        """Check if Azure TTS is available"""
        try:
            client = get_azure_speech_client()
            if client.initialize():
                ColorPrint.green("[SpeechManager] Azure TTS available")
                return True
            ColorPrint.yellow("[SpeechManager] Azure TTS credentials missing")
            return False
        except:
            ColorPrint.yellow("[SpeechManager] Azure TTS not available")
            return False

    def _check_edge_tts(self) -> bool:
        """Check if Edge TTS is available"""
        if edge_tts_module is None:
            ColorPrint.yellow("[SpeechManager] Edge TTS not installed")
            ColorPrint.yellow("[SpeechManager] Install with: pip install edge-tts")
            return False

        # Edge TTS package is available - we use it directly via edge_tts_module
        # The EdgeTTSClient has broken dependencies (missing pycore.pyutils.common.tts_models)
        # but we don't need it for basic TTS synthesis
        ColorPrint.green("[SpeechManager] Edge TTS available (free)")
        return True

    # ========== TTS Cache Database Methods ==========

    def _initialize_cache_database(self):
        """Initialize TTS cache database"""
        if not DATABASE_AVAILABLE:
            ColorPrint.yellow("[SpeechManager] Database not available, cache disabled")
            self._tts_cache_enabled = False
            return

        try:
            database_manager.register_database("speech")
            database_manager.load_tables(
                database_name="speech",
                table_keys=[TableKeys.SPEECH_TTS_CACHE],
                models=[SpeechTTSCacheModel]
            )
            self._db_initialized = True
            ColorPrint.blue("[SpeechManager] TTS cache database initialized")
        except Exception as e:
            ColorPrint.yellow(f"[SpeechManager] Cache database init failed: {e}")
            self._tts_cache_enabled = False

    def _get_text_hash(self, text: str) -> str:
        """Calculate MD5 hash of text"""
        return hashlib.md5(text.encode('utf-8')).hexdigest()

    def _get_cache_path(self, provider: str, text: str, language: str, extension: str = "mp3") -> Path:
        """Get cache file path"""
        text_hash = self._get_text_hash(text)
        lang_safe = language.replace('-', '_')
        cache_dir = Path(self._cache_root) / provider / language
        cache_dir.mkdir(parents=True, exist_ok=True)
        return cache_dir / f"{lang_safe}_{text_hash}.{extension}"

    def _copy_from_cache(self, provider: str, text: str, language: str, output_path: Path) -> bool:
        """Copy cached file to output location"""
        if not self._db_initialized:
            # Fallback to file-only check
            cache_path = self._get_cache_path(provider, text, language)
            if cache_path.exists():
                shutil.copy2(cache_path, output_path)
                return True
            return False

        try:
            text_md5 = self._get_text_hash(text)
            with database_manager.get_connection("speech") as conn:
                record = SpeechTTSCacheModel.query_cache(conn, text_md5, language, provider, verify_file=True)
                if record:
                    cache_file = Path(record['file_path'])
                    if cache_file.exists():
                        shutil.copy2(cache_file, output_path)
                        return True
            return False
        except Exception as e:
            ColorPrint.yellow(f"[SpeechManager] Cache lookup failed: {e}")
            return False

    def _save_to_cache(self, provider: str, text: str, language: str, source_file: Path):
        """Save file to cache"""
        cache_path = self._get_cache_path(provider, text, language)
        shutil.copy2(source_file, cache_path)

        if not self._db_initialized:
            return

        try:
            text_md5 = self._get_text_hash(text)
            with database_manager.get_connection("speech") as conn:
                SpeechTTSCacheModel.add_cache_entry(
                    conn, text_md5, text, language, provider, str(cache_path.absolute())
                )
            ColorPrint.blue(f"[SpeechManager] Cached: {cache_path.name}")
        except Exception as e:
            ColorPrint.yellow(f"[SpeechManager] Cache save failed: {e}")

    # ========== Speech Recognition (STT) Methods ==========

    def recognize_from_file(
        self,
        audio_file: Union[str, Path],
        language: str = "zh-CN",
        provider: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Recognize speech from audio file

        Args:
            audio_file: Path to audio file
            language: Recognition language (default: zh-CN)
            provider: Specific provider ("azure", etc.) or None for default

        Returns:
            Dict with recognition results
        """
        if not self._stt_available:
            return {
                'success': False,
                'text': '',
                'confidence': 0.0,
                'language': language,
                'provider': 'None',
                'error': 'Speech recognition not available'
            }

        return speech_recognizer.recognize_from_file(
            audio_file=audio_file,
            language=language,
            provider=provider
        )

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
            on_recognizing: Callback for intermediate results
            on_recognized: Callback for final results
            on_error: Callback for errors
            provider: Specific provider or None for default

        Returns:
            bool: True if started successfully
        """
        if not self._stt_available:
            if on_error:
                on_error("Speech recognition not available")
            return False

        return speech_recognizer.start_continuous_recognition(
            audio_source=audio_source,
            language=language,
            on_recognizing=on_recognizing,
            on_recognized=on_recognized,
            on_error=on_error,
            provider=provider
        )

    def stop_recognition(self, provider: Optional[str] = None) -> bool:
        """
        Stop continuous recognition

        Args:
            provider: Specific provider or None for current

        Returns:
            bool: True if stopped successfully
        """
        if not self._stt_available:
            return False

        return speech_recognizer.stop_recognition(provider=provider)

    def get_stt_providers(self) -> list[str]:
        """Get list of available STT providers"""
        if not self._stt_available:
            return []
        return speech_recognizer.get_available_providers()

    def get_current_stt_provider(self):
        """
        Get current active STT provider instance

        Returns:
            Provider instance or None if not available
        """
        if not self._stt_available:
            return None
        return speech_recognizer.get_current_provider()

    def get_supported_languages(self, provider: Optional[str] = None) -> list[str]:
        """
        Get list of supported languages for STT

        Args:
            provider: Specific provider or None for current

        Returns:
            list: List of language codes
        """
        if not self._stt_available:
            return []
        return speech_recognizer.get_supported_languages(provider=provider)

    # ========== Text-to-Speech (TTS) Methods ==========

    def synthesize_to_file(
        self,
        text: str,
        output_file: Union[str, Path],
        voice: Optional[str] = None,
        provider: Optional[str] = None,
        language: str = "zh-CN",
        use_cache: Optional[bool] = None
    ) -> bool:
        """
        Synthesize text to speech and save to file (with caching)

        Args:
            text: Text to synthesize
            output_file: Output audio file path
            voice: Voice name (optional)
            provider: TTS provider ("azure" or "edge", None=default)
            language: Language code (e.g., "zh-CN", "en-US")
            use_cache: Use TTS cache (None=use default, True/False override)

        Returns:
            bool: True if synthesis successful
        """
        if not self._tts_available:
            ColorPrint.red("[SpeechManager] TTS not available")
            return False

        output_path = Path(output_file) if isinstance(output_file, str) else output_file

        # Use default provider if not specified
        if provider is None:
            provider = self._default_tts_provider

        # Use cache setting
        if use_cache is None:
            use_cache = self._tts_cache_enabled

        # Check cache first (if enabled)
        if use_cache:
            if self._copy_from_cache(provider, text, language, output_path):
                ColorPrint.green(f"[SpeechManager] Used cached TTS: {output_path.name}")
                return True

        # Not in cache - synthesize
        ColorPrint.blue(f"[SpeechManager] Synthesizing with {provider}...")

        success = False

        if provider == "azure":
            if not self._azure_tts_available:
                ColorPrint.red("[SpeechManager] Azure TTS not available")
                return False

            client = get_azure_speech_client()
            success = client.synthesize(text, output_path, voice)

        elif provider == "edge":
            if not self._edge_tts_available:
                ColorPrint.red("[SpeechManager] Edge TTS not available")
                ColorPrint.yellow("[SpeechManager] Install with: pip install edge-tts")
                return False

            success = self._synthesize_with_edge_tts(text, output_path, voice, language)

        else:
            ColorPrint.red(f"[SpeechManager] Unknown TTS provider: {provider}")
            return False

        # Save to cache if successful and cache enabled
        if success and use_cache and output_path.exists():
            self._save_to_cache(provider, text, language, output_path)

        return success

    def _synthesize_with_edge_tts(
        self,
        text: str,
        output_file: Path,
        voice: Optional[str] = None,
        language: str = "zh-CN"
    ) -> bool:
        """
        Synthesize using Edge TTS

        Args:
            text: Text to synthesize
            output_file: Output file path
            voice: Voice name (optional)
            language: Language code

        Returns:
            bool: True if successful
        """
        # Default voices for languages
        default_voices = {
            "zh-CN": "zh-CN-XiaoxiaoNeural",
            "zh-TW": "zh-TW-HsiaoChenNeural",
            "en-US": "en-US-JennyNeural",
            "en-GB": "en-GB-SoniaNeural",
            "ja-JP": "ja-JP-NanamiNeural",
            "ko-KR": "ko-KR-SunHiNeural",
        }

        # Use provided voice or default for language
        if voice is None:
            voice = default_voices.get(language, "en-US-JennyNeural")

        async def _do_synthesis():
            """Async synthesis"""
            communicate = edge_tts_module.Communicate(text, voice)
            await communicate.save(str(output_file))

        try:
            # Check if there's a running event loop
            try:
                loop = asyncio.get_running_loop()
                # If we're here, there's a running loop - we need to run in a new thread
                call_serialized(
                    _ASYNC_WORK_QUEUE,
                    _run_async_callable,
                    _do_synthesis,
                    timeout=300.0,
                )
            except RuntimeError:
                # No running event loop - safe to use asyncio.run()
                asyncio.run(_do_synthesis())

            ColorPrint.green(f"[EdgeTTS] Synthesized: {output_file.name}")
            return True
        except Exception as e:
            ColorPrint.red(f"[EdgeTTS] Synthesis failed: {e}")
            return False

    # ========== Utility Methods ==========

    def is_stt_available(self) -> bool:
        """Check if STT is available"""
        return self._stt_available

    def is_tts_available(self) -> bool:
        """Check if TTS is available"""
        return self._tts_available

    def get_status(self) -> Dict[str, Any]:
        """
        Get status of all speech services

        Returns:
            Dict with service availability status
        """
        self.initialize()

        return {
            'initialized': self._initialized,
            'stt_available': self._stt_available,
            'tts_available': self._tts_available,
            'stt_providers': self.get_stt_providers() if self._stt_available else [],
            'tts_providers': ['azure', 'edge'] if self._tts_available else [],
        }

    # ========== Application Interface ==========

    def run_transcription_app(self):
        """
        Run interactive speech transcription application

        This is the main entry point called by pyapps/speech_transcribe.
        Provides interactive menu for real-time speech recognition.
        """
        run_app(self)

    def run_transcription_app_dual_source(self):
        """
        Run dual-source transcription application with hotkey control

        Features:
        - Dual audio sources: microphone + system audio
        - Independent language settings for each source
        - Ctrl+Click: Copy last system audio text to clipboard
        - Ctrl+DoubleClick: Replay last system audio text with TTS
        - Silence detection for intelligent sentence segmentation
        """
        run_app_dual_source(self)


# Global singleton instance
_global_speech_manager: Optional[SpeechManager] = None


def get_speech_manager() -> SpeechManager:
    """Get global speech manager singleton instance"""
    global _global_speech_manager
    if _global_speech_manager is None:
        _global_speech_manager = SpeechManager()
    return _global_speech_manager
