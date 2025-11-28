#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Strategy Configuration - Trading Strategy Parameters
策略配置 - 交易策略参数

Configurable parameters for backtesting and live trading strategies.
"""


class StrategyConfig:
    """
    Trading Strategy Configuration
    交易策略配置
    """

    # ==================== 运行模式配置 ====================
    # Run mode: 'TEST' or 'LIVE'
    # TEST: Replay historical data from 3 days ago (backtest)
    # LIVE: Start from current time (paper trading with virtual money)
    RUN_MODE = 'TEST'  # Default: TEST mode

    # ==================== 数据初始化配置 ====================
    # Historical data initialization (days before start)
    HISTORY_INIT_DAYS = 3  # 至少初始化3天前的数据

    # Start backtesting from N days ago (TEST mode only)
    BACKTEST_START_DAYS = 3  # 从3天前开始扫描

    # Data granularity (bar size)
    # Note: Due to OKX API limitations, 1m bars only provide 1 day of history
    #       We use 5m bars to get 3+ days for initialization
    CANDLE_BAR = '5m'  # 5-minute bars (covers 5 days of history)


    # ==================== 24小时分析窗口配置 ====================
    # Time window for attribute calculation (hours)
    ANALYSIS_WINDOW_HOURS = 24  # 24小时窗口

    # Number of time periods to split the window into
    TIME_PERIODS_COUNT = 4  # 将24小时分为4个时段

    # Each period duration (auto-calculated)
    @property
    def PERIOD_DURATION_HOURS(self):
        return self.ANALYSIS_WINDOW_HOURS // self.TIME_PERIODS_COUNT  # 6小时/时段


    # ==================== 币种筛选条件 ====================
    # Coin selection criteria for trading

    # Allowed trend types (整体走向)
    ALLOWED_TRENDS = [
        'stable',      # 平稳
        'upward',      # 向上
        # 'downward',  # 向下 (不选择)
        # 'up_then_down',    # 向上再向下 (不选择)
        # 'down_then_up',    # 向下再向上 (可选)
    ]

    # Minimum volatility threshold (price range as % of average)
    # 最小波动率阈值（最高-最低 / 平均价格）
    MIN_VOLATILITY_PERCENT = 0.5  # 0.5%

    # Maximum volatility threshold
    # 最大波动率阈值
    MAX_VOLATILITY_PERCENT = 10.0  # 10%


    # ==================== 交易信号配置 ====================
    # Buy signal: 60秒上涨超过1%
    BUY_SIGNAL_WINDOW_SECONDS = 60  # 60秒窗口
    BUY_SIGNAL_THRESHOLD_PERCENT = 1.0  # 上涨超过1%

    # Sell signal: 5分钟后卖出
    SELL_AFTER_MINUTES = 5  # 5分钟后卖出

    # Stop loss (optional)
    STOP_LOSS_PERCENT = -3.0  # 止损-3%（可选）
    ENABLE_STOP_LOSS = False  # 是否启用止损

    # Take profit (optional)
    TAKE_PROFIT_PERCENT = 5.0  # 止盈5%（可选）
    ENABLE_TAKE_PROFIT = False  # 是否启用止盈


    # ==================== 虚拟交易配置 ====================
    # Initial virtual balance
    INITIAL_BALANCE_USDT = 10000.0  # 初始虚拟余额 10000 USDT

    # Position sizing (% of balance per trade)
    POSITION_SIZE_PERCENT = 10.0  # 每次交易使用10%资金

    # Maximum simultaneous positions
    MAX_POSITIONS = 5  # 最多同时持有5个仓位

    # Trading fee (%)
    TRADING_FEE_PERCENT = 0.1  # 交易手续费 0.1%


    # ==================== Redis缓存配置 ====================
    # Redis connection
    REDIS_HOST = 'localhost'
    REDIS_PORT = 6379
    REDIS_DB = 0  # Database 0 for price data
    REDIS_PASSWORD = None  # No password by default

    # Redis key prefixes
    REDIS_PREFIX_PRICE = 'okx:price:'  # okx:price:BTC
    REDIS_PREFIX_ATTR = 'okx:attr:'    # okx:attr:BTC (24小时属性)
    REDIS_PREFIX_POSITION = 'okx:pos:'  # okx:pos:BTC (虚拟持仓)

    # Redis TTL (seconds)
    REDIS_TTL_PRICE = 86400 * 7  # 价格数据保留7天
    REDIS_TTL_ATTR = 3600  # 属性数据保留1小时


    # ==================== 数据库同步配置 ====================
    # Sync interval (seconds)
    DB_SYNC_INTERVAL_SECONDS = 30  # 每30秒同步一次

    # Batch size for sync
    DB_SYNC_BATCH_SIZE = 100  # 每次同步100个币


    # ==================== 计算优化配置 ====================
    # Use Redis for all calculations (only read from SQLite on init)
    CALCULATION_USE_REDIS_ONLY = True  # 计算只和Redis打交道

    # Update frequency for coin attributes (seconds)
    ATTR_UPDATE_INTERVAL_SECONDS = 60  # 每60秒更新一次币种属性

    # Number of data points to keep in Redis for each coin
    REDIS_MAX_DATAPOINTS_PER_COIN = 1440 * 3  # 3天 * 1440分钟 = 4320个数据点


    # ==================== 多线程配置 ====================
    # Thread counts
    NUM_CALCULATION_THREADS = 2  # 计算线程数量
    NUM_TRADING_THREADS = 1      # 交易线程数量
    NUM_SYNC_THREADS = 1         # 同步线程数量

    # Thread sleep intervals (seconds)
    CALCULATION_THREAD_SLEEP = 1  # 计算线程休眠时间
    TRADING_THREAD_SLEEP = 1      # 交易线程休眠时间


    # ==================== 日志配置 ====================
    # Log trade results
    ENABLE_TRADE_LOGGING = True
    TRADE_LOG_FILE = 'backtest_trades.csv'

    # Log performance metrics
    ENABLE_PERFORMANCE_LOGGING = True
    PERFORMANCE_LOG_FILE = 'backtest_performance.csv'


    # ==================== Debug配置 ====================
    DEBUG_MODE = False
    VERBOSE_LOGGING = True


# Global singleton instance
strategy_config = StrategyConfig()
