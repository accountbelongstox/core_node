#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Coin Table Manager - Database Table Management

Manages individual tables for each coin's historical data.
Creates tables dynamically and handles data insertion.
All data stored in system data directory (.core_node/data/).
"""

import sqlite3
from typing import List, Dict, Optional
from pathlib import Path

from pyapps.okx_price_monitor.core.monitor_config import monitor_config


class CoinTableManager:
    """
    Coin Table Manager

    Creates and manages individual tables for each coin.
    Each coin gets its own table for historical candle data.
    Database stored in system data directory for proper organization.
    """

    def __init__(self, database_name: str = "okx_history"):
        """
        Initialize coin table manager

        Args:
            database_name (str): Database name for historical data
        """
        self.database_name = database_name
        self.created_tables = set()

        # Use system data directory from monitor_config
        db_dir = monitor_config.DATABASE_DIR
        db_dir.mkdir(parents=True, exist_ok=True)

        self.db_path = db_dir / f"{database_name}.db"
        self.conn = sqlite3.connect(str(self.db_path), check_same_thread=False)

        print(f"[INFO] Database initialized: {self.db_path}")

    def get_table_name(self, coin_symbol: str) -> str:
        """
        Get table name for a coin

        Args:
            coin_symbol (str): Coin symbol (e.g., "BTC")

        Returns:
            str: Table name
        """
        return f"okx_candles_{coin_symbol.lower()}"

    def create_table_if_not_exists(self, coin_symbol: str) -> bool:
        """
        Create table for coin if it doesn't exist

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
            open REAL NOT NULL,
            high REAL NOT NULL,
            low REAL NOT NULL,
            close REAL NOT NULL,
            volume REAL NOT NULL,
            volume_currency REAL,
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

    def insert_candles(self, coin_symbol: str, candles: List[List]) -> int:
        """
        Insert candle data for a coin

        Args:
            coin_symbol (str): Coin symbol
            candles (List[List]): Candle data from OKX API

        Returns:
            int: Number of records inserted
        """
        table_name = self.get_table_name(coin_symbol)

        if not candles:
            return 0

        insert_sql = f"""
        INSERT OR IGNORE INTO {table_name}
        (timestamp, open, high, low, close, volume, volume_currency)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """

        rows = []
        for candle in candles:
            if len(candle) >= 7:
                rows.append((
                    int(candle[0]),
                    float(candle[1]),
                    float(candle[2]),
                    float(candle[3]),
                    float(candle[4]),
                    float(candle[5]),
                    float(candle[6]) if len(candle) > 6 else None
                ))

        if not rows:
            return 0

        try:
            cursor = self.conn.cursor()
            cursor.executemany(insert_sql, rows)
            inserted = cursor.rowcount
            self.conn.commit()
            return inserted

        except Exception as e:
            print(f"[ERROR] Failed to insert candles for {coin_symbol}: {e}")
            return 0

    def get_record_count(self, coin_symbol: str) -> int:
        """
        Get number of records for a coin

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

    def get_latest_timestamp(self, coin_symbol: str) -> Optional[int]:
        """
        Get latest (newest) timestamp for a coin

        Args:
            coin_symbol (str): Coin symbol

        Returns:
            Optional[int]: Latest timestamp or None
        """
        table_name = self.get_table_name(coin_symbol)

        query_sql = f"SELECT MAX(timestamp) FROM {table_name}"

        try:
            cursor = self.conn.cursor()
            cursor.execute(query_sql)
            result = cursor.fetchone()
            return result[0] if result and result[0] else None

        except Exception:
            return None

    def get_oldest_timestamp(self, coin_symbol: str) -> Optional[int]:
        """
        Get oldest (earliest) timestamp for a coin

        Args:
            coin_symbol (str): Coin symbol

        Returns:
            Optional[int]: Oldest timestamp or None
        """
        table_name = self.get_table_name(coin_symbol)

        query_sql = f"SELECT MIN(timestamp) FROM {table_name}"

        try:
            cursor = self.conn.cursor()
            cursor.execute(query_sql)
            result = cursor.fetchone()
            return result[0] if result and result[0] else None

        except Exception:
            return None

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
