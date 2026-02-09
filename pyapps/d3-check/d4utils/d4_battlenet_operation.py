# -*- coding: utf-8 -*-
"""
D4 Battle.net operation: click D4 tab, click Play, activate window.
Reuses share.battlenet_window_finder and share.battlenet_ui_common. No D3/ROSBOT imports.
Asia vs CN: tab/play automation_id and name keywords differ; region from game_interface_data or config.
"""
import time
from pathlib import Path
from typing import Optional, List, Dict, Any

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.click_handler import ClickHandler
from pycore.pyutils.window_activator import WindowActivator
from share.game_interface_data import get_game_interface_data
from share.battlenet_window_finder import find_battlenet_windows, get_battlenet_path
from share.battlenet_ui_common import (
    ensure_com,
    get_root_control,
    enumerate_controls,
    find_control_by_automation_id,
    find_control_by_name,
    click_control,
    rect_center,
)
from providor.providor_index import get_config_value_safe
from providor.constants.common import BN_CLICK_MOVE_DURATION_SEC, BN_CLICK_PAUSE_AFTER_MOVE_SEC
from providor.constants.d4 import (
    D4_TAB_AUTOMATION_IDS,
    D4_TAB_NAME_KEYWORDS,
    D4_START_GAME_AUTOMATION_IDS,
    D4_START_GAME_NAME_KEYWORDS,
    D4_TAB_AUTOMATION_IDS_ASIA,
    D4_TAB_NAME_KEYWORDS_ASIA,
    D4_START_GAME_AUTOMATION_IDS_ASIA,
    D4_START_GAME_NAME_KEYWORDS_ASIA,
)


def _resolve_d4_battlenet_region() -> Optional[str]:
    """Resolve Battle.net region: game_interface_data first, then config cache."""
    try:
        r = get_game_interface_data().get_battlenet_region()
        if r is not None:
            return r
        cached = get_config_value_safe("ros_settings.battlenet_region_cache")
        return cached if cached in ("asia", "cn") else None
    except Exception:
        return None


def _play_button_indicates_starting(ctrl: Dict[str, Any]) -> bool:
    """True if Play control indicates game starting or running."""
    name = (ctrl.get("name") or "").strip()
    if "Playing Now" in name or "\u6b63\u5728" in name:
        return True
    is_enabled = ctrl.get("is_enabled")
    if is_enabled is not None:
        return not bool(is_enabled)
    return False


