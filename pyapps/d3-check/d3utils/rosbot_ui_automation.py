# -*- coding: utf-8 -*-
"""
ROSBOT UI automation: after ROSBOT starts, find window by title, DEBUG print operable elements,
then click main-profile tab and Start botting! button. Uses uiautomation (pycore third_party).
"""
import time
from pathlib import Path
from typing import List, Dict, Optional, Any

from pycore.pyfoundations.third_party import (
    get_third_package_uiautomation,
    get_third_package_win32gui,
    get_third_package_win32con,
)
from pycore.pyfoundations.color_print import ColorPrint
from providor.app_constants import (
    ROSBOT_UI_DEBUG_DIR,
    TAB_MAIN_PROFILE_NAMES,
    START_BUTTON_NAMES,
    START_BUTTON_AUTOMATION_ID,
    UI_OPERATION_DELAY,
    SERVER_WAIT_SECONDS,
    MAIN_UI_POLL_TIMEOUT_SECONDS,
    MAIN_UI_POLL_INTERVAL_SECONDS,
)
from d3utils.rosbot_manager import get_rosbot_manager

# Lazy load Windows-only packages
def _auto():
    return get_third_package_uiautomation()


def _win32gui():
    return get_third_package_win32gui()


def _win32con():
    return get_third_package_win32con()


class _ComInitializer:
    """Global COM initializer: call CoInitialize in current thread before using uiautomation."""

    def ensure_thread(self) -> None:
        try:
            import pythoncom
            pythoncom.CoInitialize()
        except ImportError:
            pass


_COM_INIT = _ComInitializer()


def _safe_control_info(control) -> Optional[Dict[str, Any]]:
    try:
        info = {
            "name": "",
            "type": "",
            "automation_id": "",
            "class_name": "",
            "rect": {"left": 0, "top": 0, "right": 0, "bottom": 0, "width": 0, "height": 0},
        }
        try:
            info["name"] = control.Name or ""
        except Exception:
            pass
        try:
            info["type"] = control.ControlTypeName or ""
        except Exception:
            pass
        try:
            info["automation_id"] = control.AutomationId or ""
        except Exception:
            pass
        try:
            info["class_name"] = control.ClassName or ""
        except Exception:
            pass
        try:
            r = control.BoundingRectangle
            info["rect"] = {
                "left": r.left,
                "top": r.top,
                "right": r.right,
                "bottom": r.bottom,
                "width": r.width(),
                "height": r.height(),
            }
        except Exception:
            pass
        return info
    except Exception:
        return None


def debug_print_operable_elements(window_control, max_depth: int = 12) -> None:
    """Walk window control tree and ColorPrint each operable element (type, name, automation_id, rect)."""
    auto = _auto()
    if not auto:
        ColorPrint.red("[ROSBOT_UI] uiautomation not available (non-Windows?)")
        return

    collected: List[Dict] = []

    def walk(control, depth: int):
        if depth > max_depth:
            return
        try:
            info = _safe_control_info(control)
            if not info:
                return
            collected.append({"depth": depth, **info})
            try:
                for child in control.GetChildren():
                    walk(child, depth + 1)
            except Exception:
                pass
        except Exception:
            pass

    walk(window_control, 0)

    lines: List[str] = ["=== ROSBOT UI structure ===", ""]
    for i, item in enumerate(collected):
        depth = item.get("depth", 0)
        indent = "  " * depth
        ctype = item.get("type", "")
        name = (item.get("name") or "")[:80]
        aid = item.get("automation_id", "")
        rect = item.get("rect", {})
        rstr = f"L{rect.get('left')} T{rect.get('top')} R{rect.get('right')} B{rect.get('bottom')}"
        line = f"  [{i+1}] {indent}{ctype} | name='{name}' | automation_id='{aid}' | {rstr}"
        lines.append(line)
    lines.append("")
    lines.append(f"=== Total {len(collected)} nodes ===")
    text = "\n".join(lines)

    ColorPrint.blue("[ROSBOT_UI_DEBUG] === Operable elements ===")
    for line in lines:
        if line.strip():
            ColorPrint.gray(line)
    ColorPrint.blue(f"[ROSBOT_UI_DEBUG] === Total {len(collected)} nodes ===")

    try:
        ROSBOT_UI_DEBUG_DIR.mkdir(parents=True, exist_ok=True)
        ts = time.strftime("%Y%m%d_%H%M%S")
        out_path = ROSBOT_UI_DEBUG_DIR / f"rosbot_ui_structure_{ts}.txt"
        out_path.write_text(text, encoding="utf-8")
        ColorPrint.gray(f"[ROSBOT_UI_DEBUG] UI structure written: {out_path}")
    except Exception as e:
        ColorPrint.yellow(f"[ROSBOT_UI_DEBUG] Failed to write UI structure: {e}")


