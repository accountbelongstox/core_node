#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Historical Data Replayer - For TEST Mode

Replays historical data from SQLite in chronological order,
simulating real-time price updates for backtesting.

Data Flow (TEST Mode):
1. Initialize: Load SQLite data -> Redis
2. Replay: Feed data chronologically from start_time
3. Trading: Execute on replayed data
"""

import time
import threading
from typing import List, Optional
from datetime import datetime, timedelta
from pyapps.okx_price_monitor.core.strategy_config import strategy_config
from pyapps.okx_price_monitor.foundation.unified_price_manager import get_unified_price_manager
from pyapps.okx_price_monitor.foundation.redis_manager import get_redis_manager


class DataReplayer:
    """
    Historical data replayer for TEST mode

    Replays historical data chronologically to simulate live trading.
    """

    def __init__(self, coin_symbols: List[str], start_time: datetime):
        """
        Initialize data replayer

        Args:
            coin_symbols: List of coins to replay
            start_time: Starting timestamp for replay
        """
        self.coin_symbols = coin_symbols
        self.start_time = start_time
        self.db_manager = get_unified_price_manager()
        self.redis_manager = get_redis_manager()

        self.running = False
        self.thread: Optional[threading.Thread] = None

        # Current replay time (simulation clock)
        self.current_time = start_time
        self.replay_speed = 1.0  # 1.0 = real-time, 10.0 = 10x speed

        # Statistics
        self.stats = {
            'total_replayed': 0,
            'current_replay_time': None,
            'replay_start_time': None,
            'replay_elapsed_seconds': 0,
        }

        print(f"[DataReplayer] Initialized")
        print(f"[DataReplayer] Coins: {len(coin_symbols)}")
        print(f"[DataReplayer] Start time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"[DataReplayer] Replay speed: {self.replay_speed}x")

    def set_replay_speed(self, speed: float):
        """
        Set replay speed multiplier

        Args:
            speed: Speed multiplier (1.0 = real-time, 10.0 = 10x)
        """
        self.replay_speed = speed
        print(f"[DataReplayer] Replay speed set to {speed}x")

    def start(self):
        """Start data replay thread"""
        if self.running:
            print("[DataReplayer] Already running")
            return

        self.running = True
        self.thread = threading.Thread(target=self._replay_loop, daemon=True)
        self.thread.start()

        print("[DataReplayer] Replay started")

    def stop(self):
        """Stop data replay"""
        if not self.running:
            return

        print("[DataReplayer] Stopping replay...")
        self.running = False

        if self.thread:
            self.thread.join(timeout=10)

        print("[DataReplayer] Replay stopped")

    def _replay_loop(self):
        """Main replay loop (runs in thread)"""
        print("[DataReplayer] Replay loop started")

        self.stats['replay_start_time'] = time.time()

        # Replay interval (1 minute of simulated time)
        replay_interval_seconds = 60  # 1 minute

        while self.running:
            # Get data for current minute
            current_time_ms = int(self.current_time.timestamp() * 1000)
            next_time_ms = current_time_ms + (replay_interval_seconds * 1000)

            # Fetch data from SQLite for this time window
            data_count = self._replay_time_window(current_time_ms, next_time_ms)

            if data_count > 0:
                self.stats['total_replayed'] += data_count

            # Update simulation clock
            self.current_time += timedelta(seconds=replay_interval_seconds)
            self.stats['current_replay_time'] = self.current_time
            self.stats['replay_elapsed_seconds'] = time.time() - self.stats['replay_start_time']

            # Sleep based on replay speed
            # Real-time: sleep 60s, 10x speed: sleep 6s
            sleep_duration = replay_interval_seconds / self.replay_speed
            time.sleep(sleep_duration)

    def _replay_time_window(self, start_time_ms: int, end_time_ms: int) -> int:
        """
        Replay data for a specific time window

        Args:
            start_time_ms: Start timestamp
            end_time_ms: End timestamp

        Returns:
            int: Number of data points replayed
        """
        replayed_count = 0

        for coin_symbol in self.coin_symbols:
            # Get data from SQLite
            price_records = self.db_manager.get_price_history(
                coin_symbol=coin_symbol,
                start_time_ms=start_time_ms,
                end_time_ms=end_time_ms,
                limit=100
            )

            if not price_records:
                continue

            # Feed to Redis (simulate live data)
            for record in price_records:
                # Update Redis with this data point
                price_data = {
                    'timestamp_ms': record['timestamp_ms'],
                    'open': record['open'],
                    'high': record['high'],
                    'low': record['low'],
                    'close': record['close'],
                    'volume': record.get('volume', 0),
                    'source': 'replayed',
                }

                # Append to Redis history
                self.redis_manager.append_price_history(coin_symbol, price_data)

                # Update latest price
                self.redis_manager.set_price(coin_symbol, price_data)

                replayed_count += 1

        if replayed_count > 0:
            current_dt = datetime.fromtimestamp(start_time_ms / 1000)
            print(f"[DataReplayer] TIME {current_dt.strftime('%Y-%m-%d %H:%M')} | "
                  f"Replayed {replayed_count} data points")

        return replayed_count

    def get_current_simulation_time(self) -> datetime:
        """
        Get current simulation time

        Returns:
            datetime: Current simulation timestamp
        """
        return self.current_time

    def get_stats(self) -> dict:
        """Get replay statistics"""
        return self.stats.copy()


# Global instance
_global_replayer = None


def create_data_replayer(coin_symbols: List[str], start_time: datetime) -> DataReplayer:
    """
    Create data replayer instance

    Args:
        coin_symbols: Coins to replay
        start_time: Replay start time

    Returns:
        DataReplayer: Created replayer
    """
    global _global_replayer

    _global_replayer = DataReplayer(coin_symbols, start_time)
    return _global_replayer


def get_data_replayer() -> Optional[DataReplayer]:
    """
    Get global replayer instance

    Returns:
        Optional[DataReplayer]: Global instance or None
    """
    return _global_replayer
