# -*- coding: utf-8 -*-
"""
A – Entry and timer (ROSBOT_FLOW_MERMAID.md A block).
All A-block steps/states defined here for alignment with doc.

Flow tick counters (unified by tick_driver global tick + %, see d3utils.tick_driver):
- Global tick: +1 every 1s, task thread single clock.
- flow_master / bn_only: tick % 2 == 0 (every 2s), flow_tick_count = global_tick // 2
- smart_echo OCR: tick % 3 == 0 (every 3s)
- sigint_guard: tick % 1 == 0 (GUI)
- inactive_refresh: tick % 10 == 0 (every 10s when flow off)
"""
from enum import Enum


class ABlockStep(str, Enum):
    """A block steps (ROSBOT_FLOW_MERMAID.md)."""
    A1_Start = "A1_Start"       # Start ROSBOT, set global state, update UI
    A2_Timer = "A2_Timer"       # 2s step via tick % 2; no separate timer
    A3_Tick = "A3_Tick"         # Global state on and this tick has direction?
    A4_Skip = "A4_Skip"         # Skip all branches
    F_Entry = "F_Entry"        # Yes -> F0 pre-judge entry
    A8_Success = "A8_Success"   # Return success, enter E (after C8)
    A9_PanelRunning = "A9_PanelRunning"  # Panel running, enable tasks (after E6)


def step_a3_tick_has_direction(flow_master_enabled: bool, ensure_bn_only_enabled: bool) -> bool:
    """[A3] True if total state is on and this tick should run flow (has direction)."""
    return flow_master_enabled or ensure_bn_only_enabled
