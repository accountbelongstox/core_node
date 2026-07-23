# -*- coding: utf-8 -*-
"""Qwen3-TTS facade over the shared isolated venv manager."""

from pathlib import Path
from typing import Optional

from pycore.pyfoundations.isolated_venv import (
    ensure_venv as _ensure_venv,
    resolve_python as _resolve_python,
    venv_dir as _venv_dir,
    venv_ready as _venv_ready,
)


_ENGINE = "qwen3tts"


def venv_dir() -> Path:
    return _venv_dir(_ENGINE)


def resolve_python() -> Optional[str]:
    return _resolve_python(_ENGINE)


def venv_ready() -> bool:
    return _venv_ready(_ENGINE)


def ensure_venv(force: bool = False) -> Optional[str]:
    return _ensure_venv(_ENGINE, force=force)


def ensure_packages(venv_python: Optional[str] = None, force: bool = False) -> bool:
    del venv_python
    return ensure_venv(force=force) is not None


__all__ = ["ensure_packages", "ensure_venv", "resolve_python", "venv_dir", "venv_ready"]
