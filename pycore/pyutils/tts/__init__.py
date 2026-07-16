"""
TTS utility package.

  - synthesize    : multi-engine orchestrator. Default priority (local AI first,
                    azure last): chattts -> cosyvoice -> fishspeech -> qwen3tts
                    -> bark -> parler -> voxcpm2 -> kokoro -> gptsovits -> f5tts
                    -> melotts -> sherpa -> edge -> streamelements -> gtts_web
                    -> azure (override via env TTS_ENGINE_PRIORITY).
  - tts_status    : engine-availability snapshot for the UI.
  - tts_orchestrator : module exposing ``synthesize`` for legacy callers.

Library registry + GPU/CPU model tiers: pycore/pyutils/common/capabilities.py
and pycore/tts_install_assets/tts_model_tiers.py (surfaced in UI Libraries panel).
"""

from . import tts_orchestrator
from .tts_orchestrator import (
    TTS_ENGINE_PRIORITY,
    best_engine,
    engine_available,
    report_tts_engine_startup,
    synthesize,
    synthesize_engine,
    tts_status,
    tts_test,
)

__all__ = [
    "TTS_ENGINE_PRIORITY",
    "best_engine",
    "engine_available",
    "report_tts_engine_startup",
    "synthesize",
    "synthesize_engine",
    "tts_status",
    "tts_test",
    "tts_orchestrator",
]
