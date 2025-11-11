#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Port Allocator - Automatic port range allocation for applications

Provides automatic port range allocation based on app_id.
Each application gets a dedicated port range for singleton detection.

Built-in port mappings:
- matrix: 54100-54199 (100 ports)
- mcp: 54200-54299 (100 ports)
- Custom apps: 54300+ (auto-allocated)
"""

from typing import Tuple, Dict
from pycore.pyfoundations import ColorPrint


# Built-in port mappings for known applications
BUILTIN_PORT_RANGES: Dict[str, Tuple[int, int]] = {
    "matrix": (54100, 100),      # Matrix: 54100-54199
    "mcp": (54200, 100),          # MCP: 54200-54299
}

# Next available port start for custom apps
_NEXT_CUSTOM_PORT_START = 54300
_DEFAULT_PORT_RANGE = 100


def get_port_range(app_id: str, debug: bool = False) -> Tuple[int, int]:
    """
    Get port range for an application (auto-allocated)

    Args:
        app_id: Application unique identifier
        debug: Enable debug output

    Returns:
        Tuple of (port_start, port_range)

    Examples:
        >>> get_port_range("matrix")
        (54100, 100)
        >>> get_port_range("mcp")
        (54200, 100)
        >>> get_port_range("my_custom_app")
        (54300, 100)
    """
    global _NEXT_CUSTOM_PORT_START

    # Check built-in mappings first
    if app_id in BUILTIN_PORT_RANGES:
        port_start, port_range = BUILTIN_PORT_RANGES[app_id]
        if debug:
            ColorPrint.blue(
                f"[PortAllocator] App '{app_id}' using built-in port range: "
                f"{port_start}-{port_start + port_range - 1}"
            )
        return port_start, port_range

    # Allocate new port range for custom app
    port_start = _NEXT_CUSTOM_PORT_START
    port_range = _DEFAULT_PORT_RANGE

    if debug:
        ColorPrint.blue(
            f"[PortAllocator] App '{app_id}' auto-allocated port range: "
            f"{port_start}-{port_start + port_range - 1}"
        )

    # Update next available port start
    _NEXT_CUSTOM_PORT_START += port_range

    return port_start, port_range


def register_builtin_app(app_id: str, port_start: int, port_range: int = 100) -> None:
    """
    Register a built-in application with fixed port range

    Args:
        app_id: Application unique identifier
        port_start: Starting port number
        port_range: Number of ports in range (default: 100)

    Note:
        This should only be called during initialization for core applications.
        Custom apps should rely on auto-allocation.
    """
    if app_id in BUILTIN_PORT_RANGES:
        ColorPrint.yellow(
            f"[PortAllocator] Warning: App '{app_id}' already registered, "
            f"overwriting with new range {port_start}-{port_start + port_range - 1}"
        )

    BUILTIN_PORT_RANGES[app_id] = (port_start, port_range)
    ColorPrint.blue(
        f"[PortAllocator] Registered built-in app '{app_id}': "
        f"{port_start}-{port_start + port_range - 1}"
    )


def get_all_port_ranges() -> Dict[str, Tuple[int, int]]:
    """
    Get all registered port ranges

    Returns:
        Dictionary mapping app_id to (port_start, port_range) tuples
    """
    return BUILTIN_PORT_RANGES.copy()


def is_port_range_available(port_start: int, port_range: int) -> bool:
    """
    Check if a port range conflicts with existing allocations

    Args:
        port_start: Starting port number
        port_range: Number of ports in range

    Returns:
        True if range is available (no conflicts), False otherwise
    """
    port_end = port_start + port_range - 1

    for existing_start, existing_range in BUILTIN_PORT_RANGES.values():
        existing_end = existing_start + existing_range - 1

        # Check for overlap
        if (port_start <= existing_end and port_end >= existing_start):
            return False

    return True
