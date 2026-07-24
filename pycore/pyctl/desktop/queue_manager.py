# -*- coding: utf-8 -*-
"""
Voice Subtitle Queue Manager

Manages queue of voice subtitles with text, audio path, play count, and categories.
Uses system cache directory for persistent storage.
"""

import json
from pathlib import Path
from typing import List, Dict, Optional, Set
from dataclasses import dataclass, asdict
from datetime import datetime

from pycore.pyfoundations.system_paths import APP_DATA_DIR
from pycore import ColorPrint, THREAD_BUS
from pycore.pyfoundations.serialized_worker import (
    SerializedSingletonProvider,
    SerializedWorkerThread,
    call_serialized,
)


_QUEUE_STATE_QUEUE = 'pyctl.desktop.voice_subtitle_queue.state'
_QUEUE_STATE_WORKER = SerializedWorkerThread(
    _QUEUE_STATE_QUEUE,
    'VoiceSubtitleQueueStateThread',
)
_QUEUE_STATE_WORKER.start()


@dataclass
class VoiceSubtitleItem:
    """Voice subtitle item"""
    text: str
    audio_path: str
    play_count: int = 0
    category: str = "normal"  # 分类（默认"normal"普通）
    created_at: str = ""  # ISO格式时间戳
    # Which AI produced this item's text (empty for plain user input). Shown in
    # the UI so every AI-handled task is attributable to its provider/model.
    ai_provider: str = ""
    ai_model: str = ""

    def __post_init__(self):
        """Initialize created_at if not provided"""
        if not self.created_at:
            self.created_at = datetime.now().isoformat()


