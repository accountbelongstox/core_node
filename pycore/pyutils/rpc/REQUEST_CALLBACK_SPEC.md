# 请求-回调机制规范

## 核心原则

**每个requestID的任务请求，都必须附带一个回调函数**

这确保了异步RPC系统的可靠性和可追溯性。

## 架构设计

### 1. 前端：请求-回调映射 (pendingRequests Map)

```javascript
// Map结构：requestID → callback metadata
this.pendingRequests = new Map();

// 发送请求时注册回调
this.pendingRequests.set(requestId, {
    resolve: Function,      // 成功回调（不可序列化）
    reject: Function,       // 失败回调（不可序列化）
    route: String,          // 路由名称（可持久化）
    params: Object,         // 请求参数（可持久化）
    timestamp: Number       // 请求时间戳（可持久化）
});
```

### 2. 后端：请求-客户端映射 (RequestEventTable)

```python
# TaskTable/RequestEventTable结构
{
    'request_id': str,      # 唯一请求ID
    'client_id': str,       # 客户端ID
    'route': str,           # 路由名称
    'params': dict,         # 请求参数
    'status': RequestStatus,# 状态（pending/processing/completed）
    'result': Any,          # 处理结果
    'error': str,           # 错误信息
    'created_at': float,    # 创建时间
    'completed_at': float   # 完成时间
}
```

### 3. 双向关联

```
前端                         后端
────────────────────────────────────────
requestID → callback    ←→  requestID → client_id
clientID (持久化)       ←→  clientID → ws connection

页面刷新后：
requestID 元数据恢复    ←→  requestID 仍在TaskTable中
clientID 保持不变       ←→  clientID 重连复用
```

## 完整流程

### 正常流程（WebSocket）

```
1. 前端发送请求
   ├─ 生成 requestID = generateUUID()
   ├─ 注册回调: pendingRequests.set(requestID, {resolve, reject, route, params})
   ├─ 持久化: localStorage.setItem(requestID元数据)
   └─ 发送: ws.send({type: 'request', id: requestID, route, params})

2. 后端接收请求
   ├─ 创建事件: TaskTable.create(requestID, clientID, route, params)
   ├─ 更新状态: status = PROCESSING
   └─ 异步处理任务

3. 后端处理完成
   ├─ 更新事件: TaskTable.update(requestID, result, status=COMPLETED)
   ├─ 查找客户端: ClientManager.get_client(clientID)
   ├─ 推送结果: ClientManager.safe_send(clientID, {type: 'response', id: requestID, result})
   └─ 等待ACK确认

4. 前端接收响应
   ├─ 接收: ws.onmessage({type: 'response', id: requestID, result})
   ├─ 查找回调: pending = pendingRequests.get(requestID)
   ├─ 执行回调: pending.resolve(result)
   ├─ 清理映射: pendingRequests.delete(requestID)
   ├─ 更新存储: localStorage更新
   └─ 发送ACK: ws.send({type: 'ack', id: requestID})
```

### HTTP模式（仅当WebSocket不可用）

```
1. 前端发送请求
   ├─ POST /rpc/{route} {id: requestID, params}
   ├─ 注册回调: pendingRequests.set(requestID, {...})
   └─ 持久化到localStorage

2. 后端返回accepted
   ├─ 返回: {status: 'accepted', id: requestID}
   ├─ 异步处理任务
   └─ 不等待完成

3. 前端轮询结果
   ├─ setInterval: GET /rpc/query/{requestID}
   ├─ 每1秒查询一次
   └─ 直到收到 {status: 'completed', result}

4. 前端接收结果
   ├─ 执行回调: pending.resolve(result)
   ├─ 清理映射: pendingRequests.delete(requestID)
   ├─ 停止轮询
   └─ 更新localStorage
```

### 页面刷新恢复

```
1. 页面加载时
   ├─ 恢复clientID: localStorage.getItem('rpc_client_id')
   ├─ 恢复pending元数据: localStorage.getItem('rpc_pending_requests_${clientID}')
   └─ storedPendingRequests = [{id, route, params, timestamp}, ...]

2. 重新连接WebSocket
   ├─ 使用相同clientID连接
   ├─ 后端识别重连: ClientManager.register(clientID, reuse=True)
   └─ 后端推送inventory中的结果

3. 用户重新调用API（可选）
   ├─ 用户检查storedPendingRequests
   ├─ 重新调用client.call()注册新回调
   └─ 或者查询历史结果
```

## localStorage存储结构

### 1. 客户端ID
```json
{
  "key": "rpc_client_id",
  "value": "66314b52-d22b-48d5-8900-048769e0e2f6"
}
```

### 2. pending请求列表
```json
{
  "key": "rpc_pending_requests_66314b52...",
  "value": [
    {
      "id": "1946f5f3-df60-4057-aacb-5daedb5db694",
      "route": "clipboard_get",
      "params": {},
      "timestamp": 1700000000000
    },
    {
      "id": "256bee78-d4b9-4ff1-9ee9-2ae29cfe90e8",
      "route": "tts",
      "params": {"text": "你好"},
      "timestamp": 1700000001000
    }
  ]
}
```

## WebSocket优先策略

### 策略1：严格模式（推荐）

```javascript
const client = new UnifiedRpcClient(url, {
    preferWebSocket: true,
    httpFallback: false  // 禁用HTTP fallback
});

// 行为：
// - WebSocket可用 → 使用WebSocket
// - WebSocket不可用 → 抛出错误
```

