# -*- coding: utf-8 -*-
"""
Battle.net operation: start, close, restart, click D3 tab, start game, detect game state.
Reuses BattleNetManager for process/window; UI Automation for control find/click (Chromium Battle.net).
When region (asia/cn) is known at startup, all operations use that region only; when unknown, first detection may try both.
"""
import time
import json
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple, Set

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.click_handler import ClickHandler
from pycore.pyfoundations.third_party import get_third_package_uiautomation, get_third_package_win32gui
from share.game_interface_data import get_game_interface_data
from providor.providor_index import get_config_value_safe
from d3utils.battlenet_manager import get_battlenet_manager
from d3utils.battlenet_asia_ops import BattlenetAsiaOps
from d3utils.battlenet_ui_inspector import (
    is_main_window_close_button,
    is_popup_close_button_by_automation_id,
    is_popup_close_button_by_name,
)
from d3utils.ui_control_operations import operate_button, try_set_focus, try_set_value
from d3utils.battlenet_region_judge import (
    build_judge_from_controls,
    get_asia_d3_automation_ids,
    get_asia_d3_name_keywords,
    get_asia_play_automation_ids,
    get_asia_play_name_keywords,
)
from providor.constants.common import (
    BN_FLOW_SNAPSHOTS_DIR,
    DEBUG_SAVE_BN_FLOW_UI_SNAPSHOTS,
    BN_CLICK_MOVE_DURATION_SEC,
    BN_CLICK_PAUSE_AFTER_MOVE_SEC,
    BATTLE_NET_DISCONNECT_AUTOMATION_IDS,
    BATTLE_NET_DISCONNECT_KEYWORDS,
    BATTLE_NET_NEED_LOGIN_KEYWORDS,
    BATTLE_NET_CN_AGREE_KEYWORDS,
    BATTLE_NET_CN_NETEASE_LOGIN_KEYWORDS,
    BATTLE_NET_CN_LOGIN_BUTTON_AUTOMATION_IDS,
    BATTLE_NET_CN_LOGIN_BUTTON_KEYWORDS,
    BATTLE_NET_CN_AFTER_NETEASE_CLICK_SETTLE_SEC,
    BATTLE_NET_BROWSER_LOGIN_WAIT_AUTOMATION_IDS,
    BATTLE_NET_BROWSER_LOGIN_WAIT_MAIN_KEYWORDS,
    BATTLE_NET_LOGIN_FAILED_PRIMARY_AUTOMATION_IDS,
    BATTLE_NET_LOGIN_FAILED_SECONDARY_AUTOMATION_IDS,
    BATTLE_NET_LOGIN_FAILED_KEYWORDS,
    BATTLE_NET_CONNECTING_AUTOMATION_IDS,
    BATTLE_NET_CONNECTING_KEYWORDS,
    LOGIN_SCREEN_UI_KEYWORDS_STRICT,
    LOGIN_SCREEN_UI_KEYWORDS,
    LOGIN_WINDOW_AUTOMATION_ID_MARKERS,
)
from providor.constants.d3 import (
    D3_TAB_AUTOMATION_IDS,
    D3_TAB_NAME_KEYWORDS,
    START_GAME_AUTOMATION_IDS,
    START_GAME_NAME_KEYWORDS,
)

win32gui = get_third_package_win32gui()

try:
    import pythoncom
except ImportError:
    pythoncom = None


def _resolve_battlenet_region() -> Optional[str]:
    """Resolve current Battle.net region: game_interface_data first, then config cache. Flow uses one region once known."""
    try:
        r = get_game_interface_data().get_battlenet_region()
        if r is not None:
            return r
        cached = get_config_value_safe("ros_settings.battlenet_region_cache")
        return cached if cached in ("asia", "cn") else None
    except Exception:
        return None

# Login-failed features loaded from bn_flow_*.json snapshots (EN/CN dynamic UI)
_login_failed_names: Optional[Set[str]] = None
_login_failed_ids: Optional[Set[str]] = None
_login_failed_loaded: bool = False

def _load_login_failed_features_from_snapshots() -> Tuple[Set[str], Set[str]]:
    """Load bn_flow_*.json; extract control name/automation_id that contain any BATTLE_NET_LOGIN_FAILED_KEYWORDS."""
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


