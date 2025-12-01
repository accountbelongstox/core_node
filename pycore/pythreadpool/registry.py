#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Thread Registry

Combines thread metadata (THREAD_REGISTRY) and starter functions (SERVICE_STARTERS)
into a single source of truth.
"""

from typing import Dict, Any, Callable
from pycore import ColorPrint


# ============================================================
# Thread Registry - Metadata for all threads
# ============================================================

THREAD_REGISTRY = {
    "heartbeat": {
        "description": "Heartbeat system for task scheduling",
        "default_enabled": True,
        "shutdown_priority": 100,  # Shutdown last (主进程后关)
    },
    "rpc": {
        "description": "HTTP/WebSocket RPC server (legacy)",
        "default_enabled": False,
        "shutdown_priority": 50,  # Shutdown first (子进程先关)
    },
    "rpc_v2": {
        "description": "Unified RPC server v2 (FastAPI + WebSocket)",
        "default_enabled": False,
        "shutdown_priority": 50,
    },
    "speech": {
        "description": "Speech transcription service",
        "default_enabled": False,
        "shutdown_priority": 60,
    },
    "tts_switch": {
        "description": "TTS provider switching service",
        "default_enabled": False,
        "shutdown_priority": 60,
    },
    "stt_switch": {
        "description": "STT provider switching service",
        "default_enabled": False,
        "shutdown_priority": 60,
    },
    "ui": {
        "description": "UI service",
        "default_enabled": False,
        "shutdown_priority": 70,
    },
    "tray": {
        "description": "System tray (platform-specific)",
        "default_enabled": False,
        "shutdown_priority": 85,  # Shutdown near last (keep visible until end)
    },
}


# ============================================================
# Service Starters - Function mapping
# ============================================================

# Will be populated by starters.py
SERVICE_STARTERS: Dict[str, Callable] = {}


def register_service(
    name: str,
    starter_func: Callable,
    description: str = "",
    default_enabled: bool = False,
    shutdown_priority: int = 50
):
    """
    Register a service with metadata and starter function

    Args:
        name: Service name
        starter_func: Function that starts the service
        description: Service description
        default_enabled: Whether service is enabled by default
        shutdown_priority: Shutdown priority (lower = earlier)
    """
    # Register metadata
    THREAD_REGISTRY[name] = {
        "description": description,
        "default_enabled": default_enabled,
        "shutdown_priority": shutdown_priority,
    }

    # Register starter function
    SERVICE_STARTERS[name] = starter_func

    ColorPrint.blue(f"[ThreadRegistry] Registered service: {name}")
