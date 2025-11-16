#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Speech Transcribe Application

Unified entry point for speech transcription with mode selection.
Supports:
- Single-source transcription (microphone OR system audio)
- Dual-source transcription (microphone AND system audio)
- Configuration caching for quick restart
"""

import sys
import os
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True) if hasattr(sys.stdout, 'reconfigure') else None
os.environ['PYTHONUNBUFFERED'] = '1'

from pycore.pylauncher.launcher import launch_speech_only
from pycore.pyutils.config_cache import speech_config_cache
from pycore.pyfoundations.color_print import ColorPrint


def select_transcription_mode() -> str:
    """
    Select transcription mode with cache support

    Returns:
        'single' or 'dual'
    """
    # Check cache first
    cached_mode = speech_config_cache.get_transcription_mode()
    if cached_mode:
        ColorPrint.green(f"\n[Cached transcription mode: {cached_mode}]")
        use_cached = input("Use cached mode? (y/n) [default: y]: ").strip().lower()
        if use_cached != 'n':
            return cached_mode

    # Mode selection
    print("\n" + "="*70)
    print("Transcription Mode Selection")
    print("="*70)
    print("1 - Single-source (microphone OR system audio)")
    print("2 - Dual-source (microphone AND system audio with hotkeys)")
    print()
    print("Dual-source features:")
    print("  - Simultaneous mic + system audio transcription")
    print("  - Independent language settings per source")
    print("  - Ctrl+Click: Copy last system audio text")
    print("  - Ctrl+DoubleClick: Replay with TTS")

    while True:
        choice = input("\nSelect mode [default: 1]: ").strip()
        if choice == "":
            choice = "1"

        if choice == "1":
            mode = "single"
            speech_config_cache.set_transcription_mode(mode)
            return mode
        elif choice == "2":
            mode = "dual"
            speech_config_cache.set_transcription_mode(mode)
            return mode
        else:
            ColorPrint.yellow("Invalid choice, please try again")


def start():
    """
    Unified application entry point

    Following project standards:
    - Only ONE statement calling pylauncher
    - All logic orchestrated by launcher + pyctl
    """
    # Print header
    ColorPrint.blue("\n" + "="*70)
    ColorPrint.blue("Speech Transcription Application")
    ColorPrint.blue("Unified Entry Point with Configuration Caching")
    ColorPrint.blue("="*70)

    # Show current cache if exists
    if speech_config_cache.has_cache():
        ColorPrint.green("\n[Configuration cache exists]")
        show_cache = input("Show cached configuration? (y/n) [default: n]: ").strip().lower()
        if show_cache == 'y':
            speech_config_cache.print_cached_config()

    # Select mode
    mode = select_transcription_mode()

    ColorPrint.green(f"\n[Launching {mode} mode...]")

    # Launch speech-only mode with selected configuration
    launch_speech_only(mode=mode)


if __name__ == "__main__":
    start()
