# OKX API 最优方案分析

## 📊 测试结果总结

基于实际API测试，以下是关键发现：

### 1. 历史数据接口

| 接口 | 用途 | 数据格式 | 是否包含实时价格 |
|------|------|----------|-----------------|
| `GET /api/v5/market/candles` | 获取蜡烛图（最近1440条） | `[timestamp, open, high, low, close, vol, volCcy, volCcyQuote, confirm]` | ✅ 是 - close字段就是最新价格 |
| `GET /api/v5/market/history-candles` | 获取历史蜡烛图 | 同上 | ✅ 是 - 但主要用于历史分析 |

**结论**：
- ✅ **历史数据只有蜡烛图**（没有其他格式的历史价格数据）
- ✅ **蜡烛图包含实际价格**（close字段 = 该时间段的收盘价）
- ✅ **可以用于获取历史价格**（1根1小时K线 = 1小时的价格）

### 2. 实时价格接口

| 接口 | 类型 | 批量支持 | 更新频率 | 延迟 | 字段 |
|------|------|----------|----------|------|------|
| `GET /api/v5/market/tickers` | REST | ✅ 批量（698个币） | 需轮询 | 192ms | `last`=最新成交价 |
| `GET /api/v5/market/ticker` | REST | ❌ 单个 | 需轮询 | 190ms | `last`=最新成交价 |
| `WS /tickers` | WebSocket | ✅ 可订阅多个 | 实时推送 | <50ms | `last`=最新成交价 |
| `GET /api/v5/market/trades` | REST | ❌ 单个 | 需轮询 | 210ms | `px`=成交价格 |

**实时价格字段**：
```json
{
  "instId": "BTC-USDT",
  "last": "91276.7",        // ← 最新成交价（实时价格）
  "lastSz": "0.00001",      // 最新成交数量
  "askPx": "91276.7",       // 卖一价
  "bidPx": "91276.6",       // 买一价
  "open24h": "89908",       // 24小时开盘价
  "high24h": "91949.5",     // 24小时最高价
  "low24h": "89804.5",      // 24小时最低价
  "ts": "1764277610414"     // 数据生成时间戳
}
```

### 3. 性能对比

#### REST API 批量 vs 单独请求

测试场景：获取5个币的ticker数据

| 方案 | 耗时 | 请求次数 | 性能 |
|------|------|----------|------|
| **批量请求** `get_tickers(SPOT)` | 196ms | 1次 | 获取698个币，平均0.28ms/币 |
| **单独请求** `get_ticker(instId) × 5` | 363ms | 5次 | 平均72.53ms/币 |

**结论**：批量请求快 **1.9倍** （只考虑5个币），实际上批量请求可以一次获取全部698个币！

#### REST vs WebSocket

| 方案 | 优势 | 劣势 | 适用场景 |
|------|------|------|----------|
| **REST API轮询** | 简单、无需保持连接 | 延迟高（192ms）、浪费API配额 | 低频更新（>1分钟） |
| **WebSocket推送** | 实时推送、延迟低（<50ms）、无需轮询 | 需要维护长连接 | 高频更新（每秒或每次变化） |

## 🎯 最优方案设计

### 方案 A：纯REST API（当前方案）

```python
# 1. 历史数据获取（初始化阶段）
for coin in coins:
    # 使用 get_candles 获取历史数据
    # 优点：简单直接
    # 缺点：需要逐个请求（无批量接口）
    candles = client.get_candles(inst_id=f"{coin}-USDT", bar="1H", limit=100)

# 2. 实时价格更新（监控阶段）
# 使用批量 get_tickers 一次获取所有币
tickers = client.get_tickers(inst_type="SPOT")  # 一次性获取698个币
for ticker in tickers['data']:
    coin = ticker['instId'].split('-')[0]
    price = float(ticker['last'])
    # 更新内存中的CoinTracker
```

**性能评估**：
- ✅ 优点：简单、易于实现、无需维护WebSocket连接
- ✅ 一次API调用获取所有币的价格（~200ms）
- ❌ 缺点：轮询间隔受限（每3秒最多20次请求）
- ❌ 延迟较高（192ms + 轮询间隔）

