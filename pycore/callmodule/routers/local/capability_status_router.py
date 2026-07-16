# -*- coding: utf-8 -*-
"""
Capability status router.

Endpoints (prefix /api/local/capabilities):
  GET  /status   -> capabilities_status(): CUDA/GPU readiness + free-library
                    availability (translation / TTS / OCR / STT).
  GET  /info     -> system_info(): pycore constants (FIXED IN CODE) + the static
                    directories pycore uses (read-only display).
  POST /open-dir -> open one of those static directories in the OS file manager.
                    Takes a KEY (allow-listed), never an arbitrary path.
  GET  /settings -> per-capability engine chains the Queue Center drawer edits:
                    { success, stt, tts, image, translation } where each block is
                    { priority:[engine...], available:{engine:bool},
                      installed:{engine:bool}, setup_reasons:{engine:str}, options:{} }.
                    priority = persisted custom order merged over the live
                    orchestrator order (omitted engines appended so a save can
                    never silence one); available + options are LIVE.
  POST /settings -> persist ONE capability's priority order (+ TTS options applied
                    live via the engine setters) and return the updated block.

Cheap: library checks use find_spec (no heavy import / no install) and CUDA is
the cached nvidia-smi detector. Complements the per-feature endpoints
(/api/local/ai/*, /ocr/status, /tts/status, /system/resources).
"""

from typing import Any, Dict, List, Optional

import concurrent.futures
import time

import fastapi
from pydantic import BaseModel

from pycore import ColorPrint, get_user_data_store
from pycore.pyutils.common.capabilities import (
    capabilities_status,
    resolve_static_dir,
    system_info,
)
from pycore.pyutils.common.system_launcher import open_dir
from pycore.pyutils.tts import tts_status
from pycore.pyutils.stt import stt_status
from pycore.pyutils.edge_tts.edge_tts_client import get_synth_timeout, set_synth_timeout
from pycore.pyutils.tts.tts_orchestrator import (
    default_tts_engine_priority,
    default_sentence_tts_priority,
    default_word_tts_priority,
    get_edge_cooldown_seconds,
    reload_tts_priority,
    set_edge_cooldown_seconds,
)
from pycore.pyutils.stt.stt_orchestrator import default_stt_engine_priority
from pycore.pyctl.ai.ai_keys import PROVIDERS, is_configured
from pycore.pyutils.translator.dictionary import get_dictionary_service

from pycore.pyutils.tts.tts_service_manager import apply_server_settings

from pycore.pyutils.tts.tts_service_manager import get_server_settings



router = fastapi.APIRouter(prefix="/api/local/capabilities", tags=["Local Processing - Capabilities"])

# Persisted custom engine order per capability lives in this user_data section
# ({stt|tts|image|translation: [engine, ...]}). The live availability/options are
# always read fresh from the orchestrators; only the ORDER is persisted here.
_CAP_SECTION = "capability_priorities"
# sentence_tts (qwen3tts-first) + word_tts (edge-first) are separate priority
# profiles consumed by tts_orchestrator._priority("sentence"|"word"); the shared
# ``tts`` block remains the global default for ad-hoc synth + UI tests.
_CAP_KEYS = ("stt", "tts", "sentence_tts", "word_tts", "image", "translation")
# TTS tuning shares the same user_data section the tts router persists to.
_TTS_SECTION = "tts"
_CAP_BLOCKS_CACHE: Dict[str, Any] = {"ts": 0.0, "data": None}
_CAP_BLOCKS_TTL_S = 3.0
_ENGINE_PROBE_TIMEOUT_S = 8.0


class OpenDirRequest(BaseModel):
    """Open a static directory by its registry KEY (not a free-form path)."""
    key: str


class CapabilitySettingsPatch(BaseModel):
    """POST /settings body: re-order ONE capability + (TTS) tuning options."""
    capability: str
    priority: Optional[List[str]] = None
    options: Optional[Dict[str, Any]] = None


