# -*- coding: utf-8 -*-
"""Register Task Center controllers on RPC v2."""

from pycore.callmodule.rpc_routes import route_names
from pycore.pyctl.queue_center.task_center_service import (
    QueueCenterControlRequest,
    get_local_task_detail,
    get_queue_center_snapshot,
    get_remote_task_detail,
    get_task_center,
    set_queue_center_control,
)


def register_local_task_center_routes(server) -> None:
    """Register Task Center controllers."""

    def control_handler(params, _request_id, _context):
        request = params or {}
        control_name = request.get("control_name")
        if not control_name:
            return {"success": False, "error": "control_name is required"}
        control = QueueCenterControlRequest(
            enabled=request.get("enabled", False),
            requested_by=request.get("requested_by"),
            reason=request.get("reason"),
            graceful_stop=request.get("graceful_stop", False),
        )
        return set_queue_center_control(control_name, control)

    def local_detail_handler(params, _request_id, _context):
        task_id = (params or {}).get("task_id")
        if not task_id:
            return {"success": False, "error": "task_id is required"}
        return get_local_task_detail(task_id)

    def remote_detail_handler(params, _request_id, _context):
        task_id = (params or {}).get("task_id")
        if not task_id:
            return {"success": False, "error": "task_id is required"}
        return get_remote_task_detail(task_id)

    routes = (
        (route_names.UI_TASK_CENTER_GET, get_task_center),
        (route_names.UI_TASK_CENTER_GET_QUEUE_CENTER_SNAPSHOT, get_queue_center_snapshot),
        (route_names.UI_TASK_CENTER_SET_QUEUE_CENTER_CONTROL, control_handler),
        (route_names.UI_TASK_CENTER_GET_LOCAL_TASK_DETAIL, local_detail_handler),
        (route_names.UI_TASK_CENTER_GET_REMOTE_TASK_DETAIL, remote_detail_handler),
    )
    server.register_routes(routes, group="task_center")

