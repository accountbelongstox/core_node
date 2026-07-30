#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Coin Provider - API-based Data Provider

Fetches coin/instrument data and ticker data from OKX API.
Uses requests library to call OKX public API endpoints.
"""

import time
import json
from pathlib import Path
from typing import List, Dict, Optional

from pycore.pyfoundations.third_party.api import get_third_package_requests
from pycore.pyfoundations.secret_manager import get_secret_key
from pycore.pyfoundations.pygvar import PROJECT_ROOT
from pyapps.okx_price_monitor.core import config, timestamp_ms
from pyapps.okx_price_monitor.foundation.printer import Printer
from pyapps.okx_price_monitor.lib.okx_auth import OKXAuth

requests = get_third_package_requests()


class CoinProvider:
    """
    OKX Coin Provider (API Mode)
    
    Fetches coin data and ticker information directly from OKX API.
    Caches results to reduce API calls.
    Supports both public API (no auth) and private API (with auth).
    """
    
    def __init__(self, inst_type: str = None, use_auth: bool = False):
        self.inst_type = inst_type or config.DEFAULT_INST_TYPE
        self.instruments_cache = None
        self.instruments_cache_time = None
        self.tickers_cache = None
        self.tickers_cache_time = None
        self.use_auth = use_auth
        self.okx_auth = None
        
        self.printer = Printer(prefix="[CoinProvider]")
        
        if use_auth:
            self._initialize_auth()
    
    def _initialize_auth(self):
        """
        Initialize OKX authentication using SecretManager
        
        Reads only 2 keys from .secret_keys/.secret_ignore/:
        - LOCAL_TEST_PASSWORD_1 -> API Key
        - LOCAL_TEST_API_KEY_1 -> Secret Key
        
        Passphrase is hardcoded in config (set when creating API key on OKX)
        """
        api_key = get_secret_key('LOCAL_TEST_PASSWORD_1')
        secret_key = get_secret_key('LOCAL_TEST_API_KEY_1')
        passphrase = config.OKX_PASSPHRASE
        
        if api_key and secret_key:
            self.okx_auth = OKXAuth(api_key, secret_key, passphrase)
            self.printer.success("OKX authentication initialized")
        else:
            self.printer.warning("OKX API credentials not found")
            self.printer.warning("Need LOCAL_TEST_PASSWORD_1 (API Key) and LOCAL_TEST_API_KEY_1 (Secret Key)")
            self.printer.warning("Using public API only")
            self.use_auth = False
    
    def _get_auth_headers(self, method: str, request_path: str, body: str = '') -> dict:
        """
        Get authentication headers for private API
        
        Args:
            method (str): HTTP method
            request_path (str): Request path
            body (str): Request body
            
        Returns:
            dict: Headers with authentication
        """
        if self.okx_auth:
            return self.okx_auth.get_headers(method, request_path, body)
        return {}
    
    def _make_request(self, url: str, max_retries: int = None, use_auth: bool = False) -> Optional[dict]:
        """
        Make HTTP request with retry logic
        
        Args:
            url (str): URL to request
            max_retries (int): Maximum number of retries
            use_auth (bool): Whether to use authentication
            
        Returns:
            Optional[dict]: Response data or None if failed
        """
        max_retries = max_retries or config.MAX_RETRIES
        retry_delay = config.RETRY_DELAY
        
        for attempt in range(max_retries):
            headers = {}
            
            if use_auth and self.okx_auth:
                from urllib.parse import urlparse
                parsed_url = urlparse(url)
                request_path = parsed_url.path
                if parsed_url.query:
                    request_path += f"?{parsed_url.query}"
                headers = self._get_auth_headers('GET', request_path)
            
            response = requests.get(url, headers=headers, timeout=config.REQUEST_TIMEOUT)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('code') == '0':
                return data
            
            error_msg = data.get('msg', 'Unknown error')
            self.printer.error(f"API returned error: {error_msg}")
            
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
        
        return None
    
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
        
        url = config.get_api_url(
            config.INSTRUMENTS_ENDPOINT,
            {'instType': self.inst_type}
        )
        
        self.printer.info(f"Fetching instruments from: {url}")
        
        data = self._make_request(url)
        
        if data and 'data' in data:
            self.instruments_cache = data['data']
            self.instruments_cache_time = current_time
            self.printer.success(f"Fetched {len(self.instruments_cache)} instruments")
            
            self._save_to_cache('instruments', self.instruments_cache)
            
            return self.instruments_cache
        else:
            self.printer.error("Failed to fetch instruments")
            return []
    
    def fetch_tickers(self, inst_type: str = None) -> List[Dict]:
        """
        Fetch all tickers from OKX API
        
        Args:
            inst_type (str): Instrument type (default: SPOT)
            
        Returns:
            List[Dict]: List of ticker data
        """
        inst_type = inst_type or self.inst_type
        
        url = config.get_api_url(
            config.TICKERS_ENDPOINT,
            {'instType': inst_type}
        )
        
        self.printer.info(f"Fetching tickers from: {url}")
        
        data = self._make_request(url)
        
        if data and 'data' in data:
            tickers = data['data']
            self.tickers_cache = tickers
            self.tickers_cache_time = time.time()
            
            self.printer.success(f"Fetched {len(tickers)} tickers")
            return tickers
        else:
            self.printer.error("Failed to fetch tickers")
            return []
    
    def fetch_ticker(self, inst_id: str) -> Optional[Dict]:
        """
        Fetch single ticker data
        
        Args:
            inst_id (str): Instrument ID (e.g., "BTC-USDT")
            
        Returns:
            Optional[Dict]: Ticker data or None
        """
        url = config.get_api_url(
            config.TICKER_ENDPOINT,
            {'instId': inst_id}
        )
        
        data = self._make_request(url)
        
        if data and 'data' in data and len(data['data']) > 0:
            return data['data'][0]
        
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
        cache_dir = Path(PROJECT_ROOT) / 'public' / 'uploads' / config.CACHE_DIR_NAME / config.CACHE_SUBDIR_NAME
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

