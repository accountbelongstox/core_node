#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Real-time Statistics Display - Console Output
实时统计显示 - 控制台输出

Features:
- Real-time price statistics (5s, 30s, 60s)
- Top gainers/losers
- Alert detection and logging
- High-frequency updates (no database bottleneck)
"""

import os
import sys
import time
from typing import Dict, List, Optional
from datetime import datetime
from collections import deque


class RealtimeStatsDisplay:
    """
    Real-time statistics display for console output

    Tracks price changes across multiple time windows and displays
    formatted statistics with color coding.
    """

    # ANSI Color codes
    COLORS = {
        'reset': '\033[0m',
        'red': '\033[91m',
        'green': '\033[92m',
        'yellow': '\033[93m',
        'blue': '\033[94m',
        'magenta': '\033[95m',
        'cyan': '\033[96m',
        'white': '\033[97m',
        'bold': '\033[1m',
        'dim': '\033[2m',
    }

    # Alert thresholds (percentage)
    ALERT_THRESHOLDS = {
        '5s': 1.0,   # 5秒超过1%
        '30s': 1.0,  # 30秒超过1%
        '1m': 2.0,   # 1分钟超过2%
    }

    def __init__(self):
        """Initialize realtime stats display"""
        # Price history for each coin (timestamp, price)
        self.price_history: Dict[str, deque] = {}

        # Statistics counters
        self.stats = {
            'total_coins': 0,
            'rising_5s': 0,
            'rising_30s': 0,
            'rising_60s': 0,
            'falling_5s': 0,
            'falling_30s': 0,
            'falling_60s': 0,
            'last_update': None,
        }

        # Top movers
        self.top_gainers_30s = []
        self.top_losers_30s = []
        self.top_gainers_60s = []

        # Curve data (last 60 points for 30s and 60s windows)
        self.rising_curve_30s = deque(maxlen=60)
        self.rising_curve_60s = deque(maxlen=60)

        # Last display time
        self.last_display_time = 0
        self.display_interval = 1.0  # Update display every 1 second

        print("[RealtimeStatsDisplay] Initialized")

    def update_price(self, coin_symbol: str, price: float, timestamp: Optional[float] = None):
        """
        Update price for a coin

        Args:
            coin_symbol: Coin symbol (e.g., "BTC")
            price: Current price
            timestamp: Price timestamp (default: current time)
        """
        if timestamp is None:
            timestamp = time.time()

        # Initialize history if needed
        if coin_symbol not in self.price_history:
            self.price_history[coin_symbol] = deque(maxlen=1000)  # Keep last 1000 prices

        # Add price point
        self.price_history[coin_symbol].append((timestamp, price))

    def calculate_stats(self) -> Dict:
        """
        Calculate real-time statistics across all coins

        Returns:
            Dict: Statistics including rising/falling counts, top movers, etc.
        """
        current_time = time.time()

        rising_5s = 0
        rising_30s = 0
        rising_60s = 0
        falling_5s = 0
        falling_30s = 0
        falling_60s = 0

        movers_30s = []
        movers_60s = []

        for coin_symbol, history in self.price_history.items():
            if len(history) < 2:
                continue

            # Get current price
            current_price = history[-1][1]
            current_ts = history[-1][0]

            # Calculate changes for different time windows
            change_5s = self._get_price_change(history, current_ts - 5)
            change_30s = self._get_price_change(history, current_ts - 30)
            change_60s = self._get_price_change(history, current_ts - 60)

            # Count rising/falling coins
            if change_5s and change_5s > 0:
                rising_5s += 1
            elif change_5s and change_5s < 0:
                falling_5s += 1

            if change_30s and change_30s > 0:
                rising_30s += 1
            elif change_30s and change_30s < 0:
                falling_30s += 1

            if change_60s and change_60s > 0:
                rising_60s += 1
            elif change_60s and change_60s < 0:
                falling_60s += 1

            # Track movers
            if change_30s is not None:
                movers_30s.append({
                    'coin': coin_symbol,
                    'change': change_30s,
                    'price': current_price
                })

            if change_60s is not None:
                movers_60s.append({
                    'coin': coin_symbol,
                    'change': change_60s,
                    'price': current_price
                })

        # Sort and get top movers
        movers_30s.sort(key=lambda x: x['change'], reverse=True)
        movers_60s.sort(key=lambda x: x['change'], reverse=True)

        self.top_gainers_30s = movers_30s[:3] if movers_30s else []
        self.top_losers_30s = movers_30s[-3:][::-1] if movers_30s else []
        self.top_gainers_60s = movers_60s[:3] if movers_60s else []

        # Update curve data
        self.rising_curve_30s.append(rising_30s)
        self.rising_curve_60s.append(rising_60s)

        # Update stats
        self.stats = {
            'total_coins': len(self.price_history),
            'rising_5s': rising_5s,
            'rising_30s': rising_30s,
            'rising_60s': rising_60s,
            'falling_5s': falling_5s,
            'falling_30s': falling_30s,
            'falling_60s': falling_60s,
            'last_update': datetime.now(),
        }

        return self.stats

    def _get_price_change(self, history: deque, target_time: float) -> Optional[float]:
        """
        Get price change percentage from target time to now

        Args:
            history: Price history deque
            target_time: Target timestamp

        Returns:
            float: Change percentage, or None if not enough data
        """
        if len(history) < 2:
            return None

        current_price = history[-1][1]

        # Find closest price to target time
        old_price = None
        for ts, price in history:
            if ts >= target_time:
                old_price = price
                break

        if old_price is None or old_price == 0:
            return None

        change_pct = ((current_price - old_price) / old_price) * 100
        return change_pct

    def check_alerts(self) -> List[Dict]:
        """
        Check for alert conditions

        Returns:
            List[Dict]: List of alerts
        """
        alerts = []
        current_time = time.time()

        for coin_symbol, history in self.price_history.items():
            if len(history) < 2:
                continue

            current_ts = history[-1][0]

            # Check 5s alert
            change_5s = self._get_price_change(history, current_ts - 5)
            if change_5s and abs(change_5s) >= self.ALERT_THRESHOLDS['5s']:
                alerts.append({
                    'coin': coin_symbol,
                    'window': '5s',
                    'change': change_5s,
                    'direction': 'up' if change_5s > 0 else 'down',
                    'timestamp': datetime.now()
                })

            # Check 30s alert
            change_30s = self._get_price_change(history, current_ts - 30)
            if change_30s and abs(change_30s) >= self.ALERT_THRESHOLDS['30s']:
                alerts.append({
                    'coin': coin_symbol,
                    'window': '30s',
                    'change': change_30s,
                    'direction': 'up' if change_30s > 0 else 'down',
                    'timestamp': datetime.now()
                })

            # Check 1m alert
            change_1m = self._get_price_change(history, current_ts - 60)
            if change_1m and abs(change_1m) >= self.ALERT_THRESHOLDS['1m']:
                alerts.append({
                    'coin': coin_symbol,
                    'window': '1m',
                    'change': change_1m,
                    'direction': 'up' if change_1m > 0 else 'down',
                    'timestamp': datetime.now()
                })

        return alerts

    def display(self, force: bool = False):
        """
        Display statistics to console

        Args:
            force: Force display even if interval hasn't elapsed
        """
        current_time = time.time()

        # Check if enough time has passed since last display
        if not force and (current_time - self.last_display_time) < self.display_interval:
            return

        self.last_display_time = current_time

        # Calculate latest stats
        stats = self.calculate_stats()

        # Clear console (optional)
        # os.system('cls' if os.name == 'nt' else 'clear')

        # Build display output
        self._print_header()
        self._print_stats(stats)
        self._print_top_movers()
        self._print_curve()
        self._print_footer()

    def _print_header(self):
        """Print display header"""
        print("\n" + "="*80)
        print(f"{self.COLORS['bold']}{self.COLORS['cyan']}实时币价监控 - Real-time Price Monitor{self.COLORS['reset']}")
        print("="*80)

    def _print_stats(self, stats: Dict):
        """Print statistics"""
        total = stats['total_coins']

        # 5秒统计
        rising_5s = stats['rising_5s']
        falling_5s = stats['falling_5s']
        print(f"\n{self.COLORS['bold']}[5秒]{self.COLORS['reset']} "
              f"上涨: {self.COLORS['green']}{rising_5s}{self.COLORS['reset']}个 | "
              f"下跌: {self.COLORS['red']}{falling_5s}{self.COLORS['reset']}个 | "
              f"持平: {total - rising_5s - falling_5s}个")

        # 30秒统计
        rising_30s = stats['rising_30s']
        falling_30s = stats['falling_30s']
        print(f"{self.COLORS['bold']}[30秒]{self.COLORS['reset']} "
              f"上涨: {self.COLORS['green']}{rising_30s}{self.COLORS['reset']}个 | "
              f"下跌: {self.COLORS['red']}{falling_30s}{self.COLORS['reset']}个 | "
              f"持平: {total - rising_30s - falling_30s}个")

        # 60秒统计
        rising_60s = stats['rising_60s']
        falling_60s = stats['falling_60s']
        print(f"{self.COLORS['bold']}[60秒]{self.COLORS['reset']} "
              f"上涨: {self.COLORS['green']}{rising_60s}{self.COLORS['reset']}个 | "
              f"下跌: {self.COLORS['red']}{falling_60s}{self.COLORS['reset']}个 | "
              f"持平: {total - rising_60s - falling_60s}个")

    def _print_top_movers(self):
        """Print top movers"""
        print(f"\n{self.COLORS['bold']}━━━ 涨跌幅榜 (30秒) ━━━{self.COLORS['reset']}")

        # Top gainers
        if self.top_gainers_30s:
            print(f"{self.COLORS['green']}▲ 涨幅最大:{self.COLORS['reset']}")
            for i, mover in enumerate(self.top_gainers_30s, 1):
                print(f"  {i}. {mover['coin']}: {self.COLORS['green']}+{mover['change']:.2f}%{self.COLORS['reset']}")

        # Top losers
        if self.top_losers_30s:
            print(f"{self.COLORS['red']}▼ 跌幅最大:{self.COLORS['reset']}")
            for i, mover in enumerate(self.top_losers_30s, 1):
                print(f"  {i}. {mover['coin']}: {self.COLORS['red']}{mover['change']:.2f}%{self.COLORS['reset']}")

    def _print_curve(self):
        """Print trend curves"""
        if len(self.rising_curve_30s) > 1:
            curve_30s = self._generate_sparkline(list(self.rising_curve_30s)[-20:])
            print(f"\n{self.COLORS['bold']}[30秒曲线]{self.COLORS['reset']} "
                  f"上涨数量: {curve_30s} ({self.stats['rising_30s']}个)")

        if len(self.rising_curve_60s) > 1:
            curve_60s = self._generate_sparkline(list(self.rising_curve_60s)[-20:])
            print(f"{self.COLORS['bold']}[60秒曲线]{self.COLORS['reset']} "
                  f"上涨数量: {curve_60s} ({self.stats['rising_60s']}个)")

    def _print_footer(self):
        """Print footer"""
        update_time = self.stats['last_update']
        if update_time:
            print(f"\n{self.COLORS['dim']}更新时间: {update_time.strftime('%H:%M:%S')}{self.COLORS['reset']}")
        print("="*80 + "\n")

    def _generate_sparkline(self, data: List[int]) -> str:
        """
        Generate ASCII sparkline from data

        Args:
            data: List of numbers

        Returns:
            str: Sparkline string
        """
        if not data:
            return ""

        # Sparkline characters
        chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']

        min_val = min(data)
        max_val = max(data)

        if max_val == min_val:
            return chars[0] * len(data)

        range_val = max_val - min_val

        sparkline = ""
        for val in data:
            normalized = (val - min_val) / range_val
            idx = int(normalized * (len(chars) - 1))
            sparkline += chars[idx]

        return sparkline

    def print_alert(self, alert: Dict):
        """
        Print alert with color coding

        Args:
            alert: Alert dictionary
        """
        coin = alert['coin']
        window = alert['window']
        change = alert['change']
        direction = alert['direction']

        # Choose color based on window and direction
        if window == '5s':
            color = self.COLORS['yellow']
            icon = '⚡'
        elif window == '30s':
            color = self.COLORS['magenta']
            icon = '⚠️'
        else:  # 1m
            color = self.COLORS['red'] if direction == 'up' else self.COLORS['blue']
            icon = '🔥' if direction == 'up' else '❄️'

        symbol = '+' if change > 0 else ''

        print(f"\n{color}{self.COLORS['bold']}"
              f"{icon} 【告警】{coin} {window} {symbol}{change:.2f}%"
              f"{self.COLORS['reset']}")

    def get_stats(self) -> Dict:
        """Get current statistics"""
        return self.stats.copy()


# Global instance
_global_display = None


def get_realtime_stats_display() -> RealtimeStatsDisplay:
    """Get global realtime stats display instance"""
    global _global_display

    if _global_display is None:
        _global_display = RealtimeStatsDisplay()

    return _global_display
