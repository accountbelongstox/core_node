# 统一消息类型规范 - UNIFIED MESSAGE TYPES

## 创建日期
**2025-11-18**

---

## 一、核心概念

### 统一消息对象

前后端使用**完全相同的消息对象结构**，通过 `type` 字段区分消息类型。

**关键原则**：
1. ✅ WebSocket推送使用此对象
2. ✅ HTTP轮询响应使用此对象
3. ✅ 前后端完全一致
4. ✅ 使用 `type` 字段判断消息类型
5. ✅ 使用 `id` 或 `requestId` 关联请求

---

## 二、统一消息对象结构

### 2.1 基础结构

```typescript
interface UnifiedMessage {
    type: MessageType;           // 消息类型（必需）
    id: string;                  // 事件ID / 请求ID（必需）

    // 根据type不同，以下字段可选：
    success?: boolean;           // 是否成功
    status?: TaskStatus;         // 任务状态
    result?: any;                // 结果数据
    error?: string;              // 错误信息

    requires_ack?: boolean;      // 是否需要ACK确认
    timestamp?: number;          // 时间戳

    // 队列相关（可选）
    queue?: QueueInfo | null;    // 队列信息，可为null

    // 其他可选字段
    route?: string;              // 路由名称
    params?: any;                // 请求参数
    data?: any;                  // 额外数据
    event?: string;              // 事件名称
}
```

### 2.2 消息类型枚举

```typescript
enum MessageType {
    // 客户端 → 服务器
    'request',        // 请求
    'ack',           // ACK确认
    'client_id',     // 客户端ID注册
    'ping',          // 心跳检测

    // 服务器 → 客户端
    'response',      // 响应（任务完成）
    'error',         // 错误
    'event',         // 事件通知
    'inventory',     // 库存推送（重连后）
    'welcome',       // 欢迎消息
    'pong',          // 心跳响应

    // HTTP特有
    'accepted',      // 已接受（异步处理中）
    'processing',    // 处理中
    'completed',     // 已完成
    'failed',        // 失败
    'pending'        // 待处理
}
```

### 2.3 任务状态枚举

```typescript
enum TaskStatus {
    'pending',       // 待处理
    'processing',    // 处理中
    'completed',     // 已完成
    'failed',        // 失败
    'accepted'       // 已接受
}
```

### 2.4 队列信息结构

```typescript
interface QueueInfo {
    position?: number;           // 队列位置
    total?: number;              // 总队列数
    estimated_time?: number;     // 预计等待时间（秒）

    // 批量完成的任务（可选）
    completed_tasks?: CompletedTask[];
}

interface CompletedTask {
    id: string;                  // 任务ID
    type: MessageType;           // 消息类型
    result?: any;                // 结果
    error?: string;              // 错误
    timestamp: number;           // 完成时间
}
```

---

## 三、WebSocket推送消息格式

### 3.1 任务完成推送 (type: 'response')

**场景**：后端完成任务后，通过WebSocket推送结果

```json
{
    "type": "response",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "success": true,
    "status": "completed",
    "result": {
        "audio_url": "https://cdn.example.com/audio/123.mp3",
        "duration": 5.2,
        "text": "Hello World"
    },
    "requires_ack": true,
    "timestamp": 1700000000000,
    "queue": null
}
```

**前端处理**：
```javascript
if (message.type === 'response') {
    const pending = this.pendingRequests.get(message.id);
    if (pending) {
        this.pendingRequests.delete(message.id);

        if (message.success) {
            pending.resolve(message.result);  // 执行回调
        } else {
            pending.reject(new Error(message.error));
        }
    }

    // 发送ACK
    if (message.requires_ack) {
        this._sendAck(message.id);
    }
}
```

### 3.2 错误推送 (type: 'error')

```json
{
    "type": "error",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "success": false,
    "error": "Provider quota exceeded",
    "requires_ack": true,
    "timestamp": 1700000000000,
    "queue": null
}
```

### 3.3 事件推送 (type: 'event')

**场景**：服务器主动推送事件（如进度更新）

```json
{
    "type": "event",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "event": "progress",
    "data": {
        "progress": 0.65,
        "message": "Processing audio chunk 65/100"
    },
    "requires_ack": true,
    "timestamp": 1700000000000
}
```

**前端处理**：
```javascript
if (message.type === 'event') {
    this._emit(message.event || 'message', message.data);

    // 发送ACK
    if (message.requires_ack) {
        this._sendAck(message.id);
    }
}
```

### 3.4 库存推送 (type: 'inventory')

**场景**：客户端重连后，服务器推送离线期间完成的任务

