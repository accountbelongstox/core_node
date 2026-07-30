# -*- coding: utf-8 -*-
"""HTTP Routes for image_search."""


from pycore.callmodule.rpc_routes.route_names import (
    UI_IMAGE_SEARCH_CLEAR_HISTORY,
    UI_IMAGE_SEARCH_COMPARE,
    UI_IMAGE_SEARCH_DELETE_HISTORY,
    UI_IMAGE_SEARCH_HISTORY,
    UI_IMAGE_SEARCH_RESOURCE,
    UI_IMAGE_SEARCH_SEARCH,
    UI_IMAGE_SEARCH_SEARCH_AI,
    UI_IMAGE_SEARCH_STATUS,
)
from pycore.pyctl.ai.image_search_service import image_search_service


def register_local_image_search_routes(server):
    image_search = image_search_service
    server.post(name=UI_IMAGE_SEARCH_STATUS, handler=image_search.status)

    def search_handler(params, request_id, context):
        request = params or {}
        return image_search.search(
            str(request.get("query") or ""),
            num=int(request.get("num") or 12),
            country=request.get("country"),
            record=bool(request.get("record", True)),
        )

    server.post(name=UI_IMAGE_SEARCH_SEARCH, handler=search_handler)

    def search_ai_handler(params, request_id, context):
        params = params or {}
        return image_search.search_ai(
            str(params.get("query") or ""),
            size=params.get("size"),
            model=params.get("model"),
        )

    server.post(name=UI_IMAGE_SEARCH_SEARCH_AI, handler=search_ai_handler)

    def compare_handler(params, request_id, context):
        params = params or {}
        return image_search.compare(
            str(params.get("query") or ""),
            num=int(params.get("num") or 12),
            country=params.get("country"),
            size=params.get("size"),
            model=params.get("model"),
        )

    server.post(name=UI_IMAGE_SEARCH_COMPARE, handler=compare_handler)

    def history_handler(params, request_id, context):
        return image_search.history(int((params or {}).get("limit") or 50))

    server.post(name=UI_IMAGE_SEARCH_HISTORY, handler=history_handler)

    def delete_history_handler(params, request_id, context):
        return image_search.delete_history(str((params or {}).get("entry_id") or ""))

    server.post(name=UI_IMAGE_SEARCH_DELETE_HISTORY, handler=delete_history_handler)

    server.post(name=UI_IMAGE_SEARCH_CLEAR_HISTORY, handler=image_search.clear_history)

    def resource_handler(params, request_id, context):
        return image_search.resource(str((params or {}).get("url") or ""))

    server.post(name=UI_IMAGE_SEARCH_RESOURCE, handler=resource_handler)

