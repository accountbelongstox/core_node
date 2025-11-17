# RPC Protocol Specification

---

**Important Notice**: This is the authoritative specification for the RPC communication stack. All frontend and backend developers must follow it strictly. Any protocol change must update this document and be communicated to every impacted engineer.

1. The web client generates a request ID, persists it (both the ID and pending metadata) to `localStorage`, and reloads it on refresh.
2. Each outbound request registers a callback inside the client-side event registry; when the server responds the callback is resolved by matching the request ID.
3. Both client and server keep request metadata keyed by the same ID (client resumes pending metadata after reload, server stores it in the event/inventory tables) so delayed responses still resolve their callbacks.
4. HTTP requests follow the same flow but must start polling `query/{request_id}` one second after submission.
---
4. The server always stores the request in the event table before dispatching the controller. WebSocket notifications retry every 3 seconds (maximum 3 attempts); if all retries fail the result is written to the inventory table.
5. Both WebSocket and HTTP handlers check the inventory table first, so historical results can be replayed immediately.
6. Client connections live inside a global registry. Entries are only purged on timeout or when the global `max=10000000` limit is exceeded.
7. Client and server must share the same string↔JSON helpers and respect the protocol fields to prevent non-JSON WebSocket payloads.
8. Two client classes are provided (WebSocket and HTTP). HTTP relies on polling to obtain final results.
9. The server exposes a standard route-registration API so sub-apps can extend controllers. Clients may supply port and configuration parameters, up to the same `max=10000000` limit enforced by the library.
---
1. Both HTTP and WebSocket stacks maintain a heartbeat loop that checks availability and fetches pending events.
2. If there are pending request IDs the heartbeat interval must accelerate; otherwise it defaults to every 5 seconds.
3. Server and client both expose baseline routes (health, queue stats, etc.) that are always available without extra configuration.
4. The frontend can extend routes by providing a route name and callback; the library automatically invokes the callback as soon as the heartbeat detects a server response.
5. Backend routes must follow the standard shape: controller results are attached to the protocol payload rather than replacing it. After sending an event the server waits for ACK before marking it as complete, and HTTP responses rely on status codes (e.g., 200) for acknowledgement. The notification pipeline for both HTTP and WebSocket must avoid blocking `await` loops. These requirements are part of the development guide and enforced by the refactored codebase.

---

## 一、架构分析与合规检查

### ✓ Current implementation passes all compliance checks

1. **Frontend callback registry & persistence** ✓  
   - `unified_rpc_client.js` stores pending metadata in `localStorage` (`pendingMetadata` + `_restorePendingMetadata`) so callbacks survive refreshes.

2. **Server-side event persistence** ✓  
   - `request_event_table.py` tracks request lifecycle and `fastapi_server.py` writes each request before invoking a controller.

3. **Inventory replay** ✓  
   - `inventory_table.py`, `fastapi_server.py`, and `ack_manager.py` move failed pushes to inventory and deliver them on reconnect.

4. **ACK + non-blocking retries** ✓  
   - `FastAPIAckManager` uses `loop.call_later` for the 3-second/3-attempt retry loop; HTTP ACK uses status 200, and WebSocket clients rely solely on push notifications without client-side timeout guards.

5. **HTTP polling (no client-side timeout)** ✓  
   - `http_rpc_client.js` automatically polls `/rpc/query/{id}` after the initial POST (configurable interval) and never aborts long-running tasks via client timeouts.

6. **Client registry & heartbeat** ✓  
   - `client_registry.py` manages active sessions; `unified_rpc_client.js` uses adaptive heartbeat intervals.

7. **Unified JSON protocol** ✓  
   - Shared `encodeJSON/decodeJSON` helpers ensure consistent framing; payload fields `{type,id,result,error,success,requires_ack}` remain unchanged.

8. **Route extensibility** ✓  
   - Server exposes `FastAPIRPCServer.route()`, and clients can register `onEvent/offEvent` callbacks that the heartbeat/ping loop activates.

9. **Client & event IDs mirrored** ✓  
   - Client IDs persist in `localStorage`, and each request ID is stored on both sides (event table + pending metadata) so results always resolve the correct callback.

---

## 二、通信协议规范

### 2.1 消息类型定义

```javascript
const MSG_TYPES = {
    REQUEST: 'request',      // 客户端 -> 服务端
    RESPONSE: 'response',    // 服务端 -> 客户端
    EVENT: 'event',          // 服务端 -> 客户端 (推送)
    WELCOME: 'welcome',      // 服务端 -> 客户端 (连接确认)
    ERROR: 'error',          // 服务端 -> 客户端 (错误)
    PING: 'ping',            // 心跳请求
    PONG: 'pong',            // 心跳响应
    ACK: 'ack'               // 确认接收
};
```

