"""
TTS utility package.

  - synthesize    : multi-engine orchestrator (edge -> sherpa -> melotts -> gptsovits).
  - tts_status    : engine-availability snapshot for the UI.
  - tts_orchestrator : module exposing ``synthesize`` for legacy callers.
"""

from . import tts_orchestrator
from .tts_orchestrator import (
    TTS_ENGINE_PRIORITY,
    best_engine,
    engine_available,
    synthesize,
    tts_status,
)

__all__ = [
    "TTS_ENGINE_PRIORITY",
    "best_engine",
    "engine_available",
    "synthesize",
    "tts_status",
    "tts_orchestrator",
]
