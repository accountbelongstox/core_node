# -*- coding: utf-8 -*-
"""RPC Routes for management config."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.controllers.management.system_controller import SystemController
from pycore.callmodule.models.management.system_models import SystemConfig
from pycore.callmodule.rpc_routes.route_names import UI_CONFIG_UPDATE_CONFIG


def register_management_config_routes(server):
    controller = SystemController()

    async def update_config_handler(params, request_id, context):
        params = params or {}
        config = SystemConfig(**params)
        return await asyncio.to_thread(controller.update_config, config)

    server.route(name=UI_CONFIG_UPDATE_CONFIG, handler=update_config_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered management config RPC routes")


__all__ = ["register_management_config_routes"]
