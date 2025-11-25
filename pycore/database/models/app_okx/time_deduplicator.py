#!/usr/bin/env python3
"""
Time-based Deduplication Interceptor for OKX Price Data
Prevents duplicate database inserts by tracking timestamps in memory

Uses memory-based tracking instead of database queries for performance,
since the number of coins is large and database checks would be too slow.
"""

from typing import Dict, Set, Optional
from datetime import datetime, timedelta
import time


class TimestampDeduplicator:
    """
    Memory-based timestamp deduplication system

    Features:
    - Per-coin timestamp tracking
    - Automatic cleanup of old timestamps
    - Configurable time window for deduplication
    - Namespace-aware (full isolation per coin)
    """

    def __init__(self, time_window_seconds: int = 10):
        """
        Initialize deduplicator

        Args:
            time_window_seconds: Time window for deduplication (default: 10 seconds)
                                 Data with same timestamp within this window will be rejected
        """
        self._time_window_ms = time_window_seconds * 1000

        # Storage: coin_symbol -> Set[timestamp_ms]
        self._coin_timestamps: Dict[str, Set[int]] = {}

        # Track last cleanup time per coin
        self._last_cleanup: Dict[str, float] = {}

        # Cleanup interval (cleanup every 60 seconds)
        self._cleanup_interval_seconds = 60

    def should_accept(self, coin_symbol: str, timestamp_ms: int) -> bool:
        """
        Check if timestamp should be accepted (not duplicate)

        Args:
            coin_symbol: Coin symbol (e.g., "BTC", "ETH")
            timestamp_ms: Timestamp in milliseconds

        Returns:
            True if timestamp is unique and should be accepted
            False if duplicate and should be rejected
        """
        # Normalize coin symbol
        coin_key = coin_symbol.lower()

        # Initialize tracking for new coin
        if coin_key not in self._coin_timestamps:
            self._coin_timestamps[coin_key] = set()
            self._last_cleanup[coin_key] = time.time()

        # Check if timestamp already exists
        if timestamp_ms in self._coin_timestamps[coin_key]:
            return False

        # Add timestamp to tracking
        self._coin_timestamps[coin_key].add(timestamp_ms)

        # Perform periodic cleanup
        self._maybe_cleanup(coin_key)

        return True

    def _maybe_cleanup(self, coin_key: str):
        """
        Maybe perform cleanup of old timestamps

        Args:
            coin_key: Normalized coin symbol
        """
        now = time.time()
        last_cleanup = self._last_cleanup.get(coin_key, 0)

        # Check if cleanup interval elapsed
        if now - last_cleanup < self._cleanup_interval_seconds:
            return

        # Perform cleanup
        cutoff_ms = int((now * 1000) - self._time_window_ms)
        timestamps = self._coin_timestamps[coin_key]

        # Remove old timestamps (older than time window)
        old_timestamps = {ts for ts in timestamps if ts < cutoff_ms}
        timestamps -= old_timestamps

        # Update cleanup time
        self._last_cleanup[coin_key] = now

    def mark_processed(self, coin_symbol: str, timestamp_ms: int):
        """
        Manually mark a timestamp as processed

        Args:
            coin_symbol: Coin symbol
            timestamp_ms: Timestamp in milliseconds
        """
        coin_key = coin_symbol.lower()

        if coin_key not in self._coin_timestamps:
            self._coin_timestamps[coin_key] = set()
            self._last_cleanup[coin_key] = time.time()

        self._coin_timestamps[coin_key].add(timestamp_ms)

    def clear_coin(self, coin_symbol: str):
        """
        Clear all timestamps for a specific coin

        Args:
            coin_symbol: Coin symbol
        """
        coin_key = coin_symbol.lower()
        if coin_key in self._coin_timestamps:
            self._coin_timestamps[coin_key].clear()

    def clear_all(self):
        """
        Clear all timestamps for all coins
        """
        self._coin_timestamps.clear()
        self._last_cleanup.clear()

    def get_coin_stats(self, coin_symbol: str) -> Dict[str, any]:
        """
        Get statistics for a specific coin

        Args:
            coin_symbol: Coin symbol

        Returns:
            Dictionary with tracking stats
        """
        coin_key = coin_symbol.lower()

        if coin_key not in self._coin_timestamps:
            return {
                'coin_symbol': coin_symbol,
                'tracked_timestamps': 0,
                'oldest_timestamp': None,
                'newest_timestamp': None,
                'last_cleanup': None
            }

        timestamps = self._coin_timestamps[coin_key]
        sorted_ts = sorted(timestamps) if timestamps else []

        return {
            'coin_symbol': coin_symbol,
            'tracked_timestamps': len(timestamps),
            'oldest_timestamp': sorted_ts[0] if sorted_ts else None,
            'newest_timestamp': sorted_ts[-1] if sorted_ts else None,
            'last_cleanup': self._last_cleanup.get(coin_key)
        }

    def get_global_stats(self) -> Dict[str, any]:
        """
        Get global deduplicator statistics

        Returns:
            Dictionary with global stats
        """
        total_timestamps = sum(len(ts) for ts in self._coin_timestamps.values())

        return {
            'total_coins_tracked': len(self._coin_timestamps),
            'total_timestamps_cached': total_timestamps,
            'time_window_ms': self._time_window_ms,
            'cleanup_interval_seconds': self._cleanup_interval_seconds
        }

    def force_cleanup_all(self):
        """
        Force cleanup of all coins immediately
        """
        now = time.time()
        cutoff_ms = int((now * 1000) - self._time_window_ms)

        for coin_key in list(self._coin_timestamps.keys()):
            timestamps = self._coin_timestamps[coin_key]
            old_timestamps = {ts for ts in timestamps if ts < cutoff_ms}
            timestamps -= old_timestamps
            self._last_cleanup[coin_key] = now


class GlobalTimestampDeduplicator:
    """
    Global singleton deduplicator instance
    Shared across all coin data objects
    """

    _instance: Optional[TimestampDeduplicator] = None

    @classmethod
    def get_instance(cls, time_window_seconds: int = 10) -> TimestampDeduplicator:
        """
        Get or create global deduplicator instance

        Args:
            time_window_seconds: Time window for deduplication

        Returns:
            Global deduplicator instance
        """
        if cls._instance is None:
            cls._instance = TimestampDeduplicator(time_window_seconds)
        return cls._instance

    @classmethod
    def reset(cls):
        """
        Reset global instance (for testing)
        """
        cls._instance = None
