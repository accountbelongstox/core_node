#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX Price Monitor - Lib Package

Low-level library modules for OKX integration:
- okx_client.py: Unified OKX API client using python-okx library
- okx_websocket_client.py: WebSocket client for real-time price updates
- okx_auth.py: OKX authentication helpers (legacy)
- rate_limiter.py: Request rate limiting (20 req/3s)
- coin_table_manager.py: Database table management per coin
- history_fetcher.py: Historical data retrieval
- models.py: Database models (used by foundation/database_handler.py)
- rpc_utils.py: RPC utilities (used by services/grid_display.py)
"""

from pyapps.okx_price_monitor.lib.okx_client import OKXClient, create_okx_client
from pyapps.okx_price_monitor.lib.okx_websocket_client import OKXWebSocketClient
from pyapps.okx_price_monitor.lib.okx_auth import OKXAuth
from pyapps.okx_price_monitor.lib.rpc_utils import parse_rpc_response
from pyapps.okx_price_monitor.lib.rate_limiter import RateLimiter, get_rate_limiter
from pyapps.okx_price_monitor.lib.coin_table_manager import CoinTableManager
from pyapps.okx_price_monitor.lib.history_fetcher import HistoryFetcher
from pyapps.okx_price_monitor.lib.realtime_price_manager import RealtimePriceManager, get_realtime_price_manager

__all__ = [
    'OKXClient',
    'create_okx_client',
    'OKXWebSocketClient',
    'OKXAuth',
    'parse_rpc_response',
    'RateLimiter',
    'get_rate_limiter',
    'CoinTableManager',
    'HistoryFetcher',
    'RealtimePriceManager',
    'get_realtime_price_manager',
]