class VoiceSubtitleQueue:
    """
    Voice subtitle queue manager

    Features:
    - Queue of voice subtitle items
    - Current index tracking
    - Persistent storage in system cache
    - THREAD_BUS-serialized operations
    - Playback control (enabled/disabled)
    """

    def __init__(self):
        """Initialize voice subtitle queue"""
        self._queue: List[VoiceSubtitleItem] = []
        self._current_index: int = 0
        self._enabled: bool = False  # Playback enabled/disabled

        # Storage path
        self._storage_dir = APP_DATA_DIR / 'voice_subtitle'
        self._storage_file = self._storage_dir / 'queue.json'

        # Create storage directory
        self._storage_dir.mkdir(parents=True, exist_ok=True)

        # Load queue from disk
        self._load_queue()

    def _load_queue(self):
        """Load queue from disk"""
        if not self._storage_file.exists():
            return

        with open(self._storage_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            self._queue = [VoiceSubtitleItem(**item) for item in data.get('queue', [])]
            self._current_index = data.get('current_index', 0)
            self._enabled = data.get('enabled', False)

    def _save_queue(self):
        """Save queue to disk and broadcast the new snapshot"""
        data = {
            'queue': [asdict(item) for item in self._queue],
            'current_index': self._current_index,
            'enabled': self._enabled
        }

        with open(self._storage_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # Every mutation funnels through here, so this is the single live-update
        # point: the rpc_v2 server relays the event to its WS clients (registered
        # in callmodule config), keeping the dashboard queue pages in sync.
        # Payload shape == GET /voice-subtitle/queue response (minus 'success').
        THREAD_BUS.trigger_event(
            'voice_subtitle_queue_update',
            data,
            async_mode=True,
        )

    def add_item(self, text: str, audio_path: str, category: str = "normal",
                 ai_provider: str = "", ai_model: str = "") -> None:
        """
        Add item to queue

        Args:
            text: Subtitle text
            audio_path: Path to audio file
            category: Item category (default: "normal")
            ai_provider: AI provider that produced the text ("" = not AI)
            ai_model: model id used by that provider
        """
        call_serialized(
            _QUEUE_STATE_QUEUE,
            self._add_item,
            text,
            audio_path,
            category,
            ai_provider,
            ai_model,
        )

    def _add_item(
        self,
        text: str,
        audio_path: str,
        category: str,
        ai_provider: str,
        ai_model: str,
    ) -> None:
        """Add an item on the queue-owner thread."""
        item = VoiceSubtitleItem(text=text, audio_path=audio_path, category=category,
                                 ai_provider=ai_provider, ai_model=ai_model)
        self._queue.append(item)
        self._save_queue()
        ColorPrint.blue(f"[VoiceSubtitle] Added item ({category}"
                        f"{', ai=' + ai_provider if ai_provider else ''}): {text}")

    def remove_item(self, index: int) -> bool:
        """
        Remove item from queue

        Args:
            index: Item index

        Returns:
            bool: True if removed
        """
        return call_serialized(_QUEUE_STATE_QUEUE, self._remove_item, index)

    def _remove_item(self, index: int) -> bool:
        """Remove an item on the queue-owner thread."""
        if 0 <= index < len(self._queue):
            item = self._queue.pop(index)
            if self._current_index >= len(self._queue) and self._queue:
                self._current_index = len(self._queue) - 1
            elif not self._queue:
                self._current_index = 0
            self._save_queue()
            ColorPrint.blue(f"[VoiceSubtitle] Removed item: {item.text}")
            return True
        return False

    def get_current_item(self) -> Optional[VoiceSubtitleItem]:
        """
        Get current item

        Returns:
            Optional[VoiceSubtitleItem]: Current item or None
        """
        return call_serialized(_QUEUE_STATE_QUEUE, self._get_current_item)

    def _get_current_item(self) -> Optional[VoiceSubtitleItem]:
        """Return a detached current item on the queue-owner thread."""
        if 0 <= self._current_index < len(self._queue):
            return VoiceSubtitleItem(**asdict(self._queue[self._current_index]))
        return None

    def next_item(self) -> Optional[VoiceSubtitleItem]:
        """
        Move to next item

        Returns:
            Optional[VoiceSubtitleItem]: Next item or None
        """
        return call_serialized(_QUEUE_STATE_QUEUE, self._next_item)

    def _next_item(self) -> Optional[VoiceSubtitleItem]:
        """Advance on the queue-owner thread."""
        if not self._queue:
            return None
        self._current_index = (self._current_index + 1) % len(self._queue)
        self._save_queue()
        return self._get_current_item()

    def previous_item(self) -> Optional[VoiceSubtitleItem]:
        """
        Move to previous item

        Returns:
            Optional[VoiceSubtitleItem]: Previous item or None
        """
        return call_serialized(_QUEUE_STATE_QUEUE, self._previous_item)

    def _previous_item(self) -> Optional[VoiceSubtitleItem]:
        """Move backward on the queue-owner thread."""
        if not self._queue:
            return None
        self._current_index = (self._current_index - 1) % len(self._queue)
        self._save_queue()
        return self._get_current_item()

    def set_current_index(self, index: int) -> bool:
        """
        Set current index

        Args:
            index: New index

        Returns:
            bool: True if index was set
        """
        return call_serialized(_QUEUE_STATE_QUEUE, self._set_current_index, index)

    def _set_current_index(self, index: int) -> bool:
        """Set the current index on the queue-owner thread."""
        if 0 <= index < len(self._queue):
            self._current_index = index
            self._save_queue()
            return True
        return False

    def increment_play_count(self, index: Optional[int] = None) -> None:
        """
        Increment play count for item

        Args:
            index: Item index (None = current item)
        """
        call_serialized(_QUEUE_STATE_QUEUE, self._increment_play_count, index)

    def _increment_play_count(self, index: Optional[int]) -> None:
        """Increment play count on the queue-owner thread."""
        item_index = index if index is not None else self._current_index
        if 0 <= item_index < len(self._queue):
            self._queue[item_index].play_count += 1
            self._save_queue()

    def get_queue(self) -> List[Dict]:
        """
        Get queue as list of dicts

        Returns:
            List[Dict]: Queue items
        """
        return call_serialized(_QUEUE_STATE_QUEUE, self._get_queue)

    def _get_queue(self) -> List[Dict]:
        """Build a queue snapshot on the queue-owner thread."""
        return [asdict(item) for item in self._queue]

    def get_current_index(self) -> int:
        """Get current index"""
        return call_serialized(_QUEUE_STATE_QUEUE, self._get_current_index)

    def _get_current_index(self) -> int:
        """Read the current index on the queue-owner thread."""
        return self._current_index

    def is_enabled(self) -> bool:
        """Check if playback is enabled"""
        return call_serialized(_QUEUE_STATE_QUEUE, self._is_enabled)

    def _is_enabled(self) -> bool:
        """Read playback state on the queue-owner thread."""
        return self._enabled

    def set_enabled(self, enabled: bool) -> None:
        """
        Enable/disable playback

        Args:
            enabled: Enable state
        """
        call_serialized(_QUEUE_STATE_QUEUE, self._set_enabled, enabled)

    def _set_enabled(self, enabled: bool) -> None:
        """Set playback state on the queue-owner thread."""
        self._enabled = enabled
        self._save_queue()
        status = "enabled" if enabled else "disabled"
        ColorPrint.green(f"[VoiceSubtitle] Playback {status}")

    def toggle_enabled(self) -> bool:
        """
        Toggle playback enabled state

        Returns:
            bool: New enabled state
        """
        return call_serialized(_QUEUE_STATE_QUEUE, self._toggle_enabled)

    def _toggle_enabled(self) -> bool:
        """Toggle playback state on the queue-owner thread."""
        self._enabled = not self._enabled
        self._save_queue()
        status = "enabled" if self._enabled else "disabled"
        ColorPrint.green(f"[VoiceSubtitle] Playback {status}")
        return self._enabled

    def clear_queue(self) -> None:
        """Clear all items from queue"""
        call_serialized(_QUEUE_STATE_QUEUE, self._clear_queue)

    def _clear_queue(self) -> None:
        """Clear items on the queue-owner thread."""
        self._queue.clear()
        self._current_index = 0
        self._save_queue()
        ColorPrint.blue("[VoiceSubtitle] Queue cleared")

    def get_categories(self) -> List[str]:
        """
        Get all unique categories in queue

        Returns:
            List[str]: List of category names
        """
        return call_serialized(_QUEUE_STATE_QUEUE, self._get_categories)

    def _get_categories(self) -> List[str]:
        """Build the category snapshot on the queue-owner thread."""
        categories = {item.category for item in self._queue}
        return sorted(categories)

    def filter_by_category(self, category: str) -> List[Dict]:
        """
        Get queue items filtered by category

        Args:
            category: Category name to filter

        Returns:
            List[Dict]: Filtered queue items
        """
        return call_serialized(_QUEUE_STATE_QUEUE, self._filter_by_category, category)

    def _filter_by_category(self, category: str) -> List[Dict]:
        """Filter items on the queue-owner thread."""
        return [asdict(item) for item in self._queue if item.category == category]

    def filter_by_today(self) -> List[Dict]:
        """
        Get queue items created today

        Returns:
            List[Dict]: Items created today
        """
        return call_serialized(_QUEUE_STATE_QUEUE, self._filter_by_today)

    def _filter_by_today(self) -> List[Dict]:
        """Filter today's items on the queue-owner thread."""
        today = datetime.now().date()
        filtered = []
        for item in self._queue:
            try:
                item_date = datetime.fromisoformat(item.created_at).date()
                if item_date == today:
                    filtered.append(asdict(item))
            except (ValueError, AttributeError):
                continue
        return filtered

    def get_latest_items(self, limit: int = 300) -> List[Dict]:
        """
        Get latest N items from queue

        Args:
            limit: Maximum number of items to return (default: 300)

        Returns:
            List[Dict]: Latest items (sorted by creation time, newest first)
        """
        return call_serialized(_QUEUE_STATE_QUEUE, self._get_latest_items, limit)

    def _get_latest_items(self, limit: int) -> List[Dict]:
        """Build the latest-items snapshot on the queue-owner thread."""
        sorted_queue = sorted(
            self._queue,
            key=lambda item: item.created_at,
            reverse=True
        )
        return [asdict(item) for item in sorted_queue[:limit]]

    def change_item_category(self, index: int, new_category: str) -> bool:
        """
        Change category for a queue item

        Args:
            index: Item index
            new_category: New category name

        Returns:
            bool: True if category was changed
        """
        return call_serialized(
            _QUEUE_STATE_QUEUE,
            self._change_item_category,
            index,
            new_category,
        )

    def _change_item_category(self, index: int, new_category: str) -> bool:
        """Change an item category on the queue-owner thread."""
        if 0 <= index < len(self._queue):
            old_category = self._queue[index].category
            self._queue[index].category = new_category
            self._save_queue()
            ColorPrint.blue(f"[VoiceSubtitle] Changed category: {old_category} -> {new_category}")
            return True
        return False

    def remove_items(self, indices: List[int]) -> int:
        """
        Remove multiple items from queue

        Args:
            indices: List of item indices to remove

        Returns:
            int: Number of items removed
        """
        return call_serialized(_QUEUE_STATE_QUEUE, self._remove_items, indices)

    def _remove_items(self, indices: List[int]) -> int:
        """Remove multiple items on the queue-owner thread."""
        sorted_indices = sorted(set(indices), reverse=True)
        removed_count = 0
        for index in sorted_indices:
            if 0 <= index < len(self._queue):
                item = self._queue.pop(index)
                removed_count += 1
                ColorPrint.blue(f"[VoiceSubtitle] Removed item: {item.text}")
        if self._queue and self._current_index >= len(self._queue):
            self._current_index = len(self._queue) - 1
        elif not self._queue:
            self._current_index = 0
        if removed_count > 0:
            self._save_queue()
            ColorPrint.green(f"[VoiceSubtitle] Removed {removed_count} items")
        return removed_count


_VOICE_SUBTITLE_QUEUE_PROVIDER = SerializedSingletonProvider(
    VoiceSubtitleQueue,
    "desktop.voice_subtitle_queue.provider",
    "VoiceSubtitleQueueProvider",
)


def get_voice_subtitle_queue() -> VoiceSubtitleQueue:
    """
    Get global voice subtitle queue instance

    Returns:
        VoiceSubtitleQueue: Global queue instance
    """
    return _VOICE_SUBTITLE_QUEUE_PROVIDER.get()
