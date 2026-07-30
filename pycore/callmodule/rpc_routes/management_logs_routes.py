# -*- coding: utf-8 -*-
"""Register log-management controllers on RPC v2."""

from pycore.callmodule.rpc_routes import route_names
from pycore.pyctl.laravel.log_mirror_service import laravel_log_mirror_service
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


def register_management_logs_routes(server) -> None:
    """Register thin log-management controller adapters."""

    def refresh_handler(_params, _request_id, _context):
        result = laravel_log_mirror_service.refresh()
        return {"success": bool(result.get("success")), "data": result}

    server.route(name=route_names.UI_LARAVEL_LOGS_SNAPSHOT, handler=laravel_log_mirror_service.get_snapshot)
    server.route(name=route_names.UI_LARAVEL_LOGS_REFRESH, handler=refresh_handler)
    server.route(name=route_names.UI_LARAVEL_LOGS_STATUS, handler=laravel_log_mirror_service.get_status)
    server.route(name=route_names.UI_LARAVEL_LOGS_RECORDS, handler=laravel_log_mirror_service.get_records)
    server.route(name=route_names.UI_LARAVEL_LOGS_CLEAR, handler=laravel_log_mirror_service.clear_logs)
    server.route(name=route_names.UI_LARAVEL_LOGS_CANCEL, handler=laravel_log_mirror_service.cancel)
    ColorPrint.green("[LogMirror] Registered logs RPC routes")

