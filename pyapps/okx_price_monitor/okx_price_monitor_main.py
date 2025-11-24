#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX Price Monitor Application

Monitors OKX cryptocurrency prices and trading data through RPC.
"""

import time
import signal
import sys
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests
from pyapps.okx_price_monitor.lib import (
    config,
    CoinProvider,
    Mode1PriceMonitor,
    Mode2Trader,
    TradingTimingAnalyzer,
    ContinuousMonitor
)

requests = None
continuous_monitor_instance = None


def call_rpc_browser_open(url):
    """
    Call RPC browser/openUrl endpoint

    Args:
        url (str): URL to open

    Returns:
        dict: Response with pageId
    """
    global requests
    if requests is None:
        requests = get_third_package_requests()

    rpc_url = f"{config.RPC_BASE_URL}/rpc/browser/openUrl"

    payload = {
        'url': url,
        'matchMode': 'sameOrigin',
        'waitUntil': config.WAIT_UNTIL,
        'timeout': config.REQUEST_TIMEOUT,
        'screenshot': False,
        'htmlContent': False
    }

    response = requests.post(rpc_url, json=payload, timeout=30)
    response.raise_for_status()

    result = response.json()

    if result.get('success') and result.get('result'):
        return result.get('result')
    elif not result.get('success'):
        raise Exception(f"Failed to open URL: {result.get('error')}")

    return result


def signal_handler(sig, frame):
    """
    Handle Ctrl+C signal
    """
    global continuous_monitor_instance

    ColorPrint.yellow("\n[Main] Received interrupt signal (Ctrl+C)")

    if continuous_monitor_instance:
        continuous_monitor_instance.stop()

    ColorPrint.green("\n[Main] Application stopped")
    sys.exit(0)


def start():
    """
    Start OKX Price Monitor application
    """
    global continuous_monitor_instance

    signal.signal(signal.SIGINT, signal_handler)

    ColorPrint.green("=" * 80)
    ColorPrint.green("OKX PRICE MONITOR - INTERCEPTED URL MODE")
    ColorPrint.green("=" * 80)

    # Print configuration
    config.print_config()

    ColorPrint.blue(f"\n[Step 1] Opening {len(config.BASE_PAGES)} pages to collect URLs...")

    page_ids = []
    for i, page_url in enumerate(config.BASE_PAGES, 1):
        ColorPrint.yellow(f"\n[Step 1.{i}] Opening page: {page_url}")
        open_result = call_rpc_browser_open(page_url)

        page_id = open_result.get('pageId')
        tab_action = open_result.get('tabAction', 'unknown')
        page_ids.append(page_id)

        ColorPrint.green(f"  Page ID: {page_id}, Tab Action: {tab_action}")
        time.sleep(3)  # Wait for page to load and URLs to be intercepted

        # Check intercepted URLs for this page
        rpc_url = f"{config.RPC_BASE_URL}/rpc/browser/getInterceptedApiUrls"
        payload = {'pageId': page_id, 'clearAfterGet': False}
        response = requests.post(rpc_url, json=payload, timeout=30)
        result = response.json()

        if result.get('success'):
            urls = result.get('urls', [])
            ColorPrint.blue(f"  ✅ Intercepted {len(urls)} URLs so far:")
            for j, url_obj in enumerate(urls[-3:], 1):  # Show last 3 URLs
                url = url_obj.get('url', '')
                status = url_obj.get('status', 'N/A')
                ColorPrint.yellow(f"    [{j}] Status {status}: {url[:120]}...")
        else:
            ColorPrint.red(f"  ❌ Failed to get intercepted URLs: {result.get('error')}")

    ColorPrint.green(f"[Step 1] All pages opened successfully")
    ColorPrint.green(f"  Total pages: {len(page_ids)}")

    # Use the first page ID for subsequent operations
    page_id = page_ids[0]

    ColorPrint.blue("\n[Step 2] Initializing Coin Provider (Shared)...")
    coin_provider = CoinProvider(rpc_base_url=config.RPC_BASE_URL)

    ColorPrint.blue("\n[Step 3] Fetching coin list...")
    coins_info = coin_provider.get_coins_info(page_id)
    coin_names = coin_provider.get_coin_names(page_id)

    ColorPrint.green(f"[Step 3] Fetched {len(coin_names)} coins")
    ColorPrint.blue(f"  Sample coins: {', '.join(coin_names[:20])}...")

    ColorPrint.blue("\n[Step 4] Initializing Mode 1: Price Monitor...")
    mode1 = Mode1PriceMonitor(coin_provider, rpc_base_url=config.RPC_BASE_URL)

    # Use all coins from provider, with batch size from config
    batch_size = config.get_batch_size(len(coin_names))
    mode1.set_currencies(coin_names, batch_size=batch_size)
    ColorPrint.blue(f"  Total currencies: {len(coin_names)}, Batch size: {batch_size}")

    ColorPrint.blue(f"\n[Step 5] Running initial fetch (mode: {config.FETCH_MODE.upper()})...")
    if config.FETCH_MODE == 'intercepted':
        price_data = mode1.fetch_from_intercepted_urls(page_id)
    elif config.FETCH_MODE == 'single_url':
        price_data = mode1.fetch_all_single_url(page_id)
    elif config.FETCH_MODE == 'concurrent':
        price_data = mode1.fetch_all_batches_concurrent(page_id, concurrency=config.CONCURRENCY)
    else:  # sequential
        price_data = mode1.fetch_all_batches(page_id)

    if price_data:
        mode1.print_prices(price_data)

    ColorPrint.blue("\n[Step 6] Initializing Mode 2: Trading System...")
    mode2 = Mode2Trader(coin_provider, rpc_base_url=config.RPC_BASE_URL)
    timing_analyzer = TradingTimingAnalyzer()

    mode2.run(page_id)

    ColorPrint.blue("\n[Step 7] Running Trading Timing Analyzer...")
    analysis_result = timing_analyzer.analyze(price_data)

    ColorPrint.blue("\n[Step 8] Starting Continuous Monitor...")
    continuous_monitor_instance = ContinuousMonitor(
        mode1_monitor=mode1,
        fetch_interval=config.FETCH_INTERVAL_MS,
        max_history=config.MAX_HISTORY,
        save_to_file=config.SAVE_TO_FILE,
        fetch_mode=config.FETCH_MODE,
        concurrency=config.CONCURRENCY
    )

    continuous_monitor_instance.initialize(page_id)
    continuous_monitor_instance.start()

    ColorPrint.green("\n" + "=" * 80)
    ColorPrint.green("OKX PRICE MONITOR RUNNING")
    ColorPrint.green("=" * 80)
    ColorPrint.yellow("\nContinuous monitoring active:")
    ColorPrint.yellow(f"  - Total currencies: {len(coin_names)}")
    ColorPrint.yellow(f"  - Fetch mode: {config.FETCH_MODE.upper()}")

    if config.FETCH_MODE == 'intercepted':
        ColorPrint.yellow(f"  - Using intercepted URLs from {len(config.BASE_PAGES)} pages")
        ColorPrint.yellow("  - All currencies merged in single request")
    elif config.FETCH_MODE == 'single_url':
        ColorPrint.yellow("  - All currencies in single URL request")
    elif config.FETCH_MODE == 'concurrent':
        total_batches = (len(coin_names) + batch_size - 1) // batch_size
        ColorPrint.yellow(f"  - Batch size: {batch_size} ({total_batches} batches per tick)")
        ColorPrint.yellow(f"  - Concurrency: {config.CONCURRENCY}")
    else:  # sequential
        total_batches = (len(coin_names) + batch_size - 1) // batch_size
        ColorPrint.yellow(f"  - Batch size: {batch_size} ({total_batches} batches per tick)")

    ColorPrint.yellow(f"  - Tick interval: {config.FETCH_INTERVAL_MS}ms")
    ColorPrint.yellow(f"  - Saving data: {config.SAVE_TO_FILE}")
    ColorPrint.yellow("  - Press Ctrl+C to stop")
    ColorPrint.green("=" * 80)

    try:
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        signal_handler(None, None)


def main():
    """
    Main entry point (fallback)
    """
    start()


if __name__ == '__main__':
    start()