### 2.2 请求消息格式 (Request)

```json
{
    "type": "request",
    "id": "uuid-request-id",      // 请求唯一ID (必须)
    "route": "controller_name",    // 路由名称 (必须)
    "params": {                    // 参数 (可选)
        "key": "value"
    }
}
```

### 2.3 响应消息格式 (Response)

```json
{
    "type": "response",
    "id": "uuid-request-id",       // 对应请求ID (必须)
    "success": true,               // 是否成功 (必须)
    "result": {                    // Controller返回数据 (成功时)
        "data": "value"
    },
    "error": null,                 // 错误信息 (失败时)
    "requires_ack": true           // 是否需要ACK确认 (必须)
}
```

### 2.4 ACK确认消息格式

```json
{
    "type": "ack",
    "id": "uuid-request-id"        // 确认的请求ID
}
```

### 2.5 HTTP异步响应格式

**阶段1: 接受请求**
```json
{
    "id": "uuid-request-id",
    "status": "accepted",
    "message": "Request accepted, please query result after 1 second",
    "requires_ack": true
}
```

**阶段2: 轮询结果**
```json
{
    "id": "uuid-request-id",
    "status": "completed",         // "pending", "processing", "completed", "failed"
    "result": {...},               // Controller返回数据
    "error": null,
    "success": true,
    "requires_ack": true
}
```

> 说明：每一次轮询都返回该对象或 `queue` 列表条目（同样包含 `id/status/result/...`），所以即便任务仍在排队，客户端也会拿到包含 `request_id` 的标准结构（`result` 可为 `null`）。这确保 HTTP 轮询与 WebSocket push 使用一致的事件表示方法。

### 2.6 WebSocket事件推送格式 (Server Event Payload)

所有服务端主动推送的事件（如 `request_accepted`、业务事件等）必须使用统一结构，前端只需依据 `type` 判定推送类型：

```json
{
    "type": "event",
    "route": "request_accepted",    // 规范的事件/路由名称（必填）
    "event": "request_accepted",    // 兼容字段（可选，同 route）
    "id": "uuid-request-id",        // 关联请求ID（如有）
    "data": { ... }                 // 业务负载
}
```

客户端实现（`unified_rpc_client.js`）会优先读取 `route`，找不到再回退到 `event`，从而确保前后端在同一对象类型上保持一致。

---

## 三、开发规范

### 3.1 前端开发规范

#### 3.1.1 客户端ID管理

```javascript
// 必须使用localStorage持久化
class UnifiedRpcClient {
    constructor(baseUrl, options = {}) {
        // 从localStorage恢复或生成新ID
        const storedId = localStorage.getItem('rpc_client_id');
        this.clientId = options.clientId || storedId || generateUUID();

        // 保存到localStorage
        localStorage.setItem('rpc_client_id', this.clientId);
    }
}
```

#### 3.1.2 请求回调存储

```javascript
// 请求发送时
async call(route, params) {
    const requestId = generateUUID();

    // 存入事件库
    this.pendingRequests.set(requestId, { resolve, reject, timeout });

    // 可选: 持久化到localStorage (支持刷新恢复)
    this._savePendingRequests();

    // 发送请求
    this.ws.send(JSON.stringify({
        type: 'request',
        id: requestId,
        route: route,
        params: params
    }));
}

// 收到响应时
_handleResponse(message) {
    const pending = this.pendingRequests.get(message.id);
    if (pending) {
        pending.resolve(message.result);
        this.pendingRequests.delete(message.id);

        // 发送ACK确认
        if (message.requires_ack) {
            this._sendAck(message.id);
        }
    }
}
```

#### 3.1.3 HTTP轮询机制

```javascript
_callHttp(requestId, route, params, resolve, reject) {
    fetch(url, { method: 'POST', body: JSON.stringify(data) })
        .then(response => response.json())
        .then(data => {
            // 检查是否为异步响应
            if (data.status === 'accepted' && data.id) {
                // 自动开始轮询
                this._pollForResult(data.id, resolve, reject);
            } else {
                resolve(data.result);
            }
        });
}

_pollForResult(requestId, resolve, reject) {
    const pollInterval = 1000; // 1秒间隔

    const poll = () => {
        fetch(`/rpc/query/${requestId}`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'completed') {
                    resolve(data.result);
                } else if (data.status === 'processing') {
                    setTimeout(poll, pollInterval);
                } else {
                    reject(new Error(data.error));
                }
            });
    };

    // 1秒后开始轮询
    setTimeout(poll, pollInterval);
}
```

### 3.2 后端开发规范

#### 3.2.1 禁止阻塞await

