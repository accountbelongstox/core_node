#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Whisper STT Provider

Speech-to-text provider using OpenAI's Whisper model.
Implements BaseSpeechRecognitionProvider interface.

Supports:
- Audio file transcription (with auto format conversion)
- Microphone input
- System audio capture (Windows)
- Audio URL transcription
- Video file transcription (audio extraction)

"""

from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.pybasecommon.compute_caps import is_cuda_available
from pycore.pyfoundations.speech_recognition_provider import BaseSpeechRecognitionProvider
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
from pycore.pyutils.common.model_checks import module_present
from pycore.pyutils.common.whisper_models import (
    WHISPER_INSTALLER,
    whisper_models,
    whisper_weights,
)
from pycore.pyutils.stt.audio_utils import (
    convert_to_whisper_format,
    download_audio_from_url,
    extract_audio_from_video,
    is_video_file,
    needs_conversion,
)
from pycore.pyutils.stt.audio_capture import (
    MicrophoneCapture,
    SystemAudioCapture,
)


WHISPER_MODELS = ["tiny", "base", "small", "medium", "large", "turbo"]
DEFAULT_MODEL_CPU = "turbo"
DEFAULT_MODEL_GPU = "large"


def _optimal_model() -> str:
    """'large' when CUDA is available, else 'turbo'."""
    if is_cuda_available():
        ColorPrint.green("[WHISPER] CUDA detected - using 'large' model for best accuracy")
        return DEFAULT_MODEL_GPU
    ColorPrint.cyan("[WHISPER] CUDA not detected - using 'turbo' model for CPU efficiency")
    return DEFAULT_MODEL_CPU


class WhisperSTTProvider(BaseSpeechRecognitionProvider):
    """Speech recognition through openai-whisper (tiny..turbo; auto 'large' on
    GPU, 'turbo' on CPU). Models come from the shared ``whisper_models`` cache."""

    def __init__(self) -> None:
        self._model_name: Optional[str] = None
        self._initialized = False
        self._mic_capture: Optional[MicrophoneCapture] = None
        self._system_capture: Optional[SystemAudioCapture] = None
        self._recognizing_signal = f"whisper_stt.{id(self)}.recognizing"
        THREAD_BUS.signal(self._recognizing_signal, False)
        init_serialized_owner(
            self,
            "whisper_stt.state",
            "WhisperSTTState",
            timeout=600.0,
        )

    @serialized_method
    def initialize(self, model_name: Optional[str] = None) -> bool:
        """Select and load the model (auto-picked by GPU when none was set)."""
        if self._initialized and model_name is None:
            return True
        if model_name:
            self._model_name = model_name
        elif self._model_name is None:
            self._model_name = _optimal_model()
            ColorPrint.blue(f"[WhisperSTT] Auto-selected model: {self._model_name}")
        if self._model_name not in WHISPER_MODELS:
            ColorPrint.red(f"[WhisperSTT] Invalid model: {self._model_name}")
            ColorPrint.yellow(f"[WhisperSTT] Available models: {', '.join(WHISPER_MODELS)}")
            return False
        if whisper_weights(self._model_name) is None:
            ColorPrint.red(f"[WhisperSTT] {self._model_name} weights missing - run {WHISPER_INSTALLER}")
            return False
        ColorPrint.blue(f"[WhisperSTT] Loading model: {self._model_name}...")
        if whisper_models.whisper(self._model_name) is None:
            ColorPrint.red("[WhisperSTT] Whisper not available")
            return False
        self._initialized = True
        ColorPrint.green(f"[WhisperSTT] Model loaded: {self._model_name}")
        return True

    def is_initialized(self) -> bool:
        return self._initialized

    @serialized_method
    def recognize_from_file(
        self,
        audio_file: Path,
        language: str = "zh-CN",
        task: str = "transcribe",
    ) -> Dict[str, Any]:
        """Transcribe (or translate to English) one audio/video file.

        Returns {success, text, confidence, language, provider, segments, error}."""
        if not self.initialize():
            return self._failure("Failed to initialize Whisper", language)
        model = whisper_models.whisper(self._model_name)

        audio_path = Path(audio_file)
        if not audio_path.exists():
            return self._failure(f"Audio file not found: {audio_file}", language)

        if is_video_file(audio_path):
            extracted = extract_audio_from_video(audio_path)
            if extracted is None:
                return self._failure("Failed to extract audio from video", language)
            audio_path = extracted

        if needs_conversion(audio_path):
            converted = convert_to_whisper_format(audio_path)
            if converted is None:
                return self._failure("Failed to convert audio format", language)
            audio_path = converted

        whisper_lang = self._convert_language_code(language)
        ColorPrint.blue(f"[WhisperSTT] Transcribing: {audio_path.name} (lang: {whisper_lang})")
        result = model.transcribe(
            str(audio_path),
            language=whisper_lang,
            task=task,
            verbose=False,
        )

        text = result.get("text", "").strip()
        detected_lang = result.get("language", whisper_lang)
        segments = result.get("segments", [])
        confidence = 0.0
        if segments:
            probs = [s.get("no_speech_prob", 0) for s in segments]
            confidence = 1.0 - (sum(probs) / len(probs))

        return {
            "success": True,
            "text": text,
            "confidence": confidence,
            "language": detected_lang,
            "provider": "Whisper",
            "segments": [
                {
                    "start": s.get("start", 0),
                    "end": s.get("end", 0),
                    "text": s.get("text", ""),
                }
                for s in segments
            ],
            "error": "",
        }

    @serialized_method
    def recognize_from_microphone(
        self,
        duration_seconds: float = 5.0,
        language: str = "zh-CN",
        device_index: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Record from microphone and recognize

        Args:
            duration_seconds: Duration to record in seconds
            language: Language code
            device_index: Optional microphone device index

        Returns:
            Dict with recognition result
        """
        if self._mic_capture is None:
            self._mic_capture = MicrophoneCapture(device_index)

        ColorPrint.blue(f"[WhisperSTT] Recording from microphone for {duration_seconds}s...")

        audio_path = self._mic_capture.record_for_duration(duration_seconds)
        if audio_path is None:
            return self._failure("Failed to record from microphone", language)

        result = self.recognize_from_file(audio_path, language)

        # Clean up temporary file
        audio_path.unlink(missing_ok=True)

        return result

    @serialized_method
    def recognize_from_system_audio(
        self,
        duration_seconds: float = 5.0,
        language: str = "zh-CN",
    ) -> Dict[str, Any]:
        """
        Record system audio and recognize (Windows only)

        Args:
            duration_seconds: Duration to record in seconds
            language: Language code

        Returns:
            Dict with recognition result
        """
        if self._system_capture is None:
            self._system_capture = SystemAudioCapture()

        if not self._system_capture.is_available():
            return self._failure("System audio capture not available", language)

        ColorPrint.blue(f"[WhisperSTT] Recording system audio for {duration_seconds}s...")

        audio_path = self._system_capture.record_for_duration(duration_seconds)
        if audio_path is None:
            return self._failure("Failed to record system audio", language)

        result = self.recognize_from_file(audio_path, language)

        # Clean up temporary file
        audio_path.unlink(missing_ok=True)

        return result

    @serialized_method
    def recognize_from_url(
        self,
        url: str,
        language: str = "zh-CN",
    ) -> Dict[str, Any]:
        """
        Download audio from URL and recognize

        Args:
            url: Audio URL
            language: Language code

        Returns:
            Dict with recognition result
        """
        ColorPrint.blue(f"[WhisperSTT] Downloading audio from URL...")

        audio_path = download_audio_from_url(url)
        if audio_path is None:
            return self._failure("Failed to download audio", language)

        result = self.recognize_from_file(audio_path, language)

        # Clean up temporary file
        audio_path.unlink(missing_ok=True)

        return result

    @serialized_method
    def recognize_from_video(
        self,
        video_file: Path,
        language: str = "zh-CN",
    ) -> Dict[str, Any]:
        """
        Extract audio from video and recognize

        Args:
            video_file: Path to video file
            language: Language code

        Returns:
            Dict with recognition result
        """
        return self.recognize_from_file(video_file, language)

    @serialized_method
    def recognize_continuous(
        self,
        audio_source: Any,
        language: str = "zh-CN",
        on_recognizing: Optional[Callable[[str], None]] = None,
        on_recognized: Optional[Callable[[str, float], None]] = None,
        on_error: Optional[Callable[[str], None]] = None,
    ) -> bool:
        """
        Start continuous recognition (not fully supported by Whisper)

        Whisper is designed for batch processing, not streaming.
        This implementation provides a simplified continuous mode
        by recording chunks and transcribing them.

        Args:
            audio_source: Audio source (None for microphone, "system" for system audio)
            language: Language code
            on_recognizing: Callback for partial results (not supported)
            on_recognized: Callback for final results
            on_error: Callback for errors

        Returns:
            True if started successfully
        """
        if THREAD_BUS.get_signal(self._recognizing_signal, False):
            if on_error:
                on_error("Already recognizing")
            return False

        THREAD_BUS.signal(self._recognizing_signal, True)

        # Start recognition in background thread
        start_bus_task(
            self._continuous_recognition_loop,
            audio_source,
            language,
            on_recognizing,
            on_recognized,
            on_error,
            thread_name="WhisperContinuousRecognitionThread",
        )

        return True

    def _continuous_recognition_loop(
        self,
        audio_source: Any,
        language: str,
        on_recognizing: Optional[Callable[[str], None]],
        on_recognized: Optional[Callable[[str, float], None]],
        on_error: Optional[Callable[[str], None]],
    ):
        """Continuous recognition loop"""
        chunk_duration = 5.0  # Record 5-second chunks

        while THREAD_BUS.get_signal(self._recognizing_signal, False):
            # Record chunk based on source
            if audio_source == "system":
                result = self.recognize_from_system_audio(chunk_duration, language)
            else:
                result = self.recognize_from_microphone(chunk_duration, language)

            if result["success"]:
                if on_recognized and result["text"]:
                    on_recognized(result["text"], result["confidence"])
            elif on_error:
                on_error(result.get("error", "Recognition failed"))

    @serialized_method
    def stop_recognition(self) -> bool:
        """
        Stop continuous recognition

        Returns:
            True if stopped successfully
        """
        if not THREAD_BUS.get_signal(self._recognizing_signal, False):
            return False

        THREAD_BUS.signal(self._recognizing_signal, False)

        if self._mic_capture and self._mic_capture.is_recording():
            self._mic_capture.stop_recording()

        if self._system_capture and self._system_capture.is_recording():
            self._system_capture.stop_recording()

        ColorPrint.blue("[WhisperSTT] Continuous recognition stopped")
        return True

    def is_available(self) -> bool:
        return module_present("whisper")

    @serialized_method
    def get_supported_languages(self) -> List[str]:
        """
        Get list of supported languages

        Returns:
            List of supported language codes
        """
        # Whisper supports 99+ languages
        # Here we list the most common ones
        return [
            "zh", "en", "ja", "ko", "fr", "de", "es", "pt", "ru", "ar",
            "hi", "it", "nl", "pl", "tr", "vi", "th", "id", "ms", "tl",
        ]

    @serialized_method
    def get_provider_name(self) -> str:
        """Get provider name"""
        return "Whisper"

    @serialized_method
    def get_model_name(self) -> str:
        """Get current model name"""
        return self._model_name

    @serialized_method
    def list_available_models(self) -> List[str]:
        """Get list of available Whisper models"""
        return WHISPER_MODELS.copy()

    @serialized_method
    def list_microphone_devices(self) -> List[Dict]:
        """List available microphone devices"""
        if self._mic_capture is None:
            self._mic_capture = MicrophoneCapture()
        return self._mic_capture.list_devices()

    @serialized_method
    def list_loopback_devices(self) -> List[Dict]:
        """List available loopback devices (Windows only)"""
        if self._system_capture is None:
            self._system_capture = SystemAudioCapture()
        return self._system_capture.list_loopback_devices()

    def _convert_language_code(self, language: str) -> Optional[str]:
        """
        Convert language code to Whisper format

        Args:
            language: Language code (e.g., "zh-CN", "en-US")

        Returns:
            Whisper language code (e.g., "zh", "en")
        """
        # Whisper uses ISO 639-1 codes
        if "-" in language:
            return language.split("-")[0].lower()
        return language.lower()

    def _failure(self, message: str, language: str) -> Dict[str, Any]:
        """Create failure result"""
        ColorPrint.red(f"[WhisperSTT] {message}")
        return {
            "success": False,
            "text": "",
            "confidence": 0.0,
            "language": language,
            "provider": "Whisper",
            "segments": [],
            "error": message,
        }


whisper_stt_provider = WhisperSTTProvider()

__all__ = ['WhisperSTTProvider', 'whisper_stt_provider']
