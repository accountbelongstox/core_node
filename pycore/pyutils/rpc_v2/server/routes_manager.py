#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Route registration helpers for rpc_v2.
"""

import asyncio
from typing import Any, Callable, Dict, List, Optional

from pycore import ColorPrint


class RoutesManager:
    def __init__(self, debug: bool = False):
        self.debug = debug
        self.routes: Dict[str, Callable] = {}
        self.events: Dict[str, List[Callable]] = {}

    def register_route(self, name: str, handler: Callable):
        self.routes[name] = handler
        if self.debug:
            ColorPrint.blue(f"[RoutesManager] Registered route: {name}")

    def get_route(self, name: str) -> Optional[Callable]:
        return self.routes.get(name)

    def has_route(self, name: str) -> bool:
        return name in self.routes

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


__all__ = ["RoutesManager"]
