#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extension Plugins Package

Exports extension plugin implementations
"""

from pycore.pyutils.pybrowser.plugins.extensions.form_plugin import FormPlugin
from pycore.pyutils.pybrowser.plugins.extensions.screenshot_plugin import ScreenshotPlugin

__all__ = ['FormPlugin', 'ScreenshotPlugin']
