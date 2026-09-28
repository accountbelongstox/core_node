#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Monitor Configuration - Centralized Configuration

All configuration for the OKX price monitor system.
All data directories use system_paths for proper path mapping.
"""

from typing import Dict, List
from pathlib import Path
from pycore.pyfoundations.system_paths import get_app_cache_dir, get_app_data_dir


class MonitorConfig:
    """
    Centralized configuration for OKX Price Monitor

    All parameters configurable in one place.
    """

    # === Database Configuration ===
    DATABASE_NAME = "okx_history"
    # Use system data directory (.core_node/data/okx_price_monitor/)
    DATABASE_DIR = get_app_data_dir() / "okx_price_monitor" / "database"

    # === Cache Configuration ===
    # Use system cache directory (.core_node/cache/okx_price_monitor/)
    CACHE_DIR = get_app_cache_dir() / "okx_price_monitor"

    # === Fetching Configuration ===
    TARGET_RECORDS_PER_COIN = 10000
    BAR_SIZE = "1m"  # Use finest granularity (1 minute)
    BATCH_SIZE = 100

    # === Real-time Price Storage ===
    ENABLE_REALTIME_STORAGE = True  # Store WebSocket price updates
    REALTIME_SAMPLING_INTERVAL_MS = 100  # Minimum 100ms between samples
    REALTIME_RETENTION_DAYS = 7  # Keep 7 days of real-time data

    # === Rate Limiting ===
    RATE_LIMIT_REQUESTS = 20
    RATE_LIMIT_WINDOW = 3.0  # seconds

    # === Monitoring Configuration ===
    HISTORY_WINDOW_HOURS = 3  # Track last 3 hours
    UPDATE_INTERVAL_MS = 1000  # 1 second

    # === Price Change Thresholds ===
    CHANGE_WINDOWS = {
        '30s': 30,      # 30 seconds
        '1m': 60,       # 1 minute
        '2m': 120,      # 2 minutes
    }

    # === Trading Alert Thresholds ===
    ALERT_THRESHOLDS = {
        '30s': 1.0,     # 1% in 30 seconds
        '1m': 2.0,      # 2% in 1 minute
        '2m': 3.0,      # 3% in 2 minutes
    }

    # === WebSocket Configuration ===
    USE_WEBSOCKET = True  # Use WebSocket for real-time updates (faster than REST polling)
    WS_PUBLIC_URL = "wss://ws.okx.com:8443/ws/v5/public"
    WS_PING_INTERVAL = 20  # Send ping every 20 seconds
    WS_PING_TIMEOUT = 10   # Wait 10 seconds for pong
    WS_RECONNECT_DELAY = 5  # Wait 5 seconds before reconnecting
    WS_MAX_CHANNELS_PER_CONNECTION = 240  # OKX limit

    # === Dynamic Coin Detection ===
    ENABLE_NEW_COIN_DETECTION = False  # Enable automatic new coin detection (default: disabled)
    NEW_COIN_CHECK_INTERVAL = 1  # Check for new coins every N seconds (when enabled)
    INVALID_INSTRUMENT_RETRY_INTERVAL = 3600  # Retry invalid instruments after N seconds (1 hour)

    # === Web Server Configuration ===
    WEB_HOST = "0.0.0.0"
    WEB_PORT = 58888
    DEBUG_MODE = True

    # === Startup Mode ===
    # Options: "web", "console", "fetch", "init"
    # web: Start web server with UI (recommended)
    # console: Console-based monitoring only
    # fetch: Fetch historical data and exit
    # init: Initialize system and exit
    STARTUP_MODE = "web"

    # === Static Files ===
    WEB_DIR = "pyapps/okx_price_monitor/web"

    # === Quote Currency ===
    QUOTE_CURRENCY = "USDT"

    # === Display Configuration ===
    MAX_COINS_DISPLAY = 100
    TREND_THRESHOLD = 0.1  # 0.1% minimum for trend detection

    # === Cache Configuration ===
    CACHE_TTL = 300  # 5 minutes

    @classmethod
    def get_all(cls) -> Dict:
        """Get all configuration as dictionary"""
        return {
            key: value
            for key, value in cls.__dict__.items()
            if not key.startswith('_') and not callable(value)
        }

    @classmethod
    def get(cls, key: str, default=None):
        """Get specific configuration value"""
        return getattr(cls, key, default)

    @classmethod
    def set(cls, key: str, value):
        """Set configuration value"""
        setattr(cls, key, value)

    @classmethod
    def update(cls, config_dict: Dict):
        """Update multiple configuration values"""
        for key, value in config_dict.items():
            if hasattr(cls, key):
                setattr(cls, key, value)


# Global instance
monitor_config = MonitorConfig()
