# -*- coding: utf-8 -*-
"""
RPC Routes for ai_probe
"""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_AI_PROBE_AI_CATALOG,
    UI_AI_PROBE_PROBE,
    UI_AI_PROBE_BALANCE
)

def register_local_ai_probe_routes(server):
    """Register WS RPC handlers."""
    
    async def ai_catalog_handler(params, request_id, context):
        # TODO: Implement native RPC handler for ai_catalog
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_AI_PROBE_AI_CATALOG, handler=ai_catalog_handler, sync=False)

    async def probe_handler(params, request_id, context):
        # TODO: Implement native RPC handler for probe
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_AI_PROBE_PROBE, handler=probe_handler, sync=False)

    async def balance_handler(params, request_id, context):
        # TODO: Implement native RPC handler for balance
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_AI_PROBE_BALANCE, handler=balance_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered ai_probe RPC routes")

__all__ = ["register_local_ai_probe_routes"]
