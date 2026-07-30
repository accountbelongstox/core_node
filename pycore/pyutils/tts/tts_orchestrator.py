# -*- coding: utf-8 -*-
"""Local-first TTS synthesis with profile-aware fallback and managed engines.

Priority persistence and runtime cooldown state live in pyutils.tts.engine_policy.
"""

import contextlib
import importlib.metadata
import shutil
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    call_serialized,
)
from pycore.pyfoundations.system_paths import (
    get_edge_tts_voice_cache_dir,
)
from pycore.pyutils.tts.engine_policy import (
    TTS_ENGINE_PRIORITY,
    TTS_SENTENCE_PRIORITY,
    TTS_WORD_PRIORITY,
    _ENGINE_CONCURRENCY,
    _ENGINE_NOTES,
    _LOCALE_BY_LANG,
    _ORCHESTRATOR_STATE_QUEUE,
    _TIER_ENGINES,
    _get_orchestrator_state,
    _set_orchestrator_state,
    apply_tts_engine_extra_params as _apply_engine_extra_params,
    claim_tts_startup_report as _claim_startup_report,
    configured_tts_priority,
    default_sentence_tts_priority,
    default_tts_engine_priority,
    default_word_tts_priority,
    edge_cooldown_remaining,
    edge_in_cooldown,
    format_tts_synth_command,
    get_edge_cooldown_seconds,
    is_word_text,
    mark_edge_cooldown,
    normalize_tts_accent as _normalize_accent,
    reload_tts_priority,
    restore_tts_engine_extra_params as _restore_engine_extra_params,
    sentence_tts_cache_identity as _sentence_cache_identity,
    set_edge_cooldown_seconds,
    tts_engine_actual_accent as _engine_actual_accent,
    tts_rate_to_speed as _rate_to_speed,
    tts_variant_result as _variant_result,
)
import pycore.pyutils.tts.sentence_audio_cache as sentence_audio_cache
from pycore.pyutils.tts.edge.config import TTSConfig
from pycore.pyutils.tts.edge.client import edge_tts_client
from pycore.pyutils.common.model_tiers import runtime_engine_model
from pycore.pyutils.tts.tts_engine_probe import engine_installed, engine_unavailable_reason
from pycore.pyutils.tts.tts_service_manager import (
    invalidate_server_engine_cache,
    is_server_engine,
    prepare_server_for_use,
    server_runtime_status,
    record_server_use,
)
from pycore.pyutils.common.managed_service import managed_services
import pycore.pyutils.common.model_load_status as model_load_status
import pycore.pyutils.tts.azure_engine as azure_engine
import pycore.pyutils.tts.bark_engine as bark_engine
import pycore.pyutils.tts.chattts_engine as chattts_engine
import pycore.pyutils.tts.cosyvoice_engine as cosyvoice_engine
import pycore.pyutils.tts.f5tts_engine as f5tts_engine
import pycore.pyutils.tts.fishspeech_engine as fishspeech_engine
import pycore.pyutils.tts.gptsovits_engine as gptsovits_engine
import pycore.pyutils.tts.gtts_web_engine as gtts_web_engine
import pycore.pyutils.tts.kokoro_engine as kokoro_engine
import pycore.pyutils.tts.melotts_engine as melotts_engine
import pycore.pyutils.tts.parler_engine as parler_engine
import pycore.pyutils.tts.qwen.engine as qwen_engine
import pycore.pyutils.tts.sherpa_engine as sherpa_engine
import pycore.pyutils.tts.streamelements_engine as streamelements_engine
import pycore.pyutils.tts.voxcpm2_engine as voxcpm2_engine

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



# qwen3tts runs in an isolated server, so availability—not this process's CUDA
# state—gates its sentence-chain position.
_GPU_SENTENCE_ENGINE = "qwen3tts"


def _apply_sentence_gpu_gate(order: tuple[str, ...]) -> tuple[str, ...]:
    """Demote unavailable qwen3tts without changing the user's remaining order."""
    if _GPU_SENTENCE_ENGINE not in order:
        return order
    if engine_available(_GPU_SENTENCE_ENGINE):
        return order
    rest = tuple(e for e in order if e != _GPU_SENTENCE_ENGINE)
    return rest + (_GPU_SENTENCE_ENGINE,)


def _priority(profile: str = "default") -> tuple[str, ...]:
    order = configured_tts_priority(profile)
    return _apply_sentence_gpu_gate(order) if profile in ("sentence", "agent_history") else order

def _edge_in_cooldown() -> bool:
    return edge_in_cooldown()


