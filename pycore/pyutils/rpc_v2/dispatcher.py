# -*- coding: utf-8 -*-
"""Transport-neutral RPC route registration and invocation."""

from __future__ import annotations

import asyncio
import inspect
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, FrozenSet, Iterable, List, Optional, Tuple


SUPPORTED_METHODS = frozenset({"GET", "POST"})
SyncInvoker = Callable[[Callable, Tuple[Any, ...]], Awaitable[Any]]


@dataclass(frozen=True)
class RpcRoute:
    name: str
    handler: Callable
    methods: FrozenSet[str]
    description: Optional[str] = None
    timeout: Optional[float] = None


class RpcDispatcher:
    """Own the HTTP controller route table."""

    def __init__(self, sync_invoker: Optional[SyncInvoker] = None) -> None:
        self.sync_invoker = sync_invoker
        self._routes: Dict[str, RpcRoute] = {}

    def register(
        self,
        name: str,
        handler: Callable,
        *,
        methods: Iterable[str] = ("POST",),
        description: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> RpcRoute:
        normalized_name = self.normalize_name(name)
        normalized_methods = frozenset(
            str(method).strip().upper()
            for method in methods
            if str(method).strip()
        )
        unsupported = normalized_methods - SUPPORTED_METHODS
        if not normalized_name:
            raise ValueError("RPC route name is required")
        if not callable(handler):
            raise TypeError(f"RPC handler is not callable: {normalized_name}")
        if not normalized_methods:
            raise ValueError(f"RPC methods are required: {normalized_name}")
        if unsupported:
            raise ValueError(
                f"Unsupported RPC methods for {normalized_name}: "
                f"{', '.join(sorted(unsupported))}"
            )
        route = RpcRoute(
            name=normalized_name,
            handler=handler,
            methods=normalized_methods,
            description=description,
            timeout=float(timeout) if timeout is not None else None,
        )
        self._routes[normalized_name] = route
        return route

    def get(self, name: str) -> Optional[RpcRoute]:
        return self._routes.get(self.normalize_name(name))

    def list_routes(self, controller_prefix: str) -> List[Dict[str, Any]]:
        prefix = "/" + str(controller_prefix or "").strip("/")
        return [
            {
                "name": route.name,
                "methods": sorted(route.methods),
                "description": route.description,
                "timeout": route.timeout,
                "path": f"{prefix}/{route.name}",
            }
            for route in self._routes.values()
        ]

    async def dispatch(
        self,
        route: RpcRoute,
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
    def normalize_name(name: str) -> str:
        return str(name or "").strip().strip("/")


__all__ = ["RpcDispatcher", "RpcRoute"]
