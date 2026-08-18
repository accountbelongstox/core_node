# -*- coding: utf-8 -*-
"""Persistent TTS priority, cooldown, and display-command policy (canonical: pyutils.tts)."""

import os
import shlex
import time
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    SerializedValue,
    SerializedWorkerThread,
    call_serialized,
)
from pycore.pyutils.common.user_data_store import user_data_store
from pycore.pyutils.common.engine_registry import (
    merge_engine_priority,
    parse_engine_priority,
)
from pycore.pyutils.tts.edge.command import build_edge_tts_command
from pycore.pyutils.tts.qwen.config import default_speed as qwen_default_speed

_USER_FRONT_ORDER = (
    "gptsovits", "streamelements", "sherpa", "melotts", "edge", "gtts_web", "azure",
)
_REMAINING_ENGINES = (
    "chattts", "cosyvoice", "fishspeech", "qwen3tts", "bark", "parler",
    "voxcpm2", "kokoro", "f5tts",
)
_DEFAULT_PRIORITY = _USER_FRONT_ORDER + _REMAINING_ENGINES
_KNOWN_ENGINES = _DEFAULT_PRIORITY
_SENTENCE_FRONT_ORDER = ("qwen3tts",)
_SENTENCE_BACK_ORDER = ("edge",)
_DEFAULT_SENTENCE_PRIORITY = _SENTENCE_FRONT_ORDER + tuple(
    engine for engine in _DEFAULT_PRIORITY
    if engine not in _SENTENCE_FRONT_ORDER and engine not in _SENTENCE_BACK_ORDER
) + _SENTENCE_BACK_ORDER
_WORD_FRONT_ORDER = ("edge", "streamelements", "gtts_web")
_WORD_EXCLUDED = ("qwen3tts",)
_DEFAULT_WORD_PRIORITY = _WORD_FRONT_ORDER + tuple(
    engine for engine in _DEFAULT_PRIORITY
    if engine not in _WORD_FRONT_ORDER and engine not in _WORD_EXCLUDED
)
# Agent History articles: local engines only — never edge / cloud TTS.
CLOUD_TTS_ENGINES = frozenset({"edge", "streamelements", "gtts_web", "azure"})
# Agent-history article audio is PINNED to the local Qwen3-TTS multi-sentence
# pipeline. Long single-shot synthesis degrades on every autoregressive TTS
# (QwenLM/Qwen3-TTS#258 - second-half noise; 2noise/ChatTTS#113 - one
# generation <=30s, best <=25s; SWivid/F5-TTS - 30s per generation), and only
# the Qwen server implements the sentence-chunk pipeline. A single-engine
# order means NO fallback: a failed synthesis retries the pipeline item
# instead of silently publishing degraded single-shot audio from the next
# engine in the chain (the pre-pin fallback era produced ChattTS-sourced
# articles with degraded audio).
_AGENT_HISTORY_PINNED_TTS = ("qwen3tts",)
_LEGACY_SAVED_ORDERS: Tuple[Tuple[str, ...], ...] = (
    ("edge", "sherpa", "melotts", "gptsovits", "azure"),
    ("edge", "sherpa", "melotts", "gptsovits", "gtts_web", "azure"),
    ("edge", "streamelements", "sherpa", "melotts", "gptsovits", "gtts_web", "azure"),
)
_LOCALE_BY_LANG = {
    "en": "en-US",
    "zh": "zh-CN",
    "ja": "ja-JP",
    "ko": "ko-KR",
    "es": "es-ES",
    "fr": "fr-FR",
    "de": "de-DE",
    "it": "it-IT",
    "pt": "pt-PT",
    "ru": "ru-RU",
    "ar": "ar-SA",
    "hi": "hi-IN",
    "th": "th-TH",
    "vi": "vi-VN",
    "lo": "lo-LA",
}
_LANGUAGE_ALIASES = {
    "english": "en",
    "chinese": "zh",
    "spanish": "es",
    "french": "fr",
    "german": "de",
    "italian": "it",
    "portuguese": "pt",
    "russian": "ru",
    "arabic": "ar",
    "hindi": "hi",
    "thai": "th",
    "vietnamese": "vi",
    "lao": "lo",
    "japanese": "ja",
    "korean": "ko",
}
_LANGUAGES_BY_ENGINE = {
    "edge": frozenset(_LOCALE_BY_LANG),
    "azure": frozenset(_LOCALE_BY_LANG),
    "gtts_web": frozenset({"en", "zh", "ja", "ko", "es", "fr"}),
    "streamelements": frozenset({"en"}),
    "sherpa": frozenset({"en", "zh"}),
    "kokoro": frozenset({"en", "zh"}),
    "melotts": frozenset({"en", "zh", "ja", "ko", "es", "fr"}),
    "chattts": frozenset({"en", "zh"}),
    "cosyvoice": frozenset({"en", "zh", "ja", "ko", "yue"}),
    "fishspeech": frozenset({"en", "zh", "ja"}),
    "qwen3tts": frozenset({"en", "zh", "ja", "ko"}),
    "gptsovits": frozenset({"en", "zh", "ja", "ko", "yue"}),
    "bark": frozenset({
        "en", "de", "es", "fr", "hi", "it", "ja", "ko", "pl", "pt", "ru", "tr", "zh",
    }),
    "parler": frozenset({"en"}),
    "voxcpm2": frozenset({"en", "zh"}),
    "f5tts": frozenset({"en", "zh"}),
}
_ACCENT_AWARE_ENGINES = ("edge", "streamelements")
_ENGINE_ENV_OVERRIDES: Dict[str, Dict[str, str]] = {
    "qwen3tts": {"QWEN3TTS_INSTRUCT": "instruct", "QWEN3TTS_SPEAKER": "speaker"},
    "parler": {"PARLER_DESCRIPTION": "description"},
    "voxcpm2": {"VOXCPM2_CFG": "cfg_value", "VOXCPM2_TIMESTEPS": "timesteps"},
    "cosyvoice": {"COSYVOICE_INSTRUCT": "instruct", "COSYVOICE_SPK_ID": "speaker_id"},
    "gptsovits": {"GPTSOVITS_PROMPT_TEXT": "prompt_text", "GPTSOVITS_PROMPT_LANG": "prompt_lang"},
    "chattts": {"CHATTTS_VOICE": "voice"},
}
_CAP_SECTION = "capability_priorities"
_CHAIN_SECTION = "task_capability_chains"
_ORCHESTRATOR_STATE_QUEUE = "tts.orchestrator.state"
_orchestrator_state: Dict[str, Any] = {
    "startup_reported": False,
    "edge_cooldown_s": float(os.environ.get("TTS_EDGE_COOLDOWN_S", "60") or "60"),
    "edge_cooldown_until": 0.0,
    "last_engine_synth_error": None,
}
_ORCHESTRATOR_STATE_WORKER = SerializedWorkerThread(
    _ORCHESTRATOR_STATE_QUEUE,
    "TTSOrchestratorStateThread",
)
TTS_ENGINE_PRIORITY: tuple[str, ...] = _DEFAULT_PRIORITY
TTS_SENTENCE_PRIORITY: tuple[str, ...] = _DEFAULT_SENTENCE_PRIORITY
TTS_WORD_PRIORITY: tuple[str, ...] = _DEFAULT_WORD_PRIORITY
_TTS_PRIORITY_STATE = SerializedValue(
    (TTS_ENGINE_PRIORITY, TTS_SENTENCE_PRIORITY, TTS_WORD_PRIORITY),
    "TTSPriorityStateThread",
)
_ORCHESTRATOR_STATE_WORKER.start()


