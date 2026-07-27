#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Processes RPC requests for rpc_v2.

All @serialized_method table calls (update_status, set_result) are routed
through `await_serialized` so they cannot block the uvicorn event loop.
"""

import asyncio
from typing import Any, Callable, Dict, Optional

from pycore import ColorPrint

from pycore.pyutils.rpc_v2.common import RequestEventTable, RequestStatus
from pycore.pyutils.rpc_v2.server._serialized_bridge import await_serialized


class RequestProcessor:
    def __init__(self, request_event_table: RequestEventTable, routes: Dict[str, Callable], debug: bool = False):
        self.request_event_table = request_event_table
        self.routes = routes
        self.debug = debug

    async def process_request_async(
        self,
        request_id: str,
        route: str,
        params: Dict[str, Any],
        client_id: str,
        client_type: str,
        context: Dict[str, Any],
        notify_callback: Optional[Callable] = None,
    ):
        try:
            await await_serialized(
                self.request_event_table.update_status,
                request_id,
                RequestStatus.PROCESSING,
            )
            handler = self.routes.get(route)
            if not handler:
                error_msg = f"Route {route} not found"
                await await_serialized(
                    self.request_event_table.set_result,
                    request_id,
                    None,
                    error=error_msg,
                )
                if notify_callback:
                    await self._invoke_callback(notify_callback, client_id, request_id, None, error_msg)
                return

            if asyncio.iscoroutinefunction(handler):
                result = await handler(params, request_id, context)
            else:
                result = handler(params, request_id, context)

            await await_serialized(
                self.request_event_table.set_result,
                request_id,
                result,
                error=None,
            )
            if notify_callback:
                await self._invoke_callback(notify_callback, client_id, request_id, result, None)

        except Exception as exc:
            error_msg = str(exc)
            ColorPrint.red(f"[RequestProcessor] Processing error for {request_id}: {exc}")
            await await_serialized(
                self.request_event_table.set_result,
                request_id,
                None,
                error=error_msg,
            )
            if notify_callback:
                await self._invoke_callback(notify_callback, client_id, request_id, None, error_msg)

    async def _invoke_callback(self, callback: Callable, client_id: str, request_id: str, result: Any, error: Optional[str]):
        if asyncio.iscoroutinefunction(callback):
            await callback(client_id, request_id, result, error)
        else:
            callback(client_id, request_id, result, error)


__all__ = ["RequestProcessor"]
