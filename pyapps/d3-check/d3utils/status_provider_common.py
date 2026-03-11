#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Status provider common: shared refresh flow for window-based state.
Used by battlenet_status_provider and d3_status_provider; no generic "window status" here.
Shared logic: apply running flag, optional geometry, detect dynamic triple (on_login, disconnected, third), set dynamic.
"""

import sys
from typing import Optional, Dict, Any, Callable, Tuple

from pycore.pyfoundations.color_print import ColorPrint


def refresh_window_state(
    game_data: Any,
    window_info_or_none: Optional[Dict[str, Any]],
    *,
    set_running_fn: Callable[[Any, bool], bool],
    set_dynamic_fn: Callable[[Any, bool, bool, bool], bool],
    detect_dynamic_fn: Callable[[bool, Optional[Dict[str, Any]]], Tuple[bool, bool, bool]],
    apply_geometry_fn: Optional[Callable[[Any, Optional[Dict[str, Any]]], None]] = None,
    log_prefix: str = "",
    progress_refresh: Optional[Callable[[str], None]] = None,
    skip_final_newline: bool = False,
) -> bool:
    """
    Shared flow: set running from window found, apply geometry if provided, detect dynamic triple, set dynamic.
    Each provider supplies set_running_fn, set_dynamic_fn, detect_dynamic_fn, and optionally apply_geometry_fn.
    set_running_fn and set_dynamic_fn must return bool indicating if value changed.
    If progress_refresh is set, same-line progress only (short labels: run, geom, detect, dynamic, done); no log_prefix lines.
    When progress_refresh is None but log_prefix is set, use default same-line progress: gray_refresh(log_prefix + " " + step).
    Returns True if any state changed (for conditional notify_state_sync).
    """
    if progress_refresh is None and log_prefix:
        progress_refresh = lambda s: ColorPrint.gray_refresh(f"{log_prefix} {s}")
    found = window_info_or_none is not None
    if progress_refresh:
        progress_refresh("run")
    else:
        ColorPrint.gray(f"{log_prefix} progress: set_running(found={found})")
    running_changed = set_running_fn(game_data, found)

    geometry_changed = False
    if apply_geometry_fn is not None:
        try:
            if progress_refresh:
                progress_refresh("geom")
            else:
                ColorPrint.gray(f"{log_prefix} progress: apply_geometry...")
            apply_geometry_fn(game_data, window_info_or_none)
            geometry_changed = True
            if not progress_refresh:
                ColorPrint.gray(f"{log_prefix} progress: apply_geometry done")
        except Exception as e:
            ColorPrint.red(f"{log_prefix} apply_geometry error: {e}")

    dynamic_changed = False
    try:
        if progress_refresh:
            progress_refresh("detect")
        else:
            ColorPrint.gray(f"{log_prefix} progress: detect_dynamic...")
        on_login, disconnected, third = detect_dynamic_fn(found, window_info_or_none)
        if progress_refresh:
            progress_refresh("dynamic")
        else:
            ColorPrint.gray(f"{log_prefix} progress: detect_dynamic done -> set_dynamic...")
        dynamic_changed = set_dynamic_fn(game_data, on_login, disconnected, third)
        if not progress_refresh:
            ColorPrint.gray(f"{log_prefix} progress: set_dynamic done")
    except Exception as e:
        ColorPrint.red(f"{log_prefix} detect_dynamic error: {e}")
        dynamic_changed = set_dynamic_fn(game_data, False, False, False)

    if progress_refresh:
        progress_refresh("done")
        if not skip_final_newline:
            stream = getattr(ColorPrint, "_output_stream", sys.stderr)
            stream.write("\n")
            stream.flush()

    return running_changed or geometry_changed or dynamic_changed
