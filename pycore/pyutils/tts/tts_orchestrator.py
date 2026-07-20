# -*- coding: utf-8 -*-
"""
TTS orchestrator — ONE entry that picks the highest-priority AVAILABLE local
TTS engine and synthesizes text to MP3.

Priority (highest first), per project decision — local AI / neural models first:
    1. chattts        — ChatTTS local api (dialogue; laughs/sighs/oral tags).
    2. cosyvoice      — CosyVoice local api (multilingual clone + emotion).
    3. fishspeech     — Fish Speech / Fish Audio (clone; local server or SDK).
    4. qwen3tts       — Qwen3-TTS class-C HTTP server in a DEDICATED venv (Alibaba;
                        managed lifecycle, single-active, 3-min idle; see spec §5).
    5. bark           — Bark via transformers (Suno; expressive; 3.13 native).
    6. parler         — Parler-TTS in-process (HF; voice description; 3.13 native).
    7. voxcpm2        — VoxCPM2 in-process (OpenBMB multilingual clone).
    8. kokoro         — Kokoro-82M via sherpa-onnx (lightweight zh/en offline).
    9. gptsovits      — Local GPT-SoVITS api server (voice clone; opt-in).
   10. f5tts          — F5-TTS local api (flow-matching fast clone).
   11. melotts        — MeloTTS (torch GPU->CPU auto; zh/en mixed).
   12. sherpa         — Sherpa-ONNX Kokoro offline (CPU, never fails when installed).
   13. edge           — Microsoft Edge TTS (online; serialized process-wide).
   14. streamelements — StreamElements speech endpoint (online; requires
                        STREAMELEMENTS_API_KEY; us->Joanna / uk->Amy, English only).
   15. gtts_web       — Google Translate web TTS (online, keyless; ~200 char cap,
                        accent not selectable).
   16. azure          — Azure Speech cloud (free F0 ~0.5M chars/mo) — API fallback,
                        used when every engine above is unavailable/failed.

Official perfect-support environments for each engine are documented in
pycore/tts_install_assets/tts_model_tiers.py (OFFICIAL_ENV) and echoed in each
*_engine.py module docstring. Install scripts resolve GPU/CPU model tiers from
that module and print [idempotent] skip lines when prerequisites are satisfied.

The cloud engines being last enforces the "local-first; API only if local can't"
rule automatically (synthesize() falls through engines in order). Add more free
cloud SDKs (google/polly) the same way and append them here.

Accent: synthesize(accent="us"|"uk") threads the requested English accent to
the engines that can honor it (edge picks an en-US/en-GB voice, streamelements
picks Joanna/Amy); other engines still run unchanged, and the result's
``accent`` key reports the accent ACTUALLY produced ("us"|"uk"|"unknown") so
callers can tag accent_fallback.

Override order with env ``TTS_ENGINE_PRIORITY`` (e.g. ``edge->sherpa->melotts``).

Lifecycle: this module owns priority only. For every class-B/class-C candidate it
calls ``prepare_server_for_use(name)`` and wraps the synth in
``managed_services.using(name)`` so the shared lifecycle contract (single-active,
busy protection, 3-minute idle unload) applies. Class-C engines (qwen3tts, melotts
and gptsovits are isolated-venv HTTP servers) synthesize over HTTP. See
development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §4-§5.
"""

import contextlib
import importlib.metadata
import os
import shutil
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import (
    get_edge_tts_voice_cache_dir,
    get_user_data_store,
)
from . import sentence_audio_cache
from pycore.pyutils.edge_tts.config import TTSConfig
from pycore.pyutils.edge_tts.edge_tts_client import get_edge_tts_client
from pycore.pyutils.common.model_tiers import runtime_engine_model
from .tts_engine_probe import engine_installed, engine_unavailable_reason
from .tts_service_manager import (
    invalidate_server_engine_cache,
    is_server_engine,
    prepare_server_for_use,
    server_runtime_status,
    record_server_use,
)
from pycore.pyutils.common.managed_service import managed_services
from pycore.pyutils.common import model_load_status
from . import (
    azure_engine,
    bark_engine,
    chattts_engine,
    cosyvoice_engine,
    f5tts_engine,
    fishspeech_engine,
    gptsovits_engine,
    gtts_web_engine,
    kokoro_engine,
    melotts_engine,
    parler_engine,
    qwen3tts_engine,
    sherpa_engine,
    streamelements_engine,
    voxcpm2_engine,
)

# Version shown in tts_status(). qwen3tts + melotts are intentionally ABSENT: their
# packages (qwen-tts / melo) live in their isolated venvs, not the main interpreter,
# so probing importlib.metadata here would report nothing (or a stray/wrong copy).
# See spec §5-§6.
_ENGINE_VERSIONS = {
    "sherpa": "sherpa-onnx",
    "kokoro": "sherpa-onnx",
    "voxcpm2": "voxcpm",
}


def _dist_version(dist: str) -> Optional[str]:
    try:
        return importlib.metadata.version(dist)
    except Exception:
        return None


# gptsovits-first user default; remaining local-AI engines follow; azure last.
_USER_FRONT_ORDER = (
    "gptsovits", "streamelements", "sherpa", "melotts", "edge", "gtts_web", "azure",
)
_REMAINING_ENGINES = (
    "chattts", "cosyvoice", "fishspeech", "qwen3tts", "bark", "parler",
    "voxcpm2", "kokoro", "f5tts",
)
_DEFAULT_PRIORITY = _USER_FRONT_ORDER + _REMAINING_ENGINES
_KNOWN_ENGINES = _DEFAULT_PRIORITY

# Sentence-library TTS: qwen3tts first (highest-quality local neural); the rest
# follow as fallback ONLY when qwen3tts is unavailable/fails (first-success
# fallback in synthesize() means later engines never run while qwen3tts works).
# edge is the LAST-resort fallback (online, serialized) — excluded from the
# middle of the chain and appended at the very end.
# Used by tts_sentence_worker_service + the assist sentence_audio lane.
_SENTENCE_FRONT_ORDER = ("qwen3tts",)
_SENTENCE_BACK_ORDER = ("edge",)
_DEFAULT_SENTENCE_PRIORITY = _SENTENCE_FRONT_ORDER + tuple(
    e for e in _DEFAULT_PRIORITY
    if e not in _SENTENCE_FRONT_ORDER and e not in _SENTENCE_BACK_ORDER
) + _SENTENCE_BACK_ORDER

