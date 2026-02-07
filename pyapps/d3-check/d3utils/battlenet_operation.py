# -*- coding: utf-8 -*-
"""
Battle.net operation: start, close, restart, click D3 tab, start game, detect game state.
Reuses BattleNetManager for process/window; UI Automation for control find/click (Chromium Battle.net).
Control names reference docs JSON (exported via debug button).
"""
import time
import json
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple, Set

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.click_handler import ClickHandler
from pycore.pyfoundations.third_party import get_third_package_uiautomation, get_third_package_win32gui
from d3utils.battlenet_manager import get_battlenet_manager
from providor.app_constants import (
    BN_FLOW_SNAPSHOTS_DIR,
    BN_CLICK_MOVE_DURATION_SEC,
    BN_CLICK_PAUSE_AFTER_MOVE_SEC,
    BATTLE_NET_DISCONNECT_KEYWORDS,
    BATTLE_NET_NEED_LOGIN_KEYWORDS,
    BATTLE_NET_CN_AGREE_KEYWORDS,
    BATTLE_NET_CN_NETEASE_LOGIN_KEYWORDS,
    BATTLE_NET_CN_LOGIN_BUTTON_KEYWORDS,
    BATTLE_NET_CN_AFTER_NETEASE_CLICK_SETTLE_SEC,
    BATTLE_NET_BROWSER_LOGIN_WAIT_MAIN_KEYWORDS,
    BATTLE_NET_LOGIN_FAILED_KEYWORDS,
    BATTLE_NET_CONNECTING_KEYWORDS,
    LOGIN_SCREEN_UI_KEYWORDS_STRICT,
    LOGIN_SCREEN_UI_KEYWORDS,
    LOGIN_WINDOW_AUTOMATION_ID_MARKERS,
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


def _safe_control_dict(control) -> Optional[Dict[str, Any]]:
    try:
        r = control.BoundingRectangle
        rect = {
            "left": r.left, "top": r.top, "right": r.right, "bottom": r.bottom,
            "width": r.width(), "height": r.height(),
        }
        name = (control.Name or "").strip()
        aid = (control.AutomationId or "").strip()
        ctype = (control.ControlTypeName or "").strip()
        try:
            is_enabled = control.IsEnabled
        except Exception:
            is_enabled = None
        return {
            "name": name,
            "automation_id": aid,
            "type": ctype,
            "rect": rect,
            "is_enabled": is_enabled,
        }
    except Exception:
        return None


def _rect_center(rect: Dict[str, Any]) -> tuple:
    left = rect.get("left", 0)
    top = rect.get("top", 0)
    w = rect.get("width", 0)
    h = rect.get("height", 0)
    return (left + w // 2, top + h // 2)


class BattlenetOperation:
    """
    Battle.net operation: start, close, restart, activate window, click D3 tab, start game, detect state.
    Control lookup via UI Automation (Chromium Battle.net); process/window via BattleNetManager.
    """

    def __init__(self, elements_json_path: Optional[Path] = None):
        self._elements_json_path = elements_json_path or self._default_elements_json_path()
        self._clicker = ClickHandler()

    @staticmethod
    def _default_elements_json_path() -> Path:
        """Path to battlenet elements JSON under docs (filename may be CN)."""
        base = Path(__file__).resolve().parent.parent
        return base / "docs" / "登陆后的战网元素.json"

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
            if depth > 20:
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

    def find_control_by_automation_id(self, automation_id_substr: str, controls: Optional[List[Dict]] = None) -> Optional[Dict[str, Any]]:
        """Find control by AutomationId containing the given substring."""
        if controls is None:
            controls = self._enumerate_controls()
        for c in controls:
            aid = (c.get("automation_id") or "").strip()
            if automation_id_substr and automation_id_substr in aid:
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

    def click_control(self, control: Dict[str, Any]) -> bool:
        """Click at control rect center. Instant click (duration=0), return mouse to original after click."""
        rect = control.get("rect")
        if not rect:
            return False
        cx, cy = _rect_center(rect)
        self.activate_window()
        time.sleep(0.2)
        self._clicker.click(cx, cy, direct_click=True, return_to_original=True,
                            duration=BN_CLICK_MOVE_DURATION_SEC, pause_after_move=BN_CLICK_PAUSE_AFTER_MOVE_SEC)
        return True

    def click_d3_tab(self) -> bool:
        """Click D3 game tab (prefer automation_id game-nav-btn-D3CN / game-nav-btn-D3, else name Diablo III)."""
        for aid in D3_TAB_AUTOMATION_IDS:
            ctrl = self.find_control_by_automation_id(aid)
            if ctrl:
                ColorPrint.blue(f"[BattlenetOperation] Click D3 tab: automation_id={aid}, name={ctrl.get('name')}")
                return self.click_control(ctrl)
        ctrl = self.find_control_by_name(D3_TAB_NAME_KEYWORDS)
        if not ctrl:
            ColorPrint.yellow("[BattlenetOperation] D3 tab control not found")
            return False
        if "Playing Now" in (ctrl.get("name") or "") or "Game Version" in (ctrl.get("name") or ""):
            return False
        ColorPrint.blue(f"[BattlenetOperation] Click D3 tab: name={ctrl.get('name')}")
        return self.click_control(ctrl)

    def click_start_game(self) -> bool:
        """Click start game button (prefer automation_id play-btn-main/play-btn, else name Play or locale equivalent)."""
        for aid in START_GAME_AUTOMATION_IDS:
            ctrl = self.find_control_by_automation_id(aid)
            if ctrl:
                ColorPrint.blue(f"[BattlenetOperation] Click start game: automation_id={aid}")
                return self.click_control(ctrl)
        ctrl = self.find_control_by_name(START_GAME_NAME_KEYWORDS)
        if not ctrl:
            ColorPrint.yellow("[BattlenetOperation] Start game button not found")
            return False
        ColorPrint.blue(f"[BattlenetOperation] Click start game: name={ctrl.get('name')}")
        return self.click_control(ctrl)

    def is_game_starting(self) -> bool:
        """True if game is starting or already running: Play button disabled or name contains Playing Now."""
        ctrl = self.find_control_by_name(START_GAME_NAME_KEYWORDS)
        if not ctrl:
            return False
        name = (ctrl.get("name") or "").strip()
        if "Playing Now" in name or ("正在" in name):  # CN: "Playing now"
            return True
        is_enabled = ctrl.get("is_enabled")
        if is_enabled is not None:
            return not bool(is_enabled)
        return False

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
            raw_control.Click()
            time.sleep(0.2)
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
        """Click the final Login button (CN web agreement) via UI Automation only."""
        keywords = BATTLE_NET_CN_LOGIN_BUTTON_KEYWORDS + ("Login",)
        ctrl = self.find_control_by_name(keywords)
        if not ctrl:
            ColorPrint.yellow("[BattlenetOperation] Login button (UI name) not found")
            return False
        ColorPrint.blue(f"[BattlenetOperation] Click Login button (UI): name={ctrl.get('name')}")
        return self.click_control(ctrl)

    def click_confirm_login(self) -> bool:
        """Click confirm login (CN flow final step). Uses UI only."""
        return self.click_cn_login_button()

    def is_login_screen_ready(self) -> bool:
        """
        True when login screen is ready for interaction. Maximized: require BOTH automation_id (legalAcceptance or ntes) AND control name (agree or NetEase keywords), so spinning login-wrapper alone does not pass.
        """
        controls = self._enumerate_controls()
        if not controls:
            return False
        has_agree_id = self.find_control_by_automation_id("legalAcceptance", controls) is not None
        has_netease_id = self.find_control_by_automation_id("ntes", controls) is not None
        has_agree_name = self.find_control_by_name(BATTLE_NET_CN_AGREE_KEYWORDS, controls) is not None
        has_netease_name = self.find_control_by_name(BATTLE_NET_CN_NETEASE_LOGIN_KEYWORDS, controls) is not None
        return (has_agree_id or has_netease_id) and (has_agree_name or has_netease_name)

    def get_dynamic_state(self) -> Tuple[bool, bool, bool, Optional[str], bool]:
        """Return (on_login_screen, disconnected, normal_available, play_button_name, connecting). At most one of on_login/disconnected/normal_available True. connecting=True => main UI visible but not logged in yet."""
        controls = self._enumerate_controls()
        if not controls:
            return (False, False, False, None, False)
        d3_tab = self.find_control_by_automation_id("game-nav-btn-D3CN", controls) or self.find_control_by_automation_id("game-nav-btn-D3", controls)
        play_ctrl = (
            self.find_control_by_automation_id("play-btn-main", controls)
            or self.find_control_by_automation_id("play-btn", controls)
            or self.find_control_by_name(START_GAME_NAME_KEYWORDS, controls)
        )
        has_login_markers = self._has_control_automation_id_containing_any(controls, LOGIN_WINDOW_AUTOMATION_ID_MARKERS)
        on_login_strict = has_login_markers or self.find_control_by_name(LOGIN_SCREEN_UI_KEYWORDS_STRICT, controls) is not None
        disconnected = self.find_control_by_name(BATTLE_NET_DISCONNECT_KEYWORDS, controls) is not None
        has_main_ui = d3_tab is not None and play_ctrl is not None and not has_login_markers
        connecting = self.find_control_by_name(BATTLE_NET_CONNECTING_KEYWORDS, controls) is not None
        normal_available = has_main_ui and not connecting
        play_button_name = (play_ctrl.get("name") or "").strip() or None if play_ctrl else None
        if normal_available:
            return (False, False, True, play_button_name or "Play", False)
        if has_main_ui and connecting:
            return (False, False, False, None, True)
        if disconnected:
            return (False, True, False, None, False)
        if on_login_strict:
            return (True, False, False, None, False)
        return (False, False, False, None, False)

    def save_ui_elements_snapshot(self, node_name: str, reason: str) -> Optional[Path]:
        """
        Save current Battle.net UI elements to JSON under BN_FLOW_SNAPSHOTS_DIR (app_constants).
        Filename: fixed step name only, bn_flow_{node}.json (no timestamp). Meta: node, reason; body: controls list.
        """
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
        """True if Battle.net is on login screen. Maximized: automation_id contains login-window markers OR control name contains strict long phrases."""
        controls = self._enumerate_controls()
        if not controls:
            return False
        return (
            self._has_control_automation_id_containing_any(controls, LOGIN_WINDOW_AUTOMATION_ID_MARKERS)
            or self.find_control_by_name(LOGIN_SCREEN_UI_KEYWORDS_STRICT, controls) is not None
        )

    def is_login_failed_screen(self) -> bool:
        """True if Battle.net shows post-web-login dialog. Maximized: exclude browser-wait first; require BOTH primary (Continue Offline) AND secondary (Cancel) present in current UI."""
        controls = self._enumerate_controls()
        if not controls:
            return False
        if self.is_on_browser_login_wait_screen():
            return False
        primary_kw = BATTLE_NET_LOGIN_FAILED_KEYWORDS[:2]
        secondary_kw = BATTLE_NET_LOGIN_FAILED_KEYWORDS[2:4]
        has_primary = False
        has_secondary = False
        for c in controls:
            name = (c.get("name") or "").strip()
            aid = (c.get("automation_id") or "").strip()
            if name and any(kw in name for kw in primary_kw if kw):
                has_primary = True
            if aid and any(kw in aid for kw in primary_kw if kw):
                has_primary = True
            if name and any(kw in name for kw in secondary_kw if kw):
                has_secondary = True
            if aid and any(kw in aid for kw in secondary_kw if kw):
                has_secondary = True
        return has_primary and has_secondary

    def is_on_browser_login_wait_screen(self) -> bool:
        """True if current window is the browser-login-wait popup. Maximized: detect by main text only (do not use Cancel alone)."""
        controls = self._enumerate_controls()
        if not controls:
            return False
        return self.find_control_by_name(BATTLE_NET_BROWSER_LOGIN_WAIT_MAIN_KEYWORDS, controls) is not None

    def is_disconnected(self) -> bool:
        """True if Battle.net shows disconnect. Maximized: must have Retry control (unique keywords)."""
        controls = self._enumerate_controls()
        if not controls:
            return False
        return self.find_control_by_name(BATTLE_NET_DISCONNECT_KEYWORDS, controls) is not None

    def is_logged_in(self) -> bool:
        """True if logged in and normal available. Maximized: D3 tab and Play both present, and no login-window automation_id (avoid false positive when login overlay on main)."""
        controls = self._enumerate_controls()
        if not controls:
            return False
        if self._has_control_automation_id_containing_any(controls, LOGIN_WINDOW_AUTOMATION_ID_MARKERS):
            return False
        d3_tab = self.find_control_by_automation_id("game-nav-btn-D3CN", controls) or self.find_control_by_automation_id("game-nav-btn-D3", controls)
        if not d3_tab:
            return False
        play_ctrl = (
            self.find_control_by_automation_id("play-btn-main", controls)
            or self.find_control_by_automation_id("play-btn", controls)
            or self.find_control_by_name(START_GAME_NAME_KEYWORDS, controls)
        )
        return play_ctrl is not None

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


def get_battlenet_operation(elements_json_path: Optional[Path] = None) -> BattlenetOperation:
    """Return Battle.net operation instance (not singleton; optional elements_json_path)."""
    return BattlenetOperation(elements_json_path=elements_json_path)
