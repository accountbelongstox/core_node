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
    CoinProvider,
    Mode1PriceMonitor,
    Mode2Trader,
    TradingTimingAnalyzer,
    ContinuousMonitor
)

requests = None
continuous_monitor_instance = None

RPC_BASE_URL = 'http://127.0.0.1:58000'
BASE_PAGE_URL = 'https://www.okx.com/markets/prices/page/15'
FETCH_INTERVAL_MS = 1000
BATCH_SIZE = None  # None = fetch all at once, or set to 25 for batch fetching


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

    rpc_url = f"{RPC_BASE_URL}/rpc/browser/openUrl"

    payload = {
        'url': url,
        'matchMode': 'sameOrigin',
        'waitUntil': 'networkidle2',
        'timeout': 30000,
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
    ColorPrint.green("OKX PRICE MONITOR - CONTINUOUS MODE")
    ColorPrint.green("=" * 80)

    ColorPrint.blue(f"\nRPC Server: {RPC_BASE_URL}")
    ColorPrint.blue(f"Base Page URL: {BASE_PAGE_URL}")
    ColorPrint.blue(f"Fetch Interval: {FETCH_INTERVAL_MS}ms (every second)")

    ColorPrint.blue("\n[Step 1] Opening base page via RPC...")
    open_result = call_rpc_browser_open(BASE_PAGE_URL)

    page_id = open_result.get('pageId')
    tab_action = open_result.get('tabAction', 'unknown')

    ColorPrint.green(f"[Step 1] Page opened successfully")
    ColorPrint.green(f"  Page ID: {page_id}")
    ColorPrint.green(f"  Tab Action: {tab_action}")

    time.sleep(2)

    ColorPrint.blue("\n[Step 2] Initializing Coin Provider (Shared)...")
    coin_provider = CoinProvider(rpc_base_url=RPC_BASE_URL)

    ColorPrint.blue("\n[Step 3] Fetching coin list...")
    coins_info = coin_provider.get_coins_info(page_id)
    coin_names = coin_provider.get_coin_names(page_id)

    ColorPrint.green(f"[Step 3] Fetched {len(coin_names)} coins")
    ColorPrint.blue(f"  Sample coins: {', '.join(coin_names[:20])}...")

    ColorPrint.blue("\n[Step 4] Initializing Mode 1: Price Monitor...")
    mode1 = Mode1PriceMonitor(coin_provider, rpc_base_url=RPC_BASE_URL)

    # Use all coins from provider, with optional batch size
    batch_size = BATCH_SIZE if BATCH_SIZE else len(coin_names)
    mode1.set_currencies(coin_names, batch_size=batch_size)
    ColorPrint.blue(f"  Total currencies: {len(coin_names)}, Batch size: {batch_size}")

    ColorPrint.blue("\n[Step 5] Running initial fetch (one full tick)...")
    price_data = mode1.fetch_all_batches(page_id)
    if price_data:
        mode1.print_prices(price_data)

    ColorPrint.blue("\n[Step 6] Initializing Mode 2: Trading System...")
    mode2 = Mode2Trader(coin_provider, rpc_base_url=RPC_BASE_URL)
    timing_analyzer = TradingTimingAnalyzer()

    mode2.run(page_id)

    ColorPrint.blue("\n[Step 7] Running Trading Timing Analyzer...")
    analysis_result = timing_analyzer.analyze(price_data)

    ColorPrint.blue("\n[Step 8] Starting Continuous Monitor...")
    continuous_monitor_instance = ContinuousMonitor(
        mode1_monitor=mode1,
        fetch_interval=FETCH_INTERVAL_MS,
        max_history=1000,
        save_to_file=True
    )

    continuous_monitor_instance.initialize(page_id)
    continuous_monitor_instance.start()

    ColorPrint.green("\n" + "=" * 80)
    ColorPrint.green("OKX PRICE MONITOR RUNNING")
    ColorPrint.green("=" * 80)
    ColorPrint.yellow("\nContinuous monitoring active:")
    ColorPrint.yellow(f"  - Fetching prices every {FETCH_INTERVAL_MS}ms (1 second)")
    ColorPrint.yellow("  - Saving data to files")
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
