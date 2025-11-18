# RPC v2 同步调用快速参考

**一句话总结**: 路由注册时添加 `sync=True`，响应立即返回（< 100ms），无需等待 ACK（3秒）。

---

## 快速使用

### 注册同步路由

```python
from pycore.pyutils.rpc_v2.server import FastAPIRPCServer

server = FastAPIRPCServer(options={"port": 58765})

# ✅ 同步路由（快速查询）
def get_status(params, request_id, context):
    return {"status": "ok", "uptime": 3600}

server.route('get_status', get_status, sync=True)  # ⭐ 关键参数

# ❌ 异步路由（耗时操作）
async def process_file(params, request_id, context):
    await heavy_work()
    return {"result": "done"}

server.route('process_file', process_file)  # sync=False (默认)
```

### 客户端检测

```python
response = requests.post("http://localhost:58765/rpc/get_status", json={})
result = response.json()

if result.get("sync_response"):
    print("同步响应，立即返回")  # ✅ < 100ms
else:
    print("异步响应，需等待/查询")  # ⚠️ ~3秒
```

---

## 性能对比

| 特性 | 同步路由 (sync=True) | 异步路由 (sync=False) |
|------|---------------------|---------------------|
| **响应标记** | `sync_response: true` | `requires_ack: true` |
| **响应时间** | < 100ms ⚡ | ~3秒 🐢 |
| **适用场景** | 快速查询、状态检查 | 文件处理、耗时计算 |

---

## 何时使用同步路由？

### ✅ 应该使用 (sync=True)
- 数据库单表查询 (< 10ms)
- 缓存读取 (< 1ms)
- 配置读取 (< 5ms)
- 状态检查 (< 20ms)
- 简单计算 (< 50ms)

### ❌ 不应该使用 (sync=False)
- 文件 I/O 操作 (> 100ms)
- 网络请求 (不可预测)
- 数据库复杂查询 (> 100ms)
- 图像处理 (> 1秒)
- AI 推理 (> 1秒)

---

## 文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `common/typing.py` | ✅ 核心 | `RouteConfig` 类型定义 |
| `server/routes_manager.py` | ✅ 核心 | 路由配置存储 + `is_sync_route()` |
| `server/fastapi_server.py` | ✅ 核心 | HTTP 处理分支逻辑 |
| `SYNC_MODE_IMPLEMENTATION.md` | 📖 文档 | 完整设计文档（260行） |
| `RPC_V2_SYNC_MODE_IMPLEMENTATION_REPORT.md` | 📖 报告 | 全面扫描报告 |
| `SYNC_MODE_QUICK_REFERENCE.md` | 📖 参考 | 本文档 |
| `scripts/test_rpc_v2_sync_mode.py` | 🧪 测试 | 性能验证脚本 |

---

## 常见问题

### Q1: 默认是同步还是异步？
**A**: 默认 `sync=False`（异步），向后兼容现有代码。

### Q2: 可以运行时切换吗？
**A**: 当前不支持。需要重新注册路由（未来可扩展）。

### Q3: 同步路由会阻塞服务器吗？
**A**: 不会。FastAPI 使用 `await` 等待处理完成，不阻塞事件循环。

### Q4: 如何查看路由配置？
```python
stats = server.routes_manager.get_route_stats()
print(stats)  # {'total': 5, 'sync_routes': 2, 'async_routes': 3}
```

---

## 下一步

1. **测试**: `python scripts/test_rpc_v2_sync_mode.py`
2. **集成**: MCP Backend 标记 `backend_info` 为同步
3. **验证**: Cursor 环境端到端测试

---

**快速参考结束** | **版本**: 1.0 | **日期**: 2025-11-19
