#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Silence Detector

Detects silence periods in audio for intelligent sentence segmentation.
"""

import time
from typing import Optional
from pycore.pyfoundations.third_party.api import get_third_package_numpy

np = get_third_package_numpy()


class SilenceDetector:
    """
    Detects silence periods in audio streams for sentence segmentation

    Uses volume threshold and duration to determine meaningful silence.
    Prevents premature sentence breaks by requiring minimum silence duration.
    """

    def __init__(self,
                 silence_threshold: float = 500.0,
                 min_silence_duration: float = 0.8,
                 max_silence_duration: float = 3.0):
        """
        Initialize silence detector

        Args:
            silence_threshold: RMS volume below which is considered silence
            min_silence_duration: Minimum seconds of silence before sentence break
            max_silence_duration: Maximum seconds to wait before forcing break
        """
        self.silence_threshold = silence_threshold
        self.min_silence_duration = min_silence_duration
        self.max_silence_duration = max_silence_duration

        self.silence_start_time: Optional[float] = None
        self.last_sound_time: float = time.time()
        self.is_in_silence = False

    def process_audio_chunk(self, audio_data: np.ndarray) -> bool:
        """
        Process audio chunk and determine if sentence break should occur

        Args:
            audio_data: Audio data as numpy array (int16)

        Returns:
            True if sentence break detected, False otherwise
        """
        # Calculate RMS (Root Mean Square) volume
        rms = np.sqrt(np.mean(audio_data.astype(np.float32) ** 2))

        current_time = time.time()

        # Check if current chunk is silence
        is_silent = rms < self.silence_threshold

        if is_silent:
            # Enter silence state
            if not self.is_in_silence:
                self.silence_start_time = current_time
                self.is_in_silence = True

            # Check silence duration
            if self.silence_start_time:
                silence_duration = current_time - self.silence_start_time

                # Sentence break conditions:
                # 1. Silence exceeds minimum duration (normal break)
                # 2. Silence exceeds maximum duration (force break)
                if silence_duration >= self.min_silence_duration:
                    # Reset state
                    self.reset()
                    return True

        else:
            # Sound detected - exit silence state
            if self.is_in_silence:
                # Silence was too short, ignore it
                self.is_in_silence = False
                self.silence_start_time = None

            self.last_sound_time = current_time

        # Check for max silence timeout (even if interrupted)
        if self.last_sound_time:
            total_silence = current_time - self.last_sound_time
            if total_silence >= self.max_silence_duration:
                self.reset()
                return True

        return False

    def reset(self):
        """Reset detector state"""
        self.silence_start_time = None
        self.last_sound_time = time.time()
        self.is_in_silence = False

    def get_silence_duration(self) -> float:
        """Get current silence duration in seconds"""
        if self.silence_start_time and self.is_in_silence:
            return time.time() - self.silence_start_time
        return 0.0
