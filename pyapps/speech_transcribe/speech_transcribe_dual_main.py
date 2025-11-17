#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Compatibility wrapper for the consolidated speech_transcribe entry point.

Previously specific to dual-source launches; now it simply delegates to the
shared implementation inside speech_transcribe.py so that every legacy entry
point behaves identically.
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

from pyapps.speech_transcribe.speech_transcribe import start as unified_start


def start():
    """Delegate to the consolidated dual-source application."""

    unified_start()


if __name__ == "__main__":
    start()
