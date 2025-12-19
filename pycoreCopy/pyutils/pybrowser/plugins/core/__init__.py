#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Core Plugins Package

Exports core plugin implementations
"""

from pycore.pyutils.pybrowser.plugins.core.content_plugin import ContentPlugin
from pycore.pyutils.pybrowser.plugins.core.automation_plugin import AutomationPlugin
from pycore.pyutils.pybrowser.plugins.core.download_plugin import DownloadPlugin
from pycore.pyutils.pybrowser.plugins.core.enhanced_download_plugin import EnhancedDownloadPlugin

__all__ = ['ContentPlugin', 'AutomationPlugin', 'DownloadPlugin', 'EnhancedDownloadPlugin']