### 方案 B：WebSocket实时推送（推荐方案）

```python
# 1. 历史数据获取（初始化阶段）
#    使用REST API get_candles（同方案A）

# 2. 实时价格更新（监控阶段）
#    使用WebSocket订阅tickers channel

import asyncio
import websockets
import json

async def subscribe_tickers():
    uri = "wss://ws.okx.com:8443/ws/v5/public"

    async with websockets.connect(uri) as websocket:
        # 订阅所有SPOT的tickers channel
        subscribe_msg = {
            "op": "subscribe",
            "args": [
                {"channel": "tickers", "instId": "BTC-USDT"},
                {"channel": "tickers", "instId": "ETH-USDT"},
                # ... 订阅所有297个币
            ]
        }

        await websocket.send(json.dumps(subscribe_msg))

        while True:
            message = await websocket.recv()
            data = json.loads(message)

            # 实时价格推送
            if data.get('arg', {}).get('channel') == 'tickers':
                ticker = data['data'][0]
                inst_id = ticker['instId']
                price = float(ticker['last'])

                # 实时更新内存中的CoinTracker
                coin = inst_id.split('-')[0]
                update_coin_tracker(coin, price)
```

**性能评估**：
- ✅ 优点：实时推送、延迟极低（<50ms）、无需轮询
- ✅ 每次价格变化都会推送（秒级或更快）
- ✅ 不消耗REST API配额
- ❌ 缺点：需要维护WebSocket连接、处理断线重连

### 方案 C：混合方案（最优方案）

```python
# 1. 历史数据获取（初始化阶段）
#    使用REST API get_candles（同方案A）
#    - 一次性获取10,000条历史K线
#    - 存储到数据库（SQLite）

# 2. 实时价格更新（监控阶段）
#    主要使用WebSocket，REST API作为备份

class OKXMonitor:
    def __init__(self):
        self.rest_client = create_okx_client()
        self.ws_connected = False

    async def start_websocket(self):
        """启动WebSocket实时推送"""
        try:
            # WebSocket连接和订阅
            self.ws_connected = True
            await self.subscribe_tickers()
        except Exception as e:
            print(f"[ERROR] WebSocket failed: {e}")
            self.ws_connected = False
            # 自动切换到REST API备份方案
            self.start_rest_polling()

    def start_rest_polling(self):
        """REST API轮询备份方案"""
        while not self.ws_connected:
            # 使用批量get_tickers
            tickers = self.rest_client.get_tickers(inst_type="SPOT")
            self.update_all_prices(tickers['data'])
            time.sleep(1)  # 每秒轮询一次
```

**性能评估**：
- ✅ 正常情况：WebSocket实时推送（延迟<50ms）
- ✅ 异常情况：自动切换到REST批量轮询（延迟~200ms）
- ✅ 高可用性：双重保障
- ⚠️ 复杂度适中：需要处理WebSocket生命周期

## 🔍 每秒变化的实时价格接口

根据测试和文档分析，**按每秒一次变化获取当前实时价格的最佳接口**：

### 选项1：WebSocket Tickers Channel ⭐⭐⭐⭐⭐

```
接口：wss://ws.okx.com:8443/ws/v5/public
频道：tickers
```

**特点**：
- ✅ **实时推送**：每次价格变化都会推送（不是每秒，而是每次变化！）
- ✅ **延迟极低**：<50ms
- ✅ **无需轮询**：服务器主动推送
- ✅ **批量订阅**：一次连接可订阅多个币种
- ✅ **不消耗API配额**：WebSocket独立计数

**推送频率**：
- 当价格变化时立即推送
- 即使1秒内多次变化，每次都推送
- 如果价格不变，则不推送

**限制**：
- 单个WebSocket连接最多订阅 **240个channel**
- 需要 **2-3个连接** 才能覆盖297个币

### 选项2：REST API Tickers 批量轮询 ⭐⭐⭐

```
接口：GET /api/v5/market/tickers?instType=SPOT
```

