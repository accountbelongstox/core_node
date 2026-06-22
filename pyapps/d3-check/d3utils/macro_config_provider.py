# -*- coding: utf-8 -*-
"""
Macro config provider: active config bindings for D3 macro.
Delegates to macro_config_loader (load at app start, refresh on config change).
Per-config hotkeys (config1..config4) are defined by share.values.skill_config_hotkeys and
managed by the loader; global listener hotkeys (e.g. assistant_hotkey) by hotkey_registry.
"""

from typing import Any, Dict

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from providor.providor_index import get_config_section
from d3utils.macro_config_loader import get_macro_config_loader


def get_current_config_name() -> str:
    """Return the active config name (macro_configs.current_skill_config)."""
    return get_macro_config_loader().get_current_config_name()


def get_current_skill_config() -> Dict[str, Any]:
    """
    Return the full skill config for the active config (skills + per-config hotkeys).
    From loader cache (refreshed at startup and on config change).
    """
    return get_macro_config_loader().get_current_skill_config()


def get_skill_config_by_name(config_name: str) -> Dict[str, Any]:
    """Return skill config dict for the given config name (read from CONFIG)."""
    macro_configs = get_config_section("macro_configs")
    configs = macro_configs.get("skill_configs", {})
    if not isinstance(configs, dict):
        configs = {}
    out = dict(configs.get(config_name, {}))
    if "skills" not in out:
        out["skills"] = {}
    return out
