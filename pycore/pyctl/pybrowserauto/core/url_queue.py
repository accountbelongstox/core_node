#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
URL Queue

Thread-safe URL queue with deduplication and depth tracking for document offline downloads.
"""

import threading
from collections import deque
from typing import Optional, Tuple, Set
from urllib.parse import urlparse, urlunparse
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


class URLQueue:
    """
    Thread-safe URL queue with deduplication

    Features:
    - Depth tracking for each URL
    - Processed URLs tracking (Set-based)
    - Auto-deduplication (fragment removal)
    - Requeue support for failed downloads
    - FIFO queue semantics
    """

    def __init__(self):
        """Initialize URL queue"""
        self._queue = deque()
        self._processed: Set[str] = set()
        self._lock = threading.Lock()
        self._total_enqueued = 0
        self._total_dequeued = 0

    def enqueue(self, url: str, depth: int = 0) -> bool:
        """
        Add URL to queue

        Args:
            url: URL to add
            depth: Depth level (default: 0)

        Returns:
            True if URL was added, False if already processed or in queue
        """
        # Normalize URL (remove fragment)
        normalized = self._normalize_url(url)

        if not normalized:
            ColorPrint.yellow(f'[URLQueue] Invalid URL, skipping: {url}')
            return False

        with self._lock:
            # Skip if already processed
            if normalized in self._processed:
                return False

            # Check if already in queue
            for queued_url, _ in self._queue:
                if queued_url == normalized:
                    return False

            # Add to queue
            self._queue.append((normalized, depth))
            self._total_enqueued += 1

            return True

    def dequeue(self) -> Optional[Tuple[str, int]]:
        """
        Get next URL from queue (FIFO)

        Returns:
            Tuple of (url, depth) or None if queue is empty
        """
        with self._lock:
            if len(self._queue) == 0:
                return None

            url, depth = self._queue.popleft()
            self._total_dequeued += 1

            return (url, depth)

    def mark_processed(self, url: str):
        """
        Mark URL as processed

        Args:
            url: URL to mark as processed
        """
        normalized = self._normalize_url(url)

        if not normalized:
            return

        with self._lock:
            self._processed.add(normalized)

    def has_processed(self, url: str) -> bool:
        """
        Check if URL has been processed

        Args:
            url: URL to check

        Returns:
            True if URL has been processed
        """
        normalized = self._normalize_url(url)

        if not normalized:
            return False

        with self._lock:
            return normalized in self._processed

    def requeue(self, url: str, depth: int = 0) -> bool:
        """
        Re-add URL to queue (for retry)

        Removes from processed set and adds back to queue.

        Args:
            url: URL to requeue
            depth: Depth level

        Returns:
            True if URL was requeued
        """
        normalized = self._normalize_url(url)

        if not normalized:
            return False

        with self._lock:
            # Remove from processed set
            self._processed.discard(normalized)

            # Add to queue
            self._queue.append((normalized, depth))
            self._total_enqueued += 1

            ColorPrint.yellow(f'[URLQueue] Requeued URL: {url}')
            return True

    def is_empty(self) -> bool:
        """
        Check if queue is empty

        Returns:
            True if queue is empty
        """
        with self._lock:
            return len(self._queue) == 0

    def size(self) -> int:
        """
        Get current queue size

        Returns:
            Number of URLs in queue
        """
        with self._lock:
            return len(self._queue)

    def processed_count(self) -> int:
        """
        Get number of processed URLs

        Returns:
            Number of processed URLs
        """
        with self._lock:
            return len(self._processed)

    def get_stats(self) -> dict:
        """
        Get queue statistics

        Returns:
            Dictionary with queue stats
        """
        with self._lock:
            return {
                'queue_size': len(self._queue),
                'processed_count': len(self._processed),
                'total_enqueued': self._total_enqueued,
                'total_dequeued': self._total_dequeued,
                'pending_count': len(self._queue)
            }

    def clear(self):
        """Clear queue and processed set"""
        with self._lock:
            self._queue.clear()
            self._processed.clear()
            ColorPrint.blue('[URLQueue] Queue cleared')

    def get_processed_urls(self) -> list:
        """
        Get list of all processed URLs

        Returns:
            List of processed URLs
        """
        with self._lock:
            return list(self._processed)

    def _normalize_url(self, url: str) -> Optional[str]:
        """
        Normalize URL (remove fragment, lowercase)

        Args:
            url: URL to normalize

        Returns:
            Normalized URL or None if invalid
        """
        if not url:
            return None

        parsed = urlparse(url)

        # Must have scheme and netloc
        if not parsed.scheme or not parsed.netloc:
            return None

        # Lowercase scheme and netloc
        scheme = parsed.scheme.lower()
        netloc = parsed.netloc.lower()

        # Reconstruct URL without fragment
        normalized = urlunparse((
            scheme,
            netloc,
            parsed.path,
            parsed.params,
            parsed.query,
            ''  # Remove fragment
        ))

        return normalized


__all__ = ['URLQueue']
