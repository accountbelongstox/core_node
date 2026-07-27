# -*- coding: utf-8 -*-
"""RPC Routes for web compatibility."""

import asyncio

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_WEB_HOMEPAGE,
    UI_WEB_GET_API_INFO,
    UI_WEB_PING,
    UI_WEB_GET_DESKTOP_UI,
    UI_WEB_GET_SUBTITLE_UI,
    UI_WEB_GET_FAVICON,
)
from pycore.callmodule.services import web_service as web


def register_web_routes(server):
    pairs = [
        (UI_WEB_HOMEPAGE, web.homepage),
        (UI_WEB_GET_API_INFO, web.get_api_info),
        (UI_WEB_PING, web.ping),
        (UI_WEB_GET_DESKTOP_UI, web.get_desktop_ui),
        (UI_WEB_GET_SUBTITLE_UI, web.get_subtitle_ui),
        (UI_WEB_GET_FAVICON, web.get_favicon),
    ]
    for route_name, fn in pairs:
        async def handler(params, request_id, context, _fn=fn):
            return await asyncio.to_thread(_fn)

        server.route(name=route_name, handler=handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered web RPC routes")


__all__ = ["register_web_routes"]
