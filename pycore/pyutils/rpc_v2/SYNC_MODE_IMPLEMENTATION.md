# RPC v2 同步调用支持方案

**创建时间**: 2025-11-19
**问题**: 所有 RPC 响应都添加 `requires_ack: true`，导致客户端必须等待 ACK 超时（1.5秒+重试），即使处理器立即返回结果。

---

## 1. 问题分析

### 1.1 当前流程
```
客户端请求 → 后端接收
             ↓
   后端立即返回 {"requires_ack": true, "status": "accepted"}
             ↓
   客户端等待 1.5秒 (await asyncio.sleep(1.5))
             ↓
   客户端重试查询 (最多3次，每次0.5秒)
             ↓
   总耗时: ~3秒 ❌
```

### 1.2 关键代码位置
- `fastapi_server.py:333` - 所有 HTTP 响应调用 `prepare_http_response_with_ack()`
- `ack_manager.py:329` - 强制添加 `data['requires_ack'] = True`
- `request_processor.py:41` - 支持同步/异步 handler，但结果总是异步返回

### 1.3 核心矛盾
- **Handler 支持同步**: `request_processor.py:44` 可以直接调用同步函数
- **响应总是异步**: `prepare_http_response_with_ack()` 强制所有响应使用 ACK 机制
- **客户端必须等待**: MCP 代理端使用 `await asyncio.sleep(1.5)` 等待结果

---

## 2. 解决方案

### 方案 A：路由级别同步标记 ⭐ 推荐

**原理**: 在路由注册时标记是否为同步调用，对同步路由跳过 ACK 机制。

#### 2.1 API 设计
```python
# 同步路由（立即返回，无 requires_ack）
server.route('backend_info', handle_backend_info, sync=True)

# 异步路由（使用 ACK 机制）
server.route('get_file_info', handle_get_file_info)  # sync=False (default)
```

#### 2.2 实现步骤

**Step 1: 修改 RoutesManager**
```python
# pycore/pyutils/rpc_v2/server/routes_manager.py

class RoutesManager:
    def __init__(self, debug: bool = True):
        self.routes: Dict[str, Callable] = {}
        self.route_config: Dict[str, Dict[str, Any]] = {}  # ✅ 新增：路由配置
        self.debug = debug

    def register_route(self, name: str, handler: Callable, sync: bool = False):
        """
        注册 RPC 路由

        Args:
            name: 路由名称
            handler: 处理函数（可以是同步或异步）
            sync: 是否为同步路由（立即返回结果，无需 ACK 机制）
        """
        self.routes[name] = handler
        self.route_config[name] = {
            "sync": sync,
            "is_coroutine": asyncio.iscoroutinefunction(handler)
        }

    def is_sync_route(self, name: str) -> bool:
        """检查路由是否为同步路由"""
        return self.route_config.get(name, {}).get("sync", False)
```

**Step 2: 修改 FastAPIRPCServer**
```python
# pycore/pyutils/rpc_v2/server/fastapi_server.py

def route(self, name: str, handler: Callable, sync: bool = False):
    """
    注册 RPC 路由

    Args:
        name: 路由名称
        handler: 处理函数
        sync: 是否为同步路由（立即返回，无需 ACK）
    """
    self.routes_manager.register_route(name, handler, sync=sync)

async def _handle_http_rpc(self, request: Request, route_override: Optional[str] = None):
    # ... (前面代码不变)

    # ✅ 检查是否为同步路由
    is_sync = self.routes_manager.is_sync_route(route)

    if is_sync:
        # 同步路由：等待处理完成后立即返回
        event = self.request_event_table.create_event(...)

        # 立即处理（await 完成）
        await self.request_processor.process_request_async(
            request_id=request_id,
            route=route,
            params=params,
            client_id=session_id,
            client_type="http",
            context=RPCRequestContext(...).__dict__,
            notify_callback=None  # 同步路由不需要回调
        )

        # 获取结果
        event = self.request_event_table.get_event(request_id)
        if event.status == RequestStatus.COMPLETED:
            # ✅ 直接返回结果，无 requires_ack
            return JSONResponse(
                {
                    "type": MSG_TYPES["RESPONSE"],
                    "route": route,
                    "id": request_id,
                    "result": event.result,
                    "error": event.error,
                    "success": event.error is None,
                    "sync_response": True,  # ✅ 标记为同步响应
                    "queue": None,
                },
                status_code=status.HTTP_200_OK,
            )
    else:
        # 异步路由：使用 ACK 机制（原有逻辑）
        asyncio.create_task(
            self.request_processor.process_request_async(...)
        )

        return self.ack_manager.prepare_http_response_with_ack(
            request_id=request_id,
            data={
                "type": MSG_TYPES["RESPONSE"],
                "route": route,
                "id": request_id,
                "status": "accepted",
                "message": "Request accepted, please query result after 1 second",
                "queue": None,
            },
            status_code=status.HTTP_200_OK,
            event=event,
        )
```

#### 2.3 使用示例

**后端注册路由**
```python
# pycore/pyctl/mcpctl/mcp_backend.py

# 同步路由（立即返回）
instances.rpc_server.route('backend_info', handle_backend_info, sync=True)

# 异步路由（ACK 机制）
instances.rpc_server.route('get_file_info', handle_get_file_info)  # sync=False
```

