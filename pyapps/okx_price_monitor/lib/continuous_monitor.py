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


class ContinuousMonitor:
    """
    Continuous Price Monitor

    Monitors prices continuously with configurable fetch interval.
    """

    def __init__(self, mode1_monitor, fetch_interval=1000, max_history=1000, save_to_file=True):
        self.mode1_monitor = mode1_monitor
        self.fetch_interval = fetch_interval / 1000.0
        self.max_history = max_history
        self.save_to_file = save_to_file

        self.is_running = False
        self.is_initialized = False
        self.page_id = None
        self.price_history = []
        self.last_fetch_time = None
        self.last_fetch_data = None
        self.fetch_count = 0

        self.monitor_thread = None
        self.stop_event = threading.Event()

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
        Fetch price data once
        """
        if not self.page_id:
            ColorPrint.red("[ContinuousMonitor] Page not initialized")
            return

        price_data = self.mode1_monitor.fetch_prices(self.page_id)

        if not price_data:
            ColorPrint.red("[ContinuousMonitor] Failed to fetch price data")
            return

        fetch_time = datetime.now().isoformat()
        self.last_fetch_time = fetch_time
        self.last_fetch_data = price_data
        self.fetch_count += 1

        self.price_history.append({
            'timestamp': fetch_time,
            'data': price_data
        })

        if len(self.price_history) > self.max_history:
            self.price_history.pop(0)

        ColorPrint.green(f"[ContinuousMonitor] Fetch #{self.fetch_count} at {fetch_time}")

        if self.save_to_file:
            self._save_to_file(fetch_time, price_data)

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
            'fetch_count': self.fetch_count
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
            'fetch_count': self.fetch_count,
            'last_fetch_time': self.last_fetch_time,
            'history_count': len(self.price_history),
            'max_history': self.max_history,
            'save_to_file': self.save_to_file
        }
