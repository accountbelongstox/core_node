#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speech Transcribe Dual-Source Application

Real-time dual-source speech transcription with hotkey control.

Features:
- Simultaneous microphone + system audio transcription
- Independent language settings per audio source
- Hotkey control (Ctrl+Click, Ctrl+DoubleClick)
- Clipboard integration
- TTS playback

Entry point following pycore standards: Single pyctl call only.
"""

from pycore.pylauncher.launcher import launch_speech_only


def start():
    """
    Application entry point

    Following pycore standard: Only ONE statement calling pylauncher.
    """
    # Launch dual-source transcription mode
    launch_speech_only(mode="dual")


if __name__ == "__main__":
    start()
