#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX Trader - Mode 2

Mode 2: Trading System
Includes trader and trading timing analyzer.
"""

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests

requests = None


class Mode2Trader:
    """
    Mode 2: Trading System

    Implements trading functionality including order placement,
    management, and position tracking.
    """

    def __init__(self, coin_provider, rpc_base_url='http://127.0.0.1:58000'):
        global requests
        if requests is None:
            requests = get_third_package_requests()

        self.coin_provider = coin_provider
        self.rpc_base_url = rpc_base_url
        self.active_orders = {}
        self.positions = {}
        self.trading_enabled = False

    def enable_trading(self):
        """Enable trading (requires API credentials)"""
        self.trading_enabled = True
        ColorPrint.green("[Mode2] Trading enabled")

    def disable_trading(self):
        """Disable trading"""
        self.trading_enabled = False
        ColorPrint.yellow("[Mode2] Trading disabled")

    def place_order(self, currency, side, amount, price=None, order_type='market'):
        """
        Place a trading order

        Args:
            currency (str): Currency symbol
            side (str): 'buy' or 'sell'
            amount (float): Order amount
            price (float): Limit price (optional, for limit orders)
            order_type (str): 'market' or 'limit'

        Returns:
            dict: Order result
        """
        if not self.trading_enabled:
            ColorPrint.red("[Mode2] Trading is disabled. Call enable_trading() first.")
            return {'success': False, 'error': 'Trading disabled'}

        ColorPrint.blue(f"[Mode2] Placing {order_type} {side} order:")
        ColorPrint.blue(f"  Currency: {currency}")
        ColorPrint.blue(f"  Amount: {amount}")
        if price:
            ColorPrint.blue(f"  Price: {price}")

        order = {
            'order_id': f"order_{len(self.active_orders) + 1}",
            'currency': currency,
            'side': side,
            'amount': amount,
            'price': price,
            'type': order_type,
            'status': 'pending',
            'timestamp': None
        }

        self.active_orders[order['order_id']] = order

        ColorPrint.yellow(f"[Mode2] Order placed: {order['order_id']} (SIMULATION)")
        ColorPrint.yellow("[Mode2] Real trading requires API credentials and implementation")

        return {'success': True, 'order_id': order['order_id'], 'order': order}

    def cancel_order(self, order_id):
        """
        Cancel an active order

        Args:
            order_id (str): Order ID to cancel

        Returns:
            dict: Cancellation result
        """
        if order_id not in self.active_orders:
            ColorPrint.red(f"[Mode2] Order not found: {order_id}")
            return {'success': False, 'error': 'Order not found'}

        order = self.active_orders[order_id]
        order['status'] = 'cancelled'

        ColorPrint.yellow(f"[Mode2] Order cancelled: {order_id} (SIMULATION)")

        return {'success': True, 'order_id': order_id}

    def get_positions(self):
        """
        Get current positions

        Returns:
            dict: Current positions
        """
        ColorPrint.blue("[Mode2] Current positions:")
        for currency, position in self.positions.items():
            ColorPrint.blue(f"  {currency}: {position}")

        return self.positions

    def get_active_orders(self):
        """
        Get active orders

        Returns:
            dict: Active orders
        """
        active = {k: v for k, v in self.active_orders.items() if v['status'] == 'pending'}
        ColorPrint.blue(f"[Mode2] Active orders: {len(active)}")
        return active

    def run(self, page_id):
        """
        Run trading system

        Args:
            page_id (str): Page ID from browser manager
        """
        ColorPrint.green("\n=== Mode 2: Trading System ===")
        ColorPrint.blue("[Mode2] Trading system initialized")
        ColorPrint.yellow("[Mode2] Status: SIMULATION MODE")
        ColorPrint.yellow("[Mode2] To enable real trading:")
        ColorPrint.yellow("  1. Configure API credentials")
        ColorPrint.yellow("  2. Implement OKX Trade API integration")
        ColorPrint.yellow("  3. Call trader.enable_trading()")

        self.get_positions()
        self.get_active_orders()


class TradingTimingAnalyzer:
    """
    Trading Timing Analyzer

    Analyzes price trends and generates trading signals.
    """

    def __init__(self):
        self.signals = []
        self.thresholds = {
            'buy_dip': -5.0,
            'sell_peak': 5.0,
            'strong_buy': -10.0,
            'strong_sell': 10.0
        }

    def set_thresholds(self, buy_dip=None, sell_peak=None, strong_buy=None, strong_sell=None):
        """
        Set custom thresholds for signal generation

        Args:
            buy_dip (float): Buy signal threshold (negative %)
            sell_peak (float): Sell signal threshold (positive %)
            strong_buy (float): Strong buy threshold (negative %)
            strong_sell (float): Strong sell threshold (positive %)
        """
        if buy_dip is not None:
            self.thresholds['buy_dip'] = buy_dip
        if sell_peak is not None:
            self.thresholds['sell_peak'] = sell_peak
        if strong_buy is not None:
            self.thresholds['strong_buy'] = strong_buy
        if strong_sell is not None:
            self.thresholds['strong_sell'] = strong_sell

        ColorPrint.blue(f"[Analyzer] Thresholds updated: {self.thresholds}")

    def analyze_trend(self, currency_data):
        """
        Analyze price trend for a single currency

        Args:
            currency_data (dict): Currency data with trend array

        Returns:
            dict: Analysis result with signal
        """
        currency = currency_data.get('currency', 'N/A')
        trend = currency_data.get('trend', [])

        if not trend or len(trend) < 2:
            return {
                'currency': currency,
                'signal': 'HOLD',
                'reason': 'Insufficient data',
                'change': None
            }

        latest_price = float(trend[-1][1])
        oldest_price = float(trend[0][1])
        change_percent = ((latest_price - oldest_price) / oldest_price) * 100

        signal = 'HOLD'
        reason = 'No action needed'

        if change_percent <= self.thresholds['strong_buy']:
            signal = 'STRONG_BUY'
            reason = f'Deep dip detected: {change_percent:.2f}%'
        elif change_percent <= self.thresholds['buy_dip']:
            signal = 'BUY'
            reason = f'Price dip: {change_percent:.2f}%'
        elif change_percent >= self.thresholds['strong_sell']:
            signal = 'STRONG_SELL'
            reason = f'Sharp peak detected: {change_percent:.2f}%'
        elif change_percent >= self.thresholds['sell_peak']:
            signal = 'SELL'
            reason = f'Price peak: {change_percent:.2f}%'

        return {
            'currency': currency,
            'signal': signal,
            'reason': reason,
            'change': change_percent,
            'latest_price': latest_price,
            'oldest_price': oldest_price
        }

    def analyze(self, price_data):
        """
        Analyze trading timing for all currencies

        Args:
            price_data (dict): Price data from Mode 1

        Returns:
            dict: Analysis results with signals
        """
        ColorPrint.green("\n=== Trading Timing Analyzer ===")

        if not price_data or 'data' not in price_data:
            ColorPrint.red("[Analyzer] No price data available")
            return None

        data_list = price_data['data']
        signals = []

        ColorPrint.blue(f"[Analyzer] Analyzing {len(data_list)} currencies...")
        ColorPrint.blue(f"[Analyzer] Thresholds: {self.thresholds}")

        buy_signals = []
        sell_signals = []
        strong_signals = []

        for currency_data in data_list:
            result = self.analyze_trend(currency_data)
            signals.append(result)

            if result['signal'] in ['STRONG_BUY', 'STRONG_SELL']:
                strong_signals.append(result)
            elif result['signal'] == 'BUY':
                buy_signals.append(result)
            elif result['signal'] == 'SELL':
                sell_signals.append(result)

        ColorPrint.green("\n" + "=" * 80)
        ColorPrint.green("TRADING SIGNALS")
        ColorPrint.green("=" * 80)

        if strong_signals:
            ColorPrint.yellow(f"\nSTRONG SIGNALS ({len(strong_signals)}):")
            for sig in strong_signals:
                color = ColorPrint.red if 'SELL' in sig['signal'] else ColorPrint.green
                color(f"  {sig['signal']}: {sig['currency']} - {sig['reason']}")

        if buy_signals:
            ColorPrint.green(f"\nBUY SIGNALS ({len(buy_signals)}):")
            for sig in buy_signals:
                ColorPrint.green(f"  {sig['signal']}: {sig['currency']} - {sig['reason']}")

        if sell_signals:
            ColorPrint.red(f"\nSELL SIGNALS ({len(sell_signals)}):")
            for sig in sell_signals:
                ColorPrint.red(f"  {sig['signal']}: {sig['currency']} - {sig['reason']}")

        hold_count = len([s for s in signals if s['signal'] == 'HOLD'])
        ColorPrint.blue(f"\nHOLD: {hold_count} currencies")

        ColorPrint.green("\n" + "=" * 80)

        self.signals = signals

        return {
            'signals': signals,
            'buy': buy_signals,
            'sell': sell_signals,
            'strong': strong_signals,
            'hold_count': hold_count
        }
