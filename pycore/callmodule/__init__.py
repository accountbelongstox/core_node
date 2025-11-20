# -*- coding: utf-8 -*-
"""
Pycore Call Module - Dynamic Module Caller with FastAPI

A FastAPI service for dynamically calling pycore modules via HTTP API.
"""

from .app import create_app
from .global_config import get_global_config, init_global_config

__version__ = '1.0.0'
__all__ = ['create_app', 'get_global_config', 'init_global_config']
