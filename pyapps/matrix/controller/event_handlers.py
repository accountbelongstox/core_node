#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Event Handlers for Matrix Application

Registers THREAD_BUS event handlers for tray actions.
This module only registers event handlers, does not start any threads.
"""

import webbrowser

from pycore import ColorPrint, THREAD_BUS


def register_matrix_event_handlers(
    frontend_port: int,
    backend_port: int,
    backend_host: str,
    frontend_mode: str = 'production'
):
    """
    Register THREAD_BUS event handlers for Matrix tray actions

    Args:
        frontend_port: Frontend port (dev mode only)
        backend_port: Backend port (RPC v2)
        backend_host: Backend host
        frontend_mode: Frontend mode ('dev' | 'production')
    """
    ColorPrint.blue("[Matrix EventHandlers] Registering tray event handlers...")

    # Determine frontend URL based on mode
    if frontend_mode == 'production':
        frontend_url = f"http://localhost:{backend_port}"
    else:
        frontend_url = f"http://localhost:{frontend_port}"

    def handle_tray_open_frontend(event_data):
        """Open frontend in browser"""
        ColorPrint.blue(f"[Matrix Tray] Opening frontend: {frontend_url}")
        webbrowser.open(frontend_url)

    def handle_tray_open_api_docs(event_data):
        """Open API docs in browser"""
        docs_url = f"http://{backend_host}:{backend_port}/docs"
        ColorPrint.blue(f"[Matrix Tray] Opening API docs: {docs_url}")
        webbrowser.open(docs_url)

    def handle_tray_exit(event_data):
        """Exit application via THREAD_BUS shutdown"""
        ColorPrint.yellow("[Matrix Tray] Exit requested via tray...")

        # Trigger global shutdown via THREAD_BUS
        if not THREAD_BUS.is_shutdown_requested():
            THREAD_BUS.request_shutdown(reason="Tray exit requested", execute_handlers=True)

    # Register all event handlers
    THREAD_BUS.register_event_handler('tray_action_open_frontend', handle_tray_open_frontend)
    THREAD_BUS.register_event_handler('tray_action_open_api_docs', handle_tray_open_api_docs)
    THREAD_BUS.register_event_handler('tray_action_exit', handle_tray_exit)

    ColorPrint.green("[Matrix EventHandlers] Tray event handlers registered")
