# -*- coding: utf-8 -*-
"""Launcher configuration toggles (terminal preset, auto grid, application switches)."""

from pycore.pyutils.launcher.config_manager import ConfigManager
from pycore.pyutils.launcher.grid_profile import (
    DEFAULT_AUTO_GRID,
    DEFAULT_TOGGLE,
    TERMINAL_TOGGLE_GRIDS,
    TOGGLE_DISABLE,
    next_terminal_toggle,
    normalize_toggle,
)

CHROME_APP = 'chrome'
CHROME_BETA_APP = 'chrome_beta'
CHROME_STABLE_VERSION = 'stable'


class LauncherConfigToggles:
    """Read and flip launcher switches; every change is saved immediately."""

    def __init__(self, config_manager: ConfigManager):
        self._config = config_manager

    def terminal_state(self) -> str:
        """Displayed terminal toggle: the normalized preset, or DISABLE."""
        term_config = self._config.get_terminal_config()
        if not term_config.get('enabled', True):
            return TOGGLE_DISABLE
        return normalize_toggle(term_config.get('toggle', DEFAULT_TOGGLE))

    def auto_grid_enabled(self) -> bool:
        return bool(self._config.get_terminal_config().get('auto_grid', DEFAULT_AUTO_GRID))

    def app_enabled(self, app_name: str) -> bool:
        app_config = self._config.get_app_config(app_name)
        enabled = bool(app_config.get('enabled', False))
        if app_name == CHROME_APP:
            return enabled and app_config.get('version', CHROME_STABLE_VERSION) == CHROME_STABLE_VERSION
        return enabled

    def toggle_terminal(self) -> None:
        """Advance the terminal toggle through TERMINAL_TOGGLE_SEQUENCE (wraps after DISABLE)."""
        toggle = next_terminal_toggle(self.terminal_state())
        self._config.set('terminal.toggle', toggle)
        self._config.set('terminal.enabled', toggle != TOGGLE_DISABLE)
        grid = TERMINAL_TOGGLE_GRIDS.get(toggle)
        if grid is not None:
            self._config.set('terminal.columns', grid[0])
            self._config.set('terminal.rows', grid[1])
        self._config.save_config()

    def toggle_auto_grid(self) -> None:
        self._config.set('terminal.auto_grid', not self.auto_grid_enabled())
        self._config.save_config()

    def toggle_app(self, app_name: str) -> None:
        """Flip one application; Chrome stable and Chrome beta stay mutually exclusive."""
        enabled = not self.app_enabled(app_name)
        if app_name == CHROME_APP:
            if enabled:
                self._config.set('applications.chrome.version', CHROME_STABLE_VERSION)
            self._config.set('applications.chrome_beta.enabled', False)
        elif app_name == CHROME_BETA_APP and enabled and self.app_enabled(CHROME_APP):
            self._config.set('applications.chrome.enabled', False)
        self._config.set(f'applications.{app_name}.enabled', enabled)
        self._config.save_config()
