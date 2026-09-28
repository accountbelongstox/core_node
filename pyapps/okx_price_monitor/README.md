# OKX Unified System

A comprehensive cryptocurrency monitoring and quantitative trading system for OKX exchange.

## Quick Start

### 1. Install Redis Server

**IMPORTANT**: Trading modes (TRADING_TEST, TRADING_LIVE) require Redis server running.

**Windows:**
```bash
# Download Redis for Windows from: https://github.com/tporadowski/redis/releases
# Or use WSL: wsl redis-server
redis-server.exe
```

**Linux/Mac:**
```bash
# Install Redis
sudo apt-get install redis-server  # Ubuntu/Debian
brew install redis                  # macOS

# Start Redis
redis-server
```

**Docker (All platforms):**
```bash
docker run -d -p 6379:6379 redis:latest
```

### 2. Install Python Dependencies

Dependencies are **auto-installed** when you run the system. Redis Python package is now managed by the system.

### 3. Configure Mode

Edit `pyapps/okx_price_monitor/core/okx_config.py`:

```python
# Choose one:
SYSTEM_MODE = 'MONITOR'        # Price monitoring + web UI
SYSTEM_MODE = 'TRADING_TEST'   # Backtest from 3 days ago
SYSTEM_MODE = 'TRADING_LIVE'   # Live trading (virtual money)
```

### 4. Run System

```bash
# Recommended: Via pymain.py
python pymain.py app=okx_price_monitor
python pymain.py app=okx  # Short form

# Alternative: Direct run
python pyapps/okx_price_monitor/okx_price_monitor_main.py
```

## System Modes

### 🖥️ MONITOR Mode

**Real-time price monitoring with web interface**

- 24/7 coin tracking via WebSocket
- Web UI with charts and alerts
- Alert system (30s, 1m, 2m price changes)
- Historical data storage

**Access**:
- Web: http://localhost:58888
- API: http://localhost:58888/rpc

**Configuration**:
```python
SYSTEM_MODE = 'MONITOR'
MONITOR_STARTUP_MODE = 'web'  # web, console, fetch, init
```

### 📊 TRADING_TEST Mode

**Backtest quantitative trading strategy**

- Replay from 3 days ago
- Virtual $10,000 USDT
- 24h coin analysis (volatility, trend)
- Automated strategy execution
- Performance tracking

**Strategy**:
1. Filter: 24h stable/upward trend
2. Buy: 60s rise > 1%
3. Hold: 5 minutes
4. Sell: After hold period

**Configuration**:
```python
SYSTEM_MODE = 'TRADING_TEST'
```

### 💹 TRADING_LIVE Mode

**Live paper trading with virtual money**

- Real-time data
- Same strategy as TEST mode
- Virtual balance (no real money)
- Start from current time

**Configuration**:
```python
SYSTEM_MODE = 'TRADING_LIVE'
```

## Architecture

```
Unified Entry Point (okx_price_monitor_main.py)
    ↓
OKX Controller (mode-based routing)
    ↓
    ├─→ MONITOR → MonitorManager
    ├─→ TRADING_TEST → TradingController (TEST mode)
    └─→ TRADING_LIVE → TradingController (LIVE mode)
```

**Data Flow (Trading Modes)**:
1. **Initialization**: OKX API → SQLite → Redis
2. **Runtime**: DataReplayer/WebSocket → Redis → Calculations → Trading
3. **Persistence**: Redis → SQLite (30s, 100 coins)

## Configuration Files

- **`core/okx_config.py`** - Main system mode
- **`core/monitor_config.py`** - Monitor settings
- **`core/strategy_config.py`** - Trading strategy

## Key Features

### Monitor Mode
- ✅ Real-time WebSocket updates
- ✅ Web UI with charts
- ✅ Alert notifications
- ✅ Historical data storage
- ✅ Rate limiting
- ✅ Duplicate filtering

### Trading Modes
- ✅ 24h coin analysis (volatility, trend, periods)
- ✅ Redis-only runtime (fast)
- ✅ SQLite persistence
- ✅ Virtual trading engine
- ✅ Performance tracking
- ✅ Multi-threaded workers
- ✅ Data replay (TEST mode)

## Performance

- **Redis Cache**: In-memory operations
- **NumPy**: 100x faster calculations
- **Pipeline**: 10x faster Redis ops
- **Multi-threading**: Parallel processing
- **Total**: ~500x potential speedup

## Documentation

