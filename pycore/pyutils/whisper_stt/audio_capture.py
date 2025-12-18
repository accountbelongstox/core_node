#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Audio Capture Module for Whisper STT

Provides audio capture from various sources:
- Microphone input
- System audio capture (Windows WASAPI loopback)

Dependencies:
- pyaudio (for microphone)
- pyaudiowpatch (for Windows system audio capture)

THREAD_BUS Integration:
- Checks is_shutdown_requested() in recording loops
- Triggers 'stt.audio.captured' events on successful recording completion
- No shutdown handler needed (utility class, not a persistent service thread)
- Backwards compatible: keeps existing functionality
"""

import io
import wave
import platform
import tempfile
import threading
import time
from pathlib import Path
from typing import Optional, Callable, Any

from pycore.pyfoundations import ColorPrint
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyfoundations.third_party import (
    get_third_package_pyaudio,
    get_third_package_pyaudiowpatch,
    get_third_package_numpy,
)
from pycore.pyutils.whisper_stt.audio_utils import (
    get_whisper_cache_dir,
    WHISPER_SAMPLE_RATE,
    WHISPER_CHANNELS,
)


class AudioCaptureConfig:
    """Configuration for audio capture"""
    sample_rate: int = WHISPER_SAMPLE_RATE
    channels: int = WHISPER_CHANNELS
    chunk_size: int = 1024
    format_bits: int = 16  # 16-bit audio


class MicrophoneCapture:
    """
    Capture audio from microphone

    Usage:
        capture = MicrophoneCapture()
        capture.start_recording()
        time.sleep(5)  # Record for 5 seconds
        audio_path = capture.stop_recording()
    """

    def __init__(self, device_index: Optional[int] = None):
        """
        Initialize microphone capture

        Args:
            device_index: Optional device index, None for default microphone
        """
        self._device_index = device_index
        self._audio = None
        self._stream = None
        self._frames = []
        self._is_recording = False
        self._recording_thread = None
        self._config = AudioCaptureConfig()

    def _get_pyaudio(self):
        """Get PyAudio instance"""
        pyaudio = get_third_package_pyaudio()
        if pyaudio is None:
            ColorPrint.red("[MicrophoneCapture] PyAudio not available")
            ColorPrint.yellow("[MicrophoneCapture] Install with: pip install pyaudio")
            return None
        return pyaudio

    def list_devices(self) -> list:
        """
        List available audio input devices

        Returns:
            List of device info dictionaries
        """
        pyaudio = self._get_pyaudio()
        if pyaudio is None:
            return []

        audio = pyaudio.PyAudio()
        devices = []

        for i in range(audio.get_device_count()):
            device_info = audio.get_device_info_by_index(i)
            if device_info.get('maxInputChannels', 0) > 0:
                devices.append({
                    'index': i,
                    'name': device_info.get('name', 'Unknown'),
                    'channels': device_info.get('maxInputChannels', 0),
                    'sample_rate': int(device_info.get('defaultSampleRate', 0)),
                })

        audio.terminate()
        return devices

    def start_recording(self) -> bool:
        """
        Start recording from microphone

        Returns:
            True if recording started successfully
        """
        if self._is_recording:
            ColorPrint.yellow("[MicrophoneCapture] Already recording")
            return False

        pyaudio = self._get_pyaudio()
        if pyaudio is None:
            return False

        self._audio = pyaudio.PyAudio()
        self._frames = []

        # Open stream
        self._stream = self._audio.open(
            format=pyaudio.paInt16,
            channels=self._config.channels,
            rate=self._config.sample_rate,
            input=True,
            input_device_index=self._device_index,
            frames_per_buffer=self._config.chunk_size,
        )

        self._is_recording = True
        self._recording_thread = threading.Thread(target=self._record_loop, daemon=True)
        self._recording_thread.start()

        ColorPrint.green("[MicrophoneCapture] Recording started")
        return True

    def _record_loop(self):
        """
        Recording loop (runs in separate thread)

        THREAD_BUS Integration:
        - Checks is_shutdown_requested() for graceful shutdown
        """
        while self._is_recording and self._stream:
            # THREAD_BUS Integration: Check if global shutdown was requested
            if THREAD_BUS.is_shutdown_requested():
                ColorPrint.yellow("[MicrophoneCapture] THREAD_BUS shutdown detected, stopping recording...")
                self._is_recording = False
                break

            data = self._stream.read(self._config.chunk_size, exception_on_overflow=False)
            self._frames.append(data)

    def stop_recording(self, output_path: Optional[Path] = None) -> Optional[Path]:
        """
        Stop recording and save to file

        Args:
            output_path: Optional output path, auto-generated if not provided

        Returns:
            Path to recorded audio file, or None on failure

        THREAD_BUS Integration:
        - Triggers 'stt.audio.captured' event on successful recording
        """
        if not self._is_recording:
            ColorPrint.yellow("[MicrophoneCapture] Not recording")
            return None

        self._is_recording = False

        # Wait for recording thread to finish
        if self._recording_thread:
            self._recording_thread.join(timeout=1.0)

        # Close stream
        if self._stream:
            self._stream.stop_stream()
            self._stream.close()
            self._stream = None

        if self._audio:
            self._audio.terminate()
            self._audio = None

        if not self._frames:
            ColorPrint.yellow("[MicrophoneCapture] No audio recorded")
            return None

        # Generate output path if not provided
        if output_path is None:
            cache_dir = get_whisper_cache_dir()
            timestamp = int(time.time())
            output_path = cache_dir / f"mic_recording_{timestamp}.wav"

        # Save to WAV file
        with wave.open(str(output_path), 'wb') as wf:
            wf.setnchannels(self._config.channels)
            wf.setsampwidth(2)  # 16-bit = 2 bytes
            wf.setframerate(self._config.sample_rate)
            wf.writeframes(b''.join(self._frames))

        ColorPrint.green(f"[MicrophoneCapture] Saved recording: {output_path}")

        # THREAD_BUS Integration: Trigger audio captured event
        # Calculate duration before clearing frames
        frame_count = len(self._frames)
        duration_seconds = frame_count * self._config.chunk_size / self._config.sample_rate if frame_count > 0 else 0

        THREAD_BUS.trigger_event('stt.audio.captured', {
            'source': 'microphone',
            'file_path': str(output_path),
            'duration_seconds': duration_seconds,
            'sample_rate': self._config.sample_rate,
            'channels': self._config.channels
        }, async_mode=True)

        self._frames = []
        return output_path

    def record_for_duration(
        self,
        duration_seconds: float,
        output_path: Optional[Path] = None
    ) -> Optional[Path]:
        """
        Record for a specific duration

        Args:
            duration_seconds: Duration to record in seconds
            output_path: Optional output path

        Returns:
            Path to recorded audio file
        """
        if not self.start_recording():
            return None

        time.sleep(duration_seconds)
        return self.stop_recording(output_path)

    def is_recording(self) -> bool:
        """Check if currently recording"""
        return self._is_recording


class SystemAudioCapture:
    """
    Capture system audio (WASAPI loopback on Windows)

    Usage:
        capture = SystemAudioCapture()
        capture.start_recording()
        time.sleep(5)  # Record for 5 seconds
        audio_path = capture.stop_recording()
    """

    def __init__(self):
        """Initialize system audio capture"""
        self._audio = None
        self._stream = None
        self._frames = []
        self._is_recording = False
        self._recording_thread = None
        self._config = AudioCaptureConfig()
        self._loopback_device = None

    def _get_pyaudiowpatch(self):
        """Get PyAudioWPatch instance (Windows only)"""
        if platform.system() != "Windows":
            ColorPrint.red("[SystemAudioCapture] System audio capture is only supported on Windows")
            return None

        pyaudiowpatch = get_third_package_pyaudiowpatch()
        if pyaudiowpatch is None:
            ColorPrint.red("[SystemAudioCapture] PyAudioWPatch not available")
            ColorPrint.yellow("[SystemAudioCapture] Install with: pip install pyaudiowpatch")
            return None
        return pyaudiowpatch

    def _find_loopback_device(self, pyaudiowpatch):
        """Find WASAPI loopback device"""
        audio = pyaudiowpatch.PyAudio()

        # Find default WASAPI output device
        default_speakers = None
        for i in range(audio.get_device_count()):
            device_info = audio.get_device_info_by_index(i)
            # Look for WASAPI loopback device
            if device_info.get('isLoopbackDevice', False):
                default_speakers = device_info
                break

        if default_speakers is None:
            # Try to find default output device
            wasapi_info = audio.get_host_api_info_by_type(pyaudiowpatch.paWASAPI)
            default_speakers = audio.get_device_info_by_index(
                wasapi_info.get('defaultOutputDevice', 0)
            )

        audio.terminate()
        return default_speakers

    def list_loopback_devices(self) -> list:
        """
        List available loopback devices (Windows only)

        Returns:
            List of loopback device info dictionaries
        """
        pyaudiowpatch = self._get_pyaudiowpatch()
        if pyaudiowpatch is None:
            return []

        audio = pyaudiowpatch.PyAudio()
        devices = []

        for i in range(audio.get_device_count()):
            device_info = audio.get_device_info_by_index(i)
            if device_info.get('isLoopbackDevice', False):
                devices.append({
                    'index': i,
                    'name': device_info.get('name', 'Unknown'),
                    'channels': device_info.get('maxInputChannels', 0),
                    'sample_rate': int(device_info.get('defaultSampleRate', 0)),
                })

        audio.terminate()
        return devices

    def start_recording(self) -> bool:
        """
        Start recording system audio

        Returns:
            True if recording started successfully
        """
        if self._is_recording:
            ColorPrint.yellow("[SystemAudioCapture] Already recording")
            return False

        pyaudiowpatch = self._get_pyaudiowpatch()
        if pyaudiowpatch is None:
            return False

        self._loopback_device = self._find_loopback_device(pyaudiowpatch)
        if self._loopback_device is None:
            ColorPrint.red("[SystemAudioCapture] No loopback device found")
            return False

        self._audio = pyaudiowpatch.PyAudio()
        self._frames = []

        # Open loopback stream
        self._stream = self._audio.open(
            format=pyaudiowpatch.paInt16,
            channels=int(self._loopback_device.get('maxInputChannels', 2)),
            rate=int(self._loopback_device.get('defaultSampleRate', 44100)),
            input=True,
            input_device_index=self._loopback_device.get('index'),
            frames_per_buffer=self._config.chunk_size,
        )

        self._is_recording = True
        self._recording_thread = threading.Thread(target=self._record_loop, daemon=True)
        self._recording_thread.start()

        ColorPrint.green(f"[SystemAudioCapture] Recording started (device: {self._loopback_device.get('name', 'Unknown')})")
        return True

    def _record_loop(self):
        """
        Recording loop (runs in separate thread)

        THREAD_BUS Integration:
        - Checks is_shutdown_requested() for graceful shutdown
        """
        while self._is_recording and self._stream:
            # THREAD_BUS Integration: Check if global shutdown was requested
            if THREAD_BUS.is_shutdown_requested():
                ColorPrint.yellow("[SystemAudioCapture] THREAD_BUS shutdown detected, stopping recording...")
                self._is_recording = False
                break

            data = self._stream.read(self._config.chunk_size, exception_on_overflow=False)
            self._frames.append(data)

    def stop_recording(self, output_path: Optional[Path] = None) -> Optional[Path]:
        """
        Stop recording and save to file

        Args:
            output_path: Optional output path, auto-generated if not provided

        Returns:
            Path to recorded audio file, or None on failure

        THREAD_BUS Integration:
        - Triggers 'stt.audio.captured' event on successful recording
        """
        if not self._is_recording:
            ColorPrint.yellow("[SystemAudioCapture] Not recording")
            return None

        self._is_recording = False

        # Wait for recording thread to finish
        if self._recording_thread:
            self._recording_thread.join(timeout=1.0)

        # Close stream
        if self._stream:
            self._stream.stop_stream()
            self._stream.close()
            self._stream = None

        sample_rate = int(self._loopback_device.get('defaultSampleRate', 44100))
        channels = int(self._loopback_device.get('maxInputChannels', 2))

        if self._audio:
            self._audio.terminate()
            self._audio = None

        if not self._frames:
            ColorPrint.yellow("[SystemAudioCapture] No audio recorded")
            return None

        # Generate output path if not provided
        if output_path is None:
            cache_dir = get_whisper_cache_dir()
            timestamp = int(time.time())
            output_path = cache_dir / f"system_audio_{timestamp}.wav"

        # Save to WAV file
        with wave.open(str(output_path), 'wb') as wf:
            wf.setnchannels(channels)
            wf.setsampwidth(2)  # 16-bit = 2 bytes
            wf.setframerate(sample_rate)
            wf.writeframes(b''.join(self._frames))

        ColorPrint.green(f"[SystemAudioCapture] Saved recording: {output_path}")

        # Calculate duration before clearing frames
        frame_count = len(self._frames)
        duration_seconds = frame_count * self._config.chunk_size / sample_rate if frame_count > 0 else 0

        self._frames = []

        # Convert to Whisper format (16kHz mono)
        from pycore.pyutils.whisper_stt.audio_utils import convert_to_whisper_format
        converted_path = convert_to_whisper_format(output_path)
        if converted_path and converted_path != output_path:
            output_path.unlink(missing_ok=True)
            output_path = converted_path

        # THREAD_BUS Integration: Trigger audio captured event
        THREAD_BUS.trigger_event('stt.audio.captured', {
            'source': 'system_audio',
            'file_path': str(output_path),
            'duration_seconds': duration_seconds,
            'sample_rate': sample_rate,
            'channels': channels,
            'device_name': self._loopback_device.get('name', 'Unknown') if self._loopback_device else 'Unknown'
        }, async_mode=True)

        return output_path

    def record_for_duration(
        self,
        duration_seconds: float,
        output_path: Optional[Path] = None
    ) -> Optional[Path]:
        """
        Record for a specific duration

        Args:
            duration_seconds: Duration to record in seconds
            output_path: Optional output path

        Returns:
            Path to recorded audio file
        """
        if not self.start_recording():
            return None

        time.sleep(duration_seconds)
        return self.stop_recording(output_path)

    def is_recording(self) -> bool:
        """Check if currently recording"""
        return self._is_recording

    def is_available(self) -> bool:
        """Check if system audio capture is available"""
        if platform.system() != "Windows":
            return False
        return get_third_package_pyaudiowpatch() is not None


__all__ = [
    'AudioCaptureConfig',
    'MicrophoneCapture',
    'SystemAudioCapture',
]
