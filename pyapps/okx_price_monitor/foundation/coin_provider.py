#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Coin Provider V2 - OKX Data Provider using python-okx

Fetches coin/instrument data and ticker data from OKX API.
Uses the unified OKXClient from lib layer.
"""

import time
import json
from pathlib import Path
from typing import List, Dict, Optional

from pyapps.okx_price_monitor.lib import OKXClient
from pyapps.okx_price_monitor.core import config
from pyapps.okx_price_monitor.core.monitor_config import monitor_config
from pyapps.okx_price_monitor.foundation.printer import Printer


class CoinProvider:
    """
    OKX Coin Provider V2

    Fetches coin data and ticker information from OKX API using python-okx library.
    Caches results to reduce API calls.
    """

    def __init__(self, inst_type: str = None, use_auth: bool = False):
        """
        Initialize CoinProvider

        Args:
            inst_type (str): Instrument type (SPOT, SWAP, FUTURES, OPTION)
            use_auth (bool): Whether to use authentication for private API calls
        """
        self.inst_type = inst_type or config.DEFAULT_INST_TYPE
        self.use_auth = use_auth

        self.okx_client = OKXClient(use_auth=use_auth)

        self.instruments_cache = None
        self.instruments_cache_time = None
        self.tickers_cache = None
        self.tickers_cache_time = None

        self.printer = Printer(prefix="[CoinProvider]")

        if use_auth:
            self.printer.success("OKX client initialized with authentication")
        else:
            self.printer.info("OKX client initialized (public API only)")

    def fetch_instruments(self, force_refresh: bool = False) -> List[Dict]:
        """
        Fetch instrument list from OKX API

        Args:
            force_refresh (bool): Force refresh cache

        Returns:
            List[Dict]: List of instrument data
        """
        current_time = time.time()

        if not force_refresh and self.instruments_cache and self.instruments_cache_time:
            if (current_time - self.instruments_cache_time) < config.COIN_LIST_CACHE_TTL:
                self.printer.info(f"Using cached instruments ({len(self.instruments_cache)} items)")
                return self.instruments_cache

        self.printer.info(f"Fetching instruments (instType={self.inst_type})...")

        response = self.okx_client.get_instruments(inst_type=self.inst_type)

        if response.get('code') == '0' and 'data' in response:
            self.instruments_cache = response['data']
            self.instruments_cache_time = current_time
            self.printer.success(f"Fetched {len(self.instruments_cache)} instruments")

            self._save_to_cache('instruments', self.instruments_cache)

            return self.instruments_cache
        else:
            error_msg = response.get('msg', 'Unknown error')
            self.printer.error(f"Failed to fetch instruments: {error_msg}")
            return []

    def fetch_tickers(self, inst_type: str = None) -> List[Dict]:
        """
        Fetch all tickers from OKX API

        Args:
            inst_type (str): Instrument type (default: use instance default)

        Returns:
            List[Dict]: List of ticker data
        """
        inst_type = inst_type or self.inst_type

        self.printer.info(f"Fetching tickers (instType={inst_type})...")

        response = self.okx_client.get_tickers(inst_type=inst_type)

        if response.get('code') == '0' and 'data' in response:
            tickers = response['data']
            self.tickers_cache = tickers
            self.tickers_cache_time = time.time()

            self.printer.success(f"Fetched {len(tickers)} tickers")
            return tickers
        else:
            error_msg = response.get('msg', 'Unknown error')
            self.printer.error(f"Failed to fetch tickers: {error_msg}")
            return []

    def fetch_ticker(self, inst_id: str) -> Optional[Dict]:
        """
        Fetch single ticker data

        Args:
            inst_id (str): Instrument ID (e.g., "BTC-USDT")

        Returns:
            Optional[Dict]: Ticker data or None
        """
        response = self.okx_client.get_ticker(inst_id=inst_id)

        if response.get('code') == '0' and 'data' in response and len(response['data']) > 0:
            return response['data'][0]

        return None

    def get_coin_list(self) -> List[str]:
        """
        Get list of base coin symbols

        Returns:
            List[str]: List of coin symbols (e.g., ["BTC", "ETH", ...])
        """
        instruments = self.fetch_instruments()

        if not instruments:
            return []

        coins = set()
        for inst in instruments:
            inst_id = inst.get('instId', '')
            if '-' in inst_id:
                base_coin = inst_id.split('-')[0]
                coins.add(base_coin)

        coin_list = sorted(list(coins))
        self.printer.info(f"Extracted {len(coin_list)} unique coins")

        return coin_list

    def get_trading_pairs(self, quote_currency: str = "USDT") -> List[str]:
        """
        Get list of trading pairs for a specific quote currency

        Args:
            quote_currency (str): Quote currency (e.g., "USDT")

        Returns:
            List[str]: List of trading pairs
        """
        instruments = self.fetch_instruments()

        if not instruments:
            return []

        pairs = []
        for inst in instruments:
            inst_id = inst.get('instId', '')
            if inst_id.endswith(f'-{quote_currency}'):
                pairs.append(inst_id)

        self.printer.info(f"Found {len(pairs)} trading pairs with {quote_currency}")
        return pairs

    def _save_to_cache(self, cache_name: str, data: any):
        """
        Save data to cache file

        Args:
            cache_name (str): Cache file name prefix
            data: Data to save
        """
        # Use system cache directory from monitor_config
        cache_dir = monitor_config.CACHE_DIR
        cache_dir.mkdir(parents=True, exist_ok=True)

        timestamp = time.strftime('%Y-%m-%d_%H-%M-%S')
        filename = f"{cache_name}_{timestamp}.json"
        filepath = cache_dir / filename

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump({
                'timestamp': timestamp,
                'total_items': len(data) if isinstance(data, list) else 1,
                'data': data
            }, f, indent=2, ensure_ascii=False)

        self.printer.success(f"Cache saved to: {filepath}")
