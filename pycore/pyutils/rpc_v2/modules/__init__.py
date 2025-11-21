#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC v2 Module System

Provides hardcoded module registration, preloading, and unified calling interface.
Prevents frequent initialization of third-party libraries, improving performance.
"""

from .module_registry import SUPPORTED_MODULES, get_module_info, get_all_modules
from .module_loader import ModuleLoader, get_module_loader
from .module_call_handler import ModuleCallHandler
from .auto_register import register_module_routes
from .homepage_routes import register_homepage_routes

__all__ = [
    'SUPPORTED_MODULES',
    'get_module_info',
    'get_all_modules',
    'ModuleLoader',
    'get_module_loader',
    'ModuleCallHandler',
    'register_module_routes',
    'register_homepage_routes',
]
