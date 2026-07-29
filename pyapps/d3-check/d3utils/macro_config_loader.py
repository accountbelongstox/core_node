# -*- coding: utf-8 -*-
"""
Macro config loader (config hotkey loader).
Manages active config bindings: load at app start, refresh when CONFIG or current_skill_config
changes. config1..config4 each have their own hotkeys; the loader exposes the active config's
bindings for the macro to send to D3. Single source for get_current_skill_config() used by
macro thread and config ops.
"""

from typing import Any, Dict, Optional

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from providor.providor_index import get_config_section


class MacroConfigLoader:
    """
    Loader for active config hotkeys. Load at startup; update on config change.
    Call load_active() from main thread when CONFIG is ready and on each config_change_hub
    notification for macro_configs.
    """

    def __init__(self) -> None:
        self._current_config_name: str = "config1"
        self._current_bindings: Dict[str, Any] = {"skills": {}}

    def load_active(self) -> None:
        """Read active config from CONFIG and refresh cached bindings. Call from main thread."""
        macro_configs = get_config_section("macro_configs")
        name = macro_configs.get("current_skill_config", "config1")
        configs = macro_configs.get("skill_configs", {})
        if not isinstance(configs, dict):
            configs = {}
        raw = configs.get(name, {})
        self._current_config_name = name
        self._current_bindings = dict(raw)
        if "skills" not in self._current_bindings:
            self._current_bindings["skills"] = {}
        ColorPrint.blue(f"[MacroConfigLoader] Active config: {name}")

    def get_current_config_name(self) -> str:
        """Return the active config name (e.g. config1..config4)."""
        return self._current_config_name

    def get_current_skill_config(self) -> Dict[str, Any]:
        """
        Return the full skill config for the active config (skills + per-config hotkeys from
        share.values.skill_config_hotkeys). Used by macro to send keys to D3 per config.
        """
        return self._current_bindings.copy()


_loader: Optional[MacroConfigLoader] = None


def get_macro_config_loader() -> MacroConfigLoader:
    """Return the global macro config loader (singleton)."""
    global _loader
    if _loader is None:
        _loader = MacroConfigLoader()
    return _loader
