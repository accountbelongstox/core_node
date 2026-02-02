#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Status provider common: shared refresh flow for window-based state.
Used by battlenet_status_provider and d3_status_provider; no generic "window status" here.
Shared logic: apply running flag, optional geometry, detect dynamic triple (on_login, disconnected, third), set dynamic.
"""

from typing import Optional, Dict, Any, Callable, Tuple

from providor.common_imports import ColorPrint


def refresh_window_state(
    game_data: Any,
    window_info_or_none: Optional[Dict[str, Any]],
    *,
    set_running_fn: Callable[[Any, bool], None],
    set_dynamic_fn: Callable[[Any, bool, bool, bool], None],
    detect_dynamic_fn: Callable[[bool, Optional[Dict[str, Any]]], Tuple[bool, bool, bool]],
    apply_geometry_fn: Optional[Callable[[Any, Optional[Dict[str, Any]]], None]] = None,
    log_prefix: str = "",
) -> None:
    """
    Shared flow: set running from window found, apply geometry if provided, detect dynamic triple, set dynamic.
    Each provider supplies set_running_fn, set_dynamic_fn, detect_dynamic_fn, and optionally apply_geometry_fn.
    """
    found = window_info_or_none is not None
    set_running_fn(game_data, found)

    if apply_geometry_fn is not None:
        try:
            apply_geometry_fn(game_data, window_info_or_none)
        except Exception as e:
            ColorPrint.red(f"{log_prefix} apply_geometry error: {e}")

    try:
        on_login, disconnected, third = detect_dynamic_fn(found, window_info_or_none)
        set_dynamic_fn(game_data, on_login, disconnected, third)
    except Exception as e:
        ColorPrint.red(f"{log_prefix} detect_dynamic error: {e}")
        set_dynamic_fn(game_data, False, False, False)
