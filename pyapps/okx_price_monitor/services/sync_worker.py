#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Database Sync Worker - Redis to SQLite Synchronization
"""

import time
import threading
from typing import Optional
from pyapps.okx_price_monitor.core.strategy_config import strategy_config
from pyapps.okx_price_monitor.foundation.redis_manager import get_redis_manager
from pyapps.okx_price_monitor.foundation.unified_price_manager import get_unified_price_manager


class SyncWorker:
    """
    Database synchronization worker

    Syncs data from Redis cache to SQLite database periodically.
    """

    def __init__(self, sync_interval: int = None, batch_size: int = None):
        """
        Initialize sync worker

        Args:
            sync_interval: Sync interval in seconds
            batch_size: Number of coins to sync per batch
        """
        self.sync_interval = sync_interval or strategy_config.DB_SYNC_INTERVAL_SECONDS
        self.batch_size = batch_size or strategy_config.DB_SYNC_BATCH_SIZE

        self.redis_manager = get_redis_manager()
        self.db_manager = get_unified_price_manager()

        self.running = False
        self.thread: Optional[threading.Thread] = None

        # Statistics
        self.stats = {
            'sync_count': 0,
            'total_synced': 0,
            'last_sync_time': None,
            'last_sync_duration': 0,
        }

        print(f"[SyncWorker] Initialized")
        print(f"[SyncWorker] Sync interval: {self.sync_interval}s")
        print(f"[SyncWorker] Batch size: {self.batch_size} coins")

    def start(self):
        """Start sync worker thread"""
        if self.running:
            print("[SyncWorker] Already running")
            return

        self.running = True
        self.thread = threading.Thread(target=self._sync_loop, daemon=True)
        self.thread.start()

        print("[SyncWorker] Started")

    def stop(self, wait: bool = True):
        """
        Stop sync worker

        Args:
            wait: Wait for final sync before stopping
        """
        if not self.running:
            return

        print("[SyncWorker] Stopping...")
        self.running = False

        if wait:
            # Perform final sync
            print("[SyncWorker] Performing final sync...")
            self._sync_redis_to_db()

        if self.thread:
            self.thread.join(timeout=10)

        print("[SyncWorker] Stopped")

    def _sync_loop(self):
        """Main sync loop (runs in thread)"""
        print("[SyncWorker] Sync loop started")

        while self.running:
            # Perform sync (let errors propagate)
            self._sync_redis_to_db()

            # Sleep until next sync
            time.sleep(self.sync_interval)

    def _sync_redis_to_db(self):
        """Sync Redis data to SQLite database"""
        sync_start = time.time()

        # Get all coins from Redis
        all_coins = self.redis_manager.get_all_coins()

        if not all_coins:
            return

        # Process in batches
        synced_count = 0
        for i in range(0, len(all_coins), self.batch_size):
            if not self.running:
                break

            batch = all_coins[i:i + self.batch_size]

            for coin_symbol in batch:
                # Get price history from Redis
                price_history = self.redis_manager.get_price_history(coin_symbol, limit=100)

                if not price_history:
                    continue

                # Insert into database
                for price_data in price_history:
                    # Determine source (historical vs realtime)
                    source = price_data.get('source', 'realtime')

                    if source == 'historical':
                        # Historical data already in database
                        continue

                    # Insert realtime data
                    self.db_manager.insert_realtime_price(
                        coin_symbol=coin_symbol,
                        price=price_data['low'],  # Use LOW price
                        timestamp_ms=price_data['timestamp_ms'],
                        volume=price_data.get('volume')
                    )

                    synced_count += 1

        # Update statistics
        sync_duration = time.time() - sync_start
        self.stats['sync_count'] += 1
        self.stats['total_synced'] += synced_count
        self.stats['last_sync_time'] = time.time()
        self.stats['last_sync_duration'] = sync_duration

        if synced_count > 0:
            print(f"[SyncWorker] Synced {synced_count} records in {sync_duration:.2f}s")

    def get_stats(self) -> dict:
        """Get sync statistics"""
        return self.stats.copy()


# Global instance
_global_sync_worker = None


def get_sync_worker() -> SyncWorker:
    """
    Get global sync worker instance

    Returns:
        SyncWorker: Global instance
    """
    global _global_sync_worker

    if _global_sync_worker is None:
        _global_sync_worker = SyncWorker()

    return _global_sync_worker
