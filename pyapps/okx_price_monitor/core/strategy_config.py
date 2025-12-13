#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Strategy Configuration - Trading Strategy Parameters

Configurable parameters for backtesting and live trading strategies.
"""


class StrategyConfig:
    """
    Trading Strategy Configuration
    """

    # ==================== Run Mode Configuration ====================
    # Run mode: 'TEST' or 'LIVE'
    # TEST: Replay historical data from 3 days ago (backtest)
    # LIVE: Start from current time (paper trading with virtual money)
    RUN_MODE = 'TEST'  # Default: TEST mode

    # ==================== Data Initialization Configuration ====================
    # Historical data initialization (days before start)
    HISTORY_INIT_DAYS = 3  # At least 3 days before initialization

    # Start backtesting from N days ago (TEST mode only)
    BACKTEST_START_DAYS = 3  # Start scanning from 3 days ago

    # Data granularity (bar size)
    # Note: Due to OKX API limitations, 1m bars only provide 1 day of history
    #       We use 5m bars to get 3+ days for initialization
    CANDLE_BAR = '5m'  # 5-minute bars (covers 5 days of history)


    # ==================== 24-Hour Analysis Window Configuration ====================
    # Time window for attribute calculation (hours)
    ANALYSIS_WINDOW_HOURS = 24  # 24 hour window

    # Number of time periods to split the window into
    TIME_PERIODS_COUNT = 4  # Split 24 hours into 4 periods

    # Each period duration (auto-calculated)
    @property
    def PERIOD_DURATION_HOURS(self):
        return self.ANALYSIS_WINDOW_HOURS // self.TIME_PERIODS_COUNT  # 6 hours per period


    # ==================== Coin Selection Criteria ====================
    # Coin selection criteria for trading

    # Allowed trend types (overall trend)
    ALLOWED_TRENDS = [
        'stable',      # Stable
        'upward',      # Upward
        # 'downward',  # Downward (not selected)
        # 'up_then_down',    # Up then down (not selected)
        # 'down_then_up',    # Down then up (optional)
    ]

    # Minimum volatility threshold (price range as % of average)
    # Min volatility threshold (high-low / average price)
    MIN_VOLATILITY_PERCENT = 0.5  # 0.5%

    # Maximum volatility threshold
    # Max volatility threshold
    MAX_VOLATILITY_PERCENT = 10.0  # 10%


    # ==================== Trading Signal Configuration ====================
    # Buy signal: 1% rise in 60 seconds
    BUY_SIGNAL_WINDOW_SECONDS = 60  # 60 second window
    BUY_SIGNAL_THRESHOLD_PERCENT = 1.0  # Rise more than 1%

    # Sell signal: Sell after 5 minutes
    SELL_AFTER_MINUTES = 5  # Sell after 5 minutes

    # Stop loss (optional)
    STOP_LOSS_PERCENT = -3.0  # Stop loss at -3% (optional)
    ENABLE_STOP_LOSS = False  # Whether to enable stop loss

    # Take profit (optional)
    TAKE_PROFIT_PERCENT = 5.0  # Take profit at 5% (optional)
    ENABLE_TAKE_PROFIT = False  # Whether to enable take profit


    # ==================== Virtual Trading Configuration ====================
    # Initial virtual balance
    INITIAL_BALANCE_USDT = 10000.0  # Initial virtual balance 10000 USDT

    # Position sizing (% of balance per trade)
    POSITION_SIZE_PERCENT = 10.0  # Use 10% of funds per trade

    # Maximum simultaneous positions
    MAX_POSITIONS = 5  # Hold up to 5 positions simultaneously

    # Trading fee (%)
    TRADING_FEE_PERCENT = 0.1  # Trading fee 0.1%


    # ==================== Redis Cache Configuration ====================
    # Redis connection
    REDIS_HOST = 'localhost'
    REDIS_PORT = 6379
    REDIS_DB = 0  # Database 0 for price data
    REDIS_PASSWORD = None  # No password by default

    # Redis key prefixes
    REDIS_PREFIX_PRICE = 'okx:price:'  # okx:price:BTC
    REDIS_PREFIX_ATTR = 'okx:attr:'    # okx:attr:BTC (24 hour attributes)
    REDIS_PREFIX_POSITION = 'okx:pos:'  # okx:pos:BTC (virtual positions)

    # Redis TTL (seconds)
    REDIS_TTL_PRICE = 86400 * 7  # Price data kept for 7 days
    REDIS_TTL_ATTR = 3600  # Attribute data kept for 1 hour


    # ==================== Realtime Data Update Configuration ====================
    # Enable realtime data updates after initialization
    REALTIME_UPDATE_ENABLED = True  # Enable continuous data loading

    # Realtime data update interval (seconds)
    # 0 = Maximum speed (respecting API rate limits only)
    # >0 = Wait N seconds between update cycles
    REALTIME_UPDATE_INTERVAL_SECONDS = 0  # 0 = continuous at max safe speed

    # OKX API rate limit (requests per second)
    # OKX limit: 20 requests/second per IP
    # We use 15/s for safety margin (75% of limit)
    API_RATE_LIMIT_PER_SECOND = 15  # 15 requests/second (safe limit)

    # Number of coins to update per cycle
    # With 294 coins and 15 req/s: 294/15 = ~20 seconds per full cycle
    REALTIME_BATCH_SIZE = 15  # Update 15 coins at a time (1 second worth)

    # ==================== Database Sync Configuration ====================
    # Sync interval (seconds)
    DB_SYNC_INTERVAL_SECONDS = 30  # Sync every 30 seconds

    # Batch size for sync
    DB_SYNC_BATCH_SIZE = 100  # Sync 100 coins per batch


    # ==================== Calculation Optimization Configuration ====================
    # Use Redis for all calculations (only read from SQLite on init)
    CALCULATION_USE_REDIS_ONLY = True  # Only interact with Redis for calculations

    # Update frequency for coin attributes (seconds)
    ATTR_UPDATE_INTERVAL_SECONDS = 60  # Update coin attributes every 60 seconds

    # Number of data points to keep in Redis for each coin
    REDIS_MAX_DATAPOINTS_PER_COIN = 1440 * 3  # 3 days * 1440 minutes = 4320 data points


    # ==================== Multi-threading Configuration ====================
    # Thread counts
    NUM_CALCULATION_THREADS = 2  # Number of calculation threads
    NUM_TRADING_THREADS = 1      # Number of trading threads
    NUM_SYNC_THREADS = 1         # Number of sync threads

    # Thread sleep intervals (seconds)
    CALCULATION_THREAD_SLEEP = 1  # Calculation thread sleep time
    TRADING_THREAD_SLEEP = 1      # Trading thread sleep time


    # ==================== Logging Configuration ====================
    # Log trade results
    ENABLE_TRADE_LOGGING = True
    TRADE_LOG_FILE = 'backtest_trades.csv'

    # Log performance metrics
    ENABLE_PERFORMANCE_LOGGING = True
    PERFORMANCE_LOG_FILE = 'backtest_performance.csv'


    # ==================== Debug Configuration ====================
    DEBUG_MODE = False
    VERBOSE_LOGGING = True


# Global singleton instance
strategy_config = StrategyConfig()
