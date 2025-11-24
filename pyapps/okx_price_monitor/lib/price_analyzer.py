#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Price Analyzer

Analyzes price changes and detects significant movements.
"""

from pycore.pyfoundations.color_print import ColorPrint
from pyapps.okx_price_monitor.lib.config import config


class PriceAnalyzer:
    """
    Price Analyzer

    Analyzes price trends and detects significant price changes.
    """

    def __init__(self):
        self.price_history = {}  # {currency: [(timestamp, price), ...]}

    def parse_and_store_trend(self, currency, trend_data):
        """
        Parse trend data and store in memory

        Args:
            currency (str): Currency symbol
            trend_data (list): List of [timestamp, price] pairs

        Returns:
            list: Parsed trend data as dicts
        """
        parsed = []
        for item in trend_data:
            if len(item) >= 2:
                timestamp = int(item[0])
                price = float(item[1])
                parsed.append({
                    'currency': currency,
                    'timestamp': timestamp,
                    'price': price
                })

        # Store in memory
        if currency not in self.price_history:
            self.price_history[currency] = []

        self.price_history[currency].extend(
            [(p['timestamp'], p['price']) for p in parsed]
        )

        # Keep only recent data (last 1000 points)
        if len(self.price_history[currency]) > 1000:
            self.price_history[currency] = self.price_history[currency][-1000:]

        # Sort by timestamp
        self.price_history[currency].sort(key=lambda x: x[0])

        return parsed

    def calculate_price_change(self, currency, time_window_ms):
        """
        Calculate price change over a time window

        Args:
            currency (str): Currency symbol
            time_window_ms (int): Time window in milliseconds

        Returns:
            dict: Price change information or None
        """
        if currency not in self.price_history or len(self.price_history[currency]) < 2:
            return None

        history = self.price_history[currency]
        latest_timestamp, latest_price = history[-1]

        # Find price at time_window_ms ago
        target_timestamp = latest_timestamp - time_window_ms

        # Find closest point before target_timestamp
        old_price = None
        old_timestamp = None
        for timestamp, price in reversed(history[:-1]):
            if timestamp <= target_timestamp:
                old_price = price
                old_timestamp = timestamp
                break

        if old_price is None:
            return None

        # Calculate change
        change_amount = latest_price - old_price
        change_percent = (change_amount / old_price * 100) if old_price != 0 else 0

        return {
            'currency': currency,
            'old_price': old_price,
            'old_timestamp': old_timestamp,
            'new_price': latest_price,
            'new_timestamp': latest_timestamp,
            'change_amount': change_amount,
            'change_percent': change_percent,
            'time_window_ms': time_window_ms
        }

    def detect_significant_changes(self):
        """
        Detect currencies with significant price changes

        Returns:
            dict: Dict with time windows as keys, list of alerts as values
        """
        alerts = {
            '30s': [],
            '1m': []
        }

        for currency in self.price_history.keys():
            # Check 30 second change
            change_30s = self.calculate_price_change(currency, 30 * 1000)
            if change_30s and abs(change_30s['change_percent']) >= config.ALERT_30SEC_THRESHOLD:
                alerts['30s'].append(change_30s)

            # Check 1 minute change
            change_1m = self.calculate_price_change(currency, 60 * 1000)
            if change_1m and abs(change_1m['change_percent']) >= config.ALERT_1MIN_THRESHOLD:
                alerts['1m'].append(change_1m)

        return alerts

    def print_alerts(self, alerts):
        """
        Print price alerts

        Args:
            alerts (dict): Alerts from detect_significant_changes()
        """
        has_alerts = False

        for time_window, changes in alerts.items():
            if changes:
                has_alerts = True
                ColorPrint.red(f"\n{'='*80}")
                ColorPrint.red(f"🚨 PRICE ALERTS - {time_window.upper()} CHANGES")
                ColorPrint.red(f"{'='*80}")

                # Sort by change_percent (absolute value descending)
                sorted_changes = sorted(changes, key=lambda x: abs(x['change_percent']), reverse=True)

                for change in sorted_changes:
                    direction = "📈 UP" if change['change_percent'] > 0 else "📉 DOWN"
                    color_func = ColorPrint.green if change['change_percent'] > 0 else ColorPrint.red

                    color_func(f"\n{direction} {change['currency']}: {change['change_percent']:.2f}%")
                    ColorPrint.yellow(f"  Old: ${change['old_price']:.8f}")
                    ColorPrint.yellow(f"  New: ${change['new_price']:.8f}")
                    ColorPrint.yellow(f"  Change: ${change['change_amount']:.8f}")

        if has_alerts:
            ColorPrint.red(f"{'='*80}\n")

        return has_alerts
