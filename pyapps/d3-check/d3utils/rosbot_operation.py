# -*- coding: utf-8 -*-
"""
ROSBOT operation: activate window, run after-start automation (wait window, click main profile tab, click Start botting!).
Reuses ROSBOTManager for process/window; delegates UI automation to rosbot_ui_automation.
Mirrors battlenet_operation pattern (get_rosbot_operation, class RosbotOperation).
UI state: read docs/rosbot_ui_elements_1.json for KEY dialog signature; get_ui_state() reports need_key_input when that UI is present.
"""
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from pycore.pyfoundations.color_print import ColorPrint
from d3utils.rosbot_manager import get_rosbot_manager
from d3utils.rosbot_ui_automation import run_after_rosbot_start as _run_after_rosbot_start, resume_rosbot_ui as _resume_rosbot_ui

from pycore.pyfoundations.third_party import get_third_package_win32gui, get_third_package_win32con

# docs/rosbot_ui_elements_1.json: KEY dialog has window title "Error" and text "Please, enter a key"
_ROSBOT_KEY_DIALOG_JSON_PATH = Path(__file__).resolve().parent.parent / "docs" / "rosbot_ui_elements_1.json"
_ROSBOT_KEY_DIALOG_TITLE_CACHE: Optional[str] = None
ROSBOT_NEED_KEY_MESSAGE = "需要输入KEY"


def _load_rosbot_key_dialog_signature() -> Tuple[str, str]:
    """Read docs/rosbot_ui_elements_1.json; return (window_title, prompt_substring). Fallback to ('Error', 'enter a key')."""
    global _ROSBOT_KEY_DIALOG_TITLE_CACHE
    if _ROSBOT_KEY_DIALOG_TITLE_CACHE is not None:
        return (_ROSBOT_KEY_DIALOG_TITLE_CACHE, "enter a key")
    title, prompt = "Error", "enter a key"
    if _ROSBOT_KEY_DIALOG_JSON_PATH.exists():
        try:
            with open(_ROSBOT_KEY_DIALOG_JSON_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                wi = data.get("window_info") or {}
                title = (wi.get("title") or title).strip() or title
                for c in data.get("controls") or []:
                    name = (c.get("name") or "").strip()
                    if name and "key" in name.lower():
                        prompt = name[:64]
                        break
        except Exception as e:
            ColorPrint.gray(f"[RosbotOperation] load key dialog signature: {e}")
    _ROSBOT_KEY_DIALOG_TITLE_CACHE = title
    return (title, prompt)


class RosbotOperation:
    """
    ROSBOT operation: get window, activate window, run after-start automation.
    Process/window via ROSBOTManager; UI automation via rosbot_ui_automation.
    """

    def get_window(self) -> Optional[Dict[str, Any]]:
        """Return current ROSBOT window info (hwnd, title, pid, etc.) or None. Single path: ROSBOTManager.get_rosbot_window() (same-dir exe flow)."""
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
        click_params: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        After ROSBOT process started: wait window, activate, then run built-in sequence (main profile tab + Start botting!).
        Uses hardcoded rosbot_ui_structure only. Delegates to rosbot_ui_automation.run_after_rosbot_start.
        """
        return _run_after_rosbot_start(
            wait_sec=wait_sec,
            do_debug=do_debug,
            do_tab=do_tab,
            do_start_botting=do_start_botting,
            click_params=click_params,
        )

    def resume_rosbot(
        self,
        do_tab: bool = True,
        do_start_botting: bool = True,
        click_params: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Resume ROSBOT when paused: activate window, run built-in sequence (main profile + Start botting!).
        Uses hardcoded rosbot_ui_structure only. Delegates to rosbot_ui_automation.resume_rosbot_ui.
        """
        return _resume_rosbot_ui(
            do_tab=do_tab,
            do_start_botting=do_start_botting,
            click_params=click_params,
        )

    def get_ui_state(self, pids: Optional[List[int]] = None) -> Dict[str, Any]:
        """
        Return current ROSBOT UI state. Reads KEY dialog signature from docs/rosbot_ui_elements_1.json;
        when any ROSBOT process window has that title (e.g. "Error" with "Please, enter a key"), need_key_input is True.
        When pids is provided (e.g. from same-tick get_rosbot_detection), only scans those PIDs to avoid re-enumeration.
        Returns: {"need_key_input": bool, "message": str}. message is ROSBOT_NEED_KEY_MESSAGE when need_key_input.
        """
        out: Dict[str, Any] = {"need_key_input": False, "message": ""}
        key_title, _ = _load_rosbot_key_dialog_signature()
        mgr = get_rosbot_manager()
        if pids:
            seen_pids: Set[int] = set(pids)
        else:
            seen_pids = set()
            for exe_path in mgr.find_other_exe_files():
                proc = mgr.find_process_by_exe_name(os.path.basename(exe_path))
                if proc and proc.get("pid") and proc["pid"] not in seen_pids:
                    seen_pids.add(proc["pid"])
            proc = mgr.find_process_by_exe_name(mgr.rosbot_exe_name)
            if proc and proc.get("pid"):
                seen_pids.add(proc["pid"])
        for pid in seen_pids:
            for w in mgr.find_windows_by_pid(pid, visible_only=False):
                if (w.get("title") or "").strip() == key_title:
                    out["need_key_input"] = True
                    out["message"] = ROSBOT_NEED_KEY_MESSAGE
                    return out
        return out


_rosbot_operation: Optional[RosbotOperation] = None


def get_rosbot_operation() -> RosbotOperation:
    """Return global RosbotOperation instance (singleton)."""
    global _rosbot_operation
    if _rosbot_operation is None:
        _rosbot_operation = RosbotOperation()
    return _rosbot_operation
