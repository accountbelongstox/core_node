#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Native UI window/UI signal type names."""

from enum import Enum


class SignalType(Enum):
    """Signal type enumeration"""
    # Window control signals
    WINDOW_CLOSE = "window_close"
    WINDOW_MINIMIZE = "window_minimize"
    WINDOW_MAXIMIZE = "window_maximize"
    WINDOW_RESTORE = "window_restore"
    WINDOW_RESTART = "window_restart"
    WINDOW_SHOW = "window_show"
    WINDOW_HIDE = "window_hide"

    # UI event signals
    UI_READY = "ui_ready"
    UI_FOCUS = "ui_focus"
    UI_BLUR = "ui_blur"

    # Custom signals
    CUSTOM = "custom"
