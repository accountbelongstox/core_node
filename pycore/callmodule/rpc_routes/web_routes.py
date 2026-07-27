# -*- coding: utf-8 -*-
"""
RPC Routes for web
"""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_WEB_HOMEPAGE,
    UI_WEB_GET_API_INFO,
    UI_WEB_PING,
    UI_WEB_GET_DESKTOP_UI,
    UI_WEB_GET_SUBTITLE_UI,
    UI_WEB_GET_FAVICON
)

def register_web_routes(server):
    """Register WS RPC handlers."""
    
    async def homepage_handler(params, request_id, context):
        # TODO: Implement native RPC handler for homepage
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_WEB_HOMEPAGE, handler=homepage_handler, sync=False)

    async def get_api_info_handler(params, request_id, context):
        # TODO: Implement native RPC handler for get_api_info
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_WEB_GET_API_INFO, handler=get_api_info_handler, sync=False)

    async def ping_handler(params, request_id, context):
        # TODO: Implement native RPC handler for ping
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_WEB_PING, handler=ping_handler, sync=False)

    async def get_desktop_ui_handler(params, request_id, context):
        # TODO: Implement native RPC handler for get_desktop_ui
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_WEB_GET_DESKTOP_UI, handler=get_desktop_ui_handler, sync=False)

    async def get_subtitle_ui_handler(params, request_id, context):
        # TODO: Implement native RPC handler for get_subtitle_ui
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_WEB_GET_SUBTITLE_UI, handler=get_subtitle_ui_handler, sync=False)

    async def get_favicon_handler(params, request_id, context):
        # TODO: Implement native RPC handler for get_favicon
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_WEB_GET_FAVICON, handler=get_favicon_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered web RPC routes")

__all__ = ["register_web_routes"]