```json
{
    "type": "inventory",
    "id": "inventory-push-123",
    "items": [
        {
            "type": "response",
            "id": "task-1",
            "success": true,
            "result": { "data": "result1" },
            "timestamp": 1700000000000
        },
        {
            "type": "response",
            "id": "task-2",
            "success": true,
            "result": { "data": "result2" },
            "timestamp": 1700000001000
        }
    ],
    "requires_ack": true,
    "queue": {
        "completed_tasks": 2
    }
}
```

**前端处理**：
```javascript
if (message.type === 'inventory') {
    this._log('Received inventory push:', message.items?.length || 0);

    // 处理每个离线完成的任务
    message.items?.forEach(item => {
        const pending = this.pendingRequests.get(item.id);
        if (pending) {
            this.pendingRequests.delete(item.id);
            if (item.success) {
                pending.resolve(item.result);
            } else {
                pending.reject(new Error(item.error));
            }
        }
    });

    // 发送ACK
    if (message.requires_ack) {
        this._sendAck(message.id);
    }
}
```

---

## 四、HTTP轮询响应格式

### 4.1 任务待处理 (status: 'pending')

**第一次POST请求立即返回**：

```json
{
    "type": "accepted",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "accepted",
    "message": "Request accepted, processing asynchronously",
    "queue": {
        "position": 5,
        "total": 10,
        "estimated_time": 30
    }
}
```

**前端处理**：
```javascript
if (response.status === 'accepted' && response.id) {
    // 启动轮询
    this._pollForResult(response.id, resolve, reject);
}
```

### 4.2 任务处理中 (status: 'processing')

**GET /rpc/query/{id} 轮询响应**：

```json
{
    "type": "processing",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "processing",
    "message": "Task is being processed",
    "queue": {
        "position": 2,
        "total": 8,
        "estimated_time": 10
    }
}
```

**前端处理**：
```javascript
if (response.status === 'processing' || response.status === 'pending') {
    // 1秒后继续轮询
    setTimeout(poll, 1000);
}
```

### 4.3 任务已完成 (status: 'completed')

**GET /rpc/query/{id} 轮询响应**：

```json
{
    "type": "completed",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "success": true,
    "result": {
        "audio_url": "https://cdn.example.com/audio/123.mp3",
        "duration": 5.2
    },
    "timestamp": 1700000000000,
    "queue": null
}
```

**前端处理**：
```javascript
if (response.status === 'completed' || response.result !== undefined) {
    if (response.error) {
        reject(new Error(response.error));
    } else {
        resolve(response.result);  // 执行回调
    }
}
```

### 4.4 任务失败 (status: 'failed')

```json
{
    "type": "failed",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "failed",
    "success": false,
    "error": "Provider quota exceeded",
    "timestamp": 1700000000000,
    "queue": null
}
```

**前端处理**：
```javascript
if (response.status === 'failed') {
    reject(new Error(response.error || 'Request failed'));
}
```

### 4.5 队列为空 (queue: null)

**当没有队列信息时**：

```json
{
    "type": "processing",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "processing",
    "queue": null
}
```

---

## 五、完整流程示例

### 5.1 WebSocket模式完整流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    WebSocket完整流程                              │
└─────────────────────────────────────────────────────────────────┘

1. 前端发送请求
   ↓
   {
       "type": "request",
       "id": "uuid-123",
       "route": "tts",
       "params": { "text": "Hello" }
   }

2. 前端注册回调
   ↓
   pendingRequests.set("uuid-123", { resolve, reject })

3. 后端接收并存入TaskTable
   ↓
   TaskTable: { id: "uuid-123", status: "pending", ... }

4. 后端异步处理任务
   ↓
   TaskTable: { id: "uuid-123", status: "processing", ... }

5. 处理完成，后端推送结果
   ↓
   WebSocket推送:
   {
       "type": "response",
       "id": "uuid-123",
       "success": true,
       "result": { "audio_url": "..." },
       "requires_ack": true,
       "queue": null
   }

6. 前端收到推送，执行回调
   ↓
   const pending = pendingRequests.get("uuid-123")
   pending.resolve(message.result)
   pendingRequests.delete("uuid-123")

7. 前端发送ACK
   ↓
   {
       "type": "ack",
       "id": "uuid-123"
   }

8. 完成 ✅
```

### 5.2 HTTP模式完整流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    HTTP轮询完整流程                               │
└─────────────────────────────────────────────────────────────────┘

1. 前端POST请求
   ↓
   POST /rpc/tts
   { "id": "uuid-123", "route": "tts", "params": { ... } }

2. 后端立即返回accepted
   ↓
   {
       "type": "accepted",
       "id": "uuid-123",
       "status": "accepted",
       "queue": { "position": 3, "total": 5 }
   }

3. 前端检测到accepted，启动轮询
   ↓
   setInterval(() => {
       GET /rpc/query/uuid-123
   }, 1000)

4. 轮询中 - processing
   ↓
   {
       "type": "processing",
       "id": "uuid-123",
       "status": "processing",
       "queue": { "position": 1, "total": 3 }
   }
   → 继续轮询

5. 轮询中 - processing
   ↓
   {
       "type": "processing",
       "id": "uuid-123",
       "status": "processing",
       "queue": null
   }
   → 继续轮询

6. 轮询完成 - completed
   ↓
   {
       "type": "completed",
       "id": "uuid-123",
       "status": "completed",
       "success": true,
       "result": { "audio_url": "..." },
       "queue": null
   }

7. 前端执行回调
   ↓
   resolve(response.result)

8. 完成 ✅
```