**客户端处理**
```python
# pyapps/mcp/mcp_main.py

async def call_backend_tool(tool_name: str, **kwargs) -> Dict[str, Any]:
    try:
        response = requests.post(f"{BACKEND_URL}/rpc/{tool_name}", json=kwargs, timeout=30)
        result = response.json()

        # ✅ 检查是否为同步响应
        if result.get("sync_response"):
            # 同步响应：直接返回结果
            return result

        # 异步响应：使用 ACK 机制（原有逻辑）
        if result.get("requires_ack"):
            request_id = result.get("id")
            await asyncio.sleep(1.5)
            # ... (重试逻辑)
```

---

### 方案 B：执行时间检测（备选）

**原理**: 监控 handler 执行时间，如果 < 100ms，直接返回结果。

```python
async def _handle_http_rpc(self, request: Request, route_override: Optional[str] = None):
    # ... (前面代码不变)

    event = self.request_event_table.create_event(...)

    # ✅ 监控执行时间
    start_time = time.time()

    await self.request_processor.process_request_async(...)

    execution_time = time.time() - start_time

    # ✅ 快速响应直接返回
    if execution_time < 0.1:  # 100ms
        event = self.request_event_table.get_event(request_id)
        if event.status == RequestStatus.COMPLETED:
            return JSONResponse({
                "type": MSG_TYPES["RESPONSE"],
                "id": request_id,
                "result": event.result,
                "error": event.error,
                "success": event.error is None,
                "fast_response": True,
            })
```

**缺点**:
- 需要等待执行完成才能判断
- 无法提前告知客户端是否为同步调用

---

## 3. 优势对比

| 特性 | 方案 A（路由标记） | 方案 B（时间检测） |
|------|-------------------|-------------------|
| **性能** | ⭐⭐⭐⭐⭐ 零等待 | ⭐⭐⭐ 仍需执行完成 |
| **明确性** | ⭐⭐⭐⭐⭐ 注册时明确 | ⭐⭐ 运行时判断 |
| **兼容性** | ⭐⭐⭐⭐⭐ 向后兼容 | ⭐⭐⭐⭐⭐ 向后兼容 |
| **实现复杂度** | ⭐⭐⭐ 中等 | ⭐⭐ 简单 |

**推荐**: 方案 A（路由标记）

---

## 4. 实施计划

### Phase 1: 核心实现
1. ✅ 修改 `RoutesManager.register_route()` 添加 `sync` 参数
2. ✅ 修改 `FastAPIRPCServer._handle_http_rpc()` 支持同步路由
3. ✅ 添加 `sync_response` 标志到响应

### Phase 2: 后端集成
1. ✅ `mcp_backend.py` 使用 `sync=True` 注册 `backend_info`
2. ✅ 保持 `get_file_info` 使用异步模式

### Phase 3: 客户端适配
1. ✅ `mcp_main.py` 检测 `sync_response` 标志
2. ✅ 同步响应跳过 await 等待

### Phase 4: 测试验证
1. ✅ 测试同步路由响应时间 (< 100ms)
2. ✅ 测试异步路由仍使用 ACK 机制
3. ✅ 验证 MCP 工具在 Cursor 中正常工作

---

## 5. 兼容性保证

### 5.1 向后兼容
- 默认 `sync=False`，所有现有路由保持异步行为
- 不影响现有客户端（同步响应也包含完整字段）

### 5.2 渐进式迁移
```python
# 阶段1：仅标记关键同步路由
server.route('backend_info', handler, sync=True)
server.route('ping', handler, sync=True)

# 阶段2：根据实际情况标记更多路由
server.route('get_config', handler, sync=True)

# 保持：耗时操作仍使用异步
server.route('get_file_info', handler)  # sync=False
```

---

## 6. 性能提升

### 6.1 响应时间对比
```
同步路由（sync=True）：
  客户端请求 → 后端处理 → 直接返回
  总耗时: < 100ms ✅

异步路由（sync=False）：
  客户端请求 → 后端接收 → 返回 "accepted"
               ↓
  客户端等待 1.5秒 → 重试查询 (3次 × 0.5秒)
  总耗时: ~3秒 ❌
```

### 6.2 MCP 工具响应
- **之前**: `backend_info` 和 `get_file_info` 都需要 3秒
- **之后**: `backend_info` < 100ms，`get_file_info` 仍需 3秒（正常）

---

## 7. 后续优化

### 7.1 WebSocket 同步支持
```python
# WebSocket 也支持同步路由
async def _handle_websocket_request(self, client_id: str, message: Dict):
    route = message.get("route")

    if self.routes_manager.is_sync_route(route):
        # 同步路由：立即处理并返回
        await self.request_processor.process_request_async(...)
        event = self.request_event_table.get_event(request_id)

        # 直接发送结果（无 ACK）
        await self.client_registry.safe_send(client_id, {
            "type": MSG_TYPES["RESPONSE"],
            "id": request_id,
            "result": event.result,
            "error": event.error,
            "success": event.error is None,
            "sync_response": True,
        })
```

### 7.2 自动检测建议
```python
# 未来：基于历史数据自动建议同步路由
def analyze_route_performance(route: str) -> bool:
    """分析路由历史执行时间，建议是否标记为同步"""
    stats = get_route_stats(route)
    avg_time = stats["avg_execution_time"]
    p95_time = stats["p95_execution_time"]

    # 95% 的请求在 100ms 内完成 → 建议标记为同步
    return p95_time < 0.1
```

---

**结论**: 方案 A（路由级别同步标记）提供最佳性能和明确性，推荐立即实施。
