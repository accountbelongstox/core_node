# -*- coding: utf-8 -*-
"""
A – Entry and timer (ROSBOT_FLOW_MERMAID.md A block).
All A-block steps/states defined here for alignment with doc.
"""
from enum import Enum


class ABlockStep(str, Enum):
    """A block steps (ROSBOT_FLOW_MERMAID.md)."""
    A1_Start = "A1_Start"       # Start ROSBOT, set global state, update UI
    A2_Timer = "A2_Timer"       # Driven by 2s flow tick only; no separate timer (PROJECT_STANDARDS §4.1)
    A3_Tick = "A3_Tick"         # Global state on and this tick has direction?
    A4_Skip = "A4_Skip"         # Skip all branches
    F_Entry = "F_Entry"        # Yes -> F0 pre-judge entry
    A8_Success = "A8_Success"   # Return success, enter E (after C8)
    A9_PanelRunning = "A9_PanelRunning"  # Panel running, enable tasks (after E6)


def step_a3_tick_has_direction(flow_master_enabled: bool, ensure_bn_only_enabled: bool) -> bool:
    """[A3] True if total state is on and this tick should run flow (has direction)."""
    return flow_master_enabled or ensure_bn_only_enabled