def _find_controls_by_type(
    window_control, control_type: str, name_contains: Optional[tuple] = None
) -> List[Dict]:
    found = []

    def walk(control, level: int = 0):
        if level > 10:
            return
        try:
            info = _safe_control_info(control)
            if not info:
                return
            if info.get("type") == control_type:
                if name_contains:
                    for t in name_contains:
                        if t in (info.get("name") or ""):
                            info["control"] = control
                            info["level"] = level
                            found.append(info)
                            break
                else:
                    info["control"] = control
                    info["level"] = level
                    found.append(info)
            try:
                for child in control.GetChildren():
                    walk(child, level + 1)
            except Exception:
                pass
        except Exception:
            pass

    walk(window_control)
    return found


def click_tab_main_profile(window_control) -> bool:
    """Find TabItemControl with main profile name in TAB_MAIN_PROFILE_NAMES and click it."""
    tabs = _find_controls_by_type(window_control, "TabItemControl", TAB_MAIN_PROFILE_NAMES)
    if not tabs:
        ColorPrint.yellow("[ROSBOT_UI] No tab matching main profile found")
        return False
    tab = tabs[0]
    try:
        ColorPrint.blue(f"[ROSBOT_UI] Clicking tab: '{tab.get('name', '')}'")
        tab["control"].Click()
        time.sleep(UI_OPERATION_DELAY)
        ColorPrint.green("[ROSBOT_UI] Main profile tab clicked")
        return True
    except Exception as e:
        ColorPrint.red(f"[ROSBOT_UI] Tab click error: {e}")
        return False


def click_start_botting(window_control) -> bool:
    """Find ButtonControl with automation_id btnStart or name containing Start botting and click it."""
    buttons = _find_controls_by_type(window_control, "ButtonControl")
    start_btn = None
    for b in buttons:
        aid = (b.get("automation_id") or "").strip()
        name = (b.get("name") or "").strip()
        if aid == START_BUTTON_AUTOMATION_ID:
            start_btn = b
            break
        for n in START_BUTTON_NAMES:
            if n in name:
                start_btn = b
                break
    if not start_btn:
        ColorPrint.yellow("[ROSBOT_UI] Start botting button not found")
        return False
    try:
        ColorPrint.blue(f"[ROSBOT_UI] Clicking button: '{start_btn.get('name', '')}'")
        start_btn["control"].Click()
        time.sleep(UI_OPERATION_DELAY)
        ColorPrint.green("[ROSBOT_UI] Start botting clicked")
        return True
    except Exception as e:
        ColorPrint.red(f"[ROSBOT_UI] Start button click error: {e}")
        return False


