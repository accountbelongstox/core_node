#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Thread Registry

Service metadata (THREAD_REGISTRY) and the starter table (SERVICE_STARTERS).
Starters are registered from pylauncher; this layer never imports them.
"""

from typing import Dict, Any, Callable
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


# ============================================================
# Thread Registry - Metadata for all threads
# ============================================================

THREAD_REGISTRY = {
    "heartbeat": {
        "description": "Heartbeat system for task scheduling",
        "default_enabled": True,
        "shutdown_priority": 100,
    },
    "rpc": {
        "description": "FastAPI HTTP controller and event service",
        "default_enabled": False,
        "shutdown_priority": 50,
    },
    "ui": {
        "description": "UI service",
        "default_enabled": False,
        "shutdown_priority": 70,
    },
    "tray": {
        "description": "System tray (platform-specific)",
        "default_enabled": False,
        "shutdown_priority": 85,
    },
}


# ============================================================
# Service Starters - populated by pylauncher.service_starters
# ============================================================

SERVICE_STARTERS: Dict[str, Callable[[Dict[str, Any]], Any]] = {}


def register_starter(name: str, starter_func: Callable[[Dict[str, Any]], Any]) -> None:
    """Bind a starter to a service declared in THREAD_REGISTRY."""
    if name not in THREAD_REGISTRY:
        ColorPrint.red(f"[ThreadRegistry] Unknown service for starter: {name}")
        return
    SERVICE_STARTERS[name] = starter_func