def _get_orchestrator_state(key: str) -> Any:
    return _orchestrator_state.get(key)


def _set_orchestrator_state(key: str, value: Any) -> Any:
    _orchestrator_state[key] = value
    return value


def claim_tts_startup_report() -> bool:
    if _orchestrator_state["startup_reported"]:
        return False
    _orchestrator_state["startup_reported"] = True
    return True


def default_tts_engine_priority() -> tuple[str, ...]:
    return _DEFAULT_PRIORITY


def default_sentence_tts_priority() -> tuple[str, ...]:
    return _DEFAULT_SENTENCE_PRIORITY


def default_word_tts_priority() -> tuple[str, ...]:
    return _DEFAULT_WORD_PRIORITY


def _is_legacy_tts_order(saved: tuple[str, ...]) -> bool:
    return bool(saved) and (
        saved in _LEGACY_SAVED_ORDERS or saved[0] in ("edge", "chattts")
    )


def _persist_tts_order(order: tuple[str, ...]) -> None:
    try:
        store = user_data_store
        capabilities = dict(store.get_section(_CAP_SECTION) or {})
        capabilities["tts"] = list(order)
        store.set_section(_CAP_SECTION, capabilities)
        chains = dict(store.get_section(_CHAIN_SECTION) or {})
        chains["voice_tts"] = list(order)
        store.set_section(_CHAIN_SECTION, chains)
    except Exception:  # noqa: BLE001
        pass


