# -*- coding: utf-8 -*-
"""
Extension (C branch) phase/deadline/payload; used by flow_master_driver.

All extension steps (phases) are defined here. flow_master_driver uses is_idle() only.
Timing by flow_tick_count: deadline_tick = current_tick + N (e.g. 30 ticks = 60s when 1 tick = 2s).
"""
from enum import Enum
from typing import Any, Dict, Optional


class ExtensionPhase(str, Enum):
    """C block phases (ROSBOT_FLOW_MERMAID.md C D3 already running direct). IDLE = not in C branch."""
    IDLE = "idle"
    C_ENTRY = "C_ENTRY"                       # C1_Entry
    C_C3_LOOP = "C_C3_LOOP"                   # C3_Step -> C3_Result loop
    C_C3_WAIT = "C_C3_WAIT"                  # C3w_Wait
    C_C3_DISCONFIRM = "C_C3_DISCONFIRM"       # C3 second confirm disconnect
    C_C4_BRANCH = "C_C4_BRANCH"               # C3_Result branch
    C_F1_WAIT_GAME_TOOL = "C_F1_WAIT_GAME_TOOL"  # C5_StartGame -> C5w_Wait
    C_C10_SEND_M = "C_C10_SEND_M"             # C10_Check send M
    C_C10_WAIT = "C_C10_WAIT"
    C_C10_COMPARE = "C_C10_COMPARE"           # C10_Result compare
    C_C7a_SEND_M = "C_C7a_SEND_M"             # C7a press M
    C_C7a_WAIT = "C_C7a_WAIT"                 # C7w_Wait
    C_C7b_MINIMIZE = "C_C7b_MINIMIZE"        # C7b minimize map
    C_C7b_WAIT = "C_C7b_WAIT"
    C_C7b_TELEPORT = "C_C7b_TELEPORT"         # C7b teleport -> C8_Result -> A8_Success


# Single global state for extension flow (C branch when D3 already running)
_phase: str = ExtensionPhase.IDLE.value
_wait_ticks_remaining: int = 0
_deadline_tick: int = 0
_payload: Dict[str, Any] = {}
# C3 last state for disconnect confirm
_last_c3_state: Optional[str] = None


def get_phase() -> str:
    return _phase


def set_phase(phase: str) -> None:
    global _phase
    _phase = phase


def get_wait_ticks_remaining() -> int:
    return _wait_ticks_remaining


def set_wait_ticks_remaining(n: int) -> None:
    global _wait_ticks_remaining
    _wait_ticks_remaining = n


def get_deadline_tick() -> int:
    return _deadline_tick


def set_deadline_tick(tick: int) -> None:
    global _deadline_tick
    _deadline_tick = tick


def get_payload() -> Dict[str, Any]:
    return _payload.copy()


def set_payload(key: str, value: Any) -> None:
    global _payload
    _payload[key] = value


def get_last_c3_state() -> Optional[str]:
    return _last_c3_state


def set_last_c3_state(s: Optional[str]) -> None:
    global _last_c3_state
    _last_c3_state = s


def reset_state() -> None:
    """Clear all extension flow state (idle)."""
    global _phase, _wait_ticks_remaining, _deadline_tick, _payload, _last_c3_state
    _phase = ExtensionPhase.IDLE.value
    _wait_ticks_remaining = 0
    _deadline_tick = 0
    _payload = {}
    _last_c3_state = None


def is_idle() -> bool:
    return _phase == ExtensionPhase.IDLE.value


def is_running() -> bool:
    return _phase != ExtensionPhase.IDLE.value
