# -*- coding: utf-8 -*-
"""
Battle.net operation: start, close, restart, click D3 tab, start game, detect game state.
Reuses BattleNetManager for process/window; UI Automation for control find/click (Chromium Battle.net).
Control names reference docs/登陆后的战网元素.json (exported via debug button).
"""
import time
import json
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.click_handler import ClickHandler
from pycore.pyfoundations.third_party import get_third_package_uiautomation, get_third_package_win32gui
from d3utils.battlenet_manager import get_battlenet_manager, get_battlenet_window_titles
from providor.app_constants import (
    CLICK_MOVE_DURATION_SEC,
    CLICK_PAUSE_AFTER_MOVE_SEC,
    BATTLE_NET_DISCONNECT_KEYWORDS,
    BATTLE_NET_NEED_LOGIN_KEYWORDS,
    BATTLE_NET_CN_AGREE_KEYWORDS,
    BATTLE_NET_CN_NETEASE_LOGIN_KEYWORDS,
    BATTLE_NET_CN_LOGIN_BUTTON_KEYWORDS,
    BATTLE_NET_CN_AFTER_NETEASE_CLICK_WAIT_SEC,
    BATTLE_NET_BROWSER_LOGIN_WAIT_KEYWORDS,
    LOGIN_SCREEN_UI_KEYWORDS,
    LOGIN_WINDOW_AUTOMATION_ID_MARKERS,
    D3_TAB_AUTOMATION_IDS,
    D3_TAB_NAME_KEYWORDS,
    START_GAME_AUTOMATION_IDS,
    START_GAME_NAME_KEYWORDS,
)

win32gui = get_third_package_win32gui()


