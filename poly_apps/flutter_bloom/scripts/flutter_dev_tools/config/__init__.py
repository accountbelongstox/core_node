#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Configuration Module - Unified configuration management
"""

from config.app_config import AppConfig, get_app_config
from config.routes_config import RoutesConfig, get_routes_config

__all__ = [
    'AppConfig',
    'get_app_config',
    'RoutesConfig',
    'get_routes_config',
]