### 策略2：forceWebSocket模式（最严格）

```javascript
const client = new UnifiedRpcClient(url, {
    forceWebSocket: true
});

await client.call('tts', {text: '测试'});
// 行为：
// - WebSocket未连接 → 立即reject错误
// - 不会尝试HTTP
```

### 策略3：智能fallback（兼容模式）

```javascript
const client = new UnifiedRpcClient(url, {
    preferWebSocket: true,
    httpFallback: true  // 允许HTTP fallback
});

// 行为：
// - 优先使用WebSocket
// - WebSocket不可用时自动fallback到HTTP
```

## 回调管理最佳实践

### 1. 始终使用Promise

```javascript
// ✅ 正确：使用Promise
const result = await client.call('tts', {text: '你好'});

// ❌ 错误：不支持传统callback
client.call('tts', {text: '你好'}, function(err, result) {
    // 不支持这种模式
});
```

### 2. 处理长时间运行的任务

```javascript
// 无超时限制 - 适合长任务
const result = await client.call('long_task', {duration: 3600});
// 等待1小时也没问题 - 事件驱动架构

// 如需取消，保存requestID
const requestId = generateUUID();
const promise = client.call('long_task', {duration: 3600}, {requestId});

// 稍后取消（需要后端支持取消API）
await client.call('cancel', {requestId});
```

### 3. 页面刷新后恢复

```javascript
// 页面加载时检查pending请求
if (client.storedPendingRequests && client.storedPendingRequests.length > 0) {
    console.log('发现未完成的请求:', client.storedPendingRequests);

    // 选项1：重新调用以注册新回调
    for (const req of client.storedPendingRequests) {
        client.call(req.route, req.params).then(result => {
            console.log('恢复的请求已完成:', req.id, result);
        });
    }

    // 选项2：查询历史结果
    for (const req of client.storedPendingRequests) {
        const result = await client.call('query_result', {requestId: req.id});
        console.log('历史结果:', result);
    }
}
```

## 后端配合要求

### 1. TaskTable必须记录client_id

```python
# ✅ 正确：记录客户端关联
event = RequestEventTable.create_event(
    request_id=request_id,
    route=route,
    params=params,
    client_id=client_id,  # ← 必须记录
    client_type='websocket'
)
```

### 2. 完成后必须推送

```python
# ✅ 正确：处理完成后推送
async def process_task(request_id):
    result = await do_work()

    # 更新TaskTable
    request_event_table.update_result(request_id, result)

    # 查找客户端
    event = request_event_table.get_event(request_id)

    # 推送结果
    await ack_manager.notify_websocket_with_retry(
        client_id=event.client_id,
        request_id=request_id,
        result=result,
        error=None
    )
```

### 3. 支持重连恢复

```python
# ✅ 客户端重连时推送inventory结果
if client_id in inventory_table:
    items = inventory_table.get_by_client(client_id)
    for item in items:
        await client_manager.safe_send(client_id, {
            'type': 'response',
            'id': item.request_id,
            'result': item.result,
            'from_inventory': True
        })
```

## 调试和监控

### 前端监控

```javascript
// 开启debug日志
const client = new UnifiedRpcClient(url, {debug: true});

// 监控pending请求
console.log('当前pending:', client.pendingRequests.size);
console.log('存储的历史:', client.storedPendingRequests);

// 监控连接状态
console.log('模式:', client.getMode());  // 'ws' or 'http'
console.log('连接状态:', client.isConnected());
```

### 后端监控

```python
# 查看pending请求
pending_events = request_event_table.get_pending_notifications(client_id)
print(f"待推送: {len(pending_events)}")

# 查看inventory
inventory_items = inventory_table.get_by_client(client_id)
print(f"库存消息: {len(inventory_items)}")

# 查看客户端状态
client = client_manager.get_client(client_id)
print(f"状态: {client.status.value}")
print(f"pending消息: {len(client.pending_messages)}")
```

## 常见问题

### Q1: 页面刷新后回调丢失怎么办？

**A**: 回调函数无法序列化到localStorage。页面刷新后：
- 元数据（route, params）会恢复到`storedPendingRequests`
- 用户需要重新调用`client.call()`来注册新回调
- 或者使用`query_result` API查询历史结果

### Q2: WebSocket断开后怎么办？

**A**: 自动处理：
- 前端：自动重连（使用相同clientID）
- 后端：ClientManager识别重连，推送inventory消息
- pending请求保留，重连后继续等待

### Q3: HTTP模式下如何保证不丢失？

**A**: 轮询机制：
- 前端每1秒轮询一次
- 后端TaskTable永久保留结果
- 即使页面刷新，也可以通过requestID查询

### Q4: 如何确认后端已收到请求？

**A**: WebSocket模式：
```javascript
// 后端立即返回accepted
{type: 'event', event: 'request_accepted', id: requestID}
```

HTTP模式：
```javascript
// POST返回
{status: 'accepted', id: requestID}
```

## 总结

✅ **关键要求**：
1. 每个requestID必须有对应回调
2. 前端使用Map管理回调映射
3. 后端使用TaskTable记录request-client关联
4. 元数据持久化到localStorage
5. WebSocket优先，HTTP仅作fallback
6. 重连后自动恢复pending消息
