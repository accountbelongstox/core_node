# -*- coding: utf-8 -*-
"""Native RPC v2 management operations."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.controllers.management.system_controller import SystemController
from pycore.callmodule.controllers.management.local_processing_controller import LocalProcessingController
from pycore.callmodule.controllers.management.logs_controller import LogsController
from pycore.callmodule.models.management.system_models import SystemConfig
from pycore.callmodule.models.management.local_processing_models import LocalProcessingConfig, TestRequest
from pycore.callmodule.models.management.logs_models import LogsQuery
from pycore.callmodule.rpc_routes.route_names import UI_MANAGEMENT


def register_management_routes(server) -> None:
    system = SystemController()
    local = LocalProcessingController()
    logs = LogsController()

    async def handler(params, request_id, context):
        params = params or {}
        action = params.get("action")
        if action == "status":
            return await asyncio.to_thread(system.get_status)
        if action == "config_get":
            return await asyncio.to_thread(system.get_config)
        if action == "config_update":
            return await asyncio.to_thread(system.update_config, SystemConfig(**(params.get("config") or {})))
        if action == "capabilities":
            return await asyncio.to_thread(local.get_capabilities)
        if action == "local_config_get":
            return await asyncio.to_thread(local.get_config)
        if action == "local_config_update":
            return await asyncio.to_thread(local.update_config, LocalProcessingConfig(**(params.get("config") or {})))
        if action == "local_stats":
            return await asyncio.to_thread(local.get_stats, params.get("period", "today"), params.get("start"), params.get("end"))
        if action == "local_test":
            return await asyncio.to_thread(local.test, TestRequest(**(params.get("request") or {})))
        if action == "logs":
            return await asyncio.to_thread(logs.get_logs, LogsQuery(**(params.get("query") or {})))
        if action == "logs_clear":
            return await asyncio.to_thread(logs.clear_logs, params.get("category"))
        if action == "logs_stats":
            return await asyncio.to_thread(logs.get_stats)
        if action in {"restart", "stop", "reload-config", "clear-cache"}:
            return await asyncio.to_thread(system.control, action)
        raise ValueError(f"Unsupported management operation: {action}")

    server.route(name=UI_MANAGEMENT, handler=handler, sync=False, description="Native management operation")
    ColorPrint.green("[ConfigBuilder] Registered native management RPC route")


__all__ = ["register_management_routes"]
