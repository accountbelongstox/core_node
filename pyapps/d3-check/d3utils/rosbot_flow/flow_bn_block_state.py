# -*- coding: utf-8 -*-
"""
BN block state (B1..B16). Two independent copies so BN-only and Flow-master
can run at the same time without overwriting each other.
- for_bn_only=True: state used when tick_battlenet_ready_flow(no_activate=True) (BN-only flow).
- for_bn_only=False: state used when tick_battlenet_ready_flow(no_activate=False) (Flow-master flow).
"""
from dataclasses import dataclass
from enum import Enum
from typing import Literal

FlowWhich = Literal[True, False]  # True=bn_only, False=flow_master


class BNStep(str, Enum):
    """All steps of the BN block (ROSBOT_FLOW_MERMAID B block)."""
    BN_Entry = "BN_Entry"
    BN_Win = "BN_Win"
    BN_Start = "BN_Start"
    BN_Wait = "BN_Wait"
    BN_WaitResult = "BN_WaitResult"
    BN_UI = "BN_UI"
    BN_Login1 = "BN_Login1"
    BN_Login2 = "BN_Login2"
    BN_LoginAsia = "BN_LoginAsia"
    BN_First = "BN_First"
    BN_B4p_BrowserWait = "BN_B4p_BrowserWait"
    BN_Act = "BN_Act"
    BN_WaitPlay = "BN_WaitPlay"
    BN_Poll = "BN_Poll"
    BN_Exit = "BN_Exit"
    BN_ExitWait = "BN_ExitWait"
    BN_B14_Ok = "BN_B14_Ok"
    BN_B15a_Offline = "BN_B15a_Offline"
    BN_B15b_Timeout = "BN_B15b_Timeout"
    BN_B15c_Other = "BN_B15c_Other"
    BN_Confirmed = "BN_Confirmed"


B7_TRIGGER_D_AFTER_SKIPS = 6
B7_TRIGGER_D_COOLDOWN_SEC = 30.0

BNNode = BNStep


@dataclass
class BNBlockState:
    """State for one BN block instance (one flow)."""
    current_step: BNStep = BNStep.BN_Entry
    b5_entry_reason: str = ""
    wait_until: float = 0.0
    b7_poll_deadline: float = 0.0
    b13_poll_deadline: float = 0.0
    oauth_wait_until: float = 0.0
    browser_fallback_deadline: float = 0.0
    b11_deadline_tick: int = 0  # B11 timeout by flow tick (current_tick >= this -> timeout)
    battlenet_tick_confirmed: bool = False
    bn_flow_ever_confirmed: bool = False
    b7_skip_count: int = 0
    b7_last_trigger_time: float = 0.0


_block_bn_only: BNBlockState = BNBlockState()
_block_flow_master: BNBlockState = BNBlockState()


def _block(for_bn_only: bool) -> BNBlockState:
    return _block_bn_only if for_bn_only else _block_flow_master


class BNBlockCtx:
    """Context bound to one flow's BN block; use inside tick_battlenet_ready_flow(no_activate)."""
    __slots__ = ("_b",)

    def __init__(self, for_bn_only: bool):
        self._b = _block(for_bn_only)

    def get_current_step(self) -> BNStep:
        return self._b.current_step

    def set_current_step(self, step: BNStep) -> None:
        self._b.current_step = step

    def get_b5_entry_reason(self) -> str:
        return self._b.b5_entry_reason

    def set_b5_entry_reason(self, reason: str) -> None:
        self._b.b5_entry_reason = reason

    def get_wait_until(self) -> float:
        return self._b.wait_until

    def set_wait_until(self, t: float) -> None:
        self._b.wait_until = t

    def get_b7_poll_deadline(self) -> float:
        return self._b.b7_poll_deadline

    def set_b7_poll_deadline(self, t: float) -> None:
        self._b.b7_poll_deadline = t

    def get_b13_poll_deadline(self) -> float:
        return self._b.b13_poll_deadline

    def set_b13_poll_deadline(self, t: float) -> None:
        self._b.b13_poll_deadline = t

    def get_oauth_wait_until(self) -> float:
        return self._b.oauth_wait_until

    def set_oauth_wait_until(self, t: float) -> None:
        self._b.oauth_wait_until = t

    def get_browser_fallback_deadline(self) -> float:
        return self._b.browser_fallback_deadline

    def set_browser_fallback_deadline(self, t: float) -> None:
        self._b.browser_fallback_deadline = t

    def get_b11_deadline_tick(self) -> int:
        return self._b.b11_deadline_tick

    def set_b11_deadline_tick(self, tick: int) -> None:
        self._b.b11_deadline_tick = tick

    def get_bn_flow_ever_confirmed(self) -> bool:
        return self._b.bn_flow_ever_confirmed

    def set_bn_flow_ever_confirmed(self, value: bool) -> None:
        self._b.bn_flow_ever_confirmed = value

    def set_battlenet_tick_confirmed(self) -> None:
        self._b.battlenet_tick_confirmed = True

    def get_and_clear_battlenet_tick_confirmed(self) -> bool:
        v = self._b.battlenet_tick_confirmed
        self._b.battlenet_tick_confirmed = False
        return v

    def get_b7_skip_count(self) -> int:
        return self._b.b7_skip_count

    def set_b7_skip_count(self, n: int) -> None:
        self._b.b7_skip_count = n

    def get_b7_last_trigger_time(self) -> float:
        return self._b.b7_last_trigger_time

    def set_b7_last_trigger_time(self, t: float) -> None:
        self._b.b7_last_trigger_time = t

    def reset_confirmed_to_poll(self) -> None:
        if self._b.current_step == BNStep.BN_Confirmed:
            self._b.current_step = BNStep.BN_Poll