def _ensure_com() -> None:
    if pythoncom is not None:
        try:
            pythoncom.CoInitialize()
        except Exception:
            pass


UIA_IS_OFFSCREEN_PROPERTY_ID = 10022


def _safe_control_dict_light(control) -> Optional[Dict[str, Any]]:
    """Light dict for state judgment: name, automation_id, is_enabled, is_offscreen. Skips BoundingRectangle/ControlTypeName."""
    try:
        name = (control.Name or "").strip()
        aid = (control.AutomationId or "").strip()
        try:
            is_enabled = control.IsEnabled
        except Exception:
            is_enabled = None
        try:
            is_offscreen = getattr(control, "IsOffscreen", None)
            if is_offscreen is None and hasattr(control, "GetCurrentPropertyValue"):
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
            is_offscreen = getattr(control, "IsOffscreen", None)
            if is_offscreen is None and hasattr(control, "GetCurrentPropertyValue"):
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


def _play_button_indicates_starting(ctrl: Dict[str, Any]) -> bool:
    """True if Play control indicates game starting or running (disabled or name Playing Now / in-game label)."""
    name = (ctrl.get("name") or "").strip()
    if "Playing Now" in name or "\u6b63\u5728" in name:  # "正在" in-game
        return True
    is_enabled = ctrl.get("is_enabled")
    if is_enabled is not None:
        return not bool(is_enabled)
    return False


# Short TTL cache for UI controls so same-tick BN flow reuses refresh result (one read per tick).
_BN_CONTROLS_LIGHT_CACHE: Dict[str, Any] = {"controls": None, "time": 0.0, "hwnd": None}
BN_CONTROLS_LIGHT_CACHE_TTL_SEC = 2.0


