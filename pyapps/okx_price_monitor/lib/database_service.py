#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Database Service

Handles database operations for price data storage and retrieval.
"""

import time
from pycore.pyfoundations.color_print import ColorPrint
from pyapps.okx_price_monitor.lib.models import CoinPriceTrend, init_database
from pyapps.okx_price_monitor.lib.config import config


class DatabaseService:
    """
    Database Service

    Manages database operations for cryptocurrency price data.
    """

    def __init__(self):
        self.initialized = False

    def initialize(self):
        """Initialize database tables"""
        try:
            ColorPrint.blue("[DatabaseService] Initializing database...")
            init_database()
            self.initialized = True
            ColorPrint.green("[DatabaseService] Database initialized successfully")
            return True
        except Exception as e:
            ColorPrint.red(f"[DatabaseService] Failed to initialize database: {e}")
            import traceback
            ColorPrint.red(traceback.format_exc())
            return False

    def save_price_data(self, price_data_list):
        """
        Save price data to database

        Args:
            price_data_list (list): List of dicts with keys: currency, trend

        Returns:
            int: Number of records saved
        """
        if not self.initialized:
            ColorPrint.yellow("[DatabaseService] Database not initialized, skipping save")
            return 0

        try:
            # Flatten trend data
            records = []
            for item in price_data_list:
                currency = item.get('currency')
                trend = item.get('trend', [])

                for point in trend:
                    if len(point) >= 2:
                        timestamp = int(point[0])
                        price = float(point[1])

                        records.append({
                            'currency': currency,
                            'timestamp': timestamp,
                            'price': price
                        })

            if not records:
                return 0

            # Bulk insert
            count = CoinPriceTrend.bulk_insert(records)
            ColorPrint.green(f"[DatabaseService] Saved {count} price records to database")

            return count

        except Exception as e:
            ColorPrint.red(f"[DatabaseService] Failed to save price data: {e}")
            import traceback
            ColorPrint.red(traceback.format_exc())
            return 0

    def load_recent_history(self, hours=3):
        """
        Load recent price history from database

        Args:
            hours (int): Number of hours to look back

        Returns:
            dict: Dict with currency as key, list of (timestamp, price) tuples as value
        """
        if not self.initialized:
            ColorPrint.yellow("[DatabaseService] Database not initialized, skipping load")
            return {}

        try:
            ColorPrint.blue(f"[DatabaseService] Loading price history for last {hours} hours...")
            start_time = time.time()

            records_by_currency = CoinPriceTrend.get_all_currencies_recent_history(hours=hours)

            # Convert to (timestamp, price) tuples
            result = {}
            total_records = 0

            for currency, records in records_by_currency.items():
                result[currency] = [(r.timestamp, r.price) for r in records]
                total_records += len(records)

            elapsed = time.time() - start_time
            ColorPrint.green(f"[DatabaseService] Loaded {total_records} records for {len(result)} currencies in {elapsed:.2f}s")

            return result

        except Exception as e:
            ColorPrint.red(f"[DatabaseService] Failed to load price history: {e}")
            import traceback
            ColorPrint.red(traceback.format_exc())
            return {}

    def get_currency_history(self, currency, hours=3):
        """
        Get price history for a specific currency

        Args:
            currency (str): Currency symbol
            hours (int): Number of hours to look back

        Returns:
            list: List of (timestamp, price) tuples
        """
        if not self.initialized:
            return []

        try:
            records = CoinPriceTrend.get_recent_history(currency, hours=hours)
            return [(r.timestamp, r.price) for r in records]
        except Exception as e:
            ColorPrint.red(f"[DatabaseService] Failed to get history for {currency}: {e}")
            return []
