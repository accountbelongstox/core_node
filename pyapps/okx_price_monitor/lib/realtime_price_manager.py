#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Real-time Price Manager - Real-time Price Data Storage

Manages real-time price tables for each coin.
Stores millisecond-level price updates from WebSocket.
Implements sampling and cleanup strategies to manage data volume.
"""

import sqlite3
import time
from typing import List, Dict, Optional
from pathlib import Path
from collections import defaultdict

from pyapps.okx_price_monitor.core.monitor_config import monitor_config


class RealtimePriceManager:
    """
    Real-time Price Manager

    Creates and manages individual tables for each coin's real-time prices.
    Each coin gets its own table for WebSocket price updates.

    Features:
    - Millisecond-level price storage
    - Sampling strategy (time-based or price-change-based)
    - Automatic cleanup of old data
    - Statistics tracking
    """

    def __init__(self, database_name: str = "okx_realtime",
                 sampling_interval_ms: int = 100,
                 retention_days: int = 7):
        """
        Initialize real-time price manager

        Args:
            database_name (str): Database name for real-time prices
            sampling_interval_ms (int): Minimum interval between samples (milliseconds)
            retention_days (int): Days to retain data
        """
        self.database_name = database_name
        self.sampling_interval_ms = sampling_interval_ms
        self.retention_days = retention_days
        self.created_tables = set()

        # Last insert time for sampling
        self.last_insert_time: Dict[str, int] = defaultdict(int)

        # Statistics
        self.stats = {
            'total_inserts': 0,
            'sampled_out': 0,
            'total_records': 0
        }

        # Use system data directory from monitor_config
        db_dir = monitor_config.DATABASE_DIR
        db_dir.mkdir(parents=True, exist_ok=True)

        self.db_path = db_dir / f"{database_name}.db"
        self.conn = sqlite3.connect(str(self.db_path), check_same_thread=False)

        print(f"[RealtimePriceManager] Initialized")
        print(f"  Database: {self.db_path}")
        print(f"  Sampling interval: {sampling_interval_ms}ms")
        print(f"  Retention: {retention_days} days")

    def get_table_name(self, coin_symbol: str) -> str:
        """
        Get table name for a coin

        Args:
            coin_symbol (str): Coin symbol (e.g., "BTC")

        Returns:
            str: Table name
        """
        return f"okx_realtime_prices_{coin_symbol.lower()}"

    def create_table_if_not_exists(self, coin_symbol: str) -> bool:
        """
        Create real-time price table for coin if it doesn't exist

        Args:
            coin_symbol (str): Coin symbol

        Returns:
            bool: True if table was created or already exists
        """
        table_name = self.get_table_name(coin_symbol)

        if table_name in self.created_tables:
            return True

        create_sql = f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            price REAL NOT NULL,
            ask_price REAL,
            bid_price REAL,
            last_size REAL,
            source TEXT DEFAULT 'websocket',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(timestamp)
        )
        """

        index_sql = f"CREATE INDEX IF NOT EXISTS idx_{table_name}_timestamp ON {table_name}(timestamp DESC)"

        try:
            cursor = self.conn.cursor()
            cursor.execute(create_sql)
            cursor.execute(index_sql)
            self.conn.commit()

            self.created_tables.add(table_name)
            return True

        except Exception as e:
            print(f"[ERROR] Failed to create table {table_name}: {e}")
            return False

    def should_insert(self, coin_symbol: str, current_timestamp_ms: int) -> bool:
        """
        Check if price should be inserted based on sampling strategy

        Args:
            coin_symbol (str): Coin symbol
            current_timestamp_ms (int): Current timestamp in milliseconds

        Returns:
            bool: True if should insert
        """
        last_time = self.last_insert_time[coin_symbol]

        if last_time == 0:
            # First insert for this coin
            return True

        time_diff = current_timestamp_ms - last_time

        if time_diff >= self.sampling_interval_ms:
            return True
        else:
            self.stats['sampled_out'] += 1
            return False

    def insert_price(self, coin_symbol: str, price_data: Dict) -> bool:
        """
        Insert real-time price data for a coin

        Args:
            coin_symbol (str): Coin symbol
            price_data (Dict): Price data with keys:
                - timestamp: millisecond timestamp
                - price: last price
                - ask_price (optional): ask price
                - bid_price (optional): bid price
                - last_size (optional): last trade size

        Returns:
            bool: True if inserted successfully
        """
        table_name = self.get_table_name(coin_symbol)

        timestamp = price_data.get('timestamp')
        price = price_data.get('price')

        if not timestamp or not price:
            return False

        # Check sampling
        if not self.should_insert(coin_symbol, timestamp):
            return False

        insert_sql = f"""
        INSERT OR IGNORE INTO {table_name}
        (timestamp, price, ask_price, bid_price, last_size, source)
        VALUES (?, ?, ?, ?, ?, ?)
        """

        try:
            cursor = self.conn.cursor()
            cursor.execute(insert_sql, (
                timestamp,
                float(price),
                float(price_data.get('ask_price', 0)) if price_data.get('ask_price') else None,
                float(price_data.get('bid_price', 0)) if price_data.get('bid_price') else None,
                float(price_data.get('last_size', 0)) if price_data.get('last_size') else None,
                price_data.get('source', 'websocket')
            ))

            self.conn.commit()

            # Update last insert time
            self.last_insert_time[coin_symbol] = timestamp

            # Update statistics
            self.stats['total_inserts'] += 1
            self.stats['total_records'] += 1

            return True

        except Exception as e:
            print(f"[ERROR] Failed to insert price for {coin_symbol}: {e}")
            return False

    def insert_prices_batch(self, coin_symbol: str, prices_data: List[Dict]) -> int:
        """
        Insert multiple real-time prices for a coin

        Args:
            coin_symbol (str): Coin symbol
            prices_data (List[Dict]): List of price data dictionaries

        Returns:
            int: Number of records inserted
        """
        if not prices_data:
            return 0

        inserted = 0
        for price_data in prices_data:
            if self.insert_price(coin_symbol, price_data):
                inserted += 1

        return inserted

    def get_record_count(self, coin_symbol: str) -> int:
        """
        Get number of real-time price records for a coin

        Args:
            coin_symbol (str): Coin symbol

        Returns:
            int: Number of records
        """
        table_name = self.get_table_name(coin_symbol)

        query_sql = f"SELECT COUNT(*) FROM {table_name}"

        try:
            cursor = self.conn.cursor()
            cursor.execute(query_sql)
            result = cursor.fetchone()
            return result[0] if result else 0

        except Exception:
            return 0

    def get_latest_price(self, coin_symbol: str) -> Optional[Dict]:
        """
        Get latest real-time price for a coin

        Args:
            coin_symbol (str): Coin symbol

        Returns:
            Optional[Dict]: Latest price data or None
        """
        table_name = self.get_table_name(coin_symbol)

        query_sql = f"""
        SELECT timestamp, price, ask_price, bid_price, last_size
        FROM {table_name}
        ORDER BY timestamp DESC
        LIMIT 1
        """

        try:
            cursor = self.conn.cursor()
            cursor.execute(query_sql)
            result = cursor.fetchone()

            if result:
                return {
                    'timestamp': result[0],
                    'price': result[1],
                    'ask_price': result[2],
                    'bid_price': result[3],
                    'last_size': result[4]
                }
            return None

        except Exception:
            return None

    def get_price_range(self, coin_symbol: str, start_ts: int, end_ts: int) -> List[Dict]:
        """
        Get price data within a time range

        Args:
            coin_symbol (str): Coin symbol
            start_ts (int): Start timestamp (milliseconds)
            end_ts (int): End timestamp (milliseconds)

        Returns:
            List[Dict]: List of price data
        """
        table_name = self.get_table_name(coin_symbol)

        query_sql = f"""
        SELECT timestamp, price, ask_price, bid_price, last_size
        FROM {table_name}
        WHERE timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp ASC
        """

        try:
            cursor = self.conn.cursor()
            cursor.execute(query_sql, (start_ts, end_ts))
            results = cursor.fetchall()

            prices = []
            for row in results:
                prices.append({
                    'timestamp': row[0],
                    'price': row[1],
                    'ask_price': row[2],
                    'bid_price': row[3],
                    'last_size': row[4]
                })

            return prices

        except Exception as e:
            print(f"[ERROR] Failed to get price range for {coin_symbol}: {e}")
            return []

    def cleanup_old_data(self, coin_symbol: Optional[str] = None):
        """
        Clean up old real-time price data

        Args:
            coin_symbol (Optional[str]): Specific coin to clean, or None for all
        """
        cutoff_ts = int((time.time() - (self.retention_days * 24 * 3600)) * 1000)

        if coin_symbol:
            # Clean specific coin
            coins = [coin_symbol]
        else:
            # Clean all coins
            coins = [table.replace('okx_realtime_prices_', '').upper()
                    for table in self.created_tables]

        total_deleted = 0

        for coin in coins:
            table_name = self.get_table_name(coin)

            delete_sql = f"DELETE FROM {table_name} WHERE timestamp < ?"

            try:
                cursor = self.conn.cursor()
                cursor.execute(delete_sql, (cutoff_ts,))
                deleted = cursor.rowcount
                self.conn.commit()

                if deleted > 0:
                    print(f"[Cleanup] {coin}: Deleted {deleted:,} old records")
                    total_deleted += deleted

            except Exception as e:
                print(f"[ERROR] Cleanup failed for {coin}: {e}")

        if total_deleted > 0:
            print(f"[Cleanup] Total deleted: {total_deleted:,} records")
            self.stats['total_records'] -= total_deleted

    def get_stats(self) -> Dict:
        """
        Get statistics

        Returns:
            Dict: Statistics dictionary
        """
        stats = self.stats.copy()
        stats['tables_created'] = len(self.created_tables)
        stats['sampling_interval_ms'] = self.sampling_interval_ms
        stats['retention_days'] = self.retention_days

        # Calculate sampling efficiency
        total_attempts = stats['total_inserts'] + stats['sampled_out']
        if total_attempts > 0:
            stats['sampling_efficiency'] = (stats['sampled_out'] / total_attempts) * 100
        else:
            stats['sampling_efficiency'] = 0

        return stats

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()


# Global instance
_global_realtime_manager = None


def get_realtime_price_manager() -> RealtimePriceManager:
    """
    Get global realtime price manager instance

    Returns:
        RealtimePriceManager: Global singleton
    """
    global _global_realtime_manager

    if _global_realtime_manager is None:
        _global_realtime_manager = RealtimePriceManager()

    return _global_realtime_manager
