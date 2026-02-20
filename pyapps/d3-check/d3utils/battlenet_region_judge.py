# -*- coding: utf-8 -*-
"""
Battle.net region judgment library: single place for "is Asia" / "is CN" logic.
Covers login UI (Asia: email step, password step; CN: agree + NetEase) and main UI after login
(D3 tab + Play visibility). Asia D3 tab / Play detection uses hardcoded constants from providor.constants.d3
(reference: docs JSON is for human reference only, not loaded at runtime).
"""
from typing import Any, Dict, List, Optional, Tuple

from providor.constants.common import (
    ASIA_LOGIN_ACCOUNT_AUTOMATION_IDS,
    ASIA_LOGIN_ACCOUNT_NAME_KEYWORDS,
    ASIA_LOGIN_CONTINUE_NAME_KEYWORDS,
    ASIA_LOGIN_PASSWORD_AUTOMATION_IDS,
    ASIA_LOGIN_PASSWORD_NAME_KEYWORDS,
    ASIA_LOGIN_SUBMIT_AUTOMATION_IDS,
    ASIA_LOGIN_SUBMIT_NAME_KEYWORDS,
    ASIA_LOGIN_SWITCH_ACCOUNT_KEYWORDS,
    BATTLE_NET_CONNECTING_AUTOMATION_IDS,
    BATTLE_NET_CONNECTING_KEYWORDS,
    BATTLE_NET_DISCONNECT_AUTOMATION_IDS,
    BATTLE_NET_DISCONNECT_KEYWORDS,
    LOGIN_SCREEN_UI_KEYWORDS_STRICT,
    LOGIN_SCREEN_UI_KEYWORDS_STRICT_ASIA,
    LOGIN_WINDOW_AUTOMATION_ID_MARKERS,
    LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA,
)
from providor.constants.d3 import (
    D3_TAB_AUTOMATION_IDS,
    D3_TAB_AUTOMATION_IDS_ASIA,
    D3_TAB_NAME_KEYWORDS,
    D3_TAB_NAME_KEYWORDS_ASIA,
    START_GAME_AUTOMATION_IDS,
    START_GAME_AUTOMATION_IDS_ASIA,
    START_GAME_NAME_KEYWORDS,
    START_GAME_NAME_KEYWORDS_ASIA,
)


def _has_automation_id_any(controls: List[Dict[str, Any]], ids: Tuple[str, ...]) -> bool:
    for c in controls:
        aid = (c.get("automation_id") or "").strip()
        for sub in ids:
            if sub and sub in aid:
                return True
    return False


def _find_by_automation_id(
    controls: List[Dict[str, Any]], ids: Tuple[str, ...]
) -> Optional[Dict[str, Any]]:
    for sub in ids:
        if not sub:
            continue
        for c in controls:
            aid = (c.get("automation_id") or "").strip()
            if sub in aid:
                return c
    return None


def _find_by_name(
    controls: List[Dict[str, Any]], keywords: Tuple[str, ...]
) -> Optional[Dict[str, Any]]:
    for c in controls:
        name = (c.get("name") or "").strip()
        for kw in keywords:
            if kw and kw in name:
                return c
    return None


