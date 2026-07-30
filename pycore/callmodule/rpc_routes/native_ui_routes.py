# -*- coding: utf-8 -*-
"""Register the Pycore UI health controller on HTTP API."""

from pycore.callmodule.rpc_routes import route_names
from pycore.pyutils.codesync.service import ping


def register_native_ui_routes(server) -> None:
    """Register the lightweight HTTP health probe."""
    server.post(
        path=route_names.UI_PING,
        handler=ping,
        description="Native pycore-manager health probe",
    )

