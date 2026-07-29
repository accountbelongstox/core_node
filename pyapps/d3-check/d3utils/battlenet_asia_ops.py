# -*- coding: utf-8 -*-
"""
Asia Battle.net diff operations: email step, password step, and combined (account+password on same UI).
Fills fields: try UIA ValuePattern.SetValue first; on failure use pycore field_input (keyboard).
"""
import time
from typing import Optional, List, Dict, Any, TYPE_CHECKING

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.input.field_input import fill_field_with_fallback, CLEAR_MODE_REPLACE
from providor.constants.common import (
    ASIA_LOGIN_ACCOUNT_AUTOMATION_IDS,
    ASIA_LOGIN_ACCOUNT_NAME_KEYWORDS,
    ASIA_LOGIN_DEBUG_INPUT,
    ASIA_LOGIN_PASSWORD_AUTOMATION_IDS,
    ASIA_LOGIN_PASSWORD_NAME_KEYWORDS,
    ASIA_LOGIN_SUBMIT_AUTOMATION_IDS,
    ASIA_LOGIN_SUBMIT_NAME_KEYWORDS,
    ASIA_LOGIN_CONTINUE_NAME_KEYWORDS,
)
from d3utils.battlenet_region_judge import build_judge_from_controls, BattlenetRegionJudge

_AFTER_FOCUS_SEC = 0.2
_FIELD_INPUT_INTERVAL_MIN = 0.05
_FIELD_INPUT_INTERVAL_MAX = 0.15

if TYPE_CHECKING:
    from d3utils.battlenet_operation_base import BattlenetOperationBase

UIA_VALUE_PATTERN_ID = 10002


def _find_by_automation_id(
    controls: List[Dict[str, Any]], automation_id_substrings: tuple
) -> Optional[Dict[str, Any]]:
    """Find first control whose automation_id contains any of the given substrings (e.g. 'submit', 'password')."""
    for sub in automation_id_substrings:
        if not sub:
            continue
        for c in controls:
            aid = (c.get("automation_id") or "").strip()
            if sub in aid or aid.endswith("." + sub):
                return c
    return None


def _find_by_name(
    controls: List[Dict[str, Any]], name_keywords: tuple
) -> Optional[Dict[str, Any]]:
    for c in controls:
        name = (c.get("name") or "").strip()
        for kw in name_keywords:
            if kw and kw in name:
                return c
    return None