# Word-library TTS fallback (after the real-pronunciation chain): edge first -
# fast, online, accent-aware; words are short (no internal space) so they
# synthesize sequentially (no parallel batch - edge holds a process-wide lock).
# qwen3tts (GPU-heavy class-C server) is never used for single words — excluded
# from the default chain AND filtered out of persisted/merged orders by
# _priority("word") so a stale saved order cannot reintroduce it.
_WORD_FRONT_ORDER = ("edge", "streamelements", "gtts_web")
_WORD_EXCLUDED = ("qwen3tts",)
_DEFAULT_WORD_PRIORITY = _WORD_FRONT_ORDER + tuple(
    e for e in _DEFAULT_PRIORITY
    if e not in _WORD_FRONT_ORDER and e not in _WORD_EXCLUDED
)
# Exact saved orders that predate the gptsovits-first default — auto-upgrade.
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
}
_ENGINE_NOTES = {
    "chattts": "ChatTTS local api (dialogue; laughs/sighs; CHATTTS_URL)",
    "cosyvoice": "CosyVoice local api (multilingual clone; COSYVOICE_URL)",
    "fishspeech": "Fish Speech / Fish Audio (FISHSPEECH_URL or FISH_API_KEY)",
    "qwen3tts": "Qwen3-TTS class-C HTTP server (isolated venv; managed lifecycle)",
    "bark": "Bark via transformers (suno/bark; expressive; Python 3.13 native)",
    "parler": "Parler-TTS in-process (HF; voice-description steering)",
    "voxcpm2": "VoxCPM2 in-process (OpenBMB; GPU preferred; pip voxcpm)",
    "kokoro": "Kokoro-82M sherpa-onnx offline (zh/en; KOKORO_TTS_MODEL_DIR)",
    "f5tts": "F5-TTS local api (fast flow-matching clone; F5TTS_URL)",
    "edge": "Microsoft Edge TTS (online; serialized)",
    "streamelements": (
        "StreamElements speech (online; needs STREAMELEMENTS_API_KEY in "
        ".secret_keys; en only, us/uk voices)"
    ),
    "sherpa": "Sherpa-ONNX Kokoro offline (CPU)",
    "melotts": "MeloTTS offline (torch GPU->CPU auto)",
    "gptsovits": "GPT-SoVITS local api server (voice clone)",
    "gtts_web": "Google Translate web TTS (online, keyless; ~200 char cap)",
    "azure": "Azure Speech cloud (free F0; API fallback)",
}
# Engines that can honor a requested English accent (us/uk voice selection).
_ACCENT_AWARE_ENGINES = ("edge", "streamelements")
# Concurrency class per engine — a capability annotation only (workers still
# synthesize sequentially); the UI labels "parallel-safe / serial" from this.
#   serial     — edge: process-wide synth lock (403 protection), never parallel.
#   cloud      — class-A cloud APIs: no lock, parallel OK (own rate limits).
#   in_process — class-B in-process models: parallel OK (locks guard load only).
#   server     — class-C HTTP servers: concurrent HTTP OK (single-active between
#                class-C engines); qwen3tts also has a GPU batch endpoint.
_ENGINE_CONCURRENCY = {
    "edge": "serial",
    "streamelements": "cloud",
    "gtts_web": "cloud",
    "azure": "cloud",
    "sherpa": "in_process",
    "kokoro": "in_process",
    "bark": "in_process",
    "parler": "in_process",
    "voxcpm2": "in_process",
    "qwen3tts": "server",
    "melotts": "server",
    "gptsovits": "server",
    "chattts": "server",
    "cosyvoice": "server",
    "fishspeech": "server",
    "f5tts": "server",
}
_TIER_ENGINES = frozenset({
    "cosyvoice", "fishspeech", "qwen3tts", "bark", "voxcpm2", "kokoro",
    "sherpa", "gptsovits",
})
_CAP_SECTION = "capability_priorities"
_CHAIN_SECTION = "task_capability_chains"
_STARTUP_REPORTED = False

# Availability gate for the sentence chain: qwen3tts is the PRIMARY sentence
# engine whenever its isolated venv is ready (the managed service then starts /
# loads the HTTP server on demand). qwen3tts NEVER runs in the main interpreter —
# it is a separate subprocess venv (port 57210) that owns its own device — so the
# MAIN interpreter's CUDA state is the wrong signal and is intentionally NOT
# consulted (a headless / sanitized-PATH main interpreter would else needlessly
# demote a GPU-backed qwen server). Only when the venv is NOT ready is qwen3tts
# demoted to the END of the chain so the request transparently falls back to the
# rest (edge/sherpa/...). The user directive: qwen3tts first, fall back only when
# unavailable.
_GPU_SENTENCE_ENGINE = "qwen3tts"


def _apply_sentence_gpu_gate(order: tuple[str, ...]) -> tuple[str, ...]:
    """Keep qwen3tts at the front of the sentence chain whenever its isolated venv
    is ready; demote it to the end only when it is unavailable so the request
    transparently falls back to the rest of the chain. Demote-only: a user who
    reordered the sentence chain keeps their order. The main-interpreter CUDA state
    is deliberately NOT consulted — qwen3tts is an out-of-process venv server that
    owns its own device, so gating on this interpreter's GPU would wrongly demote a
    GPU-backed qwen server on a headless / sanitized-PATH host."""
    if _GPU_SENTENCE_ENGINE not in order:
        return order
    if engine_available(_GPU_SENTENCE_ENGINE):
        return order
    rest = tuple(e for e in order if e != _GPU_SENTENCE_ENGINE)
    return rest + (_GPU_SENTENCE_ENGINE,)


def default_tts_engine_priority() -> tuple[str, ...]:
    """Canonical default chain (shared by UI constants and capability settings)."""
    return _DEFAULT_PRIORITY


def default_sentence_tts_priority() -> tuple[str, ...]:
    """Sentence-library default chain - qwen3tts first (falls through only on failure)."""
    return _DEFAULT_SENTENCE_PRIORITY


def default_word_tts_priority() -> tuple[str, ...]:
    """Word-library default chain - edge first (used after real-pronunciation chain)."""
    return _DEFAULT_WORD_PRIORITY


def _read_persisted_profile(cap_key: str) -> Optional[tuple[str, ...]]:
    """User-saved engine order for one capability profile (None when never saved).

    Reads ``capability_priorities[<cap_key>]``. The ``tts`` profile also honors
    the legacy ``task_capability_chains.voice_tts`` mirror + legacy migration.
    """
    try:
        store = get_user_data_store()
        section = store.get_section(_CAP_SECTION) or {}
        raw = section.get(cap_key)
        if isinstance(raw, list) and raw:
            saved = tuple(
                str(e).strip() for e in raw if isinstance(e, str) and e.strip()
            )
            if cap_key == "tts":
                return _migrate_legacy_tts_order(saved)
            return saved
        # tts profile legacy mirror (task_capability_chains.voice_tts).
        if cap_key == "tts":
            chains = store.get_section(_CHAIN_SECTION) or {}
            raw2 = chains.get("voice_tts")
            if isinstance(raw2, list) and raw2:
                saved = tuple(
                    str(e).strip() for e in raw2 if isinstance(e, str) and e.strip()
                )
                return _migrate_legacy_tts_order(saved)
    except Exception:  # noqa: BLE001
        pass
    return None


