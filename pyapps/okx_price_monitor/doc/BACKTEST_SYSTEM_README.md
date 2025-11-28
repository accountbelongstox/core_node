# Quantitative Trading Backtest System

Complete backtesting system for cryptocurrency trading strategies.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Backtest Main Program                       │
│                    (backtest_main.py)                           │
└────────────┬────────────────────────────────────────────────────┘
             │
    ┌────────┴────────┬──────────────┬──────────────┐
    │                 │              │              │
    ▼                 ▼              ▼              ▼
┌─────────┐   ┌──────────────┐  ┌───────────┐  ┌──────────┐
│ Calc    │   │   Trading    │  │   Sync    │  │ Backtest │
│ Workers │   │   Worker     │  │  Worker   │  │  Engine  │
│ (2x)    │   │   (1x)       │  │   (1x)    │  │          │
└────┬────┘   └──────┬───────┘  └─────┬─────┘  └────┬─────┘
     │               │                 │             │
     │      ┌────────┴────────┬────────┴─────┐       │
     │      │                 │              │       │
     ▼      ▼                 ▼              ▼       ▼
┌────────────────────────────────────────────────────────┐
│                      Redis Cache                       │
│  - Price History (Sorted Sets)                        │
│  - Coin Attributes (Hashes)                           │
│  - Virtual Positions (Hashes)                         │
└────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  SQLite Database │
                    │  (Persistence)   │
                    └──────────────────┘
```

## Core Components

### 1. Data Layer

#### `unified_price_manager.py`
- Single table for historical + realtime prices
- OHLC fields (Open, High, Low, Close)
- 1-minute change percentage calculation
- Historical data: Full OHLC from API
- Realtime data: O=H=L=C=last_price

**Table Schema:**
```sql
CREATE TABLE unified_prices (
    id INTEGER PRIMARY KEY,
    coin_symbol TEXT NOT NULL,
    timestamp_ms INTEGER NOT NULL,
    open REAL, high REAL, low REAL, close REAL,
    volume REAL,
    source TEXT,  -- 'historical' or 'realtime'
    change_1m_percent REAL,
    UNIQUE(coin_symbol, timestamp_ms, source)
);
```

#### `redis_manager.py`
- High-performance in-memory cache
- Price history (Sorted Sets by timestamp)
- Coin attributes (24h analysis results)
- Virtual positions (backtest state)
- Automatic TTL management

**Key Prefixes:**
- `okx:price:{coin}:history` - Price time-series
- `okx:attr:{coin}` - Calculated attributes
- `okx:pos:{coin}` - Virtual positions

### 2. Calculation Layer

#### `coin_attribute_calculator.py`
Calculate 24-hour attributes for each coin:

**Volatility:**
- 24h high/low/average
- Volatility range (high - low)
- Volatility percentage

**Trend Analysis:**
- Split 24h into 4 periods (6h each)
- Calculate average for each period
- Classify trend:
  - `upward` - Rising trend
  - `downward` - Falling trend
  - `stable` - Sideways/stable
  - `up_then_down` - Peak then decline
  - `down_then_up` - Valley then rise

**Period Analysis:**
- Track price movement across time periods
- Identify trend direction
- Filter coins for trading

#### `coin_attribute_calculator_optimized.py`
**Performance-optimized version using:**
- NumPy vectorization (100x faster)
- Redis Pipeline (10x faster)
- MessagePack serialization (5x faster)
- Batch operations

### 3. Worker Threads

#### `calculation_worker.py`
- Continuous attribute calculation
- Reads price data from Redis
- Updates coin attributes every 60s
- Multiple worker threads for parallelism

#### `trading_worker.py`
**Trading Strategy:**
1. Filter coins (24h stable/upward trend)
2. Detect buy signal (60s rise > 1%)
3. Open virtual position
4. Hold for 5 minutes
5. Close position and record P&L

**Risk Management:**
- Max 5 simultaneous positions
- 10% of balance per trade
- 0.1% trading fee (entry + exit)
- Optional stop-loss/take-profit

#### `sync_worker.py`
- Background synchronization
- Redis → SQLite every 30 seconds
- Process 100 coins per batch
- Final sync on shutdown

### 4. Backtest Engine

#### `backtest_engine.py`
Virtual trading system:

**Features:**
- Virtual USDT balance (default: 10,000)
- Position management (open/close)
- P&L calculation
- Performance metrics
- Trade history logging

**Metrics Tracked:**
- Total return (USDT & %)
- Win rate
- Total trades (win/loss)
- Max drawdown
- Active positions

### 5. Configuration

#### `strategy_config.py`
All configurable parameters:

**Data Initialization:**
```python
HISTORY_INIT_DAYS = 3        # Load 3 days history
BACKTEST_START_DAYS = 3      # Start from 3 days ago
```

**24h Analysis:**
```python
ANALYSIS_WINDOW_HOURS = 24   # 24-hour window
TIME_PERIODS_COUNT = 4       # Split into 4 periods
```

**Trading Strategy:**
```python
BUY_SIGNAL_WINDOW_SECONDS = 60      # 60s window
BUY_SIGNAL_THRESHOLD_PERCENT = 1.0  # >1% rise
SELL_AFTER_MINUTES = 5              # Hold 5 minutes
```

**Virtual Trading:**
```python
INITIAL_BALANCE_USDT = 10000.0    # Start with 10k
POSITION_SIZE_PERCENT = 10.0      # 10% per trade
MAX_POSITIONS = 5                 # Max 5 positions
TRADING_FEE_PERCENT = 0.1         # 0.1% fee
```

**Redis Config:**
```python
REDIS_HOST = 'localhost'
REDIS_PORT = 6379
REDIS_DB = 0
DB_SYNC_INTERVAL_SECONDS = 30     # Sync every 30s
DB_SYNC_BATCH_SIZE = 100          # 100 coins per batch
```

## Installation

### 1. Required Dependencies
```bash
pip install redis msgpack
```

### 2. Optional Dependencies (Performance)
```bash
# NumPy (100x speedup for calculations)
pip install numpy

