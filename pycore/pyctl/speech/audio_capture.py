#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Audio Capture Thread

Opens an audio device stream, downmixes to mono, resamples to 16kHz, and pushes
PCM frames to an Azure PushAudioInputStream.

Backend globals (pyaudio, np) are imported from audio_devices.py - never
re-declared here, so import-time init/side-effects stay single-sourced.

TODO: move resample_to_16k_mono logic into pyutils/audio_utils/ (deferred reuse
batch) and consolidate with pyutils/whisper_stt/audio_capture.py.
"""

import threading
from typing import Any

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
# Backend globals: single-sourced in audio_devices.py (import, do not re-declare).
from pycore.pyctl.speech.audio_devices import pyaudio, np


class AudioCaptureThread(threading.Thread):
    """
    Thread for capturing audio and pushing to Azure Speech SDK

    Following project threading standards:
    - Inherits from threading.Thread
    - Name ends with "Thread"
    - No shared mutable state, no callbacks
    """

    def __init__(self, device_type: str, device_index: int, device_info: dict, push_stream: Any):
        """Initialize audio capture thread"""
        super().__init__(name="AudioCaptureThread", daemon=True)
        self.device_type = device_type
        self.device_index = device_index
        self.device_info = device_info
        self.push_stream = push_stream
        self.is_running = False

    def run(self):
        """Thread main function"""
        ColorPrint.blue(f"\n[Thread] Audio capture started")
        ColorPrint.blue(f"[Thread] Device: {self.device_info['name']}")

        # Audio parameters
        FORMAT = pyaudio.paInt16
        TARGET_RATE = 16000  # Azure requires 16kHz
        device_rate = int(self.device_info.get('defaultSampleRate', 48000))

        if self.device_type == 'loopback':
            device_channels = self.device_info.get('maxOutputChannels', 2)
        else:
            device_channels = self.device_info.get('maxInputChannels', 2)

        if device_channels < 1:
            device_channels = 2

        CHUNK = 1024

        ColorPrint.blue(f"[Thread] Device: {device_rate}Hz -> Target: {TARGET_RATE}Hz")

        audio = pyaudio.PyAudio()
        stream = None

        self.is_running = True

        # Open audio stream in shared mode (non-exclusive)
        # This prevents blocking other applications from using the audio device
        # NOTE: pyaudiowpatch automatically detects loopback devices via 'isLoopbackDevice' attribute
        # We don't need to specify 'as_loopback' parameter - it handles it internally
        stream_params = {
            'format': FORMAT,
            'channels': device_channels,
            'rate': device_rate,
            'input': True,
            'input_device_index': self.device_index,
            'frames_per_buffer': CHUNK
        }

        if self.device_type == 'loopback':
            ColorPrint.blue("[Thread] Opening loopback device (system audio)")
        else:
            ColorPrint.blue("[Thread] Opening microphone device")

        stream = audio.open(**stream_params)

        ColorPrint.green("[Thread] Audio stream opened")

        resample_ratio = TARGET_RATE / device_rate

        while self.is_running:
            data = stream.read(CHUNK, exception_on_overflow=False)

            # Convert to numpy
            audio_data = np.frombuffer(data, dtype=np.int16)

            # Convert to mono
            if device_channels > 1:
                audio_data = audio_data.reshape(-1, device_channels)
                audio_data = np.mean(audio_data, axis=1).astype(np.int16)

            # Resample
            if device_rate != TARGET_RATE:
                num_samples = int(len(audio_data) * resample_ratio)
                indices = np.linspace(0, len(audio_data) - 1, num_samples)
                audio_data = np.interp(indices, np.arange(len(audio_data)), audio_data).astype(np.int16)

            # Push to stream
            self.push_stream.write(audio_data.tobytes())

        if stream:
            stream.stop_stream()
            stream.close()
        audio.terminate()

        ColorPrint.yellow("[Thread] Audio capture stopped")

    def stop(self):
        """Stop audio capture"""
        self.is_running = False
