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

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method

# Built-in port range mappings (app_id -> (port_start, port_range))
BUILTIN_PORT_RANGES: Dict[str, Tuple[int, int]] = {
    "matrix": (54100, 100),      # Matrix: 54100-54199
    "mcp": (54200, 100),          # MCP: 54200-54299
}

_CUSTOM_PORT_START = 54300
_DEFAULT_PORT_RANGE = 100


class PortRangeRegistry:
    """Own dynamic port allocation state on one THREAD_BUS worker."""

    def __init__(self) -> None:
        self._ranges = dict(BUILTIN_PORT_RANGES)
        self._next_custom_port_start = _CUSTOM_PORT_START
        init_serialized_owner(
            self,
            "native_ui.port_allocator.state",
            "NativeUIPortAllocatorStateThread",
        )

    @serialized_method
    def get(self, app_id: str) -> Tuple[int, int, bool]:
        registered = self._ranges.get(app_id)
        if registered is not None:
            return registered[0], registered[1], app_id in BUILTIN_PORT_RANGES

        port_start = self._next_custom_port_start
        self._next_custom_port_start += _DEFAULT_PORT_RANGE
        allocated = (port_start, _DEFAULT_PORT_RANGE)
        self._ranges[app_id] = allocated
        return allocated[0], allocated[1], False

    @serialized_method
    def register(self, app_id: str, port_start: int, port_range: int) -> None:
        self._ranges[app_id] = (port_start, port_range)

    @serialized_method
    def snapshot(self) -> Dict[str, Tuple[int, int]]:
        return dict(self._ranges)


_PORT_RANGE_REGISTRY = PortRangeRegistry()


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
    port_start, port_range, built_in = _PORT_RANGE_REGISTRY.get(app_id)

    if debug:
        ColorPrint.blue(
            f"[PortAllocator] {app_id} -> {port_start}-{port_start+port_range-1} "
            f"({'built-in' if built_in else 'allocated'})"
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
    _PORT_RANGE_REGISTRY.register(app_id, port_start, port_range)


def get_all_port_ranges() -> Dict[str, Tuple[int, int]]:
    """
    Get all registered port ranges

    Returns:
        Dictionary of app_id -> (port_start, port_range)
    """
    return _PORT_RANGE_REGISTRY.snapshot()
