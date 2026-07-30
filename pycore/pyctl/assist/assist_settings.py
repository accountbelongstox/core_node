# -*- coding: utf-8 -*-
"""
Assist-Laravel settings (unified user-data store, section ``assist_laravel``).

Holds the per-capability gates that form the single Queue Center control plane:

    { enabled: bool (default False),
      capabilities: { translation, ai_translate, tts,
                      sentence_audio, subtitle, stt } }

Defaults are loaded from config/user.settings.json. Personalized values from
the mapped user configuration directory override them in memory and on disk.
"""

from typing import Any, Dict, Optional

from pycore.pyutils.common.user_data_store import user_data_store


USER_DATA_SECTION = "assist_laravel"
ASSIST_API_PREFIX = "/api/app_qy_v1/assist"
CAPABILITY_KEYS = (
    "translation",
    "ai_translate",
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


def load_assist_settings() -> Dict[str, Any]:
    """Effective settings: stored section merged over defaults (validated)."""
    return _merge_settings(user_data_store.get_section(USER_DATA_SECTION))


def save_assist_settings(patch: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Apply ``patch`` on top of the stored settings and persist the FULL merged,
    validated document (so the section is always complete and clamped on disk).
    ``patch.capabilities`` is merged per-key, not replaced wholesale.
    Returns the effective settings after saving.
    """
    store = user_data_store
    current = store.get_section(USER_DATA_SECTION) or {}
    patch = patch if isinstance(patch, dict) else {}
    merged_raw = dict(current)
    for key in ("enabled",):
        if key in patch:
            merged_raw[key] = patch[key]
    if isinstance(patch.get("capabilities"), dict):
        caps = dict(current.get("capabilities") or {})
        caps.update(patch["capabilities"])
        merged_raw["capabilities"] = caps
    effective = _merge_settings(merged_raw)
    store.set_section(USER_DATA_SECTION, effective)
    return effective


def assist_callback_states(
    settings: Optional[Dict[str, Any]] = None,
) -> Dict[str, bool]:
    """Resolve every queue callback from the current in-memory user settings."""
    current = _merge_settings(settings) if settings is not None else load_assist_settings()
    enabled = bool(current.get("enabled"))
    capabilities = current.get("capabilities") or {}
    translation = enabled and bool(capabilities.get("translation"))
    ai_translate = enabled and bool(capabilities.get("ai_translate"))
    word_audio = enabled and bool(capabilities.get("tts"))
    sentence_audio = enabled and bool(capabilities.get("sentence_audio"))
    subtitle = enabled and bool(capabilities.get("subtitle"))
    stt = enabled and bool(capabilities.get("stt"))
    translation_worker = translation or ai_translate or subtitle or stt
    transport = translation_worker or word_audio or sentence_audio
    return {
        "global_task_worker": transport,
        "translation_worker": translation_worker,
        "translation_queue_monitor": translation or ai_translate,
        "translation_http_event_client": transport,
        "sentence_queue_monitor": sentence_audio,
        "tts_queue_poller": word_audio,
        "tts_sentence_worker": sentence_audio,
        "subtitle_search_worker": subtitle,
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
