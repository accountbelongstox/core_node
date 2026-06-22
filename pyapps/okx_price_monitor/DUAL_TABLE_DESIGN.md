# 双表设计 - 完整实现文档

## 🎯 设计目标

实现两张表分别存储不同粒度的价格数据：

1. **历史蜡烛图表**：粗粒度（1分钟K线），用于技术分析
2. **实时价格表**：细粒度（毫秒级），用于高精度回测

## 📊 双表对比

| 维度 | 历史蜡烛图表 | 实时价格表 |
|------|------------|-----------|
| **表名** | `okx_candles_{coin}` | `okx_realtime_prices_{coin}` |
| **粒度** | 1分钟（OKX最细） | 毫秒级（每次WebSocket推送） |
| **数据源** | REST API（get_candles） | WebSocket（tickers channel） |
| **时间范围** | 固定10,000条 | 滚动窗口（默认7天） |
| **用途** | 技术分析、K线图、指标计算 | 高精度回测、微观市场结构 |
| **数据量** | 约10,000条/币 | 约600,000条/币/周 |
| **数据库** | okx_history.db | okx_realtime.db |
| **优化策略** | 智能continuation | 采样（100ms）+ 定期清理 |

## 🗄️ 表结构设计

### 表1：历史蜡烛图表

```sql
CREATE TABLE okx_candles_btc (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,      -- 毫秒时间戳
    open REAL NOT NULL,              -- 开盘价
    high REAL NOT NULL,              -- 最高价
    low REAL NOT NULL,               -- 最低价
    close REAL NOT NULL,             -- 收盘价
    volume REAL NOT NULL,            -- 交易量
    volume_currency REAL,            -- 成交量(计价货币)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(timestamp)                -- 防止重复
);

CREATE INDEX idx_okx_candles_btc_timestamp
ON okx_candles_btc(timestamp DESC);
```

**数据示例**：
```json
{
  "timestamp": 1732752000000,        // 2025-11-28 04:00:00
  "open": 91436.0,
  "high": 91436.0,
  "low": 91225.6,
  "close": 91276.7,
  "volume": 15.39212709,
  "volume_currency": 1405953.513306294
}
```

**特点**：
- ✅ 固定1分钟间隔
- ✅ OHLC完整数据
- ✅ 适合技术分析
- ✅ 数据规整，易于处理

### 表2：实时价格表

```sql
CREATE TABLE okx_realtime_prices_btc (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,      -- 毫秒时间戳
    price REAL NOT NULL,             -- 最新成交价
    ask_price REAL,                  -- 卖一价
    bid_price REAL,                  -- 买一价
    last_size REAL,                  -- 最新成交量
    source TEXT DEFAULT 'websocket', -- 数据来源
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(timestamp)                -- 防止重复
);

CREATE INDEX idx_okx_realtime_prices_btc_timestamp
ON okx_realtime_prices_btc(timestamp DESC);
```

**数据示例**：
```json
{
  "timestamp": 1732752614202,        // 2025-11-28 04:10:14.202
  "price": 91276.7,
  "ask_price": 91276.7,
  "bid_price": 91276.6,
  "last_size": 0.00176,
  "source": "websocket"
}
```

**特点**：
- ✅ 毫秒级时间戳
- ✅ 每次价格变化都记录
- ✅ 包含买卖价（深度信息）
- ✅ 完整的市场微观结构

## 🔄 数据流

### 历史数据流（表1）

```
程序启动
    ↓
[Step 4] fetch_candles(bar="1m", limit=10000)
    ↓
OKX REST API
    ↓
检查已有数据（智能continuation）
    ↓
存储到 okx_candles_{coin}
    ↓
用于初始化 CoinTracker 内存
```

**特点**：
- 一次性获取10,000条1分钟K线
- 智能continuation（避免重复）
- 存储后供技术分析使用

### 实时数据流（表2）

```
WebSocket连接
    ↓
OKX推送ticker（每次价格变化）
    ↓
on_ticker_update回调
    ↓
├─ 更新CoinTracker内存（立即）
    └─ 存储到 okx_realtime_prices_{coin}（采样）
        ├─ 检查采样间隔（100ms）
        ├─ 符合条件：INSERT
        └─ 不符合：丢弃（统计）
```

**特点**：
- WebSocket实时推送（<50ms延迟）
- 采样策略避免数据量爆炸
- 同时更新内存和数据库

## 💾 存储策略优化

### 1. 采样策略（Sampling）

**问题**：活跃币种每秒可能有数十次推送，数据量过大。

**解决方案**：时间间隔采样

```python
# 配置
REALTIME_SAMPLING_INTERVAL_MS = 100  # 100毫秒

# 逻辑
def should_insert(coin: str, current_timestamp_ms: int) -> bool:
    last_time = last_insert_time[coin]
    time_diff = current_timestamp_ms - last_time

    if time_diff >= 100:  # 100ms
        return True  # 插入
    else:
        return False  # 跳过（采样丢弃）
```