def _load_profile(
    env_var: str,
    cap_key: str,
    default: tuple[str, ...],
) -> tuple[str, ...]:
    """Resolve one priority profile: env override > persisted > default, merged
    over the known engine list so a stale/partial saved order never drops one."""
    raw = (os.environ.get(env_var) or "").strip()
    if raw:
        parts = [p.strip() for p in raw.replace(",", "->").split("->") if p.strip()]
        if parts:
            return _merge_engine_order(tuple(parts))
    return _merge_engine_order(_read_persisted_profile(cap_key) or default)


def reload_tts_priority() -> tuple[str, ...]:
    """Rebuild the runtime priority profiles: env > user_data > default.

    Loads three profiles - ``tts`` (default/global), ``sentence_tts``
    (qwen3tts-first), ``word_tts`` (edge-first) - from ``capability_priorities``
    (env ``TTS_ENGINE_PRIORITY`` / ``TTS_SENTENCE_PRIORITY`` / ``TTS_WORD_PRIORITY``).
    Returns the default/global order (sentence/word are read via ``_priority()``).
    """
    global TTS_ENGINE_PRIORITY, TTS_SENTENCE_PRIORITY, TTS_WORD_PRIORITY
    TTS_ENGINE_PRIORITY = _load_profile("TTS_ENGINE_PRIORITY", "tts", _DEFAULT_PRIORITY)
    TTS_SENTENCE_PRIORITY = _load_profile(
        "TTS_SENTENCE_PRIORITY", "sentence_tts", _DEFAULT_SENTENCE_PRIORITY
    )
    TTS_WORD_PRIORITY = _load_profile(
        "TTS_WORD_PRIORITY", "word_tts", _DEFAULT_WORD_PRIORITY
    )
    return TTS_ENGINE_PRIORITY


def _priority(profile: str = "default") -> tuple[str, ...]:
    """Runtime priority tuple for a profile: default|sentence|word.

    The sentence profile is GPU-gated: qwen3tts stays first only when a CUDA GPU
    is available and qwen3tts is usable; otherwise it is demoted to the end so the
    request falls back to the rest of the chain. The word profile filters
    ``_WORD_EXCLUDED`` (qwen3tts) at the return point so a persisted/merged order
    can never reintroduce the GPU engine for single words."""
    if profile == "sentence":
        return _apply_sentence_gpu_gate(TTS_SENTENCE_PRIORITY)
    if profile == "word":
        return tuple(e for e in TTS_WORD_PRIORITY if e not in _WORD_EXCLUDED)
    return TTS_ENGINE_PRIORITY


def is_word_text(text: str) -> bool:
    """Classify a TTS request as a word when it has no internal whitespace."""
    cleaned = (text or "").strip()
    if not cleaned:
        return False
    return " " not in cleaned and "\t" not in cleaned and "\n" not in cleaned


def _is_legacy_tts_order(saved: tuple[str, ...]) -> bool:
    """True when a persisted order should be upgraded to the gptsovits-first default."""
    if not saved:
        return False
    if saved in _LEGACY_SAVED_ORDERS:
        return True
    # Older edge-first presets (any length) — superseded by gptsovits-first.
    if saved[0] == "edge":
        return True
    # Previous chattts-first local-AI default — superseded.
    if saved[0] == "chattts":
        return True
    return False


def _persist_tts_order(order: tuple[str, ...]) -> None:
    """Write the same order into capability_priorities.tts and task_capability_chains.voice_tts."""
    try:
        store = get_user_data_store()
        caps = dict(store.get_section(_CAP_SECTION) or {})
        caps["tts"] = list(order)
        store.set_section(_CAP_SECTION, caps)
        chains = dict(store.get_section(_CHAIN_SECTION) or {})
        chains["voice_tts"] = list(order)
        store.set_section(_CHAIN_SECTION, chains)
    except Exception:  # noqa: BLE001
        pass


def _migrate_legacy_tts_order(
    saved: tuple[str, ...],
) -> tuple[str, ...]:
    """Upgrade known legacy saved orders to the gptsovits-first canonical default."""
    if not _is_legacy_tts_order(saved):
        return saved
    migrated = _DEFAULT_PRIORITY
    try:
        _persist_tts_order(migrated)
        ColorPrint.blue(
            "[TTS] Migrated legacy engine priority to gptsovits-first default "
            f"({' -> '.join(migrated)})"
        )
    except Exception:  # noqa: BLE001
        pass
    return migrated


def _read_persisted_tts_order() -> Optional[tuple[str, ...]]:
    """User-saved engine order from capability_priorities.tts or voice_tts chain.

    Kept for backward-compat callers; the profile-aware loader is
    ``_read_persisted_profile("tts")`` (which supersedes this for reload_tts_priority).
    """
    return _read_persisted_profile("tts")


def _merge_engine_order(saved: Optional[tuple[str, ...]]) -> tuple[str, ...]:
    """Persisted order first, then any canonical engine not listed (never drop one)."""
    live = list(_KNOWN_ENGINES)
    if not saved:
        return _DEFAULT_PRIORITY
    head = [e for e in saved if e in live]
    return tuple(head + [e for e in live if e not in head])


# Module-level runtime priority profiles. reload_tts_priority() must run AFTER the
# helpers above (_merge_engine_order / _migrate_legacy_tts_order) are defined.
TTS_ENGINE_PRIORITY: tuple[str, ...] = _DEFAULT_PRIORITY
TTS_SENTENCE_PRIORITY: tuple[str, ...] = _DEFAULT_SENTENCE_PRIORITY
TTS_WORD_PRIORITY: tuple[str, ...] = _DEFAULT_WORD_PRIORITY
reload_tts_priority()

# Edge-tts cooldown: after a synth failure, skip edge for a short window so a whole
# batch doesn't keep paying the per-attempt timeout when the endpoint is down or
# region-blocked — the offline engine takes over immediately. Override TTS_EDGE_COOLDOWN_S.
_EDGE_COOLDOWN_S = float(os.environ.get("TTS_EDGE_COOLDOWN_S", "60") or "60")
_edge_cooldown_until = 0.0


def _edge_in_cooldown() -> bool:
    return time.monotonic() < _edge_cooldown_until


def _set_edge_cooldown() -> None:
    """Mark edge-tts as failing so the orchestrator skips it for a short window."""
    global _edge_cooldown_until
    _edge_cooldown_until = time.monotonic() + _EDGE_COOLDOWN_S
    ColorPrint.yellow(
        f"[tts] edge-tts cooling down for {_EDGE_COOLDOWN_S:.0f}s; using offline engine meanwhile")


def edge_cooldown_remaining() -> float:
    """Seconds until edge-tts leaves its failure cooldown (0.0 when not cooling)."""
    rem = _edge_cooldown_until - time.monotonic()
    return round(rem, 1) if rem > 0 else 0.0


def get_edge_cooldown_seconds() -> float:
    """Current edge-tts failure-cooldown window length (seconds)."""
    return _EDGE_COOLDOWN_S


