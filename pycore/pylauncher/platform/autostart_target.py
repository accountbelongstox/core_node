# -*- coding: utf-8 -*-
"""Launcher auto-start target and mechanism preferences.

The "target" is WHAT auto-start launches at boot/login:
  - "pyservice": the full pycore RPC stack (pyservice.sh/ps1 -> UI dev server +
    worker). Default.
  - "launcher":  the multi-terminal grid launcher (python -m pycore.pyutils.launcher).
  - "both":      pyservice in the background, then the launcher in the foreground.

The "mechanism" is HOW Linux registers auto-start (Windows ignores it):
  - "xdg":     a freedesktop .desktop autostart entry. Default.
  - "systemd": a systemd --user unit.

The chosen target/mechanism persist in the unified user_data.json map. The
former <app_data>/autostart/target.json is read once as a migration source.
"""

import json
from pathlib import Path

from pycore.pyfoundations.system_paths import get_app_data_dir
from pycore.pyutils.common.user_data_store import user_data_store
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

VALID_TARGETS = ("pyservice", "launcher", "both")
VALID_MECHANISMS = ("xdg", "systemd")
_SECTION = "autostart"


def autostart_dir() -> Path:
    """Directory holding the fixed launcher script and legacy preference."""
    return get_app_data_dir() / "autostart"


def _preference_path() -> Path:
    return autostart_dir() / "target.json"


def normalize_target(target) -> str:
    if isinstance(target, str):
        t = target.strip().lower()
        if t in VALID_TARGETS:
            return t
    return VALID_TARGETS[0]


def normalize_mechanism(mechanism) -> str:
    if isinstance(mechanism, str):
        m = mechanism.strip().lower()
        if m in VALID_MECHANISMS:
            return m
    return VALID_MECHANISMS[0]


def read_preference() -> dict:
    """Return the effective preference from the unified settings map."""
    personalized = user_data_store.get_personalized_section(_SECTION)
    if not personalized:
        legacy_path = _preference_path()
        legacy = {}
        if legacy_path.is_file():
            try:
                legacy = json.loads(legacy_path.read_text(encoding="utf-8"))
            except (OSError, ValueError) as exc:
                ColorPrint.yellow(f"[Autostart] read legacy preference {legacy_path} failed: {exc}")
        if isinstance(legacy, dict) and legacy:
            personalized = {
                "target": normalize_target(legacy.get("target")),
                "mechanism": normalize_mechanism(legacy.get("mechanism")),
            }
            user_data_store.set_section(_SECTION, personalized)
    data = user_data_store.get_section(_SECTION)
    enabled = data.get("enabled")
    return {
        "target": normalize_target(data.get("target")),
        "mechanism": normalize_mechanism(data.get("mechanism")),
        "mechanism_chosen": data.get("mechanism") in VALID_MECHANISMS,
        "enabled": enabled if isinstance(enabled, bool) else None,
    }


def write_preference(target=None, mechanism=None, enabled=None) -> dict:
    """Persist provided values to the unified in-memory and JSON store.

    ``enabled`` records an explicit user choice; None (never chosen) lets the
    service register auto-start by default on its first start.
    """
    pref = read_preference()
    pref.pop("mechanism_chosen", None)
    if target is not None:
        pref["target"] = normalize_target(target)
    if mechanism is not None:
        pref["mechanism"] = normalize_mechanism(mechanism)
    if enabled is not None:
        pref["enabled"] = bool(enabled)
    if pref.get("enabled") is None:
        pref.pop("enabled", None)
    user_data_store.set_section(_SECTION, pref)
    return pref
