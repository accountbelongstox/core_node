# -*- coding: utf-8 -*-
"""RPC Routes for translation_queue."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.callmodule_config.config import Config
from pycore.callmodule.rpc_routes.route_names import (
    UI_TRANSLATION_QUEUE_SET_PRIORITY,
    UI_TRANSLATION_QUEUE_STACK,
    UI_TRANSLATION_QUEUE_GET_TASK_DETAIL,
)
from pycore.callmodule.services.queue_monitor_service import get_queue_monitor_service
from pycore.callmodule.services.translation_worker_service import get_translation_worker_service
from pycore.pyheartbeat.heartbeat import get_heartbeat_system


def _monitor():
    return get_queue_monitor_service(
        laravel_api_url=Config.LARAVEL_WORKER_API_URL,
        bump_ttl_seconds=Config.TRANSLATION_QUEUE_BUMP_TTL_SECONDS,
    )


def register_local_translation_queue_routes(server):
    async def set_priority_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            _monitor().set_priority,
            params.get("task_id"),
            params.get("priority"),
        )

    server.route(name=UI_TRANSLATION_QUEUE_SET_PRIORITY, handler=set_priority_handler, sync=False)

    async def stack_handler(params, request_id, context):
        params = params or {}

        def _run():
            result = _monitor().stack(
                words=list(params.get("words") or []),
                language=str(params.get("language") or ""),
                target_language=str(params.get("target_language") or ""),
                priority=params.get("priority"),
            )
            if (
                result.get("success") is not False
                and get_heartbeat_system().is_callback_enabled("translation_worker")
            ):
                get_translation_worker_service().poll_once()
            return result

        return await asyncio.to_thread(_run)

    server.route(name=UI_TRANSLATION_QUEUE_STACK, handler=stack_handler, sync=False)

    async def get_task_detail_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            _monitor().get_task_detail,
            str(params.get("task_id") or ""),
        )

    server.route(name=UI_TRANSLATION_QUEUE_GET_TASK_DETAIL, handler=get_task_detail_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered translation_queue RPC routes")


__all__ = ["register_local_translation_queue_routes"]
