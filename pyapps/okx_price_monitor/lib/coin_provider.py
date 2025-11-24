#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX Coin Provider

Provides coin list by fetching from OKX API and caching.
"""

import time
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyfoundations.color_print import ColorPrint

requests = None


class CoinProvider:
    """
    OKX Coin Provider (Shared across all modes)

    Fetches and caches coin list from OKX public API.
    """

    def __init__(self, rpc_base_url='http://127.0.0.1:58000'):
        global requests
        if requests is None:
            requests = get_third_package_requests()

        self.rpc_base_url = rpc_base_url
        self.coins_cache = None
        self.cache_timestamp = None
        self.cache_ttl = 3600

    def _get_timestamp(self):
        """
        Get current timestamp in milliseconds

        Returns:
            int: Current timestamp in milliseconds
        """
        return int(time.time() * 1000)

    def _call_rpc_browser_inject(self, page_id, api_url):
        """
        Call RPC browser/injectAPIRequest endpoint

        Args:
            page_id (str): Page ID
            api_url (str): API URL to inject

        Returns:
            dict: API response data
        """
        rpc_url = f"{self.rpc_base_url}/rpc/browser/injectAPIRequest"

        payload = {
            'pageId': page_id,
            'apiUrl': api_url,
            'method': 'GET',
            'responseType': 'json',
            'timeout': 30000
        }

        response = requests.post(rpc_url, json=payload, timeout=30)
        response.raise_for_status()

        result = response.json()

        if result.get('success') and result.get('result'):
            return result.get('result', {}).get('data')
        elif not result.get('success'):
            raise Exception(f"RPC call failed: {result.get('error')}")

        return result.get('data')

    def fetch_coins(self, page_id, force_refresh=False):
        """
        Fetch coin list from OKX API

        Args:
            page_id (str): Page ID from browser manager
            force_refresh (bool): Force refresh cache

        Returns:
            list: List of coin data
        """
        current_time = time.time()

        if not force_refresh and self.coins_cache and self.cache_timestamp:
            if (current_time - self.cache_timestamp) < self.cache_ttl:
                ColorPrint.blue(f"[CoinProvider] Using cached coins ({len(self.coins_cache)} items)")
                return self.coins_cache

        timestamp = self._get_timestamp()
        api_url = f"https://www.okx.com/priapi/v5/public/coins?t={timestamp}"

        ColorPrint.blue(f"[CoinProvider] Fetching coins from: {api_url}")

        data = self._call_rpc_browser_inject(page_id, api_url)

        if data and 'data' in data:
            self.coins_cache = data['data']
            self.cache_timestamp = current_time
            ColorPrint.green(f"[CoinProvider] Cached {len(self.coins_cache)} coins")
            return self.coins_cache
        else:
            ColorPrint.red("[CoinProvider] Failed to fetch coins")
            return []

    def get_coin_names(self, page_id):
        """
        Get list of coin names (symbols)

        Args:
            page_id (str): Page ID from browser manager

        Returns:
            list: List of coin names/symbols
        """
        coins = self.fetch_coins(page_id)

        if not coins:
            return []

        coin_names = []
        for coin in coins:
            if isinstance(coin, dict):
                if 'coin' in coin:
                    coin_names.append(coin['coin'])
                elif 'symbol' in coin:
                    coin_names.append(coin['symbol'])
                elif 'currency' in coin:
                    coin_names.append(coin['currency'])

        ColorPrint.blue(f"[CoinProvider] Extracted {len(coin_names)} coin names from {len(coins)} items")
        return coin_names

    def get_coins_info(self, page_id):
        """
        Get full coin information

        Args:
            page_id (str): Page ID from browser manager

        Returns:
            list: List of coin data dictionaries
        """
        return self.fetch_coins(page_id)