class BattlenetOperation:
    """
    Battle.net operation: start, close, restart, activate window, click D3 tab, start game, detect state.
    When region (asia/cn) is set, only that region's UI path is used; when None, first detection may try both.
    """

    def __init__(self, elements_json_path: Optional[Path] = None, region: Optional[str] = None):
        self._elements_json_path = elements_json_path or self._default_elements_json_path()
        self._clicker = ClickHandler()
        self._asia_ops = BattlenetAsiaOps(self)
        self._region = region if region in ("asia", "cn") else _resolve_battlenet_region() if region is None else None

    @staticmethod
    def _default_elements_json_path() -> Path:
        """Path to battlenet elements JSON under docs (filename may be CN)."""
        base = Path(__file__).resolve().parent.parent
        return base / "docs" / "battlenet_post_login_elements.json"

    def start(self) -> bool:
        """Start Battle.net. Reuses BattleNetManager.start()."""
        mgr = get_battlenet_manager()
        path = mgr.get_path()
        if not path:
            ColorPrint.red("[BattlenetOperation] Battle.net path not configured")
            return False
        return mgr.start(path)

    def close(self) -> bool:
        """Close Battle.net process. Reuses BattleNetManager.kill()."""
        return get_battlenet_manager().kill()

    def restart(self, wait_after_sec: float = 2.0) -> bool:
        """Kill then start after wait. Reuses BattleNetManager.restart()."""
        return get_battlenet_manager().restart(wait_after_sec=wait_after_sec)

    def activate_window(self) -> bool:
        """Bring Battle.net window to foreground."""
        return get_battlenet_manager().activate_window()

    def _enumerate_controls(self) -> List[Dict[str, Any]]:
        """Enumerate Battle.net window UI Automation controls; CoInitialize in current thread first."""
        _ensure_com()
        auto = get_third_package_uiautomation()
        if not auto:
            return []
        windows = get_battlenet_manager().find_windows()
        if not windows:
            return []
        hwnd = int(windows[0]["hwnd"])
        try:
            root = auto.ControlFromHandle(hwnd)
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

    def _enumerate_controls_light(self) -> List[Dict[str, Any]]:
        """Enumerate name, automation_id, is_enabled, is_offscreen (for get_dynamic_state). Skips BoundingRectangle/ControlTypeName.
        Uses module-level cache for BN_CONTROLS_LIGHT_CACHE_TTL_SEC so same-tick BN flow reuses one read."""
        global _BN_CONTROLS_LIGHT_CACHE
        windows = get_battlenet_manager().find_windows()
        if not windows:
            return []
        hwnd = int(windows[0]["hwnd"])
        now = time.monotonic()
        if (
            _BN_CONTROLS_LIGHT_CACHE["hwnd"] == hwnd
            and _BN_CONTROLS_LIGHT_CACHE["controls"] is not None
            and (now - _BN_CONTROLS_LIGHT_CACHE["time"]) < BN_CONTROLS_LIGHT_CACHE_TTL_SEC
        ):
            return _BN_CONTROLS_LIGHT_CACHE["controls"]
        _ensure_com()
        auto = get_third_package_uiautomation()
        if not auto:
            return []
        try:
            root = auto.ControlFromHandle(hwnd)
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
        """Get root UI Automation control for Battle.net window, or None."""
        _ensure_com()
        auto = get_third_package_uiautomation()
        if not auto:
            return None
        windows = get_battlenet_manager().find_windows()
        if not windows:
            return None
        hwnd = int(windows[0]["hwnd"])
        try:
            root = auto.ControlFromHandle(hwnd)
            return root if root.Exists() else None
        except Exception as e:
            ColorPrint.yellow(f"[BattlenetOperation] ControlFromHandle failed: {e}")
            return None

    def _find_raw_control_by_automation_id(self, automation_id_substr: str):
        """Traverse from root, return first raw control whose AutomationId contains the given substring."""
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
        """Traverse from root, return first raw control whose Name contains any substring and ControlTypeName matches."""
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
        """Find raw UIA control matching dict. Use exact automation_id match so D3 tab is not confused with D4 (game-nav-btn-D34)."""
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
        """Prefer UI Automation Invoke (no mouse); fallback to click at control rect center.
        When require_clickable=True, skip click and return False if control is not clickable (enabled, visible)."""
        if require_clickable and control.get("is_clickable") is not True:
            ColorPrint.gray("[BattlenetOperation] click_control: control not clickable (enabled=%s, offscreen=%s), skip" % (
                control.get("is_enabled"), control.get("is_offscreen")))
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
        return self._clicker.click(cx, cy, direct_click=True, return_to_original=True,
                                   duration=BN_CLICK_MOVE_DURATION_SEC, pause_after_move=BN_CLICK_PAUSE_AFTER_MOVE_SEC)

    def focus_control(self, control: Dict[str, Any]) -> bool:
        """Prefer UIA SetFocus (no mouse); fallback to click_control for focus."""
        self.activate_window()
        time.sleep(0.2)
        raw = self._find_raw_control_matching(control)
        if raw is not None and try_set_focus(raw):
            return True
        return self.click_control(control)

    def set_control_value(self, control: Dict[str, Any], value: str) -> bool:
        """Set control text via UIA ValuePattern (no keyboard). Returns True if succeeded."""
        if not value:
            return True
        raw = self._find_raw_control_matching(control)
        if raw is not None and try_set_value(raw, value):
            return True
        return False

    def is_control_clickable(self, control: Dict[str, Any]) -> bool:
        """True if control is considered clickable: enabled, not offscreen, valid rect."""
        return control.get("is_clickable") is True

    def get_clickable_buttons(self, controls: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
        """Return list of controls that are ButtonControl and clickable (enabled, visible)."""
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

    def get_controls_state_summary(
        self, controls: Optional[List[Dict[str, Any]]] = None, button_only: bool = False
    ) -> List[Dict[str, Any]]:
        """Return summary of controls with state (name, automation_id, is_enabled, is_offscreen, is_clickable). For debug."""
        if controls is None:
            controls = self._enumerate_controls()
        out = []
        for c in controls:
            if button_only:
                ctype = (c.get("type") or "").strip().lower()
                if "button" not in ctype:
                    continue
            out.append({
                "name": (c.get("name") or "")[:48],
                "automation_id": (c.get("automation_id") or "")[:32],
                "type": (c.get("type") or "")[:24],
                "is_enabled": c.get("is_enabled"),
                "is_offscreen": c.get("is_offscreen"),
                "is_clickable": c.get("is_clickable"),
            })
        return out

    def get_clickable_button_names(self, controls: Optional[List[Dict[str, Any]]] = None) -> List[str]:
        """Return list of (name, automation_id) of buttons that are clickable. For display/logging."""
        buttons = self.get_clickable_buttons(controls)
        return [(c.get("name") or "", c.get("automation_id") or "") for c in buttons]

    def find_control_by_name(self, name_substrings: tuple, controls: Optional[List[Dict]] = None) -> Optional[Dict[str, Any]]:
        """Find control by name containing any of the given substrings. If controls is None, enumerate live."""
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
        """Find control by AutomationId. If exact_match=True, aid must equal; else aid may contain substring (avoid e.g. game-nav-btn-D34 matching game-nav-btn-D3)."""
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
        """True if any control's automation_id contains any of the given substrings."""
        for c in controls:
            aid = (c.get("automation_id") or "").strip()
            for sub in automation_id_substrings:
                if sub and sub in aid:
                    return True
        return False

    def try_close_popup(self) -> bool:
        """If an in-UI popup Close button is present, click it. Does NOT click the main window title-bar close (login/client X)."""
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

    def click_d3_tab(self) -> bool:
        """Click D3 game tab. Use exact automation_id match so game-nav-btn-D34 (D4) is not matched by game-nav-btn-D3."""
        controls = self._enumerate_controls()
        if self._region != "cn":
            if controls:
                for aid in get_asia_d3_automation_ids():
                    ctrl = self.find_control_by_automation_id(aid, controls, exact_match=True)
                    if ctrl:
                        ColorPrint.blue("[BattlenetOperation] Asia Click D3 tab: automation_id=%s" % aid)
                        return self.click_control(ctrl)
                ctrl = self.find_control_by_name(get_asia_d3_name_keywords(), controls)
                if ctrl and "Playing Now" not in (ctrl.get("name") or "") and "Game Version" not in (ctrl.get("name") or ""):
                    ColorPrint.blue("[BattlenetOperation] Asia Click D3 tab: name=%s" % ctrl.get("name"))
                    return self.click_control(ctrl)
            if self._region == "asia":
                ColorPrint.yellow("[BattlenetOperation] D3 tab control not found (Asia)")
                return False
        for aid in D3_TAB_AUTOMATION_IDS:
            ctrl = self.find_control_by_automation_id(aid, controls if controls else None, exact_match=True)
            if ctrl:
                ColorPrint.blue("[BattlenetOperation] CN Click D3 tab: automation_id=%s" % aid)
                return self.click_control(ctrl)
        ctrl = self.find_control_by_name(D3_TAB_NAME_KEYWORDS, controls)
        if not ctrl:
            ColorPrint.yellow("[BattlenetOperation] D3 tab control not found")
            return False
        if "Playing Now" in (ctrl.get("name") or "") or "Game Version" in (ctrl.get("name") or ""):
            return False
        ColorPrint.blue("[BattlenetOperation] CN Click D3 tab: name=%s" % ctrl.get("name"))
        return self.click_control(ctrl)

    def click_start_game(self) -> bool:
        """Click start game button. When region is bound use only that region; otherwise try Asia then CN."""
        controls = self._enumerate_controls()
        if self._region != "cn":
            if controls:
                for aid in get_asia_play_automation_ids():
                    ctrl = self.find_control_by_automation_id(aid, controls)
                    if ctrl:
                        ColorPrint.blue("[BattlenetOperation] Asia Click start game: automation_id=%s" % aid)
                        return self.click_control(ctrl)
                ctrl = self.find_control_by_name(get_asia_play_name_keywords(), controls)
                if ctrl:
                    ColorPrint.blue("[BattlenetOperation] Asia Click start game: name=%s" % ctrl.get("name"))
                    return self.click_control(ctrl)
            if self._region == "asia":
                ColorPrint.yellow("[BattlenetOperation] Start game button not found (Asia)")
                return False
        for aid in START_GAME_AUTOMATION_IDS:
            ctrl = self.find_control_by_automation_id(aid, controls if controls else None)
            if ctrl:
                ColorPrint.blue("[BattlenetOperation] CN Click start game: automation_id=%s" % aid)
                return self.click_control(ctrl)
        ctrl = self.find_control_by_name(START_GAME_NAME_KEYWORDS, controls)
        if not ctrl:
            ColorPrint.yellow("[BattlenetOperation] Start game button not found")
            return False
        ColorPrint.blue("[BattlenetOperation] CN Click start game: name=%s" % ctrl.get("name"))
        return self.click_control(ctrl)

    def is_game_starting(self) -> bool:
        """True if game is starting or already running. When region bound check only that region's Play control."""
        controls = self._enumerate_controls_light()
        if self._region != "cn":
            for aid in get_asia_play_automation_ids():
                ctrl = self.find_control_by_automation_id(aid, controls)
                if ctrl:
                    return _play_button_indicates_starting(ctrl)
            if self._region == "asia":
                return False
        for aid in START_GAME_AUTOMATION_IDS:
            ctrl = self.find_control_by_automation_id(aid, controls)
            if ctrl:
                return _play_button_indicates_starting(ctrl)
        ctrl = self.find_control_by_name(START_GAME_NAME_KEYWORDS, controls)
        if not ctrl:
            return False
        return _play_button_indicates_starting(ctrl)

    def _get_checkbox_toggle_state(self, raw_control) -> Optional[int]:
        """
        Read checkbox ToggleState: 1 = On (checked), 0 = Off. Returns None if not readable.
        Tries TogglePattern first, then GetCurrentPropertyValue(30096) (UIA ToggleStateProperty).
        """
        try:
            toggle_pattern = raw_control.GetPattern(10014)
            if toggle_pattern is not None:
                if hasattr(toggle_pattern, "ToggleState"):
                    return int(toggle_pattern.ToggleState)
                if hasattr(toggle_pattern, "GetToggleState"):
                    return int(toggle_pattern.GetToggleState())
        except Exception:
            pass
        try:
            if hasattr(raw_control, "GetCurrentPropertyValue"):
                val = raw_control.GetCurrentPropertyValue(30096)
                if val is not None:
                    return int(val)
        except Exception:
            pass
        return None

    def _ensure_checkbox_checked_by_state(self, raw_control) -> bool:
        """
        Confirm checkbox is checked: read state, only click when Off (0). Single click when state unknown.
        Use when TogglePattern is not available; avoids double-click (which could uncheck).
        """
        state = self._get_checkbox_toggle_state(raw_control)
        if state == 1:
            ColorPrint.blue("[BattlenetOperation] Agree checkbox already checked (confirm by state)")
            return True
        try:
            if operate_button(raw_control, clicker=self._clicker, prefer_invoke=True):
                time.sleep(0.2)
            else:
                return False
            if state is None:
                ColorPrint.blue("[BattlenetOperation] Agree checkbox clicked once (fallback; state unknown)")
            else:
                ColorPrint.blue("[BattlenetOperation] Agree checkbox confirmed checked (was Off, clicked once)")
            return True
        except Exception as e:
            ColorPrint.red(f"[BattlenetOperation] Agree checkbox click failed: {e}")
            return False

    def _ensure_agree_checkbox_checked(self) -> bool:
        """
        Ensure the agreement checkbox is checked (confirm state, not double-click).
        Find by automation_id legalAcceptance first; fallback: name containing BATTLE_NET_CN_AGREE_KEYWORDS + type CheckBox.
        """
        raw = self._find_raw_control_by_automation_id("legalAcceptance")
        if not raw:
            raw = self._find_raw_control_by_name_and_type(BATTLE_NET_CN_AGREE_KEYWORDS, "CheckBoxControl")
            if raw:
                ColorPrint.blue("[BattlenetOperation] Agree checkbox found by name (fallback)")
        if not raw:
            ColorPrint.yellow("[BattlenetOperation] legalAcceptance checkbox not found (automation_id and name fallback)")
            return False
        try:
            # UIA TogglePatternId = 10014; ToggleState 1 = On (checked), 0 = Off
            toggle_pattern = raw.GetPattern(10014)
            if toggle_pattern is not None:
                state = self._get_checkbox_toggle_state(raw)
                if state is not None and state != 1:
                    toggle_pattern.Toggle()
                    time.sleep(0.2)
                ColorPrint.blue("[BattlenetOperation] Agree checkbox ensured checked (TogglePattern)")
                return True
        except Exception as e:
            ColorPrint.gray(f"[BattlenetOperation] TogglePattern not used: {e}")
        return self._ensure_checkbox_checked_by_state(raw)

    def _click_netease_login_button(self) -> bool:
        """Click NetEase login/register button (automation_id ntes or name)."""
        ctrl = self.find_control_by_automation_id("ntes")
        if ctrl:
            ColorPrint.blue("[BattlenetOperation] Click NetEase login: automation_id=ntes")
            return self.click_control(ctrl)
        ctrl = self.find_control_by_name(BATTLE_NET_CN_NETEASE_LOGIN_KEYWORDS)
        if ctrl:
            ColorPrint.blue("[BattlenetOperation] Click NetEase login: by name")
            return self.click_control(ctrl)
        ColorPrint.yellow("[BattlenetOperation] NetEase login button not found")
        return False

    def perform_cn_login_flow(self, wait_after_netease_sec: float = BATTLE_NET_CN_AFTER_NETEASE_CLICK_SETTLE_SEC) -> bool:
        """
        CN login flow on login screen: ensure agreement checkbox checked, then click NetEase login/register.
        Web agreement is not waited here; BN_Login2 polls is_oauth_done() each 2s tick until 30s timeout.
        """
        self.activate_window()
        time.sleep(0.2)
        if not self._ensure_agree_checkbox_checked():
            return False
        time.sleep(0.2)
        if not self._click_netease_login_button():
            return False
        ColorPrint.blue("[BattlenetOperation] Web agreement: polled each 2s tick, 30s timeout (BN_Login2)")
        time.sleep(wait_after_netease_sec)
        return True

    def agree_login(self) -> bool:
        """Click agree on login screen. Delegates to _ensure_agree_checkbox_checked + _click_netease_login_button via perform_cn_login_flow."""
        return self.perform_cn_login_flow()

    def click_cn_login_button(self) -> bool:
        """Click the final Login button (CN web agreement). Prefer automation_id, fallback name."""
        controls = self._enumerate_controls()
        for aid in BATTLE_NET_CN_LOGIN_BUTTON_AUTOMATION_IDS:
            ctrl = self.find_control_by_automation_id(aid, controls)
            if ctrl:
                ColorPrint.blue("[BattlenetOperation] Click Login button: automation_id=%s" % aid)
                return self.click_control(ctrl)
        keywords = BATTLE_NET_CN_LOGIN_BUTTON_KEYWORDS + ("Login",)
        ctrl = self.find_control_by_name(keywords, controls)
        if not ctrl:
            ColorPrint.yellow("[BattlenetOperation] Login button (UI) not found")
            return False
        ColorPrint.blue("[BattlenetOperation] Click Login button: name=%s" % ctrl.get("name"))
        return self.click_control(ctrl)

    def click_confirm_login(self) -> bool:
        """Click confirm login (CN flow final step). Uses UI only."""
        return self.click_cn_login_button()

    def is_login_screen_ready(self) -> bool:
        """True when login screen is ready for interaction. Use automation_id only (legalAcceptance or ntes)."""
        controls = self._enumerate_controls_light()
        if not controls:
            return False
        has_agree_id = self.find_control_by_automation_id("legalAcceptance", controls) is not None
        has_netease_id = self.find_control_by_automation_id("ntes", controls) is not None
        return has_agree_id or has_netease_id

    def get_dynamic_state(self, preferred_region: Optional[str] = None) -> Tuple[bool, bool, bool, Optional[str], bool, Optional[str]]:
        """Return (on_login_screen, disconnected, normal_available, play_button_name, connecting, region_detected).
        Uses bound region when preferred_region not given; when region known only that region is tried.
        Uses lightweight enum (name, automation_id, is_enabled, is_offscreen); skips BoundingRectangle/ControlTypeName."""
        controls = self._enumerate_controls_light()
        region = preferred_region if preferred_region in ("asia", "cn") else self._region
        judge = build_judge_from_controls(controls, region)
        return judge.get_dynamic_state_result()

    def save_ui_elements_snapshot(self, node_name: str, reason: str) -> Optional[Path]:
        """
        Save current Battle.net UI elements to JSON under BN_FLOW_SNAPSHOTS_DIR (app_constants).
        Filename: fixed step name only, bn_flow_{node}.json (no timestamp). Meta: node, reason; body: controls list.
        When DEBUG_SAVE_BN_FLOW_UI_SNAPSHOTS is False, skips enumeration and write (no disk I/O, no extra UI read).
        """
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

    def is_on_login_screen(self) -> bool:
        """True if Battle.net is on CN login screen (agree + NetEase). When region is Asia returns False."""
        if self._region == "asia":
            return False
        controls = self._enumerate_controls_light()
        judge = build_judge_from_controls(controls, "cn" if self._region == "cn" else None)
        return judge.is_cn_login_ui()

    def is_on_asia_login_screen(self) -> bool:
        """True if current UI is Asia login (email or password step). When region is CN returns False."""
        if self._region == "cn":
            return False
        controls = self._enumerate_controls_light()
        judge = build_judge_from_controls(controls, "asia" if self._region == "asia" else None)
        return judge.is_asia_login_ui()

    def is_on_asia_email_step(self) -> bool:
        """True if Asia login UI shows email/account step (accountName + Continue)."""
        controls = self._enumerate_controls_light()
        judge = build_judge_from_controls(controls)
        return judge.is_asia_email_step()

    def is_on_asia_password_step(self) -> bool:
        """True if Asia login UI shows password step (password + submit)."""
        controls = self._enumerate_controls_light()
        judge = build_judge_from_controls(controls)
        return judge.is_asia_password_step()

    def perform_asia_email_step(self, email: str) -> bool:
        """Asia login: fill email (automation_id accountName) and click Continue."""
        return self._asia_ops.perform_asia_email_step(email)

    def perform_asia_password_step(self, password: Optional[str] = None) -> bool:
        """Asia login: fill password (automation_id password) and click submit."""
        return self._asia_ops.perform_asia_password_step(password)

    def perform_asia_login_flow(self, password: Optional[str] = None) -> bool:
        """Asia password step only: fill password and click submit (backward compatible)."""
        return self._asia_ops.perform_asia_password_step(password)

    def is_on_asia_combined_login_ui(self) -> bool:
        """True when both account and password fields visible on same Asia login screen."""
        return self._asia_ops.is_on_asia_combined_login_ui()

    def perform_asia_combined_login(self, email: str, password: Optional[str] = None) -> bool:
        """When both account and password on same screen: fill both via keyboard then click submit."""
        return self._asia_ops.perform_asia_combined_login(email, password)

    def perform_asia_login_fill_and_submit(
        self, email: Optional[str] = None, password: Optional[str] = None
    ) -> bool:
        """Fill whatever account/password fields are present then click submit (no step ordering)."""
        return self._asia_ops.perform_asia_login_fill_and_submit(email, password)

    def is_login_failed_screen(self) -> bool:
        """True if Battle.net shows post-web-login dialog. Prefer automation_id for primary/secondary, fallback name. Exclude browser-wait first."""
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
        """True if current window is the browser-login-wait popup. Prefer automation_id, fallback name (main text only)."""
        controls = self._enumerate_controls_light()
        if not controls:
            return False
        if BATTLE_NET_BROWSER_LOGIN_WAIT_AUTOMATION_IDS and self._has_control_automation_id_containing_any(controls, BATTLE_NET_BROWSER_LOGIN_WAIT_AUTOMATION_IDS):
            return True
        return self.find_control_by_name(BATTLE_NET_BROWSER_LOGIN_WAIT_MAIN_KEYWORDS, controls) is not None

    def is_disconnected(self) -> bool:
        """True if Battle.net shows disconnect. Prefer automation_id (Retry), fallback name."""
        controls = self._enumerate_controls_light()
        if not controls:
            return False
        if BATTLE_NET_DISCONNECT_AUTOMATION_IDS and self._has_control_automation_id_containing_any(controls, BATTLE_NET_DISCONNECT_AUTOMATION_IDS):
            return True
        return self.find_control_by_name(BATTLE_NET_DISCONNECT_KEYWORDS, controls) is not None

    def is_logged_in(self) -> bool:
        """True if logged in and main UI visible. When region bound only that region's main UI is checked."""
        controls = self._enumerate_controls_light()
        judge = build_judge_from_controls(controls, self._region)
        if self._region == "asia":
            return judge.has_asia_main_ui()
        if self._region == "cn":
            return judge.has_cn_main_ui()
        return judge.is_logged_in()

    def load_controls_from_docs_json(self) -> Optional[List[Dict]]:
        """Load controls list from docs JSON (reference only; click uses live enumeration)."""
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


def get_battlenet_operation(
    elements_json_path: Optional[Path] = None,
    region: Optional[str] = None,
) -> BattlenetOperation:
    """Return Battle.net operation bound to current region (resolved from game_interface_data/config when region is None)."""
    return BattlenetOperation(elements_json_path=elements_json_path, region=region)
