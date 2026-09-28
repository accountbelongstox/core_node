# -*- coding: utf-8 -*-
"""
Terminal grid profiles for the window launcher: the menu toggle presets and the
resolution-based auto grid. Screens are classified by height, so 3440x1440
ultrawide and 5120x1440 dual-monitor virtual desktops count as 2K.
"""

from dataclasses import dataclass
from typing import Dict, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.launcher.launcher_text import launcher_text
from pycore.pyutils.launcher.screen_manager import ScreenManager

TOGGLE_DISABLE = 'DISABLE'
DEFAULT_TOGGLE = 'X6'
DEFAULT_GRID_COLUMNS = 3
DEFAULT_GRID_ROWS = 2
DEFAULT_AUTO_GRID = True
TERMINAL_TOGGLE_GRIDS: Dict[str, Tuple[int, int]] = {
    'X4': (2, 2),
    'X6': (3, 2),
    'X8': (4, 2),
    'X12': (4, 3),
    'X15': (5, 3),
    'X18': (6, 3),
}
TERMINAL_TOGGLE_SEQUENCE: Tuple[str, ...] = tuple(TERMINAL_TOGGLE_GRIDS) + (TOGGLE_DISABLE,)
TERMINAL_TOGGLE_CHOICES = '/'.join(TERMINAL_TOGGLE_SEQUENCE)
LEGACY_TOGGLE_ALIASES: Dict[str, str] = {'X16': 'X12'}
SCREEN_RECT_HEIGHT_INDEX = 3
RESOLUTION_HEIGHT_INDEX = 1
AUTO_PROFILE_SEPARATOR = ' / '


class GridI18nKeys:
    AUTO_PROFILE = 'launcher.grid.auto_profile'
    BELOW_THRESHOLD = 'launcher.grid.below_threshold'
    AUTO_OFF = 'launcher.grid.auto_off'
    DISABLED = 'launcher.grid.disabled'
    STATE_ON = 'launcher.grid.state_on'
    STATE_OFF = 'launcher.grid.state_off'
    MENU_AUTO_GRID = 'launcher.grid.menu_auto_grid'
    MENU_TOGGLE_ENTRY = 'launcher.grid.menu_toggle_entry'
    MENU_CURRENT_TOGGLE = 'launcher.grid.menu_current_toggle'
    MENU_CURRENT_AUTO_GRID = 'launcher.grid.menu_current_auto_grid'
    MENU_TOGGLE_ITEM = 'launcher.grid.menu_toggle_item'
    MENU_TOGGLE_DISABLE_ITEM = 'launcher.grid.menu_toggle_disable_item'
    RELAYOUT_DONE = 'launcher.grid.relayout_done'
    RELAYOUT_HINT = 'launcher.grid.relayout_hint'


@dataclass(frozen=True)
class AutoGridProfile:
    name: str
    min_height: int
    columns: int
    rows: int


AUTO_GRID_PROFILES: Tuple[AutoGridProfile, ...] = (
    AutoGridProfile('4K', 2160, 6, 3),
    AutoGridProfile('2K', 1440, 5, 3),
)
AUTO_GRID_MIN_HEIGHT = min(profile.min_height for profile in AUTO_GRID_PROFILES)


@dataclass(frozen=True)
class TerminalGrid:
    columns: int
    rows: int
    profile: str = ''
    screen_rect: Optional[Tuple[int, int, int, int]] = None

    @property
    def enabled(self) -> bool:
        return self.columns > 0 and self.rows > 0


def normalize_toggle(toggle: str) -> str:
    return LEGACY_TOGGLE_ALIASES.get(toggle, toggle)


def next_terminal_toggle(toggle: str) -> str:
    current = normalize_toggle(toggle)
    if current not in TERMINAL_TOGGLE_SEQUENCE:
        return DEFAULT_TOGGLE
    next_index = (TERMINAL_TOGGLE_SEQUENCE.index(current) + 1) % len(TERMINAL_TOGGLE_SEQUENCE)
    return TERMINAL_TOGGLE_SEQUENCE[next_index]


def is_terminal_enabled(term_config: dict) -> bool:
    toggle = normalize_toggle(term_config.get('toggle', DEFAULT_TOGGLE))
    return bool(term_config.get('enabled', True)) and toggle != TOGGLE_DISABLE


def match_auto_profile(height: int) -> Optional[AutoGridProfile]:
    candidates = [profile for profile in AUTO_GRID_PROFILES if height >= profile.min_height]
    return max(candidates, key=lambda profile: profile.min_height, default=None)


def describe_auto_profiles() -> str:
    ordered = sorted(AUTO_GRID_PROFILES, key=lambda profile: profile.min_height)
    return AUTO_PROFILE_SEPARATOR.join(
        f"{profile.name} {profile.columns}x{profile.rows}" for profile in ordered)


def classification_height(screen_manager, screen_rect: Tuple[int, int, int, int]) -> int:
    # Windows reports DPI-scaled logical sizes to unaware processes; the physical
    # primary mode keeps a scaled 4K panel in the 4K class.
    height = screen_rect[SCREEN_RECT_HEIGHT_INDEX]
    if isinstance(screen_manager, ScreenManager):
        physical = screen_manager.get_physical_primary_resolution()
        if physical is not None:
            height = max(height, physical[RESOLUTION_HEIGHT_INDEX])
    return height


def resolve_terminal_grid(term_config: dict, screen_manager) -> TerminalGrid:
    if not is_terminal_enabled(term_config):
        ColorPrint.plain(launcher_text.get(GridI18nKeys.DISABLED))
        return TerminalGrid(0, 0)

    columns = term_config.get('columns', DEFAULT_GRID_COLUMNS)
    rows = term_config.get('rows', DEFAULT_GRID_ROWS)
    screen_rect = tuple(screen_manager.get_screen_dimensions())

    if not term_config.get('auto_grid', DEFAULT_AUTO_GRID):
        ColorPrint.plain(launcher_text.get(GridI18nKeys.AUTO_OFF, columns=columns, rows=rows))
        return TerminalGrid(columns, rows, '', screen_rect)

    height = classification_height(screen_manager, screen_rect)
    profile = match_auto_profile(height)
    if profile is None:
        ColorPrint.plain(launcher_text.get(
            GridI18nKeys.BELOW_THRESHOLD, columns=columns, rows=rows,
            height=height, threshold=AUTO_GRID_MIN_HEIGHT))
        return TerminalGrid(columns, rows, '', screen_rect)

    ColorPrint.plain(launcher_text.get(
        GridI18nKeys.AUTO_PROFILE, columns=profile.columns, rows=profile.rows,
        profile=profile.name, height=height))
    return TerminalGrid(profile.columns, profile.rows, profile.name, screen_rect)