def _ensure_com() -> None:
    try:
        import pythoncom
        pythoncom.CoInitialize()
    except ImportError:
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
        """docs/登陆后的战网元素.json"""
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
        """Click at control rect center."""
        rect = control.get("rect")
        if not rect:
            return False
        cx, cy = _rect_center(rect)
        self.activate_window()
        time.sleep(0.2)
        self._clicker.click(cx, cy, direct_click=True, return_to_original=True,
                            duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
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
        """Click start game button (prefer automation_id play-btn-main/play-btn, else name Play/开始游戏)."""
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
        if "Playing Now" in name or "正在" in name:
            return True
        is_enabled = ctrl.get("is_enabled")
        if is_enabled is not None:
            return not bool(is_enabled)
        return False

    def _ensure_agree_checkbox_checked(self) -> bool:
        """
        Ensure the "您同意..." checkbox is checked (not just click once).
        Find control by automation_id legalAcceptance; use TogglePattern to set On, or Click() fallback.
        """
        raw = self._find_raw_control_by_automation_id("legalAcceptance")
        if not raw:
            ColorPrint.yellow("[BattlenetOperation] legalAcceptance checkbox not found")
            return False
        try:
            # UIA TogglePatternId = 10014; ToggleState 1 = On (checked), 0 = Off
            toggle_pattern = raw.GetPattern(10014)
            if toggle_pattern is not None:
                def _get_state(p):
                    if hasattr(p, "ToggleState"):
                        return p.ToggleState
                    if hasattr(p, "GetToggleState"):
                        return p.GetToggleState()
                    return None
                state = _get_state(toggle_pattern)
                if state is not None and state != 1:
                    toggle_pattern.Toggle()
                    time.sleep(0.2)
                    if _get_state(toggle_pattern) != 1:
                        toggle_pattern.Toggle()
                        time.sleep(0.2)
                ColorPrint.blue("[BattlenetOperation] Agree checkbox ensured checked (TogglePattern)")
                return True
        except Exception as e:
            ColorPrint.gray(f"[BattlenetOperation] TogglePattern not used: {e}")
        try:
            raw.Click()
            time.sleep(0.3)
            raw.Click()
            time.sleep(0.2)
            ColorPrint.blue("[BattlenetOperation] Agree checkbox clicked (fallback)")
            return True
        except Exception as e:
            ColorPrint.red(f"[BattlenetOperation] Agree checkbox click failed: {e}")
            return False

    def _click_netease_login_button(self) -> bool:
        """Click '使用网易账号登录或注册' (automation_id ntes or name)."""
        ctrl = self.find_control_by_automation_id("ntes")
        if ctrl:
            ColorPrint.blue("[BattlenetOperation] Click 使用网易账号登录或注册: automation_id=ntes")
            return self.click_control(ctrl)
        ctrl = self.find_control_by_name(BATTLE_NET_CN_NETEASE_LOGIN_KEYWORDS)
        if ctrl:
            ColorPrint.blue("[BattlenetOperation] Click 使用网易账号登录或注册: by name")
            return self.click_control(ctrl)
        ColorPrint.yellow("[BattlenetOperation] 使用网易账号登录或注册 button not found")
        return False

    def perform_cn_login_flow(self, wait_after_netease_sec: float = BATTLE_NET_CN_AFTER_NETEASE_CLICK_WAIT_SEC) -> bool:
        """
        CN login flow on login screen: ensure "您同意..." checkbox checked, then click "使用网易账号登录或注册", then wait for web page.
        Call when on login screen (e.g. before starting ROSBOT). Returns True if both steps succeeded.
        """
        self.activate_window()
        time.sleep(0.2)
        if not self._ensure_agree_checkbox_checked():
            return False
        time.sleep(0.2)
        if not self._click_netease_login_button():
            return False
        ColorPrint.blue(f"[BattlenetOperation] Waiting {wait_after_netease_sec}s for web agreement...")
        time.sleep(wait_after_netease_sec)
        return True

    def agree_login(self) -> bool:
        """Click agree on login screen. Delegates to _ensure_agree_checkbox_checked + _click_netease_login_button via perform_cn_login_flow."""
        return self.perform_cn_login_flow()

    def click_cn_login_button(self) -> bool:
        """Click the final '登录' / 'Login' button (CN web agreement) via UI Automation only."""
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

    def get_dynamic_state(self) -> Tuple[bool, bool, bool]:
        """
        Enumerate UI once and return (on_login_screen, disconnected, normal_available).
        Uses UI Automation only. Unlogged-in state: automation_id markers from battlenet_analysis.json (未登陆 UI).
        """
        controls = self._enumerate_controls()
        if not controls:
            return (False, False, False)
        # Unlogged-in: any control automation_id contains LoginWindow/loginWidget/login-wrapper/legalAcceptance/ntes/connectAccounts, or name matches need-login/agree/NetEase
        on_login = self._has_control_automation_id_containing_any(controls, LOGIN_WINDOW_AUTOMATION_ID_MARKERS) or self.find_control_by_name(LOGIN_SCREEN_UI_KEYWORDS, controls) is not None
        disconnected = self.find_control_by_name(BATTLE_NET_DISCONNECT_KEYWORDS, controls) is not None
        d3_tab = self.find_control_by_automation_id("game-nav-btn-D3CN", controls) or self.find_control_by_automation_id("game-nav-btn-D3", controls)
        play_ctrl = (
            self.find_control_by_automation_id("play-btn-main", controls)
            or self.find_control_by_automation_id("play-btn", controls)
            or self.find_control_by_name(START_GAME_NAME_KEYWORDS, controls)
        )
        normal_available = d3_tab is not None and play_ctrl is not None
        return (on_login, disconnected, normal_available)

    def is_on_login_screen(self) -> bool:
        """True if Battle.net is on login screen (未登陆). Uses automation_id markers from battlenet_analysis.json or control name keywords."""
        controls = self._enumerate_controls()
        if not controls:
            return False
        return self._has_control_automation_id_containing_any(controls, LOGIN_WINDOW_AUTOMATION_ID_MARKERS) or self.find_control_by_name(LOGIN_SCREEN_UI_KEYWORDS, controls) is not None

    def is_on_browser_login_wait_screen(self) -> bool:
        """True if current window is the '使用浏览器完成登录。/取消' popup (wait for browser login). If we see this at start, restart BN and go to step 1; in the middle it is normal."""
        controls = self._enumerate_controls()
        if not controls:
            return False
        return self.find_control_by_name(BATTLE_NET_BROWSER_LOGIN_WAIT_KEYWORDS, controls) is not None

    def is_disconnected(self) -> bool:
        """True if Battle.net shows disconnect (UI element: Retry / 重试)."""
        controls = self._enumerate_controls()
        return self.find_control_by_name(BATTLE_NET_DISCONNECT_KEYWORDS, controls) is not None if controls else False

    def is_logged_in(self) -> bool:
        """True if logged in and normal available: D3 tab + Play area visible (UI Automation)."""
        controls = self._enumerate_controls()
        if not controls:
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