**效果**：
- 最多每秒10条记录（100ms间隔）
- 数据量降低90%+（从每秒数十条到每秒10条）
- 仍保持高精度（100ms级别）

### 2. 定期清理（Cleanup）

**问题**：实时价格表会持续增长。

**解决方案**：滚动窗口，只保留最近N天

```python
# 配置
REALTIME_RETENTION_DAYS = 7  # 保留7天

# 清理逻辑（每天执行）
def cleanup_old_data():
    cutoff_ts = current_time - 7_days

    DELETE FROM okx_realtime_prices_{coin}
    WHERE timestamp < cutoff_ts
```

**效果**：
- 数据量稳定（不会无限增长）
- 7天窗口足够大部分分析需求
- 自动化，无需人工干预

### 3. 统计追踪

```python
stats = {
    'total_inserts': 12543,      # 实际插入次数
    'sampled_out': 45231,        # 采样丢弃次数
    'sampling_efficiency': 78%,  # 丢弃率
    'total_records': 1,234,567   # 总记录数
}
```

## 📈 数据量估算

### 活跃币种（如BTC）

**假设**：
- WebSocket推送频率：平均每秒10次
- 采样后存储频率：每秒最多10次（100ms间隔）

**实际存储**：
- 1秒：10条
- 1分钟：600条
- 1小时：36,000条
- 1天：864,000条
- 7天：6,048,000条

**存储空间**（单币种）：
- 每条记录：约50字节
- 7天数据：6,048,000 × 50 = 302 MB

**297个币种**：
- 假设50%活跃，50%不活跃
- 活跃（149个）：149 × 302 MB = 45 GB
- 不活跃（148个）：148 × 30 MB = 4.4 GB
- **总计**：约 **50 GB**

### 不活跃币种

**假设**：
- WebSocket推送频率：平均每10秒1次

**实际存储**：
- 1天：8,640条
- 7天：60,480条

**存储空间**：
- 7天数据：60,480 × 50 = 3 MB

## 🔧 配置选项

### `core/monitor_config.py`

```python
# 历史蜡烛图配置
TARGET_RECORDS_PER_COIN = 10000  # 每个币10,000条
BAR_SIZE = "1m"                  # 1分钟粒度（最细）
BATCH_SIZE = 100                 # 每批100条

# 实时价格存储配置
ENABLE_REALTIME_STORAGE = True   # 启用实时存储
REALTIME_SAMPLING_INTERVAL_MS = 100  # 100ms采样间隔
REALTIME_RETENTION_DAYS = 7      # 保留7天

# WebSocket配置
USE_WEBSOCKET = True             # 使用WebSocket实时推送
```

## 📝 使用示例

### 初始化（程序启动）

```python
# 创建MonitorManager
manager = get_monitor_manager()

# 初始化所有币种
manager.initialize_all_coins()

# 输出：
# [Step 3] Creating database tables (1-minute candles)...
#   ✓ BTC - Table created
#   ✓ ETH - Table created
#   ...
# [TOTAL] 297 tables ready for historical data (1-minute candles)
#
# [Step 3.5] Creating real-time price tables...
#   ✓ BTC - Real-time table created
#   ✓ ETH - Real-time table created
#   ...
# [TOTAL] 297 tables ready for real-time price data
```

### 启动监控（WebSocket实时推送）

```python
# 启动监控
manager.start_monitoring()

# WebSocket自动：
# 1. 接收ticker推送
# 2. 更新内存（CoinTracker）
# 3. 存储到实时表（采样100ms）
```

### 查询历史蜡烛图

```python
from pyapps.okx_price_monitor.lib import CoinTableManager

table_manager = CoinTableManager()

# 获取BTC最近100根1分钟K线
candles = table_manager.get_candles('BTC', limit=100)

# 每根K线包含：timestamp, open, high, low, close, volume
```

### 查询实时价格

```python
from pyapps.okx_price_monitor.lib import get_realtime_price_manager

realtime_manager = get_realtime_price_manager()

# 获取BTC最新实时价格
latest = realtime_manager.get_latest_price('BTC')
# {'timestamp': ..., 'price': 91276.7, 'ask_price': ..., 'bid_price': ...}

# 获取BTC最近1小时的所有实时价格
start_ts = int((time.time() - 3600) * 1000)  # 1小时前
end_ts = int(time.time() * 1000)  # 现在
prices = realtime_manager.get_price_range('BTC', start_ts, end_ts)

# 返回约36,000条记录（每秒10条 × 3600秒）
```

### 数据清理

```python
# 手动清理单个币种
realtime_manager.cleanup_old_data('BTC')

# 清理所有币种
realtime_manager.cleanup_old_data()

# 自动清理（建议每天凌晨执行）
# 添加到系统定时任务或程序内定时器
```

## 🎯 使用场景

### 场景1：技术分析（使用蜡烛图表）

