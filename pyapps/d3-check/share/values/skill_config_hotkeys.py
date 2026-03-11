# -*- coding: utf-8 -*-
"""
Per-config hotkey keys and defaults (macro_configs.skill_configs.<name>).
Single source of truth: extend by appending one tuple; UI and loader use by iteration.
Config hotkey binding class library: no need to change hotkey_registry when adding keys.
"""

# (config_key, default_value). Order = display order in UI. All values are hotkey strings.
# Potion is a single row in the skill table only, not here; potion hotkey is not shown in UI hotkey area.
PER_CONFIG_HOTKEY_SPEC = (
    ("quick_switch", "F1"),
)


def get_per_config_hotkey_keys():
    """Return tuple of config keys for per-config hotkeys (for membership checks)."""
    return tuple(s[0] for s in PER_CONFIG_HOTKEY_SPEC)


def get_per_config_hotkey_default(config_key: str) -> str:
    """Return default hotkey for config_key."""
    for k, default in PER_CONFIG_HOTKEY_SPEC:
        if k == config_key:
            return default
    return ""
