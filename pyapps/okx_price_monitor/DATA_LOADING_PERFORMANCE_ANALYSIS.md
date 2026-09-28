# Data Loading Performance Analysis and Optimization

## Date
2025-12-13

---

## Current Performance Analysis

### Observed Performance
```
Start Time: 16:09:43
End Time: 17:34:43 (killed manually)
Duration: ~85 minutes
Coins Loaded: 41/294
Average Time per Coin: 2.07 minutes
```

### Projected Total Time
```
Total Coins: 294
Estimated Total Time: 294 * 2.07 min = 608 minutes = 10.1 hours
Status: UNACCEPTABLY SLOW
```

---

## Bottleneck Analysis

### 1. Serial Loading (MAJOR BOTTLENECK)
**Problem**: Loads one coin at a time sequentially

**Code Location**: `trading_controller.py:138`
```python
for i, coin_symbol in enumerate(self.coin_symbols, 1):
    # Load one coin completely before moving to next
```

**Impact**: **CRITICAL**
- No parallelism
- Network I/O time wasted
- CPU idle most of the time

---

### 2. Multiple API Calls Per Coin (HIGH IMPACT)
**Problem**: Each new coin requires ~10 API calls

**Breakdown** (trading_controller.py:300-315):
```
Part 1: 5m bars (historical, 2 days)
  - 576 candles / 300 per request = 2-3 requests

Part 2: 1m bars (recent, 1 day)
  - 1440 candles / 300 per request = 5-6 requests

Total: 7-9 API calls per coin
```

**Impact**: **HIGH**
- Each API call: ~0.5-2 seconds
- Total API time per coin: 3.5-18 seconds
- 294 coins: 17-88 minutes (API time only)

---

### 3. API Rate Limiting Delays (MEDIUM IMPACT)
**Problem**: Sleep 0.05s after each API call

**Code Location**: `trading_controller.py:253, 406`
```python
time.sleep(0.05)  # After each coin
time.sleep(0.05)  # After each API call within coin
```

**Impact**: **MEDIUM**
- Per coin: 9 calls * 0.05s = 0.45s
- 294 coins: 294 * 0.45s = 132 seconds = 2.2 minutes total
- Not the main problem, but adds up

---

### 4. Database Write Operations (LOW-MEDIUM IMPACT)
**Problem**: Inserting ~2000 records per coin to SQLite

**Code Location**: `trading_controller.py:236-238`
```python
for candle in candles_data:
    self.db_manager.insert_historical_candle(coin_symbol, candle)
```

**Impact**: **LOW-MEDIUM**
- Each insert: ~0.5-2ms
- Per coin: 2000 * 0.001s = 2 seconds
- 294 coins: 588 seconds = 9.8 minutes total
- Not optimized (individual INSERTs vs batch)

---

### 5. Redis Write Operations (LOW IMPACT)
**Problem**: Loading ~2000 records per coin to Redis

**Code Location**: `trading_controller.py:242`
```python
redis_loaded = self._load_to_redis_from_sqlite(coin_symbol, start_time, end_time)
```

**Impact**: **LOW**
- Redis is fast (~0.1-0.5ms per operation)
- Per coin: 2000 * 0.0005s = 1 second
- 294 coins: 294 seconds = 4.9 minutes total

---

## Time Breakdown (Per Coin Average)

| Operation | Time | Percentage |
|-----------|------|------------|
| API Calls (network I/O) | ~60-90s | 70-80% |
| Database Writes (SQLite) | ~2s | 2-3% |
| Redis Writes | ~1s | 1% |
| API Rate Limiting | ~0.45s | <1% |
| Processing (CPU) | ~5-10s | 5-10% |
| **TOTAL** | **~70-105s** | **100%** |

**Key Finding**: **70-80% of time is spent waiting for API responses**

---

## Optimization Solutions

### Solution 1: Parallel Loading (HIGHEST PRIORITY)

