# -*- coding: utf-8 -*-
"""
UI Control Operations – trusted pattern-based actions with mouse fallback.

Prefer UI Automation patterns (InvokePattern for buttons, SelectionItemPattern for tab items)
over mouse simulation. Use pattern first; on failure or unsupported control, fall back to
ClickHandler at control rect. Callers should use this module for ROSBOT/Battle.net and other
window automation instead of direct mouse-only clicks.
"""
from typing import Optional, Any

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_uiautomation
from pycore.pyctl.desktop.click_handler import ClickHandler
from d3utils.click_handler_singleton import get_click_handler

uiautomation = get_third_package_uiautomation()


def _uia() -> Any:
    return uiautomation


def try_invoke(control: Any) -> bool:
    """
    Invoke control via InvokePattern (no mouse). Preferred for Button and similar.
    Returns True if InvokePattern is supported and Invoke() succeeded.
    """
    try:
        if _uia() is None:
            return False
        pattern = control.GetInvokePattern()
        if pattern is None:
            return False
        pattern.Invoke()
        return True
    except Exception as e:
        if "COMError" in type(e).__name__ or "0x80004001" in str(e):
            return False
        ColorPrint.gray(f"[UI_OP] InvokePattern failed: {e}")
        return False


UIA_VALUE_PATTERN_ID = 10002


def try_set_value(control: Any, value: str) -> bool:
    """
    Set value via UIA ValuePattern (no keyboard). Preferred for Edit when focus+type fails.
    Returns True if ValuePattern.SetValue succeeded.
    """
    try:
        pattern = control.GetPattern(UIA_VALUE_PATTERN_ID)
        if pattern is None:
            return False
        pattern.SetValue(value)
        return True
    except Exception as e:
        if "COMError" in type(e).__name__ or "0x80004001" in str(e):
            return False
        ColorPrint.gray(f"[UI_OP] ValuePattern.SetValue failed: {e}")
        return False


def try_set_focus(control: Any) -> bool:
    """
    Set keyboard focus to control via UIA (no mouse). Preferred for Edit, ComboBox, etc.
    Returns True if SetFocus succeeded.
    """
    try:
        control.SetFocus()
        return True
    except Exception as e:
        if "COMError" in type(e).__name__ or "0x80004001" in str(e):
            return False
        ColorPrint.gray(f"[UI_OP] SetFocus failed: {e}")
        return False


def try_select_selection_item(control: Any) -> bool:
    """
    Select control via SelectionItemPattern (no mouse). Preferred for TabItem, ListItem, RadioButton.
    Returns True if pattern is supported and Select() succeeded.
    """
    try:
        if _uia() is None:
            return False
        pattern = control.GetSelectionItemPattern()
        if pattern is None:
            return False
        pattern.Select()
        return True
    except Exception as e:
        if "COMError" in type(e).__name__ or "0x80004001" in str(e):
            return False
        ColorPrint.gray(f"[UI_OP] SelectionItemPattern failed: {e}")
        return False


def click_at_control_rect(
    control: Any,
    clicker: Optional[ClickHandler] = None,
    direct_click: bool = True,
    return_to_original: bool = True,
    **kwargs,
) -> bool:
    """
    Click at the center of control's BoundingRectangle using ClickHandler (mouse fallback).
    """
    try:
        r = control.BoundingRectangle
        cx = (r.left + r.right) // 2
        cy = (r.top + r.bottom) // 2
        c = clicker if clicker is not None else get_click_handler()
        return c.click(cx, cy, direct_click=direct_click, return_to_original=return_to_original, **kwargs)
    except Exception as e:
        ColorPrint.red(f"[UI_OP] Click at rect error: {e}")
        return False


def operate_button(
    control: Any,
    clicker: Optional[ClickHandler] = None,
    prefer_invoke: bool = True,
    **click_kwargs,
) -> bool:
    """
    Operate a button: try InvokePattern first (trusted, no mouse); on failure use mouse at rect.
    Returns True if either method succeeded.
    """
    if prefer_invoke and try_invoke(control):
        return True
    return click_at_control_rect(control, clicker=clicker, **click_kwargs)


def operate_tab_item(
    control: Any,
    clicker: Optional[ClickHandler] = None,
    prefer_pattern: bool = True,
    **click_kwargs,
) -> bool:
    """
    Operate a tab item: try SelectionItemPattern.Select() then InvokePattern.Invoke(); on failure use mouse at rect.
    Returns True if any method succeeded.
    """
    if prefer_pattern:
        if try_select_selection_item(control):
            return True
        if try_invoke(control):
            return True
    return click_at_control_rect(control, clicker=clicker, **click_kwargs)


def operate_control(
    control: Any,
    control_type_hint: str = "",
    clicker: Optional[ClickHandler] = None,
    **click_kwargs,
) -> bool:
    """
    Operate a control by type hint: Button -> Invoke then click; TabItem/ListItem -> Select then Invoke then click; else click only.
    control_type_hint: "Button", "ButtonControl", "TabItem", "TabItemControl", "ListItem", etc.
    """
    hint = (control_type_hint or "").strip().lower()
    if "button" in hint:
        return operate_button(control, clicker=clicker, **click_kwargs)
    if "tab" in hint or "listitem" in hint or "selection" in hint:
        return operate_tab_item(control, clicker=clicker, **click_kwargs)
    return click_at_control_rect(control, clicker=clicker, **click_kwargs)
