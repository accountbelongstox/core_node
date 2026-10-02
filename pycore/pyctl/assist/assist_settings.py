# -*- coding: utf-8 -*-
"""
Assist-Laravel settings (unified user-data store, section ``assist_laravel``).

Holds the per-capability gates that form the single Queue Center control plane:

    { enabled: bool (default False),
      capabilities: { translation, tts, sentence_audio, subtitle, stt } }

Effective value per key, lowest layer first: config/user.settings.json
defaults, the notebook default (contract ``notebook_defaults`` while its env
flag is "1"), then the keys the user explicitly changed (the only ones
persisted).
"""

import os
from typing import Any, Dict, Optional

from pycore.pyfoundations.service_contract import value as service_contract_value
from pycore.pyutils.common.user_data_store import USER_DATA_SECTION_ASSIST_LARAVEL, user_data_store


USER_DATA_SECTION = USER_DATA_SECTION_ASSIST_LARAVEL
CAPABILITY_KEYS = (
    "translation",
    "tts",
    "sentence_audio",
    "subtitle",
    "stt",
)


# ============================================================
# Merge / validate
# ============================================================

def _merge_settings(raw: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Normalize the effective section loaded from the unified settings map."""
    raw = raw if isinstance(raw, dict) else {}
    caps_raw = raw.get("capabilities")
    caps_raw = caps_raw if isinstance(caps_raw, dict) else {}
    caps = {
        key: bool(caps_raw.get(key))
        for key in CAPABILITY_KEYS
    }
    return {
        "enabled": bool(raw.get("enabled")),
        "capabilities": caps,
    }


# ============================================================
# Load / save / exist
# ============================================================

def assist_settings_exist() -> bool:
    """True when the effective settings map contains the Assist section."""
    return user_data_store.get(USER_DATA_SECTION) is not None


_NOTEBOOK_DEFAULTS = service_contract_value("notebook_defaults")
_ASSIST_DEFAULT_ENV = str(_NOTEBOOK_DEFAULTS["assist_default_env"])
_ASSIST_DEFAULT_CAPABILITIES = tuple(str(name) for name in _NOTEBOOK_DEFAULTS["assist_default_capabilities"])


def _environment_default() -> Dict[str, Any]:
    """The notebook layer (contract ``notebook_defaults``): assist ON with the
    listed capabilities while the env flag is "1"; empty otherwise."""
    if os.environ.get(_ASSIST_DEFAULT_ENV, "").strip() != "1":
        return {}
    return {"enabled": True, "capabilities": {name: True for name in _ASSIST_DEFAULT_CAPABILITIES}}


def _overlay(base: Dict[str, Any], top: Dict[str, Any]) -> Dict[str, Any]:
    """``top``'s explicit keys over ``base`` (capabilities merged per key)."""
    merged = dict(base)
    if "enabled" in top:
        merged["enabled"] = top["enabled"]
    if isinstance(top.get("capabilities"), dict):
        merged["capabilities"] = {**(base.get("capabilities") or {}), **top["capabilities"]}
    return merged


def load_assist_settings() -> Dict[str, Any]:
    """Effective settings: defaults, then the notebook layer, then the user's
    explicit keys (validated); an explicit user key always wins."""
    layered = _overlay(user_data_store.get_default_section(USER_DATA_SECTION), _environment_default())
    return _merge_settings(_overlay(layered, user_data_store.get_personalized_section(USER_DATA_SECTION)))


def save_assist_settings(patch: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Persist only the keys ``patch`` explicitly sets (``enabled``, and
    ``capabilities`` per key, validated) on top of the user's earlier explicit
    keys; defaults and the notebook layer are never written. Returns the
    effective settings after saving.
    """
    patch = patch if isinstance(patch, dict) else {}
    explicit: Dict[str, Any] = {}
    if "enabled" in patch:
        explicit["enabled"] = bool(patch["enabled"])
    if isinstance(patch.get("capabilities"), dict):
        explicit["capabilities"] = {
            key: bool(value) for key, value in patch["capabilities"].items() if key in CAPABILITY_KEYS
        }
    stored = _overlay(user_data_store.get_personalized_section(USER_DATA_SECTION), explicit)
    stored_capabilities = stored.get("capabilities")
    if isinstance(stored_capabilities, dict):
        stored["capabilities"] = {key: value for key, value in stored_capabilities.items() if key in CAPABILITY_KEYS}
    user_data_store.set_section(USER_DATA_SECTION, stored)
    return load_assist_settings()


def set_assist_capability(capability: str, enabled: bool) -> Dict[str, Any]:
    """Flip ONE capability switch and return the effective settings.

    The single persistence point every Queue Center control flows through
    (translation / word audio / sentence audio); callers then hand the
    returned settings to apply_assist_runtime for the live transition.
    """
    current = load_assist_settings()
    caps = dict(current.get("capabilities") or {})
    caps[str(capability)] = bool(enabled)
    return save_assist_settings({
        "enabled": bool(any(caps.values())),
        "capabilities": {str(capability): bool(enabled)},
    })


def assist_callback_states(
    settings: Optional[Dict[str, Any]] = None,
) -> Dict[str, bool]:
    """Resolve every queue callback from the current in-memory user settings."""
    current = _merge_settings(settings) if settings is not None else load_assist_settings()
    enabled = bool(current.get("enabled"))
    capabilities = current.get("capabilities") or {}
    translation = enabled and bool(capabilities.get("translation"))
    word_audio = enabled and bool(capabilities.get("tts"))
    sentence_audio = enabled and bool(capabilities.get("sentence_audio"))
    subtitle = enabled and bool(capabilities.get("subtitle"))
    stt = enabled and bool(capabilities.get("stt"))
    translation_worker = translation or subtitle or stt
    return {
        "translation_worker": translation_worker,
        "tts_queue_poller": word_audio,
        "tts_sentence_worker": sentence_audio,
        "subtitle_search_worker": subtitle,
        # Laravel depends on pycore for compute tasks; the lane is not a user toggle.
        "compute_worker": True,
    }


# ============================================================
# Capability gates (control plane for every worker lane)
# ============================================================

def translation_worker_enabled_on_start(legacy_default: bool) -> bool:
    """
    Master-toggle gate for the EXISTING TranslationWorkerService.

    The legacy default is accepted for call compatibility but never controls
    lifecycle. The effective in-memory user setting is authoritative.
    """
    return assist_capability_enabled("translation", legacy_default)


def assist_capability_enabled(capability: str, legacy_default: bool = True) -> bool:
    """
    Generic per-capability assist gate (the control plane every worker lane
    consults). Mirrors translation_worker_enabled_on_start for ALL capabilities:

    The lane is live only while the effective master setting and capability
    setting are both enabled. Values come from the unified in-memory map.
    """
    settings = load_assist_settings()
    return bool(settings["enabled"] and settings["capabilities"].get(capability))
