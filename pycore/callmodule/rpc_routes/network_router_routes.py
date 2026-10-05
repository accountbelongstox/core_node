# -*- coding: utf-8 -*-
"""HTTP routes of the network router (NAT gateway) manager: status, logs and start/stop/restart."""

from pycore.callmodule.rpc_routes.route_names import (
    UI_NETWORK_ROUTER_ACTION,
    UI_NETWORK_ROUTER_LOGS,
    UI_NETWORK_ROUTER_STATUS,
)
from pycore.pyctl.terminal.terminal_rpc import bool_param
from pycore.pyutils.network_router.network_router_service import network_router


def register_network_router_routes(server) -> None:
    def status_handler(params, _request_id, _context):
        return network_router.status(include_report=bool_param(params, "report"))

    def logs_handler(_params, _request_id, _context):
        return network_router.logs()

    def action_handler(params, _request_id, _context):
        return network_router.control(str(params.get("action") or ""))

    server.post(path=UI_NETWORK_ROUTER_STATUS, handler=status_handler)
    server.post(path=UI_NETWORK_ROUTER_LOGS, handler=logs_handler)
    server.post(path=UI_NETWORK_ROUTER_ACTION, handler=action_handler)
