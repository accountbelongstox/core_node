# -*- coding: utf-8 -*-
"""
Extension (C branch) phase/deadline/payload; used by flow_master_driver.

All extension steps (phases) are defined here. flow_master_driver uses is_idle() only.
Timing by flow_tick_count: deadline_tick = current_tick + N (e.g. 90 ticks = 180s when 1 tick = 2s).

State 'just entered game': set via payload d3_just_entered when C branch entered from D13 (D13 found D3 window).
Then at C3_GameToolOrigin (game_tool): skip C6/C10, go directly to C7a (ROSBOT_FLOW_MERMAID).
"""
import time
from enum import Enum
from typing import Any, Dict, Optional

from providor.constants.d3 import C10_SKIP_AFTER_TELEPORT_SEC

PAYLOAD_KEY_D3_JUST_ENTERED = "d3_just_entered"
PAYLOAD_KEY_C7A_ROUND = "c7a_round"  # 1=first M round, 2=second M round (ensure map open before teleport)


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
    C_C7a_SEND_M = "C_C7a_SEND_M"             # C7a send M (open/close map)
    C_C7a_WAIT = "C_C7a_WAIT"                 # C7w_Wait 2s
    C_C7a_VERIFY_BOUNTY = "C_C7a_VERIFY_BOUNTY"  # Verify bounty progress to confirm map open; if not found can do second M round
    C_C7b_MINIMIZE = "C_C7b_MINIMIZE"        # C7b minimize map (redirects to C7a then action group)
    C_ACTION_GROUP = "C_ACTION_GROUP"         # Running an action group (one step per tick; other tick events ignored). See docs/ACTION_GROUPS_DESIGN.md.


# Single global state for extension flow (C branch when D3 already running)
_phase: str = ExtensionPhase.IDLE.value
_wait_ticks_remaining: int = 0
_deadline_tick: int = 0
_payload: Dict[str, Any] = {}
# C3 last state for disconnect confirm
_last_c3_state: Optional[str] = None
# Time of last successful teleport (C7b or D13 path); skip C10 for a period after (fresh game not checked for M disconnect). Not cleared by reset_state.
_last_teleport_success_time: Optional[float] = None


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


def set_last_teleport_success_time(t: float) -> None:
    """Record time of last teleport success (C7b or D13 path). Used to skip C10 for a period (fresh game not checked for M disconnect)."""
    global _last_teleport_success_time
    _last_teleport_success_time = t


def get_last_teleport_success_time() -> Optional[float]:
    """Return time of last teleport success, or None."""
    return _last_teleport_success_time


def reset_state() -> None:
    """Clear all extension flow state (idle). Does not clear _last_teleport_success_time."""
    global _phase, _wait_ticks_remaining, _deadline_tick, _payload, _last_c3_state
    _phase = ExtensionPhase.IDLE.value
    _wait_ticks_remaining = 0
    _deadline_tick = 0
    _payload = {}
    _last_c3_state = None


def is_idle() -> bool:
    """Idle = phase IDLE and not within cooldown after last teleport. During cooldown we do not re-enter C branch (avoid C7b loop)."""
    if _phase != ExtensionPhase.IDLE.value:
        return False
    last = get_last_teleport_success_time()
    if last is None:
        return True
    if (time.time() - last) < C10_SKIP_AFTER_TELEPORT_SEC:
        return False
    return True


def is_running() -> bool:
    return _phase != ExtensionPhase.IDLE.value


# Action group running: flow_master skips refresh, runs one action-group step per tick (see ACTION_GROUPS_DESIGN.md).
def is_in_action_group() -> bool:
    """When in action group, flow_master runs only extension_flow_tick_step (one step per tick), no refresh; other tick-driven events ignored."""
    return _phase == ExtensionPhase.C_ACTION_GROUP.value


def is_in_c7b_click_event_group() -> bool:
    """Check if currently in C7b click event group phase (C7b minimize map)."""
    return _phase == ExtensionPhase.C_C7b_MINIMIZE.value
