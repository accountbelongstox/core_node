# -*- coding: utf-8 -*-
"""Local-first TTS synthesis with profile-aware fallback and managed engines.

Priority persistence and runtime cooldown state live in pyutils.tts.engine_policy.
"""

import importlib.metadata
import shutil
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
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
    _ORCHESTRATOR_STATE_QUEUE,
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
    tts_engine_supports_language,
    tts_engine_actual_accent as _engine_actual_accent,
    tts_locale,
    tts_rate_to_speed as _rate_to_speed,
    tts_variant_result as _variant_result,
)
import pycore.pyutils.tts.sentence_audio_cache as sentence_audio_cache
from pycore.pyutils.tts.edge.config import TTSConfig
from pycore.pyutils.tts.engine_registry import (
    TTSSynthesisRequest,
    tts_engine_registry,
)
from pycore.pyutils.common.model_tiers import runtime_engine_model
from pycore.pyutils.common.status_snapshot_cache import (
    STATUS_SNAPSHOT_CAPABILITIES_KEY,
    STATUS_SNAPSHOT_TTS_ENGINE_PREFIX,
    STATUS_SNAPSHOT_TTS_KEY,
    status_snapshot_cache,
)
from pycore.pyutils.tts.tts_engine_probe import engine_installed, engine_unavailable_reason
from pycore.pyutils.tts.tts_service_manager import (
    get_server_settings,
    is_server_engine,
    server_runtime_status,
)
from pycore.pyutils.common.managed_service import (
    ManagedServiceUnavailable,
    managed_services,
)
from pycore.pyutils.common.managed_service_facade import managed_model_load_context
import pycore.pyutils.tts.gtts_web_engine as gtts_web_engine
import pycore.pyutils.tts.qwen.engine as qwen_engine
import pycore.pyutils.tts.streamelements_engine as streamelements_engine

_TTS_ENGINE_STATUS_TTL_SECONDS = 300.0
_REQUIRED_ENGINE_RETRY_INITIAL_SECONDS = 0.5
_REQUIRED_ENGINE_RETRY_MAX_SECONDS = 10.0


def _dist_version(dist: str) -> Optional[str]:
    try:
        return importlib.metadata.version(dist)
    except Exception:
        return None



def _priority(profile: str = "default") -> tuple[str, ...]:
    return configured_tts_priority(profile)

def _edge_in_cooldown() -> bool:
    return edge_in_cooldown()


def _set_edge_cooldown() -> None:
    cooldown = mark_edge_cooldown()


def _managed_required_engine_recoverable(name: str) -> bool:
    """Return whether a required managed engine may recover without user action."""
    spec = managed_services.spec(name)
    settings = get_server_settings()
    enabled = settings.get("server_enabled") or {}
    if spec is None or not spec.installed() or not spec.config_ready():
        return False
    if not bool(enabled.get(name, True)):
        return False
    return bool(settings.get("server_auto_manage", True)) or managed_services.is_running(name)
    ColorPrint.yellow(
        f"[tts] edge-tts cooling down for {cooldown:.0f}s; using offline engine meanwhile"
    )


def _edge_voice(lang: Optional[str], accent: Optional[str] = None,
                gender: Optional[str] = None) -> str:
    voice = TTSConfig.resolve_voice(tts_locale(lang), accent, gender)
    if not voice:
        ColorPrint.yellow(f"[tts] no edge voice for language '{lang or 'unknown'}'")
    return voice




def engine_available(name: str) -> bool:
    adapter = tts_engine_registry.get(name)
    return bool(adapter and adapter.available())


def engine_concurrency(name: str) -> str:
    adapter = tts_engine_registry.get(name)
    return adapter.concurrency if adapter else "serial"


