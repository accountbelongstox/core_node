# Rate Limiting and Request Speed Improvements

## 🎯 问题解决

### 之前的问题

1. **速率显示不准确**：只显示 `Rate: 18/20`，看不出实际请求速度
2. **无法诊断性能**：不知道API调用耗时、等待时间
3. **无法检测超速**：不知道是否触发限流

### 现在的改进

✅ **精确的实际速率计算**：基于真实请求时间戳计算 req/s
✅ **详细的时间统计**：显示API调用时间和等待时间
✅ **超速检测**：显示是否被限流
✅ **综合性能指标**：效率、平均间隔等

## 📊 新的进度输出格式

### 输出示例

```
[PROGRESS] BTC-USDT: Batch  10, Fetched  1000, Inserted  1000 | Rate: 18/20 ✓ | Speed:  6.2 req/s | API:  120ms, Wait:    0ms
[PROGRESS] BTC-USDT: Batch  20, Fetched  2000, Inserted  2000 | Rate: 20/20 ⚠ | Speed:  6.5 req/s | API:  135ms, Wait:  150ms
[PROGRESS] BTC-USDT: Batch  30, Fetched  3000, Inserted  3000 | Rate: 19/20 ✓ | Speed:  6.4 req/s | API:  118ms, Wait:   10ms
```

### 字段说明

| 字段 | 说明 | 示例 |
|------|------|------|
| `Batch` | 批次编号 | `10` = 第10个批次 |
| `Fetched` | 已获取的记录数 | `1000` = 已获取1000条 |
| `Inserted` | 实际插入的记录数 | `1000` = 实际插入1000条（无重复） |
| `Rate` | 窗口内请求数/最大请求数 | `18/20` = 当前窗口内18个请求，最大20个 |
| `✓/⚠` | 限流状态 | `✓` = 正常, `⚠` = 已达上限（被限流） |
| `Speed` | **实际请求速率** | `6.2 req/s` = 每秒6.2个请求 |
| `API` | API调用耗时 | `120ms` = API响应时间 |
| `Wait` | 限流等待时间 | `150ms` = 因限流等待的时间 |

## 🔬 速率计算方法

### 1. 实际速率（Actual Rate）

基于**当前时间窗口内**的真实请求时间戳计算：

```python
# 使用窗口内最早和最晚的请求时间
oldest_request = requests[0]  # 窗口内最早的请求时间
newest_request = requests[-1]  # 窗口内最晚的请求时间
duration = newest_request - oldest_request

# 计算实际速率
actual_rate = (requests_in_window - 1) / duration  # req/s
```

**特点**：
- ✅ 反映当前时刻的实际速度
- ✅ 基于真实请求时间戳，不是估算
- ✅ 考虑了限流等待时间的影响

### 2. 整体速率（Overall Rate）

从程序启动到现在的平均速率：

```python
total_duration = current_time - start_time
overall_rate = total_requests / total_duration  # req/s
```

**特点**：
- 反映整体平均性能
- 包含所有历史请求
- 用于长期性能分析

### 3. 效率计算

```python
efficiency = 100.0 * (1.0 - (total_wait_time / total_duration))
```

**说明**：
- `100%` = 没有等待时间，全速运行
- `90%` = 10%的时间在等待
- `50%` = 一半时间在等待（严重限流）

## 📈 性能指标含义

### Speed: 6.2 req/s

**含义**：当前实际请求速度是每秒6.2个请求

**理论最大值计算**：
- 限制：20个请求 / 3秒
- 理论最大：20 / 3 = 6.67 req/s

**实际观察**：
- `6.0-6.5 req/s` ✅ 正常，接近理论最大值
- `3.0-5.0 req/s` ⚠️ 偏慢，可能网络延迟或API响应慢
- `<3.0 req/s` ❌ 很慢，需要检查问题

### API: 120ms

**含义**：OKX API响应时间是120毫秒

**正常范围**：
- `50-200ms` ✅ 正常
- `200-500ms` ⚠️ 偏慢
- `>500ms` ❌ 很慢，网络或API问题

### Wait: 150ms

**含义**：因为限流而等待了150毫秒

**分析**：
- `0ms` ✅ 没有限流，速度充足
- `<100ms` ✓ 轻微限流，正常
- `100-500ms` ⚠️ 明显限流
- `>500ms` ❌ 严重限流

### Rate: 18/20 ✓

**含义**：当前时间窗口内有18个请求，最大允许20个

**状态标记**：
- `✓` = 未达上限 (`< max_requests`)
- `⚠` = 已达上限 (`>= max_requests`)，下一个请求会等待

## 🔧 实现细节

### 1. 增强的 RateLimiter

新增字段：

