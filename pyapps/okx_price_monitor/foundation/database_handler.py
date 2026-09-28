#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Database Handler

Handles all database operations for price data storage and retrieval.
"""

import time
from typing import List, Dict, Optional

from pyapps.okx_price_monitor.core import config
from pyapps.okx_price_monitor.foundation.printer import Printer
from pyapps.okx_price_monitor.lib.models import init_database, CoinPriceTrend


class DatabaseHandler:
    """
    Database Handler
    
    Manages database operations for cryptocurrency price data.
    Uses existing database models for compatibility.
    """
    
    def __init__(self, database_name: str = None):
        """
        Initialize database handler
        
        Args:
            database_name (str): Database name
        """
        self.database_name = database_name or config.DATABASE_NAME
        self.initialized = False
        self.printer = Printer(prefix="[DatabaseHandler]")
    
    def initialize(self) -> bool:
        """
        Initialize database tables
        
        Returns:
            bool: True if successful
        """
        self.printer.info("Initializing database...")
        
        init_database()
        
        self.initialized = True
        self.printer.success("Database initialized successfully")
        return True
    
    def save_ticker_data(self, ticker_data: List[Dict]) -> int:
        """
        Save ticker data to database
        
        Args:
            ticker_data (List[Dict]): List of ticker dictionaries
            
        Returns:
            int: Number of records saved
        """
        if not self.initialized:
            self.printer.warning("Database not initialized, skipping save")
            return 0
        
        records = []
        current_ts = int(time.time() * 1000)
        
        for ticker in ticker_data:
            inst_id = ticker.get('instId', '')
            last_price = ticker.get('last', '0')
            
            if inst_id and last_price:
                records.append({
                    'currency': inst_id,
                    'timestamp': current_ts,
                    'price': float(last_price)
                })
        
        if not records:
            return 0
        
        count = CoinPriceTrend.bulk_insert(records)
        self.printer.success(f"Saved {count} ticker records to database")
        
        return count
    
    def load_recent_history(self, hours: int = None) -> Dict[str, List[tuple]]:
        """
        Load recent price history from database
        
        Args:
            hours (int): Number of hours to look back
            
        Returns:
            Dict[str, List[tuple]]: Dict with currency as key, list of (timestamp, price) as value
        """
        if not self.initialized:
            self.printer.warning("Database not initialized, skipping load")
            return {}
        
        hours = hours or config.HISTORY_HOURS
        
        self.printer.info(f"Loading price history for last {hours} hours...")
        start_time = time.time()
        
        records_by_currency = CoinPriceTrend.get_all_currencies_recent_history(hours=hours)
        
        result = {}
        total_records = 0
        
        for currency, records in records_by_currency.items():
            result[currency] = [(r.timestamp, r.price) for r in records]
            total_records += len(records)
        
        elapsed = time.time() - start_time
        self.printer.success(
            f"Loaded {total_records} records for {len(result)} currencies in {elapsed:.2f}s"
        )
        
        return result
    
    def get_currency_history(self, currency: str, hours: int = None) -> List[tuple]:
        """
        Get price history for a specific currency
        
        Args:
            currency (str): Currency symbol or instrument ID
            hours (int): Number of hours to look back
            
        Returns:
            List[tuple]: List of (timestamp, price) tuples
        """
        if not self.initialized:
            return []
        
        hours = hours or config.HISTORY_HOURS
        
        records = CoinPriceTrend.get_recent_history(currency, hours=hours)
        return [(r.timestamp, r.price) for r in records]
    
    def get_statistics(self) -> Dict:
        """
        Get database statistics
        
        Returns:
            Dict: Statistics dictionary
        """
        if not self.initialized:
            return {}
        
        total_records = CoinPriceTrend.query.count()
        
        distinct_currencies = CoinPriceTrend.query.with_entities(
            CoinPriceTrend.currency
        ).distinct().count()
        
        return {
            'total_records': total_records,
            'distinct_currencies': distinct_currencies,
            'database_name': self.database_name
        }
    
    def print_statistics(self):
        """Print database statistics"""
        stats = self.get_statistics()
        
        if stats:
            self.printer.header("DATABASE STATISTICS")
            self.printer.key_value("Database", stats.get('database_name', 'N/A'))
            self.printer.key_value("Total Records", stats.get('total_records', 0))
            self.printer.key_value("Currencies", stats.get('distinct_currencies', 0))
            self.printer.separator()