```python
# ✗ 错误: 使用await阻塞
async def notify_with_retry(self, client_id, request_id, result):
    for attempt in range(3):
        await asyncio.sleep(3)  # 阻塞!
        # 发送...

# ✓ 正确: 使用非阻塞定时器
def notify_with_retry(self, client_id, request_id, result):
    def schedule_retry(attempt):
        if attempt >= 3:
            self.inventory_table.store(request_id, result)
            return

        # 非阻塞: 创建任务
        asyncio.create_task(self._send_notification(
            client_id, request_id, result,
            on_fail=lambda: asyncio.get_event_loop().call_later(
                3.0, lambda: schedule_retry(attempt + 1)
            )
        ))

    schedule_retry(0)
```

#### 3.2.2 事件表操作流程

```python
# 1. 收到请求 -> 存入事件表
event = self.request_event_table.create_event(
    request_id=request_id,
    route=route,
    params=params,
    client_id=client_id
)

# 2. 调用Controller
result = await self.routes[route](params, request_id, context)

# 3. 存储结果
self.request_event_table.set_result(request_id, result)

# 4. 通知客户端 (基于请求ID)
if client_type == 'websocket':
    self.ack_manager.notify_websocket_with_retry(client_id, request_id, result)
else:
    # HTTP: 等待轮询
    pass
```

#### 3.2.3 库存表检查

```python
# WebSocket连接时检查库存
async def handle_websocket_connect(self, client_id):
    # 检查是否有待发送的结果
    inventory_items = self.inventory_table.get_by_client(client_id)

    for item in inventory_items:
        await self.ws.send_json({
            'type': 'response',
            'id': item.request_id,
            'result': item.result,
            'error': item.error,
            'success': item.error is None,
            'requires_ack': True
        })
        # 等待ACK后删除
```

#### 3.2.4 Controller规范

```python
def my_controller(params: Dict, request_id: str, context: Dict) -> Any:
    """
    Controller只返回数据，不处理协议

    Args:
        params: 请求参数
        request_id: 请求ID (用于事件表查找)
        context: 上下文 (ws, client_id等)

    Returns:
        任意数据 (会被附到response.result字段)
    """
    # 处理业务逻辑
    data = process_business_logic(params)

    # 直接返回数据，协议由框架统一处理
    return {
        'key': 'value',
        'data': data
    }
```

### 3.3 ACK机制规范

#### 3.3.1 WebSocket ACK

```javascript
// 客户端收到响应后发送ACK
ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'response' && msg.requires_ack) {
        // 处理响应
        this._handleResponse(msg);

        // 发送ACK确认
        this.ws.send(JSON.stringify({
            type: 'ack',
            id: msg.id
        }));
    }
};
```

```python
# 服务端收到ACK后标记
def handle_ack(self, client_id: str, request_id: str):
    event = self.request_event_table.get_event(request_id)
    if event and event.status == RequestStatus.ACK_PENDING:
        # 标记为已确认
        self.request_event_table.update_status(request_id, RequestStatus.ACK_RECEIVED)
        self.request_event_table.mark_notified(request_id)
```

#### 3.3.2 HTTP ACK

```python
# HTTP状态码200 = ACK确认
def prepare_http_response(self, request_id, data):
    # 返回200状态码 = 客户端确认接收
    response = web.json_response(data, status=200)

    # 标记ACK状态
    self.request_event_table.update_status(request_id, RequestStatus.ACK_PENDING)

    # 非阻塞检查
    asyncio.create_task(self._check_http_ack_timeout(request_id))

    return response
```

---

## 四、重构要点

### 4.1 前端修复清单

1. [ ] **clientId localStorage持久化**
   - 文件: `unified_rpc_client.js`
   - 构造函数中从localStorage恢复
   - 连接时保存到localStorage

2. [ ] **HTTP自动轮询**
   - 文件: `unified_rpc_client.js`
   - `_callHttp` 检测accepted响应
   - 自动开启1秒间隔轮询

3. [ ] **ACK发送机制**
   - 文件: `unified_rpc_client.js`
   - 收到requires_ack响应后发送ACK

### 4.2 后端修复清单

1. [ ] **非阻塞重试机制**
   - 文件: `ack_manager.py`
   - 替换await sleep为call_later
   - 使用事件表状态跟踪而非阻塞

2. [ ] **WebSocket路由修复**
   - 文件: `unified_server.py`
   - 检查路由注册顺序
   - 确保WebSocket路由正确

3. [ ] **客户端清理配置**
   - 文件: `client_manager.py`
   - 添加MAX_CLIENTS配置
   - 添加CLIENT_TIMEOUT配置

### 4.3 协议一致性检查

1. [ ] 所有响应必须包含 `requires_ack` 字段
2. [ ] Controller返回数据必须附到 `result` 字段
3. [ ] 错误响应必须包含 `error` 字段
4. [ ] 请求ID必须在整个生命周期保持一致
