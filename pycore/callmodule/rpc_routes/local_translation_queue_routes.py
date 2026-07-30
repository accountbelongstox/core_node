# -*- coding: utf-8 -*-
"""RPC Routes for translation_queue."""


from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_TRANSLATION_QUEUE_SNAPSHOT,
    UI_TRANSLATION_QUEUE_SET_PRIORITY,
    UI_TRANSLATION_QUEUE_STACK,
    UI_TRANSLATION_QUEUE_GET_TASK_DETAIL,
)
import pycore.pyctl.assist.heartbeat_workers_service as heartbeat_workers
from pycore.pyctl.queue_center.translation_monitor_service import queue_monitor_service
from pycore.pyctl.translation.worker.worker import translation_worker_service


def register_local_translation_queue_routes(server):
    def snapshot_handler(params, request_id, context):
        return queue_monitor_service.get_snapshot(bool((params or {}).get("refresh")))

    server.route(name=UI_TRANSLATION_QUEUE_SNAPSHOT, handler=snapshot_handler)

    def set_priority_handler(params, request_id, context):
        params = params or {}
        return queue_monitor_service.set_priority(params.get("task_id"), params.get("priority"))

    server.route(name=UI_TRANSLATION_QUEUE_SET_PRIORITY, handler=set_priority_handler)

    def stack_handler(params, request_id, context):
        params = params or {}

        result = queue_monitor_service.stack(
            words=list(params.get("words") or []),
            language=str(params.get("language") or ""),
            target_language=str(params.get("target_language") or ""),
            priority=params.get("priority"),
        )
        if (
            result.get("success") is not False
            and heartbeat_workers.is_enabled("translation_worker")
        ):
            translation_worker_service.poll_once()
        return result

    server.route(name=UI_TRANSLATION_QUEUE_STACK, handler=stack_handler)

    def get_task_detail_handler(params, request_id, context):
        params = params or {}
        return queue_monitor_service.get_task_detail(str(params.get("task_id") or ""))

    server.route(name=UI_TRANSLATION_QUEUE_GET_TASK_DETAIL, handler=get_task_detail_handler)
    ColorPrint.green("[ConfigBuilder] Registered translation_queue RPC routes")
