# -*- coding: utf-8 -*-
"""RPC Routes for queue_overview — native UI path (no router.invoke)."""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import UI_QUEUE_OVERVIEW_GET_QUEUE_OVERVIEW
from pycore.pyctl.queue_center.overview_service import get_queue_overview


def register_local_queue_overview_routes(server):
    """Register HTTP controllers."""

    server.route(
        name=UI_QUEUE_OVERVIEW_GET_QUEUE_OVERVIEW,
        handler=get_queue_overview,
    )

    ColorPrint.green("[ConfigBuilder] Registered queue_overview HTTP controller")

