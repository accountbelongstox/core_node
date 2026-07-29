# -*- coding: utf-8 -*-
"""
RPC Routes for task_history
"""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_TASK_HISTORY_GET_COMPLETED_ARCHIVE,
    UI_TASK_HISTORY_SYNC_COMPLETED_ARCHIVE,
    UI_TASK_HISTORY_COMPLETED_ARCHIVE_RESOURCE,
    UI_TASK_HISTORY_GET_RECENT_TASKS,
    UI_TASK_HISTORY_SEARCH_TASKS,
    UI_TASK_HISTORY_CLEAR_RECENT_TASKS
)

from pycore.callmodule.controllers.local_processing.task_history_controller import (
    get_completed_archive,
    sync_completed_archive,
    completed_archive_resource,
    get_recent_tasks,
    search_tasks,
    clear_recent_tasks,
)

def register_local_task_history_routes(server):
    """Register WS RPC handlers."""
    
    async def get_completed_archive_handler(params, request_id, context):
        task_type = params.get("task_type")
        limit = params.get("limit", 200)
        offset = params.get("offset", 0)
        return get_completed_archive(task_type=task_type, limit=limit, offset=offset)
        
    server.route(name=UI_TASK_HISTORY_GET_COMPLETED_ARCHIVE, handler=get_completed_archive_handler, sync=False)

    async def sync_completed_archive_handler(params, request_id, context):
        return sync_completed_archive()
        
    server.route(name=UI_TASK_HISTORY_SYNC_COMPLETED_ARCHIVE, handler=sync_completed_archive_handler, sync=False)

    async def completed_archive_resource_handler(params, request_id, context):
        cache_key = params.get("cache_key")
        return completed_archive_resource(cache_key=cache_key)
        
    server.route(name=UI_TASK_HISTORY_COMPLETED_ARCHIVE_RESOURCE, handler=completed_archive_resource_handler, sync=False)

    async def get_recent_tasks_handler(params, request_id, context):
        limit = params.get("limit", 200)
        end = params.get("end")
        worker = params.get("worker")
        q = params.get("q")
        date_from = params.get("date_from")
        date_to = params.get("date_to")
        task_type = params.get("task_type")
        return get_recent_tasks(
            limit=limit,
            end=end,
            worker=worker,
            q=q,
            date_from=date_from,
            date_to=date_to,
            task_type=task_type,
        )
        
    server.route(name=UI_TASK_HISTORY_GET_RECENT_TASKS, handler=get_recent_tasks_handler, sync=False)

    async def search_tasks_handler(params, request_id, context):
        q = params.get("q")
        date_from = params.get("date_from")
        date_to = params.get("date_to")
        task_type = params.get("task_type")
        worker = params.get("worker")
        limit = params.get("limit", 200)
        return search_tasks(
            q=q,
            date_from=date_from,
            date_to=date_to,
            task_type=task_type,
            worker=worker,
            limit=limit,
        )
        
    server.route(name=UI_TASK_HISTORY_SEARCH_TASKS, handler=search_tasks_handler, sync=False)

    async def clear_recent_tasks_handler(params, request_id, context):
        return clear_recent_tasks()
        
    server.route(name=UI_TASK_HISTORY_CLEAR_RECENT_TASKS, handler=clear_recent_tasks_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered task_history RPC routes")

__all__ = ["register_local_task_history_routes"]
