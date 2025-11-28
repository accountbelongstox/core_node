# Intelligent Historical Data Continuation

## 🎯 Problem Solved

**Before**: System would repeatedly fetch the same historical data on every run, wasting API calls and time.

**After**: System intelligently detects existing data and continues from the oldest timestamp, only fetching what's missing.

## 🔍 How It Works

### 1. Check Existing Data

When fetching historical data for a coin, the system:

```python
existing_count = self.coin_table_manager.get_record_count(coin_symbol)
oldest_timestamp = self.coin_table_manager.get_oldest_timestamp(coin_symbol)
```

### 2. Three Loading States

Based on existing data, each coin can be in one of three states:

#### ✅ [SKIP] - Already Complete
```
[SKIP] BTC-USDT: Already have 10000 records (target: 10000)
```
- Existing records ≥ target count
- No fetching needed
- Saves API calls

#### 🔄 [CONTINUE] - Partial Data
```
[CONTINUE] ETH-USDT: Fetching 5000 more records from before 2024-01-15 10:30:00
```
- Existing records < target count
- Has oldest_timestamp in database
- Continues fetching from that timestamp backwards in time
- Only fetches the missing records

#### 🆕 [START] - New Table
```
[START] SOL-USDT: Fetching 10000 records (new table)
```
- No existing records (new table)
- Starts fetching from the most recent data

### 3. Continuation Logic

```python
# Use oldest timestamp as starting point
after_timestamp = str(oldest_timestamp) if oldest_timestamp else None

# Calculate how many more records needed
needed = target_count - existing_count

# OKX API: 'after' means get data BEFORE this timestamp (backwards in time)
response = self.okx_client.get_candles(
    inst_id=inst_id,
    bar=bar,
    limit=batch_size,
    after=after_timestamp  # Continue from oldest existing record
)
```

### 4. Duplicate Protection

The database table has a UNIQUE constraint on timestamp:

```sql
CREATE TABLE okx_candles_btc (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    ...
    UNIQUE(timestamp)
)
```

Using `INSERT OR IGNORE` prevents duplicates even if there's overlap:

```python
INSERT OR IGNORE INTO okx_candles_btc
(timestamp, open, high, low, close, volume, volume_currency)
VALUES (?, ?, ?, ?, ?, ?, ?)
```

## 📊 Example Scenarios

### Scenario 1: First Run (All Tables Empty)

```
[Step 4] Fetching historical data from OKX...
================================================================================
[1/297] Processing BTC-USDT
[INFO] BTC-USDT: Existing records: 0
[START] BTC-USDT: Fetching 10000 records (new table)
[PROGRESS] BTC-USDT: Batch 10, Fetched 1000, Inserted 1000
...
[SUCCESS] BTC-USDT: Complete - Fetched 10000, Inserted 10000, Total in DB: 10000

[2/297] Processing ETH-USDT
[INFO] ETH-USDT: Existing records: 0
[START] ETH-USDT: Fetching 10000 records (new table)
...
```

### Scenario 2: Interrupted Run (Some Tables Partial)

```
[Step 4] Fetching historical data from OKX...
================================================================================
[1/297] Processing BTC-USDT
[INFO] BTC-USDT: Existing records: 10000
[SKIP] BTC-USDT: Already have 10000 records (target: 10000)

[2/297] Processing ETH-USDT
[INFO] ETH-USDT: Existing records: 5623
[CONTINUE] ETH-USDT: Fetching 4377 more records from before 2024-01-15 10:30:00
[PROGRESS] ETH-USDT: Batch 10, Fetched 1000, Inserted 1000
...
[SUCCESS] ETH-USDT: Complete - Fetched 4377, Inserted 4377, Total in DB: 10000

[3/297] Processing SOL-USDT
[INFO] SOL-USDT: Existing records: 0
[START] SOL-USDT: Fetching 10000 records (new table)
...
```

### Scenario 3: Already Complete (All Tables Full)

```
[Step 4] Fetching historical data from OKX...
================================================================================
[1/297] Processing BTC-USDT
[INFO] BTC-USDT: Existing records: 10000
[SKIP] BTC-USDT: Already have 10000 records (target: 10000)

[2/297] Processing ETH-USDT
[INFO] ETH-USDT: Existing records: 10000
[SKIP] ETH-USDT: Already have 10000 records (target: 10000)

[3/297] Processing SOL-USDT
[INFO] SOL-USDT: Existing records: 10000
[SKIP] SOL-USDT: Already have 10000 records (target: 10000)

... (all coins skipped, very fast)
```

## 🚀 Performance Benefits

