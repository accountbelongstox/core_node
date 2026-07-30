# -*- coding: utf-8 -*-
"""RPC Routes for management config."""


from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyctl.management.system_service import system_service
from pycore.pyctl.management.system_models import SystemConfig
from pycore.callmodule.rpc_routes.route_names import UI_CONFIG_UPDATE_CONFIG


def register_management_config_routes(server):
    def update_config_handler(params, request_id, context):
        params = params or {}
        config = SystemConfig(**params)
        return system_service.update_system_config(config)

    server.route(name=UI_CONFIG_UPDATE_CONFIG, handler=update_config_handler)
    ColorPrint.green("[ConfigBuilder] Registered management config RPC routes")

