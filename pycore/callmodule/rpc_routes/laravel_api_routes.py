# -*- coding: utf-8 -*-
"""Register Laravel endpoint-management controllers on HTTP v2."""

from pycore.callmodule.rpc_routes import route_names
from pycore.callmodule.rpc_routes.route_names import (
    LARAVEL_API_BUS_TIMEOUT,
)
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager

def register_laravel_api_routes(server) -> None:
    """Register thin Laravel endpoint controller adapters."""

    def list_handler(params, _request_id, _context):
        request_params = params or {}
        frontend_endpoints = request_params.get("frontend_endpoints")
        if not isinstance(frontend_endpoints, list):
            frontend_endpoints = None
        return laravel_endpoint_manager.list_endpoints(
            bool(request_params.get("probe", True)),
            frontend_endpoints,
        )

    def add_handler(params, _request_id, _context):
        return laravel_endpoint_manager.add((params or {}).get("url"))

    def remove_handler(params, _request_id, _context):
        return laravel_endpoint_manager.remove((params or {}).get("url"))

    def select_handler(params, _request_id, _context):
        result = laravel_endpoint_manager.select((params or {}).get("url"))
        if isinstance(result, dict) and result.get("success"):
            server.broadcast_event_sync(
                BusSignals.LARAVEL_ENDPOINT_CHANGED,
                {
                    "url": result.get("current"),
                    "endpoints": result.get("endpoints", []),
                    "current": result.get("current"),
                    "selected": result.get("selected"),
                },
            )
        return result

    def probe_handler(params, _request_id, _context):
        return laravel_endpoint_manager.probe_route((params or {}).get("url"))

    routes = (
        (route_names.LARAVEL_API_LIST, list_handler, "List Laravel endpoints"),
        (route_names.LARAVEL_API_ADD, add_handler, "Add a Laravel endpoint"),
        (route_names.LARAVEL_API_REMOVE, remove_handler, "Remove a Laravel endpoint"),
        (route_names.LARAVEL_API_SELECT, select_handler, "Select a Laravel endpoint"),
        (route_names.LARAVEL_API_PROBE, probe_handler, "Probe Laravel endpoints"),
    )
    server.register_routes(
        routes,
        group="laravel_api",
        timeout=LARAVEL_API_BUS_TIMEOUT,
    )

