#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Calculation Worker - Price Data Processing and Attribute Calculation
"""

import time
import threading
from typing import List, Optional
from pyapps.okx_price_monitor.core.strategy_config import strategy_config
from pyapps.okx_price_monitor.foundation.redis_manager import get_redis_manager
from pyapps.okx_price_monitor.services.coin_attribute_calculator import get_coin_attribute_calculator


class CalculationWorker:
    """
    Calculation worker thread

    Continuously updates coin attributes based on Redis data.
    """

    def __init__(self, coin_symbols: List[str]):
        """
        Initialize calculation worker

        Args:
            coin_symbols: List of coins to monitor
        """
        self.coin_symbols = coin_symbols
        self.redis_manager = get_redis_manager()
        self.calculator = get_coin_attribute_calculator()

        self.running = False
        self.thread: Optional[threading.Thread] = None

        # Statistics
        self.stats = {
            'update_count': 0,
            'last_update_time': None,
            'coins_processed': 0,
        }

        print(f"[CalculationWorker] Initialized for {len(coin_symbols)} coins")

    def start(self):
        """Start calculation worker thread"""
        if self.running:
            print("[CalculationWorker] Already running")
            return

        self.running = True
        self.thread = threading.Thread(target=self._calculation_loop, daemon=True)
        self.thread.start()

        print("[CalculationWorker] Started")

    def stop(self):
        """Stop calculation worker"""
        if not self.running:
            return

        print("[CalculationWorker] Stopping...")
        self.running = False

        if self.thread:
            self.thread.join(timeout=10)

        print("[CalculationWorker] Stopped")

    def _calculation_loop(self):
        """Main calculation loop (runs in thread)"""
        print("[CalculationWorker] Calculation loop started")

        update_interval = strategy_config.ATTR_UPDATE_INTERVAL_SECONDS

        while self.running:
            # Update all coin attributes (let errors propagate for debugging)
            self.calculator.update_all_coins(self.coin_symbols)

            # Update statistics
            self.stats['update_count'] += 1
            self.stats['last_update_time'] = time.time()
            self.stats['coins_processed'] = len(self.coin_symbols)

            # Sleep until next update
            time.sleep(update_interval)

    def get_stats(self) -> dict:
        """Get calculation statistics"""
        return self.stats.copy()


# Global instances (one per thread)
_global_workers: List[CalculationWorker] = []


def create_calculation_workers(coin_symbols: List[str], num_threads: int = None) -> List[CalculationWorker]:
    """
    Create calculation workers

    Args:
        coin_symbols: List of coins to process
        num_threads: Number of worker threads

    Returns:
        List[CalculationWorker]: Created workers
    """
    global _global_workers

    num_threads = num_threads or strategy_config.NUM_CALCULATION_THREADS

    # Split coins among threads
    coins_per_thread = len(coin_symbols) // num_threads
    workers = []

    for i in range(num_threads):
        start_idx = i * coins_per_thread
        if i == num_threads - 1:
            # Last thread gets remaining coins
            thread_coins = coin_symbols[start_idx:]
        else:
            thread_coins = coin_symbols[start_idx:start_idx + coins_per_thread]

        worker = CalculationWorker(thread_coins)
        workers.append(worker)

    _global_workers = workers
    return workers
