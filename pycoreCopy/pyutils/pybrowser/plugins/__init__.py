#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Plugins Package

Exports all plugin implementations
"""

from pycore.pyutils.pybrowser.plugins.core import ContentPlugin, AutomationPlugin, DownloadPlugin, EnhancedDownloadPlugin
from pycore.pyutils.pybrowser.plugins.extensions import FormPlugin, ScreenshotPlugin

__all__ = [
    'ContentPlugin',
    'AutomationPlugin',
    'DownloadPlugin',
    'EnhancedDownloadPlugin',
    'FormPlugin',
    'ScreenshotPlugin'
]
