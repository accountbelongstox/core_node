#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX System Configuration - Unified Configuration
"""

from typing import Literal


class OKXConfig:
    """
    Unified OKX System Configuration

    Central configuration for all OKX modes:
    - MONITOR: Price monitoring with web interface
    - TRADING_TEST: Backtest from historical data (3 days ago)
    - TRADING_LIVE: Live trading with virtual money (current time)
    """

    # ==================== SYSTEM MODE ====================
    # Mode selection: 'MONITOR', 'TRADING_TEST', 'TRADING_LIVE'
    SYSTEM_MODE: Literal['MONITOR', 'TRADING_TEST', 'TRADING_LIVE'] = 'TRADING_TEST'

    # ==================== MONITOR MODE SETTINGS ====================
    # Used when SYSTEM_MODE = 'MONITOR'
    MONITOR_STARTUP_MODE: Literal['web', 'console', 'fetch', 'init'] = 'web'

    # ==================== TRADING MODE SETTINGS ====================
    # Used when SYSTEM_MODE = 'TRADING_TEST' or 'TRADING_LIVE'
    # (Loaded from strategy_config.py)

    @classmethod
    def get_description(cls) -> str:
        """Get description of current mode"""
        if cls.SYSTEM_MODE == 'MONITOR':
            return "Price Monitoring Mode (Web Interface + Real-time Alerts)"
        elif cls.SYSTEM_MODE == 'TRADING_TEST':
            return "Trading Test Mode (Backtest from 3 days ago with virtual money)"
        elif cls.SYSTEM_MODE == 'TRADING_LIVE':
            return "Trading Live Mode (Live data with virtual money - paper trading)"
        else:
            return "Unknown Mode"


# Global config instance
okx_config = OKXConfig()
