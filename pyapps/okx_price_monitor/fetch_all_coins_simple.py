#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple OKX Coin Fetcher

Fetches all coins from OKX API without complex dependencies.
"""

import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

import time
from pycore.pyfoundations.third_party.api import get_third_package_requests
from pycore.pyfoundations.secret_manager import get_secret_key

requests = get_third_package_requests()

OKX_API_V5_BASE = "https://www.okx.com/api/v5"
INSTRUMENTS_ENDPOINT = "/public/instruments"


def fetch_instruments(inst_type="SPOT"):
    """Fetch all instruments from OKX API"""
    url = f"{OKX_API_V5_BASE}{INSTRUMENTS_ENDPOINT}?instType={inst_type}"

    print(f"\n[INFO] Fetching instruments from OKX API...")
    print(f"[INFO] URL: {url}")

    response = requests.get(url, timeout=30)
    response.raise_for_status()

    data = response.json()

    if data.get('code') == '0':
        instruments = data.get('data', [])
        print(f"\n[SUCCESS] Fetched {len(instruments)} instruments")
        return instruments
    else:
        error_msg = data.get('msg', 'Unknown error')
        print(f"\n[ERROR] API returned error: {error_msg}")
        return []


def extract_coins(instruments):
    """Extract unique coin symbols from instruments"""
    coins = set()

    for inst in instruments:
        inst_id = inst.get('instId', '')
        if '-' in inst_id:
            base_coin = inst_id.split('-')[0]
            coins.add(base_coin)

    coin_list = sorted(list(coins))
    print(f"\n[INFO] Extracted {len(coin_list)} unique coins")

    return coin_list


def get_trading_pairs(instruments, quote_currency="USDT"):
    """Get trading pairs for specific quote currency"""
    pairs = []

    for inst in instruments:
        inst_id = inst.get('instId', '')
        if inst_id.endswith(f'-{quote_currency}'):
            pairs.append(inst_id)

    print(f"\n[INFO] Found {len(pairs)} {quote_currency} trading pairs")
    return pairs


def main():
    print("\n" + "=" * 80)
    print("OKX COIN LIST FETCHER (Simple Version)")
    print("=" * 80)

    api_key = get_secret_key('LOCAL_TEST_PASSWORD_1')
    secret_key = get_secret_key('LOCAL_TEST_API_KEY_1')

    if api_key and secret_key:
        print(f"\n[INFO] API credentials loaded:")
        print(f"  API Key: {api_key[:8]}...{api_key[-8:]}")
        print(f"  Secret Key: {secret_key[:4]}...{secret_key[-4:]}")
    else:
        print("\n[INFO] Using public API (no authentication)")

    instruments = fetch_instruments(inst_type="SPOT")

    if not instruments:
        print("\n[ERROR] Failed to fetch instruments")
        return

    coins = extract_coins(instruments)

    print("\n" + "=" * 80)
    print(f"ALL COINS (Total: {len(coins)})")
    print("=" * 80)

    for i, coin in enumerate(coins, 1):
        print(f"{i:4d}. {coin}")

    print("\n" + "=" * 80)
    print("FIRST 10 INSTRUMENTS (DETAILED)")
    print("=" * 80)

    for i, inst in enumerate(instruments[:10], 1):
        inst_id = inst.get('instId', 'N/A')
        base_ccy = inst.get('baseCcy', 'N/A')
        quote_ccy = inst.get('quoteCcy', 'N/A')
        state = inst.get('state', 'N/A')
        tick_sz = inst.get('tickSz', 'N/A')
        lot_sz = inst.get('lotSz', 'N/A')

        print(f"\n{i}. {inst_id}")
        print(f"   Base Currency: {base_ccy}")
        print(f"   Quote Currency: {quote_ccy}")
        print(f"   State: {state}")
        print(f"   Tick Size: {tick_sz}")
        print(f"   Lot Size: {lot_sz}")

    usdt_pairs = get_trading_pairs(instruments, "USDT")

    print("\n" + "=" * 80)
    print(f"USDT TRADING PAIRS (First 20 of {len(usdt_pairs)})")
    print("=" * 80)

    for i, pair in enumerate(usdt_pairs[:20], 1):
        print(f"{i:4d}. {pair}")

    print("\n" + "=" * 80)
    print("FETCH COMPLETE")
    print("=" * 80)


if __name__ == '__main__':
    main()
