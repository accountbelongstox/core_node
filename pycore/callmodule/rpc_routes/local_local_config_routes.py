# -*- coding: utf-8 -*-
"""HTTP Routes for local_config."""


from pycore.pyctl.management.local_processing_service import local_processing_service
from pycore.pyctl.management.local_processing_models import LocalProcessingConfig
from pycore.callmodule.rpc_routes.route_names import UI_LOCAL_CONFIG_UPDATE_CONFIG


def register_local_local_config_routes(server):
    def update_config_handler(params, request_id, context):
        config = LocalProcessingConfig(**params)
        return local_processing_service.update_config(config)

    server.post(path=UI_LOCAL_CONFIG_UPDATE_CONFIG, handler=update_config_handler)

