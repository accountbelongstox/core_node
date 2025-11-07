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

from .webview_launcher import (
    WebviewGUILauncher,
    create_webview_launcher,
    get_webview_launcher,
    launch_pymatrix_gui
)

__all__ = [
    'HTTPBridgeServer',
    'get_http_bridge',
    'create_http_bridge',
    'UniversalGUILauncher',
    'SystemTrayManager',
    'get_universal_gui_launcher',
    'set_menu_labels',
    'WebviewGUILauncher',
    'create_webview_launcher',
    'get_webview_launcher',
    'launch_pymatrix_gui'
]
