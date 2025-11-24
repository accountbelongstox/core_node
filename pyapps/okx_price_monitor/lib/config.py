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
    # Page Configuration
    # ============================================================
    BASE_PAGE_URL = 'https://www.okx.com/markets/prices/page/15'

    # ============================================================
    # Fetch Configuration
    # ============================================================
    # Fetch interval in milliseconds (1000 = 1 second)
    FETCH_INTERVAL_MS = 1000

    # Batch size for fetching currencies
    # None = fetch all at once (default)
    # Set to 25, 50, 100, etc. for batch fetching
    # All batches complete = 1 tick
    BATCH_SIZE = None

    # Delay between batch requests in milliseconds
    BATCH_DELAY_MS = 100

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
        ColorPrint.blue(f"  Base Page URL: {cls.BASE_PAGE_URL}")
        ColorPrint.blue(f"  Fetch Interval: {cls.FETCH_INTERVAL_MS}ms")
        ColorPrint.blue(f"  Batch Size: {cls.BATCH_SIZE or 'ALL (no batching)'}")
        ColorPrint.blue(f"  Batch Delay: {cls.BATCH_DELAY_MS}ms")
        ColorPrint.blue(f"  Coin Cache TTL: {cls.COIN_CACHE_TTL}s")
        ColorPrint.blue(f"  Max History: {cls.MAX_HISTORY}")
        ColorPrint.blue(f"  Save to File: {cls.SAVE_TO_FILE}")
        ColorPrint.green("  Trading Thresholds:")
        ColorPrint.blue(f"    Buy Dip: {cls.BUY_DIP_THRESHOLD}%")
        ColorPrint.blue(f"    Sell Peak: {cls.SELL_PEAK_THRESHOLD}%")
        ColorPrint.blue(f"    Strong Buy: {cls.STRONG_BUY_THRESHOLD}%")
        ColorPrint.blue(f"    Strong Sell: {cls.STRONG_SELL_THRESHOLD}%")
        ColorPrint.green("=" * 60)


# Global config instance
config = OKXMonitorConfig()
