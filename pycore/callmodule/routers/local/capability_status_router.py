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
                    { priority:[engine...], available:{engine:bool}, options:{} }.
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
    get_edge_cooldown_seconds,
    set_edge_cooldown_seconds,
)
from pycore.pyctl.ai.ai_keys import PROVIDERS, is_configured
from pycore.pyutils.translator.dictionary import get_dictionary_service

router = fastapi.APIRouter(prefix="/api/local/capabilities", tags=["Local Processing - Capabilities"])

# Persisted custom engine order per capability lives in this user_data section
# ({stt|tts|image|translation: [engine, ...]}). The live availability/options are
# always read fresh from the orchestrators; only the ORDER is persisted here.
_CAP_SECTION = "capability_priorities"
_CAP_KEYS = ("stt", "tts", "image", "translation")
# TTS tuning shares the same user_data section the tts router persists to.
_TTS_SECTION = "tts"


class OpenDirRequest(BaseModel):
    """Open a static directory by its registry KEY (not a free-form path)."""
    key: str


class CapabilitySettingsPatch(BaseModel):
    """POST /settings body: re-order ONE capability + (TTS) tuning options."""
    capability: str
    priority: Optional[List[str]] = None
    options: Optional[Dict[str, Any]] = None


def _merge_order(persisted: Any, live_order: List[str]) -> List[str]:
    """Persisted order first (only engines that still exist live), then any live
    engine not in the persisted order appended — so a stale/partial saved order
    can never silence a real engine."""
    live = [e for e in live_order if e]
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


def _engines_from_orchestrator(status_fn) -> Dict[str, bool]:
    """{engine_name: available} from a tts/stt orchestrator status() snapshot."""
    try:
        snap = status_fn() or {}
    except Exception:  # noqa: BLE001 — orchestrator probe is best-effort
        return {}
    out: Dict[str, bool] = {}
    for eng in snap.get("engines") or []:
        name = eng.get("name")
        if name:
            out[name] = bool(eng.get("available"))
    return out


def _block(cap: str, available: Dict[str, bool], options: Dict[str, Any]) -> Dict[str, Any]:
    """Assemble one capability block (priority = persisted∪live, available, options)."""
    priority = _merge_order(_persisted_priority(cap), list(available.keys()))
    return {"priority": priority, "available": available, "options": options}


def _tts_options() -> Dict[str, Any]:
    """Live TTS tuning the drawer exposes (per-attempt synth timeout + edge cooldown)."""
    try:
        return {"synth_timeout_s": get_synth_timeout(),
                "edge_cooldown_s": get_edge_cooldown_seconds()}
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


def _capability_blocks() -> Dict[str, Dict[str, Any]]:
    """All four capability blocks (live availability + options + persisted order)."""
    return {
        "stt": _block("stt", _engines_from_orchestrator(stt_status), {}),
        "tts": _block("tts", _engines_from_orchestrator(tts_status), _tts_options()),
        "image": _block("image", _image_available(), {}),
        "translation": _block("translation", _translation_available(), {}),
    }


def _save_priority(cap: str, priority: List[str]) -> None:
    """Persist one capability's engine order to the user_data section."""
    store = get_user_data_store()
    section = store.get_section(_CAP_SECTION) or {}
    section[cap] = [e for e in priority if isinstance(e, str) and e]
    store.set_section(_CAP_SECTION, section)


def _apply_tts_options(options: Dict[str, Any]) -> None:
    """Live-apply + persist TTS tuning (clamped by the engine setters)."""
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
    blocks = _capability_blocks()
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
        if cap == "tts" and req.options:
            _apply_tts_options(req.options)
    except Exception as e:  # noqa: BLE001 — persist/apply is best-effort
        ColorPrint.yellow(f"[capabilities] save {cap} failed: {e}")
        return {"success": False, "capability": cap, "error": str(e)}
    block = _capability_blocks().get(cap, {"priority": [], "available": {}, "options": {}})
    ColorPrint.green(f"[capabilities] saved {cap} priority={block['priority']}")
    return {"success": True, "capability": cap, **block}
