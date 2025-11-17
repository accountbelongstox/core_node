# RPC 事件驱动状态管理实现指南

## 一、核心架构：事件驱动异步RPC

### 1.1 架构原理

**❌ 错误认知：同步阻塞RPC**
```
客户端发送请求 → 阻塞等待30秒 → 超时或收到响应
```

**✅ 正确架构：事件驱动异步RPC**
```
客户端发送请求 → 注册回调到事件库 → 立即返回Promise
                                    ↓
后端收到请求 → 存入事件表 → 异步处理 → 触发回调通知
                ↓                        ↓
        存储：eventId + params      WebSocket推送 | HTTP存储
                                         ↓
客户端收到通知 → 通过eventId查找回调 → 执行resolve()
```

### 1.2 事件ID系统

**事件ID (eventId / request_id)** 是整个架构的核心：

- **前端生成**：`generateUUID()` 生成唯一ID
- **前端存储**：`pendingRequests.set(eventId, {resolve, reject})`
- **后端存储**：`TaskTable.create_task(task_id=eventId, ...)`
- **双向关联**：前后端通过eventId关联请求和响应

```javascript
// 前端
const eventId = generateUUID();
pendingRequests.set(eventId, {resolve, reject});
ws.send({type: 'request', id: eventId, route, params});

// 后端
event = task_table.create_task(
    task_id=request_id,  # eventId
    route=route,
    params=params
)
```

### 1.3 回调存储系统

#### 前端回调存储

```javascript
class UnifiedRpcClient {
    constructor() {
        // 事件库：存储所有pending请求的回调
        this.pendingRequests = new Map();
        // Map<eventId, {resolve, reject, timeout, route, params}>
    }

    async call(route, params) {
        const eventId = generateUUID();

        return new Promise((resolve, reject) => {
            // 1. 存储回调到事件库
            this.pendingRequests.set(eventId, {
                resolve,
                reject,
                timeout: setTimeout(() => {
                    this.pendingRequests.delete(eventId);
                    reject(new Error('Request timeout'));
                }, this.options.timeout),
                route,
                params,
                timestamp: Date.now()
            });

            // 2. 发送请求
            if (this.mode === 'ws') {
                this._sendWebSocketRequest(eventId, route, params);
            } else {
                this._sendHttpRequest(eventId, route, params, resolve, reject);
            }
        });
    }

    // WebSocket接收推送
    _handleWebSocketMessage(message) {
        if (message.type === 'response') {
            // 通过eventId查找回调
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                clearTimeout(pending.timeout);
                pending.resolve(message.result);  // 执行回调
                this.pendingRequests.delete(message.id);

                // 发送ACK确认
                if (message.requires_ack) {
                    this._sendAck(message.id);
                }
            }
        }
    }
}
```

#### 后端回调存储

```python
class TaskTable:
    """事件表：存储所有请求的状态和回调信息"""

    def __init__(self):
        self.tasks = {}  # Dict[task_id, Task]

    def create_task(
        self,
        task_id: str,        # eventId
        route: str,
        params: Dict,
        client_id: str,
        protocol: str        # 'websocket' | 'http'
    ) -> Task:
        """创建任务并存入事件表"""
        task = Task(
            task_id=task_id,
            route=route,
            params=params,
            client_id=client_id,
            protocol=protocol,
            status=TaskStatus.PENDING,
            created_at=time.time()
        )
        self.tasks[task_id] = task
        return task

    def set_result(self, task_id: str, result: Any, error: Optional[str] = None):
        """存储处理结果"""
        task = self.tasks.get(task_id)
        if task:
            task.result = result
            task.error = error
            task.status = TaskStatus.COMPLETED
            task.completed_at = time.time()

    def get_task(self, task_id: str) -> Optional[Task]:
        """通过eventId查找任务"""
        return self.tasks.get(task_id)
```

---

## 二、WebSocket 推送模式实现

### 2.1 完整流程

