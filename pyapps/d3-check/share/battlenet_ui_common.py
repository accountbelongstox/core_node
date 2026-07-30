# -*- coding: utf-8 -*-
"""
Battle.net UI Automation common (shared).
Enumerate controls, find by automation_id/name, click at rect or Invoke. No D3/D4 game-specific constants.
"""
import time
from typing import Optional, List, Dict, Any, Tuple

from pycore.pyfoundations.third_party.api import get_third_package_pythoncom, get_third_package_uiautomation
from pycore.pyctl.desktop.click_handler import ClickHandler

pythoncom = get_third_package_pythoncom()
uiautomation = get_third_package_uiautomation()

UIA_IS_OFFSCREEN_PROPERTY_ID = 10022


def ensure_com() -> None:
    """Ensure COM is initialized in current thread for UI Automation."""
    if pythoncom is not None:
        pythoncom.CoInitialize()


def get_root_control(hwnd: int):
    """Get root UI Automation control for given hwnd, or None."""
    ensure_com()
    if not uiautomation:
        return None
    try:
        root = uiautomation.ControlFromHandle(hwnd)
        return root if root.Exists() else None
    except Exception:
        return None


def safe_control_dict(control) -> Optional[Dict[str, Any]]:
    """Build control dict with rect, name, automation_id, type, is_clickable."""
    try:
        r = control.BoundingRectangle
        w, h = r.width(), r.height()
        rect = {
            "left": r.left, "top": r.top, "right": r.right, "bottom": r.bottom,
            "width": w, "height": h,
        }
        name = (control.Name or "").strip()
        aid = (control.AutomationId or "").strip()
        ctype = (control.ControlTypeName or "").strip()
        try:
            is_enabled = control.IsEnabled
        except Exception:
            is_enabled = None
        try:
            is_offscreen = control.GetCurrentPropertyValue(UIA_IS_OFFSCREEN_PROPERTY_ID)
        except Exception:
            is_offscreen = None
        has_valid_rect = (w is not None and h is not None and w > 0 and h > 0)
        is_clickable = (
            (is_enabled is not False)
            and (is_offscreen is not True)
            and has_valid_rect
        )
        return {
            "name": name,
            "automation_id": aid,
            "type": ctype,
            "rect": rect,
            "is_enabled": is_enabled,
            "is_offscreen": is_offscreen,
            "is_clickable": is_clickable,
        }
    except Exception:
        return None


def rect_center(rect: Dict[str, Any]) -> Tuple[int, int]:
    """Return (cx, cy) center of rect."""
    left = rect.get("left", 0)
    top = rect.get("top", 0)
    w = rect.get("width", 0)
    h = rect.get("height", 0)
    return (left + w // 2, top + h // 2)


def enumerate_controls(hwnd: int) -> List[Dict[str, Any]]:
    """Enumerate Battle.net window UI controls; returns list of control dicts."""
    root = get_root_control(hwnd)
    if not root:
        return []
    collected: List[Dict[str, Any]] = []

    def walk(control, depth: int = 0):
        if depth > 25:
            return
        info = safe_control_dict(control)
        if info:
            info["level"] = depth
            collected.append(info)
        for child in control.GetChildren():
            walk(child, depth + 1)

    walk(root)
    return collected


def find_control_by_automation_id(
    controls: List[Dict[str, Any]],
    automation_id_substr: str,
    exact_match: bool = False,
) -> Optional[Dict[str, Any]]:
    """Find first control whose automation_id equals or contains the given string."""
    for c in controls:
        aid = (c.get("automation_id") or "").strip()
        if not automation_id_substr:
            continue
        if exact_match:
            if aid == automation_id_substr:
                return c
        elif automation_id_substr in aid:
            return c
    return None


def find_control_by_name(
    controls: List[Dict[str, Any]],
    name_keywords: Tuple[str, ...],
) -> Optional[Dict[str, Any]]:
    """Find first control whose name contains any of the given keywords."""
    name_keywords = tuple(s for s in name_keywords if s)
    for c in controls:
        name = (c.get("name") or "").strip()
        for sub in name_keywords:
            if sub and sub in name:
                return c
    return None


def find_raw_control_matching(root, control_dict: Dict[str, Any]):
    """Traverse from root, return first raw control matching dict (exact automation_id preferred)."""
    if not root or not control_dict:
        return None
    want_aid = (control_dict.get("automation_id") or "").strip()
    want_name = (control_dict.get("name") or "").strip()
    found = [None]

    def walk(control, depth: int = 0):
        if depth > 25 or found[0] is not None or control is None:
            return
        aid = (control.AutomationId or "").strip()
        name = (control.Name or "").strip()
        if want_aid and aid == want_aid and (not want_name or want_name in name):
            found[0] = control
            return
        if not want_aid and want_name and want_name in name:
            found[0] = control
            return
        for child in control.GetChildren():
            walk(child, depth + 1)

    walk(root)
    return found[0]


def try_invoke(control) -> bool:
    """Invoke control via InvokePattern. Returns True if succeeded."""
    try:
        if uiautomation is None:
            return False
        pattern = control.GetInvokePattern()
        if pattern is None:
            return False
        pattern.Invoke()
        return True
    except Exception:
        return False


def click_control(
    root,
    control_dict: Dict[str, Any],
    clicker: ClickHandler,
    require_clickable: bool = False,
    prefer_invoke: bool = True,
    duration: float = 0.15,
    pause_after_move: float = 0.05,
) -> bool:
    """
    Click control: try Invoke first, then click at rect center.
    Returns True if either succeeded.
    """
    if require_clickable and control_dict.get("is_clickable") is not True:
        return False
    raw = find_raw_control_matching(root, control_dict)
    if raw is not None and prefer_invoke and try_invoke(raw):
        return True
    rect = control_dict.get("rect")
    if not rect:
        return False
    cx, cy = rect_center(rect)
    return clicker.click(
        cx, cy,
        direct_click=True,
        return_to_original=True,
        duration=duration,
        pause_after_move=pause_after_move,
    )
