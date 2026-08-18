# -*- coding: utf-8 -*-
"""
Lane / capability gating for the translation worker.

Extracted verbatim (behavior-preserving) from the former translation_worker_service.py
monolith. Each gate is a pure function of the unified Assist user settings. They
hold no instance state, so they live as module functions rather than methods.
The worker and the handlers call them
directly (e.g. ``lane_gating.audio_enabled()``).

CIRCULAR-IMPORT SAFE: this module imports nothing from the translation_worker
package, so handlers may import it freely at module top.
"""

from typing import List

from pycore.pyctl.assist.assist_settings import assist_capability_enabled
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_CAPABILITIES_BY_ROLE,
    GLOBAL_TASK_FAST_LANE_CAPABILITIES,
)

def translation_enabled() -> bool:
    """Return the live prompt-translation capability setting."""
    return assist_capability_enabled("translation")


def subtitle_enabled() -> bool:
    """Return the live Assist subtitle capability setting.

    Defaults OFF (legacy_default=False): the SubtitleSearchController is absent
    at this baseline, so advertising remote_subtitle would claim tasks and fail
    them, burning retries. Enable explicitly (assist subtitle toggle) once the
    controller is restored.
    """
    try:
        return assist_capability_enabled("subtitle", False)
    except Exception:
        return False


def stt_enabled() -> bool:
    """STT lane (remote_stt): assist 'stt' toggle. Defaults OFF so pycore only
    advertises the lane when explicitly enabled (local whisper/vosk is heavier
    than the other lanes). Backed by pyutils.stt.stt_orchestrator which picks
    the best available engine (faster-whisper/whisper/vosk/azure).
    """
    try:
        return assist_capability_enabled("stt", False)
    except Exception:
        return False


def audio_enabled() -> bool:
    """Word-audio toggle state (legacy gate for non-lane callers).

    The remote_audio lane itself is owned by the dedicated word-audio worker
    (pyctl/tts/laravel_audio_worker.py) and is no longer advertised through
    effective_capabilities()/effective_processor_types()."""
    try:
        return shared_heartbeat_system.is_callback_enabled("tts_queue_poller")
    except Exception:
        return False


def sentence_audio_enabled() -> bool:
    """Sentence-audio toggle state (legacy gate for non-lane callers, e.g.
    prompt_translate). The remote_sentence_audio lane is owned by the
    dedicated sentence-audio worker (pyctl/tts/laravel_audio_worker.py)."""
    try:
        return shared_heartbeat_system.is_callback_enabled("tts_sentence_worker")
    except Exception:
        return False


def effective_capabilities() -> List[str]:
    """Capabilities advertised on register and status."""
    caps: List[str] = []
    if stt_enabled():
        caps.append(GLOBAL_TASK_CAPABILITIES_BY_ROLE["stt"])
    # audio / sentence_audio are intentionally NOT advertised here: those lanes
    # belong to the dedicated workers (pyctl/tts/laravel_audio_worker.py), so
    # the translation worker never races them for the same audio tasks.
    return caps


def effective_processor_types(worker) -> List[str]:
    """The lane set advertised this tick.

    Include only lanes whose existing Queue Center/heartbeat toggle is live.
    The shared fast lane is advertised when at least one advertised capability
    belongs to the central fast-capability set. Re-register fires when this set
    changes; ``worker`` supplies contract-derived execution-type constants.
    """
    types: List[str] = []
    if translation_enabled():
        types.append(worker.TRANSLATION_PROCESSOR_TYPE)
    if subtitle_enabled():
        types.append(worker.SUBTITLE_EXECUTION_TYPE)
    if stt_enabled():
        types.append(worker.STT_EXECUTION_TYPE)
    # remote_audio / remote_sentence_audio are owned by the dedicated audio
    # workers (pyctl/tts/laravel_audio_worker.py); not advertised here.
    capabilities = effective_capabilities()
    if any(capability in GLOBAL_TASK_FAST_LANE_CAPABILITIES for capability in capabilities):
        types.insert(0, worker.TRANSLATION_FAST_PROCESSOR_TYPE)
    # De-dup preserving order.
    seen: set = set()
    ordered: List[str] = []
    for t in types:
        if t not in seen:
            seen.add(t)
            ordered.append(t)
    return ordered
