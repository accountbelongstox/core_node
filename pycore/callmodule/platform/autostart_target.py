# -*- coding: utf-8 -*-
"""Shared auto-start target/mechanism preferences (cross-platform).

The "target" is WHAT auto-start launches at boot/login:
  - "pyservice": the full pycore RPC stack (pyservice.sh/ps1 -> UI dev server +
    worker). Default.
  - "launcher":  the multi-terminal grid launcher (python -m pycore.pyutils.launcher).
  - "both":      pyservice in the background, then the launcher in the foreground.

The "mechanism" is HOW Linux registers auto-start (Windows ignores it):
  - "xdg":     a freedesktop .desktop autostart entry. Default.
  - "systemd": a systemd --user unit.

The chosen target/mechanism persist in <app_data>/autostart/target.json so a status
query with no request args, and the on-every-start refresh(), recover the last choice.
"""

import json
from pathlib import Path

from pycore.pyfoundations.system_paths import get_app_data_dir

VALID_TARGETS = ("pyservice", "launcher", "both")
VALID_MECHANISMS = ("xdg", "systemd")
DEFAULT_TARGET = "pyservice"
DEFAULT_MECHANISM = "xdg"


def autostart_dir() -> Path:
    """Directory holding the fixed launcher script + the target.json preference."""
    return get_app_data_dir() / "autostart"


def _preference_path() -> Path:
    return autostart_dir() / "target.json"


def normalize_target(target) -> str:
    if isinstance(target, str):
        t = target.strip().lower()
        if t in VALID_TARGETS:
            return t
    return DEFAULT_TARGET


def normalize_mechanism(mechanism) -> str:
    if isinstance(mechanism, str):
        m = mechanism.strip().lower()
        if m in VALID_MECHANISMS:
            return m
    return DEFAULT_MECHANISM


def read_preference() -> dict:
    """Return {'target','mechanism'} from target.json, falling back to defaults."""
    data = {}
    try:
        data = json.loads(_preference_path().read_text(encoding="utf-8"))
    except Exception:
        data = {}
    if not isinstance(data, dict):
        data = {}
    return {
        "target": normalize_target(data.get("target")),
        "mechanism": normalize_mechanism(data.get("mechanism")),
    }


def write_preference(target=None, mechanism=None) -> dict:
    """Persist target/mechanism (only the provided ones change). Never raises."""
    pref = read_preference()
    if target is not None:
        pref["target"] = normalize_target(target)
    if mechanism is not None:
        pref["mechanism"] = normalize_mechanism(mechanism)
    try:
        d = autostart_dir()
        d.mkdir(parents=True, exist_ok=True)
        _preference_path().write_text(json.dumps(pref, indent=2), encoding="utf-8")
    except Exception:
        pass
    return pref
