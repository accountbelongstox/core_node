#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UI Thread Test Application

Demonstrates using pylauncher with configuration files
to start NativeUIThread as an independent service.

Usage:
    python -m pyapps.ui_thread_test.main
"""

from .main import UIThreadTestApp, start

__all__ = ['UIThreadTestApp', 'start']
__version__ = '1.0.0'