def set_edge_cooldown_seconds(seconds: Any) -> float:
    """Override the edge-tts cooldown window at runtime (Settings-adjustable).
    Clamped to [0, 3600]s; ignored if not numeric. Returns the value in effect."""
    global _EDGE_COOLDOWN_S
    try:
        _EDGE_COOLDOWN_S = max(0.0, min(3600.0, float(seconds)))
    except (TypeError, ValueError):
        pass
    return _EDGE_COOLDOWN_S


def _normalize_accent(accent: Optional[str]) -> Optional[str]:
    """Normalize an accent hint to the wire values "us"|"uk"; anything else -> None."""
    value = (accent or "").strip().lower()
    return value if value in ("us", "uk") else None


def _is_english_lang(lang: Optional[str]) -> bool:
    return (lang or "en").strip().lower().startswith("en")


def _engine_actual_accent(engine: str, lang: Optional[str], accent: Optional[str]) -> str:
    """Accent an engine ACTUALLY produces for this request ("us"|"uk"|"unknown").

    Accent-aware engines honor the request (default US voice); azure_engine
    hardcodes en-US-JennyNeural for English; every other engine (and any
    non-English language) has no accent guarantee.
    """
    if not _is_english_lang(lang):
        return "unknown"
    if engine in _ACCENT_AWARE_ENGINES:
        return "uk" if accent == "uk" else "us"
    if engine == "azure":
        return "us"
    return "unknown"


def _edge_voice(lang: Optional[str], accent: Optional[str] = None,
                gender: Optional[str] = None) -> str:
    locale = _LOCALE_BY_LANG.get((lang or "en").lower(), "en-US")
    # Accent "uk" on an English locale -> British voice (en-GB-SoniaNeural).
    if accent == "uk" and locale.startswith("en-"):
        locale = "en-GB"
    g = (gender or "female").strip().lower()
    if g not in ("female", "male"):
        g = "female"
    voice = TTSConfig.get_voice(locale, g)
    if not voice:
        # Unmapped locale -> get_voice returns "" and edge-tts would fail with no
        # audio. Fall back to a known-good English voice (offline engines still take
        # over later if edge is unavailable / cooling down).
        ColorPrint.yellow(f"[tts] no edge voice for locale '{locale}'; falling back to en-US")
        voice = TTSConfig.get_voice("en-US", "female") or "en-US-JennyNeural"
    return voice


def _rate_to_speed(rate: Optional[str]) -> float:
    if not rate:
        return 1.0
    text = str(rate).strip()
    if text.endswith("%"):
        try:
            pct = float(text[:-1])
            return max(0.25, 1.0 + pct / 100.0)
        except ValueError:
            return 1.0
    try:
        return max(0.25, float(text))
    except ValueError:
        return 1.0


def engine_available(name: str) -> bool:
    if name == "chattts":
        return chattts_engine.available()
    if name == "cosyvoice":
        return cosyvoice_engine.available()
    if name == "fishspeech":
        return fishspeech_engine.available()
    if name == "qwen3tts":
        return qwen3tts_engine.available()
    if name == "bark":
        return bark_engine.available()
    if name == "parler":
        return parler_engine.available()
    if name == "voxcpm2":
        return voxcpm2_engine.available()
    if name == "kokoro":
        return kokoro_engine.available()
    if name == "f5tts":
        return f5tts_engine.available()
    if name == "edge":
        return get_edge_tts_client().initialize()
    if name == "streamelements":
        return streamelements_engine.available()
    if name == "sherpa":
        return sherpa_engine.available()
    if name == "melotts":
        return melotts_engine.available()
    if name == "gptsovits":
        return gptsovits_engine.available()
    if name == "gtts_web":
        return gtts_web_engine.available()
    if name == "azure":
        return azure_engine.available()
    return False


def _model_load_ctx(name: str):
    """Report FIRST-load progress for a class-B in-process TTS model to the shared
    model-load registry (surfaced at /api/local/engines/load-status). Class-C
    servers report from managed_service (their status comes from the subprocess
    start), and class-A engines (edge/streamelements/gtts/azure) load no model, so
    both are a no-op here — the registry is written from ONE place per engine class.
    ``managed_services.is_running`` on a model spec reflects the engine's own
    ``is_model_loaded`` (resident weights)."""
    spec = managed_services.spec(name)
    if spec is None or spec.kind != "model":
        return contextlib.nullcontext()
    return model_load_status.report_model_load(
        name, is_loaded=lambda: managed_services.is_running(name)
    )


def _engine_disabled_reason(name: str) -> Optional[str]:
    """UI hint when an engine is off (not installed, needs config, or server down)."""
    if engine_available(name):
        return None
    return engine_unavailable_reason(name)


def best_engine() -> Optional[str]:
    for name in _priority():
        if engine_available(name):
            return name
    return None


def tts_status() -> Dict[str, Any]:
    """Availability snapshot for the UI (no synthesis run)."""
    edge_cooldown = edge_cooldown_remaining()
    se_cooldown = streamelements_engine.cooldown_remaining()
    engines: List[Dict[str, Any]] = []
    for i, name in enumerate(_priority()):
        avail = engine_available(name)
        installed = engine_installed(name)
        entry: Dict[str, Any] = {
            "name": name,
            "priority": i + 1,
            "available": avail,
            "installed": installed,
            "note": _ENGINE_NOTES.get(name, ""),
            "concurrency": _ENGINE_CONCURRENCY.get(name, "unknown"),
        }
        if is_server_engine(name):
            entry.update(server_runtime_status(name))
        if name == "edge":
            # When cooling down, synthesize() skips edge regardless of availability.
            entry["cooldown_remaining"] = edge_cooldown
        if name == "streamelements":
            entry["cooldown_remaining"] = se_cooldown
        dist = _ENGINE_VERSIONS.get(name)
        if dist and avail:
            entry["version"] = _dist_version(dist)
        if name in _TIER_ENGINES:
            tier_model = runtime_engine_model(name)
            if tier_model:
                entry["model"] = tier_model
        reason = _engine_disabled_reason(name)
        if reason:
            entry["disabled_reason"] = reason
        engines.append(entry)
    avail = [e for e in engines if e["available"]]
    # Derive `best` and `active` from the availability we ALREADY computed above
    # rather than calling best_engine() (which would re-probe every engine a
    # second time — a redundant round of HTTP/import checks on each poll).
    # best = first available in priority order; active also respects the edge
    # cooldown (synthesize() skips edge while cooling down).
    best = next((e["name"] for e in engines if e["available"]), None)
    active = None
    for e in engines:
        if e["available"] and not (e["name"] == "edge" and edge_cooldown > 0):
            if e["name"] == "streamelements" and se_cooldown > 0:
                continue
            active = e["name"]
            break
    return {
        "success": True,
        "best": best,
        "active": active,
        "edge_cooldown_remaining": edge_cooldown,
        "streamelements_cooldown_remaining": se_cooldown,
        "available_count": len(avail),
        "engines": engines,
    }


