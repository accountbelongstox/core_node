#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Step 2: Port and URL Management

Provides automatic port allocation and URL processing.
"""

from pycore.pyutils.native_ui.step2_port_url.port_allocator import (
    get_port_range,
    register_port_range,
    get_all_port_ranges,
    BUILTIN_PORT_RANGES,
)

from pycore.pyutils.native_ui.step2_port_url.url_handler import (
    URLHandler,
    process_url,
    URLType,
)

__all__ = [
    "get_port_range",
    "register_port_range",
    "get_all_port_ranges",
    "BUILTIN_PORT_RANGES",
    "URLHandler",
    "process_url",
    "URLType",
]
