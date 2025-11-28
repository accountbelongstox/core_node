#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Trading Worker - Strategy Execution and Order Management
"""

import time
import threading
from typing import List, Dict, Optional
from collections import deque
from pyapps.okx_price_monitor.core.strategy_config import strategy_config
from pyapps.okx_price_monitor.foundation.redis_manager import get_redis_manager
from pyapps.okx_price_monitor.services.coin_attribute_calculator import get_coin_attribute_calculator
from pyapps.okx_price_monitor.services.backtest_engine import get_backtest_engine


class TradingWorker:
    """
    Trading worker thread

    Implements the trading strategy:
    1. Filter coins (24h stable/upward trend)
    2. Detect buy signals (60s rise > 1%)
    3. Open positions
    4. Close positions after 5 minutes
    """

    def __init__(self, coin_symbols: List[str]):
        """
        Initialize trading worker

        Args:
            coin_symbols: List of coins to monitor
        """
        self.coin_symbols = coin_symbols
        self.redis_manager = get_redis_manager()
        self.calculator = get_coin_attribute_calculator()
        self.backtest_engine = get_backtest_engine()

        self.running = False
        self.thread: Optional[threading.Thread] = None

        # Track price history for 60s change detection
        self.price_trackers: Dict[str, deque] = {}

        # Statistics
        self.stats = {
            'signals_detected': 0,
            'positions_opened': 0,
            'positions_closed': 0,
            'filtered_coins_count': 0,
            'last_update_time': None,
        }

        print(f"[TradingWorker] Initialized for {len(coin_symbols)} coins")

    def start(self):
        """Start trading worker thread"""
        if self.running:
            print("[TradingWorker] Already running")
            return

        self.running = True
        self.thread = threading.Thread(target=self._trading_loop, daemon=True)
        self.thread.start()

        print("[TradingWorker] Started")

    def stop(self):
        """Stop trading worker"""
        if not self.running:
            return

        print("[TradingWorker] Stopping...")
        self.running = False

        if self.thread:
            self.thread.join(timeout=10)

        # Close all open positions
        self._close_all_positions()

        # Save trade log
        self.backtest_engine.save_trade_log()

        # Print performance summary
        summary = self.backtest_engine.get_performance_summary()
        print("\n" + "="*80)
        print("BACKTEST PERFORMANCE SUMMARY")
        print("="*80)
        print(f"Initial Balance:     {summary['initial_balance']:.2f} USDT")
        print(f"Final Balance:       {summary['current_balance']:.2f} USDT")
        print(f"Total Return:        {summary['total_return']:+.2f} USDT ({summary['total_return_percent']:+.2f}%)")
        print(f"Total Trades:        {summary['total_trades']}")
        print(f"Winning Trades:      {summary['winning_trades']}")
        print(f"Losing Trades:       {summary['losing_trades']}")
        print(f"Win Rate:            {summary['win_rate']:.2f}%")
        print(f"Max Drawdown:        {summary['max_drawdown']:.2f}%")
        print("="*80 + "\n")

        print("[TradingWorker] Stopped")

    def _trading_loop(self):
        """Main trading loop (runs in thread)"""
        print("[TradingWorker] Trading loop started")

        check_interval = strategy_config.TRADING_THREAD_SLEEP

        while self.running:
            # Step 1: Filter coins based on 24h attributes
            filtered_coins = self._filter_coins()
            self.stats['filtered_coins_count'] = len(filtered_coins)

            # Step 2: Check buy signals
            for coin_symbol in filtered_coins:
                self._check_buy_signal(coin_symbol)

            # Step 3: Check exit conditions for open positions
            self._check_exit_positions()

            # Update statistics
            self.stats['last_update_time'] = time.time()

            # Sleep
            time.sleep(check_interval)

    def _filter_coins(self) -> List[str]:
        """
        Filter coins based on 24h attributes

        Returns:
            List[str]: Filtered coin symbols
        """
        # Get filtered coins from calculator
        filtered = self.calculator.get_filtered_coins(
            allowed_trends=strategy_config.ALLOWED_TRENDS,
            min_volatility=strategy_config.MIN_VOLATILITY_PERCENT,
            max_volatility=strategy_config.MAX_VOLATILITY_PERCENT
        )

        return filtered

    def _check_buy_signal(self, coin_symbol: str):
        """
        Check for buy signal (60s rise > 1%)

        Args:
            coin_symbol: Coin symbol
        """
        # Get current price from Redis
        current_price_data = self.redis_manager.get_price(coin_symbol)

        if not current_price_data:
            return

        current_price = current_price_data.get('low')
        current_time_ms = current_price_data.get('timestamp_ms')

        if not current_price or not current_time_ms:
            return

        # Initialize tracker if needed
        if coin_symbol not in self.price_trackers:
            self.price_trackers[coin_symbol] = deque(maxlen=100)

        # Add current price
        self.price_trackers[coin_symbol].append((current_time_ms, current_price))

        # Calculate 60s change
        target_time_ms = current_time_ms - (strategy_config.BUY_SIGNAL_WINDOW_SECONDS * 1000)

        # Find price 60s ago
        old_price = None
        for timestamp_ms, price in self.price_trackers[coin_symbol]:
            if timestamp_ms >= target_time_ms:
                old_price = price
                break

        if not old_price:
            return

        # Calculate change percentage
        change_percent = ((current_price - old_price) / old_price) * 100

        # Check buy signal
        if change_percent >= strategy_config.BUY_SIGNAL_THRESHOLD_PERCENT:
            # Buy signal detected!
            self.stats['signals_detected'] += 1

            # Try to open position
            position = self.backtest_engine.open_position(
                coin_symbol=coin_symbol,
                price=current_price,
                timestamp_ms=current_time_ms
            )

            if position:
                self.stats['positions_opened'] += 1
                print(f"[TradingWorker] 🚀 BUY SIGNAL: {coin_symbol} "
                      f"(60s change: {change_percent:+.2f}%)")

    def _check_exit_positions(self):
        """Check exit conditions for all open positions"""
        # Get all active positions
        active_positions = list(self.backtest_engine.positions.keys())

        for coin_symbol in active_positions:
            # Get current price
            current_price_data = self.redis_manager.get_price(coin_symbol)

            if not current_price_data:
                continue

            current_price = current_price_data.get('low')
            current_time_ms = current_price_data.get('timestamp_ms')

            if not current_price or not current_time_ms:
                continue

            # Check exit conditions
            should_exit = self.backtest_engine.check_exit_conditions(
                coin_symbol=coin_symbol,
                current_price=current_price,
                current_time_ms=current_time_ms
            )

            if should_exit:
                # Close position
                position = self.backtest_engine.close_position(
                    coin_symbol=coin_symbol,
                    price=current_price,
                    timestamp_ms=current_time_ms
                )

                if position:
                    self.stats['positions_closed'] += 1

    def _close_all_positions(self):
        """Close all open positions (at market)"""
        print("[TradingWorker] Closing all open positions...")

        active_positions = list(self.backtest_engine.positions.keys())

        for coin_symbol in active_positions:
            # Get current price
            current_price_data = self.redis_manager.get_price(coin_symbol)

            if not current_price_data:
                continue

            current_price = current_price_data.get('low')
            current_time_ms = current_price_data.get('timestamp_ms', int(time.time() * 1000))

            if not current_price:
                continue

            # Close position
            self.backtest_engine.close_position(
                coin_symbol=coin_symbol,
                price=current_price,
                timestamp_ms=current_time_ms
            )

    def get_stats(self) -> dict:
        """Get trading statistics"""
        return self.stats.copy()


# Global instance
_global_trading_worker = None


def create_trading_worker(coin_symbols: List[str]) -> TradingWorker:
    """
    Create trading worker

    Args:
        coin_symbols: List of coins to trade

    Returns:
        TradingWorker: Created worker
    """
    global _global_trading_worker

    _global_trading_worker = TradingWorker(coin_symbols)
    return _global_trading_worker


def get_trading_worker() -> Optional[TradingWorker]:
    """
    Get global trading worker instance

    Returns:
        Optional[TradingWorker]: Global instance or None
    """
    return _global_trading_worker
