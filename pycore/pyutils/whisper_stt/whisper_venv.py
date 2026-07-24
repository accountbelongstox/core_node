# -*- coding: utf-8 -*-
"""Resolve the python interpreter for faster-whisper / CTranslate2.

Pycore uses one shared Python runtime. faster-whisper and CTranslate2 run
in-process; GPU is selected only when CTranslate2 matches the centralized CUDA
major, otherwise inference falls back to CPU int8 without a second CUDA stack.

Resolution order:
  1. env PYCORE_WHISPER_PYTHON (explicit override)
  2. sys.executable (the running pycore worker)
"""
import os
import sys
from pathlib import Path
from typing import Optional


def resolve_whisper_python() -> str:
    """Return the python executable to run faster-whisper under."""
    env_override = os.environ.get("PYCORE_WHISPER_PYTHON")
    if env_override and Path(env_override).is_file():
        return env_override
    return sys.executable


def whisper_venv_active() -> bool:
    """True iff a dedicated whisper interpreter differs from the main worker."""
    return resolve_whisper_python() != sys.executable
