# -*- coding: utf-8 -*-
"""RPC Routes for control (autostart) — native UI path (no router.invoke)."""

import asyncio

from pycore import ColorPrint
from pycore.callmodule.platform.startup_manager import get_startup_manager
from pycore.callmodule.platform.autostart_target import VALID_TARGETS, VALID_MECHANISMS
from pycore.callmodule.rpc_routes.route_names import (
    UI_CONTROL_GET_AUTOSTART,
    UI_CONTROL_SET_AUTOSTART,
)


def _get_autostart_sync():
    status = get_startup_manager().get_status()
    status.setdefault("targets", list(VALID_TARGETS))
    status.setdefault("mechanisms", list(VALID_MECHANISMS))
    return {"success": True, **status}


def _set_autostart_sync(enabled, target, mechanism):
    manager = get_startup_manager(target=target, mechanism=mechanism)
    return manager.enable() if enabled else manager.disable()


def register_management_control_routes(server):
    """Register WS RPC handlers."""

    async def get_autostart_handler(params, request_id, context):
        return await asyncio.to_thread(_get_autostart_sync)

    server.route(name=UI_CONTROL_GET_AUTOSTART, handler=get_autostart_handler, sync=False)

    async def set_autostart_handler(params, request_id, context):
        params = params or {}
        enabled = bool(params.get("enabled"))
        target = params.get("target")
        mechanism = params.get("mechanism")
        return await asyncio.to_thread(_set_autostart_sync, enabled, target, mechanism)

    server.route(name=UI_CONTROL_SET_AUTOSTART, handler=set_autostart_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered control RPC routes")


__all__ = ["register_management_control_routes"]
