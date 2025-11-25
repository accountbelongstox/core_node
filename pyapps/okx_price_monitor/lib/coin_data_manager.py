#!/usr/bin/env python3
"""
Coin Data Manager - Manages all coin data objects
Provides unified interface for database operations and price tracking
"""

from typing import Dict, List, Optional, Any
from datetime import datetime

from pycore.pyfoundations.color_print import ColorPrint
from pycore.database import database_manager, DATABASE_AVAILABLE
from pycore.database.models import (
    OKXDynamicTableRegistry,
    CoinPriceHistoryModelFactory,
    CoinDataObject,
    TableNamespaces
)


class CoinDataManager:
    """
    Unified manager for all coin data objects

    Features:
    - Initialize database and register coins
    - Load coin data objects with history
    - Save price updates with auto-deduplication
    - Query price changes across all coins
    """

    def __init__(self, database_name: str = "okx", history_hours: int = 3):
        """
        Initialize coin data manager

        Args:
            database_name: Database name for OKX data
            history_hours: Hours of history to load on startup
        """
        self.database_name = database_name
        self.history_hours = history_hours

        # Storage for coin data objects
        self._coins: Dict[str, CoinDataObject] = {}

        # Track initialization
        self._is_initialized = False
        self._database_registered = False

    def initialize(self, coin_symbols: List[str]):
        """
        Initialize database and create tables for coins

        Args:
            coin_symbols: List of coin symbols to track
        """
        if not DATABASE_AVAILABLE:
            ColorPrint.red("[CoinDataManager] Database system not available")
            return False

        ColorPrint.blue(f"[CoinDataManager] Initializing for {len(coin_symbols)} coins...")

        # Register database
        if not self._database_registered:
            database_manager.register_database(self.database_name)
            self._database_registered = True
            ColorPrint.green(f"[CoinDataManager] Database '{self.database_name}' registered")

        # Create models and tables for all coins
        models = []
        for coin_symbol in coin_symbols:
            model = CoinPriceHistoryModelFactory.create_model(coin_symbol)
            models.append(model)

        # Load tables (creates tables if not exist)
        try:
            database_manager.load_tables(
                table_keys=[m.__table_key__ for m in models],
                models=models,
                database_name=self.database_name
            )
            ColorPrint.green(f"[CoinDataManager] Loaded {len(models)} coin tables")
        except Exception as e:
            ColorPrint.red(f"[CoinDataManager] Failed to load tables: {e}")
            return False

        # Create coin data objects
        for coin_symbol in coin_symbols:
            coin_data = CoinDataObject(coin_symbol, self.database_name)
            self._coins[coin_symbol.upper()] = coin_data

        ColorPrint.green(f"[CoinDataManager] Created {len(self._coins)} coin data objects")

        self._is_initialized = True
        return True

    def load_history_for_all(self):
        """
        Load recent history from database for all coins
        """
        if not self._is_initialized:
            ColorPrint.yellow("[CoinDataManager] Not initialized, skipping history load")
            return

        ColorPrint.blue(f"[CoinDataManager] Loading {self.history_hours}h history for {len(self._coins)} coins...")

        total_loaded = 0

        with database_manager.get_connection(self.database_name) as conn:
            for coin_symbol, coin_data in self._coins.items():
                try:
                    count = coin_data.load_recent_history(conn, hours=self.history_hours)
                    total_loaded += count
                except Exception as e:
                    ColorPrint.red(f"[CoinDataManager] Failed to load history for {coin_symbol}: {e}")

        ColorPrint.green(f"[CoinDataManager] Loaded {total_loaded} total records from database")

    def update_price(self, coin_symbol: str, price_data: Dict[str, Any]) -> bool:
        """
        Update price for a coin (with auto-save and deduplication)

        Args:
            coin_symbol: Coin symbol
            price_data: Price data dictionary

        Returns:
            True if data was saved (not duplicate)
            False if data was rejected (duplicate)
        """
        coin_key = coin_symbol.upper()

        if coin_key not in self._coins:
            ColorPrint.yellow(f"[CoinDataManager] Unknown coin: {coin_symbol}")
            return False

        coin_data = self._coins[coin_key]

        try:
            with database_manager.get_connection(self.database_name) as conn:
                return coin_data.add_price_data(conn, price_data, auto_save=True)
        except Exception as e:
            ColorPrint.red(f"[CoinDataManager] Failed to update {coin_symbol}: {e}")
            return False

    def batch_update_prices(self, price_updates: Dict[str, Dict[str, Any]]) -> Dict[str, bool]:
        """
        Batch update prices for multiple coins

        Args:
            price_updates: Dictionary mapping coin_symbol -> price_data

        Returns:
            Dictionary mapping coin_symbol -> success status
        """
        results = {}

        with database_manager.get_connection(self.database_name) as conn:
            for coin_symbol, price_data in price_updates.items():
                coin_key = coin_symbol.upper()

                if coin_key not in self._coins:
                    results[coin_symbol] = False
                    continue

                coin_data = self._coins[coin_key]

                try:
                    success = coin_data.add_price_data(conn, price_data, auto_save=True)
                    results[coin_symbol] = success
                except Exception as e:
                    ColorPrint.red(f"[CoinDataManager] Batch update failed for {coin_symbol}: {e}")
                    results[coin_symbol] = False

        return results

    def get_price_changes(self, coin_symbol: str) -> Dict[str, Optional[float]]:
        """
        Get price changes for a coin

        Args:
            coin_symbol: Coin symbol

        Returns:
            Dictionary with 30s, 1min, and 2min price changes
        """
        coin_key = coin_symbol.upper()

        if coin_key not in self._coins:
            return {'change_30s': None, 'change_1min': None, 'change_2min': None}

        coin_data = self._coins[coin_key]

        return {
            'change_30s': coin_data.get_price_change_30s(),
            'change_1min': coin_data.get_price_change_1min(),
            'change_2min': coin_data.get_price_change_2min()
        }

    def get_all_price_changes(self) -> Dict[str, Dict[str, Optional[float]]]:
        """
        Get price changes for all coins

        Returns:
            Dictionary mapping coin_symbol -> price changes
        """
        results = {}

        for coin_symbol in self._coins.keys():
            results[coin_symbol] = self.get_price_changes(coin_symbol)

        return results

    def get_coin_trends(self, coin_symbol: str) -> Dict[str, Optional[str]]:
        """
        Get price trends for a coin

        Args:
            coin_symbol: Coin symbol

        Returns:
            Dictionary with trends for 30s, 1min, 2min
        """
        coin_key = coin_symbol.upper()

        if coin_key not in self._coins:
            return {'trend_30s': None, 'trend_1min': None, 'trend_2min': None}

        coin_data = self._coins[coin_key]
        return coin_data.get_all_trends()

    def check_trading_alert(
        self,
        coin_symbol: str,
        threshold_30s: float = 1.0,
        threshold_1min: float = 2.0,
        threshold_2min: float = 3.0
    ) -> Optional[Dict[str, Any]]:
        """
        Check if coin price changes exceed alert thresholds

        Args:
            coin_symbol: Coin symbol
            threshold_30s: 30s threshold percentage
            threshold_1min: 1min threshold percentage
            threshold_2min: 2min threshold percentage

        Returns:
            Alert dictionary if threshold exceeded, None otherwise
        """
        coin_key = coin_symbol.upper()

        if coin_key not in self._coins:
            return None

        coin_data = self._coins[coin_key]

        change_30s = coin_data.get_price_change_30s()
        change_1min = coin_data.get_price_change_1min()
        change_2min = coin_data.get_price_change_2min()

        alerts = []

        if change_30s is not None and abs(change_30s) >= threshold_30s:
            alerts.append({
                'period': '30s',
                'change': change_30s,
                'threshold': threshold_30s,
                'direction': 'up' if change_30s > 0 else 'down'
            })

        if change_1min is not None and abs(change_1min) >= threshold_1min:
            alerts.append({
                'period': '1min',
                'change': change_1min,
                'threshold': threshold_1min,
                'direction': 'up' if change_1min > 0 else 'down'
            })

        if change_2min is not None and abs(change_2min) >= threshold_2min:
            alerts.append({
                'period': '2min',
                'change': change_2min,
                'threshold': threshold_2min,
                'direction': 'up' if change_2min > 0 else 'down'
            })

        if alerts:
            return {
                'coin_symbol': coin_symbol,
                'current_price': coin_data.current_price,
                'alerts': alerts,
                'timestamp_ms': coin_data.current_timestamp_ms
            }

        return None

    def check_all_trading_alerts(
        self,
        threshold_30s: float = 1.0,
        threshold_1min: float = 2.0,
        threshold_2min: float = 3.0
    ) -> List[Dict[str, Any]]:
        """
        Check trading alerts for all coins

        Args:
            threshold_30s: 30s threshold percentage
            threshold_1min: 1min threshold percentage
            threshold_2min: 2min threshold percentage

        Returns:
            List of alert dictionaries
        """
        alerts = []

        for coin_symbol in self._coins.keys():
            alert = self.check_trading_alert(
                coin_symbol,
                threshold_30s,
                threshold_1min,
                threshold_2min
            )
            if alert:
                alerts.append(alert)

        return alerts

    def get_coin_summary(self, coin_symbol: str) -> Optional[Dict[str, Any]]:
        """
        Get summary for a specific coin

        Args:
            coin_symbol: Coin symbol

        Returns:
            Summary dictionary or None if not found
        """
        coin_key = coin_symbol.upper()

        if coin_key not in self._coins:
            return None

        coin_data = self._coins[coin_key]
        summary = coin_data.get_history_summary()

        # Add price changes
        summary['change_30s'] = coin_data.get_price_change_30s()
        summary['change_1min'] = coin_data.get_price_change_1min()
        summary['change_2min'] = coin_data.get_price_change_2min()

        # Add trends
        trends = coin_data.get_all_trends()
        summary['trend_30s'] = trends['trend_30s']
        summary['trend_1min'] = trends['trend_1min']
        summary['trend_2min'] = trends['trend_2min']

        return summary

    def get_all_summaries(self) -> List[Dict[str, Any]]:
        """
        Get summaries for all coins

        Returns:
            List of summary dictionaries
        """
        summaries = []

        for coin_symbol in self._coins.keys():
            summary = self.get_coin_summary(coin_symbol)
            if summary:
                summaries.append(summary)

        return summaries

    def print_statistics(self):
        """
        Print manager statistics
        """
        ColorPrint.blue("\n" + "=" * 60)
        ColorPrint.blue("COIN DATA MANAGER STATISTICS")
        ColorPrint.blue("=" * 60)
        ColorPrint.green(f"  Total coins tracked: {len(self._coins)}")
        ColorPrint.green(f"  Database: {self.database_name}")
        ColorPrint.green(f"  History hours: {self.history_hours}")
        ColorPrint.green(f"  Initialized: {self._is_initialized}")

        if self._coins:
            ColorPrint.blue("\n  Sample coin summaries (first 5):")
            for coin_symbol in list(self._coins.keys())[:5]:
                summary = self.get_coin_summary(coin_symbol)
                if summary:
                    ColorPrint.yellow(f"    {coin_symbol}:")
                    ColorPrint.yellow(f"      Current price: {summary.get('current_price')}")
                    ColorPrint.yellow(f"      Records in buffer: {summary.get('records_in_buffer')}")
                    ColorPrint.yellow(f"      Change 30s: {summary.get('change_30s')}%")
                    ColorPrint.yellow(f"      Change 1min: {summary.get('change_1min')}%")

        ColorPrint.blue("=" * 60)

    def is_initialized(self) -> bool:
        """
        Check if manager is initialized

        Returns:
            True if initialized, False otherwise
        """
        return self._is_initialized

    def get_coin_count(self) -> int:
        """
        Get number of tracked coins

        Returns:
            Number of coins
        """
        return len(self._coins)
