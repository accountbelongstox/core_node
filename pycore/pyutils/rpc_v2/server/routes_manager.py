#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Route registration helpers for rpc_v2.
"""

import asyncio
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.rpc_v2.common.typing import RouteConfig


class RoutesManager:
    """
    Route registration manager with sync/async support.

    Supports marking routes as synchronous (immediate response) or asynchronous (ACK mechanism).
    """

    def __init__(self, debug: bool = False):
        self.debug = debug
        self.routes: Dict[str, Callable] = {}
        self.route_configs: Dict[str, RouteConfig] = {}  # ✅ Store route metadata
        self.events: Dict[str, List[Callable]] = {}

    def register_route(
        self,
        name: str,
        handler: Callable,
        sync: bool = False,
        description: Optional[str] = None,
        timeout: Optional[float] = None
    ):
        """
        Register RPC route with optional sync mode.

        Args:
            name: Route name
            handler: Route handler function (can be sync or async)
            sync: If True, response is returned immediately without ACK mechanism (default: False)
            description: Optional route description
            timeout: Optional custom timeout for this route
        """
        self.routes[name] = handler

        # ✅ Create route config
        config = RouteConfig(
            handler=handler,
            sync=sync,
            is_coroutine=asyncio.iscoroutinefunction(handler),
            description=description,
            timeout=timeout
        )
        self.route_configs[name] = config

        if self.debug:
            mode = "sync" if sync else "async"
            handler_type = "async" if config.is_coroutine else "sync"
            ColorPrint.blue(f"[RoutesManager] Registered route: {name} (mode={mode}, handler={handler_type})")

    def get_route(self, name: str) -> Optional[Callable]:
        return self.routes.get(name)

    def get_route_config(self, name: str) -> Optional[RouteConfig]:
        """Get route configuration metadata"""
        return self.route_configs.get(name)

    def has_route(self, name: str) -> bool:
        return name in self.routes

    def is_sync_route(self, name: str) -> bool:
        """Check if route is marked as synchronous (immediate response)"""
        config = self.route_configs.get(name)
        return config.sync if config else False

    def register_event_handler(self, event: str, handler: Callable):
        self.events.setdefault(event, []).append(handler)
        if self.debug:
            ColorPrint.blue(f"[RoutesManager] Registered event handler: {event}")

    def emit_event(self, event: str, data: Any):
        for handler in self.events.get(event, []):
            try:
                if asyncio.iscoroutinefunction(handler):
                    asyncio.create_task(handler(data))
                else:
                    handler(data)
            except Exception as exc:
                ColorPrint.red(f"[RoutesManager] Event handler error: {exc}")

    def get_all_routes(self) -> List[str]:
        return list(self.routes.keys())

    def get_route_stats(self) -> Dict[str, Any]:
        """Get route statistics"""
        sync_count = sum(1 for config in self.route_configs.values() if config.sync)
        async_count = len(self.route_configs) - sync_count

        return {
            "total": len(self.routes),
            "sync_routes": sync_count,
            "async_routes": async_count,
            "routes": [
                {
                    "name": name,
                    "sync": config.sync,
                    "is_coroutine": config.is_coroutine,
                    "description": config.description
                }
                for name, config in self.route_configs.items()
            ]
        }


__all__ = ["RoutesManager"]
