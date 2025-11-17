#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speech Transcribe Application (Dual Mode Only)

Single consolidated entry point for the speech transcription workflow.
The application always launches dual-source (microphone + system audio)
transcription while still honoring configuration cache data.
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


def _print_cache_details() -> None:
    """Emit cache information without prompting the user."""
    if not speech_config_cache.has_cache():
        return

    ColorPrint.green("\n[Configuration cache detected]")
    show_cache = os.environ.get("SPEECH_TRANSCRIBE_SHOW_CACHE", "").strip().lower()
    if show_cache in {"1", "true", "yes", "y"}:
        speech_config_cache.print_cached_config()


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

    # Emit cache information when available (optional detailed dump via env var)
    _print_cache_details()

    # Hard-coded dual-source mode (microphone + system audio)
    mode = "dual"
    speech_config_cache.set_transcription_mode(mode)

    ColorPrint.green("\n[Launching dual-source mode (microphone + system audio)]")

    # Launch speech-only mode with selected configuration
    launch_speech_only(
        mode=mode,
        enable_rpc=True,
        rpc_port=59000,
        rpc_host="0.0.0.0"
    )


if __name__ == "__main__":
    start()
