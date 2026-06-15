# -*- coding: utf-8 -*-
"""
Analysis-driven UI operations: load window analysis JSON (e.g. rosbot_analysis.json),
find controls by flexible selector, run actions (invoke/select/click) with pattern-first + mouse fallback.

Selector format (target): optional keys
  - automation_id: if non-empty, match ONLY by automation_id (and type). Do not use name.
  - type: control type name, e.g. "ButtonControl", "TabItemControl"
  - name: exact name match (used only when no automation_id)
  - name_candidates: list of names, any match (e.g. localized)
  - name_contains: substring in name (any of tuple or single str)
"""
from pathlib import Path
import json
import time
from typing import Optional, Any, List, Dict, Union

from pycore.pyfoundations.color_print import ColorPrint

from d3utils.ui_control_operations import (
    operate_button,
    operate_tab_item,
    operate_control,
    click_at_control_rect,
)
from pycore.pyutils.input.click_handler import ClickHandler
from d3utils.click_handler_singleton import get_click_handler
from d3utils.rosbot_ui_structure import get_resume_sequence


# ---------------------------------------------------------------------------
# Analysis JSON loader
# ---------------------------------------------------------------------------

def load_analysis_json(path: Union[str, Path]) -> Optional[Dict[str, Any]]:
    """Load window analysis JSON; returns dict with keys: timestamp, program_name, window_info, controls, files."""
    try:
        p = Path(path)
        if not p.is_file():
            return None
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        ColorPrint.red(f"[UI_ANALYSIS] Load failed: {e}")
        return None


