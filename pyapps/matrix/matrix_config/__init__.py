#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix Configuration Module

Exports:
- get_default_window_size: Get default window size based on screen resolution
- create_ui_config: Create PySide6 UI configuration
"""

from pyapps.matrix.matrix_config.ui_config import (
    get_default_window_size,
    create_ui_config
)

__all__ = [
    'get_default_window_size',
    'create_ui_config'
]
