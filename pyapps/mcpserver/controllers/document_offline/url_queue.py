#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
URL Queue

Queue for managing URLs during crawling
"""

from typing import Optional, Dict, Any
from collections import deque


class UrlQueue:
    """
    URL queue with depth tracking and duplicate prevention

    Features:
    - FIFO queue with depth tracking
    - Duplicate detection
    - Processed URL tracking
    - Requeue support
    """

    def __init__(self):
        """Initialize URL queue"""
        self.pending = deque()
        self.processed = set()

    def enqueue(self, url: str, depth: int):
        """
        Add URL to queue

        Args:
            url: URL to enqueue
            depth: Current depth
        """
        if not url:
            return

        if not isinstance(url, str):
            return

        # Normalize URL (remove hash)
        normalized_url = url.split('#')[0].strip()
        if not normalized_url:
            return

        payload = {'url': normalized_url, 'depth': depth}

        if normalized_url in self.processed:
            return

        # Check if already in pending queue
        if any(item['url'] == normalized_url for item in self.pending):
            return

        self.pending.append(payload)

    def requeue(self, item: Dict[str, Any]):
        """
        Requeue item at front of queue

        Args:
            item: Item to requeue
        """
        if not item or 'url' not in item:
            return

        if item['url'] in self.processed:
            return

        # Check if already in pending queue
        if any(entry['url'] == item['url'] for entry in self.pending):
            return

        self.pending.appendleft(item)

    def dequeue(self) -> Optional[Dict[str, Any]]:
        """
        Remove and return next item from queue

        Returns:
            Next item or None if empty
        """
        return self.pending.popleft() if self.pending else None

    def mark_processed(self, url: str):
        """
        Mark URL as processed

        Args:
            url: URL to mark
        """
        if url:
            self.processed.add(url)

    def has_processed(self, url: str) -> bool:
        """
        Check if URL has been processed

        Args:
            url: URL to check

        Returns:
            True if processed
        """
        if not url:
            return False
        return url.split('#')[0] in self.processed

    def has_pending(self) -> bool:
        """
        Check if queue has pending items

        Returns:
            True if has pending items
        """
        return len(self.pending) > 0

    def size(self) -> int:
        """
        Get pending queue size

        Returns:
            Number of pending items
        """
        return len(self.pending)

    def processed_count(self) -> int:
        """
        Get processed count

        Returns:
            Number of processed URLs
        """
        return len(self.processed)