def _set_edge_cooldown() -> None:
    cooldown = mark_edge_cooldown()
    ColorPrint.yellow(
        f"[tts] edge-tts cooling down for {cooldown:.0f}s; using offline engine meanwhile"
    )


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




def engine_available(name: str) -> bool:
    if name == "chattts":
        return chattts_engine.available()
    if name == "cosyvoice":
        return cosyvoice_engine.available()
    if name == "fishspeech":
        return fishspeech_engine.available()
    if name == "qwen3tts":
        return qwen_engine.available()
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
        return edge_tts_client.initialize()
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
        "sentence_priority": list(_priority("sentence")),
        "word_priority": list(_priority("word")),
        "engines": engines,
    }


def report_tts_engine_startup() -> None:
    """Boot-time: migrate persisted order, warn on disabled keyed engines, log chain."""
    if not call_serialized(
        _ORCHESTRATOR_STATE_QUEUE,
        _claim_startup_report,
    ):
        return
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
    client = edge_tts_client
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
        return qwen_engine.synthesize(text, lang or "en", output_path, speed=speed)
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
    return format_tts_synth_command(
        engine,
        text,
        language,
        output_path,
        accent,
        rate,
        gender,
        edge_voice=_edge_voice,
    )


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




def synthesize(
    text: str,
    language: Optional[str],
    output_path: Path,
    rate: Optional[str] = None,
    accent: Optional[str] = None,
    gender: Optional[str] = None,
    priority_profile: str = "auto",
) -> Dict[str, Any]:
    """Synthesize text with the first available engine in the selected profile."""
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
        try:
            with managed_services.using(name), _model_load_ctx(name):
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




def synthesize_variants(
    text: str,
    language: Optional[str],
    variants: List[Dict[str, Any]],
    out_paths: List[Path],
    priority_profile: str = "sentence",
) -> List[Dict[str, Any]]:
    """Synthesize ordered voice variants, using the qwen3tts batch path when available."""
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
                ok_flags = qwen_engine.synthesize_variants(
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


_DETAIL_ENGINES = {
    "fishspeech": fishspeech_engine,
    "qwen3tts": qwen_engine,
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
    return call_serialized(
        _ORCHESTRATOR_STATE_QUEUE,
        _get_orchestrator_state,
        "last_engine_synth_error",
    )


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
    call_serialized(
        _ORCHESTRATOR_STATE_QUEUE,
        _set_orchestrator_state,
        "last_engine_synth_error",
        None,
    )
    engine = (engine or "").strip().lower()
    if is_server_engine(engine) and prepare_server_for_use(engine):
        invalidate_server_engine_cache(engine)
    synth = _SYNTHESIZERS.get(engine)
    if synth is None:
        call_serialized(
            _ORCHESTRATOR_STATE_QUEUE,
            _set_orchestrator_state,
            "last_engine_synth_error",
            f"unknown TTS engine: {engine}",
        )
        return False
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    # Apply per-engine extra params before the synth call, restore afterwards.
    applied_env = _apply_engine_extra_params(engine, extra_params)
    ok = False
    try:
        with managed_services.using(engine), _model_load_ctx(engine):
            if engine == "qwen3tts":
                ok = qwen_engine.synthesize(
                    (text or "").strip(), language or "en", output_path,
                    speed=_rate_to_speed(rate),
                    speaker=extra_params.get("speaker"),
                    instruct=extra_params.get("instruct"),
                )
            else:
                ok = synth((text or "").strip(), language, output_path, rate, _normalize_accent(accent))
            if ok and is_server_engine(engine):
                record_server_use(engine)
    except Exception as e:  # noqa: BLE001
        call_serialized(
            _ORCHESTRATOR_STATE_QUEUE,
            _set_orchestrator_state,
            "last_engine_synth_error",
            str(e),
        )
        ColorPrint.yellow(f"[tts] {engine} test failed ({e})")
        return False
    finally:
        _restore_engine_extra_params(applied_env)
    if not ok:
        detail = _engine_synth_error(engine)
        if detail:
            call_serialized(
                _ORCHESTRATOR_STATE_QUEUE,
                _set_orchestrator_state,
                "last_engine_synth_error",
                detail,
            )
        elif not _engine_synth_error(engine):
            call_serialized(
                _ORCHESTRATOR_STATE_QUEUE,
                _set_orchestrator_state,
                "last_engine_synth_error",
                f"{engine} synthesis failed",
            )
    return bool(ok and output_path.exists() and output_path.stat().st_size > 0)


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
    """Run one explicit engine test and return its synthesis metadata."""
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
