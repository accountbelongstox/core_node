#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Continuous Price Monitor

Implements continuous price monitoring with periodic data fetching.
"""

import time
import json
import threading
from datetime import datetime
from pathlib import Path
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pygvar import PROJECT_ROOT
from pyapps.okx_price_monitor.lib.config import config


class ContinuousMonitor:
    """
    Continuous Price Monitor

    Monitors prices continuously with configurable fetch interval.
    All batches complete = 1 tick.
    """

    def __init__(self, mode1_monitor, coin_data_manager=None, fetch_interval=None, max_history=None, save_to_file=None, fetch_mode=None, concurrency=None):
        self.mode1_monitor = mode1_monitor
        self.coin_data_manager = coin_data_manager

        # Use config values if not specified
        self.fetch_interval = (fetch_interval or config.FETCH_INTERVAL_MS) / 1000.0
        self.max_history = max_history if max_history is not None else config.MAX_HISTORY
        self.save_to_file = save_to_file if save_to_file is not None else config.SAVE_TO_FILE
        self.fetch_mode = fetch_mode or config.FETCH_MODE
        self.concurrency = concurrency or config.CONCURRENCY

        self.is_running = False
        self.is_initialized = False
        self.page_id = None
        self.price_history = []
        self.last_fetch_time = None
        self.last_fetch_data = None
        self.tick_count = 0

        self.monitor_thread = None
        self.stop_event = threading.Event()

        # Trading alert thresholds from config
        self.alert_threshold_30s = config.ALERT_CHANGE_30S_THRESHOLD
        self.alert_threshold_1min = config.ALERT_CHANGE_1MIN_THRESHOLD
        self.alert_threshold_2min = config.ALERT_CHANGE_2MIN_THRESHOLD

    def initialize(self, page_id):
        """
        Initialize monitor with page ID

        Args:
            page_id (str): Page ID from browser manager

        Returns:
            bool: Success status
        """
        self.page_id = page_id
        self.is_initialized = True
        ColorPrint.green(f"[ContinuousMonitor] Initialized with pageId: {page_id}")
        return True

    def _fetch_worker(self):
        """
        Worker thread for continuous fetching
        """
        ColorPrint.green(f"[ContinuousMonitor] Worker started (interval: {self.fetch_interval}s)")

        while not self.stop_event.is_set():
            try:
                self._fetch_once()

                time.sleep(self.fetch_interval)

            except Exception as error:
                ColorPrint.red(f"[ContinuousMonitor] Fetch error: {error}")
                time.sleep(self.fetch_interval)

        ColorPrint.yellow("[ContinuousMonitor] Worker stopped")

    def _fetch_once(self):
        """
        Fetch price data once (one complete tick = all batches)
        """
        if not self.page_id:
            ColorPrint.red("[ContinuousMonitor] Page not initialized")
            return

        # Select fetch method based on mode
        if self.fetch_mode == 'intercepted':
            price_data = self.mode1_monitor.fetch_from_intercepted_urls(self.page_id)
        elif self.fetch_mode == 'single_url':
            price_data = self.mode1_monitor.fetch_all_single_url(self.page_id)
        elif self.fetch_mode == 'concurrent':
            price_data = self.mode1_monitor.fetch_all_batches_concurrent(self.page_id, self.concurrency)
        elif self.fetch_mode == 'sequential':
            price_data = self.mode1_monitor.fetch_all_batches(self.page_id)
        else:
            ColorPrint.red(f"[ContinuousMonitor] Unknown fetch mode: {self.fetch_mode}")
            return

        if not price_data:
            ColorPrint.red("[ContinuousMonitor] Failed to fetch price data")
            return

        fetch_time = datetime.now().isoformat()
        timestamp_ms = int(datetime.now().timestamp() * 1000)
        self.last_fetch_time = fetch_time
        self.last_fetch_data = price_data
        self.tick_count += 1

        self.price_history.append({
            'timestamp': fetch_time,
            'tick': self.tick_count,
            'data': price_data
        })

        if len(self.price_history) > self.max_history:
            self.price_history.pop(0)

        data_count = len(price_data.get('data', [])) if isinstance(price_data, dict) else 0
        ColorPrint.green(f"[ContinuousMonitor] Tick #{self.tick_count} complete at {fetch_time} ({data_count} records)")

        # Update database with price data
        if self.coin_data_manager and self.coin_data_manager.is_initialized():
            self._update_database(price_data, timestamp_ms)

        # Check for trading alerts
        if self.coin_data_manager and self.coin_data_manager.is_initialized():
            self._check_trading_alerts()

        if self.save_to_file:
            self._save_to_file(fetch_time, price_data)

    def _update_database(self, price_data, timestamp_ms):
        """
        Update database with price data

        Args:
            price_data (dict): Price data from fetch
            timestamp_ms (int): Timestamp in milliseconds
        """
        try:
            # Extract coin prices from price_data
            data_list = price_data.get('data', [])

            if not data_list:
                return

            # Prepare batch updates
            batch_updates = {}

            for coin_data in data_list:
                coin_symbol = coin_data.get('currency', '').upper()
                if not coin_symbol:
                    continue

                # Prepare price data for database
                price_info = {
                    'timestamp_ms': timestamp_ms,
                    'timestamp': datetime.fromtimestamp(timestamp_ms / 1000).isoformat(),
                    'price': float(coin_data.get('price', 0)),
                    'price_change_24h': float(coin_data.get('priceChange', 0)),
                    'volume_24h': float(coin_data.get('volume24h', 0)) if coin_data.get('volume24h') else None,
                    'market_cap': float(coin_data.get('marketCap', 0)) if coin_data.get('marketCap') else None,
                    'raw_data': json.dumps(coin_data)
                }

                batch_updates[coin_symbol] = price_info

            # Batch update all coins
            results = self.coin_data_manager.batch_update_prices(batch_updates)

            # Count successful updates
            success_count = sum(1 for v in results.values() if v)
            duplicate_count = len(results) - success_count

            if success_count > 0:
                ColorPrint.blue(f"[ContinuousMonitor] DB: Saved {success_count} records, Skipped {duplicate_count} duplicates")

        except Exception as e:
            ColorPrint.red(f"[ContinuousMonitor] Database update error: {e}")

    def _check_trading_alerts(self):
        """
        Check for trading alerts across all coins
        """
        try:
            alerts = self.coin_data_manager.check_all_trading_alerts(
                threshold_30s=self.alert_threshold_30s,
                threshold_1min=self.alert_threshold_1min,
                threshold_2min=self.alert_threshold_2min
            )

            if alerts:
                ColorPrint.yellow("\n" + "=" * 70)
                ColorPrint.yellow("TRADING ALERTS")
                ColorPrint.yellow("=" * 70)

                for alert in alerts:
                    coin_symbol = alert['coin_symbol']
                    current_price = alert['current_price']

                    ColorPrint.green(f"\n  {coin_symbol}: ${current_price}")

                    for alert_info in alert['alerts']:
                        period = alert_info['period']
                        change = alert_info['change']
                        direction = alert_info['direction']
                        threshold = alert_info['threshold']

                        if direction == 'up':
                            ColorPrint.green(f"    {period}: +{change:.2f}% (threshold: {threshold}%)")
                        else:
                            ColorPrint.red(f"    {period}: {change:.2f}% (threshold: -{threshold}%)")

                ColorPrint.yellow("=" * 70 + "\n")

        except Exception as e:
            ColorPrint.red(f"[ContinuousMonitor] Alert check error: {e}")

    def _save_to_file(self, timestamp, data):
        """
        Save price data to file

        Args:
            timestamp (str): Timestamp
            data (dict): Price data
        """
        try:
            app_dir_path = Path(PROJECT_ROOT) / 'public' / 'uploads' / 'okx_price_monitor'
            app_dir_path.mkdir(parents=True, exist_ok=True)

            filename = f"price_data_{timestamp.replace(':', '-').replace('.', '-')}.json"
            filepath = app_dir_path / filename

            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump({
                    'timestamp': timestamp,
                    'data': data
                }, f, indent=2, ensure_ascii=False)

            ColorPrint.blue(f"[ContinuousMonitor] Saved to: {filepath}")

        except Exception as error:
            ColorPrint.red(f"[ContinuousMonitor] Failed to save file: {error}")

    def start(self):
        """
        Start continuous monitoring
        """
        if self.is_running:
            ColorPrint.yellow("[ContinuousMonitor] Already running")
            return

        if not self.is_initialized:
            ColorPrint.red("[ContinuousMonitor] Not initialized. Call initialize() first")
            return

        self.is_running = True
        self.stop_event.clear()

        ColorPrint.green(f"[ContinuousMonitor] Starting continuous monitoring (interval: {self.fetch_interval}s)")

        self.monitor_thread = threading.Thread(target=self._fetch_worker, daemon=True)
        self.monitor_thread.start()

        ColorPrint.green("[ContinuousMonitor] Monitor thread started")

    def stop(self):
        """
        Stop continuous monitoring
        """
        if not self.is_running:
            ColorPrint.yellow("[ContinuousMonitor] Not running")
            return

        ColorPrint.yellow("[ContinuousMonitor] Stopping monitor...")
        self.is_running = False
        self.stop_event.set()

        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
            self.monitor_thread = None

        ColorPrint.green("[ContinuousMonitor] Monitor stopped")

    def get_latest_data(self):
        """
        Get latest fetch result

        Returns:
            dict: Latest data
        """
        return {
            'timestamp': self.last_fetch_time,
            'data': self.last_fetch_data,
            'is_running': self.is_running,
            'tick_count': self.tick_count
        }

    def get_history(self, limit=100):
        """
        Get price history

        Args:
            limit (int): Maximum number of records to return

        Returns:
            list: Price history
        """
        history_limit = min(limit, len(self.price_history))
        return self.price_history[-history_limit:]

    def get_status(self):
        """
        Get monitor status

        Returns:
            dict: Status information
        """
        return {
            'is_running': self.is_running,
            'is_initialized': self.is_initialized,
            'page_id': self.page_id,
            'fetch_interval': self.fetch_interval,
            'tick_count': self.tick_count,
            'last_fetch_time': self.last_fetch_time,
            'history_count': len(self.price_history),
            'max_history': self.max_history,
            'save_to_file': self.save_to_file,
            'database_enabled': self.coin_data_manager is not None and self.coin_data_manager.is_initialized()
        }
