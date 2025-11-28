# OKX API 粒度研究结果

## 🔍 研究目标

确定OKX API支持的最细数据粒度，以便设计最优的数据存储方案。

## 📊 蜡烛图（Candlestick）粒度

### 最小粒度：1分钟（1m）

OKX API **不支持**1秒级K线，**最小粒度是1分钟（1m）**。

### 完整的Bar Size列表

#### 分钟/小时级别（香港时间）
```
1m, 3m, 5m, 15m, 30m, 1H, 2H, 4H
```

#### 更大间隔（香港时间）
```
6H, 12H, 1D, 2D, 3D, 1W, 1M, 3M, 6M, 1Y
```

#### UTC时间版本
```
6Hutc, 12Hutc, 1Dutc, 1Wutc, 1Mutc, 3Mutc, 6Mutc, 1Yutc
```

### API端点

```
GET /api/v5/market/candles         # 最近的蜡烛图
GET /api/v5/market/history-candles # 历史蜡烛图
```

**参数**：
- `bar`: 粒度（1m, 3m, 5m, 15m, 30m, 1H, 2H, 4H, ...）
- `limit`: 最多300条（实时），100条（历史）

## ⚡ 实时数据（WebSocket）粒度

### WebSocket Ticker推送

**粒度**：**毫秒级（每次价格变化）**

WebSocket的tickers channel会在**每次价格变化时立即推送**，不受固定时间间隔限制。

**推送频率**：
- 活跃币种：可能每秒数十次
- 不活跃币种：可能数秒一次
- 完全由市场交易频率决定

**延迟**：<50ms

### WebSocket Trades推送

**粒度**：**每笔成交**

Trades channel推送每一笔实际成交，比ticker更细。

## 📋 双表设计方案

基于以上研究，设计两张表：

### 表1：历史蜡烛图表（粗粒度，长期存储）

**表名**：`okx_candles_{coin}`

**用途**：
- 初始化历史数据（10,000条）
- 技术分析（K线图、指标计算）
- 长期趋势分析

**粒度**：1分钟（1m）- OKX API最细粒度

**数据量**：
- 1分钟 × 10,000条 = 约7天数据
- 1小时 × 10,000条 = 约13个月数据

**表结构**：
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
    UNIQUE(timestamp)
);
```

**优点**：
- ✅ 数据规整，固定间隔
- ✅ 适合技术分析
- ✅ 数据量可控

**缺点**：
- ❌ 粒度粗（1分钟）
- ❌ 无法回测秒级策略

### 表2：实时价格表（细粒度，短期存储）

**表名**：`okx_realtime_prices_{coin}`

**用途**：
- 记录程序运行期间的所有价格变化
- 高精度回测（毫秒级）
- 价格波动研究
- 微观市场结构分析

**粒度**：**每次价格变化**（WebSocket推送）

**数据量**（示例：BTC，活跃交易）：
- 假设平均每秒10次推送
- 1小时 = 36,000条记录
- 1天 = 864,000条记录
- 1周 = 6,048,000条记录

**表结构**：
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
    UNIQUE(timestamp)
);
```

**优点**：
- ✅ 粒度极细（毫秒级）
- ✅ 完整记录市场微观结构
- ✅ 支持高精度回测

**缺点**：
- ❌ 数据量大（需要优化）
- ❌ 仅覆盖程序运行期间

## 💡 数据存储优化策略

### 策略1：时间窗口限制

只保留最近N天的实时数据：

```python
# 保留最近7天
MAX_REALTIME_DAYS = 7

# 定期清理
DELETE FROM okx_realtime_prices_btc
WHERE timestamp < (current_timestamp - 7 days);
```

### 策略2：采样存储

不是每次推送都存储，而是：

```python
# 选项A：时间间隔采样（如每100ms只存一次）
MIN_INTERVAL_MS = 100

# 选项B：价格变化阈值（如变化>0.01%才存）
MIN_PRICE_CHANGE_PCT = 0.01
```

### 策略3：压缩旧数据

将旧的实时数据聚合为蜡烛图：

```python
# 1小时后，将实时数据聚合为1秒K线
# 1天后，将1秒K线聚合为1分钟K线
# 1周后，删除1分钟K线（已有历史蜡烛图）
```

### 策略4：分区存储

按日期分表：

```sql
okx_realtime_prices_btc_20251128
okx_realtime_prices_btc_20251129
okx_realtime_prices_btc_20251130
```

定期删除旧分区。

## 🎯 推荐方案

### 初始实现（简单版）

```python
# 表1：1分钟K线，保留10,000条
fetch_candles(bar="1m", limit=10000)

# 表2：实时价格，保留最近3天
# - 每次WebSocket推送都存储
# - 每天凌晨删除3天前的数据
```

### 优化版（数据量大时）

```python
# 表1：1分钟K线，保留10,000条

# 表2：实时价格，采样存储
# - 最小间隔100ms（每秒最多10条）
# - 保留最近7天
# - 超过7天的聚合为1秒K线存档
```

## 📈 数据量估算

### 活跃币种（如BTC）

假设：
- WebSocket平均每秒10次推送
- 采样后每秒1次存储

**每日数据量**：
- 无采样：86,400秒 × 10 = 864,000条
- 100ms采样：86,400秒 × 1 = 86,400条
- 1秒采样：86,400秒 × 1 = 86,400条

**存储空间**（单个币种）：
- 每条记录约50字节
- 1天（1秒采样）：86,400 × 50 = 4.3 MB
- 7天：30 MB
- 297个币：30 MB × 297 = 8.9 GB

### 不活跃币种

假设：
- WebSocket平均每10秒1次推送

**每日数据量**：
- 8,640条

**7天存储**：约3 MB/币

## 🔄 数据流

### 历史数据流（表1）

```
程序启动
    ↓
fetch_candles(bar="1m", limit=10000)
    ↓
存储到 okx_candles_{coin}
    ↓
用于初始化 CoinTracker 历史窗口
```

### 实时数据流（表2）

```
WebSocket推送（每次价格变化）
    ↓
检查是否需要存储（采样策略）
    ↓
存储到 okx_realtime_prices_{coin}
    ↓
同时更新 CoinTracker 内存数据
    ↓
（可选）定期清理旧数据
```

## 📝 总结

| 维度 | 历史蜡烛图表 | 实时价格表 |
|------|------------|-----------|
| **粒度** | 1分钟 | 毫秒级（每次变化） |
| **数据源** | REST API | WebSocket |
| **时间范围** | 固定10,000条 | 滚动窗口（如7天） |
| **用途** | 技术分析、长期趋势 | 高精度回测、微观分析 |
| **数据量** | 可控（约10,000条/币） | 大（约60万条/币/周） |
| **优化策略** | 无需优化 | 采样+定期清理 |

---

**Sources**:
- [OKX API Documentation](https://www.okx.com/docs-v5/en/)
- [OKX API Guide](https://algotrading101.com/learn/okx-api-guide/)
- [OKX Candlestick Documentation](https://cran.r-project.org/web/packages/okxAPI/okxAPI.pdf)