def get_bn_block_ctx(for_bn_only: bool) -> BNBlockCtx:
    """Use inside tick_battlenet_ready_flow: ctx = get_bn_block_ctx(no_activate)."""
    return BNBlockCtx(for_bn_only)


def get_current_step(for_bn_only: bool) -> BNStep:
    return _block(for_bn_only).current_step


def set_current_step(step: BNStep, for_bn_only: bool) -> None:
    _block(for_bn_only).current_step = step


def get_b5_entry_reason(for_bn_only: bool) -> str:
    return _block(for_bn_only).b5_entry_reason


def set_b5_entry_reason(reason: str, for_bn_only: bool) -> None:
    _block(for_bn_only).b5_entry_reason = reason


def get_wait_until(for_bn_only: bool) -> float:
    return _block(for_bn_only).wait_until


def set_wait_until(t: float, for_bn_only: bool) -> None:
    _block(for_bn_only).wait_until = t


def get_b7_poll_deadline(for_bn_only: bool) -> float:
    return _block(for_bn_only).b7_poll_deadline


def set_b7_poll_deadline(t: float, for_bn_only: bool) -> None:
    _block(for_bn_only).b7_poll_deadline = t


def get_b13_poll_deadline(for_bn_only: bool) -> float:
    return _block(for_bn_only).b13_poll_deadline


def set_b13_poll_deadline(t: float, for_bn_only: bool) -> None:
    _block(for_bn_only).b13_poll_deadline = t


def get_oauth_wait_until(for_bn_only: bool) -> float:
    return _block(for_bn_only).oauth_wait_until


def set_oauth_wait_until(t: float, for_bn_only: bool) -> None:
    _block(for_bn_only).oauth_wait_until = t


def get_bn_flow_ever_confirmed(for_bn_only: bool) -> bool:
    return _block(for_bn_only).bn_flow_ever_confirmed


def set_bn_flow_ever_confirmed(value: bool, for_bn_only: bool) -> None:
    _block(for_bn_only).bn_flow_ever_confirmed = value


def set_battlenet_tick_confirmed(for_bn_only: bool) -> None:
    _block(for_bn_only).battlenet_tick_confirmed = True


def get_and_clear_battlenet_tick_confirmed(for_bn_only: bool) -> bool:
    b = _block(for_bn_only)
    v = b.battlenet_tick_confirmed
    b.battlenet_tick_confirmed = False
    return v


def get_b7_skip_count(for_bn_only: bool) -> int:
    return _block(for_bn_only).b7_skip_count


def set_b7_skip_count(n: int, for_bn_only: bool) -> None:
    _block(for_bn_only).b7_skip_count = n


def get_b7_last_trigger_time(for_bn_only: bool) -> float:
    return _block(for_bn_only).b7_last_trigger_time


def set_b7_last_trigger_time(t: float, for_bn_only: bool) -> None:
    _block(for_bn_only).b7_last_trigger_time = t


def reset_bn_block_state(for_bn_only: bool) -> None:
    """Reset one flow's BN block to entry."""
    b = _block(for_bn_only)
    b.current_step = BNStep.BN_Entry
    b.b5_entry_reason = ""
    b.wait_until = 0.0
    b.b7_poll_deadline = 0.0
    b.b13_poll_deadline = 0.0
    b.oauth_wait_until = 0.0
    b.browser_fallback_deadline = 0.0
    b.b11_deadline_tick = 0
    b.battlenet_tick_confirmed = False
    b.bn_flow_ever_confirmed = False
    b.b7_skip_count = 0
    b.b7_last_trigger_time = 0.0


def reset_confirmed_to_poll(for_bn_only: bool) -> None:
    if _block(for_bn_only).current_step == BNStep.BN_Confirmed:
        _block(for_bn_only).current_step = BNStep.BN_Poll


def is_bn_flow_in_login_phase(for_bn_only: bool) -> bool:
    return _block(for_bn_only).current_step in (BNStep.BN_LoginAsia, BNStep.BN_Login1, BNStep.BN_Login2)


def enter_battlenet_at_b2(for_bn_only: bool) -> None:
    _block(for_bn_only).current_step = BNStep.BN_Win
