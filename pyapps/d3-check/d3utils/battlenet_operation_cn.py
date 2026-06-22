# -*- coding: utf-8 -*-
"""
Battle.net operation for CN (China) region only.
D3 tab / Play button / login flow use CN UI (agree, NetEase, etc.); Asia methods are no-op or return False.
"""
import time
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

from pycore.pyfoundations.color_print import ColorPrint

from d3utils.battlenet_operation_base import (
    BattlenetOperationBase,
    play_button_indicates_starting,
)
from d3utils.ui_control_operations import operate_button
from d3utils.battlenet_region_judge import build_judge_from_controls
from providor.constants.common import (
    BATTLE_NET_CN_AGREE_KEYWORDS,
    BATTLE_NET_CN_NETEASE_LOGIN_KEYWORDS,
    BATTLE_NET_CN_LOGIN_BUTTON_AUTOMATION_IDS,
    BATTLE_NET_CN_LOGIN_BUTTON_KEYWORDS,
    BATTLE_NET_CN_AFTER_NETEASE_CLICK_SETTLE_SEC,
    BATTLE_NET_DISCONNECT_KEYWORDS,
    BATTLE_NET_CONNECTING_KEYWORDS,
    LOGIN_SCREEN_UI_KEYWORDS_STRICT,
    LOGIN_WINDOW_AUTOMATION_ID_MARKERS,
)
from providor.constants.d3 import (
    D3_TAB_AUTOMATION_IDS,
    D3_TAB_NAME_KEYWORDS,
    START_GAME_AUTOMATION_IDS,
    START_GAME_NAME_KEYWORDS,
)


