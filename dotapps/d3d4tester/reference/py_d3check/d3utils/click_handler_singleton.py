#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# DOT-REF: dotapps/d3d4tester/D3D4TesterCore/GameInputHelper.cs
# DOT-REF: dotcore/DotCore.Utils/Input/ClickHandler.cs
"""
ClickHandler singleton for d3-check.
All shared click operations use this single instance (export-time instantiation).
"""

from pycore.pyctl.desktop.click_handler import ClickHandler

# Single ClickHandler instance; use get_click_handler only
_click_handler_instance = ClickHandler()


def get_click_handler() -> ClickHandler:
    """Return the global ClickHandler instance (singleton)."""
    return _click_handler_instance
