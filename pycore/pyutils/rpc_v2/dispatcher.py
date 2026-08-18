# -*- coding: utf-8 -*-
"""Central HTTP route registration and invocation."""

from __future__ import annotations

import asyncio
import inspect
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, FrozenSet, Iterable, List, Optional, Tuple


SUPPORTED_METHODS = frozenset({"GET", "POST"})
SyncInvoker = Callable[[Callable, Tuple[Any, ...]], Awaitable[Any]]


@dataclass(frozen=True)
class HttpRoute:
    path: str
    handler: Callable
    methods: FrozenSet[str]
    description: Optional[str] = None
    timeout: Optional[float] = None


class HttpDispatcher:
    """Own the HTTP controller route table."""

    def __init__(self, sync_invoker: Optional[SyncInvoker] = None) -> None:
        self.sync_invoker = sync_invoker
        self._routes: Dict[str, HttpRoute] = {}

    def register(
        self,
        path: str,
        handler: Callable,
        *,
        methods: Iterable[str] = ("POST",),
        description: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> HttpRoute:
        normalized_path = self.normalize_path(path)
        normalized_methods = frozenset(
            str(method).strip().upper()
            for method in methods
            if str(method).strip()
        )
        unsupported = normalized_methods - SUPPORTED_METHODS
        if not normalized_path:
            raise ValueError("HTTP route path is required")
        if "." in normalized_path:
            raise ValueError(
                f"HTTP route paths must use slash segments: {normalized_path}"
            )
        if not callable(handler):
            raise TypeError(f"HTTP handler is not callable: {normalized_path}")
        if not normalized_methods:
            raise ValueError(f"HTTP methods are required: {normalized_path}")
        if unsupported:
            raise ValueError(
                f"Unsupported HTTP methods for {normalized_path}: "
                f"{', '.join(sorted(unsupported))}"
            )
        route = HttpRoute(
            path=normalized_path,
            handler=handler,
            methods=normalized_methods,
            description=description,
            timeout=float(timeout) if timeout is not None else None,
        )
        self._routes[normalized_path] = route
        return route

    def get(self, path: str) -> Optional[HttpRoute]:
        return self._routes.get(self.normalize_path(path))

    def list_routes(self, api_prefix: str) -> List[Dict[str, Any]]:
        prefix = "/" + str(api_prefix or "").strip("/")
        return [
            {
                "route": route.path,
                "methods": sorted(route.methods),
                "description": route.description,
                "timeout": route.timeout,
                "path": f"{prefix}/{route.path}",
            }
            for route in self._routes.values()
        ]

    async def dispatch(
        self,
        route: HttpRoute,
        params: Dict[str, Any],
        request_id: str,
        context: Dict[str, Any],
    ) -> Any:
        arguments = self._handler_arguments(route.handler, params, request_id, context)
        invocation = self._invoke(route.handler, arguments)
        if route.timeout is not None and route.timeout > 0:
            return await asyncio.wait_for(invocation, timeout=route.timeout)
        return await invocation

    async def _invoke(self, handler: Callable, arguments: Tuple[Any, ...]) -> Any:
        if inspect.iscoroutinefunction(handler):
            return await handler(*arguments)
        if self.sync_invoker is not None:
            result = await self.sync_invoker(handler, arguments)
            return await result if inspect.isawaitable(result) else result
        result = handler(*arguments)
        return await result if inspect.isawaitable(result) else result

    @staticmethod
    def _handler_arguments(
        handler: Callable,
        params: Dict[str, Any],
        request_id: str,
        context: Dict[str, Any],
    ) -> Tuple[Any, ...]:
        available = (params, request_id, context)
        signature = inspect.signature(handler)
        parameters = tuple(signature.parameters.values())
        if any(parameter.kind == inspect.Parameter.VAR_POSITIONAL for parameter in parameters):
            return available
        positional = tuple(
            parameter
            for parameter in parameters
            if parameter.kind in (
                inspect.Parameter.POSITIONAL_ONLY,
                inspect.Parameter.POSITIONAL_OR_KEYWORD,
            )
        )
        return available[:min(len(positional), len(available))]

    @staticmethod
    def normalize_path(path: str) -> str:
        return str(path or "").strip().strip("/")


__all__ = ["HttpDispatcher", "HttpRoute"]
