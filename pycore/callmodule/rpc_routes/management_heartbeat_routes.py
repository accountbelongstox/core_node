# -*- coding: utf-8 -*-
"""RPC Routes for management heartbeat."""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import UI_HEARTBEAT_GET_CALLBACK_STATUS
from pycore.pyheartbeat.heartbeat import get_heartbeat_system


def register_management_heartbeat_routes(server):
    async def get_callback_status_handler(params, request_id, context):
        params = params or {}
        callback_name = str(params.get("callback_name") or "").strip()
        if not callback_name:
            return {"success": False, "error": "callback_name is required"}
        heartbeat = get_heartbeat_system()
        stats = heartbeat.get_stats()
        callbacks = (stats.get("heartbeat") or {}).get("callbacks") or {}
        if callback_name not in callbacks:
            return {"success": False, "error": f"Callback '{callback_name}' not found"}
        info = callbacks[callback_name]
        return {
            "success": True,
            "callback_name": callback_name,
            "enabled": info.get("enabled", False),
            "interval": info.get("interval", 0),
            "run_count": info.get("run_count", 0),
            "last_run_tick": info.get("last_run_tick", 0),
            "ticks_until_next": info.get("ticks_until_next", 0),
        }

    server.route(name=UI_HEARTBEAT_GET_CALLBACK_STATUS, handler=get_callback_status_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered heartbeat RPC routes")


__all__ = ["register_management_heartbeat_routes"]
