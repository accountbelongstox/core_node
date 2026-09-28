# OKX Price Monitor - Data Storage Architecture

## 📁 Data Directory Structure

All data is stored **OUTSIDE** the code directory using system paths from `pycore.pyfoundations.system_paths`.

### Windows Storage Locations
```
C:\Users\{username}\.core_node\
├── cache\
│   └── okx_price_monitor\        # Instrument cache, ticker cache
│       ├── instruments_*.json
│       └── tickers_*.json
└── data\
    └── okx_price_monitor\
        └── database\              # Historical candlestick data
            └── okx_history.db     # SQLite database
```

### Linux Storage Locations
```
/var/_core_node/                   # Or ~/.core_node if /var not writable
├── cache/
│   └── okx_price_monitor/
│       ├── instruments_*.json
│       └── tickers_*.json
└── data/
    └── okx_price_monitor/
        └── database/
            └── okx_history.db
```

## 🎯 Data Usage Principles

### 1. Database (SQLite) - Historical Data Only
- **Purpose**: Store historical candlestick data (10,000 records per coin)
- **Location**: `.core_node/data/okx_price_monitor/database/okx_history.db`
- **Tables**: One table per coin (`okx_candles_BTC`, `okx_candles_ETH`, etc.)
- **Usage**:
  - ✅ Fetch historical data and insert
  - ✅ Query for analysis and statistics
  - ❌ NOT used for real-time interaction
  - ❌ NOT used for current state tracking

### 2. Memory (RAM) - All Interaction Data
- **Purpose**: Real-time price tracking and monitoring
- **Components**:
  - `CoinTracker` objects: One per coin (297 total)
  - Price history: Last 3 hours in deque (circular buffer)
  - Current prices: Latest ticker data
  - Price changes: 30s, 1min, 2min calculations
  - Trends: Up/down direction detection
- **Advantages**:
  - ⚡ Ultra-fast access (<1ms)
  - 🔄 Real-time updates without DB overhead
  - 📊 Immediate calculations
  - 🎯 No I/O bottlenecks

### 3. Cache - API Response Cache
- **Purpose**: Reduce API calls to OKX
- **Location**: `.core_node/cache/okx_price_monitor/`
- **Files**:
  - `instruments_{timestamp}.json` - Instrument list cache (5min TTL)
  - `tickers_{timestamp}.json` - Ticker data cache
- **Benefits**:
  - Avoid rate limiting
  - Faster startup
  - Debugging aid

## 📊 Data Flow

```
┌─────────────┐
│  OKX API    │
└──────┬──────┘
       │ Fetch
       ▼
┌─────────────────┐
│ Cache (JSON)    │ ← Temporary storage
└──────┬──────────┘
       │ Process
       ▼
┌─────────────────────────┐
│ Database (Historical)   │ ← Long-term storage
│ • 10,000 records/coin   │
│ • Not for interaction   │
└──────┬──────────────────┘
       │ Load recent (3h)
       ▼
┌─────────────────────────┐
│ Memory (CoinTracker)    │ ← Active monitoring
│ • Current prices        │
│ • 3-hour window         │
│ • Price changes         │
│ • Alert detection       │
└──────┬──────────────────┘
       │ Real-time updates
       ▼
┌─────────────────────────┐
│ Web UI / Console        │ ← User interface
└─────────────────────────┘
```

## 🚀 Startup Process

### Step 1: Fetch Instruments
- Get 698 instruments from OKX API
- Extract 297 unique coins
- Cache results to `.core_node/cache/okx_price_monitor/`

### Step 2: Create Database Tables
```
[Step 3] Creating database tables...
================================================================================
Database: C:\Users\{user}\.core_node\data\okx_price_monitor\database\okx_history.db
Storage: Historical data only (not for interaction)
--------------------------------------------------------------------------------
  ✓ BTC      - Table created
  ✓ ETH      - Table created
  ✓ SOL      - Table created
  ...
  • USDT     - Table exists
--------------------------------------------------------------------------------
[SUMMARY] Tables: 150 created, 147 existing
[TOTAL] 297 tables ready for historical data
================================================================================
```

### Step 3: Fetch Historical Data
- Fetch 10,000 records per coin
- Rate limiting: 20 requests / 3 seconds
- Store in database tables

### Step 4: Load into Memory
```
[Step 5] Loading data into memory...
================================================================================
Memory Status: All interaction data in RAM (database for history only)
--------------------------------------------------------------------------------
  ✓ BTC      - DB: 10,000 records | Memory:    0 records (3h window)
  ✓ ETH      - DB: 10,000 records | Memory:    0 records (3h window)
  ✓ SOL      - DB:  9,856 records | Memory:    0 records (3h window)
  ...
--------------------------------------------------------------------------------
[MEMORY SUMMARY]
  Coin Trackers: 297
  Memory Records (3h window): 0
  Ready for real-time updates: Yes
================================================================================
```

### Step 5: Start Real-time Monitoring
- Fetch all tickers (698 instruments in one API call)
- Update CoinTracker objects in memory
- Calculate price changes and trends
- Detect trading alerts

## 🔧 Configuration

All storage paths configured in `core/monitor_config.py`:

```python
from pycore.pyfoundations.system_paths import get_app_cache_dir, get_app_data_dir

class MonitorConfig:
    # Database - Historical data only
    DATABASE_DIR = get_app_data_dir() / "okx_price_monitor" / "database"
    DATABASE_NAME = "okx_history"

    # Cache - API responses
    CACHE_DIR = get_app_cache_dir() / "okx_price_monitor"
```

## ✅ Benefits of This Architecture

1. **Clean Code Directory**: No data files polluting the source code
2. **System-wide Storage**: Proper use of OS conventions (`.core_node/`)
3. **Fast Performance**: Memory for interaction, database for history
4. **Scalability**: Can handle 297 coins with real-time updates
5. **Easy Backup**: Just backup `.core_node/data/` for historical data
6. **Debugging**: Cache files available for inspection

## 🛠️ Maintenance

### Clear Cache
```bash
# Windows
rmdir /s C:\Users\{username}\.core_node\cache\okx_price_monitor

# Linux
rm -rf ~/.core_node/cache/okx_price_monitor
```

### Backup Database
```bash
# Windows
copy C:\Users\{username}\.core_node\data\okx_price_monitor\database\okx_history.db backup.db

# Linux
cp ~/.core_node/data/okx_price_monitor/database/okx_history.db backup.db
```

### View Database
```bash
sqlite3 ~/.core_node/data/okx_price_monitor/database/okx_history.db

# List tables
.tables

# Query BTC data
SELECT * FROM okx_candles_BTC ORDER BY timestamp DESC LIMIT 10;
```

## 📝 Summary

- **Cache**: `.core_node/cache/okx_price_monitor/` - API response cache
- **Database**: `.core_node/data/okx_price_monitor/database/` - Historical data
- **Memory**: CoinTracker objects - Real-time interaction data
- **Principle**: Database for history, Memory for speed
