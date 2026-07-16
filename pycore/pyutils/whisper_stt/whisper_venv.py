# -*- coding: utf-8 -*-
"""Resolve the python interpreter for faster-whisper / CTranslate2.

Pycore uses a single system Python 3.13 (no venv). faster-whisper and
CTranslate2 run in-process in that interpreter; on GPU hosts CTranslate2 falls
back to CPU int8 so cu13 paddle/torch DLLs are never clobbered by cu12 libs.

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
