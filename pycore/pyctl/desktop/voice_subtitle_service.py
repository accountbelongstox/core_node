# -*- coding: utf-8 -*-
"""Desktop voice-subtitle workflow and background-monitor service."""

from __future__ import annotations

import base64
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyctl.desktop.queue_manager import voice_subtitle_queue
from pycore.pyctl.desktop.background_services import background_services
from pycore.pyctl.desktop.processor import process_image_input, process_text_input
from pycore.pyctl.desktop.task_manager import task_manager as shared_task_manager
from pycore.pyutils.common.queue_center_contract import QUEUE_CENTER_DIFF_DELIVERY


def _p(params: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    return params if isinstance(params, dict) else {}


def _langs(req: Dict[str, Any]) -> List[str]:
    langs = req.get("langs")
    if isinstance(langs, list) and langs:
        return [str(x) for x in langs]
    return ["en"]


def add_text(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    req = _p(params)
    text = str(req.get("text") or "")
    langs = _langs(req)
    category = str(req.get("category") or "normal")
    if not text.strip():
        return {"success": False, "error": "text is required"}

    ColorPrint.green("[VoiceSubtitle] ========== /add-text request ==========")
    ColorPrint.blue(f"  Text: {text[:50]}..." if len(text) > 50 else f"  Text: {text}")
    ColorPrint.blue(f"  Languages: {langs}")
    ColorPrint.blue(f"  Category: {category}")

    task_manager = shared_task_manager
    task_id = task_manager.create_task(
        task_type="text",
        input_data={"text": text, "langs": langs, "category": category},
        estimated_time=5,
    )
    ColorPrint.cyan(f"[VoiceSubtitle] Created task: {task_id}")

    async def executor(task):
        ColorPrint.yellow(f"[VoiceSubtitle] ========== Executing task {task_id} ==========")
        result = await process_text_input(text, langs, category)
        if not result["success"]:
            error_msg = result.get("error", "Unknown error")
            ColorPrint.red(f"[VoiceSubtitle] Task {task_id} returned failure: {error_msg}")
            raise Exception(error_msg)
        ColorPrint.green(f"[VoiceSubtitle] ========== Task {task_id} completed ==========")
        ColorPrint.blue(f"  Added items: {result.get('added_count', 0)}")
        return result

    task_manager.execute_task(task_id, executor)
    ColorPrint.green(f"[VoiceSubtitle] Request accepted, task_id: {task_id}")
    ColorPrint.green("========================================")
    return {
        "success": True,
        "task_id": task_id,
        "message": "Text processing started",
        "estimated_time": 5,
    }


def add_image(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    req = _p(params)
    langs = _langs(req)
    category = str(req.get("category") or "normal")
    image_path = req.get("image_path")
    image_url = req.get("image_url")
    image_base64 = req.get("image_base64")

    task_manager = shared_task_manager
    task_id = task_manager.create_task(
        task_type="image",
        input_data={
            "image_path": image_path,
            "image_url": image_url,
            "image_base64": image_base64,
            "langs": langs,
            "category": category,
        },
        estimated_time=10,
    )

    async def executor(task):
        result = await process_image_input(
            image_path=image_path,
            image_url=image_url,
            image_base64=image_base64,
            langs=langs,
            category=category,
        )
        if not result["success"]:
            raise Exception(result.get("error", "Unknown error"))
        return result

    task_manager.execute_task(task_id, executor)
    return {
        "success": True,
        "task_id": task_id,
        "message": "Image processing started",
        "estimated_time": 10,
    }


def add_voice(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    req = _p(params)
    audio_path = str(req.get("audio_path") or "").strip()
    if not audio_path:
        return {"success": False, "error": "audio_path required"}

    queue = voice_subtitle_queue
    queue.add_item(
        text=str(req.get("text") or "Audio playback"),
        audio_path=audio_path,
        category=str(req.get("category") or "normal"),
    )
    return {"success": True, "message": "Voice added to queue"}


def get_queue(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    req = _p(params)
    queue = voice_subtitle_queue
    snapshot = queue.get_snapshot(
        offset=int(req.get("offset") or 0),
        limit=int(req.get("limit") or QUEUE_CENTER_DIFF_DELIVERY["data_segment_limit"]),
    )
    return {"success": True, **snapshot}


def clear_queue() -> Dict[str, Any]:
    voice_subtitle_queue.clear_queue()
    return {"success": True, "message": "Queue cleared"}


def toggle_enabled() -> Dict[str, Any]:
    enabled = voice_subtitle_queue.toggle_enabled()
    return {
        "success": True,
        "enabled": enabled,
        "message": f"Voice subtitle {'enabled' if enabled else 'disabled'}",
    }


def next_item() -> Dict[str, Any]:
    item = voice_subtitle_queue.next_item()
    if not item:
        return {"success": False, "message": "Queue is empty"}
    return {
        "success": True,
        "item": {
            "text": item.text,
            "audio_path": item.audio_path,
            "play_count": item.play_count,
        },
    }


def previous_item() -> Dict[str, Any]:
    item = voice_subtitle_queue.previous_item()
    if not item:
        return {"success": False, "message": "Queue is empty"}
    return {
        "success": True,
        "item": {
            "text": item.text,
            "audio_path": item.audio_path,
            "play_count": item.play_count,
        },
    }


def set_current_index(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    index_value = _p(params).get("index")
    index = int(index_value) if index_value is not None else -1
    queue = voice_subtitle_queue
    if queue.set_current_index(index):
        return {"success": True, "current_index": index}
    return {"success": False, "error": "Invalid index"}


def increment_play_count(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    req = _p(params)
    index = req.get("index")
    voice_subtitle_queue.increment_play_count(index)
    return {"success": True, "message": "Play count incremented"}


def get_audio_file(path: str) -> Dict[str, Any]:
    audio_path = Path(str(path or ""))
    if not audio_path.is_file():
        return {"success": False, "error": f"Audio file not found: {path}"}

    ext = audio_path.suffix.lower()
    media_types = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
        ".flac": "audio/flac",
    }
    media_type = media_types.get(ext, "audio/mpeg")
    raw = audio_path.read_bytes()
    return {
        "success": True,
        "mime": media_type,
        "filename": audio_path.name,
        "content_base64": base64.b64encode(raw).decode("ascii"),
        "bytes": len(raw),
    }


def get_categories() -> Dict[str, Any]:
    categories = voice_subtitle_queue.get_categories()
    return {"success": True, "categories": categories}


def filter_queue_by_category(category: str = "") -> Dict[str, Any]:
    category = str(category or "").strip()
    if not category:
        return {"success": False, "error": "category required"}
    filtered_items = voice_subtitle_queue.filter_by_category(category)
    return {
        "success": True,
        "category": category,
        "items": filtered_items,
        "count": len(filtered_items),
    }


def filter_queue_by_today() -> Dict[str, Any]:
    filtered_items = voice_subtitle_queue.filter_by_today()
    return {"success": True, "items": filtered_items, "count": len(filtered_items)}


def get_latest_items(limit: int = 300) -> Dict[str, Any]:
    limit = int(limit or 300)
    latest_items = voice_subtitle_queue.get_latest_items(limit)
    return {"success": True, "items": latest_items, "count": len(latest_items), "limit": limit}


def change_item_category(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    req = _p(params)
    index_value = req.get("index")
    index = int(index_value) if index_value is not None else -1
    category = str(req.get("category") or "")
    queue = voice_subtitle_queue
    if queue.change_item_category(index, category):
        return {"success": True, "message": f"Category changed to '{category}'"}
    return {"success": False, "error": "Invalid index"}


def remove_multiple_items(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    indices = _p(params).get("indices")
    if not isinstance(indices, list):
        return {"success": False, "error": "indices must be a list"}
    removed_count = voice_subtitle_queue.remove_items(indices)
    return {
        "success": True,
        "message": f"Removed {removed_count} items",
        "removed_count": removed_count,
    }


def start_clipboard_monitor() -> Dict[str, Any]:
    background_services.start_clipboard_monitor()
    return {"success": True, "message": "Clipboard monitoring started"}


def stop_clipboard_monitor() -> Dict[str, Any]:
    background_services.stop_clipboard_monitor()
    return {"success": True, "message": "Clipboard monitoring stopped"}


def get_clipboard_monitor_status() -> Dict[str, Any]:
    status = background_services.get_monitor_status()["clipboard"]
    return {"success": True, **status}


def get_monitor_status() -> Dict[str, Any]:
    return {"success": True, **background_services.get_monitor_status()}


def start_screenshot_monitor(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    req = _p(params)
    interval = int(req.get("interval") or 0)
    lang = str(req.get("lang") or "en")
    background_services.start_screenshot_monitor(interval=interval, lang=lang)
    return {
        "success": True,
        "message": f"Screenshot monitoring started (interval: {interval}s, lang: {lang})",
    }


def set_screenshot_language(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    lang = str(_p(params).get("lang") or "en")
    background_services.set_screenshot_lang(lang)
    return {"success": True, "lang": lang}


def stop_screenshot_monitor() -> Dict[str, Any]:
    background_services.stop_screenshot_monitor()
    return {"success": True, "message": "Screenshot monitoring stopped"}


def get_screenshot_monitor_status() -> Dict[str, Any]:
    status = background_services.get_monitor_status()["screenshot"]
    return {"success": True, **status}


def get_task_status(task_id: str) -> Dict[str, Any]:
    task = shared_task_manager.get_task(str(task_id or ""))
    if not task:
        return {"success": False, "error": f"Task not found: {task_id}"}
    return task.to_dict()


def get_all_tasks(limit: int = 50) -> Dict[str, Any]:
    limit = int(limit or 50)
    tasks = shared_task_manager.get_recent_tasks(limit)
    return {"success": True, "tasks": tasks, "count": len(tasks)}
