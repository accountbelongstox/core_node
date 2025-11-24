#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX Price Monitor - Mode 1

Mode 1: Price Monitoring
Fetches current prices for selected currencies with batch support.
"""

import time
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyfoundations.color_print import ColorPrint
from pyapps.okx_price_monitor.lib.config import config

requests = None


class Mode1PriceMonitor:
    """
    Mode 1: Price Monitor

    Monitors cryptocurrency prices from OKX with batch fetching support.
    All batches complete = 1 tick.
    """

    def __init__(self, coin_provider, rpc_base_url=None):
        global requests
        if requests is None:
            requests = get_third_package_requests()

        self.coin_provider = coin_provider
        self.rpc_base_url = rpc_base_url or config.RPC_BASE_URL
        self.currencies = []
        self.batch_size = None  # Will be set by set_currencies
        self.current_batch_index = 0
        self.tick_count = 0

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

    def set_currencies(self, currencies, batch_size=None):
        """
        Set currencies to monitor with optional batch size

        Args:
            currencies (list): List of currency symbols
            batch_size (int): Batch size for fetching (None = all at once)
        """
        self.currencies = currencies
        self.batch_size = batch_size if batch_size else len(currencies)
        self.current_batch_index = 0

        total_batches = self._get_total_batches()
        ColorPrint.blue(f"[Mode1] Monitoring {len(currencies)} currencies")
        ColorPrint.blue(f"[Mode1] Batch size: {self.batch_size}, Total batches per tick: {total_batches}")

    def _get_total_batches(self):
        """
        Get total number of batches

        Returns:
            int: Total batches
        """
        if not self.currencies:
            return 0
        return (len(self.currencies) + self.batch_size - 1) // self.batch_size

    def _get_batch_currencies(self, batch_index):
        """
        Get currencies for a specific batch

        Args:
            batch_index (int): Batch index (0-based)

        Returns:
            list: Currencies for this batch
        """
        start = batch_index * self.batch_size
        end = min(start + self.batch_size, len(self.currencies))
        return self.currencies[start:end]

    def fetch_batch(self, page_id, batch_currencies):
        """
        Fetch prices for a specific batch of currencies

        Args:
            page_id (str): Page ID from browser manager
            batch_currencies (list): List of currency symbols for this batch

        Returns:
            dict: Price data response for this batch
        """
        if not batch_currencies:
            return None

        currencies_param = '%2C'.join(batch_currencies)
        timestamp = self._get_timestamp()
        period = config.DEFAULT_PERIOD

        api_url = f"{config.PRICE_TREND_API_URL}?currencies={currencies_param}&period={period}&t={timestamp}"

        data = self._call_rpc_browser_inject(page_id, api_url)
        return data

    def fetch_prices(self, page_id):
        """
        Fetch current prices for all configured currencies (single batch, legacy)

        Args:
            page_id (str): Page ID from browser manager

        Returns:
            dict: Price data response
        """
        if not self.currencies:
            ColorPrint.red("[Mode1] No currencies configured")
            return None

        ColorPrint.blue(f"[Mode1] Fetching prices for {len(self.currencies)} currencies")
        return self.fetch_batch(page_id, self.currencies)

    def fetch_all_batches(self, page_id):
        """
        Fetch all batches to complete one tick

        All batches fetched = 1 complete tick.

        Args:
            page_id (str): Page ID from browser manager

        Returns:
            dict: Combined price data with all currencies
        """
        if not self.currencies:
            ColorPrint.red("[Mode1] No currencies configured")
            return None

        total_batches = self._get_total_batches()
        all_data = []
        batch_delay = config.get_batch_delay_seconds()

        ColorPrint.blue(f"[Mode1] Starting tick #{self.tick_count + 1}: {total_batches} batch(es), {len(self.currencies)} currencies")

        for batch_idx in range(total_batches):
            batch_currencies = self._get_batch_currencies(batch_idx)

            if total_batches > 1:
                ColorPrint.blue(f"[Mode1] Batch {batch_idx + 1}/{total_batches}: {len(batch_currencies)} currencies")

            batch_data = self.fetch_batch(page_id, batch_currencies)

            if batch_data and 'data' in batch_data:
                all_data.extend(batch_data['data'])
            elif batch_data and isinstance(batch_data, list):
                all_data.extend(batch_data)

            # Delay between batches (except last one)
            if batch_idx < total_batches - 1 and batch_delay > 0:
                time.sleep(batch_delay)

        self.tick_count += 1
        ColorPrint.green(f"[Mode1] Tick #{self.tick_count} complete: {len(all_data)} price records")

        return {'data': all_data, 'tick': self.tick_count}

    def print_prices(self, price_data):
        """
        Print price data in a readable format

        Args:
            price_data (dict): Price data from API
        """
        if not price_data:
            ColorPrint.red("[Mode1] No price data available")
            return

        ColorPrint.green("\n" + "=" * 80)
        ColorPrint.green("PRICE DATA")
        ColorPrint.green("=" * 80)

        if 'data' in price_data:
            data_list = price_data['data']
        elif isinstance(price_data, list):
            data_list = price_data
        else:
            ColorPrint.red(f"[Mode1] Unexpected data format: {type(price_data)}")
            ColorPrint.yellow(f"Data preview: {str(price_data)[:200]}")
            return

        ColorPrint.blue(f"\n[Mode1] Processing {len(data_list)} price items")

        for item in data_list:
            currency = item.get('coin') or item.get('currency') or item.get('symbol', 'N/A')

            trend = item.get('trend', [])
            if trend and len(trend) > 0:
                latest_price = trend[-1][1] if len(trend[-1]) > 1 else 'N/A'
                oldest_price = trend[0][1] if len(trend[0]) > 1 else 'N/A'

                if latest_price != 'N/A' and oldest_price != 'N/A':
                    try:
                        latest_float = float(latest_price)
                        oldest_float = float(oldest_price)
                        change_percent = ((latest_float - oldest_float) / oldest_float) * 100
                        change_24h = f"{change_percent:.2f}%"
                    except:
                        change_24h = 'N/A'
                else:
                    change_24h = 'N/A'

                price = latest_price
            else:
                price = item.get('price') or item.get('last') or 'N/A'
                change_24h = item.get('change24h') or item.get('changePercent') or 'N/A'

            volume_24h = item.get('volume24h') or item.get('vol24h') or 'N/A'
            trend_count = len(trend) if trend else 0

            try:
                if change_24h != 'N/A' and '-' in str(change_24h):
                    change_color = ColorPrint.red
                else:
                    change_color = ColorPrint.green
            except:
                change_color = ColorPrint.blue

            ColorPrint.blue(f"\nCurrency: {currency}")
            print(f"  Current Price: {price}")
            change_color(f"  24h Change: {change_24h}")
            print(f"  Data Points: {trend_count}")
            if volume_24h != 'N/A':
                print(f"  24h Volume: {volume_24h}")

        ColorPrint.green("\n" + "=" * 80)

    def run(self, page_id):
        """
        Run price monitoring

        Args:
            page_id (str): Page ID from browser manager

        Returns:
            dict: Price data
        """
        ColorPrint.green("\n=== Mode 1: Price Monitor ===")

        price_data = self.fetch_prices(page_id)

        if price_data:
            self.print_prices(price_data)

        return price_data
