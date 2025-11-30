#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Monitor Manager - Central Management

Manages all coin trackers and coordinates updates.
Supports both WebSocket (real-time) and REST API (polling) modes.
"""

import time
import asyncio
import threading
from typing import Dict, List, Optional

from pyapps.okx_price_monitor.lib import (
    create_okx_client,
    CoinTableManager,
    HistoryFetcher,
    get_rate_limiter,
    get_realtime_price_manager
)
from pyapps.okx_price_monitor.lib.okx_websocket_client import OKXWebSocketClient
from pyapps.okx_price_monitor.foundation import CoinProvider
from pyapps.okx_price_monitor.core.coin_tracker import CoinTracker
from pyapps.okx_price_monitor.core.timestamp_interceptor import get_timestamp_interceptor
from pyapps.okx_price_monitor.core.monitor_config import monitor_config
from pyapps.okx_price_monitor.services.realtime_stats_display import get_realtime_stats_display
from pyapps.okx_price_monitor.services.alert_logger import get_alert_logger
from pyapps.okx_price_monitor.services.batch_db_writer import get_batch_db_writer


class MonitorManager:
    """
    Central Monitor Manager

    Coordinates:
    - Historical data fetching
    - Real-time price updates
    - Alert detection
    - Web API integration
    """

    def __init__(self):
        """Initialize monitor manager"""
        self.okx_client = create_okx_client(use_auth=False)
        self.coin_provider = CoinProvider(inst_type="SPOT", use_auth=False)
        self.table_manager = CoinTableManager(database_name=monitor_config.DATABASE_NAME)
        self.history_fetcher = HistoryFetcher(self.okx_client, self.table_manager)
        self.timestamp_interceptor = get_timestamp_interceptor()

        # Real-time price storage (if enabled)
        self.realtime_manager = None
        if monitor_config.ENABLE_REALTIME_STORAGE:
            self.realtime_manager = get_realtime_price_manager()

        # WebSocket client (if enabled)
        self.ws_client: Optional[OKXWebSocketClient] = None
        self.use_websocket = monitor_config.USE_WEBSOCKET

        self.trackers: Dict[str, CoinTracker] = {}
        self.initialized_coins: List[str] = []

        # Thread and async management
        self.update_thread: Optional[threading.Thread] = None
        self.running = False
        self.loop: Optional[asyncio.AbstractEventLoop] = None

        # New coin detection
        self.new_coin_detection_enabled = monitor_config.ENABLE_NEW_COIN_DETECTION
        self.new_coin_check_interval = monitor_config.NEW_COIN_CHECK_INTERVAL
        self.new_coin_check_task: Optional[asyncio.Task] = None

        # Real-time statistics display
        self.stats_display = get_realtime_stats_display()

        # Alert logger
        self.alert_logger = get_alert_logger()

        # Batch database writer (optimize writes)
        self.batch_db_writer = None
        if self.realtime_manager:
            self.batch_db_writer = get_batch_db_writer(
                db_manager=self.realtime_manager,
                batch_interval=30,  # Write every 30 seconds
                batch_size=100      # Process 100 coins per batch
            )

        # Display update task
        self.display_update_task: Optional[asyncio.Task] = None

        print(f"[MonitorManager] Initialized")
        print(f"  WebSocket: {'Enabled' if self.use_websocket else 'Disabled'}")
        print(f"  Real-time Storage: {'Enabled' if monitor_config.ENABLE_REALTIME_STORAGE else 'Disabled'}")
        print(f"  New Coin Detection: {'Enabled' if self.new_coin_detection_enabled else 'Disabled'}")
        print(f"  Batch DB Writer: {'Enabled' if self.batch_db_writer else 'Disabled'}")

    def initialize_all_coins(self):
        """
        Initialize all coins:
        1. Get all instruments
        2. Ensure tables exist (show details)
        3. Fetch historical data
        4. Load data into memory (show details)
        5. Create trackers
        """
        print("\n" + "="*80)
        print("[MonitorManager] Starting initialization...")
        print("="*80)

        print("\n[Step 1] Fetching instruments...")
        instruments = self.coin_provider.fetch_instruments()
        print(f"[SUCCESS] Fetched {len(instruments)} instruments")

        print("\n[Step 2] Extracting coin list...")
        coins = self.coin_provider.get_coin_list()
        print(f"[SUCCESS] Found {len(coins)} unique coins")

        print("\n[Step 3] Creating database tables...")
        print("="*80)
        print(f"Database: {self.table_manager.db_path}")
        print(f"Storage: Historical data only (not for interaction)")
        print("-"*80)

        new_tables = []
        existing_tables = []

        for coin in coins:
            table_existed = coin in self.table_manager.created_tables
            if self.table_manager.create_table_if_not_exists(coin):
                if not table_existed:
                    new_tables.append(coin)
                    print(f"  ✓ {coin:8s} - Table created")
            else:
                existing_tables.append(coin)
                print(f"  • {coin:8s} - Table exists")

        print("-"*80)
        print(f"[SUMMARY] Tables: {len(new_tables)} created, {len(existing_tables)} existing")
        print(f"[TOTAL] {len(coins)} tables ready for historical data (1-minute candles)")
        print("="*80)

        # Create real-time price tables if enabled
        if self.realtime_manager:
            print("\n[Step 3.5] Creating real-time price tables...")
            print("="*80)
            print(f"Database: {self.realtime_manager.db_path}")
            print(f"Storage: Real-time WebSocket price updates (millisecond-level)")
            print(f"Sampling: {monitor_config.REALTIME_SAMPLING_INTERVAL_MS}ms minimum interval")
            print(f"Retention: {monitor_config.REALTIME_RETENTION_DAYS} days")
            print("-"*80)

            rt_new_tables = []
            rt_existing_tables = []

            for coin in coins:
                table_existed = coin in self.realtime_manager.created_tables
                if self.realtime_manager.create_table_if_not_exists(coin):
                    if not table_existed:
                        rt_new_tables.append(coin)
                        print(f"  ✓ {coin:8s} - Real-time table created")
                else:
                    rt_existing_tables.append(coin)
                    print(f"  • {coin:8s} - Real-time table exists")

            print("-"*80)
            print(f"[SUMMARY] Real-time Tables: {len(rt_new_tables)} created, {len(rt_existing_tables)} existing")
            print(f"[TOTAL] {len(coins)} tables ready for real-time price data")
            print("="*80)

        print("\n[Step 4] Fetching historical data from OKX...")
        print(f"Target: {monitor_config.TARGET_RECORDS_PER_COIN:,} records per coin")
        print(f"Bar size: {monitor_config.BAR_SIZE}")
        print("="*80 + "\n")

        results = self.history_fetcher.fetch_all_coins_history(
            coin_list=coins,
            quote_currency=monitor_config.QUOTE_CURRENCY,
            target_count=monitor_config.TARGET_RECORDS_PER_COIN,
            bar=monitor_config.BAR_SIZE
        )

        print("\n[Step 5] Loading data into memory...")
        print("="*80)
        print("Memory Status: All interaction data in RAM (database for history only)")
        print("-"*80)

        total_memory_records = 0
        for coin in coins:
            inst_id = f"{coin}-{monitor_config.QUOTE_CURRENCY}"

            # Create tracker
            tracker = CoinTracker(
                coin_symbol=coin,
                inst_id=inst_id,
                history_window_hours=monitor_config.HISTORY_WINDOW_HOURS
            )

            # Get record count from database
            db_records = self.table_manager.get_record_count(coin)

            # Load recent data into memory (last 3 hours)
            # In real implementation, you'd load from database here
            # For now, tracker is ready to receive real-time updates

            self.trackers[coin] = tracker
            self.initialized_coins.append(coin)

            memory_records = len(tracker.candles_3h)
            total_memory_records += memory_records

            print(f"  ✓ {coin:8s} - DB: {db_records:6d} records | Memory: {memory_records:4d} records (3h window)")

        print("-"*80)
        print(f"[MEMORY SUMMARY]")
        print(f"  Coin Trackers: {len(self.trackers)}")
        print(f"  Memory Records (3h window): {total_memory_records:,}")
        print(f"  Ready for real-time updates: Yes")
        print("="*80)

        print("\n" + "="*80)
        print("[MonitorManager] Initialization complete!")
        print("="*80 + "\n")

        return {
            'total_coins': len(coins),
            'new_tables': len(new_tables),
            'existing_tables': len(existing_tables),
            'tables_created': len(new_tables) + len(existing_tables),
            'trackers_initialized': len(self.trackers),
            'memory_records': total_memory_records,
            'results': results
        }

    def update_real_time_prices(self):
        """Update real-time prices for all coins"""
        print(f"[MonitorManager] Updating prices for {len(self.trackers)} coins...")

        response = self.okx_client.get_tickers(inst_type="SPOT")

        if response.get('code') != '0':
            print("[ERROR] Failed to fetch tickers")
            return

        tickers = response.get('data', [])

        updates = 0
        for ticker in tickers:
            inst_id = ticker.get('instId', '')

            if not inst_id.endswith(f"-{monitor_config.QUOTE_CURRENCY}"):
                continue

            coin = inst_id.split('-')[0]

            if coin not in self.trackers:
                continue

            last_price = ticker.get('last')
            if not last_price:
                continue

            try:
                price = float(last_price)
                self.trackers[coin].add_price_update(price)
                updates += 1
            except (ValueError, TypeError):
                pass

        print(f"[SUCCESS] Updated {updates} coin prices")

        return updates

    def check_all_alerts(self) -> List[Dict]:
        """
        Check all coins for alert conditions

        Returns:
            List[Dict]: List of alerts
        """
        all_alerts = []

        for coin, tracker in self.trackers.items():
            alerts = tracker.check_alert_conditions(monitor_config.ALERT_THRESHOLDS)

            for alert in alerts:
                alert['coin'] = coin
                alert['inst_id'] = tracker.inst_id
                all_alerts.append(alert)

        return all_alerts

    def get_coin_summary(self, coin_symbol: str) -> Optional[Dict]:
        """Get summary for specific coin"""
        if coin_symbol not in self.trackers:
            return None

        return self.trackers[coin_symbol].get_summary()

    def get_all_summaries(self, limit: Optional[int] = None) -> List[Dict]:
        """Get summaries for all coins"""
        summaries = [
            tracker.get_summary()
            for tracker in self.trackers.values()
        ]

        summaries.sort(key=lambda x: x.get('current_price') or 0, reverse=True)

        if limit:
            summaries = summaries[:limit]

        return summaries

    def get_stats(self) -> Dict:
        """Get monitor manager statistics"""
        return {
            'total_coins': len(self.trackers),
            'initialized_coins': len(self.initialized_coins),
            'running': self.running,
            'rate_limiter': get_rate_limiter().get_stats(),
            'interceptor': self.timestamp_interceptor.get_stats()
        }

    def start_monitoring(self):
        """Start continuous price monitoring (WebSocket or REST polling)"""
        if self.running:
            print("[WARNING] Monitor already running")
            return

        self.running = True

        if self.use_websocket:
            # Start WebSocket monitoring in a separate thread
            print("[MonitorManager] Starting WebSocket monitoring...")
            self.update_thread = threading.Thread(target=self._run_websocket_loop, daemon=True)
            self.update_thread.start()
        else:
            # Start REST API polling
            print("[MonitorManager] Starting REST API polling...")
            self.update_thread = threading.Thread(target=self._run_rest_loop, daemon=True)
            self.update_thread.start()

        print(f"[MonitorManager] Started continuous monitoring (mode: {'WebSocket' if self.use_websocket else 'REST'})")

    def _run_websocket_loop(self):
        """Run WebSocket monitoring in a thread"""
        # Create new event loop for this thread
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

        try:
            # Run async monitoring
            self.loop.run_until_complete(self._websocket_monitoring())
        except Exception as e:
            print(f"[ERROR] WebSocket loop error: {e}")
            # Fallback to REST polling
            print("[MonitorManager] Falling back to REST polling...")
            self.use_websocket = False
            self._run_rest_loop()
        finally:
            self.loop.close()

    async def _websocket_monitoring(self):
        """WebSocket monitoring with real-time updates"""
        print("\n[WebSocket] Initializing WebSocket client...")

        # Create WebSocket client with callback
        def on_ticker_update(inst_id: str, ticker: dict):
            """Handle ticker updates from WebSocket"""
            try:
                coin = inst_id.split('-')[0]
                if coin in self.trackers:
                    price = float(ticker.get('last', 0))
                    if price > 0:
                        # Update in-memory tracker
                        self.trackers[coin].add_price_update(price)

                        # Update real-time statistics display
                        self.stats_display.update_price(coin, price)

                        # Store to real-time database if enabled
                        if self.realtime_manager and monitor_config.ENABLE_REALTIME_STORAGE:
                            # Extract timestamp from ticker (milliseconds)
                            timestamp_ms = int(ticker.get('ts', 0))

                            # Prepare price data
                            price_data = {
                                'timestamp': timestamp_ms,
                                'price': price,
                                'ask_price': ticker.get('askPx'),
                                'bid_price': ticker.get('bidPx'),
                                'last_size': ticker.get('lastSz'),
                                'source': 'websocket'
                            }

                            # Buffer for batch writing (instead of immediate write)
                            if self.batch_db_writer:
                                self.batch_db_writer.buffer_update(coin, timestamp_ms, price_data)
                            else:
                                # Fallback: write immediately if batch writer disabled
                                self.realtime_manager.insert_price(coin, price_data)

            except Exception as e:
                print(f"[ERROR] Ticker update error for {inst_id}: {e}")

        self.ws_client = OKXWebSocketClient(on_message=on_ticker_update)

        # Configure retry interval for blacklisted instruments
        self.ws_client.set_retry_interval(monitor_config.INVALID_INSTRUMENT_RETRY_INTERVAL)

        # Build instrument list
        inst_ids = [
            f"{coin}-{monitor_config.QUOTE_CURRENCY}"
            for coin in self.initialized_coins
        ]

        print(f"[WebSocket] Subscribing to {len(inst_ids)} instruments...")

        # Connect and subscribe
        await self.ws_client.connect_and_subscribe(inst_ids)

        # Start new coin detection if enabled
        if self.new_coin_detection_enabled:
            print(f"[WebSocket] Starting new coin detection (interval: {self.new_coin_check_interval}s)...")
            self.new_coin_check_task = asyncio.create_task(
                self._check_new_coins_loop()
            )

        # Start batch database writer if enabled
        if self.batch_db_writer:
            print("[WebSocket] Starting batch database writer...")
            batch_write_task = asyncio.create_task(
                self.batch_db_writer.start_batch_writing()
            )

        # Start display update loop
        print("[WebSocket] Starting real-time statistics display...")
        self.display_update_task = asyncio.create_task(
            self._realtime_display_loop()
        )

        # Monitor alerts while WebSocket runs
        while self.running:
            try:
                # Check for price alerts
                alerts = self.stats_display.check_alerts()

                if alerts:
                    for alert in alerts:
                        # Print alert to console (with color)
                        self.stats_display.print_alert(alert)

                        # Log alert to file
                        self.alert_logger.log_alert(alert)

                # Also check traditional CoinTracker alerts
                tracker_alerts = self.check_all_alerts()
                if tracker_alerts:
                    for alert in tracker_alerts:
                        print(f"[ALERT] {alert['coin']}: {alert['direction']} {alert['actual']:.2f}% in {alert['window']}")

            except Exception as e:
                print(f"[ERROR] Alert check error: {e}")

            await asyncio.sleep(1)  # Check alerts every second

    def _run_rest_loop(self):
        """Run REST API polling loop"""
        while self.running:
            try:
                self.update_real_time_prices()
                alerts = self.check_all_alerts()

                if alerts:
                    print(f"\n[ALERT] {len(alerts)} trading opportunities detected!")
                    for alert in alerts:
                        print(f"  {alert['coin']}: {alert['direction']} {alert['actual']:.2f}% in {alert['window']}")

            except Exception as e:
                print(f"[ERROR] Update loop error: {e}")

            time.sleep(monitor_config.UPDATE_INTERVAL_MS / 1000.0)

    async def _realtime_display_loop(self):
        """
        Real-time statistics display loop

        Updates console display with latest statistics
        """
        print("[RealtimeDisplay] Started")

        while self.running:
            try:
                # Update display
                self.stats_display.display()

                # Wait 1 second before next update
                await asyncio.sleep(1)

            except Exception as e:
                print(f"[RealtimeDisplay] Error: {e}")

        print("[RealtimeDisplay] Stopped")

    async def _check_new_coins_loop(self):
        """
        Periodically check for new coins and subscribe to them

        This runs when ENABLE_NEW_COIN_DETECTION is True
        """
        print(f"[NewCoinDetection] Started (checking every {self.new_coin_check_interval}s)")

        while self.running:
            try:
                await asyncio.sleep(self.new_coin_check_interval)

                # Fetch latest instruments from OKX
                instruments = self.coin_provider.fetch_instruments()
                new_coins = self.coin_provider.get_coin_list()

                # Find coins that are not yet tracked
                new_coin_symbols = [
                    coin for coin in new_coins
                    if coin not in self.initialized_coins
                ]

                if new_coin_symbols:
                    print(f"\n[NewCoinDetection] 🆕 Found {len(new_coin_symbols)} new coin(s):")
                    for coin in new_coin_symbols:
                        print(f"[NewCoinDetection]    - {coin}")

                    # Add to system
                    await self._add_new_coins(new_coin_symbols)

            except Exception as e:
                print(f"[NewCoinDetection] Error: {e}")

        print("[NewCoinDetection] Stopped")

    async def _add_new_coins(self, coin_symbols: List[str]):
        """
        Add new coins to the monitoring system

        Args:
            coin_symbols: List of new coin symbols to add
        """
        for coin in coin_symbols:
            try:
                inst_id = f"{coin}-{monitor_config.QUOTE_CURRENCY}"

                # Create table for new coin
                if self.table_manager.create_table_if_not_exists(coin):
                    print(f"[NewCoinDetection] ✓ Created table for {coin}")

                # Create real-time table if enabled
                if self.realtime_manager:
                    if self.realtime_manager.create_table_if_not_exists(coin):
                        print(f"[NewCoinDetection] ✓ Created real-time table for {coin}")

                # Create tracker
                tracker = CoinTracker(
                    coin_symbol=coin,
                    inst_id=inst_id,
                    history_window_hours=monitor_config.HISTORY_WINDOW_HOURS
                )

                self.trackers[coin] = tracker
                self.initialized_coins.append(coin)

                print(f"[NewCoinDetection] ✓ Tracker created for {coin}")

                # Subscribe to WebSocket (if running)
                if self.ws_client and self.running:
                    # TODO: Add dynamic subscription to existing WebSocket connection
                    # This requires implementing a method in OKXWebSocketClient
                    # to subscribe to additional channels on the fly
                    print(f"[NewCoinDetection] ⏳ WebSocket subscription for {coin} pending reconnection")

            except Exception as e:
                print(f"[NewCoinDetection] Failed to add {coin}: {e}")

    def stop_monitoring(self):
        """Stop continuous monitoring"""
        self.running = False

        # Stop display update task
        if self.display_update_task:
            self.display_update_task.cancel()
            print("[MonitorManager] Stopped real-time display")

        # Stop new coin detection task
        if self.new_coin_check_task:
            self.new_coin_check_task.cancel()
            print("[MonitorManager] Stopped new coin detection")

        # Stop batch database writer
        if self.batch_db_writer:
            self.batch_db_writer.stop()
            print("[MonitorManager] Stopped batch database writer")

        # Stop WebSocket if running
        if self.ws_client and self.loop:
            print("[MonitorManager] Stopping WebSocket client...")
            try:
                # Schedule stop in the event loop
                asyncio.run_coroutine_threadsafe(self.ws_client.stop(), self.loop)
            except Exception as e:
                print(f"[ERROR] WebSocket stop error: {e}")

        if self.update_thread:
            self.update_thread.join(timeout=5)

        # Print final statistics
        print("\n" + "="*80)
        print("Final Statistics")
        print("="*80)

        # Stats display summary
        stats = self.stats_display.get_stats()
        print(f"Total coins tracked: {stats['total_coins']}")

        # Alert logger summary
        alert_stats = self.alert_logger.get_stats()
        print(f"Total alerts logged: {alert_stats['total_alerts']}")
        print(f"  - 5s alerts: {alert_stats['alerts_5s']}")
        print(f"  - 30s alerts: {alert_stats['alerts_30s']}")
        print(f"  - 1m alerts: {alert_stats['alerts_1m']}")
        print(f"Alert log file: {alert_stats['today_log']}")

        # Batch writer summary
        if self.batch_db_writer:
            batch_stats = self.batch_db_writer.get_stats()
            print(f"\nDatabase writes:")
            print(f"  - Total buffered: {batch_stats['total_buffered']:,}")
            print(f"  - Total written: {batch_stats['total_written']:,}")
            print(f"  - Batches executed: {batch_stats['batches_executed']}")
            print(f"  - Pending writes: {batch_stats['buffer_size']}")

        print("="*80 + "\n")

        print("[MonitorManager] Stopped monitoring")


# Global instance
_global_manager = None


def get_monitor_manager() -> MonitorManager:
    """Get global monitor manager instance"""
    global _global_manager

    if _global_manager is None:
        _global_manager = MonitorManager()

    return _global_manager
