#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Trading Controller - Quantitative Trading System Controller

Wraps TradingSystemManager to provide clean interface for OKX controller.
"""

import time
import signal
from datetime import datetime, timedelta
from typing import List, Optional

from pyapps.okx_price_monitor.core.strategy_config import strategy_config
from pyapps.okx_price_monitor.foundation.coin_provider import CoinProvider
from pyapps.okx_price_monitor.foundation.unified_price_manager import get_unified_price_manager
from pyapps.okx_price_monitor.foundation.redis_manager import get_redis_manager
from pyapps.okx_price_monitor.lib.okx_client import create_okx_client
from pyapps.okx_price_monitor.services.sync_worker import get_sync_worker
from pyapps.okx_price_monitor.services.calculation_worker import create_calculation_workers
from pyapps.okx_price_monitor.services.trading_worker import create_trading_worker
from pyapps.okx_price_monitor.services.backtest_engine import get_backtest_engine
from pyapps.okx_price_monitor.services.data_replayer import create_data_replayer


class TradingController:
    """
    Trading System Controller

    Manages both TEST and LIVE modes for quantitative trading.
    """

    def __init__(self):
        """Initialize trading controller"""
        import sys
        self.mode = strategy_config.RUN_MODE
        print("[TradingController] Creating CoinProvider...")
        sys.stdout.flush()
        self.coin_provider = CoinProvider()
        print("[TradingController] Creating OKX client...")
        sys.stdout.flush()
        self.okx_client = create_okx_client(use_auth=False)
        print("[TradingController] Creating database manager...")
        sys.stdout.flush()
        self.db_manager = get_unified_price_manager()
        print("[TradingController] Creating Redis manager...")
        sys.stdout.flush()
        self.redis_manager = get_redis_manager()
        print("[TradingController] Creating backtest engine...")
        sys.stdout.flush()
        self.backtest_engine = get_backtest_engine()
        print("[TradingController] Backtest engine created!")
        sys.stdout.flush()

        self.coin_symbols: List[str] = []
        print("[TradingController] Initializing worker placeholders...")
        sys.stdout.flush()

        # Workers
        self.sync_worker = None
        self.calculation_workers = []
        self.trading_worker = None
        self.data_replayer = None  # TEST mode only

        self.running = False
        print("[TradingController] Printing banner...")
        sys.stdout.flush()

        print("\n" + "="*80)
        sys.stdout.flush()
        print(f"TRADING SYSTEM CONTROLLER - {self.mode} MODE")
        sys.stdout.flush()
        print("="*80)
        sys.stdout.flush()
        print(f"Mode: {self.mode}")
        sys.stdout.flush()
        if self.mode == 'TEST':
            print(f"Start Time: {strategy_config.BACKTEST_START_DAYS} days ago")
        else:
            print(f"Start Time: Current time")
        sys.stdout.flush()
        print(f"Strategy: {strategy_config.BUY_SIGNAL_THRESHOLD_PERCENT}% rise in {strategy_config.BUY_SIGNAL_WINDOW_SECONDS}s -> Hold {strategy_config.SELL_AFTER_MINUTES}m")
        sys.stdout.flush()
        print(f"Initial Balance: {strategy_config.INITIAL_BALANCE_USDT} USDT")
        sys.stdout.flush()
        print(f"Position Size: {strategy_config.POSITION_SIZE_PERCENT}% per trade")
        sys.stdout.flush()
        print(f"Max Positions: {strategy_config.MAX_POSITIONS}")
        sys.stdout.flush()
        print("="*80 + "\n")
        sys.stdout.flush()
        print("[TradingController] Banner printed, __init__ complete")
        sys.stdout.flush()

    def initialize_historical_data(self):
        """
        Load historical data into SQLite and Redis

        Data Flow: OKX API -> SQLite -> Redis
        """
        import sys
        print("\n" + "="*80)
        sys.stdout.flush()
        print("INITIALIZING HISTORICAL DATA (SQLite -> Redis)")
        sys.stdout.flush()
        print("="*80)
        sys.stdout.flush()

        # Get all coins
        print("[Init] Step 1: Fetching instruments...")
        sys.stdout.flush()
        self.coin_provider.fetch_instruments()
        print("[Init] Step 2: Getting coin list...")
        sys.stdout.flush()
        self.coin_symbols = self.coin_provider.get_coin_list()
        print(f"[Init] Step 3: Got {len(self.coin_symbols)} coins")
        sys.stdout.flush()

        print(f"Total coins: {len(self.coin_symbols)}")
        sys.stdout.flush()

        # Calculate time range
        days_to_load = strategy_config.HISTORY_INIT_DAYS
        end_time = datetime.now()
        start_time = end_time - timedelta(days=days_to_load)
        start_ts_ms = int(start_time.timestamp() * 1000)
        end_ts_ms = int(end_time.timestamp() * 1000)

        print(f"Loading {days_to_load} days of data ({start_time.strftime('%Y-%m-%d')} to {end_time.strftime('%Y-%m-%d')})")
        sys.stdout.flush()
        print("Data Flow: OKX API -> SQLite -> Redis")
        sys.stdout.flush()

        # Load data for each coin
        loaded_count = 0
        failed_count = 0

        for i, coin_symbol in enumerate(self.coin_symbols, 1):
            inst_id = f"{coin_symbol}-USDT"

            # Query database with error handling
            try:
                existing_count = self.db_manager.count_records(coin_symbol, start_ts_ms, end_ts_ms)
            except Exception as e:
                print(f"\n[{i}/{len(self.coin_symbols)}] [ERROR] Failed to query database for {coin_symbol}: {e}")
                sys.stdout.flush()
                existing_count = 0

            print(f"[{i}/{len(self.coin_symbols)}] Loading {coin_symbol}...", end=' ')
            sys.stdout.flush()
            print(f"(existing rows: {existing_count})", end=' ')
            sys.stdout.flush()

            # Check existing data in SQLite (both oldest and latest)
            try:
                time_range = self.db_manager.get_time_range(coin_symbol)
            except Exception as e:
                print(f"[ERROR] Failed to get time range: {e}", end=' ')
                sys.stdout.flush()
                time_range = None

            if time_range:
                oldest_ms, latest_ms = time_range
                oldest_dt = datetime.fromtimestamp(oldest_ms / 1000)
                latest_dt = datetime.fromtimestamp(latest_ms / 1000)

                print(f"(DB window: {oldest_dt.strftime('%m-%d %H:%M')} to {latest_dt.strftime('%m-%d %H:%M')})", end=' ')
                sys.stdout.flush()

                # Check for duplicates and deduplicate if needed
                try:
                    dup_count = self.db_manager.check_duplicates(coin_symbol)
                    if dup_count > 0:
                        print(f"[Dedup before load: {dup_count}]", end=' ')
                        sys.stdout.flush()
                        self.db_manager.deduplicate_coin_data(coin_symbol)
                except Exception as e:
                    print(f"[WARN] Dedup failed: {e}", end=' ')
                    sys.stdout.flush()

                # Check if data is complete and up-to-date
                has_enough_history = oldest_dt <= start_time
                is_up_to_date = latest_dt >= end_time - timedelta(minutes=5)

                if has_enough_history and is_up_to_date:
                    # Data is complete and recent, just load to Redis
                    print("[Up-to-date] Loading to Redis...", end=' ')
                    sys.stdout.flush()
                    try:
                        loaded_rows = self._load_to_redis_from_sqlite(coin_symbol, start_time, end_time)
                        print(f"[OK] rows={loaded_rows}")
                        sys.stdout.flush()
                        loaded_count += 1
                        continue
                    except Exception as e:
                        print(f"[FAIL] {e}")
                        sys.stdout.flush()
                        failed_count += 1
                        continue

                # Need to fetch missing data
                if not has_enough_history and not is_up_to_date:
                    # Missing both historical and recent data
                    print(f"[Gap: full range]", end=' ')
                    sys.stdout.flush()
                    candles_data = self._fetch_all_candles(inst_id, start_time, end_time)
                elif not is_up_to_date:
                    # Only need recent data (incremental update)
                    gap_start = latest_dt
                    gap_end = end_time
                    print(f"[Gap: {gap_start.strftime('%m-%d %H:%M')} to {gap_end.strftime('%m-%d %H:%M')}]", end=' ')
                    sys.stdout.flush()
                    candles_data = self._fetch_all_candles(inst_id, gap_start, gap_end)
                else:
                    # Only need older historical data
                    gap_start = start_time
                    gap_end = oldest_dt
                    print(f"[Gap: {gap_start.strftime('%m-%d')} to {gap_end.strftime('%m-%d')}]", end=' ')
                    sys.stdout.flush()
                    candles_data = self._fetch_all_candles(inst_id, gap_start, gap_end)

            else:
                # No existing data, fetch full range
                print("[New]", end=' ')
                sys.stdout.flush()
                candles_data = self._fetch_all_candles(inst_id, start_time, end_time)

            # Process fetched data
            if not candles_data:
                print("[FAIL] No data")
                sys.stdout.flush()
                failed_count += 1
                continue

            # Save to SQLite (INSERT OR REPLACE handles duplicates)
            try:
                for candle in candles_data:
                    self.db_manager.insert_historical_candle(coin_symbol, candle)
                fetched_count = len(candles_data)

                # Load all data to Redis (including existing + new)
                redis_loaded = self._load_to_redis_from_sqlite(coin_symbol, start_time, end_time)

                print(f"[OK] fetched={fetched_count} loaded_to_redis={redis_loaded}")
                sys.stdout.flush()
                loaded_count += 1
            except Exception as e:
                print(f"[FAIL] Error saving/loading: {e}")
                sys.stdout.flush()
                failed_count += 1

            # Rate limiting
            time.sleep(0.05)

        print("\n" + "-"*80)
        sys.stdout.flush()
        print(f"Initialization complete: {loaded_count} coins loaded, {failed_count} failed")
        sys.stdout.flush()
        print(f"SQLite: Historical data persisted")
        sys.stdout.flush()
        print(f"Redis: {loaded_count} coins loaded and ready for calculations")
        sys.stdout.flush()
        print("="*80 + "\n")
        sys.stdout.flush()

        # Data verification (random sample)
        ENABLE_VERIFICATION = True  # Control flag
        if ENABLE_VERIFICATION and loaded_count > 0:
            from pyapps.okx_price_monitor.services.data_verifier import get_data_verifier

            verifier = get_data_verifier(self.db_manager, max_gap_minutes=10)
            verifier.verify_random_coin(self.coin_symbols, start_time, end_time)

    def _fetch_all_candles(self, inst_id: str, start_time: datetime, end_time: datetime) -> List:
        """
        Fetch candles for time range from OKX API using hybrid strategy

        Args:
            inst_id: Instrument ID
            start_time: Start datetime
            end_time: End datetime

        Returns:
            List: Candle data

        Strategy (Hybrid - Best of both worlds):
            Due to OKX API limitations:
            - 1m bars: only 1 day available
            - 5m bars: 5 days available

            Solution: Use both!
            1. Use 5m bars for historical data (day 3 to day 2)
            2. Use 1m bars for recent data (last 24 hours)

            Benefits:
            - Full 3-day coverage for 24h attribute calculation
            - Precise 1-minute data for 60-second signal detection
        """
        all_candles = []

        # Calculate split point: last 1 day uses 1m, older uses 5m
        one_day_ago = end_time - timedelta(days=1)

        print(f"    Using hybrid strategy:")
        print(f"    - 5m bars: {start_time.strftime('%m-%d')} to {one_day_ago.strftime('%m-%d')} (historical)")
        print(f"    - 1m bars: {one_day_ago.strftime('%m-%d')} to {end_time.strftime('%m-%d')} (recent)")

        # Part 1: Fetch older data with 5m bars (fast, 3-4 requests)
        if one_day_ago > start_time:
            print(f"\n    [Part 1] Fetching 5m historical data...")
            historical_candles = self._fetch_candles_with_bar(
                inst_id, start_time, one_day_ago, bar='5m'
            )
            print(f"    Got {len(historical_candles)} candles (5m)")
            all_candles.extend(historical_candles)

        # Part 2: Fetch recent data with 1m bars (precise, 5-6 requests)
        print(f"\n    [Part 2] Fetching 1m recent data...")
        recent_candles = self._fetch_candles_with_bar(
            inst_id, one_day_ago, end_time, bar='1m'
        )
        print(f"    Got {len(recent_candles)} candles (1m)")
        all_candles.extend(recent_candles)

        # Remove duplicates and sort
        unique_candles = []
        seen_ts = set()
        for candle in all_candles:
            ts = int(candle[0])
            if ts not in seen_ts:
                seen_ts.add(ts)
                unique_candles.append(candle)

        unique_candles.sort(key=lambda c: int(c[0]))

        print(f"\n    Total: {len(unique_candles)} unique candles collected")

        return unique_candles

    def _fetch_candles_with_bar(self, inst_id: str, start_time: datetime,
                                  end_time: datetime, bar: str) -> List:
        """
        Fetch candles with specific bar size

        Args:
            inst_id: Instrument ID
            start_time: Start datetime
            end_time: End datetime
            bar: Bar size (e.g., '1m', '5m')

        Returns:
            List: Candle data
        """
        candles = []
        start_ts_ms = int(start_time.timestamp() * 1000)
        end_ts_ms = int(end_time.timestamp() * 1000)

        iteration = 0
        max_iterations = 20  # Safety limit
        current_after = None

        while iteration < max_iterations:
            iteration += 1

            params = {
                'inst_id': inst_id,
                'bar': bar,
                'limit': 300,
            }

            if current_after is not None:
                params['after'] = str(current_after)

            response = self.okx_client.get_candles(**params)

            if response['code'] != '0':
                print(f"      [API ERROR: {response.get('msg')}]")
                break

            if not response['data']:
                break

            batch = response['data']
            new_count = 0

            for candle in batch:
                candle_ts = int(candle[0])

                # Filter by time range
                if candle_ts < start_ts_ms or candle_ts > end_ts_ms:
                    continue

                # Skip duplicates
                if any(int(c[0]) == candle_ts for c in candles):
                    continue

                candles.append(candle)
                new_count += 1

            # Update cursor
            if batch:
                oldest_in_batch = min(int(c[0]) for c in batch)
                current_after = oldest_in_batch

            # Stop conditions
            if new_count == 0:
                break

            oldest = min(int(c[0]) for c in candles) if candles else end_ts_ms
            if oldest <= start_ts_ms:
                break

            # Rate limiting
            time.sleep(0.05)

        return candles

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

        return len(records)

    def start_workers(self):
        """
        Start all worker threads

        Workers only interact with Redis (no SQLite access during runtime)
        """
        print("\n" + "="*80)
        print("STARTING WORKER THREADS (Redis-only operations)")
        print("="*80)

        # Start sync worker (Redis -> SQLite persistence)
        print("Starting sync worker (Redis -> SQLite)...")
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
            print("\n[TEST Mode] Starting data replayer (SQLite -> Redis chronologically)...")
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
        print(f"RUNNING {self.mode} MODE")
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

        # Stop sync worker (final sync: Redis -> SQLite)
        if self.sync_worker:
            print("Final Redis -> SQLite sync...")
            self.sync_worker.stop(wait=True)

        print("="*80 + "\n")
