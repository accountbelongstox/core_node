# -*- coding: utf-8 -*-
"""Wire voice_subtitle, image_search, ai_image RPC routes."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "pycore" / "callmodule" / "rpc_routes"

(ROOT / "voice_subtitle_routes.py").write_text(
    '''# -*- coding: utf-8 -*-
"""RPC Routes for voice_subtitle."""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes import route_names as rn
from pycore.callmodule.services import voice_subtitle_service as vs
from pycore.callmodule.services.voice_subtitle_service import (
    AddImageRequest,
    AddTextRequest,
    AddVoiceRequest,
    ChangeCategoryRequest,
    IncrementPlayCountRequest,
    RemoveItemsRequest,
    ScreenshotIntervalRequest,
    ScreenshotLangRequest,
    SetIndexRequest,
)


def register_voice_subtitle_routes(server):
    async def add_text_handler(params, request_id, context):
        return await vs.add_text(AddTextRequest(**(params or {})))

    server.route(name=rn.UI_VOICE_SUBTITLE_ADD_TEXT, handler=add_text_handler, sync=False)

    async def add_image_handler(params, request_id, context):
        return await vs.add_image(AddImageRequest(**(params or {})))

    server.route(name=rn.UI_VOICE_SUBTITLE_ADD_IMAGE, handler=add_image_handler, sync=False)

    async def add_voice_handler(params, request_id, context):
        return await vs.add_voice(AddVoiceRequest(**(params or {})))

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
        return await vs.set_current_index(SetIndexRequest(**(params or {})))

    server.route(name=rn.UI_VOICE_SUBTITLE_SET_CURRENT_INDEX, handler=set_current_index_handler, sync=False)

    async def increment_play_count_handler(params, request_id, context):
        return await vs.increment_play_count(IncrementPlayCountRequest(**(params or {})))

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
        return await vs.change_item_category(ChangeCategoryRequest(**(params or {})))

    server.route(name=rn.UI_VOICE_SUBTITLE_CHANGE_ITEM_CATEGORY, handler=change_item_category_handler, sync=False)

    async def remove_multiple_items_handler(params, request_id, context):
        return await vs.remove_multiple_items(RemoveItemsRequest(**(params or {})))

    server.route(name=rn.UI_VOICE_SUBTITLE_REMOVE_MULTIPLE_ITEMS, handler=remove_multiple_items_handler, sync=False)

    async def start_screenshot_monitor_handler(params, request_id, context):
        return await vs.start_screenshot_monitor(ScreenshotIntervalRequest(**(params or {})))

    server.route(name=rn.UI_VOICE_SUBTITLE_START_SCREENSHOT_MONITOR, handler=start_screenshot_monitor_handler, sync=False)

    async def set_screenshot_language_handler(params, request_id, context):
        return await vs.set_screenshot_language(ScreenshotLangRequest(**(params or {})))

    server.route(name=rn.UI_VOICE_SUBTITLE_SET_SCREENSHOT_LANGUAGE, handler=set_screenshot_language_handler, sync=False)

    async def get_task_status_handler(params, request_id, context):
        return await vs.get_task_status(str((params or {}).get("task_id") or ""))

    server.route(name=rn.UI_VOICE_SUBTITLE_GET_TASK_STATUS, handler=get_task_status_handler, sync=False)

    async def get_all_tasks_handler(params, request_id, context):
        return await vs.get_all_tasks(int((params or {}).get("limit") or 50))

    server.route(name=rn.UI_VOICE_SUBTITLE_GET_ALL_TASKS, handler=get_all_tasks_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered voice_subtitle RPC routes")


__all__ = ["register_voice_subtitle_routes"]
''',
    encoding="utf-8",
)

(ROOT / "local_image_search_routes.py").write_text(
    '''# -*- coding: utf-8 -*-
"""RPC Routes for image_search."""

import asyncio

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_IMAGE_SEARCH_STATUS,
    UI_IMAGE_SEARCH_SEARCH_AI,
    UI_IMAGE_SEARCH_COMPARE,
    UI_IMAGE_SEARCH_HISTORY,
    UI_IMAGE_SEARCH_DELETE_HISTORY,
    UI_IMAGE_SEARCH_CLEAR_HISTORY,
)
from pycore.callmodule.services import image_search_service as img
from pycore.callmodule.services.image_search_service import (
    ImageSearchAiRequest,
    ImageSearchCompareRequest,
)


def register_local_image_search_routes(server):
    async def status_handler(params, request_id, context):
        return await asyncio.to_thread(img.status)

    server.route(name=UI_IMAGE_SEARCH_STATUS, handler=status_handler, sync=False)

    async def search_ai_handler(params, request_id, context):
        return await asyncio.to_thread(img.search_ai, ImageSearchAiRequest(**(params or {})))

    server.route(name=UI_IMAGE_SEARCH_SEARCH_AI, handler=search_ai_handler, sync=False)

    async def compare_handler(params, request_id, context):
        return await asyncio.to_thread(img.compare, ImageSearchCompareRequest(**(params or {})))

    server.route(name=UI_IMAGE_SEARCH_COMPARE, handler=compare_handler, sync=False)

    async def history_handler(params, request_id, context):
        return await asyncio.to_thread(img.history, int((params or {}).get("limit") or 50))

    server.route(name=UI_IMAGE_SEARCH_HISTORY, handler=history_handler, sync=False)

    async def delete_history_handler(params, request_id, context):
        return await asyncio.to_thread(img.delete_history, str((params or {}).get("entry_id") or ""))

    server.route(name=UI_IMAGE_SEARCH_DELETE_HISTORY, handler=delete_history_handler, sync=False)

    async def clear_history_handler(params, request_id, context):
        return await asyncio.to_thread(img.clear_history)

    server.route(name=UI_IMAGE_SEARCH_CLEAR_HISTORY, handler=clear_history_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered image_search RPC routes")


__all__ = ["register_local_image_search_routes"]
''',
    encoding="utf-8",
)

(ROOT / "local_ai_image_routes.py").write_text(
    '''# -*- coding: utf-8 -*-
"""RPC Routes for ai_image."""

import asyncio

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_AI_IMAGE_IMAGE,
    UI_AI_IMAGE_IMAGE_TEST,
    UI_AI_IMAGE_IMAGE_HISTORY,
    UI_AI_IMAGE_IMAGE_HISTORY_FILE,
    UI_AI_IMAGE_IMAGE_HISTORY_REVEAL,
    UI_AI_IMAGE_IMAGE_HISTORY_DELETE,
    UI_AI_IMAGE_IMAGE_HISTORY_CLEAR,
)
from pycore.callmodule.services import ai_image_service as ai
from pycore.callmodule.services.ai_image_service import ImageRequest, ImageTestRequest


def register_local_ai_image_routes(server):
    async def image_handler(params, request_id, context):
        return await asyncio.to_thread(ai.image, ImageRequest(**(params or {})))

    server.route(name=UI_AI_IMAGE_IMAGE, handler=image_handler, sync=False)

    async def image_test_handler(params, request_id, context):
        return await asyncio.to_thread(ai.image_test, ImageTestRequest(**(params or {})))

    server.route(name=UI_AI_IMAGE_IMAGE_TEST, handler=image_test_handler, sync=False)

    async def image_history_handler(params, request_id, context):
        return await asyncio.to_thread(ai.image_history, int((params or {}).get("limit") or 50))

    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY, handler=image_history_handler, sync=False)

    async def image_history_file_handler(params, request_id, context):
        return await asyncio.to_thread(ai.image_history_file, str((params or {}).get("image_id") or ""))

    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY_FILE, handler=image_history_file_handler, sync=False)

    async def image_history_reveal_handler(params, request_id, context):
        return await asyncio.to_thread(ai.image_history_reveal, str((params or {}).get("image_id") or ""))

    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY_REVEAL, handler=image_history_reveal_handler, sync=False)

    async def image_history_delete_handler(params, request_id, context):
        return await asyncio.to_thread(ai.image_history_delete, str((params or {}).get("image_id") or ""))

    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY_DELETE, handler=image_history_delete_handler, sync=False)

    async def image_history_clear_handler(params, request_id, context):
        return await asyncio.to_thread(ai.image_history_clear)

    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY_CLEAR, handler=image_history_clear_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered ai_image RPC routes")


__all__ = ["register_local_ai_image_routes"]
''',
    encoding="utf-8",
)

print("wired D batch")
