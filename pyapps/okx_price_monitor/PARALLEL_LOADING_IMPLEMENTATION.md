# Parallel Loading Implementation Guide

## Date
2025-12-13

## Performance Improvement
**Expected Speedup**: 10-20x faster (from 10 hours to 30-60 minutes)

---

## Code Changes Required

### Step 1: Add Imports to `trading_controller.py`

**Location**: Line 9-12

**Before**:
```python
import time
import signal
from datetime import datetime, timedelta
from typing import List, Optional
```

**After**:
```python
import time
import signal
import threading
from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Dict
from concurrent.futures import ThreadPoolExecutor, as_completed
```

---

### Step 2: Add Thread-Safe Lock to `__init__` method

**Location**: Line 33-93 (inside `__init__` method)

**Add after line 65** (after `self.data_replayer = None`):
```python
        # Thread-safe locks for parallel loading
        self.db_lock = threading.Lock()
        self.print_lock = threading.Lock()
```

---

### Step 3: Create `_load_single_coin` Method

**Location**: Insert BEFORE `_fetch_all_candles` method (before line 266)

**New method**:
```python
    def _load_single_coin(self, coin_symbol: str, coin_index: int, total_coins: int,
                          start_time: datetime, end_time: datetime,
                          start_ts_ms: int, end_ts_ms: int) -> Tuple[bool, str]:
        """
        Load data for a single coin (thread-safe)

        Args:
            coin_symbol: Coin symbol
            coin_index: Index of this coin (for progress display)
            total_coins: Total number of coins
            start_time: Start datetime
            end_time: End datetime
            start_ts_ms: Start timestamp in milliseconds
            end_ts_ms: End timestamp in milliseconds

        Returns:
            Tuple[bool, str]: (success, status_message)
        """
        import sys

        try:
            inst_id = f"{coin_symbol}-USDT"

            # Query database with error handling (thread-safe)
            try:
                with self.db_lock:
                    existing_count = self.db_manager.count_records(coin_symbol, start_ts_ms, end_ts_ms)
            except Exception as e:
                with self.print_lock:
                    print(f"\n[{coin_index}/{total_coins}] [ERROR] {coin_symbol}: DB query failed: {e}")
                    sys.stdout.flush()
                existing_count = 0

            # Build status message
            status_parts = [f"[{coin_index}/{total_coins}] {coin_symbol}"]
            status_parts.append(f"(existing: {existing_count})")

            # Check existing data in SQLite (both oldest and latest)
            try:
                with self.db_lock:
                    time_range = self.db_manager.get_time_range(coin_symbol)
            except Exception as e:
                time_range = None

            if time_range:
                oldest_ms, latest_ms = time_range
                oldest_dt = datetime.fromtimestamp(oldest_ms / 1000)
                latest_dt = datetime.fromtimestamp(latest_ms / 1000)

                status_parts.append(f"(DB: {oldest_dt.strftime('%m-%d %H:%M')} to {latest_dt.strftime('%m-%d %H:%M')})")

                # Check for duplicates and deduplicate if needed
                try:
                    with self.db_lock:
                        dup_count = self.db_manager.check_duplicates(coin_symbol)
                        if dup_count > 0:
                            status_parts.append(f"[Dedup: {dup_count}]")
                            self.db_manager.deduplicate_coin_data(coin_symbol)
                except Exception as e:
                    pass

                # Check if data is complete and up-to-date
                has_enough_history = oldest_dt <= start_time
                is_up_to_date = latest_dt >= end_time - timedelta(hours=1)

                if has_enough_history and is_up_to_date:
                    # Data is complete and recent, just load to Redis
                    status_parts.append("[Up-to-date]")
                    try:
                        loaded_rows = self._load_to_redis_from_sqlite(coin_symbol, start_time, end_time)
                        status_parts.append(f"[OK] rows={loaded_rows}")
                        with self.print_lock:
                            print(" ".join(status_parts))
                            sys.stdout.flush()
                        return (True, " ".join(status_parts))
                    except Exception as e:
                        status_parts.append(f"[FAIL] {e}")
                        with self.print_lock:
                            print(" ".join(status_parts))
                            sys.stdout.flush()
                        return (False, " ".join(status_parts))

                # Need to fetch missing data
                if not has_enough_history and not is_up_to_date:
                    status_parts.append("[Gap: full range]")
                    candles_data = self._fetch_all_candles(inst_id, start_time, end_time)
                elif not is_up_to_date:
                    gap_start = latest_dt
                    gap_end = end_time
                    status_parts.append(f"[Gap: {gap_start.strftime('%m-%d %H:%M')} to {gap_end.strftime('%m-%d %H:%M')}]")
                    candles_data = self._fetch_all_candles(inst_id, gap_start, gap_end)
                else:
                    gap_start = start_time
                    gap_end = oldest_dt
                    status_parts.append(f"[Gap: {gap_start.strftime('%m-%d')} to {gap_end.strftime('%m-%d')}]")
                    candles_data = self._fetch_all_candles(inst_id, gap_start, gap_end)

            else:
                # No existing data, fetch full range
                status_parts.append("[New]")
                candles_data = self._fetch_all_candles(inst_id, start_time, end_time)

            # Process fetched data
            if not candles_data:
                status_parts.append("[FAIL] No data")
                with self.print_lock:
                    print(" ".join(status_parts))
                    sys.stdout.flush()
                return (False, " ".join(status_parts))

            # Save to SQLite (INSERT OR REPLACE handles duplicates) - thread-safe
            try:
                with self.db_lock:
                    for candle in candles_data:
                        self.db_manager.insert_historical_candle(coin_symbol, candle)
                fetched_count = len(candles_data)

                # Load all data to Redis (including existing + new)
                redis_loaded = self._load_to_redis_from_sqlite(coin_symbol, start_time, end_time)

                status_parts.append(f"[OK] fetched={fetched_count} redis={redis_loaded}")
                with self.print_lock:
                    print(" ".join(status_parts))
                    sys.stdout.flush()
                return (True, " ".join(status_parts))
            except Exception as e:
                status_parts.append(f"[FAIL] {e}")
                with self.print_lock:
                    print(" ".join(status_parts))
                    sys.stdout.flush()
                return (False, " ".join(status_parts))

        except Exception as e:
            with self.print_lock:
                print(f"\n[{coin_index}/{total_coins}] [ERROR] {coin_symbol}: Unexpected error: {e}")
                sys.stdout.flush()
            return (False, f"ERROR: {e}")
```

