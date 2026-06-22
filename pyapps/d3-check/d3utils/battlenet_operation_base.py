# -*- coding: utf-8 -*-
"""
Battle.net operation base: shared process/window, UI enumeration, control find/click.
No region-specific logic; Asia/CN implementations live in battlenet_operation_asia and battlenet_operation_cn.
"""
import time
import json
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple, Set

from pycore.pyfoundations.color_print import ColorPrint
from d3utils.click_handler_singleton import get_click_handler
from pycore.pyfoundations.third_party import (
    get_third_package_pythoncom,
    get_third_package_uiautomation,
)
from providor.providor_index import get_config_value_safe
from d3utils.battlenet_manager import get_battlenet_manager
from d3utils.battlenet_ui_inspector import (
    is_main_window_close_button,
    is_popup_close_button_by_automation_id,
    is_popup_close_button_by_name,
)
from d3utils.ui_control_operations import operate_button, try_set_focus, try_set_value
from providor.constants.common import (
    BN_FLOW_SNAPSHOTS_DIR,
    DEBUG_SAVE_BN_FLOW_UI_SNAPSHOTS,
    BN_CLICK_MOVE_DURATION_SEC,
    BN_CLICK_PAUSE_AFTER_MOVE_SEC,
    BATTLE_NET_DISCONNECT_AUTOMATION_IDS,
    BATTLE_NET_DISCONNECT_KEYWORDS,
    BATTLE_NET_BROWSER_LOGIN_WAIT_AUTOMATION_IDS,
    BATTLE_NET_BROWSER_LOGIN_WAIT_MAIN_KEYWORDS,
    BATTLE_NET_LOGIN_FAILED_PRIMARY_AUTOMATION_IDS,
    BATTLE_NET_LOGIN_FAILED_SECONDARY_AUTOMATION_IDS,
    BATTLE_NET_LOGIN_FAILED_KEYWORDS,
    BATTLE_NET_LOADING_INDICATOR_CONTROL_TYPE,
    BATTLE_NET_LOADING_INDICATOR_NAME_SUBSTRINGS,
)

pythoncom = get_third_package_pythoncom()
uiautomation = get_third_package_uiautomation()

UIA_IS_OFFSCREEN_PROPERTY_ID = 10022

_BN_CONTROLS_LIGHT_CACHE: Dict[str, Any] = {"controls": None, "time": 0.0, "hwnd": None}
BN_CONTROLS_LIGHT_CACHE_TTL_SEC = 2.0

_login_failed_names: Optional[Set[str]] = None
_login_failed_ids: Optional[Set[str]] = None
_login_failed_loaded: bool = False


def _ensure_com() -> None:
    if pythoncom is not None:
        try:
            pythoncom.CoInitialize()
        except Exception:
            pass


def _safe_control_dict_light(control) -> Optional[Dict[str, Any]]:
    try:
        name = (control.Name or "").strip()
        aid = (control.AutomationId or "").strip()
        try:
            is_enabled = control.IsEnabled
        except Exception:
            is_enabled = None
        try:
            is_offscreen = control.GetCurrentPropertyValue(UIA_IS_OFFSCREEN_PROPERTY_ID)
        except Exception:
            is_offscreen = None
        return {
            "name": name,
            "automation_id": aid,
            "is_enabled": is_enabled,
            "is_offscreen": is_offscreen,
        }
    except Exception:
        return None


def _safe_control_dict(control) -> Optional[Dict[str, Any]]:
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