def _merge_order(
    persisted: Any,
    live_order: List[str],
    known_order: Optional[List[str]] = None,
) -> List[str]:
    """Persisted order first (only engines that still exist live), then any live
    engine not in the persisted order appended — so a stale/partial saved order
    can never silence a real engine. When the live probe returns empty (timeout),
    keep the persisted order and append any known engines not yet listed."""
    live = [e for e in live_order if e]
    known = [e for e in (known_order or []) if e]
    if not live:
        saved = [e for e in (persisted or []) if isinstance(e, str) and e]
        if saved:
            return saved + [e for e in known if e not in saved]
        return known
    saved = [e for e in (persisted or []) if isinstance(e, str) and e in live]
    return saved + [e for e in live if e not in saved]


def _persisted_priority(cap: str) -> Any:
    """The persisted custom order for one capability (None when never saved)."""
    try:
        section = get_user_data_store().get_section(_CAP_SECTION) or {}
    except Exception:  # noqa: BLE001 — a missing/corrupt section just means defaults
        return None
    value = section.get(cap)
    return value if isinstance(value, list) else None


def _fallback_engine_maps(
    known_order: List[str],
    reason: str,
) -> Dict[str, Dict[str, Any]]:
    """Skeleton engine rows when a live orchestrator probe fails or times out."""
    return {
        name: {
            "available": False,
            "installed": False,
            "disabled_reason": reason,
        }
        for name in known_order
        if name
    }


def _engines_from_orchestrator(
    status_fn,
    known_order: Optional[List[str]] = None,
) -> Dict[str, Dict[str, Any]]:
    """Per-engine snapshot from a tts/stt orchestrator status() call."""
    def _probe() -> Dict[str, Dict[str, Any]]:
        try:
            snap = status_fn() or {}
        except Exception:  # noqa: BLE001 — orchestrator probe is best-effort
            return {}
        out: Dict[str, Dict[str, Any]] = {}
        for eng in snap.get("engines") or []:
            name = eng.get("name")
            if not name:
                continue
            out[name] = {
                "available": bool(eng.get("available")),
                "installed": bool(eng.get("installed")),
                "disabled_reason": eng.get("disabled_reason"),
            }
        return out

    known = [e for e in (known_order or []) if e]
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        fut = pool.submit(_probe)
        try:
            result = fut.result(timeout=_ENGINE_PROBE_TIMEOUT_S)
            if result:
                return result
            if known:
                ColorPrint.yellow(
                    "[capabilities] engine probe returned empty — using known engine list"
                )
                return _fallback_engine_maps(known, "probe returned empty")
            return {}
        except concurrent.futures.TimeoutError:
            ColorPrint.yellow(
                f"[capabilities] engine probe timed out after {_ENGINE_PROBE_TIMEOUT_S}s "
                "— using known engine list"
            )
            if known:
                return _fallback_engine_maps(known, "probe timed out")
            return {}


def _maps_from_engines(engines: Dict[str, Dict[str, Any]]) -> tuple[Dict[str, bool], Dict[str, bool], Dict[str, str]]:
    available: Dict[str, bool] = {}
    installed: Dict[str, bool] = {}
    setup_reasons: Dict[str, str] = {}
    for name, row in engines.items():
        available[name] = bool(row.get("available"))
        installed[name] = (
            bool(row.get("installed"))
            if "installed" in row
            else bool(row.get("available"))
        )
        reason = row.get("disabled_reason")
        if isinstance(reason, str) and reason.strip():
            setup_reasons[name] = reason.strip()
    return available, installed, setup_reasons


