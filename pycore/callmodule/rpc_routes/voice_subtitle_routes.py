# -*- coding: utf-8 -*-
"""RPC Routes for voice_subtitle."""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
import pycore.callmodule.rpc_routes.route_names as rn
import pycore.callmodule.services.voice_subtitle_service as vs


def register_voice_subtitle_routes(server):
    async def add_text_handler(params, request_id, context):
        return await vs.add_text(params or {})

    server.route(name=rn.UI_VOICE_SUBTITLE_ADD_TEXT, handler=add_text_handler, sync=False)

    async def add_image_handler(params, request_id, context):
        return await vs.add_image(params or {})

    server.route(name=rn.UI_VOICE_SUBTITLE_ADD_IMAGE, handler=add_image_handler, sync=False)

    async def add_voice_handler(params, request_id, context):
        return await vs.add_voice(params or {})

    server.route(name=rn.UI_VOICE_SUBTITLE_ADD_VOICE, handler=add_voice_handler, sync=False)

    for route_name, fn in [
        (rn.UI_VOICE_SUBTITLE_GET_QUEUE, vs.get_queue),
        (rn.UI_VOICE_SUBTITLE_CLEAR_QUEUE, vs.clear_queue),
        (rn.UI_VOICE_SUBTITLE_TOGGLE_ENABLED, vs.toggle_enabled),
        (rn.UI_VOICE_SUBTITLE_NEXT_ITEM, vs.next_item),
        (rn.UI_VOICE_SUBTITLE_PREVIOUS_ITEM, vs.previous_item),
        (rn.UI_VOICE_SUBTITLE_GET_CATEGORIES, vs.get_categories),
        (rn.UI_VOICE_SUBTITLE_FILTER_QUEUE_BY_TODAY, vs.filter_queue_by_today),
        (rn.UI_VOICE_SUBTITLE_START_CLIPBOARD_MONITOR, vs.start_clipboard_monitor),
        (rn.UI_VOICE_SUBTITLE_STOP_CLIPBOARD_MONITOR, vs.stop_clipboard_monitor),
        (rn.UI_VOICE_SUBTITLE_GET_CLIPBOARD_MONITOR_STATUS, vs.get_clipboard_monitor_status),
        (rn.UI_VOICE_SUBTITLE_STOP_SCREENSHOT_MONITOR, vs.stop_screenshot_monitor),
        (rn.UI_VOICE_SUBTITLE_GET_SCREENSHOT_MONITOR_STATUS, vs.get_screenshot_monitor_status),
    ]:
        async def handler(params, request_id, context, _fn=fn):
            return await _fn()

        server.route(name=route_name, handler=handler, sync=False)

    async def set_current_index_handler(params, request_id, context):
        return await vs.set_current_index(params or {})

    server.route(name=rn.UI_VOICE_SUBTITLE_SET_CURRENT_INDEX, handler=set_current_index_handler, sync=False)

    async def increment_play_count_handler(params, request_id, context):
        return await vs.increment_play_count(params or {})

    server.route(name=rn.UI_VOICE_SUBTITLE_INCREMENT_PLAY_COUNT, handler=increment_play_count_handler, sync=False)

    async def get_audio_file_handler(params, request_id, context):
        return await vs.get_audio_file(str((params or {}).get("path") or ""))

    server.route(name=rn.UI_VOICE_SUBTITLE_GET_AUDIO_FILE, handler=get_audio_file_handler, sync=False)

    async def filter_queue_by_category_handler(params, request_id, context):
        return await vs.filter_queue_by_category(str((params or {}).get("category") or ""))

    server.route(name=rn.UI_VOICE_SUBTITLE_FILTER_QUEUE_BY_CATEGORY, handler=filter_queue_by_category_handler, sync=False)

    async def get_latest_items_handler(params, request_id, context):
        return await vs.get_latest_items(int((params or {}).get("limit") or 300))

    server.route(name=rn.UI_VOICE_SUBTITLE_GET_LATEST_ITEMS, handler=get_latest_items_handler, sync=False)

    async def change_item_category_handler(params, request_id, context):
        return await vs.change_item_category(params or {})

    server.route(name=rn.UI_VOICE_SUBTITLE_CHANGE_ITEM_CATEGORY, handler=change_item_category_handler, sync=False)

    async def remove_multiple_items_handler(params, request_id, context):
        return await vs.remove_multiple_items(params or {})

    server.route(name=rn.UI_VOICE_SUBTITLE_REMOVE_MULTIPLE_ITEMS, handler=remove_multiple_items_handler, sync=False)

    async def start_screenshot_monitor_handler(params, request_id, context):
        return await vs.start_screenshot_monitor(params or {})

    server.route(name=rn.UI_VOICE_SUBTITLE_START_SCREENSHOT_MONITOR, handler=start_screenshot_monitor_handler, sync=False)

    async def set_screenshot_language_handler(params, request_id, context):
        return await vs.set_screenshot_language(params or {})

    server.route(name=rn.UI_VOICE_SUBTITLE_SET_SCREENSHOT_LANGUAGE, handler=set_screenshot_language_handler, sync=False)

    async def get_task_status_handler(params, request_id, context):
        return await vs.get_task_status(str((params or {}).get("task_id") or ""))

    server.route(name=rn.UI_VOICE_SUBTITLE_GET_TASK_STATUS, handler=get_task_status_handler, sync=False)

    async def get_all_tasks_handler(params, request_id, context):
        return await vs.get_all_tasks(int((params or {}).get("limit") or 50))

    server.route(name=rn.UI_VOICE_SUBTITLE_GET_ALL_TASKS, handler=get_all_tasks_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered voice_subtitle RPC routes")


__all__ = ["register_voice_subtitle_routes"]