def get_controls(analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return controls list from analysis; each item has id, parent_id, type, name, automation_id, rect, level."""
    return analysis.get("controls") or []


def get_control_by_snapshot_id(analysis: Dict[str, Any], snapshot_id: int) -> Optional[Dict[str, Any]]:
    """Return control descriptor by analysis snapshot id."""
    for c in get_controls(analysis):
        if c.get("id") == snapshot_id:
            return c
    return None


def selector_from_analysis_id(analysis: Dict[str, Any], snapshot_id: int) -> Optional[Dict[str, Any]]:
    """Build selector dict from analysis snapshot id (type + name + automation_id)."""
    c = get_control_by_snapshot_id(analysis, snapshot_id)
    if not c:
        return None
    sel = {"type": c.get("type") or ""}
    if c.get("name"):
        sel["name"] = c["name"]
    if c.get("automation_id"):
        sel["automation_id"] = c["automation_id"]
    return sel


# ---------------------------------------------------------------------------
# Finding control in live window by selector
# ---------------------------------------------------------------------------

def _control_matches(control, info: Dict[str, Any], selector: Dict[str, Any]) -> bool:
    """
    Match live control against selector.
    If selector has non-empty automation_id: match ONLY by automation_id (and type). Do not use name.
    Else: match by type + name; support name (exact), name_candidates (any of, localized), name_contains.
    """
    ctype = (control.ControlTypeName or "").strip()
    name = (control.Name or "") or ""
    aid = (control.AutomationId or "") or ""

    sel_id = selector.get("automation_id")
    if sel_id is not None and str(sel_id).strip():
        if aid != str(sel_id).strip():
            return False
        if selector.get("type") and selector["type"] not in ctype and ctype not in selector["type"]:
            return False
        return True

    if selector.get("type") and selector["type"] not in ctype and ctype not in selector["type"]:
        return False
    name_candidates = selector.get("name_candidates")
    if name_candidates is not None:
        if isinstance(name_candidates, (list, tuple)):
            if name not in [str(s).strip() for s in name_candidates if s]:
                return False
        else:
            if name != str(name_candidates).strip():
                return False
    elif "name" in selector and selector["name"] is not None:
        if name != selector["name"]:
            return False
    name_contains = selector.get("name_contains")
    if name_contains is not None:
        if isinstance(name_contains, (list, tuple)):
            if not any(s in name for s in name_contains):
                return False
        elif name_contains not in name:
            return False
    return True


def find_control_in_window(
    window_control: Any,
    selector: Dict[str, Any],
    max_depth: int = 12,
    found_index: int = 0,
) -> Optional[Any]:
    """
    Walk window control tree and return first (or found_index-th) control matching selector.
    selector: { "type": "ButtonControl", "name": "x" } or { "type": "TabItemControl", "name_contains": "..." } or { "automation_id": "btnStart" }, etc.
    Returns live uiautomation control or None.
    """
    if not window_control:
        return None
    collected: List[Any] = []

    def walk(control, depth: int):
        if depth > max_depth or control is None:
            return
        info = {
            "type": control.ControlTypeName or "",
            "name": (control.Name or "") or "",
            "automation_id": (control.AutomationId or "") or "",
        }
        if _control_matches(control, info, selector):
            collected.append(control)
        for child in control.GetChildren():
            walk(child, depth + 1)

    walk(window_control, 0)
    if not collected:
        return None
    idx = min(max(0, found_index), len(collected) - 1)
    return collected[idx]


# ---------------------------------------------------------------------------
# Operate by spec
# ---------------------------------------------------------------------------

def operate_by_spec(
    window_control: Any,
    spec: Dict[str, Any],
    clicker: Optional[ClickHandler] = None,
    click_params: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Find control by spec["target"] and run spec["action"] (invoke | select | click).
    spec = { "action": "invoke"|"select"|"click", "target": selector_dict, optional "target_index": 0 }
    Returns True if action succeeded.
    """
    target = spec.get("target") or spec.get("selector")
    if not target:
        ColorPrint.yellow("[UI_ANALYSIS] operate_by_spec: missing target/selector")
        return False
    action = (spec.get("action") or "invoke").strip().lower()
    found_index = spec.get("target_index", 0)

    control = find_control_in_window(window_control, target, max_depth=12, found_index=found_index)
    if not control:
        ColorPrint.yellow(f"[UI_ANALYSIS] operate_by_spec: no control found for target {target}")
        return False

    params = dict(click_params or {})
    c = clicker if clicker is not None else get_click_handler()
    type_hint = (target.get("type") or "").strip()

    if action == "invoke":
        return operate_button(control, clicker=c, **params)
    if action == "select":
        return operate_tab_item(control, clicker=c, **params)
    if action == "click":
        return click_at_control_rect(control, clicker=c, **params)
    return operate_control(control, control_type_hint=type_hint, clicker=c, **params)


def run_sequence(
    window_control: Any,
    sequence: List[Dict[str, Any]],
    clicker: Optional[ClickHandler] = None,
    click_params: Optional[Dict[str, Any]] = None,
    delay_after_step: float = 0.3,
) -> List[bool]:
    """
    Run a list of operation specs in order. Returns list of success flags.
    Each item: { "action": "invoke"|"select"|"click", "target": selector }
    """
    results = []
    for i, spec in enumerate(sequence):
        ok = operate_by_spec(window_control, spec, clicker=clicker, click_params=click_params)
        results.append(ok)
        if i < len(sequence) - 1 and delay_after_step > 0:
            time.sleep(delay_after_step)
    return results


# ---------------------------------------------------------------------------
# ROSBOT: use hardcoded structure from rosbot_ui_structure (no file load)
# ---------------------------------------------------------------------------

def run_rosbot_resume_sequence(
    window_control: Any,
    sequence: Optional[List[Dict[str, Any]]] = None,
    clicker: Optional[ClickHandler] = None,
    click_params: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Run ROSBOT resume: main profile tab + start botting. Uses sequence if provided, else built-in from rosbot_ui_structure.
    Returns True if at least one step succeeded.
    """
    if sequence is None:
        sequence = get_resume_sequence()
    results = run_sequence(window_control, sequence, clicker=clicker, click_params=click_params, delay_after_step=0.3)
    return any(results)
