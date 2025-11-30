# URL Rate Limiter - 网络请求限流器

## 功能说明

为 Placeholder Image Generator MCP 服务添加了 URL 请求限流功能，确保对同一个 URL 的请求间隔至少 5 秒，提高请求成功率并防止被 API 限流。

## 核心特性

### 1. 智能限流
- **最小请求间隔**: 5秒
- **独立追踪**: 每个 URL 单独计时
- **自动等待**: 不满 5 秒自动 sleep

### 2. 持久化缓存
- **存储位置**: `C:\Users\<用户名>\.core_node\placeholder_image_generator\`
- **文件命名**: URL 的 MD5 哈希值 + `.json`
- **内容记录**:
  - URL 原始地址
  - URL MD5 哈希值
  - 上次请求时间戳
  - 上次请求时间（ISO格式）

### 3. 覆盖范围
所有网络图片源都受限流保护：
- ✅ Bing Random Image API
- ✅ Unsplash Random API
- ✅ Unsplash Search API
- ✅ Unsplash 图片下载 URL
- ✅ RPic Photography API
- ✅ Ltyuanfang Landscape API

## 技术实现

### URLRateLimiter 类

```python
class URLRateLimiter:
    """URL 请求限流管理器"""

    MIN_REQUEST_INTERVAL = 5.0  # 5秒最小间隔

    def wait_if_needed(self, url: str):
        """检查并等待以满足限流要求"""
        # 1. 读取上次请求时间
        # 2. 计算已过时间
        # 3. 如果不足5秒，自动sleep
        # 4. 记录本次请求时间
```

### 缓存文件结构

```json
{
  "url": "https://api.unsplash.com/photos/random",
  "url_hash": "a1b2c3d4e5f6...",
  "last_request_time": 1699123456.789,
  "last_request_datetime": "2024-11-04T10:30:56.789000"
}
```

### MD5 哈希

- 使用 `hashlib.md5()` 对 URL 进行编码
- 示例：
  - URL: `https://bing.img.run/rand_1366x768.php`
  - MD5: `abc123def456...`
  - 文件: `abc123def456....json`

## 使用示例

### 自动应用（无需手动调用）

```python
# 创建生成器（自动初始化限流器）
generator = PlaceholderImageGenerator()

# 生成图片（自动应用限流）
generator.generate_placeholder("image.jpg", 800, 600, "unsplash_image")
# 第一次请求: 立即执行
# 5秒内再次请求同一URL: 自动等待

# 不同的图片类型会调用不同的URL，不会互相影响
generator.generate_placeholder("image2.jpg", 800, 600, "bing_image")  # 不会等待
```

### 限流日志输出

```
[RATE_LIMITER] Cache directory: C:\Users\YourName\.core_node\placeholder_image_generator
[RATE_LIMITER] First request for this URL
[INFO] Generating UNSPLASH PHOTO placeholder: 800x600

# 5秒内再次请求
[RATE_LIMITER] URL: https://api.unsplash.com/photos/random...
[RATE_LIMITER] Last request: 2.34s ago
[RATE_LIMITER] Waiting 2.66s to respect rate limit...
[RATE_LIMITER] Wait complete, proceeding with request
```

## 测试验证

运行测试脚本：

```bash
cd D:\programing\core_node\ncore\mcp_server\placeholder_image_generator
python test_rate_limiter.py
```

**预期输出：**
```
============================================================
Testing URLRateLimiter
============================================================

[TEST 1] First request (should proceed immediately)
✓ First request completed in 0.01s

[TEST 2] Second request to same URL (should wait ~5s)
[RATE_LIMITER] Waiting 4.99s to respect rate limit...
✓ Second request completed after 5.00s
✓ PASS: Rate limiting working correctly (waited ~5s)

[TEST 3] Request to different URL (should proceed immediately)
✓ Different URL request completed in 0.00s
✓ PASS: Different URL not rate-limited

============================================================
Rate limiter tests complete!
============================================================
```

## 优势总结

### ✅ 提高成功率
- 避免短时间内重复请求同一API被限流
- 确保每次请求都有足够间隔

### ✅ 持久化追踪
- 即使程序重启，限流记录依然有效
- 跨会话保护API访问

### ✅ 独立URL管理
- 不同URL独立计时，互不影响
- Unsplash、Bing、RPic、Ltyuanfang 可以并行使用

### ✅ 自动透明
- 无需修改调用代码
- 自动在后台工作

### ✅ 详细日志
- 清晰显示等待原因和时间
- 方便调试和监控

## 文件位置

### 源代码
- 主文件: `D:\programing\core_node\ncore\mcp_server\placeholder_image_generator\main.py`
  - `URLRateLimiter` 类（第70-153行）
  - 集成到 `PlaceholderImageGenerator.__init__`（第237-240行）
  - 应用到所有网络请求方法

### 缓存目录
- Windows: `C:\Users\<用户名>\.core_node\placeholder_image_generator\`
- Linux/Mac: `~/.core_node/placeholder_image_generator/`

### 测试脚本
- `test_rate_limiter.py` - 限流功能测试

## 配置说明

### 修改限流间隔

编辑 `main.py` 的 `URLRateLimiter` 类：

```python
class URLRateLimiter:
    MIN_REQUEST_INTERVAL = 5.0  # 改为其他值（单位：秒）
```

### 清理缓存

删除缓存目录下的所有 `.json` 文件：

```bash
# Windows
del /Q C:\Users\<用户名>\.core_node\placeholder_image_generator\*.json

# Linux/Mac
rm ~/.core_node/placeholder_image_generator/*.json
```

## 注意事项

1. **首次请求**: 不会有任何延迟
2. **不同URL**: 不会互相影响
3. **缓存持久**: 程序重启后仍然生效
4. **自动创建**: 缓存目录会自动创建
5. **MD5唯一**: 相同URL总是生成相同的哈希值

## 更新日期

2024-11-04
