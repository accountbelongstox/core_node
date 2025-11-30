#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Routes Module - HTTP request handlers organized by functionality
"""

from pycore.pyutils.flutter_dev_tools.routes.app_routes import AppRoutesHandler
from pycore.pyutils.flutter_dev_tools.routes.file_routes import FileRoutesHandler
from pycore.pyutils.flutter_dev_tools.routes.folder_routes import FolderRoutesHandler
from pycore.pyutils.flutter_dev_tools.routes.pageview_routes import PageViewRoutesHandler
from pycore.pyutils.flutter_dev_tools.routes.comparison_routes import ComparisonRoutesHandler
from pycore.pyutils.flutter_dev_tools.routes.config_routes import ConfigRoutesHandler
from pycore.pyutils.flutter_dev_tools.routes.system_routes import SystemRoutesHandler
from pycore.pyutils.flutter_dev_tools.routes.static_routes import StaticRoutesHandler

__all__ = [
    'AppRoutesHandler',
    'FileRoutesHandler',
    'FolderRoutesHandler',
    'PageViewRoutesHandler',
    'ComparisonRoutesHandler',
    'ConfigRoutesHandler',
    'SystemRoutesHandler',
    'StaticRoutesHandler',
]