class BattlenetRegionJudge:
    """
    Single source of truth for Battle.net region and UI type.
    Given a control list and optional preferred_region, answers: is Asia login UI, is Asia main UI,
    is CN login UI, is CN main UI, and detected_region (asia | cn | None).
    """

    def __init__(
        self,
        controls: List[Dict[str, Any]],
        preferred_region: Optional[str] = None,
    ):
        self._controls = controls
        self._preferred_region = preferred_region

    # ---------- Login UI (Asia) ----------
    def has_asia_login_markers(self) -> bool:
        """True if any control automation_id contains Asia login window markers (login-wrapper, etc.)."""
        return _has_automation_id_any(self._controls, LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA)

    def is_asia_email_step(self) -> bool:
        """True when Asia login UI shows email/account step: accountName + submit, no password field."""
        if not self.has_asia_login_markers():
            return False
        account = _find_by_automation_id(self._controls, ASIA_LOGIN_ACCOUNT_AUTOMATION_IDS)
        if not account:
            account = _find_by_name(self._controls, ASIA_LOGIN_ACCOUNT_NAME_KEYWORDS)
        if not account:
            return False
        submit = _find_by_automation_id(self._controls, ASIA_LOGIN_SUBMIT_AUTOMATION_IDS)
        if not submit:
            submit = _find_by_name(
                self._controls, ASIA_LOGIN_SUBMIT_NAME_KEYWORDS + ASIA_LOGIN_CONTINUE_NAME_KEYWORDS
            )
        if not submit:
            return False
        has_password = _find_by_automation_id(self._controls, ASIA_LOGIN_PASSWORD_AUTOMATION_IDS) or _find_by_name(
            self._controls, ASIA_LOGIN_PASSWORD_NAME_KEYWORDS
        )
        return has_password is None

    def is_asia_password_step(self) -> bool:
        """True when Asia login UI shows password step: password field + submit, or submit is Log in not Continue."""
        if not self.has_asia_login_markers():
            return False
        password = _find_by_automation_id(self._controls, ASIA_LOGIN_PASSWORD_AUTOMATION_IDS)
        if not password:
            password = _find_by_name(self._controls, ASIA_LOGIN_PASSWORD_NAME_KEYWORDS)
        submit = _find_by_automation_id(self._controls, ASIA_LOGIN_SUBMIT_AUTOMATION_IDS)
        if not submit:
            submit = _find_by_name(self._controls, ASIA_LOGIN_SUBMIT_NAME_KEYWORDS)
        if password is not None and submit is not None:
            return True
        # After email step (Continue), UI may show Log in button before password control is enumerated.
        submit_name = (submit.get("name") or "").strip() if submit else ""
        continue_keywords = ASIA_LOGIN_CONTINUE_NAME_KEYWORDS
        log_in_keywords = ASIA_LOGIN_SUBMIT_NAME_KEYWORDS
        if submit_name and any(k in submit_name for k in log_in_keywords) and not any(k in submit_name for k in continue_keywords):
            return True
        return False

    def is_asia_login_ui(self) -> bool:
        """True when current UI is Asia login (email step or password step or combined)."""
        return self.is_asia_email_step() or self.is_asia_password_step() or self.is_asia_combined_login_ui()

    def is_asia_combined_login_ui(self) -> bool:
        """True when Asia login UI shows both account and password on same screen (single-step form)."""
        if not self.has_asia_login_markers():
            return False
        account = _find_by_automation_id(self._controls, ASIA_LOGIN_ACCOUNT_AUTOMATION_IDS)
        if not account:
            account = _find_by_name(self._controls, ASIA_LOGIN_ACCOUNT_NAME_KEYWORDS)
        password = _find_by_automation_id(self._controls, ASIA_LOGIN_PASSWORD_AUTOMATION_IDS)
        if not password:
            password = _find_by_name(self._controls, ASIA_LOGIN_PASSWORD_NAME_KEYWORDS)
        return account is not None and password is not None

    def is_asia_password_step_with_switch_account(self) -> bool:
        """True when on password step and a 'Switch account' control is present (for Phase 3: force account step)."""
        if not self.is_asia_password_step():
            return False
        return _find_by_name(self._controls, ASIA_LOGIN_SWITCH_ACCOUNT_KEYWORDS) is not None

    # ---------- Login UI (CN) ----------
    def has_cn_login_markers(self) -> bool:
        """True if any control automation_id contains CN login markers (legalAcceptance, ntes, etc.)."""
        return _has_automation_id_any(self._controls, LOGIN_WINDOW_AUTOMATION_ID_MARKERS)

    def is_cn_login_ui(self) -> bool:
        """True when current UI is CN login (agree + NetEase flow)."""
        return (
            self.has_cn_login_markers()
            or _find_by_name(self._controls, LOGIN_SCREEN_UI_KEYWORDS_STRICT) is not None
        )

    # ---------- Main UI after login (Asia) ----------
    def has_asia_main_ui(self) -> bool:
        """True when D3 tab (Asia) and Play (Asia) are present and no Asia login markers."""
        if self.has_asia_login_markers():
            return False
        d3 = _find_by_automation_id(self._controls, D3_TAB_AUTOMATION_IDS_ASIA)
        if not d3:
            d3 = _find_by_name(self._controls, D3_TAB_NAME_KEYWORDS_ASIA)
        play = _find_by_automation_id(self._controls, START_GAME_AUTOMATION_IDS_ASIA)
        if not play:
            play = _find_by_name(self._controls, START_GAME_NAME_KEYWORDS_ASIA)
        return d3 is not None and play is not None

    # ---------- Main UI after login (CN) ----------
    def has_cn_main_ui(self) -> bool:
        """True when D3 tab (CN) and Play (CN) are present and no CN login markers."""
        if self.has_cn_login_markers():
            return False
        d3 = _find_by_automation_id(self._controls, D3_TAB_AUTOMATION_IDS)
        if not d3:
            d3 = _find_by_name(self._controls, D3_TAB_NAME_KEYWORDS)
        play = _find_by_automation_id(self._controls, START_GAME_AUTOMATION_IDS)
        if not play:
            play = _find_by_name(self._controls, START_GAME_NAME_KEYWORDS)
        return d3 is not None and play is not None

    # ---------- Disconnect / connecting ----------
    def has_disconnect(self) -> bool:
        """True if Retry/disconnect control is present. Prefer automation_id, fallback name."""
        if BATTLE_NET_DISCONNECT_AUTOMATION_IDS and _find_by_automation_id(self._controls, BATTLE_NET_DISCONNECT_AUTOMATION_IDS) is not None:
            return True
        return _find_by_name(self._controls, BATTLE_NET_DISCONNECT_KEYWORDS) is not None

    def has_connecting(self) -> bool:
        """True if Connecting control is present. Prefer automation_id, fallback name."""
        if BATTLE_NET_CONNECTING_AUTOMATION_IDS and _find_by_automation_id(self._controls, BATTLE_NET_CONNECTING_AUTOMATION_IDS) is not None:
            return True
        return _find_by_name(self._controls, BATTLE_NET_CONNECTING_KEYWORDS) is not None

    # ---------- Detected region (asia | cn | None) ----------
    def _try_asia_result(
        self,
    ) -> Optional[Tuple[bool, bool, bool, Optional[str], bool]]:
        """Returns (on_login, disconnected, normal_available, play_button_name, connecting) or None."""
        d3 = _find_by_automation_id(self._controls, D3_TAB_AUTOMATION_IDS_ASIA)
        if not d3:
            d3 = _find_by_name(self._controls, D3_TAB_NAME_KEYWORDS_ASIA)
        play = _find_by_automation_id(self._controls, START_GAME_AUTOMATION_IDS_ASIA)
        if not play:
            play = _find_by_name(self._controls, START_GAME_NAME_KEYWORDS_ASIA)
        on_login_asia = self.has_asia_login_markers() or _find_by_name(
            self._controls, LOGIN_SCREEN_UI_KEYWORDS_STRICT_ASIA
        ) is not None
        has_main = d3 is not None and play is not None and not self.has_asia_login_markers()
        if has_main:
            connecting = self.has_connecting()
            name = (play.get("name") or "").strip() or "Play"
            if not connecting:
                return (False, False, True, name, False)
            return (False, False, False, None, True)
        if self.has_disconnect():
            return (False, True, False, None, False)
        if on_login_asia:
            return (True, False, False, None, False)
        return None

    def _try_cn_result(
        self,
    ) -> Optional[Tuple[bool, bool, bool, Optional[str], bool]]:
        """Returns (on_login, disconnected, normal_available, play_button_name, connecting) or None."""
        d3 = _find_by_automation_id(self._controls, D3_TAB_AUTOMATION_IDS)
        if not d3:
            d3 = _find_by_name(self._controls, D3_TAB_NAME_KEYWORDS)
        play = _find_by_automation_id(self._controls, START_GAME_AUTOMATION_IDS)
        if not play:
            play = _find_by_name(self._controls, START_GAME_NAME_KEYWORDS)
        on_login_cn = self.has_cn_login_markers() or _find_by_name(
            self._controls, LOGIN_SCREEN_UI_KEYWORDS_STRICT
        ) is not None
        has_main = d3 is not None and play is not None and not self.has_cn_login_markers()
        connecting = self.has_connecting()
        name = (play.get("name") or "").strip() if play else None
        if has_main and not connecting:
            return (False, False, True, name or "Play", False)
        if has_main and connecting:
            return (False, False, False, None, True)
        if on_login_cn:
            return (True, False, False, None, False)
        return None

    def detected_region(self) -> Optional[str]:
        """
        Returns \"asia\" | \"cn\" | None based on which region's UI matches.
        When preferred_region is set: only try that region (no fallback). When None: try Asia first then CN.
        """
        if self._preferred_region == "asia":
            return "asia" if self._try_asia_result() is not None else None
        if self._preferred_region == "cn":
            return "cn" if self._try_cn_result() is not None else None
        if self._try_asia_result() is not None:
            return "asia"
        if self._try_cn_result() is not None:
            return "cn"
        return None

    def get_dynamic_state_result(
        self,
    ) -> Tuple[bool, bool, bool, Optional[str], bool, Optional[str]]:
        """
        Returns (on_login_screen, disconnected, normal_available, play_button_name, connecting, region_detected).
        When preferred_region is set: only try that region (no fallback). When None: try Asia first then CN.
        """
        if not self._controls:
            return (False, False, False, None, False, None)
        if self._preferred_region == "asia":
            res = self._try_asia_result()
            return (*res, "asia") if res else (False, False, False, None, False, None)
        if self._preferred_region == "cn":
            res = self._try_cn_result()
            return (*res, "cn") if res else (False, False, False, None, False, None)
        res = self._try_asia_result()
        if res:
            return (*res, "asia")
        res = self._try_cn_result()
        if res:
            return (*res, "cn")
        return (False, False, False, None, False, None)

    def is_asia(self) -> bool:
        """True if detected region is Asia (from main UI or login UI)."""
        return self.detected_region() == "asia"

    def is_cn(self) -> bool:
        """True if detected region is CN (from main UI or login UI)."""
        return self.detected_region() == "cn"

    def is_logged_in(self) -> bool:
        """True if main UI is visible (Asia or CN) i.e. logged in and normal available."""
        return self.has_asia_main_ui() or self.has_cn_main_ui()


def build_judge_from_controls(
    controls: List[Dict[str, Any]],
    preferred_region: Optional[str] = None,
) -> BattlenetRegionJudge:
    """Build a region judge from a control list and optional preferred region."""
    return BattlenetRegionJudge(controls, preferred_region)


def get_asia_d3_automation_ids() -> Tuple[str, ...]:
    """Asia D3 tab automation_id list (hardcoded). For use by BattlenetOperation click_d3_tab."""
    return D3_TAB_AUTOMATION_IDS_ASIA


def get_asia_d3_name_keywords() -> Tuple[str, ...]:
    """Asia D3 tab name keywords (hardcoded)."""
    return D3_TAB_NAME_KEYWORDS_ASIA


def get_asia_play_automation_ids() -> Tuple[str, ...]:
    """Asia Play button automation_id list (hardcoded)."""
    return START_GAME_AUTOMATION_IDS_ASIA


def get_asia_play_name_keywords() -> Tuple[str, ...]:
    """Asia Play button name keywords (hardcoded)."""
    return START_GAME_NAME_KEYWORDS_ASIA