def report_tts_engine_startup() -> None:
    """Boot-time: migrate persisted order, warn on disabled keyed engines, log chain."""
    global _STARTUP_REPORTED
    if _STARTUP_REPORTED:
        return
    _STARTUP_REPORTED = True
    order = reload_tts_priority()
    streamelements_engine.warn_if_disabled()
    ColorPrint.blue(
        f"[TTS] Engine priority: {' -> '.join(order)} "
        f"(active={best_engine() or 'none'})"
    )
    ColorPrint.blue(
        f"[TTS] Sentence chain: {' -> '.join(_priority('sentence'))} "
        f"| Word chain: {' -> '.join(_priority('word'))}"
    )


def _synth_edge(text: str, lang: Optional[str], output_path: Path, rate: Optional[str],
                accent: Optional[str] = None, gender: Optional[str] = None) -> bool:
    client = get_edge_tts_client()
    if not client.initialize():
        return False
    voice = _edge_voice(lang, accent, gender)
    return client.synthesize(text, voice, output_path, rate=rate)


def _synth_offline(
    engine: str,
    text: str,
    lang: Optional[str],
    output_path: Path,
    rate: Optional[str],
) -> bool:
    speed = _rate_to_speed(rate)
    if engine == "sherpa":
        return sherpa_engine.synthesize(text, lang or "en", output_path, speed=speed)
    if engine == "melotts":
        return melotts_engine.synthesize(text, lang or "en", output_path, speed=speed)
    if engine == "gptsovits":
        return gptsovits_engine.synthesize(text, lang or "en", output_path, speed=speed)
    if engine == "chattts":
        return chattts_engine.synthesize(text, lang or "en", output_path, speed=speed)
    if engine == "cosyvoice":
        return cosyvoice_engine.synthesize(text, lang or "en", output_path, speed=speed)
    if engine == "f5tts":
        return f5tts_engine.synthesize(text, lang or "en", output_path, speed=speed)
    if engine == "fishspeech":
        return fishspeech_engine.synthesize(text, lang or "en", output_path, speed=speed)
    if engine == "qwen3tts":
        return qwen3tts_engine.synthesize(text, lang or "en", output_path, speed=speed)
    if engine == "bark":
        return bark_engine.synthesize(text, lang or "en", output_path, speed=speed)
    if engine == "parler":
        return parler_engine.synthesize(text, lang or "en", output_path, speed=speed)
    if engine == "voxcpm2":
        return voxcpm2_engine.synthesize(text, lang or "en", output_path, speed=speed)
    if engine == "kokoro":
        return kokoro_engine.synthesize(text, lang or "en", output_path, speed=speed)
    return False


def _synth_azure(text: str, lang: Optional[str], output_path: Path, rate: Optional[str]) -> bool:
    # Cloud engine takes the percent rate string directly (mapped to SSML prosody).
    return azure_engine.synthesize(text, lang or "en", output_path, rate=rate)


def describe_synth_command(
    engine: str,
    text: str,
    language: Optional[str] = None,
    output_path: Optional[Path] = None,
    accent: Optional[str] = None,
    rate: Optional[str] = None,
    gender: Optional[str] = None,
) -> str:
    """Human-readable synth invocation for task-detail UI (not a shell replay)."""
    lang = (language or "en").strip() or "en"
    out = str(output_path) if output_path else "<output.mp3>"
    sample = (text or "").replace('"', "'")[:120]
    eng = (engine or "unknown").strip().lower()
    acc = _normalize_accent(accent)
    if eng == "edge":
        voice = _edge_voice(lang, acc, gender)
        rate_s = rate if rate else "+0%"
        return (
            f'edge-tts --voice {voice} --rate "{rate_s}" '
            f'--text "{sample}" --write-media {out}'
        )
    if eng == "streamelements":
        voice = "Amy" if acc == "uk" else "Joanna"
        return f'streamelements TTS voice={voice} lang={lang} text="{sample}" -> {out}'
    if eng == "sherpa":
        speed = _rate_to_speed(rate)
        return (
            f'sherpa-onnx OfflineTts.generate(text="{sample}", lang={lang}, '
            f'speed={speed}) -> {out}'
        )
    if eng == "melotts":
        speed = _rate_to_speed(rate)
        return f'melotts synthesize(text="{sample}", lang={lang}, speed={speed}) -> {out}'
    if eng == "chattts":
        return f'chattts POST /v1/audio/speech text="{sample}" lang={lang} -> {out}'
    if eng == "cosyvoice":
        return f'cosyvoice POST /inference_sft text="{sample}" lang={lang} -> {out}'
    if eng == "f5tts":
        return f'f5tts POST /process text="{sample}" lang={lang} -> {out}'
    if eng == "fishspeech":
        return f'fishspeech POST /v1/tts text="{sample}" lang={lang} -> {out}'
    if eng == "qwen3tts":
        return f'qwen3tts POST /synthesize text="{sample}" lang={lang} -> {out}'
    if eng == "bark":
        return f'bark BarkModel.generate(text="{sample}", lang={lang}) -> {out}'
    if eng == "parler":
        return f'parler_tts.generate(text="{sample}", description=PARLER_DESCRIPTION) -> {out}'
    if eng == "voxcpm2":
        speed = _rate_to_speed(rate)
        return f'voxcpm2.generate(text="{sample}", lang={lang}, speed={speed}) -> {out}'
    if eng == "kokoro":
        speed = _rate_to_speed(rate)
        return (
            f'kokoro sherpa-onnx OfflineTts.generate(text="{sample}", lang={lang}, '
            f'speed={speed}) -> {out}'
        )
    if eng == "gptsovits":
        return f'gptsovits POST /tts text="{sample}" lang={lang} -> {out}'
    if eng == "gtts_web":
        short = lang[:2] if len(lang) >= 2 else lang
        return f'gTTS(text="{sample}", lang={short}) -> {out}'
    if eng == "azure":
        rate_s = rate if rate else "+0%"
        return (
            f'azure-cognitiveservices speech synthesize lang={lang} rate={rate_s} '
            f'text="{sample}" -> {out}'
        )
    if eng in ("cache", "pending", "unknown"):
        return f'{eng}: text="{sample}" lang={lang} accent={acc or "any"} -> {out}'
    return f'{eng} synthesize(lang={lang}, text="{sample}", accent={acc or "any"}) -> {out}'


