#!/usr/bin/env python3
"""
Coin Data Object - Manages price history and change calculations
Loads recent history from database and provides price change calculations
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from collections import deque

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.database.models.app_okx.coin_price_history_model import CoinPriceHistoryModelFactory
from pycore.database.models.app_okx.time_deduplicator import GlobalTimestampDeduplicator


class CoinDataObject:
    """
    Data object for a single cryptocurrency

    Features:
    - Load last 3 hours of price history from database
    - Calculate price changes (30s, 1min)
    - Track current price
    - Memory-efficient circular buffer for recent data
    - Auto-deduplication via global timestamp interceptor
    """

    def __init__(self, coin_symbol: str, database_name: str = "okx"):
        """
        Initialize coin data object

        Args:
            coin_symbol: Coin symbol (e.g., "BTC", "ETH")
            database_name: Database name for loading history
        """
        self.coin_symbol = coin_symbol
        self.database_name = database_name

        # Get model for this coin
        self.model = CoinPriceHistoryModelFactory.create_model(coin_symbol)

        # Get global deduplicator
        self.deduplicator = GlobalTimestampDeduplicator.get_instance()

        # In-memory history buffer (circular, limited size)
        # Stores tuples: (timestamp_ms, price, full_data_dict)
        self._history_buffer = deque(maxlen=10800)  # ~3 hours at 1s interval

        # Current price data
        self.current_price: Optional[float] = None
        self.current_timestamp_ms: Optional[int] = None
        self.current_data: Optional[Dict[str, Any]] = None

        # Statistics
        self._loaded_records_count = 0
        self._rejected_duplicates_count = 0

    def load_recent_history(self, conn, hours: int = 3) -> int:
        """
        Load recent price history from database

        Args:
            conn: Database connection
            hours: Number of hours to load (default: 3)

        Returns:
            Number of records loaded
        """
        # Calculate timestamp cutoff
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        cutoff_ms = int(cutoff_time.timestamp() * 1000)

        # Query database
        records = self.model.get_records_since(conn, cutoff_ms, limit=10800)

        # Load into buffer
        for record in records:
            timestamp_ms = record['timestamp_ms']
            price = record['price']

            # Add to buffer
            self._history_buffer.append((timestamp_ms, price, record))

            # Mark in deduplicator
            self.deduplicator.mark_processed(self.coin_symbol, timestamp_ms)

        self._loaded_records_count = len(records)

        # Set current price if available
        if records:
            latest = records[-1]
            self.current_price = latest['price']
            self.current_timestamp_ms = latest['timestamp_ms']
            self.current_data = latest

        return len(records)

    def add_price_data(self, conn, price_data: Dict[str, Any], auto_save: bool = True) -> bool:
        """
        Add new price data

        Args:
            conn: Database connection
            price_data: Price data dictionary
            auto_save: Automatically save to database if not duplicate

        Returns:
            True if data was added (not duplicate)
            False if data was rejected (duplicate timestamp)
        """
        timestamp_ms = price_data.get('timestamp_ms')
        if not timestamp_ms:
            timestamp_ms = int(datetime.utcnow().timestamp() * 1000)
            price_data['timestamp_ms'] = timestamp_ms

        # Check deduplication
        if not self.deduplicator.should_accept(self.coin_symbol, timestamp_ms):
            self._rejected_duplicates_count += 1
            return False

        # Extract price
        price = price_data.get('price')
        if price is None:
            ColorPrint.yellow(f"[CoinData] Warning: Price data missing for {self.coin_symbol}")
            return False

        # Add to buffer
        self._history_buffer.append((timestamp_ms, price, price_data.copy()))

        # Update current data
        self.current_price = price
        self.current_timestamp_ms = timestamp_ms
        self.current_data = price_data.copy()

        # Auto-save to database
        if auto_save:
            try:
                self.model.insert_price_data(conn, price_data)
            except Exception as e:
                ColorPrint.red(f"[CoinData] Failed to save {self.coin_symbol}: {e}")

        return True

    def get_price_change_30s(self) -> Optional[float]:
        """
        Calculate price change percentage in last 30 seconds

        Returns:
            Price change percentage or None if insufficient data
        """
        if not self.current_timestamp_ms or not self.current_price:
            return None

        # Find price 30 seconds ago
        target_ms = self.current_timestamp_ms - 30000

        past_price = self._find_nearest_price(target_ms)
        if past_price is None:
            return None

        # Calculate percentage change
        change = ((self.current_price - past_price) / past_price) * 100
        return round(change, 4)

    def get_price_change_1min(self) -> Optional[float]:
        """
        Calculate price change percentage in last 1 minute

        Returns:
            Price change percentage or None if insufficient data
        """
        if not self.current_timestamp_ms or not self.current_price:
            return None

        # Find price 1 minute ago
        target_ms = self.current_timestamp_ms - 60000

        past_price = self._find_nearest_price(target_ms)
        if past_price is None:
            return None

        # Calculate percentage change
        change = ((self.current_price - past_price) / past_price) * 100
        return round(change, 4)

    def get_price_change_2min(self) -> Optional[float]:
        """
        Calculate price change percentage in last 2 minutes

        Returns:
            Price change percentage or None if insufficient data
        """
        if not self.current_timestamp_ms or not self.current_price:
            return None

        # Find price 2 minutes ago
        target_ms = self.current_timestamp_ms - 120000

        past_price = self._find_nearest_price(target_ms)
        if past_price is None:
            return None

        # Calculate percentage change
        change = ((self.current_price - past_price) / past_price) * 100
        return round(change, 4)

    def get_price_change_custom(self, seconds_ago: int) -> Optional[float]:
        """
        Calculate price change for custom time period

        Args:
            seconds_ago: Number of seconds to look back

        Returns:
            Price change percentage or None if insufficient data
        """
        if not self.current_timestamp_ms or not self.current_price:
            return None

        target_ms = self.current_timestamp_ms - (seconds_ago * 1000)

        past_price = self._find_nearest_price(target_ms)
        if past_price is None:
            return None

        change = ((self.current_price - past_price) / past_price) * 100
        return round(change, 4)

    def _find_nearest_price(self, target_ms: int, tolerance_ms: int = 5000) -> Optional[float]:
        """
        Find nearest price to target timestamp

        Args:
            target_ms: Target timestamp in milliseconds
            tolerance_ms: Maximum time difference allowed (default: 5 seconds)

        Returns:
            Price or None if no suitable record found
        """
        if not self._history_buffer:
            return None

        # Binary search for nearest timestamp
        best_diff = float('inf')
        best_price = None

        for timestamp_ms, price, _ in self._history_buffer:
            diff = abs(timestamp_ms - target_ms)

            if diff < best_diff:
                best_diff = diff
                best_price = price

            # Early exit if exact match
            if diff == 0:
                break

        # Check tolerance
        if best_diff > tolerance_ms:
            return None

        return best_price

    def get_price_trend(self, seconds: int) -> Optional[str]:
        """
        Get price trend direction for a time period

        Args:
            seconds: Time period in seconds (e.g., 30, 60, 120)

        Returns:
            "up", "down", "flat", or None if insufficient data
        """
        change = self.get_price_change_custom(seconds)

        if change is None:
            return None

        # Threshold for "flat" (±0.1%)
        if abs(change) < 0.1:
            return "flat"
        elif change > 0:
            return "up"
        else:
            return "down"

    def get_all_trends(self) -> Dict[str, Optional[str]]:
        """
        Get price trends for all standard periods

        Returns:
            Dictionary with trends for 30s, 1min, 2min
        """
        return {
            'trend_30s': self.get_price_trend(30),
            'trend_1min': self.get_price_trend(60),
            'trend_2min': self.get_price_trend(120)
        }

    def get_history_summary(self) -> Dict[str, Any]:
        """
        Get summary of loaded history

        Returns:
            Dictionary with history statistics
        """
        if not self._history_buffer:
            return {
                'coin_symbol': self.coin_symbol,
                'records_in_buffer': 0,
                'oldest_timestamp': None,
                'newest_timestamp': None,
                'current_price': self.current_price
            }

        timestamps = [ts for ts, _, _ in self._history_buffer]

        return {
            'coin_symbol': self.coin_symbol,
            'records_in_buffer': len(self._history_buffer),
            'oldest_timestamp': min(timestamps),
            'newest_timestamp': max(timestamps),
            'current_price': self.current_price,
            'loaded_from_db': self._loaded_records_count,
            'rejected_duplicates': self._rejected_duplicates_count
        }

    def get_recent_prices(self, count: int = 10) -> List[Dict[str, Any]]:
        """
        Get most recent N prices

        Args:
            count: Number of recent prices to return

        Returns:
            List of price records (newest first)
        """
        recent = list(self._history_buffer)[-count:]
        recent.reverse()

        return [
            {
                'timestamp_ms': ts,
                'price': price,
                'data': data
            }
            for ts, price, data in recent
        ]

    def clear_history(self):
        """
        Clear all history from memory buffer
        """
        self._history_buffer.clear()
        self.current_price = None
        self.current_timestamp_ms = None
        self.current_data = None
        self._loaded_records_count = 0
        self._rejected_duplicates_count = 0