def _rect_center(rect: Dict[str, Any]) -> tuple:
    left = rect.get("left", 0)
    top = rect.get("top", 0)
    w = rect.get("width", 0)
    h = rect.get("height", 0)
    return (left + w // 2, top + h // 2)


def play_button_indicates_starting(ctrl: Dict[str, Any]) -> bool:
    """True if Play control indicates game starting or running."""
    name = (ctrl.get("name") or "").strip()
    if "Playing Now" in name or "\u6b63\u5728" in name:
        return True
    is_enabled = ctrl.get("is_enabled")
    if is_enabled is not None:
        return not bool(is_enabled)
    return False


def _load_login_failed_features_from_snapshots() -> Tuple[Set[str], Set[str]]:
    global _login_failed_names, _login_failed_ids, _login_failed_loaded
    if _login_failed_loaded:
        return (_login_failed_names or set(), _login_failed_ids or set())
    _login_failed_loaded = True
    names: Set[str] = set()
    ids: Set[str] = set()
    base = BN_FLOW_SNAPSHOTS_DIR
    if not base.is_dir():
        _login_failed_names = names
        _login_failed_ids = ids
        return (names, ids)
    for path in sorted(base.glob("bn_flow_*.json"), reverse=True):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue
        controls = data.get("controls") if isinstance(data, dict) else []
        if not controls:
            continue
        for c in controls:
            name = (c.get("name") or "").strip()
            aid = (c.get("automation_id") or "").strip()
            for kw in BATTLE_NET_LOGIN_FAILED_KEYWORDS:
                if kw and kw in name:
                    names.add(name)
                if kw and kw in aid:
                    ids.add(aid)
    _login_failed_names = names
    _login_failed_ids = ids
    if names or ids:
        ColorPrint.gray("[BattlenetOperation] login-failed features from snapshots: %d names, %d automation_ids" % (len(names), len(ids)))
    return (names, ids)


class BattlenetOperationBase:
    """
    Shared Battle.net operations: start, close, restart, activate, enumerate controls,
    find/click/focus/set_value, try_close_popup, save snapshot, login-failed/disconnect/browser-wait detection.
    """

    def __init__(self, elements_json_path: Optional[Path] = None):
        self._elements_json_path = elements_json_path or self._default_elements_json_path()
        self._clicker = get_click_handler()

    @staticmethod
    def _default_elements_json_path() -> Path:
        base = Path(__file__).resolve().parent.parent
        return base / "docs" / "battlenet_post_login_elements.json"

    def start(self) -> bool:
        mgr = get_battlenet_manager()
        path = mgr.get_path()
        if not path:
            ColorPrint.red("[BattlenetOperation] Battle.net path not configured")
            return False
        return mgr.start(path)

    def close(self) -> bool:
        return get_battlenet_manager().kill()

    def restart(self, wait_after_sec: float = 2.0) -> bool:
        return get_battlenet_manager().restart(wait_after_sec=wait_after_sec)

    def activate_window(self) -> bool:
        return get_battlenet_manager().activate_window()

    def _find_loading_indicator_by_structure(self) -> Optional[Dict[str, Any]]:
        """Find first control matching reference structure: type=TextControl, name contains loading substring (EN/CN). One walk, return on first match."""
        root = self._get_root_control()
        if not root:
            return None
        subs = BATTLE_NET_LOADING_INDICATOR_NAME_SUBSTRINGS
        type_ok = (BATTLE_NET_LOADING_INDICATOR_CONTROL_TYPE, "Text")
        found: List[Optional[Dict[str, Any]]] = [None]

        def walk(control, depth: int = 0):
            if depth > 25 or found[0] is not None:
                return
            try:
                ctype = (control.ControlTypeName or "").strip()
                name = (control.Name or "").strip()
                if ctype in type_ok:
                    for sub in subs:
                        if sub and sub in name:
                            info = _safe_control_dict(control)
                            if info:
                                found[0] = info
                            return
                for child in control.GetChildren():
                    walk(child, depth + 1)
            except Exception:
                pass

        walk(root)
        return found[0]

    def is_loading_ui_visible(self) -> bool:
        """True if BN shows 载入中 UI (structure: TextControl + loading name). Tick-driven: call once per tick."""
        return self._find_loading_indicator_by_structure() is not None

    def _has_loading_indicator(self, controls: List[Dict[str, Any]]) -> bool:
        """True if any control matches BN loading UI: type TextControl and name contains loading substring (EN/CN)."""
        subs = BATTLE_NET_LOADING_INDICATOR_NAME_SUBSTRINGS
        type_ok = (BATTLE_NET_LOADING_INDICATOR_CONTROL_TYPE, "Text")
        for c in controls or []:
            ctype = (c.get("type") or "").strip()
            if ctype not in type_ok:
                continue
            name = (c.get("name") or "").strip()
            for sub in subs:
                if sub and sub in name:
                    return True
        return False

    def _enumerate_controls(self) -> List[Dict[str, Any]]:
        _ensure_com()
        if not uiautomation:
            return []
        windows = get_battlenet_manager().find_windows()
        if not windows:
            return []
        hwnd = int(windows[0]["hwnd"])
        try:
            root = uiautomation.ControlFromHandle(hwnd)
            if not root.Exists():
                return []
        except Exception as e:
            ColorPrint.yellow(f"[BattlenetOperation] ControlFromHandle failed: {e}")
            return []
        collected: List[Dict[str, Any]] = []

        def walk(control, depth: int = 0):
            if depth > 25:
                return
            info = _safe_control_dict(control)
            if info:
                info["level"] = depth
                collected.append(info)
            try:
                for child in control.GetChildren():
                    walk(child, depth + 1)
            except Exception:
                pass

        walk(root)
        return collected

    def _enumerate_controls_light(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        global _BN_CONTROLS_LIGHT_CACHE
        windows = get_battlenet_manager().find_windows()
        if not windows:
            return []
        hwnd = int(windows[0]["hwnd"])
        now = time.monotonic()
        if not force_refresh and (
            _BN_CONTROLS_LIGHT_CACHE["hwnd"] == hwnd
            and _BN_CONTROLS_LIGHT_CACHE["controls"] is not None
            and (now - _BN_CONTROLS_LIGHT_CACHE["time"]) < BN_CONTROLS_LIGHT_CACHE_TTL_SEC
        ):
            return _BN_CONTROLS_LIGHT_CACHE["controls"]
        _ensure_com()
        if not uiautomation:
            return []
        try:
            root = uiautomation.ControlFromHandle(hwnd)
            if not root.Exists():
                return []
        except Exception as e:
            ColorPrint.yellow(f"[BattlenetOperation] ControlFromHandle failed: {e}")
            return []
        collected: List[Dict[str, Any]] = []

        def walk(control, depth: int = 0):
            if depth > 25:
                return
            info = _safe_control_dict_light(control)
            if info:
                collected.append(info)
            try:
                for child in control.GetChildren():
                    walk(child, depth + 1)
            except Exception:
                pass

        walk(root)
        _BN_CONTROLS_LIGHT_CACHE["controls"] = collected
        _BN_CONTROLS_LIGHT_CACHE["time"] = now
        _BN_CONTROLS_LIGHT_CACHE["hwnd"] = hwnd
        return collected

    def _get_root_control(self):
        _ensure_com()
        if not uiautomation:
            return None
        windows = get_battlenet_manager().find_windows()
        if not windows:
            return None
        hwnd = int(windows[0]["hwnd"])
        try:
            root = uiautomation.ControlFromHandle(hwnd)
            return root if root.Exists() else None
        except Exception as e:
            ColorPrint.yellow(f"[BattlenetOperation] ControlFromHandle failed: {e}")
            return None

    def _find_raw_control_by_automation_id(self, automation_id_substr: str):
        root = self._get_root_control()
        if not root or not automation_id_substr:
            return None
        found = [None]

        def walk(control, depth: int = 0):
            if depth > 25 or found[0] is not None:
                return
            try:
                aid = (control.AutomationId or "").strip()
                if automation_id_substr in aid:
                    found[0] = control
                    return
                for child in control.GetChildren():
                    walk(child, depth + 1)
            except Exception:
                pass

        walk(root)
        return found[0]

    def _find_raw_control_by_name_and_type(
        self, name_substrings: Tuple[str, ...], control_type_name: str = "CheckBoxControl"
    ):
        root = self._get_root_control()
        if not root or not name_substrings:
            return None
        found = [None]

        def walk(control, depth: int = 0):
            if depth > 25 or found[0] is not None:
                return
            try:
                name = (control.Name or "").strip()
                ctype = (control.ControlTypeName or "").strip()
                if control_type_name.lower() in ctype.lower():
                    for sub in name_substrings:
                        if sub and sub in name:
                            found[0] = control
                            return
                for child in control.GetChildren():
                    walk(child, depth + 1)
            except Exception:
                pass

        walk(root)
        return found[0]

    def _find_raw_control_matching(self, control_dict: Dict[str, Any]):
        root = self._get_root_control()
        if not root or not control_dict:
            return None
        want_aid = (control_dict.get("automation_id") or "").strip()
        want_name = (control_dict.get("name") or "").strip()
        found = [None]

        def walk(control, depth: int = 0):
            if depth > 25 or found[0] is not None:
                return
            try:
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
            except Exception:
                pass

        walk(root)
        return found[0]

    def click_control(self, control: Dict[str, Any], require_clickable: bool = False) -> bool:
        if require_clickable and control.get("is_clickable") is not True:
            ColorPrint.gray("[BattlenetOperation] click_control: control not clickable, skip")
            return False
        self.activate_window()
        time.sleep(0.2)
        raw = self._find_raw_control_matching(control)
        if raw is not None:
            if operate_button(raw, clicker=self._clicker, prefer_invoke=True):
                return True
        rect = control.get("rect")
        if not rect:
            return False
        cx, cy = _rect_center(rect)
        if (cx <= 0 and cy <= 0) or (rect.get("width") or 0) <= 0 or (rect.get("height") or 0) <= 0:
            ColorPrint.gray("[BattlenetOperation] click_control: rect invalid, skip")
            return False
        return self._clicker.click(cx, cy, direct_click=True, return_to_original=True,
                                   duration=BN_CLICK_MOVE_DURATION_SEC, pause_after_move=BN_CLICK_PAUSE_AFTER_MOVE_SEC)

    def focus_control(self, control: Dict[str, Any]) -> bool:
        self.activate_window()
        time.sleep(0.2)
        raw = self._find_raw_control_matching(control)
        if raw is not None and try_set_focus(raw):
            return True
        return self.click_control(control)

    def set_control_value(self, control: Dict[str, Any], value: str) -> bool:
        if not value:
            return True
        raw = self._find_raw_control_matching(control)
        if raw is not None and try_set_value(raw, value):
            return True
        return False

    def find_control_by_name(self, name_substrings: tuple, controls: Optional[List[Dict]] = None) -> Optional[Dict[str, Any]]:
        if controls is None:
            controls = self._enumerate_controls()
        name_substrings = tuple(s for s in name_substrings if s)
        for c in controls:
            name = (c.get("name") or "").strip()
            for sub in name_substrings:
                if sub and sub in name:
                    return c
        return None

    def find_control_by_automation_id(
        self,
        automation_id_substr: str,
        controls: Optional[List[Dict]] = None,
        exact_match: bool = False,
    ) -> Optional[Dict[str, Any]]:
        if controls is None:
            controls = self._enumerate_controls()
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

    def _has_control_automation_id_containing_any(
        self, controls: List[Dict[str, Any]], automation_id_substrings: Tuple[str, ...]
    ) -> bool:
        for c in controls:
            aid = (c.get("automation_id") or "").strip()
            for sub in automation_id_substrings:
                if sub and sub in aid:
                    return True
        return False

    def get_clickable_buttons(self, controls: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
        if controls is None:
            controls = self._enumerate_controls()
        out = []
        for c in controls:
            ctype = (c.get("type") or "").strip().lower()
            if "button" not in ctype:
                continue
            if c.get("is_clickable") is not True:
                continue
            out.append(c)
        return out

    def try_close_popup(self) -> bool:
        controls = self._enumerate_controls()
        for c in controls:
            if (c.get("type") or "") != "ButtonControl":
                continue
            aid = (c.get("automation_id") or "").strip()
            if is_main_window_close_button(aid):
                continue
            if is_popup_close_button_by_automation_id(aid):
                ColorPrint.blue("[BattlenetOperation] Closing in-UI popup: automation_id=%s" % aid)
                return self.click_control(c)
        for c in controls:
            if (c.get("type") or "") != "ButtonControl":
                continue
            aid = (c.get("automation_id") or "").strip()
            if is_main_window_close_button(aid):
                continue
            name = (c.get("name") or "").strip()
            if is_popup_close_button_by_name(name):
                ColorPrint.blue("[BattlenetOperation] Closing in-UI popup: name=%s" % name)
                return self.click_control(c)
        return False

    def save_ui_elements_snapshot(self, node_name: str, reason: str) -> Optional[Path]:
        if not DEBUG_SAVE_BN_FLOW_UI_SNAPSHOTS:
            return None
        controls = self._enumerate_controls()
        base = BN_FLOW_SNAPSHOTS_DIR
        try:
            base.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            ColorPrint.yellow("[BattlenetOperation] save_ui_elements_snapshot mkdir: %s" % e)
            return None
        safe_node = (node_name or "unknown").replace(" ", "_")
        path = base / ("bn_flow_%s.json" % safe_node)
        payload = {
            "meta": {"node": node_name, "reason": reason},
            "controls": [{"name": c.get("name"), "automation_id": c.get("automation_id"), "type": c.get("type"), "rect": c.get("rect"), "level": c.get("level")} for c in controls],
        }
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            ColorPrint.gray("[BNFlow] UI snapshot saved: %s | reason: %s" % (path.name, reason))
            return path
        except Exception as e:
            ColorPrint.yellow("[BattlenetOperation] save_ui_elements_snapshot write: %s" % e)
            return None

    def is_login_failed_screen(self) -> bool:
        controls = self._enumerate_controls_light()
        if not controls:
            return False
        if self.is_on_browser_login_wait_screen():
            return False
        has_primary = self._has_control_automation_id_containing_any(controls, BATTLE_NET_LOGIN_FAILED_PRIMARY_AUTOMATION_IDS)
        has_secondary = self._has_control_automation_id_containing_any(controls, BATTLE_NET_LOGIN_FAILED_SECONDARY_AUTOMATION_IDS)
        if not has_primary or not has_secondary:
            primary_kw = BATTLE_NET_LOGIN_FAILED_KEYWORDS[:2]
            secondary_kw = BATTLE_NET_LOGIN_FAILED_KEYWORDS[2:4]
            for c in controls:
                name = (c.get("name") or "").strip()
                aid = (c.get("automation_id") or "").strip()
                if not has_primary and (name and any(kw in name for kw in primary_kw if kw) or aid and any(kw in aid for kw in primary_kw if kw)):
                    has_primary = True
                if not has_secondary and (name and any(kw in name for kw in secondary_kw if kw) or aid and any(kw in aid for kw in secondary_kw if kw)):
                    has_secondary = True
        return has_primary and has_secondary

    def is_on_browser_login_wait_screen(self) -> bool:
        controls = self._enumerate_controls_light()
        if not controls:
            return False
        if BATTLE_NET_BROWSER_LOGIN_WAIT_AUTOMATION_IDS and self._has_control_automation_id_containing_any(controls, BATTLE_NET_BROWSER_LOGIN_WAIT_AUTOMATION_IDS):
            return True
        return self.find_control_by_name(BATTLE_NET_BROWSER_LOGIN_WAIT_MAIN_KEYWORDS, controls) is not None

    def is_disconnected(self) -> bool:
        controls = self._enumerate_controls_light()
        if not controls:
            return False
        if BATTLE_NET_DISCONNECT_AUTOMATION_IDS and self._has_control_automation_id_containing_any(controls, BATTLE_NET_DISCONNECT_AUTOMATION_IDS):
            return True
        return self.find_control_by_name(BATTLE_NET_DISCONNECT_KEYWORDS, controls) is not None

    def load_controls_from_docs_json(self) -> Optional[List[Dict]]:
        path = self._elements_json_path
        if not path or not path.is_file():
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data.get("controls") if isinstance(data, dict) else None
        except Exception as e:
            ColorPrint.yellow(f"[BattlenetOperation] Load {path} failed: {e}")
            return None
