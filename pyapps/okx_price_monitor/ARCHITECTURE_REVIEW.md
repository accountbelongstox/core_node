# OKX Price Monitor - Architecture Review

## Date
2025-12-13

## Executive Summary

**Overall Grade: B+** (Good architecture with room for improvement)

**Coupling Score: 6.5/10** (Medium-High, target should be < 4/10)

The system demonstrates solid foundational architecture with clear layering, but suffers from overuse of global singletons and lacks event-driven patterns.

---

## 1. Data Loading Architecture

### Flow: OKX API → SQLite → Redis

**Design**: ✅ Well-designed

```
OKX API (HTTP)
    ↓ Fetch historical candles
SQLite (Persistent Storage)
    ↓ Load to working memory
Redis (3-day cache)
    ↓ Real-time access
Workers (Trading/Calculation)
```

**Strengths**:
- ✅ Smart gap detection avoids redundant API calls
- ✅ Deduplication at multiple levels (API, SQLite, Redis)
- ✅ Hybrid bar strategy (5m historical + 1m recent)
- ✅ Separation of persistence vs runtime

**Weaknesses**:
- ❌ Synchronous loading blocks initialization (200+ coins sequentially)
- ❌ No progress resumption if interrupted
- ❌ Limited error recovery (no retry logic)

**Location**: `controllers/trading_controller.py:95-469`

---

## 2. Callback Mechanisms

### Current State: ❌ Polling-Based (Not Event-Driven)

**Architecture**:
```python
# Current approach - Polling every 1-60 seconds
while self.running:
    data = self.redis_manager.get_price(coin_symbol)
    if data:
        process(data)
    time.sleep(interval)  # Wastes CPU
```

**Workers**:
- CalculationWorker: Polls every 60s
- TradingWorker: Polls every 1s
- SyncWorker: Polls every 30s
- DataReplayer: Time-driven (1-minute intervals)

**WebSocket** (LIVE mode):
- Has callback support: `on_message(inst_id, ticker_data)`
- Async/await pattern
- Not fully implemented yet

**Issues**:
- ❌ Polling introduces 1s+ latency
- ❌ Wastes CPU cycles
- ❌ Not truly reactive

**Recommendation**: Implement Redis Pub/Sub for event-driven updates
```python
# Publish when data arrives
redis.publish('okx:price:BTC', json.dumps(price_data))

# Subscribe in workers (reactive)
pubsub = redis.pubsub()
pubsub.subscribe('okx:price:*')
for message in pubsub.listen():
    handle_update(message)  # Immediate response
```

---

## 3. Trading Logic Separation

### Design: ✅ Clean Separation of Concerns

**Layer Architecture**:
```
┌────────────────────────────────────┐
│  TradingController                 │  Orchestration
├────────────────────────────────────┤
│  TradingWorker                     │  Strategy Logic
├────────────────────────────────────┤
│  BacktestEngine                    │  Position Management
├────────────────────────────────────┤
│  CoinAttributeCalculator           │  Analysis Layer
├────────────────────────────────────┤
│  RedisManager / UnifiedPriceManager│  Data Layer
└────────────────────────────────────┘
```

**Responsibilities**:

1. **Data Layer** (foundation/)
   - UnifiedPriceManager: SQLite CRUD (no business logic)
   - RedisManager: In-memory cache operations
   - ✅ Pure data access

2. **Analysis Layer** (services/coin_attribute_calculator.py)
   - 24-hour attribute calculation
   - Trend classification, volatility metrics
   - ✅ No trading decisions (good separation)

3. **Strategy Layer** (services/trading_worker.py)
   - Implements strategy rules (60s rise > 1%)
   - Delegates filtering to calculator
   - Delegates execution to BacktestEngine
   - ✅ Clear responsibility

4. **Execution Layer** (services/backtest_engine.py)
   - Virtual position management, P&L calculation
   - Risk management (position limits, stop loss)
   - ✅ No strategy logic (good separation)

**Strengths**:
- ✅ Single Responsibility Principle applied
- ✅ Strategy parameters externalized (strategy_config.py)
- ✅ Easy to understand data flow