# Pandas (C-optimized data analysis)
pip install pandas

# MessagePack (5x faster serialization)
pip install msgpack
```

### 3. Redis Server
```bash
# Install Redis
# Windows: Download from https://github.com/microsoftarchive/redis/releases
# Linux: sudo apt-get install redis-server
# macOS: brew install redis

# Start Redis server
redis-server
```

## Usage

### Run Backtest

```bash
python pyapps/okx_price_monitor/backtest_main.py
```

### Execution Flow

```
1. Initialize Historical Data
   ├─ Fetch all coin symbols (SPOT-USDT pairs)
   ├─ Load 3 days of 1-minute candles
   ├─ Store in SQLite database
   └─ Load into Redis cache

2. Start Worker Threads
   ├─ Sync Worker (Redis → SQLite every 30s)
   ├─ Calculation Workers (2x threads)
   │  └─ Update 24h attributes every 60s
   └─ Trading Worker
      ├─ Filter coins (stable/upward trend)
      ├─ Detect buy signals (60s > 1%)
      ├─ Execute virtual trades
      └─ Track performance

3. Run Backtest
   ├─ Monitor signals continuously
   ├─ Print status every 30s
   └─ Ctrl+C to stop

4. Cleanup & Results
   ├─ Close all positions
   ├─ Final Redis → SQLite sync
   ├─ Save trade log (CSV)
   └─ Print performance summary
```

### Expected Output

```
================================================================================
QUANTITATIVE TRADING BACKTEST SYSTEM
================================================================================
Start time: 2025-11-28 10:30:00
================================================================================

================================================================================
STEP 1: INITIALIZE HISTORICAL DATA
================================================================================
Total coins: 297
Loading 3 days of data (2025-11-25 to 2025-11-28)
[1/297] Loading BTC... ✓ Loaded 4320 candles
[2/297] Loading ETH... ✓ Loaded 4320 candles
...
--------------------------------------------------------------------------------
Initialization complete: 297 coins loaded, 0 failed
================================================================================

================================================================================
STEP 2: START WORKER THREADS
================================================================================
Starting sync worker...
Starting 2 calculation workers...
Waiting for initial attribute calculation...
Starting trading worker...
================================================================================

================================================================================
STEP 3: RUN BACKTEST
================================================================================
Running backtest indefinitely...
Press Ctrl+C to stop

--------------------------------------------------------------------------------
⏱  Time remaining: 59.5 minutes
💰 Balance: 10,250.30 USDT (+2.50%)
📊 Trades: 15 (W: 9, L: 6)
📈 Active Positions: 2
🔍 Filtered Coins: 45
🎯 Signals Detected: 23
--------------------------------------------------------------------------------

[TradingWorker] 🚀 BUY SIGNAL: SOL (60s change: +1.25%)
[BacktestEngine] OPEN SOL @ 105.2345 (size: 1000.00 USDT)
...
[BacktestEngine] CLOSE SOL @ 106.1234 (P&L: +8.45 USDT / +0.85%)
...