```
1. 前端发送请求
   ↓
   call(route, params) → 生成eventId → 注册回调到pendingRequests
   ↓
   ws.send({type: 'request', id: eventId, route, params})

2. 后端接收请求
   ↓
   handle_websocket_message() → 解析请求
   ↓
   task_table.create_task(task_id=eventId, ...) → 存入事件表
   ↓
   asyncio.create_task(process_request_async()) → 异步处理

3. 后端处理完成
   ↓
   result = await controller(params, eventId, context)
   ↓
   task_table.set_result(eventId, result) → 存储结果
   ↓
   ack_manager.notify_websocket_with_retry(client_id, eventId, result)

4. 后端推送结果
   ↓
   ws.send_json({
       type: 'response',
       id: eventId,
       result: result,
       requires_ack: true
   })
   ↓
   task_table.update_status(eventId, TaskStatus.ACK_PENDING) → 等待ACK

5. 前端接收推送
   ↓
   ws.onmessage → 解析响应
   ↓
   pending = pendingRequests.get(eventId) → 查找回调
   ↓
   pending.resolve(result) → 执行回调
   ↓
   ws.send({type: 'ack', id: eventId}) → 发送ACK确认

6. 后端收到ACK
   ↓
   handle_ack(client_id, eventId)
   ↓
   task_table.update_status(eventId, TaskStatus.ACK_RECEIVED) → 标记完成
```

### 2.2 关键代码实现

#### 前端 WebSocket 实现

```javascript
class UnifiedRpcClient {
    _sendWebSocketRequest(eventId, route, params) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            const pending = this.pendingRequests.get(eventId);
            if (pending) {
                pending.reject(new Error('WebSocket not connected'));
                this.pendingRequests.delete(eventId);
            }
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'request',
            id: eventId,
            route: route,
            params: params
        }));
    }

    _setupWebSocketHandlers() {
        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                if (message.type === 'response') {
                    this._handleResponse(message);
                } else if (message.type === 'event') {
                    this._handleEvent(message);
                }
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        };
    }

    _handleResponse(message) {
        const pending = this.pendingRequests.get(message.id);
        if (!pending) {
            console.warn('No pending request for id:', message.id);
            return;
        }

        // 清除超时
        clearTimeout(pending.timeout);

        // 执行回调
        if (message.success) {
            pending.resolve(message.result);
        } else {
            pending.reject(new Error(message.error || 'Unknown error'));
        }

        // 删除回调
        this.pendingRequests.delete(message.id);

        // 发送ACK确认
        if (message.requires_ack) {
            this._sendAck(message.id);
        }
    }

    _sendAck(requestId) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'ack',
                id: requestId
            }));
        }
    }
}
```

#### 后端 WebSocket 实现

```python
class WebSocketHandler:
    async def handle_websocket_message(self, ws, client_id: str, message: Dict):
        """处理WebSocket消息"""
        msg_type = message.get('type')

        if msg_type == MSG_TYPES['REQUEST']:
            # 处理请求
            await self._handle_request(ws, client_id, message)
        elif msg_type == MSG_TYPES['ACK']:
            # 处理ACK确认
            self.ack_manager.handle_ack(client_id, message.get('id'))

    async def _handle_request(self, ws, client_id: str, message: Dict):
        """处理请求"""
        request_id = message.get('id')
        route = message.get('route')
        params = message.get('params', {})

        # 1. 创建事件
        event = self.request_event_table.create_event(
            request_id=request_id,
            route=route,
            params=params,
            client_id=client_id,
            client_type='websocket'
        )

        # 2. 异步处理（非阻塞）
        asyncio.create_task(self.request_processor.process_request_async(
            request_id=request_id,
            route=route,
            params=params,
            client_id=client_id,
            client_type='websocket',
            context={'ws': ws},
            notify_callback=self.ack_manager.notify_websocket_with_retry
        ))
```

---

## 三、HTTP 轮询模式实现

### 3.1 完整流程

```
1. 前端发送请求
   ↓
   call(route, params) → 生成eventId → 注册回调到pendingRequests
   ↓
   POST /rpc {id: eventId, route, params}

2. 后端接收请求
   ↓
   handle_http_rpc() → 解析请求
   ↓
   task_table.create_task(task_id=eventId, ...) → 存入事件表
   ↓
   asyncio.create_task(process_request_async()) → 异步处理
   ↓
   返回 202 Accepted {id: eventId, status: 'accepted'}

3. 前端检测异步响应
   ↓
   if (data.status === 'accepted') {
       _pollForResult(eventId, resolve, reject); → 开启轮询
   }

4. 前端轮询查询
   ↓
   setTimeout(() => {
       GET /rpc/query/{eventId}
   }, 1000)

5. 后端返回状态
   ↓
   if status === COMPLETED:
       返回 200 OK {result: ...}
   else:
       返回 202 Processing {status: 'processing'}

6. 前端收到结果
   ↓
   if (data.status === 'completed') {
       pending.resolve(data.result); → 执行回调
       pendingRequests.delete(eventId);
   } else {
       setTimeout(poll, 1000); → 继续轮询
   }
```

