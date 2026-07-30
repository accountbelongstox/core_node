# -*- coding: utf-8 -*-
"""HTTP Routes for version."""


from pycore.callmodule.rpc_routes.route_names import UI_VERSION_VERSION
from pycore.pyctl.runtime.version_service import get_version


def register_local_version_routes(server):
    server.post(name=UI_VERSION_VERSION, handler=get_version)

