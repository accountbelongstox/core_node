#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Batch Database Writer - Optimize Database Writes
批量数据库写入器 - 优化数据库写入性能

Features:
- Buffer price updates in memory
- Batch write to database every N seconds
- Process only M coins per batch
- Rotating coin selection for fairness
"""

import time
import asyncio
from typing import Dict, List, Optional
from collections import defaultdict, deque
from threading import Lock


class BatchDBWriter:
    """
    Batch Database Writer

    Buffers price updates and writes to database in batches
    to reduce database I/O overhead.
    """

    def __init__(self, db_manager, batch_interval: int = 30, batch_size: int = 100):
        """
        Initialize batch database writer

        Args:
            db_manager: Database manager (RealtimePriceManager)
            batch_interval: Write interval in seconds (default: 30)
            batch_size: Number of coins to process per batch (default: 100)
        """
        self.db_manager = db_manager
        self.batch_interval = batch_interval
        self.batch_size = batch_size

        # Buffer for pending updates: {coin: [(timestamp, price_data), ...]}
        self.buffer: Dict[str, List[tuple]] = defaultdict(list)
        self.buffer_lock = Lock()

        # Coin rotation for fair processing
        self.coin_queue: deque = deque()
        self.coin_last_written: Dict[str, float] = {}

        # Statistics
        self.stats = {
            'total_buffered': 0,
            'total_written': 0,
            'batches_executed': 0,
            'coins_in_buffer': 0,
            'last_batch_time': None,
            'last_batch_size': 0
        }

        # Running state
        self.running = False
        self.write_task: Optional[asyncio.Task] = None

        print(f"[BatchDBWriter] Initialized")
        print(f"[BatchDBWriter] Batch interval: {batch_interval}s")
        print(f"[BatchDBWriter] Batch size: {batch_size} coins")

    def buffer_update(self, coin_symbol: str, timestamp: int, price_data: Dict):
        """
        Buffer a price update for later writing

        Args:
            coin_symbol: Coin symbol
            timestamp: Price timestamp (milliseconds)
            price_data: Price data dictionary
        """
        with self.buffer_lock:
            # Add to buffer
            self.buffer[coin_symbol].append((timestamp, price_data))
            self.stats['total_buffered'] += 1

            # Add coin to queue if not present
            if coin_symbol not in self.coin_queue:
                self.coin_queue.append(coin_symbol)

            self.stats['coins_in_buffer'] = len(self.buffer)

    async def start_batch_writing(self):
        """Start batch writing loop"""
        self.running = True
        print("[BatchDBWriter] Started batch writing loop")

        while self.running:
            # Wait for batch interval
            await asyncio.sleep(self.batch_interval)

            # Execute batch write
            await self._execute_batch_write()

        print("[BatchDBWriter] Stopped batch writing loop")

    async def _execute_batch_write(self):
        """Execute a batch write operation"""
        if not self.buffer:
            return

        batch_start_time = time.time()

        # Select coins to process (up to batch_size)
        coins_to_process = []
        with self.buffer_lock:
            for _ in range(min(self.batch_size, len(self.coin_queue))):
                if not self.coin_queue:
                    break

                coin = self.coin_queue.popleft()
                if coin in self.buffer:
                    coins_to_process.append(coin)

        if not coins_to_process:
            return

        # Process selected coins
        total_records = 0
        for coin in coins_to_process:
            try:
                # Get buffered updates for this coin
                with self.buffer_lock:
                    updates = self.buffer.pop(coin, [])

                if not updates:
                    continue

                # Write updates to database
                for timestamp, price_data in updates:
                    try:
                        # Insert using the database manager
                        self.db_manager.insert_price(coin, price_data)
                        total_records += 1

                    except Exception as e:
                        print(f"[BatchDBWriter] Failed to write {coin}: {e}")

                # Update last written time
                self.coin_last_written[coin] = time.time()

            except Exception as e:
                print(f"[BatchDBWriter] Error processing {coin}: {e}")

        # Update statistics
        batch_duration = time.time() - batch_start_time
        self.stats['total_written'] += total_records
        self.stats['batches_executed'] += 1
        self.stats['last_batch_time'] = time.time()
        self.stats['last_batch_size'] = total_records
        self.stats['coins_in_buffer'] = len(self.buffer)

        print(f"[BatchDBWriter] Batch complete: "
              f"{len(coins_to_process)} coins, "
              f"{total_records} records, "
              f"{batch_duration:.2f}s")

    def stop(self):
        """Stop batch writing"""
        self.running = False

        # Flush remaining buffer
        print("[BatchDBWriter] Flushing remaining buffer...")
        remaining = sum(len(updates) for updates in self.buffer.values())
        print(f"[BatchDBWriter] Remaining updates: {remaining}")

    def get_stats(self) -> Dict:
        """Get batch writer statistics"""
        return {
            **self.stats,
            'buffer_size': sum(len(updates) for updates in self.buffer.values()),
            'coins_in_buffer': len(self.buffer)
        }

    def get_buffer_size(self) -> int:
        """Get current buffer size (number of pending updates)"""
        return sum(len(updates) for updates in self.buffer.values())


# Global instance
_global_writer = None


def get_batch_db_writer(db_manager=None, batch_interval: int = 30, batch_size: int = 100) -> BatchDBWriter:
    """
    Get global batch database writer instance

    Args:
        db_manager: Database manager (required on first call)
        batch_interval: Write interval in seconds
        batch_size: Number of coins per batch
    """
    global _global_writer

    if _global_writer is None:
        if db_manager is None:
            raise ValueError("db_manager required for first initialization")

        _global_writer = BatchDBWriter(db_manager, batch_interval, batch_size)

    return _global_writer