- **[Unified System Guide](doc/UNIFIED_SYSTEM_GUIDE.md)** - Complete guide
- **[System Summary](doc/SYSTEM_SUMMARY.md)** - Trading system overview
- **[Requirements Verification](doc/REQUIREMENTS_VERIFICATION.md)** - Feature checklist
- **[Performance Optimization](doc/PERFORMANCE_OPTIMIZATION.md)** - Optimization guide

## Directory Structure

```
okx_price_monitor/
├── core/                      # Core configuration & logic
│   ├── okx_config.py         # Unified system config ★
│   ├── okx_controller.py     # Mode-based controller ★
│   ├── monitor_config.py     # Monitor settings
│   └── strategy_config.py    # Trading strategy
├── controllers/               # High-level controllers ★
│   └── trading_controller.py # Trading system
├── foundation/               # Data layer
│   ├── coin_provider.py     # Fetch trading pairs
│   ├── unified_price_manager.py  # SQLite database
│   └── redis_manager.py     # Redis cache
├── services/                 # Service layer
│   ├── monitor_manager.py   # Monitor coordinator
│   ├── sync_worker.py       # Redis → SQLite sync
│   ├── calculation_worker.py # Attribute calculator
│   ├── trading_worker.py    # Trading executor
│   ├── data_replayer.py     # Historical replay (TEST)
│   └── backtest_engine.py   # Virtual trading
├── lib/                      # External API
│   └── okx_client.py        # OKX REST API
├── web/                      # Web interface
│   ├── index.html
│   ├── css/
│   └── js/
└── doc/                      # Documentation

★ = New unified architecture files
```

## Examples

### Example 1: Run Monitor Mode

```bash
# 1. Configure
# Edit core/okx_config.py: SYSTEM_MODE = 'MONITOR'

# 2. Run
python pymain.py app=okx

# 3. Access web UI
# http://localhost:58888
```

### Example 2: Run Backtest

```bash
# 1. Configure
# Edit core/okx_config.py: SYSTEM_MODE = 'TRADING_TEST'

# 2. Run
python pymain.py app=okx

# 3. Watch console for trading results
# Shows: Balance, P&L, Trades, Signals
```

### Example 3: Customize Strategy

```python
# Edit core/strategy_config.py

# Buy signal: 2% rise in 30 seconds
BUY_SIGNAL_THRESHOLD_PERCENT = 2.0
BUY_SIGNAL_WINDOW_SECONDS = 30

# Hold for 10 minutes
SELL_AFTER_MINUTES = 10

# Start with $20,000
INITIAL_BALANCE_USDT = 20000.0

# 20% per trade, max 5 positions
POSITION_SIZE_PERCENT = 20.0
MAX_POSITIONS = 5
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Redis connection error | Start Redis: `redis-server` |
| No coins initialized | Check OKX API connectivity |
| Trading not executing | Adjust ALLOWED_TRENDS, volatility thresholds |
| Database locked | Close other SQLite connections |

## Development

### Add New Mode

1. Edit `core/okx_config.py`:
   ```python
   SYSTEM_MODE: Literal['MONITOR', 'TRADING_TEST', 'TRADING_LIVE', 'NEW_MODE']
   ```

2. Add methods in `core/okx_controller.py`:
   ```python
   def _initialize_new_mode(self) -> bool:
       pass

   def _start_new_mode(self) -> bool:
       pass
   ```

3. Update routing logic

### Run Tests

```bash
# Test each mode
python pymain.py app=okx  # MONITOR
python pymain.py app=okx  # TRADING_TEST
python pymain.py app=okx  # TRADING_LIVE
```

## Requirements

- Python 3.8+
- Redis server
- Network access to OKX API

## Migration from Old System

### Old Entry Points (DEPRECATED)
- ❌ `backtest_main.py` - Use `okx_price_monitor_main.py` instead
- ❌ Multiple startup modes - Now unified in `okx_config.py`

### New Entry Point (Recommended)
- ✅ `pymain.py app=okx` - Single unified entry
- ✅ `okx_config.py` - Central configuration

## License

Internal project - All rights reserved

## Support

1. Check configuration in `core/okx_config.py`
2. Review console output for errors
3. Verify Redis is running: `redis-server`
4. Check network connectivity to OKX API
5. See [doc/UNIFIED_SYSTEM_GUIDE.md](doc/UNIFIED_SYSTEM_GUIDE.md) for detailed help
