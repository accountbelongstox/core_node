"""
TTS utility package.

  - synthesize    : multi-engine orchestrator (edge -> streamelements -> sherpa
                    -> melotts -> gptsovits -> gtts_web -> azure).
  - tts_status    : engine-availability snapshot for the UI.
  - tts_orchestrator : module exposing ``synthesize`` for legacy callers.
"""

from . import tts_orchestrator
from .tts_orchestrator import (
    TTS_ENGINE_PRIORITY,
    best_engine,
    engine_available,
    synthesize,
    synthesize_engine,
    tts_status,
    tts_test,
)

__all__ = [
    "TTS_ENGINE_PRIORITY",
    "best_engine",
    "engine_available",
    "synthesize",
    "synthesize_engine",
    "tts_status",
    "tts_test",
    "tts_orchestrator",
]
