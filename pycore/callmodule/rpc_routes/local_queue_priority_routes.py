# -*- coding: utf-8 -*-
"""HTTP Routes for queue_priority — native UI path (no router.invoke)."""


from pycore.callmodule.rpc_routes.route_names import (
    UI_QUEUE_PRIORITY_PRIORITIZE_WORD_IMAGES,
    UI_QUEUE_PRIORITY_PRIORITIZE_COVERS,
    UI_QUEUE_PRIORITY_PRIORITIZE_POSTERS,
)
import pycore.pyctl.queue_center.priority_service as qp


def register_local_queue_priority_routes(server):
    """Register HTTP controllers."""

    def prioritize_word_images_handler(params, request_id, context):
        return qp.prioritize_word_images(params.get("items") or [])

    server.post(
        path=UI_QUEUE_PRIORITY_PRIORITIZE_WORD_IMAGES,
        handler=prioritize_word_images_handler,
    )

    def prioritize_covers_handler(params, request_id, context):
        return qp.prioritize_covers(list(params.get("ids") or []), bool(params.get("all") or False))

    server.post(
        path=UI_QUEUE_PRIORITY_PRIORITIZE_COVERS,
        handler=prioritize_covers_handler,
    )

    def prioritize_posters_handler(params, request_id, context):
        return qp.prioritize_posters(params.get("items") or [])

    server.post(
        path=UI_QUEUE_PRIORITY_PRIORITIZE_POSTERS,
        handler=prioritize_posters_handler,
    )