class D4BattlenetOperation:
    """
    D4 Battle.net operation: activate window, click D4 tab, click Play.
    Uses share layer only; region asia/cn from game_interface_data or config.
    """

    def __init__(self, region: Optional[str] = None):
        self._clicker = ClickHandler()
        self._region = region if region in ("asia", "cn") else _resolve_d4_battlenet_region() if region is None else None

    def activate_window(self) -> bool:
        """Bring first Battle.net window to foreground."""
        windows = find_battlenet_windows()
        if not windows:
            return False
        hwnd = windows[0]["hwnd"]
        ColorPrint.blue("[D4BattlenetOperation] Activating Battle.net window...")
        WindowActivator().activate_window_by_handle(hwnd)
        return True

    def _get_hwnd(self) -> Optional[int]:
        """First Battle.net window hwnd or None."""
        windows = find_battlenet_windows()
        return int(windows[0]["hwnd"]) if windows else None

    def _enumerate_controls(self) -> List[Dict[str, Any]]:
        """Enumerate Battle.net window controls. Returns [] if no window."""
        hwnd = self._get_hwnd()
        if hwnd is None:
            return []
        ensure_com()
        return enumerate_controls(hwnd)

    def _get_root(self):
        """Root UI Automation control for Battle.net window or None."""
        hwnd = self._get_hwnd()
        if hwnd is None:
            return None
        return get_root_control(hwnd)

    def _click_control(self, control: Dict[str, Any], require_clickable: bool = False) -> bool:
        """Click control via share UI common (Invoke then rect)."""
        self.activate_window()
        time.sleep(0.2)
        root = self._get_root()
        if not root:
            return False
        return click_control(
            root,
            control,
            self._clicker,
            require_clickable=require_clickable,
            prefer_invoke=True,
            duration=BN_CLICK_MOVE_DURATION_SEC,
            pause_after_move=BN_CLICK_PAUSE_AFTER_MOVE_SEC,
        )

    def click_d4_tab(self) -> bool:
        """Click D4 game tab. Asia vs CN use different automation_id/name sets; exact_match to avoid D3 tab."""
        controls = self._enumerate_controls()
        if self._region != "cn":
            if controls:
                for aid in D4_TAB_AUTOMATION_IDS_ASIA:
                    ctrl = find_control_by_automation_id(controls, aid, exact_match=True)
                    if ctrl:
                        if "Playing Now" in (ctrl.get("name") or "") or "Game Version" in (ctrl.get("name") or ""):
                            continue
                        ColorPrint.blue("[D4BattlenetOperation] Asia Click D4 tab: automation_id=%s" % aid)
                        return self._click_control(ctrl)
                ctrl = find_control_by_name(controls, D4_TAB_NAME_KEYWORDS_ASIA)
                if ctrl and "Playing Now" not in (ctrl.get("name") or "") and "Game Version" not in (ctrl.get("name") or ""):
                    ColorPrint.blue("[D4BattlenetOperation] Asia Click D4 tab: name=%s" % ctrl.get("name"))
                    return self._click_control(ctrl)
            if self._region == "asia":
                ColorPrint.yellow("[D4BattlenetOperation] D4 tab control not found (Asia)")
                return False
        for aid in D4_TAB_AUTOMATION_IDS:
            ctrl = find_control_by_automation_id(controls if controls else [], aid, exact_match=True)
            if ctrl:
                ColorPrint.blue("[D4BattlenetOperation] CN Click D4 tab: automation_id=%s" % aid)
                return self._click_control(ctrl)
        ctrl = find_control_by_name(controls, D4_TAB_NAME_KEYWORDS)
        if not ctrl:
            ColorPrint.yellow("[D4BattlenetOperation] D4 tab control not found")
            return False
        if "Playing Now" in (ctrl.get("name") or "") or "Game Version" in (ctrl.get("name") or ""):
            return False
        ColorPrint.blue("[D4BattlenetOperation] CN Click D4 tab: name=%s" % ctrl.get("name"))
        return self._click_control(ctrl)

    def click_play(self) -> bool:
        """Click Play button for D4. Region asia vs CN use different ids/names."""
        controls = self._enumerate_controls()
        if self._region != "cn":
            if controls:
                for aid in D4_START_GAME_AUTOMATION_IDS_ASIA:
                    ctrl = find_control_by_automation_id(controls, aid)
                    if ctrl:
                        ColorPrint.blue("[D4BattlenetOperation] Asia Click Play: automation_id=%s" % aid)
                        return self._click_control(ctrl)
                ctrl = find_control_by_name(controls, D4_START_GAME_NAME_KEYWORDS_ASIA)
                if ctrl:
                    ColorPrint.blue("[D4BattlenetOperation] Asia Click Play: name=%s" % ctrl.get("name"))
                    return self._click_control(ctrl)
            if self._region == "asia":
                ColorPrint.yellow("[D4BattlenetOperation] Play button not found (Asia)")
                return False
        for aid in D4_START_GAME_AUTOMATION_IDS:
            ctrl = find_control_by_automation_id(controls if controls else [], aid)
            if ctrl:
                ColorPrint.blue("[D4BattlenetOperation] CN Click Play: automation_id=%s" % aid)
                return self._click_control(ctrl)
        ctrl = find_control_by_name(controls, D4_START_GAME_NAME_KEYWORDS)
        if not ctrl:
            ColorPrint.yellow("[D4BattlenetOperation] Play button not found")
            return False
        ColorPrint.blue("[D4BattlenetOperation] CN Click Play: name=%s" % ctrl.get("name"))
        return self._click_control(ctrl)

    def is_game_starting(self) -> bool:
        """True if D4 is starting or already running (Play button disabled or Playing Now)."""
        controls = self._enumerate_controls()
        if self._region != "cn":
            for aid in D4_START_GAME_AUTOMATION_IDS_ASIA:
                ctrl = find_control_by_automation_id(controls, aid)
                if ctrl:
                    return _play_button_indicates_starting(ctrl)
            if self._region == "asia":
                return False
        for aid in D4_START_GAME_AUTOMATION_IDS:
            ctrl = find_control_by_automation_id(controls, aid)
            if ctrl:
                return _play_button_indicates_starting(ctrl)
        ctrl = find_control_by_name(controls, D4_START_GAME_NAME_KEYWORDS)
        if not ctrl:
            return False
        return _play_button_indicates_starting(ctrl)

    def start(self) -> bool:
        """Start Battle.net client. Uses share get_battlenet_path + subprocess."""
        path = get_battlenet_path()
        if not path:
            ColorPrint.red("[D4BattlenetOperation] Battle.net path not configured")
            return False
        import subprocess
        import os
        try:
            ColorPrint.blue("[D4BattlenetOperation] Starting Battle.net: %s" % path)
            subprocess.run(
                ["explorer", str(path)],
                cwd=str(path.parent),
                capture_output=True,
                text=True,
                timeout=30,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            ColorPrint.green("[D4BattlenetOperation] Battle.net start command sent")
            return True
        except Exception as e:
            ColorPrint.red("[D4BattlenetOperation] Start error: %s" % e)
            return False

    def close(self) -> bool:
        """Kill Battle.net process. Uses d3utils.process_helper (shared infra)."""
        from providor.constants.common import BATTLE_NET_EXE_NAME
        from d3utils.process_helper import kill_process_by_exe
        ColorPrint.blue("[D4BattlenetOperation] Killing Battle.net...")
        return kill_process_by_exe(BATTLE_NET_EXE_NAME, log_prefix="[D4BattlenetOperation]")


def get_d4_battlenet_operation(region: Optional[str] = None) -> D4BattlenetOperation:
    """Return D4 Battle.net operation; region resolved from game_interface_data/config when None."""
    return D4BattlenetOperation(region=region)
