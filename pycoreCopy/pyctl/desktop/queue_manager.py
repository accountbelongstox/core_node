# -*- coding: utf-8 -*-
"""
Voice Subtitle Queue Manager

Manages queue of voice subtitles with text, audio path, play count, and categories.
Uses system cache directory for persistent storage.
"""

import json
import threading
from pathlib import Path
from typing import List, Dict, Optional, Set
from dataclasses import dataclass, asdict
from datetime import datetime

from pycore.pyfoundations.system_paths import APP_DATA_DIR
from pycore import ColorPrint


@dataclass
class VoiceSubtitleItem:
    """Voice subtitle item"""
    text: str
    audio_path: str
    play_count: int = 0
    category: str = "normal"  # 分类（默认"normal"普通）
    created_at: str = ""  # ISO格式时间戳

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
    - Thread-safe operations
    - Playback control (enabled/disabled)
    """

    def __init__(self):
        """Initialize voice subtitle queue"""
        self._lock = threading.RLock()
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

        with self._lock:
            with open(self._storage_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self._queue = [VoiceSubtitleItem(**item) for item in data.get('queue', [])]
                self._current_index = data.get('current_index', 0)
                self._enabled = data.get('enabled', False)

    def _save_queue(self):
        """Save queue to disk"""
        with self._lock:
            data = {
                'queue': [asdict(item) for item in self._queue],
                'current_index': self._current_index,
                'enabled': self._enabled
            }

            with open(self._storage_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

    def add_item(self, text: str, audio_path: str, category: str = "normal") -> None:
        """
        Add item to queue

        Args:
            text: Subtitle text
            audio_path: Path to audio file
            category: Item category (default: "normal")
        """
        with self._lock:
            item = VoiceSubtitleItem(text=text, audio_path=audio_path, category=category)
            self._queue.append(item)
            self._save_queue()
            ColorPrint.blue(f"[VoiceSubtitle] Added item ({category}): {text}")

    def remove_item(self, index: int) -> bool:
        """
        Remove item from queue

        Args:
            index: Item index

        Returns:
            bool: True if removed
        """
        with self._lock:
            if 0 <= index < len(self._queue):
                item = self._queue.pop(index)
                # Adjust current index if necessary
                if self._current_index >= len(self._queue) and len(self._queue) > 0:
                    self._current_index = len(self._queue) - 1
                elif len(self._queue) == 0:
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
        with self._lock:
            if 0 <= self._current_index < len(self._queue):
                return self._queue[self._current_index]
            return None

    def next_item(self) -> Optional[VoiceSubtitleItem]:
        """
        Move to next item

        Returns:
            Optional[VoiceSubtitleItem]: Next item or None
        """
        with self._lock:
            if len(self._queue) == 0:
                return None

            self._current_index = (self._current_index + 1) % len(self._queue)
            self._save_queue()
            return self.get_current_item()

    def previous_item(self) -> Optional[VoiceSubtitleItem]:
        """
        Move to previous item

        Returns:
            Optional[VoiceSubtitleItem]: Previous item or None
        """
        with self._lock:
            if len(self._queue) == 0:
                return None

            self._current_index = (self._current_index - 1) % len(self._queue)
            self._save_queue()
            return self.get_current_item()

    def set_current_index(self, index: int) -> bool:
        """
        Set current index

        Args:
            index: New index

        Returns:
            bool: True if index was set
        """
        with self._lock:
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
        with self._lock:
            idx = index if index is not None else self._current_index
            if 0 <= idx < len(self._queue):
                self._queue[idx].play_count += 1
                self._save_queue()

    def get_queue(self) -> List[Dict]:
        """
        Get queue as list of dicts

        Returns:
            List[Dict]: Queue items
        """
        with self._lock:
            return [asdict(item) for item in self._queue]

    def get_current_index(self) -> int:
        """Get current index"""
        with self._lock:
            return self._current_index

    def is_enabled(self) -> bool:
        """Check if playback is enabled"""
        with self._lock:
            return self._enabled

    def set_enabled(self, enabled: bool) -> None:
        """
        Enable/disable playback

        Args:
            enabled: Enable state
        """
        with self._lock:
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
        with self._lock:
            self._enabled = not self._enabled
            self._save_queue()
            status = "enabled" if self._enabled else "disabled"
            ColorPrint.green(f"[VoiceSubtitle] Playback {status}")
            return self._enabled

    def clear_queue(self) -> None:
        """Clear all items from queue"""
        with self._lock:
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
        with self._lock:
            categories = set(item.category for item in self._queue)
            return sorted(list(categories))

    def filter_by_category(self, category: str) -> List[Dict]:
        """
        Get queue items filtered by category

        Args:
            category: Category name to filter

        Returns:
            List[Dict]: Filtered queue items
        """
        with self._lock:
            filtered = [asdict(item) for item in self._queue if item.category == category]
            return filtered

    def filter_by_today(self) -> List[Dict]:
        """
        Get queue items created today

        Returns:
            List[Dict]: Items created today
        """
        with self._lock:
            today = datetime.now().date()
            filtered = []
            for item in self._queue:
                try:
                    item_date = datetime.fromisoformat(item.created_at).date()
                    if item_date == today:
                        filtered.append(asdict(item))
                except (ValueError, AttributeError):
                    # Skip items with invalid timestamps
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
        with self._lock:
            # Sort by created_at descending (newest first)
            sorted_queue = sorted(
                self._queue,
                key=lambda item: item.created_at,
                reverse=True
            )
            limited = sorted_queue[:limit]
            return [asdict(item) for item in limited]

    def change_item_category(self, index: int, new_category: str) -> bool:
        """
        Change category for a queue item

        Args:
            index: Item index
            new_category: New category name

        Returns:
            bool: True if category was changed
        """
        with self._lock:
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
        with self._lock:
            # Sort indices in descending order to avoid index shifting issues
            sorted_indices = sorted(set(indices), reverse=True)
            removed_count = 0

            for index in sorted_indices:
                if 0 <= index < len(self._queue):
                    item = self._queue.pop(index)
                    removed_count += 1
                    ColorPrint.blue(f"[VoiceSubtitle] Removed item: {item.text}")

            # Adjust current index if necessary
            if len(self._queue) > 0:
                if self._current_index >= len(self._queue):
                    self._current_index = len(self._queue) - 1
            else:
                self._current_index = 0

            if removed_count > 0:
                self._save_queue()
                ColorPrint.green(f"[VoiceSubtitle] Removed {removed_count} items")

            return removed_count


# Global instance
_voice_subtitle_queue: Optional[VoiceSubtitleQueue] = None
_queue_lock = threading.Lock()


def get_voice_subtitle_queue() -> VoiceSubtitleQueue:
    """
    Get global voice subtitle queue instance

    Returns:
        VoiceSubtitleQueue: Global queue instance
    """
    global _voice_subtitle_queue

    if _voice_subtitle_queue is None:
        with _queue_lock:
            if _voice_subtitle_queue is None:
                _voice_subtitle_queue = VoiceSubtitleQueue()

    return _voice_subtitle_queue
