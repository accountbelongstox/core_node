#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Realtime Data Update Worker - Continuous Data Loading

Continuously fetches latest candles from OKX API and updates Redis/SQLite.
Respects API rate limits and configurable update intervals.
"""

import time
import threading
from typing import List
from datetime import datetime, timedelta
from pyapps.okx_price_monitor.core.strategy_config import strategy_config
from pyapps.okx_price_monitor.foundation.redis_manager import get_redis_manager
from pyapps.okx_price_monitor.foundation.unified_price_manager import UnifiedPriceManager
from pyapps.okx_price_monitor.lib.okx_client import OKXClient


class RealtimeUpdateWorker:
    """
    Realtime data update worker

    Continuously fetches latest 1-minute candles for all coins.
    Updates Redis immediately and syncs to SQLite.
    """

    def __init__(self, coin_symbols: List[str], okx_client: OKXClient,
                 db_manager: UnifiedPriceManager):
        """
        Initialize realtime update worker

        Args:
            coin_symbols: List of coin symbols to update
            okx_client: OKX API client
            db_manager: Database manager for persistence
        """
        self.coin_symbols = coin_symbols
        self.okx_client = okx_client
        self.db_manager = db_manager
        self.redis_manager = get_redis_manager()

        # Configuration
        self.enabled = strategy_config.REALTIME_UPDATE_ENABLED
        self.update_interval = strategy_config.REALTIME_UPDATE_INTERVAL_SECONDS
        self.rate_limit = strategy_config.API_RATE_LIMIT_PER_SECOND
        self.batch_size = strategy_config.REALTIME_BATCH_SIZE

        # Worker state
        self.running = False
        self.thread = None
        self.current_index = 0  # Round-robin index

        # Statistics
        self.stats = {
            'total_updates': 0,
            'successful_updates': 0,
            'failed_updates': 0,
            'total_candles_fetched': 0,
            'cycles_completed': 0,
            'last_update_time': None,
        }

        print(f"[RealtimeUpdateWorker] Initialized")
        print(f"[RealtimeUpdateWorker] Coins: {len(self.coin_symbols)}")
        print(f"[RealtimeUpdateWorker] Enabled: {self.enabled}")
        print(f"[RealtimeUpdateWorker] Update interval: {self.update_interval}s "
              f"(0 = max speed)")
        print(f"[RealtimeUpdateWorker] API rate limit: {self.rate_limit} req/s")
        print(f"[RealtimeUpdateWorker] Batch size: {self.batch_size} coins/batch")
        print(f"[RealtimeUpdateWorker] Full cycle time: "
              f"~{len(self.coin_symbols) / self.batch_size:.1f}s")

    def start(self):
        """Start the worker thread"""
        if not self.enabled:
            print("[RealtimeUpdateWorker] Disabled (REALTIME_UPDATE_ENABLED = False)")
            return

        if self.running:
            print("[RealtimeUpdateWorker] Already running")
            return

        self.running = True
        self.thread = threading.Thread(
            target=self._update_loop,
            daemon=True,
            name="RealtimeUpdateWorker"
        )
        self.thread.start()
        print("[RealtimeUpdateWorker] Started")

    def stop(self):
        """Stop the worker thread"""
        if not self.running:
            return

        print("[RealtimeUpdateWorker] Stopping...")
        self.running = False

        if self.thread:
            self.thread.join(timeout=10)

        print("[RealtimeUpdateWorker] Stopped")
        self._print_statistics()

    def _update_loop(self):
        """Main update loop (runs in separate thread)"""
        print("[RealtimeUpdateWorker] Update loop started")

        while self.running:
            try:
                cycle_start = time.time()

                # Get next batch of coins
                batch = self._get_next_batch()

                if not batch:
                    # Completed full cycle, reset index
                    self.current_index = 0
                    self.stats['cycles_completed'] += 1

                    # Apply cycle interval if configured
                    if self.update_interval > 0:
                        time.sleep(self.update_interval)
                    continue

                # Update batch
                self._update_batch(batch)

                # Rate limiting: ensure we don't exceed API limits
                elapsed = time.time() - cycle_start
                batch_time = len(batch) / self.rate_limit  # Minimum time for batch

                if elapsed < batch_time:
                    sleep_time = batch_time - elapsed
                    time.sleep(sleep_time)

            except Exception as e:
                print(f"[RealtimeUpdateWorker] Error in update loop: {e}")
                import traceback
                traceback.print_exc()
                time.sleep(5)  # Wait before retrying

        print("[RealtimeUpdateWorker] Update loop ended")

    def _get_next_batch(self) -> List[str]:
        """
        Get next batch of coins to update (round-robin)

        Returns:
            List[str]: Batch of coin symbols
        """
        start_idx = self.current_index
        end_idx = min(start_idx + self.batch_size, len(self.coin_symbols))

        batch = self.coin_symbols[start_idx:end_idx]
        self.current_index = end_idx

        # If reached end, signal cycle completion
        if self.current_index >= len(self.coin_symbols):
            self.current_index = 0

        return batch

    def _update_batch(self, coin_batch: List[str]):
        """
        Update a batch of coins

        Args:
            coin_batch: List of coin symbols to update
        """
        for coin_symbol in coin_batch:
            try:
                self._update_coin(coin_symbol)
                self.stats['successful_updates'] += 1
            except Exception as e:
                print(f"[RealtimeUpdateWorker] Failed to update {coin_symbol}: {e}")
                self.stats['failed_updates'] += 1

            self.stats['total_updates'] += 1

        self.stats['last_update_time'] = datetime.now()

    def _update_coin(self, coin_symbol: str):
        """
        Update a single coin with latest data

        Args:
            coin_symbol: Coin symbol to update
        """
        # Fetch latest 2 candles (1m bar)
        # We fetch 2 to ensure we get the most recent complete + current candle
        end_time = datetime.now()
        start_time = end_time - timedelta(minutes=5)  # Last 5 minutes

        candles = self.okx_client.get_candles(
            inst_id=f"{coin_symbol}-USDT",
            bar='1m',
            after=None,
            before=None,
            limit=5
        )

        if not candles or len(candles) == 0:
            return

        self.stats['total_candles_fetched'] += len(candles)

        # Process each candle
        for candle_data in candles:
            timestamp_ms = int(candle_data[0])
            open_price = float(candle_data[1])
            high_price = float(candle_data[2])
            low_price = float(candle_data[3])
            close_price = float(candle_data[4])
            volume = float(candle_data[5])

            # Update Redis immediately
            price_record = {
                'timestamp_ms': timestamp_ms,
                'open': open_price,
                'high': high_price,
                'low': low_price,
                'close': close_price,
                'volume': volume,
            }

            self.redis_manager.set_price(coin_symbol, price_record)

            # Update SQLite (async via db_manager)
            self.db_manager.insert_or_update_price(
                coin_symbol=coin_symbol,
                timestamp_ms=timestamp_ms,
                open_price=open_price,
                high_price=high_price,
                low_price=low_price,
                close_price=close_price,
                volume=volume,
                source='realtime_api'
            )

    def _print_statistics(self):
        """Print worker statistics"""
        print("\n" + "="*80)
        print("REALTIME UPDATE WORKER - STATISTICS")
        print("="*80)
        print(f"Total updates attempted:  {self.stats['total_updates']}")
        print(f"Successful updates:       {self.stats['successful_updates']}")
        print(f"Failed updates:           {self.stats['failed_updates']}")
        print(f"Total candles fetched:    {self.stats['total_candles_fetched']}")
        print(f"Cycles completed:         {self.stats['cycles_completed']}")

        if self.stats['last_update_time']:
            print(f"Last update time:         "
                  f"{self.stats['last_update_time'].strftime('%Y-%m-%d %H:%M:%S')}")

        success_rate = 0
        if self.stats['total_updates'] > 0:
            success_rate = (self.stats['successful_updates'] /
                          self.stats['total_updates']) * 100
        print(f"Success rate:             {success_rate:.1f}%")
        print("="*80 + "\n")

    def get_statistics(self):
        """Get current statistics"""
        return self.stats.copy()


# Factory function
def create_realtime_update_worker(coin_symbols: List[str],
                                  okx_client: OKXClient,
                                  db_manager: UnifiedPriceManager) -> RealtimeUpdateWorker:
    """
    Create realtime update worker

    Args:
        coin_symbols: List of coin symbols
        okx_client: OKX API client
        db_manager: Database manager

    Returns:
        RealtimeUpdateWorker: Worker instance
    """
    return RealtimeUpdateWorker(coin_symbols, okx_client, db_manager)
