# -*- coding: utf-8 -*-
"""
Battle.net UI inspector: classify controls for automation (main window vs in-UI popup).

- In-UI floating popup (ad overlay): small overlay on main or login UI with a close button (Close or automation_id
  containing winCloseButton but not the main title bar). try_close_popup clicks only these.
- Main window (login client): the Battle.net main window; the title-bar X is main window close (automation_id
  with topLayerContainer.TopLayer.buttonContainer and winCloseButton); never click it (would close the whole client).
"""
from typing import List, Dict, Any, Tuple

from providor.constants.common import (
    BATTLE_NET_POPUP_CLOSE_AUTOMATION_IDS,
    BATTLE_NET_POPUP_CLOSE_NAME_KEYWORDS,
    BATTLE_NET_MAIN_WINDOW_FRAME_AUTOMATION_ID_SUBSTRINGS,
)


def is_main_window_close_button(automation_id: str) -> bool:
    """
    True if this automation_id is the main window's title-bar close button (X).
    Such controls must not be clicked by try_close_popup (would close the whole client).
    """
    if not (automation_id or "").strip():
        return False
    aid = (automation_id or "").strip()
    for sub in BATTLE_NET_MAIN_WINDOW_FRAME_AUTOMATION_ID_SUBSTRINGS:
        if sub and sub in aid and "winCloseButton" in aid:
            return True
    return False


def is_popup_close_button_by_automation_id(automation_id: str) -> bool:
    """True if automation_id matches a popup close button and is NOT the main window close."""
    if not (automation_id or "").strip():
        return False
    aid = (automation_id or "").strip()
    if is_main_window_close_button(aid):
        return False
    for sub in BATTLE_NET_POPUP_CLOSE_AUTOMATION_IDS:
        if sub and sub in aid:
            return True
    return False


def is_popup_close_button_by_name(name: str) -> bool:
    """True if control name matches popup close keywords (fallback when automation_id not used)."""
    if not (name or "").strip():
        return False
    n = (name or "").strip()
    for kw in BATTLE_NET_POPUP_CLOSE_NAME_KEYWORDS:
        if kw and kw in n:
            return True
    return False


def filter_popup_close_controls(
    controls: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    From enumerated controls, return only those that are popup close buttons
    (exclude main window title-bar close). Prefer automation_id match; then name match.
    """
    out: List[Dict[str, Any]] = []
    for c in controls:
        if (c.get("type") or "").strip() != "ButtonControl":
            continue
        aid = (c.get("automation_id") or "").strip()
        if is_popup_close_button_by_automation_id(aid):
            out.append(c)
            continue
        name = (c.get("name") or "").strip()
        if is_popup_close_button_by_name(name) and is_main_window_close_button(aid) is False:
            out.append(c)
    return out