# Uniform arity (text, lang, path, rate, accent); accent-blind engines ignore it.
_SYNTHESIZERS: Dict[str, Callable[..., bool]] = {
    "chattts": lambda t, l, p, r, a=None: _synth_offline("chattts", t, l, p, r),
    "cosyvoice": lambda t, l, p, r, a=None: _synth_offline("cosyvoice", t, l, p, r),
    "fishspeech": lambda t, l, p, r, a=None: _synth_offline("fishspeech", t, l, p, r),
    "qwen3tts": lambda t, l, p, r, a=None: _synth_offline("qwen3tts", t, l, p, r),
    "bark": lambda t, l, p, r, a=None: _synth_offline("bark", t, l, p, r),
    "parler": lambda t, l, p, r, a=None: _synth_offline("parler", t, l, p, r),
    "voxcpm2": lambda t, l, p, r, a=None: _synth_offline("voxcpm2", t, l, p, r),
    "kokoro": lambda t, l, p, r, a=None: _synth_offline("kokoro", t, l, p, r),
    "f5tts": lambda t, l, p, r, a=None: _synth_offline("f5tts", t, l, p, r),
    "edge": _synth_edge,
    "streamelements": lambda t, l, p, r, a=None: streamelements_engine.synthesize(
        t, l or "en", p, accent=a),
    "sherpa": lambda t, l, p, r, a=None: _synth_offline("sherpa", t, l, p, r),
    "melotts": lambda t, l, p, r, a=None: _synth_offline("melotts", t, l, p, r),
    "gptsovits": lambda t, l, p, r, a=None: _synth_offline("gptsovits", t, l, p, r),
    "gtts_web": lambda t, l, p, r, a=None: gtts_web_engine.synthesize(t, l or "en", p),
    "azure": lambda t, l, p, r, a=None: _synth_azure(t, l, p, r),
}


def _sentence_cache_identity(
    accent: Optional[str], gender: Optional[str]
) -> Tuple[str, str, str]:
    """Build the (speaker, instruct, model_id) key fields for the sentence cache.

    ``speaker`` folds the requested voice identity — an explicit qwen3tts speaker
    plus the accent/gender descriptor — so two variants of the SAME text (e.g.
    us-female vs uk-male) never collide on one cache entry. ``instruct`` /
    ``model_id`` come from the qwen3tts synthesis env (the params that change the
    produced audio); empty for engines that ignore them."""
    speaker = (os.environ.get("QWEN3TTS_SPEAKER") or "").strip()
    voice_desc = f"{(accent or 'any')}:{(gender or 'female')}"
    speaker_field = f"{speaker}|{voice_desc}" if speaker else voice_desc
    instruct = (os.environ.get("QWEN3TTS_INSTRUCT") or "").strip()
    model_id = (os.environ.get("QWEN3TTS_MODEL") or "").strip()
    return speaker_field, instruct, model_id


def synthesize(
    text: str,
    language: Optional[str],
    output_path: Path,
    rate: Optional[str] = None,
    accent: Optional[str] = None,
    gender: Optional[str] = None,
    priority_profile: str = "auto",
) -> Dict[str, Any]:
    """
    Synthesize ``text`` to ``output_path`` (.mp3) using the best available engine.

    ``accent`` ("us"|"uk"|None) is honored by the accent-aware engines
    (edge/streamelements); other engines still run — the returned ``accent``
    is the accent ACTUALLY produced ("us"|"uk"|"unknown"; None on failure) so
    callers can tag accent_fallback.

    Returns:
        { success, engine, accent, error, tried: [names] }
    """
    cleaned = (text or "").strip()
    if not cleaned:
        return {"success": False, "engine": None, "accent": None,
                "error": "empty text", "tried": []}

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    want_accent = _normalize_accent(accent)
    profile = priority_profile
    if profile == "auto":
        profile = "word" if is_word_text(cleaned) else "sentence"

    # Resolve the engine order once (the sentence profile applies the GPU gate).
    engine_order = _priority(profile)
    # Sentence-audio cache: an identical sentence request (same text/lang/voice/
    # engine/format) returns the previously-synthesized file WITHOUT re-synth.
    # Word audio is intentionally not cached here (short, edge-first, cheap).
    cache_ext = (output_path.suffix.lstrip(".").lower() or "mp3")
    cache_speaker = cache_instruct = cache_model = ""
    if profile == "sentence":
        cache_speaker, cache_instruct, cache_model = _sentence_cache_identity(
            want_accent, gender
        )
        for cand in engine_order:
            hit = sentence_audio_cache.lookup_or_none(
                text=cleaned, lang=language or "en", speaker=cache_speaker,
                instruct=cache_instruct, engine=cand, fmt=cache_ext,
                model_id=cache_model,
            )
            if hit is None:
                continue
            try:
                shutil.copyfile(str(hit), str(output_path))
            except OSError as exc:
                ColorPrint.yellow(f"[tts] sentence cache copy failed ({exc}); synthesizing")
                break
            ColorPrint.gray(
                f"[tts] sentence cache HIT (engine={cand}) -> {output_path.name}"
            )
            return {
                "success": True,
                "engine": cand,
                "accent": _engine_actual_accent(cand, language, want_accent),
                "error": None,
                "cached": True,
                "tried": [],
                "synth_command": describe_synth_command(
                    cand, cleaned, language, output_path, want_accent, rate, gender),
            }
        ColorPrint.gray("[tts] sentence cache MISS; synthesizing")

    tried: List[str] = []
    last_error: Optional[str] = None
    for name in engine_order:
        # Skip a recently-failed edge endpoint so a whole batch doesn't repeatedly
        # pay the per-attempt timeout when edge is down — go straight to offline.
        if name == "edge" and _edge_in_cooldown():
            ColorPrint.gray("[tts] edge in cooldown (recent failure); skipping to offline engine")
            continue
        if name == "streamelements" and streamelements_engine.in_cooldown():
            ColorPrint.gray(
                "[tts] streamelements in cooldown (recent auth failure); skipping"
            )
            continue
        if is_server_engine(name) and prepare_server_for_use(name):
            # Server is (now) reachable — drop the engine's stale 30s "down" cache.
            invalidate_server_engine_cache(name)
        if not engine_available(name):
            continue
        synth = _SYNTHESIZERS.get(name)
        if synth is None:
            continue
        tried.append(name)
        with managed_services.using(name), _model_load_ctx(name):
            try:
                if name == "edge":
                    ok = _synth_edge(cleaned, language, output_path, rate, want_accent, gender)
                else:
                    ok = synth(cleaned, language, output_path, rate, want_accent)
            except Exception as e:  # noqa: BLE001— fall through to next engine
                last_error = f"{name}: {e}"
                ColorPrint.yellow(f"[tts] {name} failed ({e}); trying next engine")
                if name == "edge":
                    _set_edge_cooldown()
                continue
            if ok and output_path.exists() and output_path.stat().st_size > 0:
                if is_server_engine(name):
                    record_server_use(name)
                # Populate the sentence cache under the engine that ACTUALLY
                # produced the audio so the next identical request is a hit.
                if profile == "sentence":
                    try:
                        sentence_audio_cache.store_result(
                            text=cleaned, lang=language or "en", speaker=cache_speaker,
                            instruct=cache_instruct, engine=name, fmt=cache_ext,
                            model_id=cache_model, data_bytes=output_path.read_bytes(),
                        )
                    except OSError as exc:
                        ColorPrint.gray(f"[tts] sentence cache store skipped ({exc})")
                return {
                    "success": True,
                    "engine": name,
                    "accent": _engine_actual_accent(name, language, want_accent),
                    "error": None,
                    "cached": False,
                    "tried": tried,
                    "synth_command": describe_synth_command(
                        name, cleaned, language, output_path, want_accent, rate, gender),
                }
        last_error = f"{name}: synthesis failed"
        detail = _engine_synth_error(name)
        if detail:
            last_error = f"{name}: {detail}"
        ColorPrint.gray(f"[tts] {name} returned no audio; trying next engine")
        if name == "edge":
            _set_edge_cooldown()

    return {
        "success": False,
        "engine": None,
        "accent": None,
        "error": last_error or ("No TTS engine available" if not tried else "All TTS engines failed"),
        "tried": tried,
    }