def _migrate_legacy_tts_order(saved: tuple[str, ...]) -> tuple[str, ...]:
    if not _is_legacy_tts_order(saved):
        return saved
    _persist_tts_order(_DEFAULT_PRIORITY)
    ColorPrint.blue("[TTS] Migrated legacy engine priority to gptsovits-first default")
    return _DEFAULT_PRIORITY


def _read_persisted_profile(capability: str) -> Optional[tuple[str, ...]]:
    try:
        store = user_data_store
        value = (store.get_section(_CAP_SECTION) or {}).get(capability)
        if isinstance(value, list) and value:
            saved = tuple(str(item).strip() for item in value if str(item).strip())
            return _migrate_legacy_tts_order(saved) if capability == "tts" else saved
        if capability == "tts":
            legacy = (store.get_section(_CHAIN_SECTION) or {}).get("voice_tts")
            if isinstance(legacy, list) and legacy:
                saved = tuple(str(item).strip() for item in legacy if str(item).strip())
                return _migrate_legacy_tts_order(saved)
    except Exception:  # noqa: BLE001
        pass
    return None


def _merge_engine_order(saved: Optional[tuple[str, ...]]) -> tuple[str, ...]:
    return merge_engine_priority(_KNOWN_ENGINES, saved)


def _load_profile(
    environment_key: str,
    capability: str,
    default: tuple[str, ...],
) -> tuple[str, ...]:
    raw = (os.environ.get(environment_key) or "").strip()
    if raw:
        parts = parse_engine_priority(raw)
        if parts:
            return _merge_engine_order(parts)
    return _merge_engine_order(_read_persisted_profile(capability) or default)


def reload_tts_priority() -> tuple[str, ...]:
    default = _load_profile("TTS_ENGINE_PRIORITY", "tts", _DEFAULT_PRIORITY)
    sentence = _load_profile(
        "TTS_SENTENCE_PRIORITY", "sentence_tts", _DEFAULT_SENTENCE_PRIORITY
    )
    word = _load_profile("TTS_WORD_PRIORITY", "word_tts", _DEFAULT_WORD_PRIORITY)
    _TTS_PRIORITY_STATE.set((default, sentence, word))
    return default


def configured_tts_priority(profile: str = "default") -> tuple[str, ...]:
    default, sentence, word = _TTS_PRIORITY_STATE.get()
    if profile == "sentence":
        return sentence
    if profile == "word":
        return tuple(engine for engine in word if engine not in _WORD_EXCLUDED)
    if profile == "agent_history":
        # Pinned single-engine contract - see _AGENT_HISTORY_PINNED_TTS.
        return _AGENT_HISTORY_PINNED_TTS
    return default


def is_word_text(text: str) -> bool:
    cleaned = (text or "").strip()
    return bool(cleaned) and all(char not in cleaned for char in (" ", "\t", "\n"))


def normalize_tts_language(language: Optional[str]) -> str:
    value = str(language or "en").strip().lower().replace("_", "-") or "en"
    code = value.split("-", 1)[0]
    return _LANGUAGE_ALIASES.get(code, code)


def tts_locale(language: Optional[str]) -> str:
    return _LOCALE_BY_LANG.get(normalize_tts_language(language), "")


