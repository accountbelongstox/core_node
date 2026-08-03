# -*- coding: utf-8 -*-
"""HTTP routes for voice and subtitle workflows."""

import pycore.callmodule.rpc_routes.route_names as rn
import pycore.pyctl.desktop.voice_subtitle_service as vs


def register_voice_subtitle_routes(server):
    def get_audio_file(params, _request_id, _context):
        return vs.get_audio_file(str(params.get("path") or ""))

    def filter_queue_by_category(params, _request_id, _context):
        return vs.filter_queue_by_category(
            str(params.get("category") or "")
        )

    def get_latest_items(params, _request_id, _context):
        return vs.get_latest_items(int(params.get("limit") or 300))

    def get_task_status(params, _request_id, _context):
        return vs.get_task_status(str(params.get("task_id") or ""))

    def get_all_tasks(params, _request_id, _context):
        return vs.get_all_tasks(int(params.get("limit") or 50))

    routes = (
        (rn.UI_VOICE_SUBTITLE_ADD_TEXT, vs.add_text),
        (rn.UI_VOICE_SUBTITLE_ADD_IMAGE, vs.add_image),
        (rn.UI_VOICE_SUBTITLE_ADD_VOICE, vs.add_voice),
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
        (rn.UI_VOICE_SUBTITLE_GET_MONITOR_STATUS, vs.get_monitor_status),
        (rn.UI_VOICE_SUBTITLE_STOP_SCREENSHOT_MONITOR, vs.stop_screenshot_monitor),
        (rn.UI_VOICE_SUBTITLE_GET_SCREENSHOT_MONITOR_STATUS, vs.get_screenshot_monitor_status),
        (rn.UI_VOICE_SUBTITLE_SET_CURRENT_INDEX, vs.set_current_index),
        (rn.UI_VOICE_SUBTITLE_INCREMENT_PLAY_COUNT, vs.increment_play_count),
        (rn.UI_VOICE_SUBTITLE_GET_AUDIO_FILE, get_audio_file),
        (rn.UI_VOICE_SUBTITLE_FILTER_QUEUE_BY_CATEGORY, filter_queue_by_category),
        (rn.UI_VOICE_SUBTITLE_GET_LATEST_ITEMS, get_latest_items),
        (rn.UI_VOICE_SUBTITLE_CHANGE_ITEM_CATEGORY, vs.change_item_category),
        (rn.UI_VOICE_SUBTITLE_REMOVE_MULTIPLE_ITEMS, vs.remove_multiple_items),
        (rn.UI_VOICE_SUBTITLE_START_SCREENSHOT_MONITOR, vs.start_screenshot_monitor),
        (rn.UI_VOICE_SUBTITLE_SET_SCREENSHOT_LANGUAGE, vs.set_screenshot_language),
        (rn.UI_VOICE_SUBTITLE_GET_TASK_STATUS, get_task_status),
        (rn.UI_VOICE_SUBTITLE_GET_ALL_TASKS, get_all_tasks),
    )
    server.register_routes(routes, group="voice_subtitle")
