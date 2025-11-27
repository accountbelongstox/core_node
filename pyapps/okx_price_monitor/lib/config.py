#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX Price Monitor Configuration Center

Centralized configuration for all monitoring parameters.
"""


class OKXMonitorConfig:
    """
    Configuration Center for OKX Price Monitor

    All configurable parameters are centralized here.
    """

    # ============================================================
    # RPC Configuration
    # ============================================================
    RPC_BASE_URL = 'http://127.0.0.1:58000'

    # ============================================================
    # Web Server Configuration
    # ============================================================
    WEB_PORT = 58888
    WEB_HOST = '0.0.0.0'

    # ============================================================
    # Page Configuration
    # ============================================================
    # Pages to visit for collecting URLs (market prices)
    BASE_PAGES = [f'https://www.okx.com/markets/prices/page/{i}' for i in range(1, 15)]

    # Deprecated: single page URL
    BASE_PAGE_URL = BASE_PAGES[0]

    # ============================================================
    # Fetch Configuration
    # ============================================================
    # Fetch interval in milliseconds (1000 = 1 second)
    FETCH_INTERVAL_MS = 1000

    # Fetch mode: 'intercepted', 'single_url', 'concurrent', or 'sequential'
    # - 'intercepted': Use backend-intercepted URLs from multiple pages (recommended)
    # - 'single_url': All currencies in one URL request (fastest, most efficient)
    # - 'concurrent': Multiple batches fetched in parallel (good balance)
    # - 'sequential': Batches fetched one by one (slowest, most reliable)
    FETCH_MODE = 'intercepted'

    # Batch size for fetching currencies (only used in 'concurrent' and 'sequential' modes)
    # None = fetch all at once
    # Set to 25, 50, 100, etc. for batch fetching
    # All batches complete = 1 tick
    BATCH_SIZE = 25  # Fetch 25 currencies per request, all batches = 1 tick

    # Delay between batch requests in milliseconds (only used in 'sequential' mode)
    BATCH_DELAY_MS = 100

    # Concurrency level for concurrent mode (only used in 'concurrent' mode)
    CONCURRENCY = 10

    # ============================================================
    # API Configuration
    # ============================================================
    # Coins API endpoint
    COINS_API_URL = 'https://www.okx.com/priapi/v5/public/coins'

    # Price trend API endpoint template
    PRICE_TREND_API_URL = 'https://www.okx.com/priapi/v5/market/batch-currency-trend'

    # Default period for price trends
    DEFAULT_PERIOD = '24H'

    # ============================================================
    # Cache Configuration
    # ============================================================
    # Coin list cache TTL in seconds
    COIN_CACHE_TTL = 3600

    # ============================================================
    # History Configuration
    # ============================================================
    # Maximum number of price history records to keep
    MAX_HISTORY = 1000

    # Whether to save price data to files
    SAVE_TO_FILE = True

    # ============================================================
    # Trading Analyzer Thresholds
    # ============================================================
    # Buy signal threshold (negative %)
    BUY_DIP_THRESHOLD = -5.0

    # Sell signal threshold (positive %)
    SELL_PEAK_THRESHOLD = 5.0

    # Strong buy threshold (negative %)
    STRONG_BUY_THRESHOLD = -10.0

    # Strong sell threshold (positive %)
    STRONG_SELL_THRESHOLD = 10.0

    # ============================================================
    # Price Change Alert Thresholds
    # ============================================================
    # 1 minute change threshold (%)
    ALERT_1MIN_THRESHOLD = 2.0

    # 30 seconds change threshold (%)
    ALERT_30SEC_THRESHOLD = 1.0

    # ============================================================
    # Batch Request Configuration
    # ============================================================
    # Number of URL groups to split intercepted URLs into
    URL_BATCH_GROUPS = 2

    # ============================================================
    # Database Configuration
    # ============================================================
    # Hours of historical data to load on startup
    HISTORY_HOURS = 3

    # Database name for OKX price data
    DATABASE_NAME = "okx"

    # ============================================================
    # Trading Alert Thresholds
    # ============================================================
    # 30 seconds change threshold for alert (%)
    ALERT_CHANGE_30S_THRESHOLD = 1.0

    # 1 minute change threshold for alert (%)
    ALERT_CHANGE_1MIN_THRESHOLD = 2.0

    # 2 minutes change threshold for alert (%)
    ALERT_CHANGE_2MIN_THRESHOLD = 3.0

    # ============================================================
    # Request Configuration
    # ============================================================
    # Request timeout in milliseconds
    REQUEST_TIMEOUT = 30000

    # Wait until condition for page loading
    WAIT_UNTIL = 'networkidle2'

    @classmethod
    def get_batch_size(cls, total_coins):
        """
        Get effective batch size

        Args:
            total_coins (int): Total number of coins

        Returns:
            int: Effective batch size
        """
        if cls.BATCH_SIZE is None or cls.BATCH_SIZE <= 0:
            return total_coins
        return min(cls.BATCH_SIZE, total_coins)

    @classmethod
    def get_fetch_interval_seconds(cls):
        """
        Get fetch interval in seconds

        Returns:
            float: Fetch interval in seconds
        """
        return cls.FETCH_INTERVAL_MS / 1000.0

    @classmethod
    def get_batch_delay_seconds(cls):
        """
        Get batch delay in seconds

        Returns:
            float: Batch delay in seconds
        """
        return cls.BATCH_DELAY_MS / 1000.0

    @classmethod
    def print_config(cls):
        """
        Print current configuration
        """
        from pycore.pyfoundations.color_print import ColorPrint

        ColorPrint.green("\n" + "=" * 60)
        ColorPrint.green("OKX MONITOR CONFIGURATION")
        ColorPrint.green("=" * 60)
        ColorPrint.blue(f"  RPC Base URL: {cls.RPC_BASE_URL}")
        ColorPrint.blue(f"  Web Server: http://{cls.WEB_HOST}:{cls.WEB_PORT}")
        ColorPrint.blue(f"  Base Pages: {len(cls.BASE_PAGES)} pages (page 1-{len(cls.BASE_PAGES)})")
        ColorPrint.blue(f"  Fetch Mode: {cls.FETCH_MODE.upper()}")
        ColorPrint.blue(f"  Fetch Interval: {cls.FETCH_INTERVAL_MS}ms")
        if cls.FETCH_MODE == 'intercepted':
            ColorPrint.blue(f"  URL Interception: Enabled ({len(cls.BASE_PAGES)} pages)")
        elif cls.FETCH_MODE != 'single_url':
            ColorPrint.blue(f"  Batch Size: {cls.BATCH_SIZE or 'ALL (no batching)'}")
            if cls.FETCH_MODE == 'sequential':
                ColorPrint.blue(f"  Batch Delay: {cls.BATCH_DELAY_MS}ms")
            elif cls.FETCH_MODE == 'concurrent':
                ColorPrint.blue(f"  Concurrency: {cls.CONCURRENCY}")
        ColorPrint.blue(f"  Coin Cache TTL: {cls.COIN_CACHE_TTL}s")
        ColorPrint.blue(f"  Max History: {cls.MAX_HISTORY}")
        ColorPrint.blue(f"  Save to File: {cls.SAVE_TO_FILE}")
        ColorPrint.green("  Database Configuration:")
        ColorPrint.blue(f"    Database Name: {cls.DATABASE_NAME}")
        ColorPrint.blue(f"    History Hours: {cls.HISTORY_HOURS}h")
        ColorPrint.green("  Trading Thresholds:")
        ColorPrint.blue(f"    Buy Dip: {cls.BUY_DIP_THRESHOLD}%")
        ColorPrint.blue(f"    Sell Peak: {cls.SELL_PEAK_THRESHOLD}%")
        ColorPrint.blue(f"    Strong Buy: {cls.STRONG_BUY_THRESHOLD}%")
        ColorPrint.blue(f"    Strong Sell: {cls.STRONG_SELL_THRESHOLD}%")
        ColorPrint.green("  Alert Thresholds:")
        ColorPrint.blue(f"    30 Seconds: {cls.ALERT_CHANGE_30S_THRESHOLD}%")
        ColorPrint.blue(f"    1 Minute: {cls.ALERT_CHANGE_1MIN_THRESHOLD}%")
        ColorPrint.blue(f"    2 Minutes: {cls.ALERT_CHANGE_2MIN_THRESHOLD}%")
        ColorPrint.green("=" * 60)


# Global config instance
config = OKXMonitorConfig()
