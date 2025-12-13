#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Price Manager - Single Table for Historical & Realtime Data
Unified Price Manager - Single Table for Historical and Realtime Data

Features:
- Single table for both historical (1m candles) and realtime (WebSocket) data
- OHLC fields (historical has full OHLC, realtime uses last price for all)
- 1-minute change percentage calculation
- Efficient querying and data retention
"""

import sqlite3
import time
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta


class UnifiedPriceManager:
    """
    Unified Price Database Manager

    Manages a single table containing both historical candlestick data
    and realtime price updates.
    """

    def __init__(self, db_path: Path):
        """
        Initialize unified price manager

        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self.conn: Optional[sqlite3.Connection] = None

        # Statistics
        self.stats = {
            'total_records': 0,
            'historical_records': 0,
            'realtime_records': 0,
            'coins_tracked': 0,
        }

        # Initialize database
        self._init_database()

        print(f"[UnifiedPriceManager] Initialized")
        print(f"[UnifiedPriceManager] Database: {self.db_path}")

    def _init_database(self):
        """Initialize database and create table"""
        self.conn = sqlite3.connect(str(self.db_path), check_same_thread=False, timeout=30.0)
        self.conn.row_factory = sqlite3.Row

        cursor = self.conn.cursor()

        # Create unified price table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS unified_prices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                coin_symbol TEXT NOT NULL,
                timestamp_ms INTEGER NOT NULL,

                -- OHLC data
                open REAL NOT NULL,
                high REAL NOT NULL,
                low REAL NOT NULL,
                close REAL NOT NULL,

                -- Volume
                volume REAL,
                volume_currency REAL,

                -- Data source
                source TEXT NOT NULL,  -- 'historical' or 'realtime'

                -- 1-minute change (calculated)
                change_1m_percent REAL,

                -- Index for fast queries
                UNIQUE(coin_symbol, timestamp_ms, source)
            )
        """)

        # Create indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_coin_timestamp
            ON unified_prices(coin_symbol, timestamp_ms DESC)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_timestamp
            ON unified_prices(timestamp_ms DESC)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_source
            ON unified_prices(source)
        """)

        self.conn.commit()

        print("[UnifiedPriceManager] Table 'unified_prices' created/verified")
        self._update_stats()

    def insert_historical_candle(self, coin_symbol: str, candle_data: Dict) -> bool:
        """
        Insert historical candlestick data

        Args:
            coin_symbol: Coin symbol (e.g., "BTC")
            candle_data: Candle data from OKX API
                Format: [timestamp, open, high, low, close, volume, volume_currency]

        Returns:
            bool: True if inserted successfully
        """
        try:
            # Parse candle data (OKX format)
            timestamp_ms = int(candle_data[0])
            open_price = float(candle_data[1])
            high_price = float(candle_data[2])
            low_price = float(candle_data[3])  # L is the actual price
            close_price = float(candle_data[4])
            volume = float(candle_data[5]) if candle_data[5] else 0
            volume_currency = float(candle_data[6]) if candle_data[6] else 0

            # Calculate 1-minute change (will be updated later)
            change_1m = None

            cursor = self.conn.cursor()

            cursor.execute("""
                INSERT OR REPLACE INTO unified_prices
                (coin_symbol, timestamp_ms, open, high, low, close,
                 volume, volume_currency, source, change_1m_percent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                coin_symbol, timestamp_ms, open_price, high_price, low_price, close_price,
                volume, volume_currency, 'historical', change_1m
            ))

            self.conn.commit()
            self.stats['historical_records'] += 1

            return True

        except Exception as e:
            print(f"[UnifiedPriceManager] Error inserting historical candle: {e}")
            return False

    def insert_realtime_price(self, coin_symbol: str, price: float, timestamp_ms: int,
                             volume: Optional[float] = None) -> bool:
        """
        Insert realtime price data (from WebSocket)

        Args:
            coin_symbol: Coin symbol
            price: Current price (used for O/H/L/C)
            timestamp_ms: Price timestamp in milliseconds
            volume: Optional volume

        Returns:
            bool: True if inserted successfully
        """
        try:
            # For realtime data, O=H=L=C=price
            ohlc = price

            cursor = self.conn.cursor()

            cursor.execute("""
                INSERT OR REPLACE INTO unified_prices
                (coin_symbol, timestamp_ms, open, high, low, close,
                 volume, volume_currency, source, change_1m_percent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                coin_symbol, timestamp_ms, ohlc, ohlc, ohlc, ohlc,
                volume, None, 'realtime', None
            ))

            self.conn.commit()
            self.stats['realtime_records'] += 1

            return True

        except Exception as e:
            print(f"[UnifiedPriceManager] Error inserting realtime price: {e}")
            return False

    def calculate_1m_changes(self, coin_symbol: str, limit: int = 1000):
        """
        Calculate 1-minute change percentage for recent records

        Args:
            coin_symbol: Coin symbol
            limit: Number of recent records to process
        """
        cursor = self.conn.cursor()

        # Get recent records ordered by time
        cursor.execute("""
            SELECT id, timestamp_ms, low
            FROM unified_prices
            WHERE coin_symbol = ?
            ORDER BY timestamp_ms DESC
            LIMIT ?
        """, (coin_symbol, limit))

        records = cursor.fetchall()

        if len(records) < 2:
            return

        # Calculate changes (iterate backwards in time)
        updates = []
        for i in range(len(records) - 1):
            current_record = records[i]
            current_id = current_record[0]
            current_time = current_record[1]
            current_price = current_record[2]  # Use LOW price

            # Find price 1 minute ago (60000 ms)
            target_time = current_time - 60000

            # Find closest record to 1 minute ago
            prev_price = None
            for j in range(i + 1, len(records)):
                prev_record = records[j]
                prev_time = prev_record[1]

                if prev_time <= target_time:
                    prev_price = prev_record[2]  # Use LOW price
                    break

            if prev_price and prev_price > 0:
                change_pct = ((current_price - prev_price) / prev_price) * 100
                updates.append((change_pct, current_id))

        # Batch update
        if updates:
            cursor.executemany("""
                UPDATE unified_prices
                SET change_1m_percent = ?
                WHERE id = ?
            """, updates)

            self.conn.commit()

    def get_price_history(self, coin_symbol: str, start_time_ms: Optional[int] = None,
                         end_time_ms: Optional[int] = None, limit: int = 1000) -> List[Dict]:
        """
        Get price history for a coin

        Args:
            coin_symbol: Coin symbol
            start_time_ms: Start timestamp (optional)
            end_time_ms: End timestamp (optional)
            limit: Maximum number of records

        Returns:
            List[Dict]: Price records
        """
        cursor = self.conn.cursor()

        query = """
            SELECT coin_symbol, timestamp_ms, open, high, low, close,
                   volume, volume_currency, source, change_1m_percent
            FROM unified_prices
            WHERE coin_symbol = ?
        """
        params = [coin_symbol]

        if start_time_ms:
            query += " AND timestamp_ms >= ?"
            params.append(start_time_ms)

        if end_time_ms:
            query += " AND timestamp_ms <= ?"
            params.append(end_time_ms)

        query += " ORDER BY timestamp_ms DESC LIMIT ?"
        params.append(limit)

        cursor.execute(query, params)

        records = []
        for row in cursor.fetchall():
            records.append({
                'coin_symbol': row[0],
                'timestamp_ms': row[1],
                'open': row[2],
                'high': row[3],
                'low': row[4],
                'close': row[5],
                'volume': row[6],
                'volume_currency': row[7],
                'source': row[8],
                'change_1m_percent': row[9],
            })

        return records

    def get_latest_price(self, coin_symbol: str) -> Optional[Dict]:
        """
        Get latest price for a coin

        Args:
            coin_symbol: Coin symbol

        Returns:
            Optional[Dict]: Latest price record or None
        """
        records = self.get_price_history(coin_symbol, limit=1)
        return records[0] if records else None

    def get_oldest_timestamp(self, coin_symbol: str) -> Optional[int]:
        """
        Get oldest timestamp for a coin

        Args:
            coin_symbol: Coin symbol

        Returns:
            Optional[int]: Oldest timestamp in milliseconds or None
        """
        cursor = self.conn.cursor()

        cursor.execute("""
            SELECT MIN(timestamp_ms)
            FROM unified_prices
            WHERE coin_symbol = ?
        """, (coin_symbol,))

        result = cursor.fetchone()
        return result[0] if result[0] else None

    def get_latest_timestamp(self, coin_symbol: str) -> Optional[int]:
        """
        Get latest (newest) timestamp for a coin

        Args:
            coin_symbol: Coin symbol

        Returns:
            Optional[int]: Latest timestamp in milliseconds or None
        """
        cursor = self.conn.cursor()

        cursor.execute("""
            SELECT MAX(timestamp_ms)
            FROM unified_prices
            WHERE coin_symbol = ?
        """, (coin_symbol,))

        result = cursor.fetchone()
        return result[0] if result[0] else None

    def get_time_range(self, coin_symbol: str) -> Optional[Tuple[int, int]]:
        """
        Get time range (oldest, newest) for a coin

        Args:
            coin_symbol: Coin symbol

        Returns:
            Optional[Tuple[int, int]]: (oldest_ms, newest_ms) or None
        """
        cursor = self.conn.cursor()

        cursor.execute("""
            SELECT MIN(timestamp_ms), MAX(timestamp_ms)
            FROM unified_prices
            WHERE coin_symbol = ?
        """, (coin_symbol,))

        result = cursor.fetchone()
        if result and result[0] and result[1]:
            return (result[0], result[1])
        return None

    def count_records(self, coin_symbol: str, start_time_ms: int, end_time_ms: int) -> int:
        """
        Count records for a coin within a time range

        Args:
            coin_symbol: Coin symbol
            start_time_ms: Start timestamp
            end_time_ms: End timestamp

        Returns:
            int: Record count
        """
        cursor = self.conn.cursor()

        cursor.execute("""
            SELECT COUNT(*)
            FROM unified_prices
            WHERE coin_symbol = ? AND timestamp_ms BETWEEN ? AND ?
        """, (coin_symbol, start_time_ms, end_time_ms))

        result = cursor.fetchone()
        return result[0] if result else 0

    def check_duplicates(self, coin_symbol: str) -> int:
        """
        Check for duplicate timestamps for a coin

        Args:
            coin_symbol: Coin symbol

        Returns:
            int: Number of duplicate timestamp entries
        """
        cursor = self.conn.cursor()

        cursor.execute("""
            SELECT COUNT(*) - COUNT(DISTINCT timestamp_ms)
            FROM unified_prices
            WHERE coin_symbol = ?
        """, (coin_symbol,))

        result = cursor.fetchone()
        return result[0] if result else 0

    def deduplicate_coin_data(self, coin_symbol: str) -> int:
        """
        Remove duplicate timestamps for a coin (keep newest record)

        Args:
            coin_symbol: Coin symbol

        Returns:
            int: Number of duplicates removed
        """
        cursor = self.conn.cursor()

        # Get all unique data sorted by timestamp
        cursor.execute("""
            SELECT coin_symbol, timestamp_ms, open, high, low, close,
                   volume, volume_currency, source, change_1m_percent
            FROM unified_prices
            WHERE coin_symbol = ?
            ORDER BY timestamp_ms ASC, id DESC
        """, (coin_symbol,))

        all_records = cursor.fetchall()

        if not all_records:
            return 0

        # Remove duplicates (keep first occurrence by timestamp)
        seen_timestamps = set()
        unique_records = []
        duplicates_count = 0

        for record in all_records:
            timestamp_ms = record[1]
            if timestamp_ms not in seen_timestamps:
                seen_timestamps.add(timestamp_ms)
                unique_records.append(record)
            else:
                duplicates_count += 1

        if duplicates_count > 0:
            # Rewrite coin data
            print(f"[UnifiedPriceManager] Removing {duplicates_count} duplicates for {coin_symbol}")

            # Delete all records for this coin
            cursor.execute("""
                DELETE FROM unified_prices WHERE coin_symbol = ?
            """, (coin_symbol,))

            # Re-insert unique records
            cursor.executemany("""
                INSERT INTO unified_prices
                (coin_symbol, timestamp_ms, open, high, low, close,
                 volume, volume_currency, source, change_1m_percent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, unique_records)

            self.conn.commit()
            print(f"[UnifiedPriceManager] Rewritten {len(unique_records)} unique records for {coin_symbol}")

        return duplicates_count

    def get_coin_count(self) -> int:
        """Get number of unique coins"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(DISTINCT coin_symbol) FROM unified_prices")
        return cursor.fetchone()[0]

    def cleanup_old_data(self, retention_days: int = 7):
        """
        Remove data older than retention period

        Args:
            retention_days: Number of days to keep
        """
        cutoff_time_ms = int((time.time() - retention_days * 86400) * 1000)

        cursor = self.conn.cursor()

        cursor.execute("""
            DELETE FROM unified_prices
            WHERE timestamp_ms < ? AND source = 'realtime'
        """, (cutoff_time_ms,))

        deleted = cursor.rowcount
        self.conn.commit()

        print(f"[UnifiedPriceManager] Cleaned up {deleted} old realtime records")

    def _update_stats(self):
        """Update statistics (optimized: single query)"""
        import sys
        print("[UnifiedPriceManager] Updating statistics...")
        sys.stdout.flush()

        cursor = self.conn.cursor()

        # Optimized: Get all stats in one query to avoid multiple round-trips
        # Use COALESCE to handle NULL from SUM on empty table
        cursor.execute("""
            SELECT
                COUNT(*) as total,
                COALESCE(SUM(CASE WHEN source = 'historical' THEN 1 ELSE 0 END), 0) as historical,
                COALESCE(SUM(CASE WHEN source = 'realtime' THEN 1 ELSE 0 END), 0) as realtime,
                COUNT(DISTINCT coin_symbol) as coins
            FROM unified_prices
        """)

        result = cursor.fetchone()
        if result:
            self.stats['total_records'] = result[0]
            self.stats['historical_records'] = result[1]
            self.stats['realtime_records'] = result[2]
            self.stats['coins_tracked'] = result[3]

        print("[UnifiedPriceManager] Statistics updated")
        sys.stdout.flush()

    def get_stats(self) -> Dict:
        """Get database statistics"""
        self._update_stats()
        return self.stats.copy()

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            print("[UnifiedPriceManager] Database closed")


# Global instance
_global_manager = None


def get_unified_price_manager(db_path: Optional[Path] = None) -> UnifiedPriceManager:
    """
    Get global unified price manager instance

    Args:
        db_path: Database path (required on first call)

    Returns:
        UnifiedPriceManager: Global instance
    """
    global _global_manager

    if _global_manager is None:
        if db_path is None:
            from pyapps.okx_price_monitor.core.monitor_config import monitor_config
            db_path = monitor_config.DATABASE_DIR / "okx_unified_prices.db"

        _global_manager = UnifiedPriceManager(db_path)

    return _global_manager
