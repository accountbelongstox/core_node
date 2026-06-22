#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Core Configuration

Centralized configuration for OKX Price Monitor.
No external project dependencies allowed in this file.
"""


class OKXAPIConfig:
    """
    OKX API Configuration
    
    All configurable parameters centralized here.
    This is the core configuration layer with no external dependencies.
    """
    
    # ============================================================
    # OKX API Configuration
    # ============================================================
    OKX_API_BASE_URL = "https://www.okx.com"
    OKX_API_V5_BASE = "https://www.okx.com/api/v5"
    
    # Market Data Endpoints
    TICKERS_ENDPOINT = "/market/tickers"
    INSTRUMENTS_ENDPOINT = "/public/instruments"
    TICKER_ENDPOINT = "/market/ticker"
    ORDERBOOK_ENDPOINT = "/market/books"
    TRADES_ENDPOINT = "/market/trades"
    CANDLES_ENDPOINT = "/market/candles"
    
    # Private API Endpoints (for future use)
    PRIAPI_BASE = "https://www.okx.com/priapi/v5"
    COINS_API_URL = f"{PRIAPI_BASE}/public/coins"
    PRICE_TREND_API_URL = f"{PRIAPI_BASE}/market/batch-currency-trend"
    
    # Instrument Types
    INST_TYPE_SPOT = "SPOT"
    INST_TYPE_SWAP = "SWAP"
    INST_TYPE_FUTURES = "FUTURES"
    INST_TYPE_OPTION = "OPTION"
    
    # Default instrument type for monitoring
    DEFAULT_INST_TYPE = INST_TYPE_SPOT
    
    # ============================================================
    # Request Configuration
    # ============================================================
    REQUEST_TIMEOUT = 30
    MAX_RETRIES = 3
    RETRY_DELAY = 1.0
    
    # ============================================================
    # Cache Configuration
    # ============================================================
    COIN_LIST_CACHE_TTL = 3600
    TICKER_CACHE_TTL = 1
    
    # ============================================================
    # Monitoring Configuration
    # ============================================================
    FETCH_INTERVAL_MS = 1000
    MAX_HISTORY_RECORDS = 1000
    SAVE_TO_FILE = True
    
    # Initialization mode
    PRELOAD_ALL_INSTRUMENTS = False  # Set to True to load all instruments on startup
    MONITOR_SPECIFIC_PAIRS = [       # Specify pairs to monitor (empty = all USDT pairs)
        "BTC-USDT",
        "ETH-USDT",
        "SOL-USDT",
    ]
    
    # ============================================================
    # Database Configuration
    # ============================================================
    DATABASE_NAME = "okx"
    HISTORY_HOURS = 3
    
    # ============================================================
    # Trading Thresholds
    # ============================================================
    BUY_DIP_THRESHOLD = -5.0
    SELL_PEAK_THRESHOLD = 5.0
    STRONG_BUY_THRESHOLD = -10.0
    STRONG_SELL_THRESHOLD = 10.0
    
    # ============================================================
    # Alert Thresholds
    # ============================================================
    ALERT_CHANGE_30S_THRESHOLD = 1.0
    ALERT_CHANGE_1MIN_THRESHOLD = 2.0
    ALERT_CHANGE_2MIN_THRESHOLD = 3.0
    
    # ============================================================
    # Web Server Configuration
    # ============================================================
    WEB_PORT = 58888
    WEB_HOST = "0.0.0.0"
    
    # ============================================================
    # RPC Configuration (for RPC v2 grid display)
    # ============================================================
    RPC_BASE_URL = "http://127.0.0.1:58000"
    
    # ============================================================
    # OKX API Authentication (Optional)
    # ============================================================
    # API credentials:
    #   - API Key: from .secret_keys/.secret_ignore/LOCAL_TEST_PASSWORD_1
    #   - Secret Key: from .secret_keys/.secret_ignore/LOCAL_TEST_API_KEY_1
    #   - Passphrase: hardcoded below (set when creating API key on OKX)
    USE_AUTH = False  # Set to True to enable private API calls
    OKX_PASSPHRASE = "YourPassphraseHere"  # Change this to your actual passphrase
    
    # ============================================================
    # Batch Configuration
    # ============================================================
    BATCH_SIZE = 100
    CONCURRENCY = 10
    
    # ============================================================
    # File Paths
    # ============================================================
    CACHE_DIR_NAME = "okx_price_monitor"
    CACHE_SUBDIR_NAME = "cache"
    
    @classmethod
    def get_api_url(cls, endpoint, params=None):
        """
        Build full API URL
        
        Args:
            endpoint (str): API endpoint path
            params (dict): Query parameters
            
        Returns:
            str: Full API URL
        """
        url = f"{cls.OKX_API_V5_BASE}{endpoint}"
        
        if params:
            param_str = "&".join([f"{k}={v}" for k, v in params.items()])
            url = f"{url}?{param_str}"
            
        return url
    
    @classmethod
    def get_fetch_interval_seconds(cls):
        """Get fetch interval in seconds"""
        return cls.FETCH_INTERVAL_MS / 1000.0
    
    @classmethod
    def print_config(cls):
        """Print current configuration"""
        print("\n" + "=" * 80)
        print("OKX PRICE MONITOR CONFIGURATION (API Mode)")
        print("=" * 80)
        print(f"  API Base URL: {cls.OKX_API_V5_BASE}")
        print(f"  Default Instrument Type: {cls.DEFAULT_INST_TYPE}")
        print(f"  Fetch Interval: {cls.FETCH_INTERVAL_MS}ms")
        print(f"  Preload All Instruments: {cls.PRELOAD_ALL_INSTRUMENTS}")
        if cls.MONITOR_SPECIFIC_PAIRS:
            print(f"  Monitoring: {len(cls.MONITOR_SPECIFIC_PAIRS)} specific pairs")
        else:
            print(f"  Monitoring: Default pairs")
        print(f"  Request Timeout: {cls.REQUEST_TIMEOUT}s")
        print(f"  Max Retries: {cls.MAX_RETRIES}")
        print(f"  Database: {cls.DATABASE_NAME}")
        print("  Trading Thresholds:")
        print(f"    Buy Dip: {cls.BUY_DIP_THRESHOLD}%")
        print(f"    Sell Peak: {cls.SELL_PEAK_THRESHOLD}%")
        print("  Alert Thresholds:")
        print(f"    1 Minute: {cls.ALERT_CHANGE_1MIN_THRESHOLD}%")
        print("=" * 80)


# Global config instance
config = OKXAPIConfig()