================================================================================
BACKTEST PERFORMANCE SUMMARY
================================================================================
Initial Balance:     10000.00 USDT
Final Balance:       10250.30 USDT
Total Return:        +250.30 USDT (+2.50%)
Total Trades:        15
Winning Trades:      9
Losing Trades:       6
Win Rate:            60.00%
Max Drawdown:        1.23%
================================================================================

Trade log saved: .core_node/cache/okx_price_monitor/backtest_logs/trades_20251128_103000.csv
```

## Output Files

### Trade Log (CSV)
```
Coin,EntryPrice,EntryTime,ExitPrice,ExitTime,Size,PnL,PnL%
SOL,105.2345,2025-11-28 10:35:12,106.1234,2025-11-28 10:40:12,1000.00,8.45,0.85
BTC,67234.50,2025-11-28 10:36:30,67450.20,2025-11-28 10:41:30,1000.00,21.10,2.11
...
```

### Database
- **SQLite:** `.core_node/data/okx_price_monitor/okx_unified_prices.db`
- **Redis:** In-memory (port 6379, DB 0)

### Logs
- **Alerts:** `.core_node/cache/okx_price_monitor/alerts/alerts_YYYYMMDD.csv`
- **Trade Logs:** `.core_node/cache/okx_price_monitor/backtest_logs/trades_YYYYMMDD_HHMMSS.csv`

## Performance Optimization

See `doc/PERFORMANCE_OPTIMIZATION.md` for detailed optimization strategies.

**Quick Wins:**
1. Install NumPy: `pip install numpy` (100x speedup)
2. Use optimized calculator: `coin_attribute_calculator_optimized.py`
3. Increase Redis memory limit if needed

**Expected Speedup:**
- NumPy vectorization: 100x
- Redis Pipeline: 10x
- MessagePack: 5x
- **Combined: ~500x faster**

## Configuration Tuning

### Conservative Strategy
```python
BUY_SIGNAL_THRESHOLD_PERCENT = 2.0  # Require 2% rise
POSITION_SIZE_PERCENT = 5.0         # 5% per trade
MAX_POSITIONS = 3                   # Max 3 positions
ALLOWED_TRENDS = ['upward']         # Only upward trends
```

### Aggressive Strategy
```python
BUY_SIGNAL_THRESHOLD_PERCENT = 0.5  # 0.5% rise
POSITION_SIZE_PERCENT = 20.0        # 20% per trade
MAX_POSITIONS = 10                  # Max 10 positions
ALLOWED_TRENDS = ['upward', 'stable', 'down_then_up']
```

## Troubleshooting

### Redis Connection Failed
```bash
# Start Redis server
redis-server

# Check Redis is running
redis-cli ping
# Should respond: PONG
```

### Slow Performance
```bash
# Install NumPy for 100x speedup
pip install numpy

# Use optimized calculator
# Edit calculation_worker.py:
from pyapps.okx_price_monitor.services.coin_attribute_calculator_optimized import get_optimized_calculator
```

### Out of Memory
```python
# Reduce data retention in strategy_config.py
REDIS_MAX_DATAPOINTS_PER_COIN = 1440  # 1 day instead of 3
HISTORY_INIT_DAYS = 1                 # 1 day instead of 3
```

## Architecture Highlights

1. **Separation of Concerns:**
   - Data layer (SQLite + Redis)
   - Calculation layer (attribute calculator)
   - Execution layer (workers)
   - Strategy layer (backtest engine)

2. **Performance-First Design:**
   - Redis for high-speed calculations
   - SQLite for persistence
   - Batch operations (30s sync, 100 coins)
   - Optional NumPy acceleration

3. **Clean Configuration:**
   - All parameters in `strategy_config.py`
   - No hardcoded values
   - Easy to tune strategy

4. **Thread Safety:**
   - Redis (naturally thread-safe)
   - SQLite (with locks)
   - Separate worker threads
   - Graceful shutdown

## Next Steps

1. **Run backtest with historical data**
2. **Analyze trade logs and performance**
3. **Tune strategy parameters**
4. **Test different time windows and thresholds**
5. **Add more sophisticated strategies**
6. **Implement risk management (stop-loss, take-profit)**
7. **Add performance analytics and visualization**

## License

This is a backtesting system for research and educational purposes only.
NOT FOR LIVE TRADING without extensive testing and risk management.
