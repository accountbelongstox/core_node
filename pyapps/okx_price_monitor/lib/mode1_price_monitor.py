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
from pyapps.okx_price_monitor.lib.rpc_utils import parse_rpc_response

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

    def _call_rpc_get_intercepted_urls(self, page_id, clear_after_get=True):
        """
        Get intercepted API URLs from backend

        Args:
            page_id (str): Page ID
            clear_after_get (bool): Clear URLs after getting them

        Returns:
            list: List of intercepted URL objects
        """
        rpc_url = f"{self.rpc_base_url}/rpc/browser/getInterceptedApiUrls"

        payload = {
            'pageId': page_id,
            'clearAfterGet': clear_after_get
        }

        response = requests.post(rpc_url, json=payload, timeout=30)
        response.raise_for_status()

        result = response.json()
        actual_data = parse_rpc_response(result)
        return actual_data.get('urls', [])

    def _extract_currencies_from_url(self, url):
        """
        Extract currencies from URL

        Args:
            url (str): API URL containing currencies parameter

        Returns:
            list: List of currencies
        """
        import urllib.parse

        try:
            parsed_url = urllib.parse.urlparse(url)
            query_params = urllib.parse.parse_qs(parsed_url.query)

            currencies_param = query_params.get('currencies', [''])[0]
            if currencies_param:
                # Split by comma
                currencies = [c.strip() for c in currencies_param.split(',')]
                return currencies
        except Exception as e:
            ColorPrint.red(f"[Mode1] Failed to extract currencies from URL: {e}")

        return []

    def _merge_intercepted_urls(self, intercepted_urls):
        """
        Merge all intercepted URLs into single currency list

        Args:
            intercepted_urls (list): List of intercepted URL objects

        Returns:
            list: Merged list of unique currencies
        """
        all_currencies = []

        for url_obj in intercepted_urls:
            url = url_obj.get('url', '')
            currencies = self._extract_currencies_from_url(url)
            all_currencies.extend(currencies)

        # Remove duplicates while preserving order
        unique_currencies = []
        seen = set()
        for currency in all_currencies:
            if currency and currency not in seen:
                unique_currencies.append(currency)
                seen.add(currency)

        return unique_currencies

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

        # Use comma to join currencies, URL encoding will be handled by browser
        currencies_param = ','.join(batch_currencies)
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
        Fetch all batches to complete one tick (SEQUENTIAL)

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

        ColorPrint.blue(f"[Mode1] Starting tick #{self.tick_count + 1}: {total_batches} batch(es), {len(self.currencies)} currencies (SEQUENTIAL)")

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

    def fetch_all_batches_concurrent(self, page_id, concurrency=10):
        """
        Fetch all batches concurrently (PARALLEL)

        Uses browser's batch API to fetch all batches in parallel.
        Much faster than sequential fetching.

        Args:
            page_id (str): Page ID from browser manager
            concurrency (int): Number of concurrent requests (default: 10)

        Returns:
            dict: Combined price data with all currencies
        """
        if not self.currencies:
            ColorPrint.red("[Mode1] No currencies configured")
            return None

        total_batches = self._get_total_batches()
        timestamp = self._get_timestamp()
        period = config.DEFAULT_PERIOD

        # Build all batch URLs with unique timestamps
        batch_urls = []
        for batch_idx in range(total_batches):
            batch_currencies = self._get_batch_currencies(batch_idx)
            # Use comma to join currencies, browser will handle URL encoding
            currencies_param = ','.join(batch_currencies)
            # Use unique timestamp for each batch to ensure URL uniqueness
            batch_timestamp = timestamp + batch_idx
            api_url = f"{config.PRICE_TREND_API_URL}?currencies={currencies_param}&period={period}&t={batch_timestamp}"
            batch_urls.append(api_url)

        ColorPrint.blue(f"[Mode1] Starting tick #{self.tick_count + 1}: {total_batches} batch(es), {len(self.currencies)} currencies (CONCURRENT, concurrency={concurrency})")

        # Use RPC batch API
        rpc_url = f"{self.rpc_base_url}/rpc/browser/injectBatchAPIRequestsAndMerge"
        payload = {
            'pageId': page_id,
            'apiUrls': batch_urls,
            'method': 'GET',
            'responseType': 'json',
            'timeout': 30000,
            'concurrency': concurrency
        }

        response = requests.post(rpc_url, json=payload, timeout=60)
        response.raise_for_status()
        result = response.json()

        batch_result = parse_rpc_response(result)

        # Extract merged data
        merged_data = batch_result.get('data', [])

        self.tick_count += 1

        ColorPrint.green(f"[Mode1] Tick #{self.tick_count} complete (CONCURRENT): "
                       f"{batch_result.get('mergedCount', 0)} price records from "
                       f"{batch_result.get('successful', 0)}/{batch_result.get('total', 0)} successful requests")

        return {
            'data': merged_data,
            'tick': self.tick_count,
            'method': 'concurrent',
            'total_requests': batch_result.get('total', 0),
            'successful_requests': batch_result.get('successful', 0),
            'failed_requests': batch_result.get('failed', 0)
        }

    def fetch_all_single_url(self, page_id):
        """
        Fetch all currencies in a single URL request (NEW MODE)

        All currencies are compiled into one URL and fetched in a single request.
        This is the most efficient method if the URL length is acceptable.

        Args:
            page_id (str): Page ID from browser manager

        Returns:
            dict: Combined price data with all currencies
        """
        if not self.currencies:
            ColorPrint.red("[Mode1] No currencies configured")
            return None

        timestamp = self._get_timestamp()
        period = config.DEFAULT_PERIOD

        # Build single URL with ALL currencies
        # Use comma (,) to join currencies, URL encoding will be handled by browser
        currencies_param = ','.join(self.currencies)
        api_url = f"{config.PRICE_TREND_API_URL}?currencies={currencies_param}&period={period}&t={timestamp}"

        # Log URL info
        url_length = len(api_url)
        ColorPrint.blue(f"[Mode1] Starting tick #{self.tick_count + 1}: {len(self.currencies)} currencies (SINGLE_URL)")
        ColorPrint.blue(f"[Mode1] URL length: {url_length} characters")
        ColorPrint.yellow(f"[Mode1] Full URL:")
        ColorPrint.yellow(f"  {api_url}")
        ColorPrint.yellow(f"[Mode1] Currency parameter:")
        ColorPrint.yellow(f"  {currencies_param}")

        # Fetch data using single URL
        try:
            data = self._call_rpc_browser_inject(page_id, api_url)

            if data:
                if isinstance(data, dict) and 'data' in data:
                    all_data = data['data']
                elif isinstance(data, list):
                    all_data = data
                else:
                    ColorPrint.red(f"[Mode1] Unexpected data format: {type(data)}")
                    return None

                self.tick_count += 1

                ColorPrint.green(f"[Mode1] Tick #{self.tick_count} complete (SINGLE_URL): "
                               f"{len(all_data)} price records fetched")

                return {
                    'data': all_data,
                    'tick': self.tick_count,
                    'method': 'single_url',
                    'url_length': url_length,
                    'total_currencies': len(self.currencies)
                }
            else:
                ColorPrint.red("[Mode1] No data returned from single URL request")
                return None

        except Exception as e:
            ColorPrint.red(f"[Mode1] Single URL fetch failed: {str(e)}")
            return None

    def fetch_from_intercepted_urls(self, page_id, batch_group=0):
        """
        Fetch prices using intercepted URLs from backend (INTERCEPTED MODE)

        Uses original intercepted URLs directly, split into batches.
        Two batches complete = 1 tick.

        Args:
            page_id (str): Page ID from browser manager
            batch_group (int): Which batch group to request (0 or 1)

        Returns:
            dict: Combined price data from all URLs in this batch
        """
        ColorPrint.blue(f"[Mode1] Fetching batch group {batch_group + 1}/{config.URL_BATCH_GROUPS} (INTERCEPTED_MODE)")

        try:
            # Get intercepted URLs from backend (don't clear yet)
            ColorPrint.blue(f"[Mode1] Fetching intercepted URLs from backend (pageId: {page_id})...")
            intercepted_urls = self._call_rpc_get_intercepted_urls(page_id, clear_after_get=False)

            if not intercepted_urls:
                ColorPrint.yellow("[Mode1] No intercepted URLs found, backend may not have captured any yet")
                return None

            ColorPrint.green(f"[Mode1] Retrieved {len(intercepted_urls)} intercepted URLs")

            # Split URLs into batch groups
            urls_per_group = (len(intercepted_urls) + config.URL_BATCH_GROUPS - 1) // config.URL_BATCH_GROUPS
            start_idx = batch_group * urls_per_group
            end_idx = min(start_idx + urls_per_group, len(intercepted_urls))
            batch_urls = intercepted_urls[start_idx:end_idx]

            if not batch_urls:
                ColorPrint.yellow(f"[Mode1] No URLs in batch group {batch_group}")
                return None

            ColorPrint.blue(f"[Mode1] Using URLs {start_idx + 1} to {end_idx} ({len(batch_urls)} URLs)")

            # Display batch URLs
            ColorPrint.blue(f"\n[Mode1] === BATCH GROUP {batch_group + 1} URLs ===")
            for i, url_obj in enumerate(batch_urls, 1):
                url = url_obj.get('url', '')
                status = url_obj.get('status', 'N/A')
                ColorPrint.yellow(f"[Mode1] URL #{i} (status: {status}):")
                ColorPrint.yellow(f"  {url}")
            ColorPrint.blue("[Mode1] === END OF BATCH URLs ===\n")

            # Extract URLs for batch request
            api_urls = [url_obj.get('url') for url_obj in batch_urls]

            # Use batch API request with merge
            ColorPrint.blue(f"[Mode1] Requesting {len(api_urls)} URLs concurrently...")
            rpc_url = f"{self.rpc_base_url}/rpc/browser/injectBatchAPIRequestsAndMerge"

            payload = {
                'pageId': page_id,
                'apiUrls': api_urls,
                'method': 'GET',
                'responseType': 'json',
                'timeout': 30000,
                'concurrency': 5
            }

            response = requests.post(rpc_url, json=payload, timeout=60)
            response.raise_for_status()

            result = response.json()
            batch_result = parse_rpc_response(result)

            # Extract merged data
            merged_data = batch_result.get('data', [])

            ColorPrint.green(f"[Mode1] Batch group {batch_group + 1} complete: "
                           f"{len(merged_data)} price records from "
                           f"{batch_result.get('successful', 0)}/{batch_result.get('total', 0)} successful requests")

            return {
                'data': merged_data,
                'batch_group': batch_group,
                'total_urls': len(api_urls),
                'successful_requests': batch_result.get('successful', 0),
                'failed_requests': batch_result.get('failed', 0)
            }

        except Exception as e:
            ColorPrint.red(f"[Mode1] Intercepted URL fetch failed: {str(e)}")
            import traceback
            ColorPrint.red(traceback.format_exc())
            return None

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
            ColorPrint.yellow(f"Full data: {str(price_data)}")
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
