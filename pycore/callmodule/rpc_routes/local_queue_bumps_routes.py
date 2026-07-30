# -*- coding: utf-8 -*-
"""HTTP Routes for queue_bumps."""


from pycore.callmodule.rpc_routes.route_names import UI_QUEUE_BUMPS_LIST_BUMPS
from pycore.pyutils.common.queue_bump_hub import queue_bump_hub


def register_local_queue_bumps_routes(server):
    def list_bumps_handler(params, request_id, context):
        params = params or {}
        limit = int(params.get("limit") or 30)

        snap = queue_bump_hub.snapshot(limit=max(1, min(limit, 60)))
        return {"success": True, **snap}

    server.post(name=UI_QUEUE_BUMPS_LIST_BUMPS, handler=list_bumps_handler)

