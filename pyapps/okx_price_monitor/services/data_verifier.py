#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Data Verifier - Verify Data Completeness and Continuity

Features:
- Verify data exists in specified time range
- Check for gaps in data (continuity)
- Random sampling to avoid performance impact
- Detailed verification report
"""

import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple


class DataVerifier:
    """
    Data verification for historical price data

    Verifies:
    1. Data coverage (time range completeness)
    2. Data continuity (no large gaps)
    3. Data count matches expected
    """

    def __init__(self, db_manager, max_gap_minutes: int = 10):
        """
        Initialize data verifier

        Args:
            db_manager: Database manager instance
            max_gap_minutes: Maximum allowed gap between data points
        """
        self.db_manager = db_manager
        self.max_gap_minutes = max_gap_minutes
        self.verification_done = False  # Flag to ensure only one verification per session

    def verify_coin_data(self, coin_symbol: str, start_time: datetime,
                        end_time: datetime) -> Dict:
        """
        Verify data completeness and continuity for a single coin

        Args:
            coin_symbol: Coin symbol to verify
            start_time: Expected start time
            end_time: Expected end time

        Returns:
            Dict: Verification result with details
        """
        import sys

        print(f"\n{'='*80}")
        print(f"DATA VERIFICATION: {coin_symbol}")
        print(f"{'='*80}")
        sys.stdout.flush()

        # Convert to milliseconds
        start_ts_ms = int(start_time.timestamp() * 1000)
        end_ts_ms = int(end_time.timestamp() * 1000)

        # Get data from database
        print(f"[1/5] Fetching data from database...")
        sys.stdout.flush()

        records = self.db_manager.get_price_history(
            coin_symbol=coin_symbol,
            start_time_ms=start_ts_ms,
            end_time_ms=end_ts_ms,
            limit=10000
        )

        print(f"      Found {len(records)} records")
        sys.stdout.flush()

        if len(records) == 0:
            print(f"[FAIL] No data found for {coin_symbol}")
            sys.stdout.flush()
            return {
                'success': False,
                'coin': coin_symbol,
                'error': 'No data found',
                'record_count': 0
            }

        # Check 1: Time range coverage
        print(f"\n[2/5] Checking time range coverage...")
        sys.stdout.flush()

        oldest_ts = records[0]['timestamp_ms']
        latest_ts = records[-1]['timestamp_ms']
        oldest_dt = datetime.fromtimestamp(oldest_ts / 1000)
        latest_dt = datetime.fromtimestamp(latest_ts / 1000)

        print(f"      Expected range: {start_time.strftime('%Y-%m-%d %H:%M')} to {end_time.strftime('%Y-%m-%d %H:%M')}")
        print(f"      Actual range:   {oldest_dt.strftime('%Y-%m-%d %H:%M')} to {latest_dt.strftime('%Y-%m-%d %H:%M')}")
        sys.stdout.flush()

        # Check if coverage is sufficient (allow small tolerance)
        start_gap_minutes = (oldest_ts - start_ts_ms) / 1000 / 60
        end_gap_minutes = (end_ts_ms - latest_ts) / 1000 / 60

        coverage_ok = True
        if start_gap_minutes > self.max_gap_minutes:
            print(f"      [WARN] Missing {start_gap_minutes:.1f} minutes at start")
            sys.stdout.flush()
            coverage_ok = False

        if end_gap_minutes > self.max_gap_minutes:
            print(f"      [WARN] Missing {end_gap_minutes:.1f} minutes at end")
            sys.stdout.flush()
            coverage_ok = False

        if coverage_ok:
            print(f"      [OK] Time range coverage is complete")
            sys.stdout.flush()

        # Check 2: Data continuity (gaps)
        print(f"\n[3/5] Checking data continuity (gaps)...")
        sys.stdout.flush()

        gaps = []
        prev_ts = records[0]['timestamp_ms']

        for i, record in enumerate(records[1:], 1):
            current_ts = record['timestamp_ms']
            gap_minutes = (current_ts - prev_ts) / 1000 / 60

            if gap_minutes > self.max_gap_minutes:
                gap_start = datetime.fromtimestamp(prev_ts / 1000)
                gap_end = datetime.fromtimestamp(current_ts / 1000)
                gaps.append({
                    'index': i,
                    'gap_minutes': gap_minutes,
                    'gap_start': gap_start,
                    'gap_end': gap_end
                })

            prev_ts = current_ts

        if len(gaps) == 0:
            print(f"      [OK] No gaps found (all data points < {self.max_gap_minutes} min apart)")
            sys.stdout.flush()
        else:
            print(f"      [WARN] Found {len(gaps)} gap(s) larger than {self.max_gap_minutes} minutes:")
            sys.stdout.flush()
            for gap in gaps[:5]:  # Show first 5 gaps
                print(f"         Gap #{gap['index']}: {gap['gap_minutes']:.1f} min "
                      f"({gap['gap_start'].strftime('%m-%d %H:%M')} to {gap['gap_end'].strftime('%m-%d %H:%M')})")
                sys.stdout.flush()
            if len(gaps) > 5:
                print(f"         ... and {len(gaps) - 5} more gap(s)")
                sys.stdout.flush()

        # Check 3: Expected data count
        print(f"\n[4/5] Checking expected data count...")
        sys.stdout.flush()

        # Calculate expected candles (approximate)
        time_span_hours = (end_ts_ms - start_ts_ms) / 1000 / 3600
        expected_1m_candles = int(time_span_hours * 60)
        expected_5m_candles = int(time_span_hours * 12)

        # Assume hybrid: 2 days of 5m + 1 day of 1m
        if time_span_hours >= 48:
            expected_total = (48 * 12) + (time_span_hours - 48) * 60
        else:
            expected_total = time_span_hours * 60

        actual_count = len(records)
        coverage_percent = (actual_count / expected_total) * 100 if expected_total > 0 else 0

        print(f"      Expected candles (approx): {int(expected_total)}")
        print(f"      Actual candles:            {actual_count}")
        print(f"      Coverage:                  {coverage_percent:.1f}%")
        sys.stdout.flush()

        count_ok = coverage_percent >= 90  # 90% coverage is acceptable
        if count_ok:
            print(f"      [OK] Data count is sufficient (>= 90%)")
            sys.stdout.flush()
        else:
            print(f"      [WARN] Data count is low (< 90%)")
            sys.stdout.flush()

        # Check 4: Data quality sample
        print(f"\n[5/5] Checking data quality (sample)...")
        sys.stdout.flush()

        # Sample 5 random records
        sample_size = min(5, len(records))
        sample_records = random.sample(records, sample_size)

        quality_issues = []
        for record in sample_records:
            # Check for zero/negative prices
            if record['low'] <= 0 or record['high'] <= 0 or record['close'] <= 0:
                quality_issues.append(f"Invalid price (<=0) at {datetime.fromtimestamp(record['timestamp_ms']/1000).strftime('%m-%d %H:%M')}")

            # Check for illogical price relationships
            if record['low'] > record['high']:
                quality_issues.append(f"Low > High at {datetime.fromtimestamp(record['timestamp_ms']/1000).strftime('%m-%d %H:%M')}")

            if record['close'] > record['high'] or record['close'] < record['low']:
                quality_issues.append(f"Close outside [Low, High] at {datetime.fromtimestamp(record['timestamp_ms']/1000).strftime('%m-%d %H:%M')}")

        if len(quality_issues) == 0:
            print(f"      [OK] Sampled {sample_size} records - all valid")
            sys.stdout.flush()
        else:
            print(f"      [WARN] Found {len(quality_issues)} quality issue(s):")
            sys.stdout.flush()
            for issue in quality_issues:
                print(f"         {issue}")
                sys.stdout.flush()

        # Final verdict
        print(f"\n{'='*80}")
        all_ok = coverage_ok and len(gaps) == 0 and count_ok and len(quality_issues) == 0

        if all_ok:
            print(f"VERIFICATION RESULT: [PASS] All checks passed for {coin_symbol}")
        else:
            issues_count = sum([
                1 if not coverage_ok else 0,
                len(gaps),
                1 if not count_ok else 0,
                len(quality_issues)
            ])
            print(f"VERIFICATION RESULT: [WARN] {issues_count} issue(s) found for {coin_symbol}")

        print(f"{'='*80}\n")
        sys.stdout.flush()

        return {
            'success': all_ok,
            'coin': coin_symbol,
            'record_count': len(records),
            'time_range': {
                'expected_start': start_time,
                'expected_end': end_time,
                'actual_start': oldest_dt,
                'actual_end': latest_dt,
                'start_gap_minutes': start_gap_minutes,
                'end_gap_minutes': end_gap_minutes,
                'coverage_ok': coverage_ok
            },
            'continuity': {
                'gaps_found': len(gaps),
                'largest_gap_minutes': max([g['gap_minutes'] for g in gaps]) if gaps else 0,
                'gap_details': gaps
            },
            'data_count': {
                'expected': int(expected_total),
                'actual': actual_count,
                'coverage_percent': coverage_percent,
                'count_ok': count_ok
            },
            'quality': {
                'sample_size': sample_size,
                'issues_found': len(quality_issues),
                'quality_ok': len(quality_issues) == 0
            }
        }

    def verify_random_coin(self, coin_symbols: List[str], start_time: datetime,
                          end_time: datetime) -> Optional[Dict]:
        """
        Verify a randomly selected coin (only once per session)

        Args:
            coin_symbols: List of available coins
            start_time: Expected start time
            end_time: Expected end time

        Returns:
            Optional[Dict]: Verification result or None if already verified
        """
        if self.verification_done:
            return None

        if len(coin_symbols) == 0:
            return None

        # Mark as done before verification to prevent re-entry
        self.verification_done = True

        # Select random coin
        coin_to_verify = random.choice(coin_symbols)

        # Run verification
        result = self.verify_coin_data(coin_to_verify, start_time, end_time)

        return result


# Global instance
_global_verifier = None


def get_data_verifier(db_manager=None, max_gap_minutes: int = 10):
    """
    Get global data verifier instance

    Args:
        db_manager: Database manager (required for first call)
        max_gap_minutes: Maximum allowed gap

    Returns:
        DataVerifier: Global instance
    """
    global _global_verifier

    if _global_verifier is None:
        if db_manager is None:
            raise ValueError("db_manager required for first call")
        _global_verifier = DataVerifier(db_manager, max_gap_minutes)

    return _global_verifier