def engine_model_id(engine: str) -> str:
    """Model/checkpoint id behind one engine run ("" when not model-tiered).

    For managed server engines the server-side report wins so the label stays
    strictly aligned with the process that synthesized the audio."""
    name = (engine or "").strip().lower()
    adapter = tts_engine_registry.get(name)
    if adapter is None or not adapter.tiered:
        return ""
    if name == "qwen3tts":
        return qwen_engine.active_model_id()
    return runtime_engine_model(name)


def engine_chunked(engine: str) -> bool:
    """Whether one engine's run produces multi-sentence (sentence-chunked)
    audio.

    Single-version pipeline: the local Qwen3-TTS lane ALWAYS synthesizes
    sentence-sized chunks and concatenates them (long single-shot generation
    degrades into noise, QwenLM/Qwen3-TTS#258) - there is no version to
    compare. Callers stamp the multi-sentence marker from this static truth;
    records that predate the marker are the legacy audio."""
    return (engine or "").strip().lower() == "qwen3tts"


def _engine_disabled_reason(name: str, available: Optional[bool] = None) -> Optional[str]:
    """UI hint when an engine is off (not installed, needs config, or server down)."""
    is_available = engine_available(name) if available is None else available
    if is_available:
        return None
    return engine_unavailable_reason(name)


def best_engine() -> Optional[str]:
    for name in _priority():
        if engine_available(name):
            return name
    return None


def _build_tts_engine_status(name: str, refresh: bool) -> Dict[str, Any]:
    """Build one engine row; normal UI reads never run server health commands."""
    adapter = tts_engine_registry.get(name)
    if adapter is None:
        return {
            "name": name,
            "available": False,
            "installed": False,
            "note": "",
            "concurrency": "serial",
        }
    installed = engine_installed(name)
    managed = is_server_engine(name)
    runtime = server_runtime_status(name, refresh=refresh) if managed else {}
    if refresh:
        available = engine_available(name)
    elif managed:
        available = bool(
            (installed and adapter.config_ready())
            or runtime.get("server_running")
            or runtime.get("model_loaded")
        )
    elif name == "edge":
        available = installed
    else:
        available = engine_available(name)
    entry: Dict[str, Any] = {
        "name": name,
        "available": available,
        "installed": installed,
        "note": adapter.note,
        "concurrency": adapter.concurrency,
        **runtime,
    }
    if adapter.distribution and available:
        entry["version"] = _dist_version(adapter.distribution)
    if adapter.tiered:
        tier_model = runtime_engine_model(name)
        if tier_model:
            entry["model"] = tier_model
    if refresh:
        reason = _engine_disabled_reason(name, available)
        if reason:
            entry["disabled_reason"] = reason
    return entry


def _tts_engine_status(name: str, refresh: bool) -> Dict[str, Any]:
    cache_key = f"{STATUS_SNAPSHOT_TTS_ENGINE_PREFIX}{name}"
    return status_snapshot_cache.get(
        cache_key,
        lambda: _build_tts_engine_status(name, refresh),
        refresh=refresh,
        ttl_seconds=_TTS_ENGINE_STATUS_TTL_SECONDS,
    )


def invalidate_tts_status_cache(engine: Optional[str] = None) -> None:
    """Invalidate the aggregate plus one or all per-engine TTS snapshots."""
    status_snapshot_cache.invalidate(STATUS_SNAPSHOT_TTS_KEY)
    status_snapshot_cache.invalidate(STATUS_SNAPSHOT_CAPABILITIES_KEY)
    if engine:
        status_snapshot_cache.invalidate(
            f"{STATUS_SNAPSHOT_TTS_ENGINE_PREFIX}{engine}"
        )
        return
    status_snapshot_cache.invalidate_prefix(STATUS_SNAPSHOT_TTS_ENGINE_PREFIX)


