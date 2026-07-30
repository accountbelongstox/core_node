# -*- coding: utf-8 -*-
"""HTTP Routes for task_settings."""


from pycore.callmodule.rpc_routes.route_names import (
    UI_TASK_SETTINGS_CHAINS,
    UI_TASK_SETTINGS_UPDATE_CHAIN,
)
from pycore.pyctl.assist.task_capability_chains import get_chains, save_chain


def register_local_task_settings_routes(server):
    def chains_handler(params, request_id, context):
        return {"success": True, "chains": get_chains()}

    server.post(name=UI_TASK_SETTINGS_CHAINS, handler=chains_handler)

    def update_chain_handler(params, request_id, context):
        params = params or {}

        result = save_chain(str(params.get("task_type") or ""), list(params.get("priority") or []))
        if not result.get("ok"):
            return {"success": False, **result}
        return {"success": True, **result}

    server.post(name=UI_TASK_SETTINGS_UPDATE_CHAIN, handler=update_chain_handler)

