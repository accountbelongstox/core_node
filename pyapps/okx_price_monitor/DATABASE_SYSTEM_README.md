# OKX Price Monitor - Database System Documentation

## Overview

The OKX Price Monitor now includes a comprehensive database system for tracking cryptocurrency price history with the following features:

- **Dynamic table creation** for each cryptocurrency
- **Time-based deduplication** to prevent duplicate inserts
- **3-hour history loading** on startup
- **Price change calculations** (30s, 1min, 2min)
- **Trend detection** (up, down, flat)
- **Trading alerts** based on configurable thresholds

## Architecture

### 1. Dynamic Table Registry (`OKXDynamicTableRegistry`)
- Manages table key generation for each coin
- Normalizes coin symbols (e.g., "BTC-USDT" -> "btc_usdt")
- Generates table keys: `app_okx.{coin}_history`
- Caches table keys for performance

### 2. Coin Price History Model Factory (`CoinPriceHistoryModelFactory`)
- Creates dynamic model classes for each coin
- Each model inherits from `BaseModel` with full CRUD operations
- Table schema:
  - `id`: Primary key (auto-increment)
  - `timestamp`: ISO timestamp string
  - `timestamp_ms`: Timestamp in milliseconds (indexed)
  - `price`: Current price (float)
  - `price_change_24h`: 24h price change percentage
  - `volume_24h`: 24h trading volume
  - `market_cap`: Market capitalization
  - `raw_data`: JSON string of additional data
  - `created_at`: Record creation timestamp

### 3. Time Deduplication Interceptor (`TimestampDeduplicator`)
- **Memory-based** tracking (not database queries)
- Per-coin timestamp tracking
- Configurable time window (default: 10 seconds)
- Automatic cleanup of old timestamps
- Global singleton instance shared across all coins

### 4. Coin Data Object (`CoinDataObject`)
- Manages price history for a single coin
- Loads 3 hours of history from database on startup
- Circular buffer (deque) for memory efficiency
- Price change calculations:
  - `get_price_change_30s()`: 30-second change
  - `get_price_change_1min()`: 1-minute change
  - `get_price_change_2min()`: 2-minute change
  - `get_price_change_custom(seconds)`: Custom period
- Trend detection:
  - `get_price_trend(seconds)`: Returns "up", "down", or "flat"
  - `get_all_trends()`: All standard trends (30s, 1min, 2min)
- Auto-deduplication via global interceptor

### 5. Coin Data Manager (`CoinDataManager`)
- Unified manager for all coin data objects
- Initializes database and creates tables
- Loads history for all coins on startup
- Batch price updates with deduplication
- Trading alert checking
- Summary statistics

## Configuration

All configuration is centralized in `lib/config.py`:

```python
# Database Configuration
DATABASE_NAME = "okx"           # Database name
HISTORY_HOURS = 3               # Hours of history to load

# Trading Alert Thresholds
ALERT_CHANGE_30S_THRESHOLD = 1.0   # 30s change alert (%)
ALERT_CHANGE_1MIN_THRESHOLD = 2.0  # 1min change alert (%)
ALERT_CHANGE_2MIN_THRESHOLD = 3.0  # 2min change alert (%)
```

## Usage Flow

### 1. Startup Sequence

```
[Step 3] Fetch coin list from provider
  ↓
[Step 3.5] Initialize database system
  - Register database
  - Create models for all coins
  - Load tables (creates if not exist)
  - Create CoinDataObject for each coin
  ↓
[Step 3.6] Load 3h history from database
  - Load records for each coin
  - Populate circular buffer
  - Mark timestamps in deduplicator
  ↓
[Step 8] Start continuous monitor
  - Pass coin_data_manager to monitor
```

### 2. Runtime Operation

Every tick (default: 1 second):

```
1. Fetch price data from RPC
   ↓
2. Update database (batch)
   - Prepare price data for each coin
   - Check deduplication (memory-based)
   - Insert non-duplicate records
   - Log: "DB: Saved X records, Skipped Y duplicates"
   ↓
3. Check trading alerts
   - Calculate price changes for all coins
   - Compare against thresholds
   - Display alerts if exceeded
```

### 3. Trading Alerts

When price changes exceed thresholds:

```
==================================================================
TRADING ALERTS
==================================================================

  BTC: $45000.00
    30s: +1.5% (threshold: 1.0%)
    1min: +2.3% (threshold: 2.0%)

  ETH: $3000.00
    1min: -2.1% (threshold: -2.0%)

==================================================================
```

## Database Structure

### Database Location

- **Windows**: `D:/www/pycore_db/okx.db`
- **Linux**: `/www/pycore_db/okx.db`

