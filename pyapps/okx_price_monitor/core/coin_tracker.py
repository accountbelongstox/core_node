#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Coin Tracker - Individual Coin Price Tracking

Tracks price history and calculates metrics for each coin.
"""

import time
from typing import List, Dict, Optional
from collections import deque


class CoinTracker:
    """
    Coin Price Tracker

    Tracks recent price history and calculates:
    - Price changes over different time windows
    - Trend direction (up/down)
    - Trading opportunity alerts
    """

    def __init__(self, coin_symbol: str, inst_id: str, history_window_hours: int = 3):
        """
        Initialize coin tracker

        Args:
            coin_symbol (str): Coin symbol (e.g., "BTC")
            inst_id (str): Instrument ID (e.g., "BTC-USDT")
            history_window_hours (int): Hours of history to keep
        """
        self.coin_symbol = coin_symbol
        self.inst_id = inst_id
        self.history_window_hours = history_window_hours

        self.price_history: deque = deque(maxlen=1000)
        self.candles_3h: List[Dict] = []

        self.current_price: Optional[float] = None
        self.last_update_time: Optional[float] = None

    def add_candle(self, candle: List):
        """
        Add historical candle data

        Args:
            candle (List): [timestamp, open, high, low, close, volume, ...]
        """
        if len(candle) < 5:
            return

        candle_data = {
            'timestamp': int(candle[0]),
            'open': float(candle[1]),
            'high': float(candle[2]),
            'low': float(candle[3]),
            'close': float(candle[4]),
            'volume': float(candle[5]) if len(candle) > 5 else 0.0
        }

        self.candles_3h.append(candle_data)

        cutoff_time = int(time.time() * 1000) - (self.history_window_hours * 3600 * 1000)
        self.candles_3h = [
            c for c in self.candles_3h
            if c['timestamp'] >= cutoff_time
        ]

        self.candles_3h.sort(key=lambda x: x['timestamp'])

    def add_price_update(self, price: float, timestamp: Optional[float] = None):
        """
        Add real-time price update

        Args:
            price (float): Current price
            timestamp (float): Timestamp (default: current time)
        """
        if timestamp is None:
            timestamp = time.time()

        self.price_history.append({
            'price': price,
            'timestamp': timestamp
        })

        self.current_price = price
        self.last_update_time = timestamp

    def get_price_change(self, seconds_ago: int) -> Optional[Dict]:
        """
        Get price change compared to N seconds ago

        Args:
            seconds_ago (int): Seconds to look back

        Returns:
            Optional[Dict]: Change data or None
        """
        if not self.price_history or not self.current_price:
            return None

        target_time = time.time() - seconds_ago

        for i in range(len(self.price_history) - 1, -1, -1):
            if self.price_history[i]['timestamp'] <= target_time:
                old_price = self.price_history[i]['price']

                if old_price > 0:
                    change_abs = self.current_price - old_price
                    change_pct = (change_abs / old_price) * 100

                    return {
                        'old_price': old_price,
                        'new_price': self.current_price,
                        'change_abs': change_abs,
                        'change_pct': change_pct,
                        'seconds': seconds_ago
                    }
                break

        return None

    def get_trend(self, seconds_window: int, threshold: float = 0.1) -> str:
        """
        Get price trend direction

        Args:
            seconds_window (int): Time window in seconds
            threshold (float): Minimum % change to detect trend

        Returns:
            str: 'up', 'down', or 'flat'
        """
        change = self.get_price_change(seconds_window)

        if not change:
            return 'flat'

        change_pct = change['change_pct']

        if change_pct > threshold:
            return 'up'
        elif change_pct < -threshold:
            return 'down'
        else:
            return 'flat'

    def check_alert_conditions(self, thresholds: Dict) -> List[Dict]:
        """
        Check for trading alert conditions

        Args:
            thresholds (Dict): {'30s': 1.0, '1m': 2.0, '2m': 3.0}

        Returns:
            List[Dict]: List of triggered alerts
        """
        alerts = []

        time_windows = {
            '30s': 30,
            '1m': 60,
            '2m': 120
        }

        for window_name, seconds in time_windows.items():
            if window_name not in thresholds:
                continue

            threshold = thresholds[window_name]
            change = self.get_price_change(seconds)

            if not change:
                continue

            change_pct = abs(change['change_pct'])

            if change_pct >= threshold:
                alerts.append({
                    'window': window_name,
                    'threshold': threshold,
                    'actual': change['change_pct'],
                    'direction': 'up' if change['change_pct'] > 0 else 'down',
                    'price': self.current_price,
                    'old_price': change['old_price']
                })

        return alerts

    def get_summary(self) -> Dict:
        """
        Get tracker summary data

        Returns:
            Dict: Summary with all metrics
        """
        changes = {}
        trends = {}

        for window_name, seconds in [('30s', 30), ('1m', 60), ('2m', 120)]:
            change = self.get_price_change(seconds)
            trend = self.get_trend(seconds)

            if change:
                changes[window_name] = {
                    'change_pct': round(change['change_pct'], 3),
                    'change_abs': round(change['change_abs'], 6),
                    'old_price': change['old_price']
                }
            else:
                changes[window_name] = None

            trends[window_name] = trend

        return {
            'coin_symbol': self.coin_symbol,
            'inst_id': self.inst_id,
            'current_price': self.current_price,
            'last_update': self.last_update_time,
            'changes': changes,
            'trends': trends,
            'candles_count': len(self.candles_3h),
            'price_history_count': len(self.price_history)
        }
