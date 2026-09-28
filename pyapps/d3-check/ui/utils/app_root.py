#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Application Root Helper
Delegates to share.ui_registry; main UI registers on startup; this module provides compatibility exports.
"""

import tkinter as tk
from typing import Any, Optional

from share.ui_registry import get_root, get_panel


def get_app_root() -> Optional[tk.Tk]:
    """Return main application root. Delegates to share.ui_registry.get_root()."""
    return get_root()


def get_ui_panel(key: str) -> Any:
    """
    Return panel by key. Delegates to share.ui_registry.get_panel(key).
    Keys: providor.constants.ui.PANEL_KEY_* (main, rosbot, d4, calibration, log).
    """
    return get_panel(key)