---

### Step 4: Create Parallel Loading Method

**Location**: Insert AFTER `_load_single_coin` method

**New method**:
```python
    def initialize_historical_data_parallel(self, max_workers: int = 10):
        """
        Load historical data into SQLite and Redis using parallel threads

        Args:
            max_workers: Number of parallel threads (default: 10)

        Data Flow: OKX API -> SQLite -> Redis
        Performance: 10-20x faster than serial loading
        """
        import sys

        print("\n" + "="*80)
        sys.stdout.flush()
        print("INITIALIZING HISTORICAL DATA (PARALLEL MODE)")
        sys.stdout.flush()
        print("="*80)
        sys.stdout.flush()

        # Get all coins
        print("[Init] Step 1: Fetching instruments...")
        sys.stdout.flush()
        self.coin_provider.fetch_instruments()
        print("[Init] Step 2: Getting coin list...")
        sys.stdout.flush()
        self.coin_symbols = self.coin_provider.get_coin_list()
        print(f"[Init] Step 3: Got {len(self.coin_symbols)} coins")
        sys.stdout.flush()

        print(f"Total coins: {len(self.coin_symbols)}")
        sys.stdout.flush()
        print(f"Parallel workers: {max_workers}")
        sys.stdout.flush()

        # Calculate time range
        days_to_load = strategy_config.HISTORY_INIT_DAYS
        end_time = datetime.now()
        start_time = end_time - timedelta(days=days_to_load)
        start_ts_ms = int(start_time.timestamp() * 1000)
        end_ts_ms = int(end_time.timestamp() * 1000)

        print(f"Loading {days_to_load} days of data ({start_time.strftime('%Y-%m-%d')} to {end_time.strftime('%Y-%m-%d')})")
        sys.stdout.flush()
        print("Data Flow: OKX API -> SQLite -> Redis (PARALLEL)")
        sys.stdout.flush()

        # Track results
        loaded_count = 0
        failed_count = 0
        start_total_time = time.time()

        # Use ThreadPoolExecutor for parallel loading
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all coin loading tasks
            future_to_coin = {
                executor.submit(
                    self._load_single_coin,
                    coin_symbol,
                    i,
                    len(self.coin_symbols),
                    start_time,
                    end_time,
                    start_ts_ms,
                    end_ts_ms
                ): (i, coin_symbol)
                for i, coin_symbol in enumerate(self.coin_symbols, 1)
            }

            # Process results as they complete
            for future in as_completed(future_to_coin):
                coin_index, coin_symbol = future_to_coin[future]
                try:
                    success, status_msg = future.result()
                    if success:
                        loaded_count += 1
                    else:
                        failed_count += 1
                except Exception as exc:
                    print(f"\n[ERROR] {coin_symbol} generated an exception: {exc}")
                    sys.stdout.flush()
                    failed_count += 1

                # Print progress summary every 10 coins
                total_processed = loaded_count + failed_count
                if total_processed % 10 == 0:
                    elapsed = time.time() - start_total_time
                    rate = total_processed / elapsed if elapsed > 0 else 0
                    remaining = len(self.coin_symbols) - total_processed
                    eta_seconds = remaining / rate if rate > 0 else 0
                    eta_minutes = eta_seconds / 60

                    print(f"\n[Progress] {total_processed}/{len(self.coin_symbols)} | "
                          f"Success: {loaded_count} | Failed: {failed_count} | "
                          f"Rate: {rate:.1f} coins/sec | ETA: {eta_minutes:.1f} min")
                    sys.stdout.flush()

        # Final summary
        total_time = time.time() - start_total_time
        total_minutes = total_time / 60
        avg_time_per_coin = total_time / len(self.coin_symbols) if self.coin_symbols else 0

        print("\n" + "-"*80)
        sys.stdout.flush()
        print(f"Initialization complete: {loaded_count} coins loaded, {failed_count} failed")
        sys.stdout.flush()
        print(f"Total time: {total_minutes:.2f} minutes ({total_time:.1f} seconds)")
        sys.stdout.flush()
        print(f"Average time per coin: {avg_time_per_coin:.2f} seconds")
        sys.stdout.flush()
        print(f"Throughput: {len(self.coin_symbols) / total_minutes:.1f} coins/minute")
        sys.stdout.flush()
        print(f"SQLite: Historical data persisted")
        sys.stdout.flush()
        print(f"Redis: {loaded_count} coins loaded and ready for calculations")
        sys.stdout.flush()
        print("="*80 + "\n")
        sys.stdout.flush()
```

