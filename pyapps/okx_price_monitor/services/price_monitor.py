#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Price Monitor Service

Monitors cryptocurrency prices in real-time.
"""

import time
from typing import List, Dict, Optional

from pyapps.okx_price_monitor.core import config, calculate_change_percent, format_price
from pyapps.okx_price_monitor.foundation import CoinProvider, Printer


class PriceMonitor:
    """
    Price Monitor Service
    
    Monitors cryptocurrency prices and tracks changes over time.
    Uses API-based data fetching.
    """
    
    def __init__(
        self,
        coin_provider: CoinProvider,
        database_handler: Optional[object] = None
    ):
        """
        Initialize price monitor

        Args:
            coin_provider (CoinProvider): Coin data provider
            database_handler (object): Database handler (optional, not used)
        """
        self.coin_provider = coin_provider
        self.database_handler = database_handler
        self.printer = Printer(prefix="[PriceMonitor]")
        
        self.trading_pairs = []
        self.price_history = {}
        self.tick_count = 0
    
    def set_trading_pairs(self, pairs: List[str]):
        """
        Set trading pairs to monitor
        
        Args:
            pairs (List[str]): List of trading pairs (e.g., ["BTC-USDT", "ETH-USDT"])
        """
        self.trading_pairs = pairs
        self.printer.info(f"Monitoring {len(pairs)} trading pairs")
    
    def fetch_current_prices(self) -> List[Dict]:
        """
        Fetch current prices for all monitored pairs
        
        Returns:
            List[Dict]: List of ticker data
        """
        tickers = self.coin_provider.fetch_tickers()
        
        if not tickers:
            self.printer.error("Failed to fetch tickers")
            return []
        
        if self.trading_pairs:
            filtered_tickers = [
                t for t in tickers
                if t.get('instId') in self.trading_pairs
            ]
            return filtered_tickers
        
        return tickers
    
    def update_price_history(self, tickers: List[Dict]):
        """
        Update price history with new ticker data
        
        Args:
            tickers (List[Dict]): List of ticker data
        """
        current_time = int(time.time() * 1000)
        
        for ticker in tickers:
            inst_id = ticker.get('instId')
            last_price = ticker.get('last')
            
            if inst_id and last_price:
                price_float = float(last_price)
                
                if inst_id not in self.price_history:
                    self.price_history[inst_id] = []
                
                self.price_history[inst_id].append((current_time, price_float))
                
                if len(self.price_history[inst_id]) > config.MAX_HISTORY_RECORDS:
                    self.price_history[inst_id] = self.price_history[inst_id][-config.MAX_HISTORY_RECORDS:]
    
    def save_to_database(self, tickers: List[Dict]) -> int:
        """
        Save ticker data to database
        
        Args:
            tickers (List[Dict]): List of ticker data
            
        Returns:
            int: Number of records saved
        """
        if not self.database_handler:
            return 0
        
        return self.database_handler.save_ticker_data(tickers)
    
    def load_history_from_database(self, hours: int = None):
        """
        Load price history from database
        
        Args:
            hours (int): Number of hours to look back
        """
        if not self.database_handler:
            return
        
        history = self.database_handler.load_recent_history(hours)
        
        for currency, records in history.items():
            self.price_history[currency] = records
        
        self.printer.success(f"Loaded history for {len(history)} currencies")
    
    def run_tick(self) -> Dict:
        """
        Run one monitoring tick
        
        Returns:
            Dict: Tick results with ticker data and statistics
        """
        self.tick_count += 1
        
        self.printer.info(f"Tick #{self.tick_count} starting...")
        
        tickers = self.fetch_current_prices()
        
        if not tickers:
            return {
                'tick': self.tick_count,
                'success': False,
                'tickers': [],
                'count': 0
            }
        
        self.update_price_history(tickers)
        
        saved_count = self.save_to_database(tickers)
        
        self.printer.success(
            f"Tick #{self.tick_count} complete: {len(tickers)} tickers, "
            f"{saved_count} saved to DB"
        )
        
        return {
            'tick': self.tick_count,
            'success': True,
            'tickers': tickers,
            'count': len(tickers),
            'saved_count': saved_count,
            'timestamp': int(time.time() * 1000)
        }
    
    def print_prices(self, tickers: List[Dict], limit: int = 20):
        """
        Print price data in formatted style
        
        Args:
            tickers (List[Dict]): List of ticker data
            limit (int): Maximum number of items to display
        """
        self.printer.header("CURRENT PRICES")
        
        for i, ticker in enumerate(tickers[:limit]):
            inst_id = ticker.get('instId', 'N/A')
            last = ticker.get('last', 'N/A')
            change_24h = ticker.get('changePercent24h', ticker.get('changeRate24h', 'N/A'))
            vol_24h = ticker.get('vol24h', 'N/A')
            
            self.printer.info(f"\n{inst_id}:")
            self.printer.plain(f"  Price: {format_price(last)}")
            
            change_float = float(change_24h) if isinstance(change_24h, str) else change_24h
            if change_float >= 0:
                self.printer.success(f"  24h Change: +{change_float:.2f}%")
            else:
                self.printer.error(f"  24h Change: {change_float:.2f}%")
            
            if vol_24h != 'N/A':
                self.printer.plain(f"  24h Volume: {vol_24h}")
        
        if len(tickers) > limit:
            self.printer.info(f"\n... and {len(tickers) - limit} more")
        
        self.printer.separator()
    
    def get_price_change(self, inst_id: str, seconds: int) -> Optional[float]:
        """
        Get price change for a specific instrument over time period
        
        Args:
            inst_id (str): Instrument ID
            seconds (int): Time period in seconds
            
        Returns:
            Optional[float]: Price change percentage or None
        """
        if inst_id not in self.price_history:
            return None
        
        history = self.price_history[inst_id]
        if len(history) < 2:
            return None
        
        current_time = int(time.time() * 1000)
        target_time = current_time - (seconds * 1000)
        
        current_price = history[-1][1]
        
        for timestamp, price in reversed(history):
            if timestamp <= target_time:
                return calculate_change_percent(current_price, price)
        
        return None
    
    def detect_significant_changes(self, threshold: float = 2.0) -> List[Dict]:
        """
        Detect significant price changes
        
        Args:
            threshold (float): Change threshold percentage
            
        Returns:
            List[Dict]: List of significant changes
        """
        significant_changes = []
        
        for inst_id in self.price_history:
            change_1min = self.get_price_change(inst_id, 60)
            
            if change_1min and abs(change_1min) >= threshold:
                significant_changes.append({
                    'inst_id': inst_id,
                    'change_1min': change_1min,
                    'timestamp': int(time.time() * 1000)
                })
        
        return significant_changes
    
    def get_statistics(self) -> Dict:
        """
        Get monitoring statistics
        
        Returns:
            Dict: Statistics dictionary
        """
        return {
            'tick_count': self.tick_count,
            'monitored_pairs': len(self.trading_pairs),
            'history_items': len(self.price_history),
            'total_history_points': sum(len(h) for h in self.price_history.values())
        }

