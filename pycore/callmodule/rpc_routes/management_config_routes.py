# -*- coding: utf-8 -*-
"""HTTP Routes for management config."""


from pycore.pyctl.management.system_service import system_service
from pycore.pyctl.management.system_models import SystemConfig
from pycore.callmodule.rpc_routes.route_names import UI_CONFIG_UPDATE_CONFIG


def register_management_config_routes(server):
    def update_config_handler(params, request_id, context):
        config = SystemConfig(**params)
        return system_service.update_system_config(config)

    server.post(path=UI_CONFIG_UPDATE_CONFIG, handler=update_config_handler)