#### Implementation: Multi-threading
```python
from concurrent.futures import ThreadPoolExecutor
import threading

# Thread-safe database connections
coin_lock = threading.Lock()

def load_coin_data(coin_symbol):
    # Each thread loads one coin independently
    try:
        candles = fetch_candles(coin_symbol)
        with coin_lock:
            save_to_database(coin_symbol, candles)
        load_to_redis(coin_symbol, candles)
        return True
    except Exception as e:
        return False

# Load coins in parallel
with ThreadPoolExecutor(max_workers=10) as executor:
    results = executor.map(load_coin_data, coin_symbols)
```

#### Expected Speedup
```
Current: 294 coins * 2 min = 608 minutes
With 10 threads: 608 / 10 = 60.8 minutes
With 20 threads: 608 / 20 = 30.4 minutes
```

#### Speedup: **10-20x faster**

**Considerations**:
- OKX API rate limit: 20 requests/second (public endpoints)
- Recommended threads: 10-20
- Thread-safe database access required

---

### Solution 2: Batch Database Inserts (MEDIUM PRIORITY)

#### Implementation
```python
# Instead of:
for candle in candles:
    db.insert(candle)  # 2000 individual INSERTs

# Use:
db.batch_insert(candles)  # 1 batch INSERT with 2000 rows
```

#### Code Change: `trading_controller.py:236-238`
```python
# Before
for candle in candles_data:
    self.db_manager.insert_historical_candle(coin_symbol, candle)

# After (in unified_price_manager.py)
def batch_insert_historical_candles(self, coin_symbol, candles_data):
    cursor = self.conn.cursor()
    data = [(coin_symbol, int(c[0]), float(c[1]), ...) for c in candles_data]
    cursor.executemany("INSERT OR REPLACE INTO ...", data)
    self.conn.commit()
```

#### Expected Speedup
```
Current: ~2s per coin
Optimized: ~0.2s per coin
```

#### Speedup: **~10x faster for DB writes** (2-3% total time saved)

---

### Solution 3: Redis Pipeline (LOW PRIORITY)

#### Implementation
```python
# Instead of:
for price in prices:
    redis.zadd(key, {price: timestamp})  # 2000 individual commands

# Use:
pipe = redis.pipeline()
for price in prices:
    pipe.zadd(key, {price: timestamp})
pipe.execute()  # Single round-trip
```

#### Expected Speedup
```
Current: ~1s per coin
Optimized: ~0.1s per coin
```

#### Speedup: **~10x faster for Redis writes** (1% total time saved)

---

### Solution 4: Reduce API Calls (MEDIUM-HIGH PRIORITY)

#### Option A: Cache Historical Data Longer
```python
# Don't refetch old data that won't change
if has_enough_history:
    # Skip fetching 5m historical data
    # Only fetch recent 1m data
```

#### Option B: Increase Request Limit
```python
# Use maximum limit per request
params = {
    'limit': 300,  # Current (max allowed by OKX)
}
# Cannot increase further
```

#### Expected Speedup: **Minimal** (already optimized)

---

### Solution 5: Smarter Caching (LOW-MEDIUM PRIORITY)

#### Implementation
```python
# Check if data already exists and is recent
if existing_data_count > expected_count * 0.95:  # 95% threshold
    print("[Skip] Data already >95% complete")
    load_from_sqlite_to_redis()
    continue
```

#### Expected Speedup: **Only helps on re-runs**

---

## Recommended Implementation Plan

### Phase 1: Parallel Loading (IMMEDIATE)
**Priority**: HIGHEST
**Expected Speedup**: 10-20x
**Implementation Time**: 2-4 hours
**Risk**: Medium (thread-safety required)

#### Changes Required:
1. Add ThreadPoolExecutor to `trading_controller.py`
2. Make database connections thread-safe
3. Add progress tracking for parallel tasks
4. Handle exceptions per-thread

