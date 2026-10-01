# -*- coding: utf-8 -*-
"""HTTP Routes for assist."""


from pycore.callmodule.rpc_routes.route_names import (
    UI_ASSIST_ASSIST_CONFIG,
    UI_ASSIST_ASSIST_CYCLE,
    UI_ASSIST_ASSIST_STATUS,
    UI_ASSIST_BIND_LARAVEL_ENDPOINT,
    UI_ASSIST_LARAVEL_ENDPOINTS,
    UI_ASSIST_LARAVEL_ENDPOINTS_PROBE,
    UI_ASSIST_LARAVEL_TRANSPORT_PROBE,
)
import pycore.pyctl.assist.service as assist
from pycore.pyctl.assist.wiring import bind_selected_endpoint_for_workers
from pycore.pyutils.common.http_client import HTTP_TRANSPORT_NAME
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.endpoint_manager import HEALTH_PATH, laravel_endpoint_manager


def register_local_assist_routes(server):
    def assist_status_handler(params, request_id, context):
        include = params.get("include_laravel", False)
        return assist.assist_status(bool(include))

    def assist_cycle_handler(params, request_id, context):
        return assist.assist_cycle(params)

    def bind_laravel_endpoint_handler(params, request_id, context):
        return bind_selected_endpoint_for_workers(
            str(params.get("laravel_endpoint") or "")
        )

    def laravel_transport_probe_handler(params, request_id, context):
        response = laravel_client.get(HEALTH_PATH, timeout=15.0, log_line=False)
        body = response.json() if "json" in (response.headers.get("Content-Type") or "").lower() else {}
        http_version = response.http_version
        return {
            "success": response.status_code == 200,
            "status": response.status_code,
            "transport": HTTP_TRANSPORT_NAME,
            "http_version": http_version,
            "http3": http_version == "HTTP/3",
            "url": response.url,
            "service": body.get("service") if isinstance(body, dict) else None,
        }

    server.post(path=UI_ASSIST_ASSIST_STATUS, handler=assist_status_handler)

    server.post(path=UI_ASSIST_ASSIST_CONFIG, handler=assist.assist_config)
    server.post(path=UI_ASSIST_ASSIST_CYCLE, handler=assist_cycle_handler)
    def laravel_endpoints_handler(params, request_id, context):
        # pycore's catalog, selection and last-known health (instant); a
        # background sweep refreshes health for the next read.
        return laravel_endpoint_manager.list_endpoints(probe=bool(params.get("probe", True)))

    def laravel_endpoints_probe_handler(params, request_id, context):
        return laravel_endpoint_manager.probe_route(str(params.get("url") or "") or None)

    server.post(path=UI_ASSIST_BIND_LARAVEL_ENDPOINT, handler=bind_laravel_endpoint_handler)
    server.post(path=UI_ASSIST_LARAVEL_ENDPOINTS, handler=laravel_endpoints_handler)
    server.post(path=UI_ASSIST_LARAVEL_ENDPOINTS_PROBE, handler=laravel_endpoints_probe_handler)
    server.post(path=UI_ASSIST_LARAVEL_TRANSPORT_PROBE, handler=laravel_transport_probe_handler)
