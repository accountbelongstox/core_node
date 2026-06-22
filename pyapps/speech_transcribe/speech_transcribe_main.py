#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speech Transcribe Main Entry Point

Single entry file following the base development guide. Always launches
dual-source transcription with configuration cache support.
"""

import sys
import os
from pathlib import Path

# Add project root to path for absolute imports
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Force unbuffered output for real-time logs
sys.stdout.reconfigure(line_buffering=True) if hasattr(sys.stdout, 'reconfigure') else None
os.environ['PYTHONUNBUFFERED'] = '1'

from pycore.pylauncher.launcher import launch_speech_only
from pycore.pyutils.common import speech_config
from pycore.pyfoundations.color_print import ColorPrint


def _print_cache_details() -> None:
    """Emit cache information without prompting the user."""
    if not speech_config.has_key("ui_transcription_mode"):
        return

    ColorPrint.green("\n[Configuration cache detected]")
    show_cache = os.environ.get("SPEECH_TRANSCRIBE_SHOW_CACHE", "").strip().lower()
    if show_cache in {"1", "true", "yes", "y"}:
        speech_config.print_config()


def start():
    """Launch the speech transcription workflow in dual-source mode."""

    ColorPrint.blue("\n" + "="*70)
    ColorPrint.blue("Speech Transcription Application")
    ColorPrint.blue("Single Entry Point with Configuration Caching")
    ColorPrint.blue("="*70)

    # Emit cache information when available (optional detailed dump via env var)
    _print_cache_details()

    # Hard-coded dual-source mode (microphone + system audio)
    mode = "dual"
    speech_config.set("ui_transcription_mode", mode)

    ColorPrint.green("\n[Launching dual-source mode (microphone + system audio)]")

    launch_speech_only(
        mode=mode,
        enable_rpc=True,
        rpc_port=59000,
        rpc_host="0.0.0.0"
    )


if __name__ == "__main__":
    start()