---

## 六、前端实现要点

### 6.1 统一消息处理

```javascript
class UnifiedRpcClient {
    _handleMessage(message) {
        // 统一的type判断
        switch (message.type) {
            case 'response':
                this._handleResponse(message);
                break;
            case 'error':
                this._handleError(message);
                break;
            case 'event':
                this._handleEvent(message);
                break;
            case 'inventory':
                this._handleInventory(message);
                break;
            case 'welcome':
                this._handleWelcome(message);
                break;
        }
    }

    _handleResponse(message) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
            this.pendingRequests.delete(message.id);

            if (message.success) {
                pending.resolve(message.result);
            } else {
                pending.reject(new Error(message.error));
            }
        }

        // 发送ACK
        if (message.requires_ack) {
            this._sendAck(message.id);
        }
    }
}
```

### 6.2 HTTP轮询处理

```javascript
_pollForResult(requestId, resolve, reject) {
    const pollUrl = `${this.baseUrl}/rpc/query/${requestId}`;

    const poll = () => {
        this._httpGet(pollUrl)
            .then((message) => {
                // 使用统一的status判断
                if (message.status === 'completed') {
                    resolve(message.result);
                } else if (message.status === 'failed') {
                    reject(new Error(message.error));
                } else if (message.status === 'processing' || message.status === 'pending') {
                    // 显示队列信息（可选）
                    if (message.queue) {
                        this._log('Queue position:', message.queue.position);
                    }
                    // 继续轮询
                    setTimeout(poll, 1000);
                }
            })
            .catch(() => {
                // 网络错误，重试
                setTimeout(poll, 1000);
            });
    };

    setTimeout(poll, 1000);
}
```

---

## 七、后端实现要点

### 7.1 WebSocket推送

```python
async def push_result(client_id: str, request_id: str, result: any):
    """推送任务完成结果"""
    message = {
        'type': 'response',
        'id': request_id,
        'success': True,
        'status': 'completed',
        'result': result,
        'requires_ack': True,
        'timestamp': int(time.time() * 1000),
        'queue': None
    }

    await websocket_manager.send_to_client(client_id, message)
```

### 7.2 HTTP查询接口

```python
@app.get('/rpc/query/{request_id}')
async def query_result(request_id: str):
    """查询任务状态"""
    task = task_table.get(request_id)

    if not task:
        return {
            'type': 'error',
            'id': request_id,
            'error': 'Task not found',
            'queue': None
        }

    if task.status == TaskStatus.COMPLETED:
        return {
            'type': 'completed',
            'id': request_id,
            'status': 'completed',
            'success': True,
            'result': task.result,
            'timestamp': task.completed_at,
            'queue': None
        }
    elif task.status == TaskStatus.FAILED:
        return {
            'type': 'failed',
            'id': request_id,
            'status': 'failed',
            'success': False,
            'error': task.error,
            'queue': None
        }
    else:
        # 获取队列信息
        queue_info = get_queue_info(request_id)

        return {
            'type': 'processing',
            'id': request_id,
            'status': task.status,
            'queue': queue_info
        }
```

---

## 八、总结

### 核心原则 ✅

1. ✅ **统一消息对象** - WebSocket和HTTP使用相同结构
2. ✅ **type字段判断** - 通过type区分消息类型
3. ✅ **id字段关联** - 使用id关联请求和响应
4. ✅ **queue可为null** - 队列信息可选
5. ✅ **前后端完全一致** - 避免转换和混淆

### 消息类型清单 ✅

**客户端 → 服务器**：
- `request` - 请求
- `ack` - ACK确认
- `client_id` - 客户端ID
- `ping` - 心跳

**服务器 → 客户端**：
- `response` - 任务完成
- `error` - 错误
- `event` - 事件通知
- `inventory` - 库存推送
- `welcome` - 欢迎
- `pong` - 心跳响应

**HTTP特有状态**：
- `accepted` - 已接受
- `processing` - 处理中
- `completed` - 已完成
- `failed` - 失败
- `pending` - 待处理

---

**创建者**: Claude Code
**创建日期**: 2025-11-18
**状态**: ✅ **规范定义完成**

