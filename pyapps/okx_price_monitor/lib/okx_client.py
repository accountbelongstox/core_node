#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX Client - Unified OKX API Client

Provides a unified interface to the OKX API using python-okx library.
Handles authentication and provides access to all OKX API endpoints.
"""

from typing import Optional
from pycore.pyfoundations.third_party import get_third_package_okx
from pycore.pyfoundations.secret_manager import get_secret_key
from pyapps.okx_price_monitor.core import config

get_third_package_okx()

import okx.MarketData as MarketData
import okx.PublicData as PublicData
import okx.Account as Account
import okx.Trade as Trade


class OKXClient:
    """
    OKX API Client

    Unified client for accessing OKX API endpoints.
    Supports both public and private API calls with automatic authentication.
    """

    def __init__(self, use_auth: bool = False):
        """
        Initialize OKX client

        Args:
            use_auth (bool): Whether to use authentication for private API calls
        """
        self.use_auth = use_auth
        self.api_key = None
        self.secret_key = None
        self.passphrase = None

        if use_auth:
            self.api_key = get_secret_key('LOCAL_TEST_PASSWORD_1')
            self.secret_key = get_secret_key('LOCAL_TEST_API_KEY_1')
            self.passphrase = config.OKX_PASSPHRASE

            if not self.api_key or not self.secret_key:
                raise ValueError(
                    "OKX API credentials not found. "
                    "Need LOCAL_TEST_PASSWORD_1 (API Key) and LOCAL_TEST_API_KEY_1 (Secret Key)"
                )

            self.market_api = MarketData.MarketAPI(
                api_key=self.api_key,
                api_secret_key=self.secret_key,
                passphrase=self.passphrase,
                flag='0'
            )

            self.public_api = PublicData.PublicAPI(
                api_key=self.api_key,
                api_secret_key=self.secret_key,
                passphrase=self.passphrase,
                flag='0'
            )

            self.account_api = Account.AccountAPI(
                api_key=self.api_key,
                api_secret_key=self.secret_key,
                passphrase=self.passphrase,
                flag='0'
            )

            self.trade_api = Trade.TradeAPI(
                api_key=self.api_key,
                api_secret_key=self.secret_key,
                passphrase=self.passphrase,
                flag='0'
            )
        else:
            self.market_api = MarketData.MarketAPI(flag='0')
            self.public_api = PublicData.PublicAPI(flag='0')
            self.account_api = None
            self.trade_api = None

    def get_instruments(self, inst_type: str = "SPOT") -> dict:
        """
        Get instrument list

        Args:
            inst_type (str): Instrument type (SPOT, SWAP, FUTURES, OPTION)

        Returns:
            dict: API response with instrument data
        """
        return self.public_api.get_instruments(instType=inst_type)

    def get_tickers(self, inst_type: str = "SPOT") -> dict:
        """
        Get all tickers for instrument type

        Args:
            inst_type (str): Instrument type (SPOT, SWAP, FUTURES, OPTION)

        Returns:
            dict: API response with ticker data
        """
        return self.market_api.get_tickers(instType=inst_type)

    def get_ticker(self, inst_id: str) -> dict:
        """
        Get single ticker data

        Args:
            inst_id (str): Instrument ID (e.g., "BTC-USDT")

        Returns:
            dict: API response with ticker data
        """
        return self.market_api.get_ticker(instId=inst_id)

    def get_orderbook(self, inst_id: str, depth: int = 20) -> dict:
        """
        Get orderbook data

        Args:
            inst_id (str): Instrument ID (e.g., "BTC-USDT")
            depth (int): Orderbook depth (1-400)

        Returns:
            dict: API response with orderbook data
        """
        return self.market_api.get_orderbook(instId=inst_id, sz=str(depth))

    def get_trades(self, inst_id: str, limit: int = 100) -> dict:
        """
        Get recent trades

        Args:
            inst_id (str): Instrument ID (e.g., "BTC-USDT")
            limit (int): Number of trades to fetch (1-500)

        Returns:
            dict: API response with trade data
        """
        return self.market_api.get_trades(instId=inst_id, limit=str(limit))

    def get_candles(self, inst_id: str, bar: str = "1m", limit: int = 100,
                    after: Optional[str] = None, before: Optional[str] = None) -> dict:
        """
        Get candlestick data

        Args:
            inst_id (str): Instrument ID (e.g., "BTC-USDT")
            bar (str): Bar size (1m, 5m, 15m, 30m, 1H, 4H, 1D, etc.)
            limit (int): Number of candles to fetch (1-300)
            after (Optional[str]): Pagination - get data before this timestamp (backwards in time)
            before (Optional[str]): Pagination - get data after this timestamp (forwards in time)

        Returns:
            dict: API response with candle data
        """
        # Build parameters for OKX API
        params = {
            'instId': inst_id,
            'bar': bar,
            'limit': str(limit)
        }

        if after:
            params['after'] = after
        if before:
            params['before'] = before

        return self.market_api.get_candlesticks(**params)

    def get_account_balance(self) -> Optional[dict]:
        """
        Get account balance (requires authentication)

        Returns:
            Optional[dict]: API response with account balance or None if not authenticated
        """
        if not self.use_auth or not self.account_api:
            return None

        return self.account_api.get_account_balance()

    def get_positions(self, inst_type: Optional[str] = None) -> Optional[dict]:
        """
        Get positions (requires authentication)

        Args:
            inst_type (str): Instrument type filter (optional)

        Returns:
            Optional[dict]: API response with positions or None if not authenticated
        """
        if not self.use_auth or not self.account_api:
            return None

        if inst_type:
            return self.account_api.get_positions(instType=inst_type)
        else:
            return self.account_api.get_positions()

    def place_order(self, inst_id: str, side: str, order_type: str, size: str, **kwargs) -> Optional[dict]:
        """
        Place an order (requires authentication)

        Args:
            inst_id (str): Instrument ID (e.g., "BTC-USDT")
            side (str): Order side ("buy" or "sell")
            order_type (str): Order type ("market", "limit", "post_only", etc.)
            size (str): Order size
            **kwargs: Additional order parameters (price, etc.)

        Returns:
            Optional[dict]: API response with order result or None if not authenticated
        """
        if not self.use_auth or not self.trade_api:
            return None

        params = {
            'instId': inst_id,
            'tdMode': 'cash',
            'side': side,
            'ordType': order_type,
            'sz': size,
        }
        params.update(kwargs)

        return self.trade_api.place_order(**params)


def create_okx_client(use_auth: bool = False) -> OKXClient:
    """
    Create and return an OKX client instance

    Args:
        use_auth (bool): Whether to use authentication

    Returns:
        OKXClient: Initialized OKX client
    """
    return OKXClient(use_auth=use_auth)
