# -*- coding: utf-8 -*-
"""RPC Routes for version."""


from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import UI_VERSION_VERSION
from pycore.pyctl.runtime.version_service import get_version


def register_local_version_routes(server):
    server.route(name=UI_VERSION_VERSION, handler=get_version)
    ColorPrint.green("[ConfigBuilder] Registered version RPC routes")