### Tables

Each coin gets its own table:
- `app_okx_btc_history`
- `app_okx_eth_history`
- `app_okx_usdt_history`
- etc.

### Example Query

```python
# Get BTC data object
btc_data = coin_data_manager._coins['BTC']

# Get price changes
change_30s = btc_data.get_price_change_30s()
change_1min = btc_data.get_price_change_1min()
change_2min = btc_data.get_price_change_2min()

# Get trends
trends = btc_data.get_all_trends()
# {'trend_30s': 'up', 'trend_1min': 'up', 'trend_2min': 'down'}

# Get summary
summary = coin_data_manager.get_coin_summary('BTC')
```

## Performance Features

### 1. Memory-Based Deduplication
- **Why**: Database queries are too slow for high-frequency updates
- **How**: In-memory timestamp tracking per coin
- **Result**: No duplicate inserts without database overhead

### 2. Batch Operations
- Batch insert price updates for all coins
- Single database connection per tick
- Efficient transaction handling

### 3. Circular Buffer
- Fixed-size deque (10,800 records = 3 hours @ 1s interval)
- Automatic old data removal
- Memory-efficient history storage

### 4. Index Optimization
- `timestamp_ms` column is indexed
- Fast time-range queries
- Efficient nearest-price lookups

## API Reference

### CoinDataManager

```python
# Initialize
coin_data_manager = CoinDataManager(
    database_name="okx",
    history_hours=3
)

# Initialize database and load coins
coin_data_manager.initialize(coin_symbols)

# Load history from database
coin_data_manager.load_history_for_all()

# Update single coin price
coin_data_manager.update_price('BTC', price_data)

# Batch update
coin_data_manager.batch_update_prices(price_updates)

# Get price changes
changes = coin_data_manager.get_price_changes('BTC')
# {'change_30s': 1.5, 'change_1min': 2.3, 'change_2min': 3.1}

# Get trends
trends = coin_data_manager.get_coin_trends('BTC')
# {'trend_30s': 'up', 'trend_1min': 'up', 'trend_2min': 'down'}

# Check trading alerts
alert = coin_data_manager.check_trading_alert(
    'BTC',
    threshold_30s=1.0,
    threshold_1min=2.0,
    threshold_2min=3.0
)

# Check all trading alerts
alerts = coin_data_manager.check_all_trading_alerts(
    threshold_30s=1.0,
    threshold_1min=2.0,
    threshold_2min=3.0
)

# Get summary
summary = coin_data_manager.get_coin_summary('BTC')

# Get all summaries
summaries = coin_data_manager.get_all_summaries()

# Print statistics
coin_data_manager.print_statistics()
```

### CoinDataObject

```python
# Get coin data object
coin_data = coin_data_manager._coins['BTC']

# Load history
coin_data.load_recent_history(conn, hours=3)

# Add price data
coin_data.add_price_data(conn, price_data, auto_save=True)

# Get price changes
change_30s = coin_data.get_price_change_30s()
change_1min = coin_data.get_price_change_1min()
change_2min = coin_data.get_price_change_2min()
change_custom = coin_data.get_price_change_custom(120)  # 2 minutes

# Get trends
trend_30s = coin_data.get_price_trend(30)
trend_1min = coin_data.get_price_trend(60)
trends = coin_data.get_all_trends()

# Get history summary
summary = coin_data.get_history_summary()

# Get recent prices
recent = coin_data.get_recent_prices(count=10)
```

## Troubleshooting

### Database Not Initializing

Check if database system is available:
```python
from pycore.database import DATABASE_AVAILABLE

if not DATABASE_AVAILABLE:
    print("Database system not available")
```

### Duplicate Records

The deduplicator prevents duplicates within a 10-second window. If you see duplicates:
1. Check if data is coming from different sources
2. Verify timestamp_ms is set correctly
3. Check deduplicator time window configuration

### Memory Usage

If memory usage is high:
1. Reduce HISTORY_HOURS (default: 3)
2. Reduce MAX_HISTORY (default: 1000)
3. Clear old history: `coin_data.clear_history()`

### Performance Issues

If database operations are slow:
1. Check database location (SSD vs HDD)
2. Verify indexes are created
3. Monitor batch update size
4. Consider reducing tick frequency

## Future Enhancements

- [ ] Add data export functionality
- [ ] Implement price prediction models
- [ ] Add multi-timeframe analysis
- [ ] Create dashboard for visualization
- [ ] Add database backup/restore
- [ ] Implement data archiving for old records
- [ ] Add WebSocket real-time alerts
- [ ] Create trading strategy backtesting
