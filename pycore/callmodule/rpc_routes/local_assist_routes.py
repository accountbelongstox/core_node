# -*- coding: utf-8 -*-
"""HTTP Routes for assist."""


from pycore.callmodule.rpc_routes.route_names import (
    UI_ASSIST_ASSIST_CONFIG,
    UI_ASSIST_ASSIST_CYCLE,
    UI_ASSIST_ASSIST_STATUS,
    UI_ASSIST_BIND_LARAVEL_ENDPOINT,
    UI_ASSIST_LARAVEL_TRANSPORT_PROBE,
)
import pycore.pyctl.assist.service as assist
from pycore.pyctl.assist.wiring import bind_selected_endpoint_for_workers
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.http_recorder import laravel_http_recorder


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
        response = laravel_client.get("/api/health", timeout=15.0, log_line=False)
        records = laravel_http_recorder.get_recent(1)
        record = records[-1] if records else {}
        body = response.json() if "json" in (response.headers.get("Content-Type") or "").lower() else {}
        http_version = str(record.get("http_version") or "")
        return {
            "success": response.status_code == 200,
            "status": response.status_code,
            "transport": record.get("transport"),
            "http_version": http_version,
            "http3": http_version == "HTTP/3",
            "url": record.get("url"),
            "service": body.get("service") if isinstance(body, dict) else None,
        }

    server.post(path=UI_ASSIST_ASSIST_STATUS, handler=assist_status_handler)

    server.post(path=UI_ASSIST_ASSIST_CONFIG, handler=assist.assist_config)
    server.post(path=UI_ASSIST_ASSIST_CYCLE, handler=assist_cycle_handler)
    server.post(path=UI_ASSIST_BIND_LARAVEL_ENDPOINT, handler=bind_laravel_endpoint_handler)
    server.post(path=UI_ASSIST_LARAVEL_TRANSPORT_PROBE, handler=laravel_transport_probe_handler)
