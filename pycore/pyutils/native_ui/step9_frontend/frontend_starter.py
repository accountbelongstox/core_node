#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Frontend Starter

Convenience function to start frontend based on configuration.
"""

from typing import Optional
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.native_ui.step9_frontend.frontend_config import FrontendConfig
from pycore.pyutils.native_ui.step9_frontend.frontend_thread import FrontendLauncherThread


def start_frontend_if_needed(
    config: FrontendConfig,
    block: bool = False
) -> Optional[FrontendLauncherThread]:
    """
    Start frontend if enabled in config

    Args:
        config: Frontend configuration
        block: Block until frontend is ready (overrides config.block_until_ready)

    Returns:
        FrontendLauncherThread instance or None if disabled

    Example:
        config = FrontendConfig(
            enabled=True,
            framework='vite',
            app_dir=Path('poly_apps/matrix_ui_react'),
            mode='production',
            block_until_ready=True
        )

        frontend = start_frontend_if_needed(config)
        if frontend and frontend.is_ready():
            print("Frontend is ready!")
    """
    if not config.enabled:
        ColorPrint.yellow("[Frontend] Frontend disabled in config")
        return None

    ColorPrint.blue("[Frontend] ========================================")
    ColorPrint.blue("[Frontend] STARTING FRONTEND SERVICE")
    ColorPrint.blue("[Frontend] ========================================")
    ColorPrint.cyan(f"[Frontend] Framework: {config.framework}")
    ColorPrint.cyan(f"[Frontend] Mode: {config.mode}")
    ColorPrint.cyan(f"[Frontend] App Dir: {config.app_dir}")
    ColorPrint.cyan(f"[Frontend] Port: {config.port}")
    ColorPrint.blue("[Frontend] ========================================")

    # Create and start thread
    thread = FrontendLauncherThread(config=config, daemon=True)
    thread.start()

    # Block if requested
    should_block = block or config.block_until_ready

    if should_block:
        ColorPrint.yellow("[Frontend] Blocking until frontend is ready...")
        success = thread.wait_for_ready()

        if not success:
            ColorPrint.red("[Frontend] Frontend failed to start")
            return None

        ColorPrint.green("[Frontend] ========================================")
        ColorPrint.green("[Frontend] FRONTEND READY")
        ColorPrint.green("[Frontend] ========================================")

        if config.mode == "dev":
            ColorPrint.green(f"[Frontend] Dev URL: {thread.get_url()}")
        else:
            ColorPrint.green(f"[Frontend] Static files: {config.static_dir}")

        ColorPrint.green("[Frontend] ========================================")
    else:
        ColorPrint.blue("[Frontend] Started in background (non-blocking)")

    return thread