**特点**：
- ✅ **批量获取**：一次请求获取698个币
- ✅ **简单可靠**：无需维护连接
- ❌ **需要轮询**：每秒手动请求一次
- ❌ **延迟较高**：192ms + 轮询间隔
- ❌ **消耗API配额**：20请求/3秒 = 最快每秒6.67次

**轮询频率**：
- 理论最快：每秒6次（受限于20请求/3秒）
- 实际建议：每秒1-2次（节省配额）

### 选项3：REST API Ticker 单独轮询 ⭐

```
接口：GET /api/v5/market/ticker?instId=BTC-USDT
```

**不推荐**：
- ❌ 单个请求只获取1个币
- ❌ 获取297个币需要297次请求（太慢）
- ❌ 严重浪费API配额

## 📋 最终推荐方案

### 🏆 推荐方案：WebSocket主 + REST备份

```python
# 系统架构
┌─────────────────────────────────────────┐
│  历史数据获取（初始化阶段）                │
│  ├─ REST: get_candles                   │
│  ├─ 一次性获取10,000条历史K线            │
│  └─ 存储到SQLite数据库                  │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  实时价格监控（运行阶段）                 │
│  ├─ 主方案：WebSocket tickers channel   │
│  │   ├─ 实时推送（每次价格变化）         │
│  │   ├─ 延迟 <50ms                      │
│  │   └─ 2-3个连接覆盖297个币            │
│  │                                      │
│  └─ 备份方案：REST get_tickers          │
│      ├─ 批量轮询（每秒1次）              │
│      ├─ 一次请求获取698个币              │
│      └─ WebSocket断开时自动启用          │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  数据处理（内存）                        │
│  ├─ 297个CoinTracker对象                │
│  ├─ 3小时价格历史（deque）              │
│  ├─ 实时计算价格变化                    │
│  └─ 触发交易提醒                        │
└─────────────────────────────────────────┘
```

### 实现步骤

**步骤1：历史数据获取**（已完成 ✅）

```python
# 使用REST API get_candles
# 智能continuation已实现
# 速率限制已优化
```

**步骤2：实现WebSocket客户端**（待实现）

```python
# 创建 lib/okx_websocket_client.py
class OKXWebSocketClient:
    async def connect(self):
        """连接到OKX WebSocket"""

    async def subscribe_tickers(self, inst_ids: List[str]):
        """订阅ticker channel"""

    async def handle_message(self, message):
        """处理推送消息"""
```

**步骤3：集成到MonitorManager**（待实现）

```python
# 修改 services/monitor_manager.py
class MonitorManager:
    def __init__(self):
        self.ws_client = OKXWebSocketClient()
        self.use_websocket = True  # 优先使用WebSocket

    async def start_monitoring(self):
        if self.use_websocket:
            await self.start_websocket_monitoring()
        else:
            self.start_rest_monitoring()
```

## 📊 性能对比总结

| 指标 | REST轮询 | WebSocket |
|------|----------|-----------|
| **延迟** | 192ms + 间隔 | <50ms |
| **更新频率** | 每秒1-6次 | 每次价格变化 |
| **API配额消耗** | 高（每秒1次 = 1/6.67配额） | 低（独立计数） |
| **批量支持** | ✅ 698个币/次 | ✅ 240个币/连接 |
| **实现复杂度** | 简单 | 中等 |
| **可靠性** | 高（无状态） | 中（需处理断线） |

## 🎯 结论

1. **历史数据**：只有蜡烛图格式，但包含实际价格（close字段）
2. **实时价格**：ticker的`last`字段就是最新成交价
3. **最优接口**：WebSocket tickers channel（每次价格变化都推送，而不是每秒）
4. **推荐方案**：WebSocket主 + REST备份的混合方案

---

**Sources**:
- [OKX API Documentation](https://www.okx.com/docs-v5/en/)
- [OKX WebSocket API](https://www.okx.com/okx-api)
- [Python-OKX Library](https://pypi.org/project/python-okx/)
- [OKX API Guide](https://wundertrading.com/journal/en/learn/article/okx-api)
