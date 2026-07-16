#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Debug Configuration

Centralized debug settings for MCP backend and proxy.

Environment Variables:
    MCP_BACKEND_DEBUG=1  - Enable backend debug output
    MCP_PROXY_DEBUG=1    - Enable proxy debug output
    SINGLETON_DEBUG=1    - Enable singleton detection debug
    MCP_DEBUG_ALL=1      - Enable all MCP debug output

Usage:
    from pycore.pyctl.mcpctl.debug_config import is_backend_debug, is_proxy_debug, debug_print

    if is_backend_debug():
        debug_print("[Backend] Starting service...")
"""

import os

import time


# Debug flags
MCP_BACKEND_DEBUG = os.environ.get('MCP_BACKEND_DEBUG', '').lower() in ('1', 'true', 'yes')
MCP_PROXY_DEBUG = os.environ.get('MCP_PROXY_DEBUG', '').lower() in ('1', 'true', 'yes')
SINGLETON_DEBUG = os.environ.get('SINGLETON_DEBUG', '').lower() in ('1', 'true', 'yes')
MCP_DEBUG_ALL = os.environ.get('MCP_DEBUG_ALL', '').lower() in ('1', 'true', 'yes')

# Enable all if MCP_DEBUG_ALL is set
if MCP_DEBUG_ALL:
    MCP_BACKEND_DEBUG = True
    MCP_PROXY_DEBUG = True
    SINGLETON_DEBUG = True


def is_backend_debug() -> bool:
    """Check if backend debug is enabled"""
    return MCP_BACKEND_DEBUG


def is_proxy_debug() -> bool:
    """Check if proxy debug is enabled"""
    return MCP_PROXY_DEBUG


def is_singleton_debug() -> bool:
    """Check if singleton debug is enabled"""
    return SINGLETON_DEBUG


def debug_print(message: str, component: str = "MCP"):
    """
    Print debug message if debug is enabled

    Args:
        message: Debug message
        component: Component name (Backend, Proxy, Singleton)
    """
    timestamp = time.strftime('%Y-%m-%d %H:%M:%S')

    # Determine if should print based on component
    should_print = False
    if component.lower() == 'backend' and MCP_BACKEND_DEBUG:
        should_print = True
    elif component.lower() == 'proxy' and MCP_PROXY_DEBUG:
        should_print = True
    elif component.lower() == 'singleton' and SINGLETON_DEBUG:
        should_print = True

    if should_print or MCP_DEBUG_ALL:
        print(f"[{timestamp}] [DEBUG:{component}] {message}")


# Export debug status on import
if __name__ != "__main__":
    if MCP_DEBUG_ALL:
        debug_print("All MCP debug modes enabled", "Config")
    else:
        if MCP_BACKEND_DEBUG:
            debug_print("Backend debug enabled", "Config")
        if MCP_PROXY_DEBUG:
            debug_print("Proxy debug enabled", "Config")
        if SINGLETON_DEBUG:
            debug_print("Singleton debug enabled", "Config")
