# -*- coding: utf-8 -*-
"""
MCP Backend Routes (Modular Structure)

Exports route registration functions for each module
"""

from .meta import register_meta_routes
from .file import register_file_routes
from .database import register_database_routes
from .codebase import register_codebase_routes

__all__ = [
    'register_meta_routes',
    'register_file_routes',
    'register_database_routes',
    'register_codebase_routes',
]