def tts_status(refresh: bool = False) -> Dict[str, Any]:
    """Availability snapshot; live health probes run only on explicit refresh."""
    edge_cooldown = edge_cooldown_remaining()
    se_cooldown = streamelements_engine.cooldown_remaining()
    engines: List[Dict[str, Any]] = []
    for i, name in enumerate(_priority()):
        entry = _tts_engine_status(name, refresh)
        entry["priority"] = i + 1
        if name == "edge":
            # When cooling down, synthesize() skips edge regardless of availability.
            entry["cooldown_remaining"] = edge_cooldown
        if name == "streamelements":
            entry["cooldown_remaining"] = se_cooldown
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


def _synthesis_request(
    text: str,
    lang: Optional[str],
    output_path: Path,
    rate: Optional[str],
    accent: Optional[str] = None,
    gender: Optional[str] = None,
    speaker: Optional[str] = None,
    instruct: Optional[str] = None,
    client_job_id: Optional[str] = None,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> TTSSynthesisRequest:
    return TTSSynthesisRequest(
        text=text,
        language=lang or "en",
        output_path=output_path,
        speed=_rate_to_speed(rate),
        locale=tts_locale(lang),
        rate=rate,
        accent=accent,
        gender=gender,
        speaker=speaker,
        instruct=instruct,
        client_job_id=client_job_id,
        progress_callback=progress_callback,
    )


def describe_synth_command(
    engine: str,
    text: str,
    language: Optional[str] = None,
    output_path: Optional[Path] = None,
    accent: Optional[str] = None,
    rate: Optional[str] = None,
    gender: Optional[str] = None,
) -> str:
    if (engine or "").strip().lower() == "gtts_web":
        return gtts_web_engine.describe_command(
            text,
            language or "en",
            output_path or Path("<output.mp3>"),
        )
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


def synthesize(
    text: str,
    language: Optional[str],
    output_path: Path,
    rate: Optional[str] = None,
    accent: Optional[str] = None,
    gender: Optional[str] = None,
    priority_profile: str = "auto",
    required_engine: Optional[str] = None,
    speaker: Optional[str] = None,
    instruct: Optional[str] = None,
    client_job_id: Optional[str] = None,
    excluded_engines: Optional[Tuple[str, ...]] = None,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> Dict[str, Any]:
    """Synthesize text with one required engine or the selected fallback profile."""
    cleaned = (text or "").strip()
    if not cleaned:
        return {"success": False, "engine": None, "model": None, "chunked": False,
                "accent": None, "error": "empty text", "tried": []}

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    want_accent = _normalize_accent(accent)
    profile = priority_profile
    if profile == "auto":
        profile = "word" if is_word_text(cleaned) else "sentence"

    # Resolve the engine order once (the sentence profile applies the GPU gate).
    engine_name = (required_engine or "").strip().lower()
    configured_order = (engine_name,) if engine_name else _priority(profile)
    excluded = frozenset(excluded_engines or ())
    engine_order = tuple(
        name for name in configured_order
        if name not in excluded and tts_engine_supports_language(name, language)
    )
    unsupported_engines = tuple(
        name for name in configured_order
        if not tts_engine_supports_language(name, language)
    )
    if unsupported_engines:
        ColorPrint.gray(
            f"[tts] language '{language or 'en'}' skips unsupported engines: "
            f"{', '.join(unsupported_engines)}"
        )
    # Sentence-audio cache: an identical sentence request (same text/lang/voice/
    # engine/format) returns the previously-synthesized file WITHOUT re-synth.
    # Word audio is intentionally not cached here (short, edge-first, cheap).
    cache_ext = (output_path.suffix.lstrip(".").lower() or "mp3")
    cache_speaker = cache_instruct = cache_model = cache_speed = ""
    if profile == "sentence":
        cache_speaker, cache_instruct, cache_model, cache_speed = (
            _sentence_cache_identity(want_accent, gender, rate)
        )
        if (speaker or "").strip():
            cache_speaker = str(speaker).strip()
        if (instruct or "").strip():
            cache_instruct = str(instruct).strip()
        for cand in engine_order:
            hit = sentence_audio_cache.lookup_or_none(
                text=cleaned, lang=language or "en", speaker=cache_speaker,
                instruct=cache_instruct, engine=cand, fmt=cache_ext,
                model_id=cache_model, speed=cache_speed,
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
                "model": engine_model_id(cand),
                "chunked": engine_chunked(cand),
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
    last_synth_command = ""
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
        managed_engine = is_server_engine(name)
        if not managed_engine and not engine_available(name):
            continue
        adapter = tts_engine_registry.get(name)
        if adapter is None:
            continue
        request = _synthesis_request(
            cleaned,
            language,
            output_path,
            rate,
            want_accent,
            gender,
            speaker,
            instruct,
            client_job_id,
            progress_callback,
        )
        synth_command = describe_synth_command(
            name, cleaned, language, output_path, want_accent, rate, gender
        )
        recovery_delay = _REQUIRED_ENGINE_RETRY_INITIAL_SECONDS
        recovery_revision = 0
        while True:
            try:
                with managed_services.lease(name), managed_model_load_context(name):
                    tried.append(name)
                    last_synth_command = synth_command
                    ok = adapter.synthesize(request)
                break
            except ManagedServiceUnavailable as exc:
                last_error = f"{name}: {exc}"
                if not engine_name or name != engine_name:
                    ColorPrint.gray(f"[tts] {name} unavailable; trying next engine")
                    ok = False
                    break
                if not _managed_required_engine_recoverable(name):
                    ok = False
                    break
                if THREAD_BUS.is_shutdown_requested():
                    ok = False
                    break
                recovery_revision += 1
                if progress_callback is not None:
                    progress_callback({
                        "status": "running",
                        "progress_revision": recovery_revision,
                        "progress": 0,
                        "progress_total": 0,
                        "progress_phase": "service_recovery",
                    })
                ColorPrint.gray(
                    f"[tts] required {name} service recovering; "
                    f"retrying in {recovery_delay:g}s"
                )
                time.sleep(recovery_delay)
                recovery_delay = min(
                    _REQUIRED_ENGINE_RETRY_MAX_SECONDS,
                    recovery_delay * 2.0,
                )
            except Exception as e:  # noqa: BLE001— fall through to next engine
                last_error = f"{name}: {e}"
                ColorPrint.yellow(f"[tts] {name} failed ({e}); trying next engine")
                ColorPrint.yellow(f"[tts] failed synth command: {synth_command}")
                if name == "edge":
                    _set_edge_cooldown()
                ok = False
                break
        if ok and output_path.exists() and output_path.stat().st_size > 0:
            # Populate the sentence cache under the engine that ACTUALLY
            # produced the audio so the next identical request is a hit.
            if profile == "sentence":
                try:
                    sentence_audio_cache.store_result(
                        text=cleaned, lang=language or "en", speaker=cache_speaker,
                        instruct=cache_instruct, engine=name, fmt=cache_ext,
                        model_id=cache_model, speed=cache_speed,
                        data_bytes=output_path.read_bytes(),
                    )
                except OSError as exc:
                    ColorPrint.gray(f"[tts] sentence cache store skipped ({exc})")
            return {
                "success": True,
                "engine": name,
                "model": engine_model_id(name),
                "chunked": engine_chunked(name),
                "accent": _engine_actual_accent(name, language, want_accent),
                "error": None,
                "cached": False,
                "tried": tried,
                "synth_command": synth_command,
            }
        last_error = f"{name}: synthesis failed"
        detail = _engine_synth_error(name)
        if detail:
            last_error = f"{name}: {detail}"
        ColorPrint.gray(f"[tts] {name} returned no audio; trying next engine")
        ColorPrint.yellow(f"[tts] failed synth command: {synth_command}")
        if name == "edge":
            _set_edge_cooldown()

    return {
        "success": False,
        "engine": None,
        "model": None,
        "chunked": False,
        "accent": None,
        "error": last_error or ("No TTS engine available" if not tried else "All TTS engines failed"),
        "tried": tried,
        "synth_command": last_synth_command,
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
    can_batch = (
        qwen_first
        and tts_engine_supports_language("qwen3tts", language)
        and n >= 2
    )

    if can_batch:
        retry_qwen = True
        try:
            with managed_services.lease("qwen3tts"):
                ok_flags = qwen_engine.synthesize_variants(
                    cleaned, language or "en", variants[:n], [Path(out_paths[i]) for i in range(n)]
                )
        except ManagedServiceUnavailable as exc:
            ColorPrint.gray(f"[tts] qwen3tts batch unavailable ({exc}); using fallback engines")
            ok_flags = [False] * n
            retry_qwen = False
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
                                 priority_profile="sentence",
                                 excluded_engines=() if retry_qwen else ("qwen3tts",))
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


def _engine_synth_error(engine: str) -> Optional[str]:
    """Best-effort detail from the last single-engine synth attempt."""
    adapter = tts_engine_registry.get(engine)
    if adapter is not None:
        detail = adapter.last_synth_error()
        if detail:
            return detail
        reason = adapter.disabled_reason()
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
    adapter = tts_engine_registry.get(engine)
    if adapter is None:
        call_serialized(
            _ORCHESTRATOR_STATE_QUEUE,
            _set_orchestrator_state,
            "last_engine_synth_error",
            f"unknown TTS engine: {engine}",
        )
        return False
    if not tts_engine_supports_language(engine, language):
        call_serialized(
            _ORCHESTRATOR_STATE_QUEUE,
            _set_orchestrator_state,
            "last_engine_synth_error",
            f"{engine} does not support language: {language or 'en'}",
        )
        return False
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cleaned = (text or "").strip()
    synth_command = describe_synth_command(
        engine, cleaned, language, output_path, accent, rate,
        extra_params.get("gender"),
    )
    # Apply per-engine extra params before the synth call, restore afterwards.
    applied_env = _apply_engine_extra_params(engine, extra_params)
    request = _synthesis_request(
        cleaned,
        language,
        output_path,
        rate,
        _normalize_accent(accent),
        extra_params.get("gender"),
        extra_params.get("speaker"),
        extra_params.get("instruct"),
    )
    ok = False
    try:
        with managed_services.lease(engine), managed_model_load_context(engine):
            ok = adapter.synthesize(request)
    except Exception as e:  # noqa: BLE001
        call_serialized(
            _ORCHESTRATOR_STATE_QUEUE,
            _set_orchestrator_state,
            "last_engine_synth_error",
            str(e),
        )
        ColorPrint.yellow(f"[tts] {engine} test failed ({e})")
        ColorPrint.yellow(f"[tts] failed synth command: {synth_command}")
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
    produced_audio = bool(
        ok and output_path.exists() and output_path.stat().st_size > 0
    )
    if not produced_audio:
        ColorPrint.yellow(f"[tts] failed synth command: {synth_command}")
    return produced_audio


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
                "error": "no TTS engine available"}
    if not tts_engine_supports_language(name, language):
        return {
            "success": False,
            "engine": name,
            "latency_ms": 0,
            "bytes": 0,
            "error": f"{name} does not support language: {language}",
        }
    if not is_server_engine(name) and not engine_available(name):
        reason = _engine_disabled_reason(name)
        err = reason or f"{name} unavailable"
        return {"success": False, "engine": name, "latency_ms": 0, "bytes": 0,
                "error": err}
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
        "model": engine_model_id(name) if ok else None,
        "chunked": engine_chunked(name) if ok else False,
        "latency_ms": latency,
        "bytes": size,
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
    "engine_concurrency",
    "engine_model_id",
    "engine_chunked",
    "best_engine",
    "tts_status",
    "describe_synth_command",
    "synthesize",
    "synthesize_variants",
    "synthesize_engine",
    "tts_test",
    "is_word_text",
]
