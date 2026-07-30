# -*- coding: utf-8 -*-
"""RPC Routes for local_config."""


from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyctl.management.local_processing_service import local_processing_service
from pycore.pyctl.management.local_processing_models import LocalProcessingConfig
from pycore.callmodule.rpc_routes.route_names import UI_LOCAL_CONFIG_UPDATE_CONFIG


def register_local_local_config_routes(server):
    def update_config_handler(params, request_id, context):
        params = params or {}
        config = LocalProcessingConfig(**params)
        return local_processing_service.update_config(config)

    server.route(name=UI_LOCAL_CONFIG_UPDATE_CONFIG, handler=update_config_handler)
    ColorPrint.green("[ConfigBuilder] Registered local_config RPC routes")

