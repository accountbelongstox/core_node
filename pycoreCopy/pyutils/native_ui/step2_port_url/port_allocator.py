#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Port Allocator - Automatic port range allocation for applications

Provides automatic port range allocation for native UI applications,
eliminating the need for manual port configuration.

Each application gets a dedicated port range for singleton detection
and internal services.
"""

from typing import Dict, Tuple


# Built-in port range mappings (app_id -> (port_start, port_range))
BUILTIN_PORT_RANGES: Dict[str, Tuple[int, int]] = {
    "matrix": (54100, 100),      # Matrix: 54100-54199
    "mcp": (54200, 100),          # MCP: 54200-54299
}

# Dynamic allocation for custom apps
_NEXT_CUSTOM_PORT_START = 54300
_DEFAULT_PORT_RANGE = 100


def get_port_range(app_id: str, debug: bool = False) -> Tuple[int, int]:
    """
    Get port range for an application (auto-allocated)

    Args:
        app_id: Application identifier
        debug: Enable debug output

    Returns:
        Tuple of (port_start, port_range)

    Examples:
        >>> get_port_range("matrix")
        (54100, 100)

        >>> get_port_range("custom_app")
        (54300, 100)  # Auto-allocated
    """
    global _NEXT_CUSTOM_PORT_START

    # Check built-in mappings first
    if app_id in BUILTIN_PORT_RANGES:
        port_start, port_range = BUILTIN_PORT_RANGES[app_id]
        if debug:
            from pycore import ColorPrint
            ColorPrint.blue(
                f"[PortAllocator] {app_id} -> {port_start}-{port_start+port_range-1} (built-in)"
            )
        return port_start, port_range

    # Auto-allocate for custom apps
    port_start = _NEXT_CUSTOM_PORT_START
    port_range = _DEFAULT_PORT_RANGE
    _NEXT_CUSTOM_PORT_START += port_range

    if debug:
        from pycore import ColorPrint
        ColorPrint.blue(
            f"[PortAllocator] {app_id} -> {port_start}-{port_start+port_range-1} (auto-allocated)"
        )

    return port_start, port_range


def register_port_range(app_id: str, port_start: int, port_range: int = 100) -> None:
    """
    Register a custom port range for an application

    Args:
        app_id: Application identifier
        port_start: Starting port number
        port_range: Number of ports in range

    Example:
        >>> register_port_range("my_app", 55000, 50)
        >>> get_port_range("my_app")
        (55000, 50)
    """
    BUILTIN_PORT_RANGES[app_id] = (port_start, port_range)


def get_all_port_ranges() -> Dict[str, Tuple[int, int]]:
    """
    Get all registered port ranges

    Returns:
        Dictionary of app_id -> (port_start, port_range)
    """
    return BUILTIN_PORT_RANGES.copy()