def _variant_result(
    variant: Dict[str, Any],
    out_path: Path,
    ok: bool,
    provider: str,
    error: str = "",
    synth_command: str = "",
) -> Dict[str, Any]:
    """One per-variant result row from synthesize_variants()."""
    accent = variant.get("accent")
    return {
        "variant_key": (variant.get("key") or "").strip(),
        "path": str(out_path) if ok else "",
        "success": bool(ok),
        "provider": provider or "none",
        "accent": accent if accent else None,
        "gender": variant.get("gender") or "female",
        "error": error or None,
        "synth_command": synth_command,
    }


def synthesize_variants(
    text: str,
    language: Optional[str],
    variants: List[Dict[str, Any]],
    out_paths: List[Path],
    priority_profile: str = "sentence",
) -> List[Dict[str, Any]]:
    """Synthesize ONE text to N voice variants (different accent/gender/speaker).

    Uses the qwen3tts BATCH endpoint (POST /synthesize_batch on the isolated-venv
    server, one ``generate_custom_voice`` list call server-side) when qwen3tts is
    available AND first in the sentence priority - so all variants generate at the
    GPU's max parallel speed.
    Otherwise falls back to per-variant sequential ``synthesize()`` (still the
    sentence chain). ``out_paths[i]`` corresponds to ``variants[i]``.

    Returns one result dict per variant (see ``_variant_result``); never raises.
    A variant that fails its batch slot is retried once via the single-file path.
    """
    cleaned = (text or "").strip()
    if not cleaned or not variants:
        return []
    n = min(len(variants), len(out_paths))
    results: List[Dict[str, Any]] = []

    sentence_order = _priority("sentence" if priority_profile != "default" else "default")
    qwen_first = bool(sentence_order) and sentence_order[0] == "qwen3tts"
    can_batch = qwen_first and engine_available("qwen3tts") and n >= 2

    if can_batch:
        try:
            with managed_services.using("qwen3tts"):
                ok_flags = qwen3tts_engine.synthesize_variants(
                    cleaned, language or "en", variants[:n], [Path(out_paths[i]) for i in range(n)]
                )
        except Exception as exc:  # noqa: BLE001 - batch failure -> per-variant fallback
            ColorPrint.yellow(f"[tts] qwen3tts batch failed ({exc}); per-variant fallback")
            ok_flags = [False] * n
        for i in range(n):
            path = Path(out_paths[i])
            ok = bool(ok_flags[i]) if i < len(ok_flags) else False
            if ok and path.exists() and path.stat().st_size > 0:
                results.append(_variant_result(
                    variants[i], path, True, "qwen3tts",
                    synth_command=describe_synth_command(
                        "qwen3tts", cleaned, language, path,
                        accent=variants[i].get("accent"), gender=variants[i].get("gender")),
                ))
            else:
                # Retry just this slot via the single-file chain (qwen3tts first,
                # then the rest of the sentence chain if it fails again).
                res = synthesize(cleaned, language, path,
                                 accent=variants[i].get("accent"),
                                 gender=variants[i].get("gender"),
                                 priority_profile="sentence")
                results.append(_variant_result(
                    variants[i], path, bool(res.get("success")),
                    res.get("engine") or "none",
                    error="" if res.get("success") else (res.get("error") or "synthesis failed"),
                    synth_command=str(res.get("synth_command") or ""),
                ))
        return results

    # Sequential fallback: per-variant synthesize() on the sentence chain.
    for i in range(n):
        path = Path(out_paths[i])
        res = synthesize(cleaned, language, path,
                         accent=variants[i].get("accent"),
                         gender=variants[i].get("gender"),
                         priority_profile=priority_profile)
        results.append(_variant_result(
            variants[i], path, bool(res.get("success")),
            res.get("engine") or "none",
            error="" if res.get("success") else (res.get("error") or "synthesis failed"),
            synth_command=str(res.get("synth_command") or ""),
        ))
    return results


_LAST_ENGINE_SYNTH_ERROR: Optional[str] = None

_DETAIL_ENGINES = {
    "fishspeech": fishspeech_engine,
    "qwen3tts": qwen3tts_engine,
    "melotts": melotts_engine,
    "chattts": chattts_engine,
    "f5tts": f5tts_engine,
    "cosyvoice": cosyvoice_engine,
    "gptsovits": gptsovits_engine,
}


def _engine_synth_error(engine: str) -> Optional[str]:
    """Best-effort detail from the last single-engine synth attempt."""
    mod = _DETAIL_ENGINES.get(engine)
    if mod is not None:
        getter = getattr(mod, "last_synth_error", None)
        if callable(getter):
            detail = getter()
            if detail:
                return detail
        reason_fn = getattr(mod, "disabled_reason", None)
        if callable(reason_fn):
            reason = reason_fn()
            if reason:
                return reason
    return _LAST_ENGINE_SYNTH_ERROR


def synthesize_engine(
    engine: str,
    text: str,
    language: Optional[str],
    output_path: Path,
    rate: Optional[str] = None,
    accent: Optional[str] = None,
    **extra_params: Any,
) -> bool:
    """Synthesize with ONE named engine (no fallback). For the UI per-engine test.
    Returns True only when the engine actually produced non-empty audio.

    Per-engine extra_params are applied before the synth call (env vars,
    engine-specific kwargs). Engines that don't recognise a key ignore it."""
    global _LAST_ENGINE_SYNTH_ERROR
    _LAST_ENGINE_SYNTH_ERROR = None
    engine = (engine or "").strip().lower()
    if is_server_engine(engine) and prepare_server_for_use(engine):
        invalidate_server_engine_cache(engine)
    synth = _SYNTHESIZERS.get(engine)
    if synth is None:
        _LAST_ENGINE_SYNTH_ERROR = f"unknown TTS engine: {engine}"
        return False
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    # Apply per-engine extra params before the synth call, restore afterwards.
    applied_env = _apply_engine_extra_params(engine, extra_params)
    ok = False
    try:
        with managed_services.using(engine), _model_load_ctx(engine):
            try:
                if engine == "qwen3tts":
                    ok = qwen3tts_engine.synthesize(
                        (text or "").strip(), language or "en", output_path,
                        speed=_rate_to_speed(rate),
                        speaker=extra_params.get("speaker"),
                        instruct=extra_params.get("instruct"),
                    )
                else:
                    ok = synth((text or "").strip(), language, output_path, rate, _normalize_accent(accent))
            except Exception as e:  # noqa: BLE001
                _LAST_ENGINE_SYNTH_ERROR = str(e)
                ColorPrint.yellow(f"[tts] {engine} test failed ({e})")
                return False
            if ok and is_server_engine(engine):
                record_server_use(engine)
    finally:
        _restore_engine_extra_params(applied_env)
    if not ok:
        detail = _engine_synth_error(engine)
        if detail:
            _LAST_ENGINE_SYNTH_ERROR = detail
        elif not _LAST_ENGINE_SYNTH_ERROR:
            _LAST_ENGINE_SYNTH_ERROR = f"{engine} synthesis failed"
    return bool(ok and output_path.exists() and output_path.stat().st_size > 0)