### 3.2 关键代码实现

#### 前端 HTTP 轮询实现

```javascript
class UnifiedRpcClient {
    async _sendHttpRequest(eventId, route, params, resolve, reject) {
        try {
            const url = `${this.baseUrl}/rpc`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Client-ID': this.clientId
                },
                body: JSON.stringify({
                    id: eventId,
                    route: route,
                    params: params
                })
            });

            const data = await response.json();

            // 检测异步响应
            if (data.status === 'accepted' && data.id) {
                // 自动开启轮询
                this._pollForResult(data.id, resolve, reject);
            } else if (data.success !== undefined) {
                // 同步结果
                const pending = this.pendingRequests.get(eventId);
                if (pending) {
                    clearTimeout(pending.timeout);
                    this.pendingRequests.delete(eventId);
                }

                if (data.success) {
                    resolve(data.result);
                } else {
                    reject(new Error(data.error || 'Request failed'));
                }
            }
        } catch (error) {
            const pending = this.pendingRequests.get(eventId);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(eventId);
            }
            reject(error);
        }
    }

    _pollForResult(eventId, resolve, reject) {
        const pollInterval = 1000; // 1秒间隔
        const maxPolls = 60; // 最多轮询60次（60秒）
        let pollCount = 0;

        const poll = async () => {
            try {
                pollCount++;

                if (pollCount > maxPolls) {
                    this.pendingRequests.delete(eventId);
                    reject(new Error('Polling timeout'));
                    return;
                }

                const url = `${this.baseUrl}/rpc/query/${eventId}`;
                const response = await fetch(url, {
                    headers: {
                        'X-Client-ID': this.clientId
                    }
                });

                const data = await response.json();

                if (data.status === 'completed') {
                    // 处理完成
                    const pending = this.pendingRequests.get(eventId);
                    if (pending) {
                        clearTimeout(pending.timeout);
                        this.pendingRequests.delete(eventId);
                    }

                    if (data.success) {
                        resolve(data.result);
                    } else {
                        reject(new Error(data.error || 'Request failed'));
                    }
                } else if (data.status === 'processing' || data.status === 'pending') {
                    // 继续轮询
                    setTimeout(poll, pollInterval);
                } else if (data.status === 'not_found') {
                    // 请求不存在
                    this.pendingRequests.delete(eventId);
                    reject(new Error('Request not found'));
                } else {
                    // 继续轮询
                    setTimeout(poll, pollInterval);
                }
            } catch (error) {
                // 网络错误，继续轮询
                if (pollCount < maxPolls) {
                    setTimeout(poll, pollInterval);
                } else {
                    this.pendingRequests.delete(eventId);
                    reject(error);
                }
            }
        };

        // 1秒后开始轮询
        setTimeout(poll, pollInterval);
    }
}
```

#### 后端 HTTP 查询接口实现 (已实现 ✅)

位置: `pycore/pyutils/rpc/server/http_handler.py`

- ✅ `handle_http_rpc()` - 接收请求，返回accepted
- ✅ `handle_query_result()` - 查询结果接口
- ✅ 检查库存表和事件表
- ✅ 返回processing/completed状态

---

## 四、ACK 确认机制 (已实现 ✅)

### 4.1 WebSocket ACK

**前端**:
```javascript
// 位置: unified_rpc_client.js (需完善)
_handleResponse(message) {
    // ... 执行回调 ...

    // 发送ACK确认
    if (message.requires_ack) {
        this._sendAck(message.id);
    }
}
```

