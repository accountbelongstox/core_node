# -*- coding: utf-8 -*-
"""
Battle.net operation for Asia region only.
D3 tab / Play button / login flow use Asia UI constants; CN methods are no-op or return False.
"""
import time
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

from pycore.pyfoundations.color_print import ColorPrint

from d3utils.battlenet_operation_base import (
    BattlenetOperationBase,
    play_button_indicates_starting,
)
from d3utils.battlenet_asia_ops import BattlenetAsiaOps
from d3utils.battlenet_region_judge import (
    build_judge_from_controls,
    get_asia_d3_automation_ids,
    get_asia_d3_name_keywords,
    get_asia_play_automation_ids,
    get_asia_play_name_keywords,
)
from providor.constants.common import (
    BATTLE_NET_DISCONNECT_KEYWORDS,
    BATTLE_NET_CONNECTING_KEYWORDS,
    LOGIN_SCREEN_UI_KEYWORDS_STRICT_ASIA,
    LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA,
)


class BattlenetOperationAsia(BattlenetOperationBase):
    """Asia Battle.net: D3 tab, Play, login (email/password) via Asia UI only."""

    def __init__(self, elements_json_path: Optional[Path] = None):
        super().__init__(elements_json_path)
        self._asia_ops = BattlenetAsiaOps(self)

    def click_d3_tab(self) -> bool:
        controls = self._enumerate_controls()
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
        ColorPrint.yellow("[BattlenetOperation] D3 tab control not found (Asia)")
        return False

    def click_start_game(self) -> bool:
        controls = self._enumerate_controls()
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
        ColorPrint.yellow("[BattlenetOperation] Start game button not found (Asia)")
        return False

    def _find_play_control_in_list(self, controls: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not controls:
            return None
        for aid in get_asia_play_automation_ids():
            ctrl = self.find_control_by_automation_id(aid, controls)
            if ctrl:
                return ctrl
        return self.find_control_by_name(get_asia_play_name_keywords(), controls)

    def click_play_button_if_visible(self, force_refresh: bool = True) -> bool:
        controls = self._enumerate_controls_light(force_refresh=force_refresh)
        ctrl = self._find_play_control_in_list(controls)
        if ctrl:
            ColorPrint.gray("[BattlenetOperation] Play button visible, click")
            return self.click_control(ctrl)
        return False

    def is_game_starting(self) -> bool:
        controls = self._enumerate_controls_light()
        for aid in get_asia_play_automation_ids():
            ctrl = self.find_control_by_automation_id(aid, controls)
            if ctrl:
                return play_button_indicates_starting(ctrl)
        ctrl = self.find_control_by_name(get_asia_play_name_keywords(), controls)
        return play_button_indicates_starting(ctrl) if ctrl else False

    def _get_dynamic_state_asia(self) -> Tuple[bool, bool, bool, Optional[str], bool, Optional[str]]:
        root = self._get_root_control()
        if not root:
            return (False, False, False, None, False, None)
        flags = {"login_asia": False, "disconnect": False, "connecting": False, "d3_asia": False, "play_asia": False, "play_name_asia": None}
        asia_d3_aids = get_asia_d3_automation_ids()
        asia_d3_names = get_asia_d3_name_keywords()
        asia_play_aids = get_asia_play_automation_ids()
        asia_play_names = get_asia_play_name_keywords()

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
                if _aid_contains_any(aid, LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA) or _name_contains_any(name, LOGIN_SCREEN_UI_KEYWORDS_STRICT_ASIA):
                    flags["login_asia"] = True
                if BATTLE_NET_DISCONNECT_KEYWORDS and _name_contains_any(name, BATTLE_NET_DISCONNECT_KEYWORDS):
                    flags["disconnect"] = True
                if BATTLE_NET_CONNECTING_KEYWORDS and _name_contains_any(name, BATTLE_NET_CONNECTING_KEYWORDS):
                    flags["connecting"] = True
                if any(a and a in aid for a in asia_d3_aids) or _name_contains_any(name, asia_d3_names):
                    flags["d3_asia"] = True
                if any(a and a in aid for a in asia_play_aids) or _name_contains_any(name, asia_play_names):
                    flags["play_asia"] = True
                    if name and not flags["play_name_asia"]:
                        flags["play_name_asia"] = name
                for child in control.GetChildren():
                    walk(child, depth + 1)
            except Exception:
                pass

        walk(root)
        if flags["d3_asia"] and flags["play_asia"] and not flags["login_asia"]:
            if flags["connecting"]:
                return (False, False, False, None, True, "asia")
            return (False, False, True, flags["play_name_asia"] or "Play", False, "asia")
        if flags["disconnect"]:
            return (False, True, False, None, False, "asia")
        if flags["login_asia"]:
            return (True, False, False, None, False, "asia")
        return (False, False, False, None, False, None)

    def get_dynamic_state(self, preferred_region: Optional[str] = None) -> Tuple[bool, bool, bool, Optional[str], bool, Optional[str]]:
        return self._get_dynamic_state_asia()

    def is_on_login_screen(self) -> bool:
        return False

    def is_on_asia_login_screen(self) -> bool:
        controls = self._enumerate_controls_light()
        judge = build_judge_from_controls(controls, "asia")
        return judge.is_asia_login_ui()

    def is_on_asia_email_step(self) -> bool:
        return self._asia_ops.is_on_asia_email_step()

    def is_on_asia_password_step(self) -> bool:
        return self._asia_ops.is_on_asia_password_step()

    def perform_asia_email_step(self, email: str) -> bool:
        return self._asia_ops.perform_asia_email_step(email)

    def perform_asia_password_step(self, password: Optional[str] = None) -> bool:
        return self._asia_ops.perform_asia_password_step(password)

    def perform_asia_login_flow(self, password: Optional[str] = None) -> bool:
        return self._asia_ops.perform_asia_password_step(password)

    def is_on_asia_combined_login_ui(self) -> bool:
        return self._asia_ops.is_on_asia_combined_login_ui()

    def perform_asia_combined_login(self, email: str, password: Optional[str] = None) -> bool:
        return self._asia_ops.perform_asia_combined_login(email, password)

    def perform_asia_login_fill_and_submit(
        self, email: Optional[str] = None, password: Optional[str] = None
    ) -> bool:
        return self._asia_ops.perform_asia_login_fill_and_submit(email, password)

    def is_logged_in(self) -> bool:
        controls = self._enumerate_controls_light()
        judge = build_judge_from_controls(controls, "asia")
        return judge.has_asia_main_ui()

    # ---------- CN stubs (no-op / False for Asia class) ----------
    def perform_cn_login_flow(self, wait_after_netease_sec: float = 0) -> bool:
        return False

    def agree_login(self) -> bool:
        return False

    def click_cn_login_button(self) -> bool:
        return False

    def click_confirm_login(self) -> bool:
        return False

    def is_login_screen_ready(self) -> bool:
        return False
