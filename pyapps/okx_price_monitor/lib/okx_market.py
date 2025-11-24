#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX Market Data API

Public market data endpoints that don't require authentication.
Reference: https://www.okx.com/docs-v5/en/#order-book-trading-market-data
"""

from pyapps.okx_price_monitor.lib.okx_client import OKXClient


class OKXMarketAPI:
    """
    OKX Market Data API

    Provides access to public market data endpoints.
    """

    def __init__(self, client=None):
        self.client = client or OKXClient()

    def get_tickers(self, inst_type='SPOT', uly=None):
        """
        Get tickers of all instruments

        Args:
            inst_type (str): Instrument type (SPOT, SWAP, FUTURES, OPTION)
            uly (str): Underlying (optional, for derivatives)

        Returns:
            dict: API response with ticker data
        """
        params = {'instType': inst_type}
        if uly:
            params['uly'] = uly

        return self.client.get('/api/v5/market/tickers', params=params, auth_required=False)

    def get_ticker(self, inst_id):
        """
        Get ticker of a single instrument

        Args:
            inst_id (str): Instrument ID (e.g., 'BTC-USDT')

        Returns:
            dict: API response with ticker data
        """
        params = {'instId': inst_id}
        return self.client.get('/api/v5/market/ticker', params=params, auth_required=False)

    def get_index_tickers(self, quote_ccy=None, inst_id=None):
        """
        Get index tickers

        Args:
            quote_ccy (str): Quote currency (e.g., 'USD', 'USDT')
            inst_id (str): Instrument ID

        Returns:
            dict: API response with index ticker data
        """
        params = {}
        if quote_ccy:
            params['quoteCcy'] = quote_ccy
        if inst_id:
            params['instId'] = inst_id

        return self.client.get('/api/v5/market/index-tickers', params=params, auth_required=False)

    def get_orderbook(self, inst_id, sz='1'):
        """
        Get order book

        Args:
            inst_id (str): Instrument ID
            sz (str): Order book depth (default: 1)

        Returns:
            dict: API response with order book data
        """
        params = {
            'instId': inst_id,
            'sz': sz
        }
        return self.client.get('/api/v5/market/books', params=params, auth_required=False)

    def get_candlesticks(self, inst_id, bar='1m', after=None, before=None, limit='100'):
        """
        Get candlestick data

        Args:
            inst_id (str): Instrument ID
            bar (str): Bar size (1m, 3m, 5m, 15m, 30m, 1H, 2H, 4H, 6H, 12H, 1D, 1W, 1M, 3M)
            after (str): Pagination - data after this timestamp
            before (str): Pagination - data before this timestamp
            limit (str): Number of results (default: 100, max: 300)

        Returns:
            dict: API response with candlestick data
        """
        params = {
            'instId': inst_id,
            'bar': bar,
            'limit': limit
        }
        if after:
            params['after'] = after
        if before:
            params['before'] = before

        return self.client.get('/api/v5/market/candles', params=params, auth_required=False)

    def get_trades(self, inst_id, limit='100'):
        """
        Get recent trades

        Args:
            inst_id (str): Instrument ID
            limit (str): Number of results (default: 100, max: 500)

        Returns:
            dict: API response with trade data
        """
        params = {
            'instId': inst_id,
            'limit': limit
        }
        return self.client.get('/api/v5/market/trades', params=params, auth_required=False)

    def get_24h_volume(self):
        """
        Get 24-hour total volume

        Returns:
            dict: API response with 24h volume data
        """
        return self.client.get('/api/v5/market/platform-24-volume', auth_required=False)
