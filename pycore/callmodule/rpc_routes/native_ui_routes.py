# -*- coding: utf-8 -*-
"""Register the Pycore UI health controller on RPC v2."""

from pycore.callmodule.rpc_routes import route_names
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.codesync.service import ping


def register_native_ui_routes(server) -> None:
    """Register the lightweight HTTP health probe."""
    server.route(
        name=route_names.UI_PING,
        handler=ping,
        description="Native pycore-manager health probe",
    )
    ColorPrint.green("[ConfigBuilder] Registered pycore-manager health controller")