**Code Example**:
```python
def initialize_historical_data_parallel(self, max_workers=10):
    from concurrent.futures import ThreadPoolExecutor, as_completed

    loaded = 0
    failed = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_coin = {
            executor.submit(self._load_single_coin, coin): coin
            for coin in self.coin_symbols
        }

        # Process as they complete
        for future in as_completed(future_to_coin):
            coin = future_to_coin[future]
            try:
                success = future.result()
                if success:
                    loaded += 1
                else:
                    failed += 1
                print(f"[{loaded+failed}/{total}] {coin}: OK" if success else "FAIL")
            except Exception as e:
                print(f"[ERROR] {coin}: {e}")
                failed += 1
```

---

### Phase 2: Batch Database Inserts (QUICK WIN)
**Priority**: MEDIUM
**Expected Speedup**: 10x for DB writes (2-3% total time)
**Implementation Time**: 30 minutes
**Risk**: Low

#### Changes Required:
1. Add `batch_insert_historical_candles()` to `unified_price_manager.py`
2. Update `trading_controller.py` to use batch insert

---

### Phase 3: Redis Pipeline (QUICK WIN)
**Priority**: LOW
**Expected Speedup**: 10x for Redis writes (1% total time)
**Implementation Time**: 15 minutes
**Risk**: Very Low

#### Changes Required:
1. Modify `redis_manager.py` to support pipelines
2. Update `_load_to_redis_from_sqlite()` to use pipelines

---

## Expected Results After Optimization

### Current Performance
```
Total Time: ~10 hours (unacceptable)
Coins/hour: ~30
```

### After Phase 1 (Parallel Loading)
```
Total Time: ~30-60 minutes (acceptable)
Coins/hour: ~300-600
Speedup: 10-20x
```

### After All Phases
```
Total Time: ~25-50 minutes (good)
Coins/hour: ~350-700
Speedup: 12-24x
```

---

## Risk Assessment

### Parallel Loading Risks
| Risk | Severity | Mitigation |
|------|----------|------------|
| Database corruption | High | Use connection locks |
| API rate limiting | Medium | Limit to 10-20 threads |
| Memory usage | Low | Threads are lightweight |
| Error handling | Medium | Per-thread try/catch |

### Batch Insert Risks
| Risk | Severity | Mitigation |
|------|----------|------------|
| Transaction size | Low | Batch size = 2000 (reasonable) |
| Error recovery | Medium | Use savepoints |

---

## Implementation Checklist

### Phase 1: Parallel Loading
- [ ] Create `_load_single_coin()` method
- [ ] Add ThreadPoolExecutor with configurable workers
- [ ] Implement thread-safe database access
- [ ] Add progress tracking
- [ ] Add per-thread error handling
- [ ] Test with 5 threads
- [ ] Test with 10 threads
- [ ] Test with 20 threads
- [ ] Monitor API rate limits

### Phase 2: Batch Inserts
- [ ] Create `batch_insert_historical_candles()` method
- [ ] Update `unified_price_manager.py`
- [ ] Test batch insert functionality
- [ ] Verify data integrity

### Phase 3: Redis Pipeline
- [ ] Add pipeline support to `redis_manager.py`
- [ ] Update `_load_to_redis_from_sqlite()`
- [ ] Test pipeline functionality

---

## Monitoring

### Metrics to Track
```python
start_time = time.time()
loaded_count = 0
failed_count = 0

# Track per coin
coin_start = time.time()
# ... load coin ...
coin_time = time.time() - coin_start
print(f"Coin {coin}: {coin_time:.2f}s")

# Track total
total_time = time.time() - start_time
print(f"Total: {total_time/60:.1f} minutes")
print(f"Average: {total_time/loaded_count:.2f}s per coin")
print(f"Rate: {loaded_count/(total_time/3600):.1f} coins/hour")
```

---

## Conclusion

**Current Status**: 10+ hours to load 294 coins is UNACCEPTABLE

**Root Cause**: Serial loading wastes 70-80% of time waiting for API

**Solution**: Parallel loading with 10-20 threads

**Expected Result**: 30-60 minutes (12-20x speedup)

**Next Step**: Implement Phase 1 (Parallel Loading) immediately
