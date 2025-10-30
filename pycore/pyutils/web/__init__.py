#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pyutils.web - Web GUI Bridge Module
Provides HTTP server and utilities for web-based GUI communication
"""

from .http_bridge import (
    HTTPBridgeServer,
    get_http_bridge,
    create_http_bridge
)

from .universal_gui_launcher import (
    UniversalGUILauncher,
    SystemTrayManager,
    get_universal_gui_launcher,
    set_menu_labels
)

__all__ = [
    'HTTPBridgeServer',
    'get_http_bridge',
    'create_http_bridge',
    'UniversalGUILauncher',
    'SystemTrayManager',
    'get_universal_gui_launcher',
    'set_menu_labels'
]