def _find_submit_button(controls: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Find submit by automation_id only (e.g. 'submit')."""
    return _find_by_automation_id(controls, ASIA_LOGIN_SUBMIT_AUTOMATION_IDS)


def _find_continue_button(controls: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Find button whose name is Continue (Asia locale); same control may have automation_id submit."""
    ctrl = _find_by_name(controls, ASIA_LOGIN_CONTINUE_NAME_KEYWORDS)
    if ctrl:
        return ctrl
    for c in controls:
        aid = (c.get("automation_id") or "").strip()
        name = (c.get("name") or "").strip()
        if "submit" in aid and any(k in name for k in ASIA_LOGIN_CONTINUE_NAME_KEYWORDS):
            return c
    return None


def _find_log_in_button(controls: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Find button whose name is Log in (Asia locale); same control may have automation_id submit."""
    ctrl = _find_by_name(controls, ASIA_LOGIN_SUBMIT_NAME_KEYWORDS)
    if ctrl:
        return ctrl
    for c in controls:
        aid = (c.get("automation_id") or "").strip()
        name = (c.get("name") or "").strip()
        if "submit" in aid and any(k in name for k in ASIA_LOGIN_SUBMIT_NAME_KEYWORDS):
            return c
    return None


def _find_account_control(controls: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Find account/email field by automation_id then name."""
    ctrl = _find_by_automation_id(controls, ASIA_LOGIN_ACCOUNT_AUTOMATION_IDS)
    if ctrl:
        return ctrl
    return _find_by_name(controls, ASIA_LOGIN_ACCOUNT_NAME_KEYWORDS)


def _submit_is_log_in(controls: List[Dict[str, Any]]) -> bool:
    """True if the visible submit button is Log in not Continue."""
    ctrl = _find_by_automation_id(controls, ASIA_LOGIN_SUBMIT_AUTOMATION_IDS)
    if not ctrl:
        return False
    name = (ctrl.get("name") or "").strip()
    return any(k in name for k in ASIA_LOGIN_SUBMIT_NAME_KEYWORDS) and not any(k in name for k in ASIA_LOGIN_CONTINUE_NAME_KEYWORDS)


def _log_found_elements(
    account_ctrl: Optional[Dict], password_ctrl: Optional[Dict], submit_ctrl: Optional[Dict]
) -> None:
    """Debug: log main elements found (automation_id + name)."""
    def _desc(c: Optional[Dict]) -> str:
        if not c:
            return "None"
        aid = (c.get("automation_id") or "").strip()
        name = (c.get("name") or "").strip()[:24]
        return "aid=%s name=%s" % (aid or "?", name or "?")
    ColorPrint.gray("[BattlenetAsiaOps] found: accountName=%s | password=%s | submit=%s" % (
        _desc(account_ctrl), _desc(password_ctrl), _desc(submit_ctrl)))


def _log_control_ids_when_missing(controls: List[Dict[str, Any]], missing_key: str) -> None:
    """Debug: when password/submit not found, log automation_ids and types (first 50) to see tree."""
    ids = []
    for c in controls[:50]:
        aid = (c.get("automation_id") or "").strip()
        ctype = (c.get("type") or "").strip()[:12]
        name = (c.get("name") or "").strip()[:16]
        if aid or name:
            ids.append("%s%s" % (aid or "(no-aid)", " [%s]" % name if name else ""))
    ColorPrint.gray("[BattlenetAsiaOps] %s not found; sample automation_id+name: %s" % (missing_key, ids[:20]))


def _find_password_control(controls: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Find password field by automation_id, then name, then EditControl with password name."""
    ctrl = _find_by_automation_id(controls, ASIA_LOGIN_PASSWORD_AUTOMATION_IDS)
    if ctrl:
        return ctrl
    ctrl = _find_by_name(controls, ASIA_LOGIN_PASSWORD_NAME_KEYWORDS)
    if ctrl:
        return ctrl
    for c in controls:
        ctype = (c.get("type") or "").strip().lower()
        name = (c.get("name") or "").strip()
        if "edit" in ctype and any(kw in name for kw in ASIA_LOGIN_PASSWORD_NAME_KEYWORDS):
            return c
    return None


class BattlenetAsiaOps:
    """
    Asia Battle.net diff: perform email step and password step; predicates delegated to BattlenetRegionJudge.
    """

    def __init__(self, battlenet_op: "BattlenetOperationBase"):
        self._op = battlenet_op

    def _judge(self, controls: Optional[List[Dict[str, Any]]] = None) -> BattlenetRegionJudge:
        if controls is None:
            controls = self._op._enumerate_controls()
        return build_judge_from_controls(controls or [])

    def is_on_asia_email_step(self, controls: Optional[List[Dict[str, Any]]] = None) -> bool:
        """True when Asia login UI shows email/account step. Uses BattlenetRegionJudge."""
        return self._judge(controls).is_asia_email_step()

    def is_on_asia_password_step(self, controls: Optional[List[Dict[str, Any]]] = None) -> bool:
        """True when Asia login UI shows password step. Uses BattlenetRegionJudge."""
        return self._judge(controls).is_asia_password_step()

    def is_on_asia_login_screen(self, controls: Optional[List[Dict[str, Any]]] = None) -> bool:
        """True when on either Asia email step or password step or combined. Uses BattlenetRegionJudge."""
        return self._judge(controls).is_asia_login_ui()

    def is_on_asia_combined_login_ui(self, controls: Optional[List[Dict[str, Any]]] = None) -> bool:
        """True when both account and password fields visible on same Asia login screen."""
        return self._judge(controls).is_asia_combined_login_ui()

    def _fill_field(
        self, control_dict: Dict[str, Any], text: str, is_password: bool = False
    ) -> bool:
        """
        Fill field: try UIA ValuePattern.SetValue first; on failure use keyboard (pycore field_input).
        """
        if not text:
            return True
        if ASIA_LOGIN_DEBUG_INPUT:
            if is_password:
                ColorPrint.gray(
                    "[BattlenetAsiaOps] input field=password masked= *** len=%d"
                    % len(text)
                )
            else:
                preview = (
                    (text[:2] + "***" + text[-2:]) if len(text) > 4 else ("***" if text else "")
                )
                ColorPrint.gray(
                    "[BattlenetAsiaOps] input field=account len=%d preview= %s"
                    % (len(text), preview)
                )

        def set_value(t: str) -> bool:
            return self._op.set_control_value(control_dict, t)

        def focus() -> bool:
            return self._op.focus_control(control_dict)

        ok = fill_field_with_fallback(
            text,
            set_value,
            focus_callable=focus,
            prefer_set_value=True,
            clear_mode=CLEAR_MODE_REPLACE,
            interval_min=_FIELD_INPUT_INTERVAL_MIN,
            interval_max=_FIELD_INPUT_INTERVAL_MAX,
            after_focus_delay=_AFTER_FOCUS_SEC,
            use_clipboard_for_unicode=True,
        )
        if ok and text:
            ColorPrint.blue("[BattlenetAsiaOps] Field filled (%d chars)" % len(text))
        elif not ok:
            ColorPrint.gray("[BattlenetAsiaOps] Field fill failed (ValuePattern and keyboard)")
        return ok

    def perform_asia_email_step(self, email: str) -> bool:
        """
        Focus account/email field, clear and type email via keyboard, then click Continue (submit).
        """
        self._op.activate_window()
        time.sleep(0.2)
        controls = self._op._enumerate_controls()
        if not self.is_on_asia_email_step(controls):
            ColorPrint.yellow("[BattlenetAsiaOps] Not on Asia email step, skip")
            return False
        account_ctrl = _find_account_control(controls)
        if account_ctrl:
            self._fill_field(account_ctrl, email, is_password=False)
            time.sleep(0.15)
        submit_ctrl = _find_submit_button(controls)
        if not submit_ctrl:
            ColorPrint.yellow("[BattlenetAsiaOps] Continue button (submit) not found")
            return False
        ColorPrint.blue("[BattlenetAsiaOps] Click Continue (submit)")
        return self._op.click_control(submit_ctrl)

    def perform_asia_password_step(self, password: Optional[str] = None) -> bool:
        """
        Focus password field, clear and type password via keyboard if provided, then click submit (Log in).
        """
        self._op.activate_window()
        time.sleep(0.2)
        controls = self._op._enumerate_controls()
        if not self.is_on_asia_password_step(controls):
            ColorPrint.yellow("[BattlenetAsiaOps] Not on Asia password step, skip")
            return False
        if password:
            password_ctrl = _find_password_control(controls)
            if not password_ctrl:
                time.sleep(0.5)
                controls = self._op._enumerate_controls()
                password_ctrl = _find_password_control(controls)
            if password_ctrl:
                self._fill_field(password_ctrl, password, is_password=True)
                time.sleep(0.15)
        submit_ctrl = _find_by_automation_id(controls, ASIA_LOGIN_SUBMIT_AUTOMATION_IDS)
        if not submit_ctrl:
            ColorPrint.yellow("[BattlenetAsiaOps] Submit (automation_id=submit) not found")
            return False
        ColorPrint.blue("[BattlenetAsiaOps] Click submit (Log in)")
        return self._op.click_control(submit_ctrl)

    def perform_asia_combined_login(self, email: str, password: Optional[str] = None) -> bool:
        """
        When both account and password are on the same screen: fill account, then password, then click submit.
        Uses keyboard simulation (focus, clear, type) for both fields.
        """
        self._op.activate_window()
        time.sleep(0.2)
        controls = self._op._enumerate_controls()
        if not self.is_on_asia_combined_login_ui(controls):
            ColorPrint.yellow("[BattlenetAsiaOps] Not on Asia combined login UI, skip")
            return False
        account_ctrl = _find_account_control(controls)
        if account_ctrl:
            self._fill_field(account_ctrl, email, is_password=False)
            time.sleep(0.15)
        password_ctrl = _find_password_control(controls)
        if password_ctrl and password:
            self._fill_field(password_ctrl, password, is_password=True)
            time.sleep(0.15)
        submit_ctrl = _find_submit_button(controls)
        if not submit_ctrl:
            submit_ctrl = _find_by_automation_id(controls, ASIA_LOGIN_SUBMIT_AUTOMATION_IDS)
        if not submit_ctrl:
            submit_ctrl = _find_by_name(controls, ASIA_LOGIN_SUBMIT_NAME_KEYWORDS)
        if not submit_ctrl:
            ColorPrint.yellow("[BattlenetAsiaOps] Submit button not found (combined)")
            return False
        ColorPrint.blue("[BattlenetAsiaOps] Click submit (combined login)")
        return self._op.click_control(submit_ctrl)

    def perform_asia_login_fill_and_submit(
        self, email: Optional[str] = None, password: Optional[str] = None
    ) -> bool:
        """
        Fill whatever fields are present (account and/or password), then click BOTH buttons when present:
        first Continue, then Log in. Both must be clicked when both exist.
        """
        self._op.activate_window()
        time.sleep(0.2)
        controls = self._op._enumerate_controls()
        judge = self._judge(controls)
        if not judge.has_asia_login_markers():
            ColorPrint.yellow("[BattlenetAsiaOps] Not Asia login UI (no markers), skip fill_and_submit")
            return False
        account_ctrl = _find_by_automation_id(controls, ASIA_LOGIN_ACCOUNT_AUTOMATION_IDS)
        password_ctrl = _find_password_control(controls)
        if not password_ctrl:
            time.sleep(0.5)
            controls = self._op._enumerate_controls()
            password_ctrl = _find_password_control(controls)
        submit_ctrl = _find_by_automation_id(controls, ASIA_LOGIN_SUBMIT_AUTOMATION_IDS)
        _log_found_elements(account_ctrl, password_ctrl, submit_ctrl)
        if not submit_ctrl:
            _log_control_ids_when_missing(controls, "submit")
            ColorPrint.yellow("[BattlenetAsiaOps] No submit (automation_id=submit) button, skip")
            return False
        if not password_ctrl and password:
            _log_control_ids_when_missing(controls, "password")
            ColorPrint.gray("[BattlenetAsiaOps] Password field not in control tree; enumerate count=%d" % len(controls))
        submit_name = (submit_ctrl.get("name") or "").strip()
        submit_aid = (submit_ctrl.get("automation_id") or "").strip()
        is_log_in = any(k in submit_name for k in ASIA_LOGIN_SUBMIT_NAME_KEYWORDS)
        filled_any = False
        if account_ctrl and email:
            self._fill_field(account_ctrl, email, is_password=False)
            time.sleep(0.15)
            filled_any = True
        if password_ctrl and password:
            self._fill_field(password_ctrl, password, is_password=True)
            time.sleep(0.15)
            filled_any = True
        elif is_log_in and password:
            ColorPrint.yellow("[BattlenetAsiaOps] Password step but password field not found, skip submit (avoid empty login)")
            return False
        elif is_log_in and not password:
            ColorPrint.yellow("[BattlenetAsiaOps] Password step but no password in credentials, skip submit")
            return False
        if submit_ctrl.get("is_clickable") is not True:
            clickable_buttons = self._op.get_clickable_buttons(controls)
            ColorPrint.gray("[BattlenetAsiaOps] Submit not clickable (enabled=%s, offscreen=%s); clickable buttons: %s" % (
                submit_ctrl.get("is_enabled"), submit_ctrl.get("is_offscreen"),
                [(c.get("name") or c.get("automation_id") or "?")[:16] for c in clickable_buttons[:10]]))
            return False
        ColorPrint.blue("[BattlenetAsiaOps] Click submit (automation_id=%s name=%s)" % (submit_aid or "submit", submit_name or "?"))
        return self._op.click_control(submit_ctrl, require_clickable=True)