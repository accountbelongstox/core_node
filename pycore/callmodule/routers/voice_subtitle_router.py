# -*- coding: utf-8 -*-
"""
Voice Subtitle Router

Provides HTTP API for managing voice subtitle queue.
"""

from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Body
from fastapi.responses import FileResponse
from pydantic import BaseModel

from pycore import ColorPrint
from pycore.pyctl.voice_subtitle import get_voice_subtitle_queue
from pycore.pyctl.voice_subtitle.processor import process_text_input, process_image_input
from pycore.pyctl.voice_subtitle.background_services import get_background_services


# ============================================================
# Request Models
# ============================================================

class AddTextRequest(BaseModel):
    """Add text to voice subtitle queue"""
    text: str
    langs: list[str] = ["en"]  # Languages to generate (currently only supports en)
    category: str = "normal"  # Category for queue item (default: "normal")


class AddImageRequest(BaseModel):
    """Add image to voice subtitle queue"""
    image_path: Optional[str] = None
    image_url: Optional[str] = None
    image_base64: Optional[str] = None
    langs: list[str] = ["en"]
    category: str = "normal"  # Category for queue item (default: "normal")


class AddVoiceRequest(BaseModel):
    """Add voice to voice subtitle queue"""
    audio_path: str
    text: Optional[str] = None  # Optional subtitle text
    langs: list[str] = ["en"]
    category: str = "normal"  # Category for queue item (default: "normal")


class SetIndexRequest(BaseModel):
    """Set current index in queue"""
    index: int


class IncrementPlayCountRequest(BaseModel):
    """Increment play count for item"""
    index: Optional[int] = None


class ChangeCategoryRequest(BaseModel):
    """Change category for a queue item"""
    index: int
    category: str


class RemoveItemsRequest(BaseModel):
    """Remove multiple items from queue"""
    indices: list[int]


class ScreenshotIntervalRequest(BaseModel):
    """Set screenshot capture interval"""
    interval: int  # seconds


# ============================================================
# Router
# ============================================================

router = APIRouter(prefix="/voice-subtitle", tags=["voice-subtitle"])


@router.post("/add-text")
async def add_text(request: AddTextRequest):
    """
    Add text to voice subtitle queue

    Process:
    1. Translate to all target languages
    2. Generate TTS for each language
    3. Add to queue with specified category
    """
    result = await process_text_input(request.text, request.langs, request.category)

    if result['success']:
        return {
            "success": True,
            "message": "Text added to queue",
            "items_added": result['items_added']
        }
    else:
        raise HTTPException(status_code=500, detail=result['error'])


@router.post("/add-image")
async def add_image(request: AddImageRequest):
    """
    Add image to voice subtitle queue

    Process:
    1. OCR image to extract text
    2. Summarize with Gemini
    3. Translate to all target languages
    4. Generate TTS for each language
    5. Add to queue with specified category
    """
    result = await process_image_input(
        image_path=request.image_path,
        image_url=request.image_url,
        image_base64=request.image_base64,
        langs=request.langs,
        category=request.category
    )

    if result['success']:
        return {
            "success": True,
            "message": "Image processed and added to queue",
            "items_added": result['items_added']
        }
    else:
        raise HTTPException(status_code=500, detail=result['error'])


@router.post("/add-voice")
async def add_voice(request: AddVoiceRequest):
    """
    Add voice file to voice subtitle queue

    Args:
        audio_path: Path to audio file
        text: Optional subtitle text
        langs: Languages (currently only en)
        category: Queue item category (default: "normal")
    """
    queue = get_voice_subtitle_queue()
    queue.add_item(
        text=request.text or "Audio playback",
        audio_path=request.audio_path,
        category=request.category
    )

    return {
        "success": True,
        "message": "Voice added to queue"
    }


@router.get("/queue")
async def get_queue():
    """Get current voice subtitle queue"""
    queue = get_voice_subtitle_queue()
    return {
        "success": True,
        "queue": queue.get_queue(),
        "current_index": queue.get_current_index(),
        "enabled": queue.is_enabled()
    }


@router.post("/clear")
async def clear_queue():
    """Clear voice subtitle queue"""
    queue = get_voice_subtitle_queue()
    queue.clear_queue()

    return {
        "success": True,
        "message": "Queue cleared"
    }


@router.post("/toggle")
async def toggle_enabled():
    """Toggle voice subtitle enabled state"""
    queue = get_voice_subtitle_queue()
    enabled = queue.toggle_enabled()

    return {
        "success": True,
        "enabled": enabled,
        "message": f"Voice subtitle {'enabled' if enabled else 'disabled'}"
    }


@router.post("/next")
async def next_item():
    """Move to next item in queue"""
    queue = get_voice_subtitle_queue()
    item = queue.next_item()

    if item:
        return {
            "success": True,
            "item": {
                "text": item.text,
                "audio_path": item.audio_path,
                "play_count": item.play_count
            }
        }
    else:
        return {
            "success": False,
            "message": "Queue is empty"
        }


@router.post("/previous")
async def previous_item():
    """Move to previous item in queue"""
    queue = get_voice_subtitle_queue()
    item = queue.previous_item()

    if item:
        return {
            "success": True,
            "item": {
                "text": item.text,
                "audio_path": item.audio_path,
                "play_count": item.play_count
            }
        }
    else:
        return {
            "success": False,
            "message": "Queue is empty"
        }


