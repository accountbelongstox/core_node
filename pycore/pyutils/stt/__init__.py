# -*- coding: utf-8 -*-
"""
STT (speech-to-text) utility package — the read-side mirror of pyutils/tts.

  - stt_status   : multi-engine availability snapshot for the UI
                   (faster-whisper -> whisper -> vosk -> azure).
  - transcribe   : run one engine on an audio file.
  - stt_test     : live round-trip test (synth a known phrase, then recognize it).
"""

from . import stt_orchestrator
from .stt_orchestrator import (
    STT_ENGINE_PRIORITY,
    best_engine,
    engine_available,
    stt_status,
    stt_test,
    transcribe,
)

__all__ = [
    "STT_ENGINE_PRIORITY",
    "best_engine",
    "engine_available",
    "stt_status",
    "stt_test",
    "transcribe",
    "stt_orchestrator",
]
