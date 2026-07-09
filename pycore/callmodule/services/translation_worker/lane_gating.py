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


def _cfg():
    """Lazily fetch the callmodule Config (kill-switch knobs)."""
    from pycore.callmodule.callmodule_config import Config
    return Config


def ai_translate_enabled() -> bool:
    """ai_translate capability: hard knob AND the assist ai_translate toggle."""
    try:
        if not bool(getattr(_cfg(), "AI_TRANSLATE_ENABLED", True)):
            return False
    except Exception:
        pass
    try:
        from pycore.pyctl.assist import assist_capability_enabled
        return assist_capability_enabled("ai_translate", True)
    except Exception:
        return True


def audio_enabled() -> bool:
    """Audio (word TTS) lane: the assist 'tts' capability (master enabled AND
    capabilities.tts). While the assist_laravel section is absent the legacy
    default (advertise) applies."""
    try:
        from pycore.pyctl.assist import assist_capability_enabled
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
        from pycore.pyctl.assist import assist_capability_enabled
        return assist_capability_enabled("subtitle", False)
    except Exception:
        return False


def poster_enabled() -> bool:
    """Poster lane: hard knob AND the live media_sync.fetch_poster toggle AND the
    assist poster toggle - unified so the Queue Center poster switch is
    authoritative (was decoupled from the assist-queue poster claim)."""
    try:
        if not bool(getattr(_cfg(), "POSTER_WORKER_ENABLED", True)):
            return False
    except Exception:
        pass
    try:
        from pycore.pyfoundations.system_paths import get_user_data_store
        section = get_user_data_store().get_section("media_sync") or {}
        if "fetch_poster" in section and not bool(section.get("fetch_poster")):
            return False
    except Exception:
        pass
    try:
        from pycore.pyctl.assist import assist_capability_enabled
        return assist_capability_enabled("poster", True)
    except Exception:
        return True


def sentence_audio_enabled() -> bool:
    """Sentence-audio lane: hard knob AND the assist sentence_audio toggle -
    now INDEPENDENT of the word-tts toggle (was a phantom alias of caps.tts)."""
    try:
        if not bool(getattr(_cfg(), "SENTENCE_AUDIO_WORKER_ENABLED", True)):
            return False
    except Exception:
        pass
    try:
        from pycore.pyctl.assist import assist_capability_enabled
        return assist_capability_enabled("sentence_audio", True)
    except Exception:
        return True


def image_enabled() -> bool:
    """'image' capability (word media): hard knob AND the assist image toggle.

    Backed by the unified AI gateway (pyctl.ai.generate_image). NOT a fake
    capability: if no image provider is configured at runtime, generate_image
    returns success=False and the handler reports the task 'failed' so Laravel
    re-routes/re-pends it - never stranded.
    """
    try:
        if not bool(getattr(_cfg(), "WORD_IMAGE_WORKER_ENABLED", True)):
            return False
    except Exception:
        pass
    try:
        from pycore.pyctl.assist import assist_capability_enabled
        return assist_capability_enabled("image", True)
    except Exception:
        return True


def stt_enabled() -> bool:
    """STT lane (remote_stt): assist 'stt' toggle. Defaults OFF so pycore only
    advertises the lane when explicitly enabled (local whisper/vosk is heavier
    than the other lanes). Backed by pyutils.stt.stt_orchestrator which picks
    the best available engine (faster-whisper/whisper/vosk/azure).
    """
    try:
        from pycore.pyctl.assist import assist_capability_enabled
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