**Weaknesses**:
- ❌ TradingWorker tightly coupled to BacktestEngine (global singleton)
- ❌ Price tracking duplicated (TradingWorker deque + Redis)
- ❌ No strategy interface (can't plug in new strategies)

---

## 4. Simulation vs Live Data

### Design: ✅ Configuration-Driven Mode Switching

**Architecture**:
```python
# strategy_config.py
RUN_MODE = 'TEST'  # or 'LIVE'

# Data source selection
TEST Mode:  DataReplayer → Redis → Workers
LIVE Mode:  WebSocketClient → Redis → Workers
```

**Abstraction Quality**:
- ✅ Workers don't know about mode (transparent)
- ✅ Both modes use same Redis interface
- ✅ Simulation time control for backtesting
- ✅ Easy mode switching (config only)

**Implementation**:

**TEST Mode** (data_replayer.py:99-180):
```python
def _replay_loop(self):
    # Fetch 1-minute window from SQLite
    data = self._replay_time_window(current_ms, next_ms)

    # Feed to Redis (simulates live data)
    for record in data:
        self.redis_manager.set_price(coin, record)

    # Advance simulation clock
    self.current_time += timedelta(seconds=60)

    # Configurable replay speed (1x-100x)
    sleep(60 / self.replay_speed)
```

**LIVE Mode** (okx_websocket_client.py):
- Async WebSocket connections
- Callback-based: `on_message(inst_id, ticker_data)`
- Heartbeat + reconnection logic

**Weaknesses**:
- ❌ No common interface (Strategy Pattern incomplete)
- ❌ WebSocket mode not fully implemented
- ❌ No hybrid mode (replay with live overlay)

**Should Have**:
```python
class DataSource(ABC):
    @abstractmethod
    def start(self): pass

    @abstractmethod
    def stop(self): pass

    @abstractmethod
    def set_callback(self, callback: Callable): pass
```

---

## 5. Component Coupling Analysis

### Overall Coupling: ⚠️ 6.5/10 (Medium-High)

**Dependency Graph**:
```
TradingController
  ├─→ CoinProvider (loose)
  ├─→ OKXClient (loose)
  ├─→ UnifiedPriceManager (medium)
  ├─→ RedisManager (TIGHT - global singleton)
  ├─→ BacktestEngine (TIGHT - global singleton)
  ├─→ SyncWorker (medium)
  ├─→ CalculationWorker (medium)
  ├─→ TradingWorker (tight)
  └─→ DataReplayer/WebSocketClient (loose)
```

### Coupling Breakdown

**1. TIGHT Coupling** (❌ Problematic)

**Global Singletons** (6+ instances):
```python
# Pattern used everywhere
_global_redis_manager = None

def get_redis_manager() -> RedisManager:
    global _global_redis_manager
    if _global_redis_manager is None:
        _global_redis_manager = RedisManager()
    return _global_redis_manager
```

**Issues**:
- ❌ Hidden dependencies (can't see from function signature)
- ❌ Testing difficulty (can't mock easily)
- ❌ State pollution (shared state across tests)
- ❌ Initialization order dependencies

**Example** (trading_worker.py:28-38):
```python
def __init__(self, coin_symbols: List[str]):
    self.redis_manager = get_redis_manager()  # Hidden!
    self.calculator = get_coin_attribute_calculator()  # Hidden!
    self.backtest_engine = get_backtest_engine()  # Hidden!
```

**Better Approach** (Dependency Injection):
```python
def __init__(
    self,
    coin_symbols: List[str],
    redis_manager: RedisManager,
    calculator: CoinAttributeCalculator,
    backtest_engine: BacktestEngine
):
    self.redis_manager = redis_manager  # Explicit!
    self.calculator = calculator
    self.backtest_engine = backtest_engine
```

**2. MEDIUM Coupling** (✅ Acceptable)

**Configuration Dependency**:
```python
from pyapps.okx_price_monitor.core.strategy_config import strategy_config
```
- Used everywhere for parameters
- Read-only access (good)
- Could be injected for better testability

**3. LOOSE Coupling** (✅ Good)

**Layer Separation**:
- Controllers → Services → Foundation → Core → Lib
- ✅ Unidirectional dependencies
- ✅ No circular dependencies detected

---

## 6. Design Patterns Identified

### ✅ Good Patterns

**1. Singleton Pattern** (redis_manager, backtest_engine)
- Ensures single instance
- ⚠️ Overused - creates tight coupling

**2. Factory Pattern** (create_calculation_workers)
- Creates worker pools with coin distribution
- ✅ Appropriate use case

**3. Facade Pattern** (TradingController)
- Simplifies complex system interaction
- ✅ Excellent use

**4. Adapter Pattern** (InMemoryRedisClient)
- Fallback when Redis unavailable
- ✅ Great resilience pattern

### ❌ Missing Patterns

**5. Strategy Pattern** (Incomplete)
- No interface for trading strategies
- Can't plug in new strategies without code changes

**6. Observer Pattern** (Missing)
- Should use for price updates
- Should use for position changes
- Should use for signal detection

### ⚠️ Anti-Patterns Detected

**1. Service Locator** (Widespread)
```python
self.redis_manager = get_redis_manager()  # Anti-pattern
```
- Hidden dependencies
- Testing difficulty

**2. Busy Waiting** (Multiple instances)
```python
while self.running:
    time.sleep(1)  # Waste CPU
```
- Should use event-driven approach

---

## 7. Critical Issues

### 🔴 HIGH PRIORITY

**1. Concurrency Bug in BacktestEngine**

**Location**: `backtest_engine.py:198-207`

**Problem**:
```python
def open_position(self, coin_symbol: str, price: float, timestamp_ms: int):
    # NO LOCK!
    self.balance -= size  # Race condition
    self.positions[coin_symbol] = position  # Race condition
```

**Risk**:
- Multiple threads can access simultaneously
- Balance can go negative
- Positions can be lost
- P&L corruption

**Fix Required**:
```python
import threading

class BacktestEngine:
    def __init__(self):
        self._lock = threading.Lock()

    def open_position(self, ...):
        with self._lock:
            self.balance -= size
            self.positions[coin] = position
```

**2. Global State Without Synchronization**

**Shared Mutable State**:
- RedisManager: Thread-safe (Redis handles it)
- BacktestEngine: ❌ NOT thread-safe
- UnifiedPriceManager: SQLite lock (safe)

---

## 8. Performance Issues

**1. Synchronous Data Loading**
- Loads 200+ coins sequentially
- 10+ hours for full initialization
- ✅ Parallel loading guide already created

**2. Polling Overhead**
- 1-second polling loops waste CPU
- Latency in signal detection
- Should use Redis Pub/Sub

**3. Price Tracking Duplication**
- TradingWorker keeps 60s deque
- Redis already has full history
- Memory waste + potential inconsistency

---

## 9. Coupling Score by Layer

| Layer Pair | Score | Assessment |
|------------|-------|------------|
| Controller → Services | 7/10 | Tight (singletons) |
| Services → Foundation | 8/10 | Very tight (global state) |
| Foundation → Core | 3/10 | Loose (config only) |
| Services ↔ Services | 6/10 | Medium (shared singletons) |
| **Overall** | **6.5/10** | **Medium-High Coupling** |

**Target**: < 4/10 (loose coupling)

---

## 10. Recommendations

### 🔴 Critical (Fix Immediately)

**1. Add Thread Locks to BacktestEngine**
```python
# backtest_engine.py
import threading

class BacktestEngine:
    def __init__(self):
        self._lock = threading.Lock()

    def open_position(self, ...):
        with self._lock:
            # Critical section protected
            ...

    def close_position(self, ...):
        with self._lock:
            # Critical section protected
            ...
```

### 🟡 High Priority

**2. Implement Dependency Injection**

Replace service locator pattern:
```python
# Before
class TradingWorker:
    def __init__(self, coins):
        self.redis = get_redis_manager()  # Hidden dependency

# After
class TradingWorker:
    def __init__(self, coins, redis_manager, calculator, engine):
        self.redis = redis_manager  # Explicit dependency
```

**3. Event-Driven Architecture**

Replace polling with Redis Pub/Sub:
```python
# Publisher (when data arrives)
redis.publish(f'okx:price:{coin}', json.dumps(price_data))

# Subscriber (in workers)
def _listen_for_updates(self):
    pubsub = self.redis.client.pubsub()
    pubsub.subscribe('okx:price:*')
    for message in pubsub.listen():
        if message['type'] == 'message':
            self._handle_price_update(message)
```

**4. Strategy Interface**

Define abstract strategy:
```python
class TradingStrategy(ABC):
    @abstractmethod
    def filter_coins(self) -> List[str]:
        """Filter coins based on attributes"""
        pass

    @abstractmethod
    def check_buy_signal(self, coin: str) -> bool:
        """Check if buy signal detected"""
        pass

    @abstractmethod
    def check_sell_signal(self, coin: str) -> bool:
        """Check if sell signal detected"""
        pass
```

### 🟢 Medium Priority

**5. DataSource Abstraction**

Common interface for TEST/LIVE modes:
```python
class DataSource(ABC):
    @abstractmethod
    async def start(self, callback: Callable): pass

    @abstractmethod
    async def stop(self): pass

class DataReplayer(DataSource):
    async def start(self, callback):
        # Replay from SQLite
        ...

class WebSocketClient(DataSource):
    async def start(self, callback):
        # Real-time from OKX
        ...
```

**6. Remove Price Tracking Duplication**

TradingWorker should use Redis history exclusively:
```python
# Before
self.price_history = deque(maxlen=60)  # Duplication!

# After
# Query Redis directly when needed
prices = self.redis_manager.get_price_history(coin, 60)
```

**7. Parallel Data Loading**

Already documented in `PARALLEL_LOADING_IMPLEMENTATION.md`:
- Use ThreadPoolExecutor
- 10-20x speedup expected

---

## 11. Architecture Strengths

✅ **Clean Layer Separation**
- lib → core → foundation → services → controllers
- Unidirectional dependencies
- No circular dependencies

✅ **Data Flow Design**
- SQLite (persistent) → Redis (runtime) well-designed
- Deduplication at multiple levels
- Gap detection and filling

✅ **Dual-Mode Architecture**
- TEST/LIVE switching without code changes
- Simulation time control for backtesting

✅ **Resilience**
- Fallback in-memory Redis
- Duplicate detection
- Gap recovery

✅ **Configuration Externalization**
- strategy_config.py centralizes parameters
- Easy to tune without code changes

---

## 12. Final Assessment

### Overall Design: ✅ Reasonable

The architecture demonstrates solid engineering fundamentals with clear separation of concerns. The data flow (SQLite → Redis) and dual-mode design (TEST/LIVE) are particularly well-thought-out.

### Coupling: ⚠️ Medium-High (6.5/10)

The system suffers from overuse of global singletons and service locator pattern, making it difficult to test and extend. Dependency injection would significantly improve this.

### Critical Risks:

1. **Concurrency bugs** in BacktestEngine (no locks)
2. **Polling-based architecture** introduces latency
3. **Testing difficulty** from hidden dependencies

### Recommended Actions:

1. **Immediately**: Add thread locks to BacktestEngine
2. **Short-term**: Implement dependency injection
3. **Medium-term**: Event-driven architecture (Redis Pub/Sub)
4. **Long-term**: Strategy and DataSource abstractions

### Grade: B+

With recommended refactorings, can achieve **A-grade architecture** with coupling < 4/10.

---

## Related Documents

- `DATA_LOADING_PERFORMANCE_ANALYSIS.md` - Performance bottleneck analysis
- `PARALLEL_LOADING_IMPLEMENTATION.md` - 10-20x speedup guide
- `DATA_VERIFICATION_COMPLETE.md` - Data verification feature
- `TOLERANCE_FIX_COMPLETE.md` - 5-minute tolerance fix

---

## Files Reviewed

### Controllers
- `controllers/trading_controller.py` - Main orchestration

### Services
- `services/trading_worker.py` - Strategy execution
- `services/calculation_worker.py` - Attribute calculation
- `services/data_replayer.py` - Simulation mode
- `services/backtest_engine.py` - Position management
- `services/sync_worker.py` - Redis → SQLite sync

### Foundation
- `foundation/redis_manager.py` - Redis abstraction
- `foundation/unified_price_manager.py` - SQLite abstraction
- `foundation/okx_websocket_client.py` - Live mode (partial)

### Core
- `core/strategy_config.py` - Configuration
- `core/coin_provider.py` - Coin list
- `lib/okx_client.py` - API client