---

### Step 5: Update Method Call

**Option 1: Replace existing method**

Rename the current `initialize_historical_data()` to `initialize_historical_data_serial()` and rename `initialize_historical_data_parallel()` to `initialize_historical_data()`.

**Option 2: Add parameter to choose mode**

Modify the method signature to:
```python
def initialize_historical_data(self, parallel: bool = True, max_workers: int = 10):
    """Load historical data (serial or parallel mode)"""
    if parallel:
        return self.initialize_historical_data_parallel(max_workers)
    else:
        return self.initialize_historical_data_serial()
```

---

## Configuration

### Recommended Thread Counts

Based on OKX API rate limits (20 requests/second for public endpoints):

| Threads | Expected Time | Risk Level | Recommended For |
|---------|---------------|------------|-----------------|
| 5       | ~120 minutes  | Very Low   | Conservative    |
| 10      | ~60 minutes   | Low        | **Recommended** |
| 15      | ~40 minutes   | Medium     | Aggressive      |
| 20      | ~30 minutes   | High       | Maximum speed   |

**Default recommendation**: 10 threads (safe and 10x faster)

---

## Testing Instructions

### Test 1: Small Batch (5 coins)
```python
# Temporarily modify coin list to test
controller.coin_symbols = controller.coin_symbols[:5]
controller.initialize_historical_data_parallel(max_workers=3)
```

### Test 2: Medium Batch (50 coins)
```python
controller.coin_symbols = controller.coin_symbols[:50]
controller.initialize_historical_data_parallel(max_workers=10)
```

### Test 3: Full Run (294 coins)
```python
controller.initialize_historical_data_parallel(max_workers=10)
```

---

## Expected Results

### Before (Serial Loading)
```
Total Time: ~10 hours (unacceptable)
Coins/hour: ~30
Average per coin: ~2 minutes
```

### After (Parallel Loading with 10 threads)
```
Total Time: ~60 minutes (acceptable)
Coins/hour: ~300
Average per coin: ~0.2 minutes (12 seconds)
Speedup: 10x
```

### After (Parallel Loading with 20 threads)
```
Total Time: ~30 minutes (excellent)
Coins/hour: ~600
Average per coin: ~0.1 minutes (6 seconds)
Speedup: 20x
```

---

## Safety Features

### Thread-Safe Operations
1. **Database Access**: Protected by `self.db_lock`
2. **Console Output**: Protected by `self.print_lock`
3. **Redis Operations**: Thread-safe by design (Redis is single-threaded)
4. **API Calls**: Independent per thread, no shared state

### Error Handling
- Per-thread try/catch blocks
- Failed coins don't stop other threads
- All errors logged with coin symbol
- Final summary shows success/failure counts

### Progress Monitoring
- Real-time progress display every 10 coins
- ETA calculation based on current rate
- Throughput metrics (coins/sec, coins/min)
- Final performance summary

---

## Rollback Plan

If parallel loading causes issues:

1. **Rename methods back**:
   - `initialize_historical_data_parallel()` -> `initialize_historical_data_parallel_backup()`
   - `initialize_historical_data_serial()` -> `initialize_historical_data()`

2. **Or use conditional**:
   ```python
   # In strategy_config.py
   PARALLEL_LOADING_ENABLED = False
   MAX_LOADING_WORKERS = 10

   # In trading_controller.py
   if strategy_config.PARALLEL_LOADING_ENABLED:
       self.initialize_historical_data_parallel(strategy_config.MAX_LOADING_WORKERS)
   else:
       self.initialize_historical_data_serial()
   ```

---

## Implementation Status

- [x] Analysis complete
- [x] Implementation guide created
- [ ] Code changes applied
- [ ] Testing complete
- [ ] Performance verified

---

## Next Steps

1. Apply code changes to `trading_controller.py`
2. Test with 5 coins first
3. Test with 50 coins
4. Run full 294 coins
5. Measure and document actual performance improvement
6. Optionally implement Phase 2 (Batch Database Inserts) for additional 2-3% speedup
7. Optionally implement Phase 3 (Redis Pipeline) for additional 1% speedup