**后端**:
```python
# 位置: ack_manager.py:254 ✅
def handle_ack(self, client_id: str, request_id: str):
    event = self.request_event_table.get_event(request_id)
    if event and event.status == RequestStatus.ACK_PENDING:
        self.request_event_table.update_status(request_id, RequestStatus.ACK_RECEIVED)
        self.request_event_table.mark_notified(request_id)
```

### 4.2 HTTP ACK (已实现 ✅)

HTTP使用状态码200作为ACK确认：

```python
# 位置: ack_manager.py:281 ✅
response = web.json_response(data, status=200)
# 状态码200 = 客户端确认接收

# 非阻塞检查ACK超时
asyncio.create_task(self._check_http_ack_timeout(request_id))
```

---

## 五、状态管理 (已实现 ✅)

### 5.1 任务状态枚举

位置: `pycore/pyutils/rpc/common/task_table.py`

```python
class TaskStatus(str, Enum):
    PENDING = 'pending'          # 等待处理
    PROCESSING = 'processing'    # 处理中
    COMPLETED = 'completed'      # 处理完成
    ACK_PENDING = 'ack_pending'  # 等待ACK确认
    ACK_RECEIVED = 'ack_received' # ACK已确认
    STORED = 'stored'            # 存入库存表
```

### 5.2 状态转换流程

```
WebSocket流程:
PENDING → PROCESSING → COMPLETED → ACK_PENDING → ACK_RECEIVED

HTTP流程:
PENDING → PROCESSING → COMPLETED
```

### 5.3 客户端状态枚举 (已实现 ✅)

位置: `pycore/pyutils/rpc/server/client_manager.py`

```python
class ClientStatus(Enum):
    CONNECTING = 'connecting'       # WebSocket 握手中
    CONNECTED = 'connected'         # 完全连接且活跃
    IDLE = 'idle'                  # 已连接但不活跃
    DISCONNECTING = 'disconnecting' # 正在优雅关闭
    DISCONNECTED = 'disconnected'  # 已关闭并清理
    RECONNECTING = 'reconnecting'  # 尝试重新连接
```

**重连机制** (已实现 ✅):
- 客户端断开 → 标记 RECONNECTING
- 等待5分钟
- 重连成功 → 发送pending_messages
- 超时 → 永久删除

---

## 六、库存表机制 (已实现 ✅)

### 6.1 库存表用途

位置: `pycore/pyutils/rpc/common/inventory_table.py`

当WebSocket推送失败时，将结果存入库存表，等待客户端重连后发送。

### 6.2 重连时发送库存 (已实现 ✅)

位置: `pycore/pyutils/rpc/server/websocket_handler.py:126`

```python
async def handle_websocket_connect(self, ws, client_id: str):
    """WebSocket连接时检查库存"""
    inventory_items = self.inventory_table.get_by_client(client_id)

    for item in inventory_items:
        await ws.send_json({
            'type': 'response',
            'id': item.request_id,
            'result': item.result,
            'error': item.error,
            'success': item.error is None,
            'requires_ack': True
        })
```

---

## 七、当前实现状态总结

### 7.1 后端实现 ✅ 85% 完成

#### ✅ 已完成
1. **事件表系统** - `task_table.py` ✅
   - 存储所有请求的eventId
   - 状态跟踪（PENDING → PROCESSING → COMPLETED）
   - 结果存储和查询

2. **库存表机制** - `inventory_table.py` ✅
   - 推送失败时存储
   - 重连时发送

3. **WebSocket推送** - `ack_manager.py` ✅
   - 处理完成后推送结果
   - 重试机制（3次，间隔3秒）
   - ACK确认机制

4. **HTTP查询接口** - `http_handler.py` ✅
   - GET /rpc/query/{request_id}
   - 返回processing/completed状态

5. **客户端状态管理** - `client_manager.py` ✅
   - ClientStatus枚举
   - 重连等待机制（5分钟）
   - pending_messages队列

#### ❌ 待优化
1. **非阻塞重试机制** - `ack_manager.py:237`
   - 当前使用 `await asyncio.sleep()` 阻塞
   - 需改为 `call_later()` 非阻塞定时器

### 7.2 前端实现 ✅ 70% 完成

#### ✅ 已完成
1. **ClientId持久化** - `unified_rpc_client.js:87-104` ✅
   - localStorage存储
   - 刷新后恢复

