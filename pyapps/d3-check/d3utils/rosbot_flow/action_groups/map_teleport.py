# -*- coding: utf-8 -*-
"""
Map teleport action group: minimize map -> wait one tick -> teleport (two clicks).
ROSBOT_FLOW_MERMAID C7b: ensure map open (C7a) then this group runs in sequence, one step per tick.
"""
from typing import Dict, Tuple

from providor.providor_index import DIABLO_III_WINDOW_TITLES
from share.game_interface_data import get_game_interface_data
from d3utils.screenshot_provider import get_screenshot_provider
from d3utils.d3_start_game_and_teleport_waiter import (
    step_c7b_minimize_only,
    step_c7b_teleport_only,
)
from d3utils.rosbot_flow.action_groups import (
    ActionGroupDef,
    register,
    ACTION_OK,
    ACTION_DONE,
    ACTION_FAIL,
)

# Context keys provided by extension flow: "titles" (tuple). Steps may add/read other keys.
CONTEXT_KEY_TITLES = "titles"


def _ensure_screenshot_context(ctx: Dict) -> Tuple[object, Tuple, Tuple, Tuple, bool]:
    """Return (provider, titles, window_offset, game_window_size, is_windowed). Build from ctx and fresh screenshot."""
    titles = tuple(ctx.get(CONTEXT_KEY_TITLES) or DIABLO_III_WINDOW_TITLES)
    provider = get_screenshot_provider()
    sd = provider.gen(use_optimized_capture=True, window_titles=list(titles))
    if not sd or not sd.game_window_image:
        return (None, titles, (0, 0), (0, 0), False)
    window_offset = sd.window_offset or (0, 0)
    game_window_size = sd.game_window_size or (sd.game_window_image.width, sd.game_window_image.height)
    is_windowed = get_game_interface_data().is_windowed_mode()
    return (provider, titles, window_offset, game_window_size, is_windowed)


def _step_minimize(ctx: Dict) -> str:
    provider, titles, window_offset, game_window_size, is_windowed = _ensure_screenshot_context(ctx)
    if not provider:
        return ACTION_FAIL
    if not step_c7b_minimize_only(provider, titles, window_offset, game_window_size, is_windowed):
        return ACTION_FAIL
    return ACTION_OK


def _step_wait_one_tick(ctx: Dict) -> str:
    return ACTION_OK


def _step_teleport(ctx: Dict) -> str:
    provider, titles, window_offset, game_window_size, is_windowed = _ensure_screenshot_context(ctx)
    if not provider:
        return ACTION_FAIL
    if not step_c7b_teleport_only(provider, titles, window_offset, game_window_size, is_windowed):
        return ACTION_FAIL
    return ACTION_DONE


MAP_TELEPORT_GROUP = ActionGroupDef(
    id="map_teleport",
    steps=[_step_minimize, _step_wait_one_tick, _step_teleport],
)
register(MAP_TELEPORT_GROUP)
