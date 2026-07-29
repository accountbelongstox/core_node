# -*- coding: utf-8 -*-
"""RPC Routes for version."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import UI_VERSION_VERSION
from pycore.callmodule.services.version_service import get_version


def register_local_version_routes(server):
    async def version_handler(params, request_id, context):
        return await asyncio.to_thread(get_version)

    server.route(name=UI_VERSION_VERSION, handler=version_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered version RPC routes")


__all__ = ["register_local_version_routes"]
