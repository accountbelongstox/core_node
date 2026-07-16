# -*- coding: utf-8 -*-
"""
Lane / capability gating for the translation worker.

Extracted verbatim (behavior-preserving) from the former translation_worker_service.py
monolith. Each gate is a pure function of the callmodule Config kill-switch knobs +
the layered assist (user-data) toggles - they hold NO instance state, so they live
as module functions rather than methods. The worker and the handlers call them
directly (e.g. ``lane_gating.audio_enabled()``).

CIRCULAR-IMPORT SAFE: this module imports nothing from the translation_worker
package (only lazy pyctl/callmodule_config/pyfoundations lookups inside the
functions), so handlers may import it freely at module top.
"""

from typing import List

from pycore.callmodule.callmodule_config import Config

from pycore.pyctl.assist import assist_capability_enabled




def _cfg():
    """Lazily fetch the callmodule Config (kill-switch knobs)."""
    return Config


def ai_translate_enabled() -> bool:
    """ai_translate capability: hard knob AND the assist ai_translate toggle."""
    try:
        if not bool(getattr(_cfg(), "AI_TRANSLATE_ENABLED", True)):
            return False
    except Exception:
        pass
    try:
        return assist_capability_enabled("ai_translate", True)
    except Exception:
        return True


def audio_enabled() -> bool:
    """Audio (word TTS / edge-tts) lane - FALLBACK only.

    Puter.js (browser-side, pycore-manager Queue Center 1000-word batch bar) is
    the PRIMARY word-audio generator. The pycore edge-tts lane runs ONLY when
    ``Config.WORD_AUDIO_EDGE_FALLBACK`` is set (env ``PYCORE_WORD_AUDIO_EDGE_FALLBACK=1``)
    - i.e. when Puter.js is unavailable / no browser is open. When the fallback
    is off (default), pycore does not advertise the audio lane; word audio is
    produced by Puter.js uploading to /word/audio/upload. Also gated by the
    assist 'tts' capability (master enabled AND capabilities.tts)."""
    try:
        if not bool(getattr(_cfg(), "WORD_AUDIO_EDGE_FALLBACK", False)):
            return False
    except Exception:
        return False
    try:
        return assist_capability_enabled("tts", True)
    except Exception:
        return True


def subtitle_enabled() -> bool:
    """Subtitle lane: hard knob AND the assist subtitle toggle.

    Defaults OFF (legacy_default=False): the SubtitleSearchController is absent
    at this baseline, so advertising remote_subtitle would claim tasks and fail
    them, burning retries. Enable explicitly (assist subtitle toggle) once the
    controller is restored.
    """
    try:
        if not bool(getattr(_cfg(), "SUBTITLE_SEARCH_WORKER_ENABLED", True)):
            return False
    except Exception:
        pass
    try:
        return assist_capability_enabled("subtitle", False)
    except Exception:
        return False


def poster_enabled() -> bool:
    """Poster lane disabled in pycore — delegated to apps/mcp-chrome task center."""
    return False


def sentence_audio_enabled() -> bool:
    """Sentence-audio lane: hard knob AND the assist sentence_audio toggle -
    now INDEPENDENT of the word-tts toggle (was a phantom alias of caps.tts)."""
    try:
        if not bool(getattr(_cfg(), "SENTENCE_AUDIO_WORKER_ENABLED", True)):
            return False
    except Exception:
        pass
    try:
        return assist_capability_enabled("sentence_audio", True)
    except Exception:
        return True


def image_enabled() -> bool:
    """Word-media AI image lane disabled — delegated to apps/mcp-chrome."""
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


def effective_capabilities() -> List[str]:
    """Capabilities advertised on register AND status: audio,translate (+ai_translate,+image)."""
    caps = ["audio", "translate"]
    if ai_translate_enabled():
        caps.append("ai_translate")
    if image_enabled():
        caps.append("image")
    if stt_enabled():
        caps.append("stt")
    return caps


def effective_processor_types(worker) -> List[str]:
    """The lane set advertised this tick.

    Always include the fast lane + legacy translation lane; append each
    dedicated lane only while its enable gate is live-on. Re-register fires when
    this set changes (handled in poll_once). ``worker`` supplies the
    execution-type class constants.
    """
    types = [worker.TRANSLATION_FAST_PROCESSOR_TYPE, worker.TRANSLATION_PROCESSOR_TYPE]
    if audio_enabled():
        types.append(worker.AUDIO_EXECUTION_TYPE)
    if subtitle_enabled():
        types.append(worker.SUBTITLE_EXECUTION_TYPE)
    if poster_enabled():
        types.append(worker.POSTER_EXECUTION_TYPE)
    if sentence_audio_enabled():
        types.append(worker.SENTENCE_AUDIO_EXECUTION_TYPE)
    if stt_enabled():
        types.append(worker.STT_EXECUTION_TYPE)
    # De-dup preserving order.
    seen: set = set()
    ordered: List[str] = []
    for t in types:
        if t not in seen:
            seen.add(t)
            ordered.append(t)
    return ordered
