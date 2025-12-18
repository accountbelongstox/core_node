#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Typed helpers shared across rpc_v2 modules.
"""

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Optional


@dataclass
class RPCRequestContext:
    """
    Runtime context that is passed to controller callbacks.

    Attributes:
        transport: 'http' or 'websocket'
        client_id: Logical client identifier (persists across reconnects)
        request: Raw FastAPI/Starlette request object (for HTTP only)
        websocket: FastAPI WebSocket instance (for WS only)
        metadata: Mutable dictionary for per-call state
    """

    transport: str
    client_id: Optional[str]
    request: Optional[Any] = None
    websocket: Optional[Any] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RouteConfig:
    """
    Route configuration metadata.

    Attributes:
        handler: The route handler function (sync or async)
        sync: If True, response is returned immediately without ACK mechanism
        is_coroutine: True if handler is async function
        description: Optional route description
        timeout: Optional custom timeout for this route
    """

    handler: Callable
    sync: bool = False
    is_coroutine: bool = False
    description: Optional[str] = None
    timeout: Optional[float] = None
