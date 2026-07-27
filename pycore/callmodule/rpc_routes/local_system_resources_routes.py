# -*- coding: utf-8 -*-
"""RPC Routes for system_resources."""

import asyncio

from pycore import ColorPrint
from pycore.callmodule.controllers.local_processing.video_extract_controller import VideoExtractController
from pycore.callmodule.rpc_routes.route_names import UI_SYSTEM_RESOURCES_SYSTEM_RESOURCES


def register_local_system_resources_routes(server):
    controller = VideoExtractController()

    async def system_resources_handler(params, request_id, context):
        return await asyncio.to_thread(controller.system_resources)

    server.route(name=UI_SYSTEM_RESOURCES_SYSTEM_RESOURCES, handler=system_resources_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered system_resources RPC routes")


__all__ = ["register_local_system_resources_routes"]