@router.post("/set-index")
async def set_current_index(request: SetIndexRequest):
    """Set current index in queue"""
    queue = get_voice_subtitle_queue()

    if queue.set_current_index(request.index):
        return {
            "success": True,
            "current_index": request.index
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid index")


@router.post("/increment-play-count")
async def increment_play_count(request: IncrementPlayCountRequest):
    """Increment play count for item"""
    queue = get_voice_subtitle_queue()
    queue.increment_play_count(request.index)

    return {
        "success": True,
        "message": "Play count incremented"
    }


@router.get("/audio")
async def get_audio_file(path: str = Query(..., description="Audio file path")):
    """
    Serve audio file for playback

    Args:
        path: Path to audio file (from queue item)

    Returns:
        FileResponse: Audio file
    """
    audio_path = Path(path)

    if not audio_path.exists():
        raise HTTPException(status_code=404, detail=f"Audio file not found: {path}")

    if not audio_path.is_file():
        raise HTTPException(status_code=400, detail=f"Not a file: {path}")

    # Determine media type based on extension
    ext = audio_path.suffix.lower()
    media_types = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.flac': 'audio/flac',
    }
    media_type = media_types.get(ext, 'audio/mpeg')

    ColorPrint.blue(f"[VoiceSubtitle] Serving audio: {audio_path.name}")

    return FileResponse(
        path=str(audio_path),
        media_type=media_type,
        filename=audio_path.name
    )


# ============================================================
# Category Management
# ============================================================

@router.get("/categories")
async def get_categories():
    """Get all unique categories in queue"""
    queue = get_voice_subtitle_queue()
    categories = queue.get_categories()

    return {
        "success": True,
        "categories": categories
    }


@router.get("/queue/filter-by-category")
async def filter_queue_by_category(category: str = Query(..., description="Category name to filter")):
    """Get queue items filtered by category"""
    queue = get_voice_subtitle_queue()
    filtered_items = queue.filter_by_category(category)

    return {
        "success": True,
        "category": category,
        "items": filtered_items,
        "count": len(filtered_items)
    }


@router.get("/queue/filter-by-today")
async def filter_queue_by_today():
    """Get queue items created today"""
    queue = get_voice_subtitle_queue()
    filtered_items = queue.filter_by_today()

    return {
        "success": True,
        "items": filtered_items,
        "count": len(filtered_items)
    }


@router.get("/queue/latest")
async def get_latest_items(limit: int = Query(300, description="Maximum number of items to return")):
    """Get latest N items from queue"""
    queue = get_voice_subtitle_queue()
    latest_items = queue.get_latest_items(limit)

    return {
        "success": True,
        "items": latest_items,
        "count": len(latest_items),
        "limit": limit
    }


@router.post("/change-category")
async def change_item_category(request: ChangeCategoryRequest):
    """
    Change category for a queue item

    Args:
        index: Item index
        category: New category name (auto-created if doesn't exist)
    """
    queue = get_voice_subtitle_queue()

    if queue.change_item_category(request.index, request.category):
        return {
            "success": True,
            "message": f"Category changed to '{request.category}'"
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid index")


@router.post("/remove-items")
async def remove_multiple_items(request: RemoveItemsRequest):
    """
    Remove multiple items from queue

    Args:
        indices: List of item indices to remove
    """
    queue = get_voice_subtitle_queue()
    removed_count = queue.remove_items(request.indices)

    return {
        "success": True,
        "message": f"Removed {removed_count} items",
        "removed_count": removed_count
    }


# ============================================================
# Background Services
# ============================================================

@router.post("/clipboard-monitor/start")
async def start_clipboard_monitor():
    """Start clipboard monitoring"""
    services = get_background_services()
    services.start_clipboard_monitor()

    return {
        "success": True,
        "message": "Clipboard monitoring started"
    }


@router.post("/clipboard-monitor/stop")
async def stop_clipboard_monitor():
    """Stop clipboard monitoring"""
    services = get_background_services()
    services.stop_clipboard_monitor()

    return {
        "success": True,
        "message": "Clipboard monitoring stopped"
    }


@router.get("/clipboard-monitor/status")
async def get_clipboard_monitor_status():
    """Get clipboard monitoring status"""
    services = get_background_services()

    return {
        "success": True,
        "enabled": services.is_clipboard_enabled()
    }


@router.post("/screenshot-monitor/start")
async def start_screenshot_monitor(request: ScreenshotIntervalRequest):
    """
    Start screenshot monitoring

    Args:
        interval: Capture interval in seconds
    """
    services = get_background_services()
    services.start_screenshot_monitor(interval=request.interval)

    return {
        "success": True,
        "message": f"Screenshot monitoring started (interval: {request.interval}s)"
    }


@router.post("/screenshot-monitor/stop")
async def stop_screenshot_monitor():
    """Stop screenshot monitoring"""
    services = get_background_services()
    services.stop_screenshot_monitor()

    return {
        "success": True,
        "message": "Screenshot monitoring stopped"
    }


@router.get("/screenshot-monitor/status")
async def get_screenshot_monitor_status():
    """Get screenshot monitoring status"""
    services = get_background_services()

    return {
        "success": True,
        "enabled": services.is_screenshot_enabled(),
        "interval": services.get_screenshot_interval()
    }



