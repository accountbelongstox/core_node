# -*- coding: utf-8 -*-
"""
RPC Routes for voice_subtitle
"""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_VOICE_SUBTITLE_ADD_TEXT,
    UI_VOICE_SUBTITLE_ADD_IMAGE,
    UI_VOICE_SUBTITLE_ADD_VOICE,
    UI_VOICE_SUBTITLE_GET_QUEUE,
    UI_VOICE_SUBTITLE_CLEAR_QUEUE,
    UI_VOICE_SUBTITLE_TOGGLE_ENABLED,
    UI_VOICE_SUBTITLE_NEXT_ITEM,
    UI_VOICE_SUBTITLE_PREVIOUS_ITEM,
    UI_VOICE_SUBTITLE_SET_CURRENT_INDEX,
    UI_VOICE_SUBTITLE_INCREMENT_PLAY_COUNT,
    UI_VOICE_SUBTITLE_GET_AUDIO_FILE,
    UI_VOICE_SUBTITLE_GET_CATEGORIES,
    UI_VOICE_SUBTITLE_FILTER_QUEUE_BY_CATEGORY,
    UI_VOICE_SUBTITLE_FILTER_QUEUE_BY_TODAY,
    UI_VOICE_SUBTITLE_GET_LATEST_ITEMS,
    UI_VOICE_SUBTITLE_CHANGE_ITEM_CATEGORY,
    UI_VOICE_SUBTITLE_REMOVE_MULTIPLE_ITEMS,
    UI_VOICE_SUBTITLE_START_CLIPBOARD_MONITOR,
    UI_VOICE_SUBTITLE_STOP_CLIPBOARD_MONITOR,
    UI_VOICE_SUBTITLE_GET_CLIPBOARD_MONITOR_STATUS,
    UI_VOICE_SUBTITLE_START_SCREENSHOT_MONITOR,
    UI_VOICE_SUBTITLE_SET_SCREENSHOT_LANGUAGE,
    UI_VOICE_SUBTITLE_STOP_SCREENSHOT_MONITOR,
    UI_VOICE_SUBTITLE_GET_SCREENSHOT_MONITOR_STATUS,
    UI_VOICE_SUBTITLE_GET_TASK_STATUS,
    UI_VOICE_SUBTITLE_GET_ALL_TASKS
)

