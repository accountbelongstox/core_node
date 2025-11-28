#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Timestamp Interceptor - Memory-based Data Filtering

In-memory filtering to avoid fetching duplicate data.
Uses latest timestamp from memory to filter new requests.
"""

import time
from typing import Dict, Optional, List


class TimestampInterceptor:
    """
    Memory-based timestamp interceptor

    Tracks latest timestamp for each coin to avoid re-fetching data.
    Uses 1970 epoch as starting point for new coins.
    """

    def __init__(self):
        """Initialize timestamp interceptor"""
        self.coin_timestamps: Dict[str, int] = {}
        self.epoch_timestamp = 0  # 1970-01-01 00:00:00

    def get_latest_timestamp(self, coin_symbol: str) -> int:
        """
        Get latest timestamp for a coin

        Args:
            coin_symbol (str): Coin symbol

        Returns:
            int: Latest timestamp (0 for new coins)
        """
        return self.coin_timestamps.get(coin_symbol, self.epoch_timestamp)

    def update_timestamp(self, coin_symbol: str, timestamp: int):
        """
        Update latest timestamp for a coin

        Args:
            coin_symbol (str): Coin symbol
            timestamp (int): New timestamp
        """
        current = self.coin_timestamps.get(coin_symbol, self.epoch_timestamp)

        if timestamp > current:
            self.coin_timestamps[coin_symbol] = timestamp

    def update_from_candles(self, coin_symbol: str, candles: List[List]):
        """
        Update timestamp from candle data

        Args:
            coin_symbol (str): Coin symbol
            candles (List[List]): Candle data from OKX API
        """
        if not candles:
            return

        timestamps = [int(candle[0]) for candle in candles if candle]

        if timestamps:
            latest = max(timestamps)
            self.update_timestamp(coin_symbol, latest)

    def should_fetch(self, coin_symbol: str, timestamp: int) -> bool:
        """
        Check if should fetch data for this timestamp

        Args:
            coin_symbol (str): Coin symbol
            timestamp (int): Timestamp to check

        Returns:
            bool: True if should fetch (timestamp > latest)
        """
        latest = self.get_latest_timestamp(coin_symbol)
        return timestamp > latest

    def filter_candles(self, coin_symbol: str, candles: List[List]) -> List[List]:
        """
        Filter candles to only include new data

        Args:
            coin_symbol (str): Coin symbol
            candles (List[List]): Raw candle data

        Returns:
            List[List]: Filtered candles (only new timestamps)
        """
        if not candles:
            return []

        latest = self.get_latest_timestamp(coin_symbol)

        filtered = [
            candle for candle in candles
            if candle and int(candle[0]) > latest
        ]

        return filtered

    def get_stats(self) -> Dict:
        """
        Get interceptor statistics

        Returns:
            Dict: Statistics
        """
        return {
            'tracked_coins': len(self.coin_timestamps),
            'coins': list(self.coin_timestamps.keys())[:20],  # First 20
            'sample_timestamps': {
                coin: ts
                for coin, ts in list(self.coin_timestamps.items())[:5]
            }
        }


# Global instance
_global_interceptor = None


def get_timestamp_interceptor() -> TimestampInterceptor:
    """
    Get global timestamp interceptor instance

    Returns:
        TimestampInterceptor: Global interceptor
    """
    global _global_interceptor

    if _global_interceptor is None:
        _global_interceptor = TimestampInterceptor()

    return _global_interceptor