def tts_engine_supports_language(engine: str, language: Optional[str]) -> bool:
    supported = _LANGUAGES_BY_ENGINE.get((engine or "").strip().lower())
    return supported is not None and normalize_tts_language(language) in supported


def edge_in_cooldown() -> bool:
    until = call_serialized(
        _ORCHESTRATOR_STATE_QUEUE,
        _get_orchestrator_state,
        "edge_cooldown_until",
    )
    return time.monotonic() < float(until or 0.0)


def mark_edge_cooldown() -> float:
    cooldown = get_edge_cooldown_seconds()
    call_serialized(
        _ORCHESTRATOR_STATE_QUEUE,
        _set_orchestrator_state,
        "edge_cooldown_until",
        time.monotonic() + cooldown,
    )
    return cooldown


def edge_cooldown_remaining() -> float:
    until = call_serialized(
        _ORCHESTRATOR_STATE_QUEUE,
        _get_orchestrator_state,
        "edge_cooldown_until",
    )
    remaining = float(until or 0.0) - time.monotonic()
    return round(remaining, 1) if remaining > 0 else 0.0


def get_edge_cooldown_seconds() -> float:
    return float(call_serialized(
        _ORCHESTRATOR_STATE_QUEUE,
        _get_orchestrator_state,
        "edge_cooldown_s",
    ))


def set_edge_cooldown_seconds(seconds: Any) -> float:
    value = get_edge_cooldown_seconds()
    try:
        value = max(0.0, min(3600.0, float(seconds)))
    except (TypeError, ValueError):
        pass
    return float(call_serialized(
        _ORCHESTRATOR_STATE_QUEUE,
        _set_orchestrator_state,
        "edge_cooldown_s",
        value,
    ))


def normalize_tts_accent(accent: Optional[str]) -> Optional[str]:
    value = (accent or "").strip().lower()
    return value if value in ("us", "uk") else None


def apply_tts_engine_extra_params(
    engine: str,
    extra_params: Dict[str, Any],
) -> Dict[str, Optional[str]]:
    applied: Dict[str, Optional[str]] = {}
    for env_key, param_key in _ENGINE_ENV_OVERRIDES.get(engine, {}).items():
        value = extra_params.get(param_key)
        if value is None:
            continue
        applied[env_key] = os.environ.get(env_key)
        os.environ[env_key] = str(value)
        ColorPrint.blue(f"[tts] {engine} override {env_key}={value}")
    return applied


def restore_tts_engine_extra_params(applied: Dict[str, Optional[str]]) -> None:
    for env_key, previous in applied.items():
        if previous is None:
            os.environ.pop(env_key, None)
        else:
            os.environ[env_key] = previous


def tts_engine_actual_accent(
    engine: str,
    language: Optional[str],
    accent: Optional[str],
) -> str:
    if not (language or "en").strip().lower().startswith("en"):
        return "unknown"
    if engine in _ACCENT_AWARE_ENGINES:
        return "uk" if accent == "uk" else "us"
    return "us" if engine == "azure" else "unknown"


def tts_rate_to_speed(rate: Optional[str]) -> float:
    if not rate:
        return 1.0
    value = str(rate).strip()
    try:
        if value.endswith("%"):
            return max(0.25, 1.0 + float(value[:-1]) / 100.0)
        return max(0.25, float(value))
    except ValueError:
        return 1.0


def sentence_tts_cache_identity(
    accent: Optional[str],
    gender: Optional[str],
    rate: Optional[str] = None,
) -> Tuple[str, str, str, str]:
    speaker = (os.environ.get("QWEN3TTS_SPEAKER") or "").strip()
    voice = f"{accent or 'any'}:{gender or 'female'}"
    speaker_field = f"{speaker}|{voice}" if speaker else voice
    instruct = (os.environ.get("QWEN3TTS_INSTRUCT") or "").strip()
    model = (os.environ.get("QWEN3TTS_MODEL") or "").strip()
    # Speed changes the produced audio (qwen time-stretches by default), so it
    # is part of the cache key: explicit rate -> its factor, no rate -> the
    # qwen server default (QWEN3TTS_SPEED), mirroring the wire contract.
    explicit_rate = (rate or "").strip()
    speed = (
        f"{tts_rate_to_speed(explicit_rate):g}"
        if explicit_rate
        else f"{qwen_default_speed():g}"
    )
    return speaker_field, instruct, model, speed


