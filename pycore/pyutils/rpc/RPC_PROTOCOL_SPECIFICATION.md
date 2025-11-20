# RPC Protocol Specification (RPC 通信协议规范)

## 一、架构分析与合规检查

### ✓ 符合规则的实现

1. **前端事件库回调机制** ✓
   - `pendingRequests` Map 存储请求回调
   - 根据请求ID查找并调用回调
   - 位置: `unified_rpc_client.js:104,270`

2. **后端事件表存储** ✓
   - 请求ID存入 `RequestEventTable`
   - 处理完后根据ID查找事件
   - 位置: `request_event_table.py`

3. **库存表机制** ✓
   - 通知失败后存入 `InventoryTable`
   - WebSocket连接时检查库存
   - 位置: `ack_manager.py:107,150`, `websocket_handler.py:126`

4. **ACK确认机制** ✓
   - WebSocket: `requires_ack` 标记 + ACK消息
   - HTTP: 状态码200确认
   - 位置: `ack_manager.py:127,245`

5. **客户端管理** ✓
   - 全局 `ClientManager` 管理客户端
   - 超时清理机制
   - 位置: `client_manager.py`

6. **统一响应格式** ✓
   - 固定协议字段: `{type, id, result, error, success, requires_ack}`
   - Controller返回数据附到 `result` 字段
   - 位置: `ack_manager.py:121-128`

### ✗ 不符合规则的问题

1. **前端客户端ID未持久化** ✗
   - `unified_rpc_client.js` 生成UUID但未存localStorage
   - 刷新后ID丢失，无法恢复会话
   - **需修复**: 添加localStorage存储

2. **HTTP轮询间隔问题** ✗
   - 当前实现: 前端无自动轮询
   - 规则要求: 请求后1秒轮询
   - **需修复**: 添加自动轮询机制

3. **重试机制使用await阻塞** ✗
   - `ack_manager.py:103,147` 使用 `await asyncio.sleep()`
   - 规则要求: 不能使用await阻塞
   - **需修复**: 改为非阻塞定时器

4. **WebSocket连接失败** ✗
   - 路由注册但连接返回404
   - **需修复**: 检查路由顺序和配置

### ⚠ 缺失的功能

1. **前端请求ID持久化** ⚠
   - 应将pending请求ID存localStorage
   - 刷新后恢复等待中的请求

2. **后端客户端超时配置** ⚠
   - 缺少明确的超时时间配置
   - 缺少max连接数限制配置

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

---

## 五、测试验证

### 5.1 前端测试

```javascript
// 测试客户端ID持久化
const client1 = new UnifiedRpcClient('http://localhost:8765');
const id1 = client1.getClientId();
localStorage.getItem('rpc_client_id') === id1; // true

// 刷新后
const client2 = new UnifiedRpcClient('http://localhost:8765');
client2.getClientId() === id1; // true (恢复)
```

### 5.2 后端测试

```python
# 测试重试机制
async def test_retry():
    # 模拟客户端断开
    await server.notify_with_retry('client_id', 'req_id', result)
    # 检查inventory_table
    assert inventory_table.get('req_id') is not None  # 失败后存入库存

# 测试ACK
async def test_ack():
    await server.send_response(client_id, request_id, result)
    # 状态应为ACK_PENDING
    assert event_table.get(request_id).status == RequestStatus.ACK_PENDING

    # 发送ACK
    server.handle_ack(client_id, request_id)
    # 状态应为ACK_RECEIVED
    assert event_table.get(request_id).status == RequestStatus.ACK_RECEIVED
```

---

## 六、版本历史

- **v1.0** (2025-01-17): 初始协议规范
  - 定义消息类型和格式
  - 建立ACK机制
  - 制定开发规范
  - 识别并记录不符合项

---

**重要提示**: 本规范是RPC通信的核心文档，所有前后端开发必须严格遵守。任何协议变更必须更新此文档并通知相关开发人员。
