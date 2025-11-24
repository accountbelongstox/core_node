#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX Coin Provider

Provides coin list by fetching from OKX API and caching.
"""

import time
import json
from pathlib import Path
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pygvar import PROJECT_ROOT
from pyapps.okx_price_monitor.lib.config import config
from pyapps.okx_price_monitor.lib.rpc_utils import parse_rpc_response

requests = None


class CoinProvider:
    """
    OKX Coin Provider (Shared across all modes)

    Fetches and caches coin list from OKX public API.
    """

    def __init__(self, rpc_base_url=None):
        global requests
        if requests is None:
            requests = get_third_package_requests()

        self.rpc_base_url = rpc_base_url or config.RPC_BASE_URL
        self.coins_cache = None
        self.cache_timestamp = None
        self.cache_ttl = config.COIN_CACHE_TTL

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
        return parse_rpc_response(result, extract_data=True)

    def _save_coins_to_file(self, coins_data):
        """
        Save coins data to local JSON file

        Args:
            coins_data (list): List of coin data

        Returns:
            str: File path where data was saved
        """
        try:
            app_dir_path = Path(PROJECT_ROOT) / 'public' / 'uploads' / 'okx_price_monitor' / 'cache'
            app_dir_path.mkdir(parents=True, exist_ok=True)

            timestamp = time.strftime('%Y-%m-%d_%H-%M-%S')
            filename = f"coins_cache_{timestamp}.json"
            filepath = app_dir_path / filename

            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump({
                    'timestamp': timestamp,
                    'total_coins': len(coins_data),
                    'data': coins_data
                }, f, indent=2, ensure_ascii=False)

            return str(filepath)

        except Exception as error:
            ColorPrint.red(f"[CoinProvider] Failed to save coins to file: {error}")
            return None

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
        api_url = f"{config.COINS_API_URL}?t={timestamp}"

        ColorPrint.blue(f"[CoinProvider] Fetching coins from: {api_url}")

        data = self._call_rpc_browser_inject(page_id, api_url)

        if data and 'data' in data:
            self.coins_cache = data['data']
            self.cache_timestamp = current_time
            ColorPrint.green(f"[CoinProvider] Cached {len(self.coins_cache)} coins")

            # Save to file
            cache_file = self._save_coins_to_file(self.coins_cache)
            if cache_file:
                ColorPrint.green(f"[CoinProvider] Coins cache saved to: {cache_file}")

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

        # Display all coin names
        ColorPrint.green("\n" + "=" * 80)
        ColorPrint.green(f"ALL COIN NAMES ({len(coin_names)} total)")
        ColorPrint.green("=" * 80)

        # Display in rows of 10 coins per line
        for i in range(0, len(coin_names), 10):
            row = coin_names[i:i+10]
            ColorPrint.blue("  " + ", ".join(row))

        ColorPrint.green("=" * 80 + "\n")

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
