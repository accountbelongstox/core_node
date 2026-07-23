#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
URL Queue

Thread-safe URL queue with deduplication and depth tracking for document offline downloads.
"""

import uuid
from typing import Optional, Tuple
from urllib.parse import urlparse, urlunparse

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus import THREAD_BUS


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
        queue_id = uuid.uuid4().hex
        self._queue_name = f"pybrowserauto.urls.{queue_id}"
        self._state_signal = f"{self._queue_name}.state"
        THREAD_BUS.signal(self._state_signal, {
            'processed': frozenset(),
            'pending': frozenset(),
            'total_enqueued': 0,
            'total_dequeued': 0,
        })

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

        state = self._state()
        if normalized in state['processed'] or normalized in state['pending']:
            return False
        pending = set(state['pending'])
        pending.add(normalized)
        THREAD_BUS.send_message(self._queue_name, (normalized, depth))
        self._publish_state(
            state,
            pending=frozenset(pending),
            total_enqueued=state['total_enqueued'] + 1,
        )
        return True

    def dequeue(self) -> Optional[Tuple[str, int]]:
        """
        Get next URL from queue (FIFO)

        Returns:
            Tuple of (url, depth) or None if queue is empty
        """
        item = THREAD_BUS.receive_message(self._queue_name)
        if not isinstance(item, tuple) or len(item) != 2:
            return None
        url, depth = item
        state = self._state()
        pending = set(state['pending'])
        pending.discard(url)
        self._publish_state(
            state,
            pending=frozenset(pending),
            total_dequeued=state['total_dequeued'] + 1,
        )
        return url, depth

    def mark_processed(self, url: str):
        """
        Mark URL as processed

        Args:
            url: URL to mark as processed
        """
        normalized = self._normalize_url(url)

        if not normalized:
            return

        state = self._state()
        processed = set(state['processed'])
        processed.add(normalized)
        self._publish_state(state, processed=frozenset(processed))

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

        return normalized in self._state()['processed']

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

        state = self._state()
        processed = set(state['processed'])
        pending = set(state['pending'])
        processed.discard(normalized)
        pending.add(normalized)
        THREAD_BUS.send_message(self._queue_name, (normalized, depth))
        self._publish_state(
            state,
            processed=frozenset(processed),
            pending=frozenset(pending),
            total_enqueued=state['total_enqueued'] + 1,
        )
        ColorPrint.yellow(f'[URLQueue] Requeued URL: {url}')
        return True

    def is_empty(self) -> bool:
        """
        Check if queue is empty

        Returns:
            True if queue is empty
        """
        return THREAD_BUS.queue_size(self._queue_name) == 0

    def size(self) -> int:
        """
        Get current queue size

        Returns:
            Number of URLs in queue
        """
        return THREAD_BUS.queue_size(self._queue_name)

    def processed_count(self) -> int:
        """
        Get number of processed URLs

        Returns:
            Number of processed URLs
        """
        return len(self._state()['processed'])

    def get_stats(self) -> dict:
        """
        Get queue statistics

        Returns:
            Dictionary with queue stats
        """
        state = self._state()
        queue_size = THREAD_BUS.queue_size(self._queue_name)
        return {
            'queue_size': queue_size,
            'processed_count': len(state['processed']),
            'total_enqueued': state['total_enqueued'],
            'total_dequeued': state['total_dequeued'],
            'pending_count': queue_size,
        }

    def clear(self):
        """Clear queue and processed set"""
        THREAD_BUS.clear_queue(self._queue_name)
        state = self._state()
        self._publish_state(
            state,
            processed=frozenset(),
            pending=frozenset(),
        )
        ColorPrint.blue('[URLQueue] Queue cleared')

    def get_processed_urls(self) -> list:
        """
        Get list of all processed URLs

        Returns:
            List of processed URLs
        """
        return list(self._state()['processed'])

    def _state(self) -> dict:
        """Return the current THREAD_BUS state snapshot."""
        return THREAD_BUS.get_signal(self._state_signal, {}) or {}

    def _publish_state(self, state: dict, **updates) -> None:
        """Publish one complete queue state snapshot."""
        THREAD_BUS.signal(self._state_signal, {**state, **updates})

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