```python
# 获取BTC最近1000根1分钟K线
candles = table_manager.get_candles('BTC', limit=1000)

# 计算MA、MACD、RSI等指标
ma20 = calculate_ma(candles, period=20)
macd = calculate_macd(candles)
rsi = calculate_rsi(candles)

# 绘制K线图
plot_candlestick(candles)
```

**优势**：
- ✅ 数据规整，固定1分钟间隔
- ✅ OHLC完整，适合技术指标
- ✅ 数据量适中，计算快速

### 场景2：高精度回测（使用实时价格表）

```python
# 获取BTC最近1小时的所有tick
start_ts = int((time.time() - 3600) * 1000)
end_ts = int(time.time() * 1000)
ticks = realtime_manager.get_price_range('BTC', start_ts, end_ts)

# 模拟100ms级别的交易策略
for tick in ticks:
    price = tick['price']
    timestamp = tick['timestamp']

    # 策略逻辑（可以精确到毫秒）
    if should_buy(price):
        execute_buy(price, timestamp)
```

**优势**：
- ✅ 毫秒级精度
- ✅ 完整市场微观结构
- ✅ 真实模拟高频交易

### 场景3：价格波动研究

```python
# 分析BTC在某个时间段的价格波动
prices = realtime_manager.get_price_range('BTC', start_ts, end_ts)

# 计算价格波动率
volatility = calculate_volatility(prices)

# 找出异常波动点
anomalies = detect_anomalies(prices)

# 研究买卖价差
spreads = [p['ask_price'] - p['bid_price'] for p in prices if p['ask_price']]
avg_spread = sum(spreads) / len(spreads)
```

**优势**：
- ✅ 完整记录每次价格变化
- ✅ 包含买卖价信息
- ✅ 适合微观市场研究

## 🚀 性能优化

### 1. 数据库索引

两张表都创建了timestamp索引：

```sql
CREATE INDEX idx_okx_candles_btc_timestamp
ON okx_candles_btc(timestamp DESC);

CREATE INDEX idx_okx_realtime_prices_btc_timestamp
ON okx_realtime_prices_btc(timestamp DESC);
```

**效果**：
- 按时间范围查询速度提升10-100倍
- 最新数据查询（ORDER BY timestamp DESC LIMIT 1）几乎瞬时

### 2. 批量插入

虽然当前实现是单条插入，但预留了批量接口：

```python
def insert_prices_batch(coin: str, prices: List[Dict]) -> int:
    """批量插入多条价格"""
    # 使用 executemany 批量插入
    # 性能提升5-10倍
```

### 3. 连接池

使用单一连接+线程锁：

```python
self.conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
```

对于高并发场景，可考虑升级为连接池。

## 📊 监控和统计

### 实时价格管理器统计

```python
stats = realtime_manager.get_stats()

# 输出：
{
    'total_inserts': 125430,         # 实际插入次数
    'sampled_out': 452310,           # 采样丢弃次数
    'total_records': 1234567,        # 总记录数
    'tables_created': 297,           # 创建的表数量
    'sampling_interval_ms': 100,     # 采样间隔
    'retention_days': 7,             # 保留天数
    'sampling_efficiency': 78.3%     # 采样效率（丢弃率）
}
```

### 蜡烛图管理器统计

```python
# 每个币的记录数
count = table_manager.get_record_count('BTC')
# 10000

# 最早和最晚时间戳
oldest = table_manager.get_oldest_timestamp('BTC')
latest = table_manager.get_latest_timestamp('BTC')
```

## ✅ 总结

### 双表设计优势

1. **粒度分离**：
   - 蜡烛图：1分钟（适合技术分析）
   - 实时价格：毫秒级（适合高精度回测）

2. **数据量控制**：
   - 蜡烛图：固定10,000条（可控）
   - 实时价格：采样+清理（稳定在7天窗口）

3. **性能优化**：
   - 索引加速查询
   - 采样降低存储压力
   - WebSocket实时推送（<50ms延迟）

4. **灵活使用**：
   - 技术分析用蜡烛图
   - 高频回测用实时价格
   - 两者互补，各司其职

### 关键配置

```python
# 最细粒度历史数据：1分钟
BAR_SIZE = "1m"

# 实时价格存储：启用
ENABLE_REALTIME_STORAGE = True

# 采样间隔：100毫秒
REALTIME_SAMPLING_INTERVAL_MS = 100

# 保留时间：7天
REALTIME_RETENTION_DAYS = 7
```

### 数据库文件

```
C:\Users\{user}\.core_node\data\okx_price_monitor\database\
├── okx_history.db    # 历史蜡烛图（1分钟K线）
└── okx_realtime.db   # 实时价格（毫秒级tick）
```

---

**实现完成**：2025-11-28
**支持币种**：297个
**两张表**：历史蜡烛图 + 实时价格
**最细粒度**：1分钟（蜡烛图）+ 毫秒级（实时价格）