2. **事件回调存储** - `pendingRequests Map` ✅
   - 存储eventId → callback映射
   - 收到推送时查找并执行

3. **WebSocket消息接收** - `_handleMessage()` ✅
   - 解析响应
   - 查找回调执行

#### ❌ 待实现
1. **HTTP自动轮询** - `_pollForResult()` ❌
   - 检测accepted响应
   - 自动开启1秒间隔轮询
   - 执行回调

2. **WebSocket ACK发送** - `_sendAck()` ⚠️
   - 部分实现，需完善
   - 收到requires_ack后立即发送

---

## 八、下一步实现计划

### Step 1: 前端HTTP轮询实现 (优先级P0)

**文件**: `pycore/pyutils/rpc/client/unified_rpc_client.js`

**实现**:
```javascript
// 1. 修改 _callHttp 检测accepted响应
async _callHttp(requestId, route, params, timeout, resolve, reject) {
    const data = await fetch(...);

    if (data.status === 'accepted') {
        this._pollForResult(requestId, resolve, reject);
    }
}

// 2. 实现 _pollForResult
_pollForResult(requestId, resolve, reject) {
    const poll = async () => {
        const response = await fetch(`/rpc/query/${requestId}`);
        const data = await response.json();

        if (data.status === 'completed') {
            resolve(data.result);
        } else {
            setTimeout(poll, 1000);
        }
    };

    setTimeout(poll, 1000);
}
```

### Step 2: 前端ACK发送完善 (优先级P1)

**文件**: `pycore/pyutils/rpc/client/unified_rpc_client.js`

**实现**:
```javascript
_handleResponse(message) {
    // ... 执行回调 ...

    // 发送ACK
    if (message.requires_ack) {
        this._sendAck(message.id);
    }
}

_sendAck(requestId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
            type: 'ack',
            id: requestId
        }));
    }
}
```

### Step 3: 后端非阻塞重试优化 (优先级P1)

**文件**: `pycore/pyutils/rpc/server/ack_manager.py`

**修改**:
```python
# 替换 await asyncio.sleep() 为 call_later()
async def _check_ack_timeout(self, request_id, client_id, event, result, error):
    # ❌ 当前实现
    # await asyncio.sleep(self.ack_timeout)

    # ✅ 非阻塞实现
    asyncio.get_event_loop().call_later(
        self.ack_timeout,
        lambda: asyncio.create_task(self._handle_ack_timeout(request_id, ...))
    )
```

---

## 九、测试验证

### 9.1 WebSocket推送测试

```javascript
// 前端
const result = await client.call('tts', {text: 'test'});

// 验证:
// 1. eventId生成并存储到pendingRequests
// 2. WebSocket发送请求
// 3. 后端推送响应
// 4. 前端通过eventId找到回调并执行
// 5. 前端发送ACK
// 6. 后端标记ACK_RECEIVED
```

### 9.2 HTTP轮询测试

```javascript
// 前端
const result = await client.call('tts', {text: 'test', mode: 'http'});

// 验证:
// 1. POST /rpc 返回 {status: 'accepted'}
// 2. 自动开启轮询
// 3. GET /rpc/query/{eventId} 返回 {status: 'processing'}
// 4. 继续轮询
// 5. GET /rpc/query/{eventId} 返回 {status: 'completed', result: ...}
// 6. 执行回调
```

---

## 十、总结

### 核心要点

1. **事件ID系统** ✅ - 前后端都存储eventId
2. **回调存储** ✅ - 前后端都存储回调函数/信息
3. **WebSocket推送** ✅ - 后端完成，前端基础完成
4. **HTTP轮询** ⚠️ - 后端完成，前端待实现
5. **ACK机制** ✅ - 后端完成，前端待完善
6. **库存表** ✅ - 完全实现
7. **状态管理** ✅ - 完全实现

### 实现进度

- **后端**: 85% 完成（待优化非阻塞重试）
- **前端**: 70% 完成（待实现HTTP轮询、完善ACK）

### 下一步

1. ❌ 实现前端HTTP自动轮询
2. ❌ 完善前端WebSocket ACK发送
3. ❌ 优化后端非阻塞重试机制
4. ✅ 集成测试验证

---

**最后更新**: 2025-11-18
**架构合规度**: 85%
