# -*- coding: utf-8 -*-
"""Register user-data controllers on RPC v2."""

from pycore.callmodule.rpc_routes import route_names
from pycore.pyctl.runtime.user_data_service import user_data_service


def register_local_user_data_routes(server) -> None:
    """Register request adapters for the shared user-data service."""

    def set_system_settings(params, request_id, context):
        return user_data_service.set_system_settings((params or {}).get("settings") or {})

    def add_video_history(params, request_id, context):
        request = params or {}
        return user_data_service.add_video_extract(
            str(request.get("path") or ""),
            str(request.get("mode") or "folder"),
        )

    def remove_video_history(params, request_id, context):
        return user_data_service.remove_video_extract(str((params or {}).get("path") or ""))

    def set_video_options(params, request_id, context):
        return user_data_service.set_options((params or {}).get("options") or {})

    def pick_path(params, request_id, context):
        request = params or {}
        return user_data_service.pick_path(
            str(request.get("mode") or "folder"),
            request.get("initial"),
        )

    routes = (
        (route_names.UI_USER_DATA_GET_SYSTEM_SETTINGS, user_data_service.get_system_settings),
        (route_names.UI_USER_DATA_SET_SYSTEM_SETTINGS, set_system_settings),
        (route_names.UI_USER_DATA_GET_VIDEO_HISTORY, user_data_service.get_video_extract),
        (route_names.UI_USER_DATA_ADD_VIDEO_HISTORY, add_video_history),
        (route_names.UI_USER_DATA_REMOVE_VIDEO_HISTORY, remove_video_history),
        (route_names.UI_USER_DATA_SET_VIDEO_OPTIONS, set_video_options),
        (route_names.UI_USER_DATA_PICK_PATH, pick_path),
    )
    server.register_routes(routes, group="user_data")