# Per-engine env vars temporarily set from extra_params before a test synth.
# Keys are the env var name, values are the extra_param key to read.
_ENGINE_ENV_OVERRIDES: Dict[str, Dict[str, str]] = {
    "qwen3tts": {
        "QWEN3TTS_INSTRUCT": "instruct",
        "QWEN3TTS_SPEAKER": "speaker",
    },
    "parler": {
        "PARLER_DESCRIPTION": "description",
    },
    "voxcpm2": {
        "VOXCPM2_CFG": "cfg_value",
        "VOXCPM2_TIMESTEPS": "timesteps",
    },
    "cosyvoice": {
        "COSYVOICE_INSTRUCT": "instruct",
        "COSYVOICE_SPK_ID": "speaker_id",
    },
    "gptsovits": {
        "GPTSOVITS_PROMPT_TEXT": "prompt_text",
        "GPTSOVITS_PROMPT_LANG": "prompt_lang",
    },
    "chattts": {
        "CHATTTS_VOICE": "voice",
    },
}


def _apply_engine_extra_params(engine: str, extra_params: Dict[str, Any]) -> Dict[str, Optional[str]]:
    """Temporarily set engine-specific env vars from extra_params before a test synth.
    Returns a dict of {env_key: previous_value_or_None} for later restore."""
    overrides = _ENGINE_ENV_OVERRIDES.get(engine, {})
    applied: Dict[str, Optional[str]] = {}
    if not overrides:
        return applied
    for env_key, param_key in overrides.items():
        value = extra_params.get(param_key)
        if value is None:
            continue
        prev = os.environ.get(env_key)
        applied[env_key] = prev
        os.environ[env_key] = str(value)
        ColorPrint.blue(f"[tts] {engine} override {env_key}={value}")
    return applied


def _restore_engine_extra_params(applied: Dict[str, Optional[str]]) -> None:
    """Restore env vars after a per-engine test synth."""
    for env_key, prev in applied.items():
        if prev is None:
            os.environ.pop(env_key, None)
        else:
            os.environ[env_key] = prev


def tts_test(engine: Optional[str] = None, text: Optional[str] = None,
             language: str = "en", rate: Optional[str] = None,
             accent: Optional[str] = None,
             # Per-engine extra params (ignored by engines that don't use them).
             gender: Optional[str] = None,
             speaker: Optional[str] = None,
             instruct: Optional[str] = None,
             voice: Optional[str] = None,
             description: Optional[str] = None,
             cfg_value: Optional[float] = None,
             timesteps: Optional[int] = None,
             speaker_id: Optional[str] = None,
             prompt_text: Optional[str] = None,
             prompt_lang: Optional[str] = None,
             speed: Optional[float] = None,
             **extra_params: Any) -> Dict[str, Any]:
    """Live synth test for ONE engine (or the best available). Returns
    {success, engine, latency_ms, bytes, accent, error}. Skips the edge cooldown
    so the user's explicit test always runs the engine they asked for.

    Per-engine extra params (forwarded when the engine supports them):
    - gender (edge): "female" | "male"
    - speaker / instruct (qwen3tts): speaker name + voice style instruction
    - voice (chattts): OpenAI-compatible voice name
    - description (parler): natural-language voice description
    - cfg_value / timesteps (voxcpm2): CFG strength + inference steps
    - speaker_id / instruct (cosyvoice): speaker id + style instruction
    - prompt_text / prompt_lang (gptsovits): reference transcript + language
    - speed: overrides rate for engines that use float speed instead of SSML rate
    """
    name = engine or best_engine()
    if not name:
        return {"success": False, "engine": None, "latency_ms": 0, "bytes": 0,
                "route": "local.tts.test", "error": "no TTS engine available"}
    if is_server_engine(name) and prepare_server_for_use(name):
        invalidate_server_engine_cache(name)
    if not engine_available(name):
        reason = _engine_disabled_reason(name)
        err = reason or f"{name} unavailable"
        return {"success": False, "engine": name, "latency_ms": 0, "bytes": 0,
                "route": "local.tts.test", "error": err}
    out = get_edge_tts_voice_cache_dir(language) / f"{name}.mp3"
    sample = (text or "").strip() or "This is a pycore text to speech test."
    want_accent = _normalize_accent(accent)
    t0 = time.monotonic()
    ok = synthesize_engine(name, sample, language, out, rate, accent=want_accent,
                           gender=gender, speaker=speaker, instruct=instruct,
                           voice=voice, description=description,
                           cfg_value=cfg_value, timesteps=timesteps,
                           speaker_id=speaker_id, prompt_text=prompt_text,
                           prompt_lang=prompt_lang, speed=speed, **extra_params)
    latency = round((time.monotonic() - t0) * 1000)
    size = out.stat().st_size if (ok and out.exists()) else 0
    detail = _engine_synth_error(name) if not ok else None
    result: Dict[str, Any] = {
        "success": bool(ok),
        "engine": name,
        "latency_ms": latency,
        "bytes": size,
        "route": "local.tts.test",
        "path": str(out) if (ok and size > 0) else None,
        "text": sample,
        "language": language,
        "accent": _engine_actual_accent(name, language, want_accent) if ok else None,
        "error": None if ok else (detail or f"{name} produced no audio"),
    }
    # Echo back per-engine params so the FE can show what was actually used.
    if gender:
        result["gender"] = gender
    if speaker:
        result["speaker"] = speaker
    if instruct:
        result["instruct"] = instruct
    if description:
        result["description"] = description
    return result


__all__ = [
    "TTS_ENGINE_PRIORITY",
    "TTS_SENTENCE_PRIORITY",
    "TTS_WORD_PRIORITY",
    "default_tts_engine_priority",
    "default_sentence_tts_priority",
    "default_word_tts_priority",
    "reload_tts_priority",
    "report_tts_engine_startup",
    "engine_available",
    "best_engine",
    "tts_status",
    "describe_synth_command",
    "synthesize",
    "synthesize_variants",
    "synthesize_engine",
    "tts_test",
    "is_word_text",
]