```python
class RateLimiter:
    def __init__(self):
        # ... 原有字段
        self.total_requests = 0        # 总请求数
        self.total_wait_time = 0.0     # 总等待时间
        self.last_request_time = None  # 上次请求时间
        self.start_time = time.time()  # 启动时间
```

`acquire()` 返回值：

```python
{
    'wait_time': 0.150,        # 等待时间（秒）
    'request_number': 1234,    # 请求编号
    'timestamp': 1704438000.5  # 请求时间戳
}
```

`get_stats()` 返回值：

```python
{
    'requests_in_window': 18,   # 窗口内请求数
    'max_requests': 20,         # 最大请求数
    'available_slots': 2,       # 可用槽位
    'time_window': 3.0,         # 时间窗口（秒）
    'total_requests': 1234,     # 总请求数
    'actual_rate': 6.2,         # 实际速率（req/s）
    'overall_rate': 5.8,        # 整体速率（req/s）
    'avg_interval': 0.172,      # 平均间隔（秒）
    'total_wait_time': 45.2,    # 总等待时间（秒）
    'efficiency': 92.3,         # 效率（%）
    'is_throttled': False       # 是否被限流
}
```

### 2. 增强的 fetch_candles_batch

新增返回值：

```python
def fetch_candles_batch(...) -> Tuple[List[List], Optional[str], Dict]:
    # ... 执行请求

    rate_info = {
        'wait_time': 0.150,          # 限流等待时间
        'request_duration': 0.120,   # API调用耗时
        'actual_rate': 6.2,          # 当前速率
        'overall_rate': 5.8,         # 整体速率
        'requests_in_window': 18,    # 窗口内请求数
        'max_requests': 20,          # 最大请求数
        'is_throttled': False        # 是否限流
    }

    return candles, next_after, rate_info
```

### 3. 改进的进度输出

```python
if batch_count % 10 == 0:
    actual_rate = rate_info.get('actual_rate', 0)
    wait_time = rate_info.get('wait_time', 0)
    req_duration = rate_info.get('request_duration', 0)
    in_window = rate_info.get('requests_in_window', 0)
    max_req = rate_info.get('max_requests', 20)
    throttled = rate_info.get('is_throttled', False)

    throttle_mark = "⚠" if throttled else "✓"

    print(
        f"[PROGRESS] {inst_id}: Batch {batch_count:3d}, "
        f"Fetched {total_fetched:5d}, Inserted {total_inserted:5d} | "
        f"Rate: {in_window:2d}/{max_req} {throttle_mark} | "
        f"Speed: {actual_rate:4.1f} req/s | "
        f"API: {req_duration*1000:4.0f}ms, Wait: {wait_time*1000:4.0f}ms"
    )
```

## 🎯 使用建议

### 1. 监控实际速率

**目标**：保持在 6.0-6.5 req/s

- 如果长期 < 5.0 req/s，检查：
  - 网络连接
  - API服务状态
  - 是否有其他程序占用带宽

### 2. 监控API响应时间

**目标**：保持在 50-200ms

- 如果 > 300ms：
  - 检查网络延迟
  - 检查OKX服务器状态
  - 考虑使用更快的网络连接

### 3. 监控等待时间

**目标**：尽量接近 0ms

- 如果经常 > 100ms：
  - 说明限流生效
  - 速率已经达到上限
  - 这是正常的，说明在充分利用API配额

### 4. 监控效率

**目标**：> 85%

- 如果 < 80%：
  - 可能网络问题
  - 可能API响应慢
  - 检查total_wait_time是否过高

## ✅ 修改的文件

1. `lib/rate_limiter.py` - 增强速率跟踪和统计
2. `lib/okx_client.py` - 添加 `after`/`before` 参数支持
3. `lib/history_fetcher.py` - 显示详细速率信息

## 📝 总结

### 改进前

```
[PROGRESS] AERGO-USDT: Batch 10, Fetched 1000, Inserted 100, Rate: 18/20
```

**问题**：
- ❌ 看不出实际速度
- ❌ 不知道API耗时
- ❌ 不知道是否限流
- ❌ 无法诊断性能问题

### 改进后

```
[PROGRESS] AERGO-USDT: Batch  10, Fetched  1000, Inserted  1000 | Rate: 18/20 ✓ | Speed:  6.2 req/s | API:  120ms, Wait:    0ms
```

**优势**：
- ✅ 清楚显示实际请求速率（6.2 req/s）
- ✅ 显示API响应时间（120ms）
- ✅ 显示限流等待时间（0ms）
- ✅ 显示限流状态（✓ = 正常）
- ✅ 便于诊断性能问题
- ✅ 基于真实时间戳计算，精确可靠
