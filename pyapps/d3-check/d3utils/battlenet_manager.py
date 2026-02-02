#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Battle.net manager: config path, kill/start process, find/activate window.
Reuses WindowFinder, WindowActivator, process_helper.
"""

import os
import subprocess
import time
from pathlib import Path
from typing import Optional, List, Dict, Any, Callable

from providor.app_constants import BATTLE_NET_EXE_NAME
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.window_activator import WindowActivator
from providor.providor_index import CONFIG, get_config_value_safe, BATTLE_NET_WINDOW_TITLES
from pycore.pyutils.common.window_finder import WindowFinder
from pycore.pyutils.common.browser_window_detector import get_default_skip_browser_callable

from d3utils.process_helper import kill_process_by_exe


def get_battlenet_window_titles() -> List[str]:
    """Return the canonical list of Battle.net window titles. Use this everywhere instead of importing BATTLE_NET_WINDOW_TITLES."""
    return list(BATTLE_NET_WINDOW_TITLES)


class BattleNetManager:
    """
    Battle.net process and window management.
    Uses CONFIG for path; WindowFinder for window list; WindowActivator for bring-to-front.
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
        path = (get_config_value_safe("battlenet.battlenet_path") or "").strip()
        if not path:
            return None
        p = Path(path)
        return p if p.is_file() else None

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
        """Start Battle.net via explorer. Returns True if command sent."""
        try:
            ColorPrint.blue(f"[BattleNetManager] Starting Battle.net: {exe_path}")
            subprocess.run(
                ["explorer", str(exe_path)],
                cwd=str(exe_path.parent),
                capture_output=True,
                text=True,
                timeout=30,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            ColorPrint.green("[BattleNetManager] Battle.net start command sent")
            return True
        except Exception as e:
            ColorPrint.red(f"[BattleNetManager] Start error: {e}")
            return False

    def find_windows(
        self,
        match_mode: str = "in",
        use_cache: bool = True,
    ) -> List[Dict[str, Any]]:
        """Find Battle.net windows. Returns list of window dicts (hwnd, title, etc.). match_mode='in' finds any title containing a list item."""
        return WindowFinder.find_windows_by_titles(
            titles=self._window_titles,
            match_mode=match_mode,
            use_cache=use_cache,
            skip_browser_if=self._skip_browser,
        )

    def find_battlenet_window(self, match_mode: str = "in", use_cache: bool = True) -> Optional[Dict[str, Any]]:
        """Find first Battle.net window. Returns window dict or None. Prefer this over manual find_windows when only one window is needed."""
        windows = self.find_windows(match_mode=match_mode, use_cache=use_cache)
        return windows[0] if windows else None

    def activate_window(self, match_mode: str = "in") -> bool:
        """Bring first found Battle.net window to front. Returns True if activated."""
        windows = self.find_windows(match_mode=match_mode)
        if not windows:
            return False
        hwnd = windows[0]["hwnd"]
        ColorPrint.blue("[BattleNetManager] Activating Battle.net window to front...")
        WindowActivator().activate_window_by_handle(hwnd)
        return True


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