def run_after_rosbot_start(
    wait_sec: int = 30,
    do_debug: bool = True,
    do_tab: bool = True,
    do_start_botting: bool = True,
) -> bool:
    """
    After ROSBOT process started: find ROSBOT window by process (exe under ros_directory only),
    activate, DEBUG print elements, click main profile tab, then click Start botting!.
    No title search; uses get_rosbot_manager().get_rosbot_window() + uiautomation (COM init in thread).

    Args:
        wait_sec: Seconds to wait for window to appear (poll every 1s).
        do_debug: If True, call debug_print_operable_elements first.
        do_tab: If True, click main profile tab.
        do_start_botting: If True, click Start botting! button.

    Returns:
        True if at least one step succeeded (window found and control obtained).
    """
    auto = _auto()
    win32gui = _win32gui()
    win32con = _win32con()
    if not auto or not win32gui or not win32con:
        ColorPrint.red("[ROSBOT_UI] uiautomation/win32 not available")
        return False

    hwnd = None
    winfo = None
    for _ in range(max(1, wait_sec)):
        winfo = get_rosbot_manager().get_rosbot_window()
        if winfo and winfo.get("hwnd"):
            hwnd = winfo["hwnd"]
            break
        time.sleep(1)

    if not hwnd:
        ColorPrint.yellow("[ROSBOT_UI] ROSBOT window not found within wait time")
        return False

    title = (winfo.get("title") or "").strip()
    pid = winfo.get("pid") or 0
    exe_name = ""
    exe_path = ""
    try:
        import psutil
        p = psutil.Process(pid)
        exe_name = p.name() or ""
        exe_path = p.exe() or ""
    except Exception:
        pass
    ColorPrint.blue(
        f"[ROSBOT_UI] Found window: title='{title}', pid={pid}, exe_name='{exe_name}', exe_path='{exe_path}'"
    )
    ColorPrint.gray("[ROSBOT_UI] title from get_rosbot_window() -> find_window_by_pid() -> GetWindowText(hwnd)")

    try:
        win32gui.SetForegroundWindow(hwnd)
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
        time.sleep(1)
    except Exception as e:
        ColorPrint.yellow(f"[ROSBOT_UI] Window activate: {e}")

    _COM_INIT.ensure_thread()

    ColorPrint.blue(f"[ROSBOT_UI] Waiting {SERVER_WAIT_SECONDS}s for server connection (original SERVER_WAIT)...")
    time.sleep(SERVER_WAIT_SECONDS)

    poll_count = MAIN_UI_POLL_TIMEOUT_SECONDS // MAIN_UI_POLL_INTERVAL_SECONDS
    for _ in range(poll_count):
        try:
            w = auto.ControlFromHandle(hwnd)
            if w and w.Exists():
                tabs = _find_controls_by_type(w, "TabItemControl", TAB_MAIN_PROFILE_NAMES)
                if tabs:
                    ColorPrint.green("[ROSBOT_UI] Main UI ready (main profile tab visible)")
                    break
        except Exception:
            pass
        time.sleep(MAIN_UI_POLL_INTERVAL_SECONDS)
    else:
        ColorPrint.yellow("[ROSBOT_UI] Main profile tab not seen within timeout, attempting tab/start anyway")

    winfo_fresh = get_rosbot_manager().get_rosbot_window()
    if winfo_fresh and winfo_fresh.get("hwnd"):
        hwnd = winfo_fresh["hwnd"]
        ColorPrint.gray("[ROSBOT_UI] Re-got window (get_rosbot_window -> find_window_by_pid -> GetWindowText) before ControlFromHandle")

    def _do_ui():
        try:
            window_control = auto.ControlFromHandle(hwnd)
        except Exception as e:
            ColorPrint.red(f"[ROSBOT_UI] ControlFromHandle: {e}")
            return False
        if not window_control or not window_control.Exists():
            ColorPrint.red("[ROSBOT_UI] Window control not available")
            return False
        ok = False
        if do_debug:
            debug_print_operable_elements(window_control)
            ok = True
        if do_tab:
            if click_tab_main_profile(window_control):
                ok = True
            time.sleep(UI_OPERATION_DELAY)
        if do_start_botting:
            if click_start_botting(window_control):
                ok = True
        return ok

    return _do_ui()