def _block(
    cap: str,
    engines: Dict[str, Dict[str, Any]],
    options: Dict[str, Any],
    known_order: Optional[List[str]] = None,
    live_order: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Assemble one capability block (priority = persisted∪live, availability maps).

    ``live_order`` overrides the availability-map key order used as the merge
    fallback - used by sentence_tts/word_tts so their qwen3tts/edge-first
    defaults show when never saved (instead of the global tts order)."""
    available, installed, setup_reasons = _maps_from_engines(engines)
    priority = _merge_order(
        _persisted_priority(cap),
        live_order if live_order is not None else list(available.keys()),
        known_order,
    )
    return {
        "priority": priority,
        "available": available,
        "installed": installed,
        "setup_reasons": setup_reasons,
        "options": options,
    }


def _tts_options() -> Dict[str, Any]:
    """Live TTS tuning + managed local server options for the drawer."""
    try:
        srv = get_server_settings()
        return {
            "synth_timeout_s": get_synth_timeout(),
            "edge_cooldown_s": get_edge_cooldown_seconds(),
            "server_auto_manage": srv.get("server_auto_manage"),
            "server_single_active": srv.get("server_single_active"),
            "server_idle_shutdown_s": srv.get("server_idle_shutdown_s"),
            "server_enabled": srv.get("server_enabled"),
        }
    except Exception:  # noqa: BLE001
        return {}


def _image_available() -> Dict[str, bool]:
    """{provider: configured} for every image-capable AI provider. Uses the
    CHEAP configured-key check (local disk), never a network probe — this
    endpoint must stay fast (it feeds a status drawer, not a live test)."""
    out: Dict[str, bool] = {}
    for name, meta in PROVIDERS.items():
        if meta.get("image"):
            try:
                out[name] = bool(is_configured(name))
            except Exception:  # noqa: BLE001
                out[name] = False
    return out


def _translation_available() -> Dict[str, bool]:
    """Translation engines in default order (offline/free first): ecdict + wordnet
    (offline dictionary, available once the data is installed), google (always
    local), ai (any configured provider). Cheap checks only — no network probe."""
    try:
        ai_ready = any(is_configured(name) for name in PROVIDERS)
    except Exception:  # noqa: BLE001
        ai_ready = False
    out = {"ecdict": False, "wordnet": False, "google": True, "ai": ai_ready}
    try:
        st = get_dictionary_service().status()
        out["ecdict"] = bool((st.get("ecdict") or {}).get("available"))
        out["wordnet"] = bool((st.get("wordnet") or {}).get("available"))
    except Exception:  # noqa: BLE001
        pass
    return out


def _bool_maps_from_available(available: Dict[str, bool]) -> Dict[str, Dict[str, Any]]:
    """Non-orchestrator capabilities: installed mirrors available (no separate install step)."""
    return {
        name: {"available": bool(ok), "installed": bool(ok), "disabled_reason": None}
        for name, ok in available.items()
    }


def _capability_blocks() -> Dict[str, Dict[str, Any]]:
    """All capability blocks (live availability + options + persisted order)."""
    stt_known = list(default_stt_engine_priority())
    tts_known = list(default_tts_engine_priority())
    sentence_known = list(default_sentence_tts_priority())
    word_known = list(default_word_tts_priority())
    # sentence_tts + word_tts reuse the SAME tts_status availability probe (the
    # engine set is identical); only the default ORDER differs (qwen3tts-first /
    # edge-first). live_order pins that default so an unsaved profile shows its
    # own chain, not the global tts order.
    tts_engines = _engines_from_orchestrator(tts_status, tts_known)
    return {
        "stt": _block(
            "stt",
            _engines_from_orchestrator(stt_status, stt_known),
            {},
            stt_known,
        ),
        "tts": _block(
            "tts",
            tts_engines,
            _tts_options(),
            tts_known,
        ),
        "sentence_tts": _block(
            "sentence_tts",
            tts_engines,
            {},
            sentence_known,
            live_order=sentence_known,
        ),
        "word_tts": _block(
            "word_tts",
            tts_engines,
            {},
            word_known,
            live_order=word_known,
        ),
        "image": _block("image", _bool_maps_from_available(_image_available()), {}),
        "translation": _block("translation", _bool_maps_from_available(_translation_available()), {}),
    }


def _cached_capability_blocks() -> Dict[str, Dict[str, Any]]:
    now = time.time()
    cached = _CAP_BLOCKS_CACHE.get("data")
    if isinstance(cached, dict) and now - float(_CAP_BLOCKS_CACHE.get("ts") or 0) < _CAP_BLOCKS_TTL_S:
        return cached
    blocks = _capability_blocks()
    _CAP_BLOCKS_CACHE["ts"] = now
    _CAP_BLOCKS_CACHE["data"] = blocks
    return blocks


def _invalidate_capability_cache() -> None:
    _CAP_BLOCKS_CACHE["ts"] = 0.0
    _CAP_BLOCKS_CACHE["data"] = None


def _save_priority(cap: str, priority: List[str]) -> None:
    """Persist one capability's engine order to the user_data section."""
    store = get_user_data_store()
    section = store.get_section(_CAP_SECTION) or {}
    section[cap] = [e for e in priority if isinstance(e, str) and e]
    store.set_section(_CAP_SECTION, section)


def _apply_tts_options(options: Dict[str, Any]) -> None:
    """Live-apply + persist TTS tuning and managed server options."""
    patch: Dict[str, Any] = {}
    if options.get("synth_timeout_s") is not None:
        patch["synth_timeout_s"] = set_synth_timeout(options["synth_timeout_s"])
    if options.get("edge_cooldown_s") is not None:
        patch["edge_cooldown_s"] = set_edge_cooldown_seconds(options["edge_cooldown_s"])
    if patch:
        store = get_user_data_store()
        section = store.get_section(_TTS_SECTION) or {}
        section.update(patch)
        store.set_section(_TTS_SECTION, section)
    server_keys = (
        "server_auto_manage", "server_single_active",
        "server_idle_shutdown_s", "server_enabled",
    )
    server_patch = {k: options[k] for k in server_keys if k in options}
    if server_patch:
        apply_server_settings(server_patch)


@router.get("/status")
def status():
    """CUDA/GPU readiness + free-library availability snapshot."""
    return capabilities_status()


@router.get("/info")
def info():
    """Read-only pycore constants + static directories (fixed in code)."""
    return system_info()


@router.post("/open-dir")
def open_directory(req: OpenDirRequest):
    """
    Open a known static directory in the OS file manager.

    The path is resolved from an allow-list by KEY, so this can only ever reveal
    one of pycore's own static directories — never an arbitrary path.
    """
    path = resolve_static_dir(req.key)
    if path is None:
        return {"success": False, "error": f"Unknown directory key: {req.key}"}
    if not path.exists():
        return {"success": False, "error": f"Directory does not exist yet: {path}"}
    if open_dir(path):
        return {"success": True, "message": f"Opened {path}"}
    return {"success": False, "error": f"Failed to open {path}"}


@router.get("/settings")
def get_capability_settings():
    """All four capability blocks (stt/tts/image/translation) the Queue Center
    drawer edits: live engine availability + options + the persisted custom
    priority order. Reads in-process orchestrator probes — no network I/O."""
    reload_tts_priority()
    blocks = _cached_capability_blocks()
    return {"success": True, **blocks}


@router.post("/settings")
def post_capability_settings(req: CapabilitySettingsPatch):
    """Persist ONE capability's engine order and (for TTS) apply tuning options
    live, then return the updated block. The saved order is merged over the live
    engine set on read, so omitting an engine never silences it."""
    cap = (req.capability or "").strip().lower()
    if cap not in _CAP_KEYS:
        return {"success": False, "error": f"Unknown capability: {req.capability}"}
    try:
        if req.priority is not None:
            _save_priority(cap, req.priority)
            if cap in ("tts", "sentence_tts", "word_tts"):
                # reload_tts_priority() rebinds ALL THREE profiles, so a save to
                # any one applies realtime to synthesize(priority_profile=...).
                reload_tts_priority()
            if cap == "tts":
                store = get_user_data_store()
                chains = dict(store.get_section("task_capability_chains") or {})
                chains["voice_tts"] = [e for e in req.priority if isinstance(e, str) and e]
                store.set_section("task_capability_chains", chains)
        if cap == "tts" and req.options:
            _apply_tts_options(req.options)
    except Exception as e:  # noqa: BLE001 — persist/apply is best-effort
        ColorPrint.yellow(f"[capabilities] save {cap} failed: {e}")
        return {"success": False, "capability": cap, "error": str(e)}
    _invalidate_capability_cache()
    block = _capability_blocks().get(cap, {
        "priority": [], "available": {}, "installed": {}, "setup_reasons": {}, "options": {},
    })
    ColorPrint.green(f"[capabilities] saved {cap} priority={block['priority']}")
    return {"success": True, "capability": cap, **block}
