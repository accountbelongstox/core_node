# -*- coding: utf-8 -*-
"""
Assist-Laravel settings (unified user-data store, section ``assist_laravel``).

Extracted verbatim (behavior-preserving) from the former assist_worker.py
monolith. Holds the settings contract + the per-capability assist toggle gates
that form the SINGLE control plane the Queue Center exposes:

    { enabled: bool (default False),
      capabilities: { translation, ai_translate, cover, poster, image, tts,
                      sentence_audio, subtitle, stt },
      poll_interval_s: int (default 30, 5..600),
      batch_limit: int (default 3, 1..10) }

translation_worker_enabled_on_start / assist_capability_enabled gate the
EXISTING TranslationWorkerService lanes: section ABSENT => legacy default
(pre-assist behaviour); section PRESENT => enabled AND the capability flag.
"""

from typing import Any, Dict, Optional

from pycore.pyfoundations.system_paths import get_user_data_store


# ============================================================
# Constants
# ============================================================

USER_DATA_SECTION = "assist_laravel"

# Laravel assist API prefix (relative to the selected endpoint base URL).
ASSIST_API_PREFIX = "/api/app_qy_v1/assist"

POLL_INTERVAL_MIN, POLL_INTERVAL_MAX = 5, 600
BATCH_LIMIT_MIN, BATCH_LIMIT_MAX = 1, 10

# Per-capability assist toggles - the SINGLE control plane the Queue Center
# exposes. Each key gates a real lane/claim (see translation_worker_service
# _*_enabled gates + AssistWorker.CLAIMABLE_TYPES):
#   translation    word translation (translation_worker heartbeat)
#   ai_translate   AI translation (remote_fast ai_translate capability)
#   cover          delegated to apps/mcp-chrome (Google Images); OFF in pycore
#   poster         delegated to apps/mcp-chrome (Google Images); OFF in pycore
#   image          word media AI image; delegated to apps/mcp-chrome — OFF in pycore
#   tts            word voice / TTS (remote_audio lane + assist-queue tts claim)
#   sentence_audio sentence voice (remote_sentence_audio lane) - INDEPENDENT of tts
#   subtitle       subtitle search (remote_subtitle lane)
#   stt            speech -> text (remote_stt lane; Laravel lane added separately)
DEFAULT_SETTINGS: Dict[str, Any] = {
    "enabled": False,
    "capabilities": {
        "translation": True,
        "ai_translate": True,
        "cover": False,
        "poster": False,
        "image": False,
        "tts": True,
        "sentence_audio": True,
        # subtitle search: OFF by default - the SubtitleSearchController is absent
        # at this baseline, so an enabled subtitle lane would claim tasks and fail
        # them (burning retries). Enable only once the controller is restored.
        "subtitle": False,
        "stt": True,
    },
    "poll_interval_s": 30,
    "batch_limit": 3,
}


# ============================================================
# Merge / validate
# ============================================================

def _clamp(value: Any, lo: int, hi: int, default: int) -> int:
    """Coerce ``value`` to an int clamped into [lo, hi]; ``default`` on junk."""
    try:
        return max(lo, min(hi, int(value)))
    except (TypeError, ValueError):
        return default


def _merge_settings(raw: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Merge a raw section dict over DEFAULT_SETTINGS with validation/clamping."""
    raw = raw if isinstance(raw, dict) else {}
    caps_raw = raw.get("capabilities")
    caps_raw = caps_raw if isinstance(caps_raw, dict) else {}
    caps = {
        key: bool(caps_raw.get(key, default))
        for key, default in DEFAULT_SETTINGS["capabilities"].items()
    }
    return {
        "enabled": bool(raw.get("enabled", DEFAULT_SETTINGS["enabled"])),
        "capabilities": caps,
        "poll_interval_s": _clamp(
            raw.get("poll_interval_s"), POLL_INTERVAL_MIN, POLL_INTERVAL_MAX,
            DEFAULT_SETTINGS["poll_interval_s"]),
        "batch_limit": _clamp(
            raw.get("batch_limit"), BATCH_LIMIT_MIN, BATCH_LIMIT_MAX,
            DEFAULT_SETTINGS["batch_limit"]),
    }


# ============================================================
# Load / save / exist
# ============================================================

def assist_settings_exist() -> bool:
    """True when the ``assist_laravel`` section is PRESENT in user_data.json.

    Used by the translation-worker gating to preserve pre-upgrade behaviour:
    while the key is entirely absent the translation worker keeps its legacy
    Config-driven default; once the key exists the assist toggle rules.
    """
    return get_user_data_store().get(USER_DATA_SECTION) is not None


def load_assist_settings() -> Dict[str, Any]:
    """Effective settings: stored section merged over defaults (validated)."""
    return _merge_settings(get_user_data_store().get_section(USER_DATA_SECTION))


def save_assist_settings(patch: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Apply ``patch`` on top of the stored settings and persist the FULL merged,
    validated document (so the section is always complete and clamped on disk).
    ``patch.capabilities`` is merged per-key, not replaced wholesale.
    Returns the effective settings after saving.
    """
    store = get_user_data_store()
    current = store.get_section(USER_DATA_SECTION)
    patch = patch if isinstance(patch, dict) else {}
    merged_raw = dict(current)
    for key in ("enabled", "poll_interval_s", "batch_limit"):
        if key in patch:
            merged_raw[key] = patch[key]
    if isinstance(patch.get("capabilities"), dict):
        caps = dict(current.get("capabilities") or {})
        caps.update(patch["capabilities"])
        merged_raw["capabilities"] = caps
    effective = _merge_settings(merged_raw)
    store.set_section(USER_DATA_SECTION, effective)
    return effective


# ============================================================
# Capability gates (control plane for every worker lane)
# ============================================================

def translation_worker_enabled_on_start(legacy_default: bool) -> bool:
    """
    Master-toggle gate for the EXISTING TranslationWorkerService.

    - Section absent (fresh upgrade, key never written): return
      ``legacy_default`` - i.e. Config.TRANSLATION_WORKER_ENABLED_ON_START -
      preserving today's behaviour exactly.
    - Section present: the assist toggle rules -
      ``enabled AND capabilities.translation``.
    """
    return assist_capability_enabled("translation", legacy_default)


def assist_capability_enabled(capability: str, legacy_default: bool = True) -> bool:
    """
    Generic per-capability assist gate (the control plane every worker lane
    consults). Mirrors translation_worker_enabled_on_start for ALL capabilities:

    - Section ABSENT (assist never configured): return ``legacy_default`` so the
      lane keeps its pre-assist behaviour (a hard env-knob default).
    - Section PRESENT: the assist toggle rules - the lane is live only while the
      master ``enabled`` is on AND its capability flag is on (missing key => on,
      so a newly-added capability defaults to advertised).
    """
    if not assist_settings_exist():
        return bool(legacy_default)
    settings = load_assist_settings()
    return bool(settings["enabled"] and settings["capabilities"].get(capability, True))
