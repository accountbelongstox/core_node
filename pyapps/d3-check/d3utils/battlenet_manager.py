#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Battle.net manager: config path, kill/start process, find/activate window.
Find window by process (Battle.net.exe) only; delegates to share.battlenet_window_finder.
"""

import os
import time
from pathlib import Path
from typing import Optional, List, Dict, Any, Callable

from providor.constants.common import BATTLE_NET_EXE_NAME
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.encyclopedia import ENCYCLOPEDIA
from pycore.pyutils.common.system_launcher import start_program
from pycore.pyutils.window.activator import WindowActivator
from providor.providor_index import CONFIG, BATTLE_NET_WINDOW_TITLES
from pycore.pyutils.common.browser_window_detector import get_default_skip_browser_callable

from share.battlenet_window_finder import find_battlenet_windows, get_battlenet_path
from d3utils.process_helper import kill_process_by_exe


class BattleNetManager:
    """
    Battle.net process and window management.
    Uses CONFIG for path; finds window by process (Battle.net.exe) only; WindowActivator for bring-to-front.
    """

    def __init__(
        self,
        config_source: dict,
        exe_name: str,
        window_titles: List[str],
        skip_browser_callable: Optional[Callable[[Dict[str, Any]], bool]] = None,
    ):
        self._config = config_source
        self._exe_name = exe_name
        self._window_titles = window_titles
        self._skip_browser = skip_browser_callable or get_default_skip_browser_callable()

    def get_path(self) -> Optional[Path]:
        """Return Battle.net exe path from config battlenet.battlenet_path (thread-safe), or None."""
        return get_battlenet_path()

    def kill(self) -> bool:
        """Kill Battle.net process via taskkill. Returns True if killed or not found."""
        ColorPrint.blue("[BattleNetManager] Killing Battle.net...")
        return kill_process_by_exe(self._exe_name, log_prefix="[BattleNetManager]")

    def restart(self, exe_path: Optional[Path] = None, wait_after_sec: float = 2.0) -> bool:
        """Kill Battle.net then start it. exe_path defaults to get_path(). Returns True if start command sent."""
        path = exe_path if exe_path is not None else self.get_path()
        if not path:
            return False
        self.kill()
        time.sleep(wait_after_sec)
        return self.start(path)

    def start(self, exe_path: Path) -> bool:
        """Start Battle.net via system_launcher.start_program. Returns True if command sent."""
        ColorPrint.blue(f"[BattleNetManager] Starting Battle.net: {exe_path}")
        if start_program(exe_path):
            ColorPrint.green("[BattleNetManager] Battle.net start command sent")
            return True
        ColorPrint.red("[BattleNetManager] Start failed")
        return False

    def find_windows(
        self,
        match_mode: str = "in",
        use_cache: bool = True,
    ) -> List[Dict[str, Any]]:
        """Find Battle.net windows by process only (Battle.net.exe). Delegates to share.battlenet_window_finder."""
        return find_battlenet_windows()

    def find_battlenet_window(self, match_mode: str = "in", use_cache: bool = True) -> Optional[Dict[str, Any]]:
        """Find first Battle.net window. Returns window dict or None. Prefer this over manual find_windows when only one window is needed."""
        windows = self.find_windows(match_mode=match_mode, use_cache=use_cache)
        return windows[0] if windows else None

    def activate_window(self, match_mode: str = "in") -> bool:
        """Bring first found Battle.net window to front. Returns True if window found (proceed even if SetForegroundWindow failed)."""
        windows = self.find_windows(match_mode=match_mode)
        if not windows:
            return False
        hwnd = windows[0]["hwnd"]
        ColorPrint.blue("[BattleNetManager] Activating Battle.net window to front...")
        WindowActivator().activate_window_by_handle(hwnd)
        return True

    def prime_window_cache_for_capture(self) -> bool:
        """Find window by exe and prime ENCYCLOPEDIA under window_cache_battle.net for provider/analyzer. Returns True if found."""
        windows = self.find_windows()
        if not windows:
            return False
        w = windows[0]
        rect = w.get("rect") or (0, 0, w.get("width", 0), w.get("height", 0))
        if isinstance(rect, (list, tuple)) and len(rect) >= 4:
            left, top, right, bottom = rect[0], rect[1], rect[2], rect[3]
        else:
            left, top = 0, 0
            right = left + (w.get("width") or 0)
            bottom = top + (w.get("height") or 0)
        ENCYCLOPEDIA.add("window_cache_battle.net", {
            "hwnd": w["hwnd"],
            "title": w.get("title") or "Battle.net",
            "rect": (left, top, right, bottom),
            "left": left, "top": top, "right": right, "bottom": bottom,
            "width": right - left, "height": bottom - top,
            "class_name": w.get("class_name") or "",
        })
        return True

    def get_capture_titles(self) -> List[str]:
        """Single source for titles passed to provider/analyzer after prime_window_cache_for_capture(). Same as BATTLE_NET_WINDOW_TITLES[0]."""
        return [BATTLE_NET_WINDOW_TITLES[0]] if BATTLE_NET_WINDOW_TITLES else ["Battle.net"]


_battlenet_manager: Optional[BattleNetManager] = None


def get_battlenet_manager(config_source=None, exe_name=None, window_titles=None) -> BattleNetManager:
    """Return global BattleNetManager instance (singleton). Injects providor constants if not provided."""
    global _battlenet_manager
    if _battlenet_manager is None:
        if config_source is None:
            config_source = CONFIG
            exe_name = exe_name or BATTLE_NET_EXE_NAME
            window_titles = window_titles or BATTLE_NET_WINDOW_TITLES
        _battlenet_manager = BattleNetManager(config_source, exe_name, window_titles)
    return _battlenet_manager
