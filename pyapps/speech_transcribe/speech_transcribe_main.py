#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speech Transcribe Application

Real-time speech transcription application.
Captures audio from microphone or system audio and transcribes to text.

Entry point for speech_transcribe application.
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


def start():
    """
    Application entry point

    Following project standards:
    - Only ONE statement calling pylauncher
    - All logic orchestrated by launcher + pyctl
    """
    # Single launcher call - launches speech-only mode
    # RPC service is explicitly enabled here (not auto-started)
    launch_speech_only(
        mode="single",
        enable_rpc=True,  # Start RPC HTTP service
        rpc_port=59000,  # Port 59000 (changed from 8080 to avoid conflicts)
        rpc_host="0.0.0.0"
    )


if __name__ == "__main__":
    start()
