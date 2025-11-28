#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Backtest Main - Quantitative Trading Strategy System

Supports two modes:
1. TEST Mode: Replay historical data from 3 days ago (backtest)
2. LIVE Mode: Start from current time (paper trading with virtual money)

Data Flow:
- Initialize: SQLite → Redis (load historical data)
- Runtime: Redis only (all calculations and trading)
- Persistence: Redis → SQLite (background sync every 30s)

Architecture:
- Calculation Threads: Update coin attributes (Redis only)
- Trading Thread: Execute strategy (Redis only)
- Sync Thread: Persist Redis data to SQLite
- Data Source: DataReplayer (TEST) or WebSocket (LIVE)
"""

import sys
import time
import signal
from datetime import datetime, timedelta
from typing import List, Optional

# Add project root to path
from pathlib import Path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from pyapps.okx_price_monitor.core.strategy_config import strategy_config
from pyapps.okx_price_monitor.core.monitor_config import monitor_config
from pyapps.okx_price_monitor.foundation.coin_provider import CoinProvider
from pyapps.okx_price_monitor.foundation.unified_price_manager import get_unified_price_manager
from pyapps.okx_price_monitor.foundation.redis_manager import get_redis_manager
from pyapps.okx_price_monitor.lib.okx_client import create_okx_client
from pyapps.okx_price_monitor.services.sync_worker import get_sync_worker
from pyapps.okx_price_monitor.services.calculation_worker import create_calculation_workers
from pyapps.okx_price_monitor.services.trading_worker import create_trading_worker
from pyapps.okx_price_monitor.services.backtest_engine import get_backtest_engine
from pyapps.okx_price_monitor.services.data_replayer import create_data_replayer


class TradingSystemManager:
    """
    Trading System Manager

    Manages both TEST and LIVE modes.
    """

    def __init__(self):
        """Initialize trading system manager"""
        self.mode = strategy_config.RUN_MODE
        self.coin_provider = CoinProvider()
        self.okx_client = create_okx_client(use_auth=False)
        self.db_manager = get_unified_price_manager()
        self.redis_manager = get_redis_manager()
        self.backtest_engine = get_backtest_engine()

        self.coin_symbols: List[str] = []

        # Workers
        self.sync_worker = None
        self.calculation_workers = []
        self.trading_worker = None
        self.data_replayer = None  # TEST mode only

        self.running = False

        print("\n" + "="*80)
        print(f"TRADING SYSTEM INITIALIZED - {self.mode} MODE")
        print("="*80)
        print(f"Mode: {self.mode}")
        if self.mode == 'TEST':
            print(f"Start Time: {strategy_config.BACKTEST_START_DAYS} days ago")
        else:
            print(f"Start Time: Current time")
        print(f"Strategy: {strategy_config.BUY_SIGNAL_THRESHOLD_PERCENT}% rise in {strategy_config.BUY_SIGNAL_WINDOW_SECONDS}s -> Hold {strategy_config.SELL_AFTER_MINUTES}m")
        print(f"Initial Balance: {strategy_config.INITIAL_BALANCE_USDT} USDT")
        print(f"Position Size: {strategy_config.POSITION_SIZE_PERCENT}% per trade")
        print(f"Max Positions: {strategy_config.MAX_POSITIONS}")
        print("="*80 + "\n")

    def initialize_historical_data(self):
        """
        Load historical data into SQLite and Redis

        Data Flow: OKX API → SQLite → Redis
        """
        print("\n" + "="*80)
        print("STEP 1: INITIALIZE HISTORICAL DATA (SQLite → Redis)")
        print("="*80)

        # Get all coins
        self.coin_provider.fetch_instruments()
        self.coin_symbols = self.coin_provider.get_coin_list()

        print(f"Total coins: {len(self.coin_symbols)}")

        # Calculate time range
        days_to_load = strategy_config.HISTORY_INIT_DAYS
        end_time = datetime.now()
        start_time = end_time - timedelta(days=days_to_load)

        print(f"Loading {days_to_load} days of data ({start_time.strftime('%Y-%m-%d')} to {end_time.strftime('%Y-%m-%d')})")
        print("Data Flow: OKX API → SQLite → Redis")

        # Load data for each coin
        loaded_count = 0
        failed_count = 0

        for i, coin_symbol in enumerate(self.coin_symbols, 1):
            print(f"[{i}/{len(self.coin_symbols)}] Loading {coin_symbol}...", end=' ')

            # Check existing data in SQLite
            oldest_ts = self.db_manager.get_oldest_timestamp(coin_symbol)

            if oldest_ts:
                oldest_dt = datetime.fromtimestamp(oldest_ts / 1000)
                print(f"(existing: {oldest_dt.strftime('%Y-%m-%d')})", end=' ')

                if oldest_dt <= start_time:
                    # Already have enough data, just load to Redis
                    print("✓ Loading to Redis", end=' ')
                    self._load_to_redis_from_sqlite(coin_symbol, start_time, end_time)
                    print("✓ Complete")
                    loaded_count += 1
                    continue

            # Fetch from API
            inst_id = f"{coin_symbol}-USDT"
            candles_data = self._fetch_all_candles(inst_id, start_time, end_time)

            if not candles_data:
                print("✗ No data")
                failed_count += 1
                continue

            # Save to SQLite
            for candle in candles_data:
                self.db_manager.insert_historical_candle(coin_symbol, candle)

            # Load to Redis
            self._load_to_redis(coin_symbol, candles_data)

            print(f"✓ Loaded {len(candles_data)} candles")
            loaded_count += 1

            # Rate limiting
            time.sleep(0.05)

        print("\n" + "-"*80)
        print(f"Initialization complete: {loaded_count} coins loaded, {failed_count} failed")
        print(f"SQLite: Historical data persisted")
        print(f"Redis: {loaded_count} coins loaded and ready for calculations")
        print("="*80 + "\n")

    def _fetch_all_candles(self, inst_id: str, start_time: datetime, end_time: datetime) -> List:
        """
        Fetch all candles for time range from OKX API

        Args:
            inst_id: Instrument ID
            start_time: Start datetime
            end_time: End datetime

        Returns:
            List: Candle data
        """
        all_candles = []
        current_end = end_time

        while current_end > start_time:
            before_ts = str(int(current_end.timestamp() * 1000))

            response = self.okx_client.get_candles(
                inst_id=inst_id,
                bar='1m',
                limit=300,
                before=before_ts
            )

            if response['code'] != '0' or not response['data']:
                break

            candles = response['data']
            all_candles.extend(candles)

            oldest_ts = int(candles[-1][0]) / 1000
            current_end = datetime.fromtimestamp(oldest_ts)

            if current_end <= start_time:
                break

        # Filter to exact range
        start_ts_ms = int(start_time.timestamp() * 1000)
        end_ts_ms = int(end_time.timestamp() * 1000)

        filtered = [c for c in all_candles if start_ts_ms <= int(c[0]) <= end_ts_ms]
        return filtered

    def _load_to_redis(self, coin_symbol: str, candles: List):
        """
        Load candle data to Redis

        Args:
            coin_symbol: Coin symbol
            candles: List of candles
        """
        for candle in candles:
            price_data = {
                'timestamp_ms': int(candle[0]),
                'open': float(candle[1]),
                'high': float(candle[2]),
                'low': float(candle[3]),
                'close': float(candle[4]),
                'volume': float(candle[5]) if candle[5] else 0,
                'source': 'historical',
            }
            self.redis_manager.append_price_history(coin_symbol, price_data)

    def _load_to_redis_from_sqlite(self, coin_symbol: str, start_time: datetime, end_time: datetime):
        """
        Load data from SQLite to Redis

        Args:
            coin_symbol: Coin symbol
            start_time: Start datetime
            end_time: End datetime
        """
        start_ts_ms = int(start_time.timestamp() * 1000)
        end_ts_ms = int(end_time.timestamp() * 1000)

        records = self.db_manager.get_price_history(
            coin_symbol=coin_symbol,
            start_time_ms=start_ts_ms,
            end_time_ms=end_ts_ms,
            limit=10000
        )

        for record in records:
            price_data = {
                'timestamp_ms': record['timestamp_ms'],
                'open': record['open'],
                'high': record['high'],
                'low': record['low'],
                'close': record['close'],
                'volume': record.get('volume', 0),
                'source': record['source'],
            }
            self.redis_manager.append_price_history(coin_symbol, price_data)

    def start_workers(self):
        """
        Start all worker threads

        Workers only interact with Redis (no SQLite access during runtime)
        """
        print("\n" + "="*80)
        print("STEP 2: START WORKER THREADS (Redis-only operations)")
        print("="*80)

        # Start sync worker (Redis → SQLite persistence)
        print("Starting sync worker (Redis → SQLite)...")
        self.sync_worker = get_sync_worker()
        self.sync_worker.start()

        # Start calculation workers (Redis only)
        print(f"Starting {strategy_config.NUM_CALCULATION_THREADS} calculation workers (Redis only)...")
        self.calculation_workers = create_calculation_workers(
            self.coin_symbols,
            num_threads=strategy_config.NUM_CALCULATION_THREADS
        )
        for worker in self.calculation_workers:
            worker.start()

        # Wait for initial calculations
        print("Waiting for initial attribute calculation...")
        time.sleep(5)

        # Start trading worker (Redis only)
        print("Starting trading worker (Redis only)...")
        self.trading_worker = create_trading_worker(self.coin_symbols)
        self.trading_worker.start()

        # Start data source based on mode
        if self.mode == 'TEST':
            print("\n[TEST Mode] Starting data replayer (SQLite → Redis chronologically)...")
            start_time = datetime.now() - timedelta(days=strategy_config.BACKTEST_START_DAYS)
            self.data_replayer = create_data_replayer(self.coin_symbols, start_time)
            self.data_replayer.set_replay_speed(1.0)  # 1x speed
            self.data_replayer.start()
        else:
            print("\n[LIVE Mode] WebSocket client would start here (not implemented yet)")
            print("[LIVE Mode] Currently using existing Redis data")

        print("="*80 + "\n")

    def run(self, duration_minutes: Optional[int] = None):
        """
        Run trading system

        Args:
            duration_minutes: Duration in minutes (None = indefinite)
        """
        print("\n" + "="*80)
        print(f"STEP 3: RUN {self.mode} MODE")
        print("="*80)

        if duration_minutes:
            print(f"Running for {duration_minutes} minutes...")
            print("Press Ctrl+C to stop early\n")
        else:
            print("Running indefinitely...")
            print("Press Ctrl+C to stop\n")

        self.running = True
        start_time = time.time()

        try:
            while self.running:
                # Print status every 30 seconds
                if int(time.time()) % 30 == 0:
                    if duration_minutes:
                        elapsed_minutes = (time.time() - start_time) / 60
                        remaining_minutes = duration_minutes - elapsed_minutes

                        if remaining_minutes <= 0:
                            print("\nDuration completed!")
                            break

                        self._print_status(remaining_minutes)
                    else:
                        self._print_status()

                time.sleep(1)

        except KeyboardInterrupt:
            print("\n\nInterrupted by user")

    def _print_status(self, remaining_minutes: Optional[float] = None):
        """Print current status"""
        engine_summary = self.backtest_engine.get_performance_summary()

        print("\n" + "-"*80)
        if remaining_minutes:
            print(f"Time remaining: {remaining_minutes:.1f} minutes")

        if self.mode == 'TEST' and self.data_replayer:
            sim_time = self.data_replayer.get_current_simulation_time()
            print(f"Simulation Time: {sim_time.strftime('%Y-%m-%d %H:%M:%S')}")

        print(f"Balance: {engine_summary['current_balance']:.2f} USDT "
              f"({engine_summary['total_return_percent']:+.2f}%)")
        print(f"Trades: {engine_summary['total_trades']} "
              f"(W: {engine_summary['winning_trades']}, L: {engine_summary['losing_trades']})")
        print(f"Active Positions: {engine_summary['active_positions']}")

        if self.trading_worker:
            trading_stats = self.trading_worker.get_stats()
            print(f"Filtered Coins: {trading_stats['filtered_coins_count']}")
            print(f"Signals Detected: {trading_stats['signals_detected']}")

        print("-"*80)

    def stop_workers(self):
        """Stop all worker threads"""
        print("\n" + "="*80)
        print("STOPPING WORKERS")
        print("="*80)

        self.running = False

        # Stop data source
        if self.data_replayer:
            self.data_replayer.stop()

        # Stop trading worker (closes positions)
        if self.trading_worker:
            self.trading_worker.stop()

        # Stop calculation workers
        for worker in self.calculation_workers:
            worker.stop()

        # Stop sync worker (final sync: Redis → SQLite)
        if self.sync_worker:
            print("Final Redis → SQLite sync...")
            self.sync_worker.stop(wait=True)

        print("="*80 + "\n")


def main():
    """Main entry point"""
    print("\n" + "="*80)
    print(f"QUANTITATIVE TRADING SYSTEM - {strategy_config.RUN_MODE} MODE")
    print("="*80)
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Mode: {strategy_config.RUN_MODE}")
    print("="*80 + "\n")

    # Create manager
    manager = TradingSystemManager()

    # Register signal handler
    def signal_handler(sig, frame):
        print("\n\nReceived shutdown signal...")
        manager.running = False

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Run system
    try:
        # Step 1: Initialize (SQLite → Redis)
        manager.initialize_historical_data()

        # Step 2: Start workers (Redis only)
        manager.start_workers()

        # Step 3: Run
        manager.run(duration_minutes=None)

    finally:
        # Cleanup
        manager.stop_workers()

    print("\n" + "="*80)
    print(f"{strategy_config.RUN_MODE} MODE COMPLETED")
    print(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80 + "\n")


if __name__ == '__main__':
    main()