def register_voice_subtitle_routes(server):
    """Register WS RPC handlers."""
    
    async def add_text_handler(params, request_id, context):
        # TODO: Implement native RPC handler for add_text
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_ADD_TEXT, handler=add_text_handler, sync=False)

    async def add_image_handler(params, request_id, context):
        # TODO: Implement native RPC handler for add_image
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_ADD_IMAGE, handler=add_image_handler, sync=False)

    async def add_voice_handler(params, request_id, context):
        # TODO: Implement native RPC handler for add_voice
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_ADD_VOICE, handler=add_voice_handler, sync=False)

    async def get_queue_handler(params, request_id, context):
        # TODO: Implement native RPC handler for get_queue
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_GET_QUEUE, handler=get_queue_handler, sync=False)

    async def clear_queue_handler(params, request_id, context):
        # TODO: Implement native RPC handler for clear_queue
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_CLEAR_QUEUE, handler=clear_queue_handler, sync=False)

    async def toggle_enabled_handler(params, request_id, context):
        # TODO: Implement native RPC handler for toggle_enabled
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_TOGGLE_ENABLED, handler=toggle_enabled_handler, sync=False)

    async def next_item_handler(params, request_id, context):
        # TODO: Implement native RPC handler for next_item
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_NEXT_ITEM, handler=next_item_handler, sync=False)

    async def previous_item_handler(params, request_id, context):
        # TODO: Implement native RPC handler for previous_item
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_PREVIOUS_ITEM, handler=previous_item_handler, sync=False)

    async def set_current_index_handler(params, request_id, context):
        # TODO: Implement native RPC handler for set_current_index
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_SET_CURRENT_INDEX, handler=set_current_index_handler, sync=False)

    async def increment_play_count_handler(params, request_id, context):
        # TODO: Implement native RPC handler for increment_play_count
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_INCREMENT_PLAY_COUNT, handler=increment_play_count_handler, sync=False)

    async def get_audio_file_handler(params, request_id, context):
        # TODO: Implement native RPC handler for get_audio_file
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_GET_AUDIO_FILE, handler=get_audio_file_handler, sync=False)

    async def get_categories_handler(params, request_id, context):
        # TODO: Implement native RPC handler for get_categories
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_GET_CATEGORIES, handler=get_categories_handler, sync=False)

    async def filter_queue_by_category_handler(params, request_id, context):
        # TODO: Implement native RPC handler for filter_queue_by_category
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_FILTER_QUEUE_BY_CATEGORY, handler=filter_queue_by_category_handler, sync=False)

    async def filter_queue_by_today_handler(params, request_id, context):
        # TODO: Implement native RPC handler for filter_queue_by_today
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_FILTER_QUEUE_BY_TODAY, handler=filter_queue_by_today_handler, sync=False)

    async def get_latest_items_handler(params, request_id, context):
        # TODO: Implement native RPC handler for get_latest_items
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_GET_LATEST_ITEMS, handler=get_latest_items_handler, sync=False)

    async def change_item_category_handler(params, request_id, context):
        # TODO: Implement native RPC handler for change_item_category
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_CHANGE_ITEM_CATEGORY, handler=change_item_category_handler, sync=False)

    async def remove_multiple_items_handler(params, request_id, context):
        # TODO: Implement native RPC handler for remove_multiple_items
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_REMOVE_MULTIPLE_ITEMS, handler=remove_multiple_items_handler, sync=False)

    async def start_clipboard_monitor_handler(params, request_id, context):
        # TODO: Implement native RPC handler for start_clipboard_monitor
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_START_CLIPBOARD_MONITOR, handler=start_clipboard_monitor_handler, sync=False)

    async def stop_clipboard_monitor_handler(params, request_id, context):
        # TODO: Implement native RPC handler for stop_clipboard_monitor
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_STOP_CLIPBOARD_MONITOR, handler=stop_clipboard_monitor_handler, sync=False)

    async def get_clipboard_monitor_status_handler(params, request_id, context):
        # TODO: Implement native RPC handler for get_clipboard_monitor_status
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_GET_CLIPBOARD_MONITOR_STATUS, handler=get_clipboard_monitor_status_handler, sync=False)

    async def start_screenshot_monitor_handler(params, request_id, context):
        # TODO: Implement native RPC handler for start_screenshot_monitor
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_START_SCREENSHOT_MONITOR, handler=start_screenshot_monitor_handler, sync=False)

    async def set_screenshot_language_handler(params, request_id, context):
        # TODO: Implement native RPC handler for set_screenshot_language
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_SET_SCREENSHOT_LANGUAGE, handler=set_screenshot_language_handler, sync=False)

    async def stop_screenshot_monitor_handler(params, request_id, context):
        # TODO: Implement native RPC handler for stop_screenshot_monitor
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_STOP_SCREENSHOT_MONITOR, handler=stop_screenshot_monitor_handler, sync=False)

    async def get_screenshot_monitor_status_handler(params, request_id, context):
        # TODO: Implement native RPC handler for get_screenshot_monitor_status
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_GET_SCREENSHOT_MONITOR_STATUS, handler=get_screenshot_monitor_status_handler, sync=False)

    async def get_task_status_handler(params, request_id, context):
        # TODO: Implement native RPC handler for get_task_status
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_GET_TASK_STATUS, handler=get_task_status_handler, sync=False)

    async def get_all_tasks_handler(params, request_id, context):
        # TODO: Implement native RPC handler for get_all_tasks
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VOICE_SUBTITLE_GET_ALL_TASKS, handler=get_all_tasks_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered voice_subtitle RPC routes")

__all__ = ["register_voice_subtitle_routes"]
