#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Automation Package

Exports automation components for browser automation workflows.
"""

from pycore.pyctl.pybrowserauto.automation.screenshot_manager import ScreenshotManager
from pycore.pyctl.pybrowserauto.automation.page_switcher import PageSwitcher
from pycore.pyctl.pybrowserauto.automation.automation_controller import AutomationController

__all__ = [
    'ScreenshotManager',
    'PageSwitcher',
    'AutomationController'
]

__version__ = '1.0.0'
