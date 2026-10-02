# -*- coding: utf-8 -*-
"""Interactive launcher configuration menu (arrow keys navigate, left/right toggle)."""

from dataclasses import dataclass
from typing import Callable, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.launcher.app_catalog import available_app_names
from pycore.pyutils.launcher.config_manager import ConfigManager
from pycore.pyutils.launcher.grid_profile import GridI18nKeys, describe_auto_profiles
from pycore.pyutils.launcher.launcher_text import launcher_text
from pycore.pyutils.launcher.menu_input import (
    KEY_DOWN,
    KEY_ENTER,
    KEY_ESC,
    KEY_LEFT,
    KEY_RIGHT,
    KEY_UP,
    clear_screen,
    read_key,
)
from pycore.pyutils.launcher.menu_toggles import LauncherConfigToggles


class MenuI18nKeys:
    TITLE = 'launcher.menu.title'
    TERMINAL_ITEM = 'launcher.menu.terminal_item'
    APP_ITEM = 'launcher.menu.app_item'
    EXIT_ITEM = 'launcher.menu.exit_item'
    TOGGLE_HINT = 'launcher.menu.toggle_hint'
    NAVIGATION = 'launcher.menu.navigation'


MENU_RULE = "=" * 60


@dataclass(frozen=True)
class MenuEntry:
    label: Callable[[], str]
    toggle: Callable[[], None]


class InteractiveMenu:
    """Launcher configuration menu: terminal preset, auto grid and one switch per app."""

    def __init__(self, config_manager: ConfigManager):
        self._toggles = LauncherConfigToggles(config_manager)
        self._entries = self._build_entries()

    def _state_text(self, enabled: bool) -> str:
        return launcher_text.get(GridI18nKeys.STATE_ON if enabled else GridI18nKeys.STATE_OFF)

    def _build_entries(self) -> List[MenuEntry]:
        entries = [
            MenuEntry(
                label=lambda: launcher_text.get(MenuI18nKeys.TERMINAL_ITEM, state=self._toggles.terminal_state()),
                toggle=self._toggles.toggle_terminal),
            MenuEntry(
                label=lambda: launcher_text.get(GridI18nKeys.MENU_AUTO_GRID,
                                                profiles=describe_auto_profiles(),
                                                state=self._state_text(self._toggles.auto_grid_enabled())),
                toggle=self._toggles.toggle_auto_grid),
        ]
        for app_name in available_app_names():
            entries.append(MenuEntry(
                label=lambda name=app_name: launcher_text.get(
                    MenuI18nKeys.APP_ITEM, app=name.upper(), state=self._state_text(self._toggles.app_enabled(name))),
                toggle=lambda name=app_name: self._toggles.toggle_app(name)))
        return entries

    def _render(self, selected_index: int) -> None:
        clear_screen()
        ColorPrint.plain("\n" + MENU_RULE)
        ColorPrint.plain(launcher_text.get(MenuI18nKeys.TITLE))
        ColorPrint.plain(MENU_RULE)
        toggle_hint = launcher_text.get(MenuI18nKeys.TOGGLE_HINT)
        for index, entry in enumerate(self._entries):
            if index == selected_index:
                ColorPrint.plain(f"> {entry.label()} <{toggle_hint}")
            else:
                ColorPrint.plain(f"  {entry.label()}")
        exit_label = launcher_text.get(MenuI18nKeys.EXIT_ITEM)
        ColorPrint.plain(f"> {exit_label} <" if selected_index == len(self._entries) else f"  {exit_label}")
        ColorPrint.plain(MENU_RULE)
        ColorPrint.plain(launcher_text.get(MenuI18nKeys.NAVIGATION))

    def run(self) -> None:
        """Loop until Esc or Enter on the exit row; every toggle is saved immediately."""
        exit_index = len(self._entries)
        selected_index = 0
        while True:
            self._render(selected_index)
            key = read_key()
            if key == KEY_UP:
                selected_index = max(0, selected_index - 1)
            elif key == KEY_DOWN:
                selected_index = min(exit_index, selected_index + 1)
            elif key == KEY_ESC or (key == KEY_ENTER and selected_index == exit_index):
                return
            elif key in (KEY_LEFT, KEY_RIGHT, KEY_ENTER) and selected_index < exit_index:
                self._entries[selected_index].toggle()
