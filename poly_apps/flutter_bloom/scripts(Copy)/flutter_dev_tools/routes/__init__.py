#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Routes Module - HTTP request handlers organized by functionality
"""

from routes.app_routes import AppRoutesHandler
from routes.file_routes import FileRoutesHandler
from routes.folder_routes import FolderRoutesHandler
from routes.pageview_routes import PageViewRoutesHandler
from routes.comparison_routes import ComparisonRoutesHandler
from routes.config_routes import ConfigRoutesHandler
from routes.system_routes import SystemRoutesHandler
from routes.static_routes import StaticRoutesHandler

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