### Before (Without Intelligent Continuation):
- **First Run**: Fetch 10,000 records × 297 coins = 2,970,000 records
- **Second Run**: Fetch 10,000 records × 297 coins = 2,970,000 records (duplicate!)
- **Third Run**: Fetch 10,000 records × 297 coins = 2,970,000 records (duplicate!)
- **Result**: Wasted API calls, wasted time, hit rate limits

### After (With Intelligent Continuation):
- **First Run**: Fetch 10,000 records × 297 coins = 2,970,000 records
- **Second Run**: Skip 297 coins (already complete) = 0 records
- **Interrupted Run**: Only fetch missing records for incomplete tables
- **Result**: Efficient, fast, respects rate limits

## 🔧 Implementation Files

### 1. `lib/coin_table_manager.py`

Added timestamp query methods:

```python
def get_oldest_timestamp(self, coin_symbol: str) -> Optional[int]:
    """Get oldest (earliest) timestamp for a coin"""
    table_name = self.get_table_name(coin_symbol)
    query_sql = f"SELECT MIN(timestamp) FROM {table_name}"
    # ... implementation

def get_latest_timestamp(self, coin_symbol: str) -> Optional[int]:
    """Get latest (newest) timestamp for a coin"""
    table_name = self.get_table_name(coin_symbol)
    query_sql = f"SELECT MAX(timestamp) FROM {table_name}"
    # ... implementation
```

### 2. `lib/history_fetcher.py`

Enhanced `fetch_history()` with intelligent continuation:

```python
def fetch_history(self, inst_id: str, target_count: int = 100000, ...):
    # 1. Check existing data
    existing_count = self.coin_table_manager.get_record_count(coin_symbol)
    oldest_timestamp = self.coin_table_manager.get_oldest_timestamp(coin_symbol)

    # 2. Skip if already complete
    if existing_count >= target_count:
        print(f"[SKIP] {inst_id}: Already have {existing_count} records")
        return {'skipped': True}

    # 3. Continue from oldest timestamp or start new
    after_timestamp = str(oldest_timestamp) if oldest_timestamp else None
    needed = target_count - existing_count

    if oldest_timestamp:
        print(f"[CONTINUE] {inst_id}: Fetching {needed} more records from before {date}")
    else:
        print(f"[START] {inst_id}: Fetching {needed} records (new table)")

    # 4. Fetch with continuation
    while total_fetched < needed:
        candles, next_after = self.fetch_candles_batch(
            inst_id=inst_id,
            after=after_timestamp  # Continue from here
        )
        # ... insert and continue
```

Enhanced `fetch_candles_batch()` to use pagination parameters:

```python
def fetch_candles_batch(self, inst_id: str, after: Optional[str] = None, ...):
    # Build request parameters
    params = {
        'inst_id': inst_id,
        'bar': bar,
        'limit': str(limit)
    }

    # Add pagination parameters
    if after:
        params['after'] = after  # Get data BEFORE this timestamp
    if before:
        params['before'] = before  # Get data AFTER this timestamp

    response = self.okx_client.get_candles(**params)
    # ... return candles and next_after
```

## 📝 Key Technical Details

### OKX API Pagination

OKX uses reverse pagination for historical data:

- `after`: Get data **BEFORE** this timestamp (going backwards in time)
- `before`: Get data **AFTER** this timestamp (going forwards in time)

For historical data, we use `after` to go backwards from the oldest existing record.

### Timestamp Format

OKX uses millisecond timestamps:

- Database: `1704438000000` (milliseconds since epoch)
- Display: `2024-01-05 10:30:00` (human-readable)

Conversion:

```python
timestamp_ms = 1704438000000
readable = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(timestamp_ms / 1000))
```

### Database Constraints

```sql
UNIQUE(timestamp)  -- Prevents duplicate records
```

Using `INSERT OR IGNORE` ensures that:
- Duplicate timestamps are silently skipped
- No errors even if there's overlap in fetched data
- Safe to fetch with some overlap for robustness

## ✅ Benefits

1. **Efficient API Usage**: Only fetch what's needed
2. **Fast Restarts**: Skip already-loaded coins
3. **Resume Capability**: Continue from where you left off
4. **Independent Tables**: Each coin has its own loading state
5. **Safe Interruption**: Can stop and restart anytime
6. **Rate Limit Friendly**: Fewer requests = less chance of hitting limits

## 🎯 User Requirements Met

✅ Avoid repeated loading of same data
✅ Intelligent continuation from last timestamp
✅ First run fetches all, subsequent runs only fetch missing
✅ Each table's loading situation can be different
✅ Clear status messages: [SKIP], [CONTINUE], [START]
✅ Show exact date from which continuation happens
