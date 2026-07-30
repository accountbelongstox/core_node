# -*- coding: utf-8 -*-
"""
ROSBOT UI automation: after ROSBOT starts, get window via get_rosbot_window() (same-dir exe flow), DEBUG print operable elements, then click main-profile tab and Start botting! button. Uses uiautomation (pycore third_party). Prefers UI Automation patterns (InvokePattern, SelectionItemPattern) via ui_control_operations; falls back to ClickHandler mouse at rect.
"""
import os
import time
from pathlib import Path
from typing import List, Dict, Optional, Any

from pycore.pyfoundations.third_party.api import (
    get_third_package_psutil,
    get_third_package_pythoncom,
    get_third_package_uiautomation,
    get_third_package_win32gui,
    get_third_package_win32con,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyctl.desktop.click_handler import ClickHandler
from d3utils.click_handler_singleton import get_click_handler

from d3utils.ui_control_operations import operate_button, operate_tab_item, click_at_control_rect
from d3utils.ui_analysis_operations import run_sequence, find_control_in_window
from d3utils.rosbot_ui_structure import get_resume_sequence, CMB_SEQUENCE, BTN_START, LIST_ITEM_RIFT_MODE
from providor.constants.common import ROSBOT_UI_DEBUG_DIR
from providor.constants.common import (
    UI_AUTOMATION_ID_OK_BUTTON,
    UI_AUTOMATION_ID_TEXT_BOX,
    UI_NAME_KEYWORDS_OK,
    UI_NAME_KEYWORDS_NO_ITEMS,
)
from providor.constants.d3 import (
    TAB_MAIN_PROFILE_NAMES,
    START_BUTTON_NAMES,
    START_BUTTON_AUTOMATION_ID,
    UI_OPERATION_DELAY,
    SERVER_WAIT_SECONDS,
    MAIN_UI_POLL_TIMEOUT_SECONDS,
    MAIN_UI_POLL_INTERVAL_SECONDS,
)
from d3utils.rosbot_manager import get_rosbot_manager

pythoncom = get_third_package_pythoncom()
psutil = get_third_package_psutil()
uiautomation = get_third_package_uiautomation()
win32gui = get_third_package_win32gui()
win32con = get_third_package_win32con()


def _auto():
    return uiautomation


def _win32gui():
    return win32gui


def _win32con():
    return win32con


class _ComInitializer:
    """Global COM initializer: call CoInitialize in current thread before using uiautomation."""

    def ensure_thread(self) -> None:
        if pythoncom is not None:
            pythoncom.CoInitialize()


_COM_INIT = _ComInitializer()

# AutomationIds that identify the ROSBOT main window (content-based, not title)
_ROSBOT_MAIN_CONTENT_IDS = ("profileTab", "btnStart")


def window_has_rosbot_main_content(hwnd: int) -> bool:
    """
    Return True if the window has ROSBOT main UI content (e.g. profileTab or btnStart by AutomationId).
    Used to select the main window by content when the process has multiple windows (title may be e.g. "The Vault").
    """
    auto = _auto()
    win32gui = _win32gui()
    if not auto or not win32gui or not hwnd or not win32gui.IsWindow(hwnd):
        return False
    _COM_INIT.ensure_thread()
    try:
        root = auto.ControlFromHandle(int(hwnd))
    except Exception:
        return False
    if not root or not root.Exists():
        return False

    def walk(control, depth: int, max_d: int = 8) -> bool:
        if depth > max_d or control is None:
            return False
        aid = (control.AutomationId or "").strip()
        if aid in _ROSBOT_MAIN_CONTENT_IDS:
            return True
        for child in control.GetChildren():
            if walk(child, depth + 1, max_d):
                return True
        return False

    return walk(root, 0)


def _register_content_validator() -> None:
    """Register content-based main window validator with ROSBOTManager so get_rosbot_window uses content, not title."""
    get_rosbot_manager().set_main_window_content_validator(window_has_rosbot_main_content)


_register_content_validator()

# Default: instant move (no visible trajectory), instant click, then move back to original position (used when falling back to mouse)
_ROSBOT_CLICK_PARAMS = {
    "direct_click": True,
    "return_to_original": True,
    "duration": 0.0,
    "pause_after_move": 0.0,
}


def _safe_control_info(control) -> Optional[Dict[str, Any]]:
    if control is None:
        return None
    info = {
        "name": control.Name or "",
        "type": control.ControlTypeName or "",
        "automation_id": control.AutomationId or "",
        "class_name": control.ClassName or "",
        "rect": {"left": 0, "top": 0, "right": 0, "bottom": 0, "width": 0, "height": 0},
    }
    r = control.BoundingRectangle
    info["rect"] = {
        "left": r.left,
        "top": r.top,
        "right": r.right,
        "bottom": r.bottom,
        "width": r.width(),
        "height": r.height(),
    }
    return info


def debug_print_operable_elements(window_control, max_depth: int = 12) -> None:
    """Walk window control tree and ColorPrint each operable element (type, name, automation_id, rect)."""
    auto = _auto()
    if not auto:
        ColorPrint.red("[ROSBOT_UI] uiautomation not available (non-Windows?)")
        return

    collected: List[Dict] = []

    def walk(control, depth: int):
        if depth > max_depth or control is None:
            return
        info = _safe_control_info(control)
        if not info:
            return
        collected.append({"depth": depth, **info})
        for child in control.GetChildren():
            walk(child, depth + 1)

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

    ROSBOT_UI_DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    ts = time.strftime("%Y%m%d_%H%M%S")
    out_path = ROSBOT_UI_DEBUG_DIR / f"rosbot_ui_structure_{ts}.txt"
    out_path.write_text(text, encoding="utf-8")
    ColorPrint.gray(f"[ROSBOT_UI_DEBUG] UI structure written: {out_path}")


def _find_controls_by_type(
    window_control, control_type: str, name_contains: Optional[tuple] = None
) -> List[Dict]:
    found = []

    def walk(control, level: int = 0):
        if level > 10 or control is None:
            return
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
        for child in control.GetChildren():
            walk(child, level + 1)

    walk(window_control)
    return found


def click_tab_main_profile(window_control, clicker: Optional[ClickHandler] = None, **click_kwargs) -> bool:
    """Find TabItemControl with main profile name; operate via SelectionItemPattern/InvokePattern first, else mouse at rect."""
    tabs = _find_controls_by_type(window_control, "TabItemControl", TAB_MAIN_PROFILE_NAMES)
    if not tabs:
        ColorPrint.yellow("[ROSBOT_UI] No tab matching main profile found")
        return False
    tab = tabs[0]
    ColorPrint.blue(f"[ROSBOT_UI] Clicking tab: '{tab.get('name', '')}'")
    params = {**_ROSBOT_CLICK_PARAMS, **click_kwargs}
    c = clicker if clicker is not None else get_click_handler()
    ok = operate_tab_item(tab["control"], clicker=c, **params)
    if ok:
        time.sleep(UI_OPERATION_DELAY)
        ColorPrint.green("[ROSBOT_UI] Main profile tab clicked")
    return ok


def click_start_botting(window_control, clicker: Optional[ClickHandler] = None, **click_kwargs) -> bool:
    """Find ButtonControl (btnStart or name containing Start botting); operate via InvokePattern first, else mouse at rect."""
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
    ColorPrint.blue(f"[ROSBOT_UI] Clicking button: '{start_btn.get('name', '')}'")
    params = {**_ROSBOT_CLICK_PARAMS, **click_kwargs}
    c = clicker if clicker is not None else get_click_handler()
    ok = operate_button(start_btn["control"], clicker=c, **params)
    if ok:
        time.sleep(UI_OPERATION_DELAY)
        ColorPrint.green("[ROSBOT_UI] Start botting clicked")
    return ok


# UI traits for "D3 must be launched" style message box: small dialog, single OK (AutomationId), no TextBox
_D3_MUST_LAUNCH_DIALOG_MAX_WIDTH = 600
_D3_MUST_LAUNCH_DIALOG_MAX_HEIGHT = 280


def _name_matches_ok_keywords(name: str) -> bool:
    """True if name matches UI_NAME_KEYWORDS_OK (minimal, CN/EN); case-insensitive for single token."""
    if not (name or "").strip():
        return False
    n = (name or "").strip()
    n_lower = n.lower()
    for kw in UI_NAME_KEYWORDS_OK:
        if not kw:
            continue
        if n == kw or n_lower == kw.lower() or (kw in n) or (kw.lower() in n_lower):
            return True
    return False


def _find_ok_button_in_control(control, depth: int = 0, max_depth: int = 6) -> Optional[Any]:
    """Walk control tree, return first ButtonControl whose Name matches UI_NAME_KEYWORDS_OK (no AutomationId fallback)."""
    if depth > max_depth or control is None:
        return None
    ctype = (control.ControlTypeName or "").strip()
    if "Button" in ctype:
        name = (control.Name or "").strip()
        if _name_matches_ok_keywords(name):
            return control
    for child in control.GetChildren():
        found = _find_ok_button_in_control(child, depth + 1, max_depth)
        if found is not None:
            return found
    return None


def _window_has_control_with_automation_id(root: Any, automation_id: str, depth: int = 0, max_d: int = 8) -> bool:
    """Walk control tree; return True if any control has AutomationId equal to automation_id."""
    if depth > max_d or root is None:
        return False
    aid = (root.AutomationId or "").strip()
    if aid == automation_id:
        return True
    for child in root.GetChildren():
        if _window_has_control_with_automation_id(child, automation_id, depth + 1, max_d):
            return True
    return False


def _find_button_by_automation_id(root: Any, automation_id: str, depth: int = 0, max_d: int = 8) -> Optional[Any]:
    """Walk control tree; return first ButtonControl whose AutomationId equals automation_id."""
    if depth > max_d or root is None:
        return None
    ctype = (root.ControlTypeName or "").strip()
    if "Button" in ctype:
        aid = (root.AutomationId or "").strip()
        if aid == automation_id:
            return root
    for child in root.GetChildren():
        found = _find_button_by_automation_id(child, automation_id, depth + 1, max_d)
        if found is not None:
            return found
    return None


def try_close_d3_must_be_launched_dialog() -> bool:
    """
    Close ROSBOT 'D3 must be launched' style message box by UI traits only (no text match on content text).
    Criteria: ROSBOT process window, small rect (max 600x280), no TextBox (so KEY input dialog is not closed),
    and an OK-style button either by AutomationId (UI_AUTOMATION_ID_OK_BUTTON) or by name keywords (UI_NAME_KEYWORDS_OK).
    Returns True if such a dialog was found and OK clicked.
    """
    auto = _auto()
    win32gui = _win32gui()
    if not auto or not win32gui:
        return False
    _COM_INIT.ensure_thread()
    mgr = get_rosbot_manager()
    pids: List[int] = []
    for exe_path in mgr.find_other_exe_files():
        proc = mgr.find_process_by_exe_name(os.path.basename(exe_path))
        if proc and proc.get("pid"):
            pids.append(proc["pid"])
    proc = mgr.find_process_by_exe_name(mgr.rosbot_exe_name)
    if proc and proc.get("pid"):
        pids.append(proc["pid"])
    for pid in pids:
        for w in mgr.find_windows_by_pid(pid, visible_only=False):
            hwnd = w.get("hwnd")
            if not hwnd or not win32gui.IsWindow(hwnd):
                continue
            rect = win32gui.GetWindowRect(hwnd)
            if len(rect) < 4:
                continue
            ww = rect[2] - rect[0]
            wh = rect[3] - rect[1]
            if ww > _D3_MUST_LAUNCH_DIALOG_MAX_WIDTH or wh > _D3_MUST_LAUNCH_DIALOG_MAX_HEIGHT:
                continue
            try:
                root = auto.ControlFromHandle(int(hwnd))
            except Exception:
                continue
            if not root:
                continue
            if not root.Exists():
                continue
            # Skip dialogs that contain TextBox (e.g. KEY/license input), we must NOT auto-close those
            if _window_has_control_with_automation_id(root, UI_AUTOMATION_ID_TEXT_BOX):
                continue
            # Prefer AutomationId (stable across language/skin)
            ok_btn = _find_button_by_automation_id(root, UI_AUTOMATION_ID_OK_BUTTON)
            # Fallback: match OK button by name keywords (see UI_NAME_KEYWORDS_OK constant) when AutomationId is numeric (e.g. Win32 MessageBox)
            if not ok_btn:
                ok_btn = _find_ok_button_in_control(root)
            if not ok_btn:
                continue
            clicker = get_click_handler()
            if operate_button(ok_btn, clicker=clicker, **_ROSBOT_CLICK_PARAMS):
                ColorPrint.green("[ROSBOT_UI] D3 must be launched dialog closed (OK by AutomationId)")
                return True
    return False


def _window_has_no_items_message(root, depth: int = 0, max_d: int = 6) -> bool:
    """Walk control tree; return True if any TextControl has Name containing any of UI_NAME_KEYWORDS_NO_ITEMS (minimal keywords, CN/EN)."""
    if depth > max_d or root is None:
        return False
    ctype = (root.ControlTypeName or "").strip()
    if "Text" in ctype:
        name = (root.Name or "") or ""
        for kw in UI_NAME_KEYWORDS_NO_ITEMS:
            if kw and kw in name:
                return True
    for child in root.GetChildren():
        if _window_has_no_items_message(child, depth + 1, max_d):
            return True
    return False


def try_close_no_items_popup() -> bool:
    """
    Find a top-level window that has a child TextControl with "No items" in Name (content, not title; see rosbot_ui_elements.json).
    Then click OK to close it. Returns True if popup was found and OK clicked.
    """
    auto = _auto()
    win32gui = _win32gui()
    if not auto or not win32gui:
        return False
    _COM_INIT.ensure_thread()

    found_hwnd = []

    def enum_cb(hwnd, _):
        if not win32gui.IsWindow(hwnd) or not win32gui.IsWindowVisible(hwnd):
            return True
        try:
            root = auto.ControlFromHandle(hwnd)
        except Exception:
            return True
        if not root or not root.Exists():
            return True
        if _window_has_no_items_message(root):
            found_hwnd.append(hwnd)
            return False
        return True

    win32gui.EnumWindows(enum_cb, None)

    if not found_hwnd:
        return False

    hwnd = found_hwnd[0]
    if not win32gui.IsWindow(hwnd):
        return False
    try:
        root = auto.ControlFromHandle(hwnd)
    except Exception:
        return False
    if not root or not root.Exists():
        return False

    ok_btn = _find_ok_button_in_control(root)
    if not ok_btn:
        ColorPrint.yellow("[ROSBOT_UI] No items popup: OK button not found")
        return False
    clicker = get_click_handler()
    if operate_button(ok_btn, clicker=clicker, **_ROSBOT_CLICK_PARAMS):
        ColorPrint.green("[ROSBOT_UI] No items popup closed (OK clicked)")
        return True
    return False


def _try_expand_combo(control, clicker: Optional[ClickHandler] = None) -> bool:
    """Expand ComboBox: try ExpandCollapsePattern.Expand(), else click at rect."""
    pattern = control.GetExpandCollapsePattern()
    if pattern is not None:
        pattern.Expand()
        return True
    c = clicker or get_click_handler()
    return click_at_control_rect(control, clicker=c, **_ROSBOT_CLICK_PARAMS)


def switch_to_rift_mode_and_start(window_control: Any) -> bool:
    """
    Set mode to rift (greater rift) and click Start. Uses rosbot_ui_structure: find cmbSequence, expand,
    find ListItem with name containing rift keywords, select it, then invoke btnStart.
    Returns True if at least Start was invoked.
    """
    if not window_control:
        return False
    clicker = get_click_handler()
    ok = False
    cmb = find_control_in_window(window_control, CMB_SEQUENCE, max_depth=12)
    if cmb:
        if _try_expand_combo(cmb, clicker=clicker):
            time.sleep(0.4)
        item = find_control_in_window(window_control, LIST_ITEM_RIFT_MODE, max_depth=14)
        if item:
            if operate_tab_item(item, clicker=clicker, **_ROSBOT_CLICK_PARAMS):
                ok = True
            time.sleep(0.25)
    start_btn = find_control_in_window(window_control, BTN_START, max_depth=12)
    if start_btn and operate_button(start_btn, clicker=clicker, **_ROSBOT_CLICK_PARAMS):
        ok = True
    return ok


def do_after_no_items_close_switch_rift_and_start() -> bool:
    """
    After OK closed the No items popup: log that we switch to rift mode, get ROSBOT window,
    set mode to rift and click Start. Returns True if switch+start succeeded.
    """
    ColorPrint.blue("[ROSBOT_UI] Other mode keys exhausted, switching to rift mode")
    winfo = get_rosbot_manager().get_rosbot_window()
    if not winfo or not winfo.get("hwnd"):
        ColorPrint.yellow("[ROSBOT_UI] do_after_no_items: no ROSBOT window")
        return False
    auto = _auto()
    if not auto:
        return False
    _COM_INIT.ensure_thread()
    try:
        window_control = auto.ControlFromHandle(int(winfo["hwnd"]))
    except Exception:
        return False
    if not window_control:
        return False
    return switch_to_rift_mode_and_start(window_control)


def run_after_rosbot_start(
    wait_sec: int = 30,
    do_debug: bool = True,
    do_tab: bool = True,
    do_start_botting: bool = True,
    click_params: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    After ROSBOT process started: find ROSBOT window by process (exe under ros_directory only),
    activate, DEBUG print elements, click main profile tab, then click Start botting!.
    Clicks use ClickHandler with click_params (default: instant move, instant click, return to original position).

    Args:
        wait_sec: Seconds to wait for window to appear (poll every 1s).
        do_debug: If True, call debug_print_operable_elements first.
        do_tab: If True, click main profile tab.
        do_start_botting: If True, click Start botting! button.
        click_params: Optional dict for clicker.click() (e.g. direct_click, return_to_original, duration, pause_after_move). Merged over _ROSBOT_CLICK_PARAMS.

    Returns:
        True if at least one step succeeded (window found and control obtained).
    """
    auto = _auto()
    win32gui = _win32gui()
    win32con = _win32con()
    if not auto or not win32gui or not win32con:
        ColorPrint.red("[ROSBOT_UI] uiautomation/win32 not available")
        return False

    try_close_d3_must_be_launched_dialog()
    if try_close_no_items_popup():
        ColorPrint.blue("[ROSBOT_UI] No items popup closed at start; switching to rift mode and start.")
        if do_after_no_items_close_switch_rift_and_start():
            return True
    # else continue with normal flow (main profile tab + Start botting)

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
    if psutil is not None and pid > 0 and psutil.pid_exists(pid):
        try:
            p = psutil.Process(pid)
            exe_name = p.name() or ""
            exe_path = p.exe() or ""
        except (AttributeError, OSError):
            pass
    ColorPrint.blue(
        f"[ROSBOT_UI] Found window: title='{title}', pid={pid}, exe_name='{exe_name}', exe_path='{exe_path}'"
    )
    ColorPrint.gray("[ROSBOT_UI] title from get_rosbot_window() -> find_window_by_pid() -> GetWindowText(hwnd)")

    if win32gui.IsWindow(hwnd):
        win32gui.SetForegroundWindow(hwnd)
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
        time.sleep(1)

    _COM_INIT.ensure_thread()

    ColorPrint.blue(f"[ROSBOT_UI] Waiting {SERVER_WAIT_SECONDS}s for server connection (original SERVER_WAIT)...")
    time.sleep(SERVER_WAIT_SECONDS)

    poll_count = MAIN_UI_POLL_TIMEOUT_SECONDS // MAIN_UI_POLL_INTERVAL_SECONDS
    main_tab_seen = False
    for _ in range(poll_count):
        try:
            w = auto.ControlFromHandle(hwnd)
        except Exception:
            time.sleep(MAIN_UI_POLL_INTERVAL_SECONDS)
            continue
        if w and w.Exists():
            tabs = _find_controls_by_type(w, "TabItemControl", TAB_MAIN_PROFILE_NAMES)
            if tabs:
                ColorPrint.green("[ROSBOT_UI] Main UI ready (main profile tab visible)")
                main_tab_seen = True
                break
        time.sleep(MAIN_UI_POLL_INTERVAL_SECONDS)
    else:
        ColorPrint.yellow("[ROSBOT_UI] Main profile tab not seen within timeout, attempting tab/start anyway (E5a->E6->F3 on skip)")

    winfo_fresh = get_rosbot_manager().get_rosbot_window()
    if winfo_fresh and winfo_fresh.get("hwnd"):
        hwnd = winfo_fresh["hwnd"]
        ColorPrint.gray("[ROSBOT_UI] Re-got window (get_rosbot_window -> find_window_by_pid -> GetWindowText) before ControlFromHandle")

    kw = dict(click_params or {})
    clicker = get_click_handler()

    def _do_ui():
        try:
            window_control = auto.ControlFromHandle(hwnd)
        except Exception:
            return False
        if not window_control or not window_control.Exists():
            ColorPrint.red("[ROSBOT_UI] Window control not available")
            return False
        ok = False
        if do_debug:
            debug_print_operable_elements(window_control)
            ok = True
        if do_tab or do_start_botting:
            run_seq = get_resume_sequence()
            results = run_sequence(window_control, run_seq, clicker=clicker, click_params=kw, delay_after_step=UI_OPERATION_DELAY)
            ok = ok or any(results)
        return ok

    did_click = _do_ui()
    if not main_tab_seen and not did_click:
        ColorPrint.gray("[ROSBOT_UI] E5a: timeout path, UI controls not available; completing E5a without click -> E6 -> F3 only")
    return did_click


def resume_rosbot_ui(
    do_tab: bool = True,
    do_start_botting: bool = True,
    click_params: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Resume ROSBOT when window is visible (paused): activate window, run built-in sequence (main profile tab + Start botting!).
    Uses hardcoded rosbot_ui_structure only. Returns True if at least one step succeeded.
    """
    auto = _auto()
    win32gui = _win32gui()
    win32con = _win32con()
    if not auto or not win32gui or not win32con:
        ColorPrint.red("[ROSBOT_UI] uiautomation/win32 not available")
        return False

    winfo = get_rosbot_manager().get_rosbot_window()
    if not winfo or not winfo.get("hwnd"):
        ColorPrint.yellow("[ROSBOT_UI] resume_rosbot_ui: no visible ROSBOT window")
        return False

    hwnd = int(winfo["hwnd"])
    if win32gui.IsWindow(hwnd):
        win32gui.SetForegroundWindow(hwnd)
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
        time.sleep(UI_OPERATION_DELAY)

    _COM_INIT.ensure_thread()

    try:
        window_control = auto.ControlFromHandle(hwnd)
    except Exception:
        return False
    if not window_control or not window_control.Exists():
        ColorPrint.red("[ROSBOT_UI] Window control not available")
        return False

    kw = dict(click_params or {})
    clicker = get_click_handler()
    if do_tab or do_start_botting:
        run_seq = get_resume_sequence()
        results = run_sequence(window_control, run_seq, clicker=clicker, click_params=kw, delay_after_step=UI_OPERATION_DELAY)
        return any(results)
    return False
