# -*- coding: utf-8 -*-
from pycore.callmodule.rpc_routes import route_names
from pycore.pyctl.pycore_manager_ui_state import (
    read_pycore_manager_ui_state,
    write_pycore_manager_ui_state,
)


def register_pycore_manager_ui_state_routes(server):
    def get_handler(params, request_id, context):
        return {"success": True, "data": read_pycore_manager_ui_state()}

    def put_handler(params, request_id, context):
        request = params if isinstance(params, dict) else {}
        data = write_pycore_manager_ui_state(
            request.get("values") if isinstance(request.get("values"), dict) else {},
            int(request.get("base_revision") or 0),
            bool(request.get("initialize_only")),
        )
        return {"success": True, "data": data}

    server.post(path=route_names.UI_PYCORE_MANAGER_STATE_GET, handler=get_handler)
    server.post(path=route_names.UI_PYCORE_MANAGER_STATE_PUT, handler=put_handler)

