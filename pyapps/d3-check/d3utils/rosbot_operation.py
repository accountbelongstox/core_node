# -*- coding: utf-8 -*-
"""
ROSBOT operation: activate window, run after-start automation (wait window, click main profile tab, click Start botting!).
Reuses ROSBOTManager for process/window; delegates UI automation to rosbot_ui_automation.
Mirrors battlenet_operation pattern (get_rosbot_operation, class RosbotOperation).
"""
from typing import Optional, Dict, Any

from pycore.pyfoundations.color_print import ColorPrint
from d3utils.rosbot_manager import get_rosbot_manager
from d3utils.rosbot_ui_automation import run_after_rosbot_start as _run_after_rosbot_start, resume_rosbot_ui as _resume_rosbot_ui

from pycore.pyfoundations.third_party import get_third_package_win32gui, get_third_package_win32con


class RosbotOperation:
    """
    ROSBOT operation: get window, activate window, run after-start automation.
    Process/window via ROSBOTManager; UI automation via rosbot_ui_automation.
    """

    def get_window(self) -> Optional[Dict[str, Any]]:
        """Return current ROSBOT window info (hwnd, title, pid, etc.) or None. Delegates to ROSBOTManager.get_rosbot_window()."""
        return get_rosbot_manager().get_rosbot_window()

    def activate_window(self) -> bool:
        """Bring ROSBOT window to foreground. Returns True if window found and activated."""
        winfo = self.get_window()
        if not winfo or not winfo.get("hwnd"):
            ColorPrint.yellow("[RosbotOperation] No ROSBOT window to activate")
            return False
        win32gui = get_third_package_win32gui()
        win32con = get_third_package_win32con()
        if not win32gui or not win32con:
            ColorPrint.yellow("[RosbotOperation] win32 not available")
            return False
        try:
            hwnd = int(winfo["hwnd"])
            win32gui.SetForegroundWindow(hwnd)
            win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
            ColorPrint.blue("[RosbotOperation] ROSBOT window activated")
            return True
        except Exception as e:
            ColorPrint.red(f"[RosbotOperation] Activate error: {e}")
            return False

    def run_after_rosbot_start(
        self,
        wait_sec: int = 30,
        do_debug: bool = True,
        do_tab: bool = True,
        do_start_botting: bool = True,
    ) -> bool:
        """
        After ROSBOT process started: wait window, activate, debug print elements, click main profile tab, click Start botting!.
        Delegates to rosbot_ui_automation.run_after_rosbot_start.
        """
        return _run_after_rosbot_start(
            wait_sec=wait_sec,
            do_debug=do_debug,
            do_tab=do_tab,
            do_start_botting=do_start_botting,
        )

    def resume_rosbot(self, do_tab: bool = True, do_start_botting: bool = True) -> bool:
        """
        Resume ROSBOT when paused: activate window, switch to main profile, click Start botting!.
        Delegates to rosbot_ui_automation.resume_rosbot_ui.
        """
        return _resume_rosbot_ui(do_tab=do_tab, do_start_botting=do_start_botting)


_rosbot_operation: Optional[RosbotOperation] = None


def get_rosbot_operation() -> RosbotOperation:
    """Return global RosbotOperation instance (singleton)."""
    global _rosbot_operation
    if _rosbot_operation is None:
        _rosbot_operation = RosbotOperation()
    return _rosbot_operation
