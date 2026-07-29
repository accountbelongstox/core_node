# -*- coding: utf-8 -*-
"""RPC Routes for local_config."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.controllers.management.local_processing_controller import LocalProcessingController
from pycore.callmodule.models.management.local_processing_models import LocalProcessingConfig
from pycore.callmodule.rpc_routes.route_names import UI_LOCAL_CONFIG_UPDATE_CONFIG


def register_local_local_config_routes(server):
    controller = LocalProcessingController()

    async def update_config_handler(params, request_id, context):
        params = params or {}
        config = LocalProcessingConfig(**params)
        return await asyncio.to_thread(controller.update_config, config)

    server.route(name=UI_LOCAL_CONFIG_UPDATE_CONFIG, handler=update_config_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered local_config RPC routes")


__all__ = ["register_local_local_config_routes"]
