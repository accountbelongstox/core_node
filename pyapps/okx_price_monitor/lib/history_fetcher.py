#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
History Fetcher - Historical Data Retrieval

Fetches historical candle data from OKX API.
Handles pagination and rate limiting.
"""

import time
from typing import List, Dict, Optional, Tuple

from pyapps.okx_price_monitor.lib.okx_client import OKXClient
from pyapps.okx_price_monitor.lib.rate_limiter import get_rate_limiter
from pyapps.okx_price_monitor.lib.coin_table_manager import CoinTableManager


class HistoryFetcher:
    """
    History Fetcher

    Fetches historical candle data with rate limiting.
    Supports batch fetching and automatic pagination.
    """

    def __init__(self, okx_client: OKXClient, coin_table_manager: CoinTableManager):
        """
        Initialize history fetcher

        Args:
            okx_client (OKXClient): OKX API client
            coin_table_manager (CoinTableManager): Coin table manager
        """
        self.okx_client = okx_client
        self.coin_table_manager = coin_table_manager
        self.rate_limiter = get_rate_limiter()

    def fetch_candles_batch(
        self,
        inst_id: str,
        bar: str = "1H",
        limit: int = 100,
        after: Optional[str] = None,
        before: Optional[str] = None
    ) -> Tuple[List[List], Optional[str], Dict]:
        """
        Fetch single batch of candles

        Args:
            inst_id (str): Instrument ID (e.g., "BTC-USDT")
            bar (str): Bar size (1m, 5m, 15m, 1H, 4H, 1D, etc.)
            limit (int): Number of candles to fetch (max 100 for history, 300 for recent)
            after (Optional[str]): Pagination - get data after this timestamp
            before (Optional[str]): Pagination - get data before this timestamp

        Returns:
            tuple[List[List], Optional[str], Dict]: (candles, next_after_timestamp, rate_info)
        """
        # Acquire rate limiter (returns timing info)
        acquire_info = self.rate_limiter.acquire()

        # Build request parameters
        params = {
            'inst_id': inst_id,
            'bar': bar,
            'limit': str(limit)
        }

        # Add pagination parameters if provided
        if after:
            params['after'] = after
        if before:
            params['before'] = before

        # Make the API request
        request_start = time.time()
        response = self.okx_client.get_candles(**params)
        request_duration = time.time() - request_start

        # Get current rate stats
        rate_stats = self.rate_limiter.get_stats()

        # Build rate info
        rate_info = {
            'wait_time': acquire_info.get('wait_time', 0),
            'request_duration': request_duration,
            'actual_rate': rate_stats.get('actual_rate', 0),
            'overall_rate': rate_stats.get('overall_rate', 0),
            'requests_in_window': rate_stats.get('requests_in_window', 0),
            'max_requests': rate_stats.get('max_requests', 20),
            'is_throttled': rate_stats.get('is_throttled', False)
        }

        if response.get('code') != '0':
            return [], None, rate_info

        candles = response.get('data', [])

        if not candles:
            return [], None, rate_info

        oldest_timestamp = candles[-1][0] if candles else None

        return candles, oldest_timestamp, rate_info

    def fetch_history(
        self,
        inst_id: str,
        target_count: int = 100000,
        bar: str = "1H",
        batch_size: int = 100
    ) -> Dict:
        """
        Fetch historical candles for an instrument
        Intelligently continues from oldest timestamp in database

        Args:
            inst_id (str): Instrument ID
            target_count (int): Target number of candles to fetch
            bar (str): Bar size
            batch_size (int): Candles per batch

        Returns:
            Dict: Statistics including total fetched, inserted, etc.
        """
        coin_symbol = inst_id.split('-')[0]

        self.coin_table_manager.create_table_if_not_exists(coin_symbol)

        existing_count = self.coin_table_manager.get_record_count(coin_symbol)
        oldest_timestamp = self.coin_table_manager.get_oldest_timestamp(coin_symbol)

        print(f"[INFO] {inst_id}: Existing records: {existing_count}")

        # Check if we already have enough data
        if existing_count >= target_count:
            print(f"[SKIP] {inst_id}: Already have {existing_count} records (target: {target_count})")
            return {
                'inst_id': inst_id,
                'coin_symbol': coin_symbol,
                'target_count': target_count,
                'existing_count': existing_count,
                'fetched': 0,
                'inserted': 0,
                'batches': 0,
                'skipped': True
            }

        total_fetched = 0
        total_inserted = 0
        batch_count = 0

        # Start from oldest timestamp if we have data
        # OKX API: 'after' means get data BEFORE this timestamp (going backwards in time)
        after_timestamp = str(oldest_timestamp) if oldest_timestamp else None

        needed = target_count - existing_count

        if oldest_timestamp:
            oldest_date = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(oldest_timestamp / 1000))
            print(f"[CONTINUE] {inst_id}: Fetching {needed} more records from before {oldest_date}")
        else:
            print(f"[START] {inst_id}: Fetching {needed} records (new table)")

        while total_fetched < needed:
            batch_count += 1

            candles, next_after, rate_info = self.fetch_candles_batch(
                inst_id=inst_id,
                bar=bar,
                limit=batch_size,
                after=after_timestamp
            )

            if not candles:
                print(f"[INFO] {inst_id}: No more data available from OKX")
                break

            total_fetched += len(candles)

            # Insert candles (UNIQUE constraint will skip duplicates)
            inserted = self.coin_table_manager.insert_candles(coin_symbol, candles)
            total_inserted += inserted

            # Update after_timestamp for next batch
            after_timestamp = next_after

            # Progress report every 10 batches with detailed rate information
            if batch_count % 10 == 0:
                actual_rate = rate_info.get('actual_rate', 0)
                overall_rate = rate_info.get('overall_rate', 0)
                wait_time = rate_info.get('wait_time', 0)
                req_duration = rate_info.get('request_duration', 0)
                in_window = rate_info.get('requests_in_window', 0)
                max_req = rate_info.get('max_requests', 20)
                throttled = rate_info.get('is_throttled', False)

                # Format rate display
                throttle_mark = "WARNING" if throttled else "OK"

                print(
                    f"[PROGRESS] {inst_id}: Batch {batch_count:3d}, "
                    f"Fetched {total_fetched:5d}, Inserted {total_inserted:5d} | "
                    f"Rate: {in_window:2d}/{max_req} {throttle_mark} | "
                    f"Speed: {actual_rate:4.1f} req/s | "
                    f"API: {req_duration*1000:4.0f}ms, Wait: {wait_time*1000:4.0f}ms"
                )

            # Stop if we reached the end
            if not next_after:
                print(f"[INFO] {inst_id}: Reached end of available history")
                break

        final_count = self.coin_table_manager.get_record_count(coin_symbol)

        print(
            f"[SUCCESS] {inst_id}: Complete - "
            f"Fetched {total_fetched}, Inserted {total_inserted}, "
            f"Total in DB: {final_count}"
        )

        return {
            'inst_id': inst_id,
            'coin_symbol': coin_symbol,
            'target_count': target_count,
            'existing_count': existing_count,
            'fetched': total_fetched,
            'inserted': total_inserted,
            'batches': batch_count,
            'final_count': final_count,
            'skipped': False
        }

    def fetch_all_coins_history(
        self,
        coin_list: List[str],
        quote_currency: str = "USDT",
        target_count: int = 100000,
        bar: str = "1H"
    ) -> List[Dict]:
        """
        Fetch history for all coins

        Args:
            coin_list (List[str]): List of coin symbols
            quote_currency (str): Quote currency
            target_count (int): Target records per coin
            bar (str): Bar size

        Returns:
            List[Dict]: List of results for each coin
        """
        results = []

        for i, coin in enumerate(coin_list, 1):
            inst_id = f"{coin}-{quote_currency}"

            print(f"\n{'='*80}")
            print(f"[{i}/{len(coin_list)}] Processing {inst_id}")
            print(f"{'='*80}")

            try:
                result = self.fetch_history(
                    inst_id=inst_id,
                    target_count=target_count,
                    bar=bar
                )
                results.append(result)

            except Exception as e:
                print(f"[ERROR] {inst_id}: {e}")
                results.append({
                    'inst_id': inst_id,
                    'coin_symbol': coin,
                    'error': str(e),
                    'skipped': True
                })

        return results
