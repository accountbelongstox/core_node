#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Step 9: Frontend Launcher

Integrated frontend launcher for native UI applications.
Handles:
- React/Vite/Nuxt/Next frontend projects
- Auto dependency installation (pnpm/npm)
- Dev server launching in separate thread
- Production build compilation
- Health check and ready detection
- Debug mode blocking wait

Usage (internal to native_ui):
    from pycore.pyutils.native_ui.step9_frontend import (
        FrontendConfig,
        FrontendLauncherThread,
        start_frontend_if_needed
    )
"""

from .frontend_config import FrontendConfig
from .frontend_thread import FrontendLauncherThread
from .frontend_starter import start_frontend_if_needed

__all__ = [
    'FrontendConfig',
    'FrontendLauncherThread',
    'start_frontend_if_needed',
]
