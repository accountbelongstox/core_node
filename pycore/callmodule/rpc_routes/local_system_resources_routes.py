# -*- coding: utf-8 -*-
"""RPC Routes for system_resources."""


from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyctl.desktop.video_extract_service import video_extract_service
from pycore.callmodule.rpc_routes.route_names import UI_SYSTEM_RESOURCES_SYSTEM_RESOURCES


def register_local_system_resources_routes(server):
    server.route(
        name=UI_SYSTEM_RESOURCES_SYSTEM_RESOURCES,
        handler=video_extract_service.system_resources,
    )
    ColorPrint.green("[ConfigBuilder] Registered system_resources RPC routes")