def tts_variant_result(
    variant: Dict[str, Any],
    output_path: Path,
    success: bool,
    provider: str,
    error: str = "",
    synth_command: str = "",
) -> Dict[str, Any]:
    accent = variant.get("accent")
    return {
        "variant_key": (variant.get("key") or "").strip(),
        "path": str(output_path) if success else "",
        "success": bool(success),
        "provider": provider or "none",
        "accent": accent if accent else None,
        "gender": variant.get("gender") or "female",
        "error": error or None,
        "synth_command": synth_command,
    }


_SYNTH_COMMAND_TEXT_LIMIT = 160


def truncate_command_text(text: str) -> str:
    """Synth-command lines are diagnostics; cap embedded text so an article-sized
    payload cannot flood the log on every engine attempt."""
    value = text or ""
    if len(value) <= _SYNTH_COMMAND_TEXT_LIMIT:
        return value
    return f"{value[:_SYNTH_COMMAND_TEXT_LIMIT]}…(+{len(value) - _SYNTH_COMMAND_TEXT_LIMIT} chars)"


def format_tts_synth_command(
    engine: str,
    text: str,
    language: Optional[str] = None,
    output_path: Optional[Path] = None,
    accent: Optional[str] = None,
    rate: Optional[str] = None,
    gender: Optional[str] = None,
    edge_voice: Optional[Callable[[Optional[str], Optional[str], Optional[str]], str]] = None,
) -> str:
    language_value = (language or "en").strip() or "en"
    output = str(output_path) if output_path else "<output.mp3>"
    text_value = truncate_command_text(text)
    engine_value = (engine or "unknown").strip().lower()
    accent_value = normalize_tts_accent(accent)
    if engine_value == "edge" and edge_voice is not None:
        voice = edge_voice(language_value, accent_value, gender)
        proxy = (os.environ.get("EDGE_TTS_PROXY") or "").strip()
        command = build_edge_tts_command(
            "edge-tts",
            voice,
            text_value,
            Path(output),
            proxy=proxy or None,
        )
        return shlex.join(command)
    templates = {
        "streamelements": f'streamelements TTS voice={"Amy" if accent_value == "uk" else "Joanna"} lang={language_value}',
        "sherpa": f'sherpa-onnx OfflineTts.generate(lang={language_value}, speed={tts_rate_to_speed(rate)})',
        "melotts": f'melotts synthesize(lang={language_value}, speed={tts_rate_to_speed(rate)})',
        "chattts": f'chattts POST /v1/audio/speech lang={language_value}',
        "cosyvoice": f'cosyvoice POST /inference_sft lang={language_value}',
        "f5tts": f'f5tts POST /process lang={language_value}',
        "fishspeech": f'fishspeech POST /v1/tts lang={language_value}',
        "qwen3tts": f'qwen3tts POST /queue/submit lang={language_value}',
        "bark": f'bark BarkModel.generate(lang={language_value})',
        "parler": "parler_tts.generate(description=PARLER_DESCRIPTION)",
        "voxcpm2": f'voxcpm2.generate(lang={language_value}, speed={tts_rate_to_speed(rate)})',
        "kokoro": f'kokoro sherpa-onnx OfflineTts.generate(lang={language_value}, speed={tts_rate_to_speed(rate)})',
        "gptsovits": f'gptsovits POST /tts lang={language_value}',
        "gtts_web": f'gTTS(lang={language_value[:2]})',
        "azure": f'azure-cognitiveservices speech lang={language_value} rate={rate or "+0%"}',
    }
    prefix = templates.get(engine_value, f'{engine_value} synthesize(lang={language_value}, accent={accent_value or "any"})')
    return f'{prefix} text={shlex.quote(text_value)} -> {shlex.quote(output)}'


reload_tts_priority()
