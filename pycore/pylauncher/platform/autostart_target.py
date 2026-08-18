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
        try:
            legacy = json.loads(_preference_path().read_text(encoding="utf-8"))
        except Exception:
            legacy = {}
        if isinstance(legacy, dict) and legacy:
            personalized = {
                "target": normalize_target(legacy.get("target")),
                "mechanism": normalize_mechanism(legacy.get("mechanism")),
            }
            user_data_store.set_section(_SECTION, personalized)
    data = user_data_store.get_section(_SECTION)
    return {
        "target": normalize_target(data.get("target")),
        "mechanism": normalize_mechanism(data.get("mechanism")),
    }


def write_preference(target=None, mechanism=None) -> dict:
    """Persist provided values to the unified in-memory and JSON store."""
    pref = read_preference()
    if target is not None:
        pref["target"] = normalize_target(target)
    if mechanism is not None:
        pref["mechanism"] = normalize_mechanism(mechanism)
    user_data_store.set_section(_SECTION, pref)
    return pref
