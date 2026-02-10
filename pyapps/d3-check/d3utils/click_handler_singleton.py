#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ClickHandler singleton for d3-check.
All shared click operations use this single instance (export-time instantiation).
"""

from pycore.pyutils.click_handler import ClickHandler

# 导出前实例化：全项目唯一 ClickHandler 实例
_click_handler_instance = ClickHandler()


def get_click_handler() -> ClickHandler:
    """Return the global ClickHandler instance (singleton)."""
    return _click_handler_instance
