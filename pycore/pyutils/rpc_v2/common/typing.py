#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Typed helpers shared across rpc_v2 modules.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, Optional


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