class BattlenetOperationCN(BattlenetOperationBase):
    """CN Battle.net: D3 tab, Play, login (agree + NetEase) via CN UI only."""

    def click_d3_tab(self) -> bool:
        controls = self._enumerate_controls()
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
        controls = self._enumerate_controls()
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

    def _find_play_control_in_list(self, controls: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not controls:
            return None
        for aid in START_GAME_AUTOMATION_IDS:
            ctrl = self.find_control_by_automation_id(aid, controls)
            if ctrl:
                return ctrl
        return self.find_control_by_name(START_GAME_NAME_KEYWORDS, controls)

    def click_play_button_if_visible(self, force_refresh: bool = True) -> bool:
        controls = self._enumerate_controls_light(force_refresh=force_refresh)
        ctrl = self._find_play_control_in_list(controls)
        if ctrl:
            ColorPrint.gray("[BattlenetOperation] Play button visible, click")
            return self.click_control(ctrl)
        return False

    def is_game_starting(self) -> bool:
        controls = self._enumerate_controls_light()
        for aid in START_GAME_AUTOMATION_IDS:
            ctrl = self.find_control_by_automation_id(aid, controls)
            if ctrl:
                return play_button_indicates_starting(ctrl)
        ctrl = self.find_control_by_name(START_GAME_NAME_KEYWORDS, controls)
        return play_button_indicates_starting(ctrl) if ctrl else False

    def _get_checkbox_toggle_state(self, raw_control) -> Optional[int]:
        try:
            toggle_pattern = raw_control.GetPattern(10014)
            if toggle_pattern is not None:
                return int(toggle_pattern.ToggleState)
        except Exception:
            pass
        try:
            val = raw_control.GetCurrentPropertyValue(30096)
            if val is not None:
                return int(val)
        except Exception:
            pass
        return None

    def _ensure_checkbox_checked_by_state(self, raw_control) -> bool:
        state = self._get_checkbox_toggle_state(raw_control)
        if state == 1:
            ColorPrint.blue("[BattlenetOperation] Agree checkbox already checked")
            return True
        try:
            if operate_button(raw_control, clicker=self._clicker, prefer_invoke=True):
                time.sleep(0.2)
            else:
                return False
            return True
        except Exception as e:
            ColorPrint.red(f"[BattlenetOperation] Agree checkbox click failed: {e}")
            return False

    def _ensure_agree_checkbox_checked(self) -> bool:
        raw = self._find_raw_control_by_automation_id("legalAcceptance")
        if not raw:
            raw = self._find_raw_control_by_name_and_type(BATTLE_NET_CN_AGREE_KEYWORDS, "CheckBoxControl")
            if raw:
                ColorPrint.blue("[BattlenetOperation] Agree checkbox found by name (fallback)")
        if not raw:
            ColorPrint.yellow("[BattlenetOperation] legalAcceptance checkbox not found")
            return False
        try:
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
        return self.perform_cn_login_flow()

    def click_cn_login_button(self) -> bool:
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
        return self.click_cn_login_button()

    def is_login_screen_ready(self) -> bool:
        controls = self._enumerate_controls_light()
        if not controls:
            return False
        has_agree_id = self.find_control_by_automation_id("legalAcceptance", controls) is not None
        has_netease_id = self.find_control_by_automation_id("ntes", controls) is not None
        return has_agree_id or has_netease_id

    def _get_dynamic_state_cn(self) -> Tuple[bool, bool, bool, Optional[str], bool, Optional[str]]:
        root = self._get_root_control()
        if not root:
            return (False, False, False, None, False, None)
        flags = {"login_cn": False, "disconnect": False, "connecting": False, "d3_cn": False, "play_cn": False, "play_name_cn": None}

        def _aid_contains_any(aid: str, markers: Tuple[str, ...]) -> bool:
            return any(m and m in aid for m in markers)

        def _name_contains_any(name: str, keywords: Tuple[str, ...]) -> bool:
            return any(kw and kw in name for kw in keywords)

        def walk(control, depth: int = 0):
            if depth > 25:
                return
            try:
                aid = (control.AutomationId or "").strip()
                name = (control.Name or "").strip()
                if _aid_contains_any(aid, LOGIN_WINDOW_AUTOMATION_ID_MARKERS) or _name_contains_any(name, LOGIN_SCREEN_UI_KEYWORDS_STRICT):
                    flags["login_cn"] = True
                if BATTLE_NET_DISCONNECT_KEYWORDS and _name_contains_any(name, BATTLE_NET_DISCONNECT_KEYWORDS):
                    flags["disconnect"] = True
                if BATTLE_NET_CONNECTING_KEYWORDS and _name_contains_any(name, BATTLE_NET_CONNECTING_KEYWORDS):
                    flags["connecting"] = True
                if any(a and a in aid for a in D3_TAB_AUTOMATION_IDS) or _name_contains_any(name, D3_TAB_NAME_KEYWORDS):
                    flags["d3_cn"] = True
                if any(a and a in aid for a in START_GAME_AUTOMATION_IDS) or _name_contains_any(name, START_GAME_NAME_KEYWORDS):
                    flags["play_cn"] = True
                    if name and not flags["play_name_cn"]:
                        flags["play_name_cn"] = name
                for child in control.GetChildren():
                    walk(child, depth + 1)
            except Exception:
                pass

        walk(root)
        if flags["d3_cn"] and flags["play_cn"] and not flags["login_cn"]:
            if flags["connecting"]:
                return (False, False, False, None, True, "cn")
            return (False, False, True, flags["play_name_cn"] or "Play", False, "cn")
        if flags["disconnect"]:
            return (False, True, False, None, False, "cn")
        if flags["login_cn"]:
            return (True, False, False, None, False, "cn")
        return (False, False, False, None, False, None)

    def get_dynamic_state(self, preferred_region: Optional[str] = None) -> Tuple[bool, bool, bool, Optional[str], bool, Optional[str]]:
        return self._get_dynamic_state_cn()

    def is_on_login_screen(self) -> bool:
        controls = self._enumerate_controls_light()
        judge = build_judge_from_controls(controls, "cn")
        return judge.is_cn_login_ui()

    def is_logged_in(self) -> bool:
        controls = self._enumerate_controls_light()
        judge = build_judge_from_controls(controls, "cn")
        return judge.has_cn_main_ui()

    # ---------- Asia stubs (no-op / False for CN class) ----------
    def is_on_asia_login_screen(self) -> bool:
        return False

    def is_on_asia_email_step(self) -> bool:
        return False

    def is_on_asia_password_step(self) -> bool:
        return False

    def perform_asia_email_step(self, email: str) -> bool:
        return False

    def perform_asia_password_step(self, password: Optional[str] = None) -> bool:
        return False

    def perform_asia_login_flow(self, password: Optional[str] = None) -> bool:
        return False

    def is_on_asia_combined_login_ui(self) -> bool:
        return False

    def perform_asia_combined_login(self, email: str, password: Optional[str] = None) -> bool:
        return False

    def perform_asia_login_fill_and_submit(
        self, email: Optional[str] = None, password: Optional[str] = None
    ) -> bool:
        return False
