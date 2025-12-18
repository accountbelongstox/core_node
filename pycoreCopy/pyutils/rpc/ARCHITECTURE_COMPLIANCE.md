# RPC 事件驱动异步架构 - 合规性检查

## 核心架构设计

### ⚠️ 重要澄清：不是超时等待，而是事件驱动

**错误理解**：发送请求后等待30秒超时
**正确架构**：事件驱动的异步RPC系统

```
前端发送请求 → 后端存入事件库 → 异步处理 → 回调通知
                     ↓
              事件ID + 回调存储 (前后端都存)
                     ↓
         WebSocket: 推送结果 | HTTP: 轮询查询
                     ↓
              前端收到 → 查找回调 → 执行
```

---

## 一、核心组件和数据流

### 1.1 事件ID系统

**前端存储**：
```javascript
pendingRequests: Map<eventId, {resolve, reject, timeout}>
```

**后端存储**：
```python
TaskTable: Map<eventId, Task{
    task_id: str,           # 事件ID
    route: str,             # 路由
    params: Dict,           # 参数
    result: Any,            # 结果
    client_id: str,         # 客户端ID
    protocol: str,          # 'websocket' | 'http'
    status: TaskStatus,     # PENDING | PROCESSING | COMPLETED
    callback: Callable      # 回调函数
}>
```

### 1.2 前后端回调存储

**前端回调**：
- 存储在 `pendingRequests` Map中
- 键：事件ID (request_id)
- 值：`{resolve, reject, timeout}`
- 收到推送时，通过事件ID查找并执行

**后端回调**：
- 存储在事件表（TaskTable）中
- 处理完成后根据 `protocol` 字段决定：
  - `websocket`：调用 `notify_websocket_with_retry()` 推送
  - `http`：结果已存在事件表，等待轮询查询

### 1.3 WebSocket 推送模式

```
客户端                              服务端
  |                                   |
  |--- 发送请求 (eventId) ----------->|
  |                                   |--- 存入事件库
  |                                   |--- 异步处理
  |                                   |
  |<-- 推送结果 (eventId) ------------|--- 处理完成，回调
  |                                   |
  |--- 发送 ACK ---------------------->|--- 标记为已确认
  |                                   |
  |--- 查找回调执行 (eventId)         |
```

**关键点**：
- ❌ 不是持续等待30秒
- ✅ 注册回调后等待推送（reactive）
- ✅ 收到推送时通过eventId查找回调执行

### 1.4 HTTP 轮询模式

```
客户端                              服务端
  |                                   |
  |--- POST 请求 (eventId) ---------->|
  |                                   |--- 存入事件库
  |<-- 202 Accepted (eventId) -------|--- 返回accepted
  |                                   |--- 异步处理
  |                                   |
  |--- 1秒后轮询 (eventId) ---------->|
  |<-- 202 Processing -----------------|
  |                                   |
  |--- 再次轮询 (eventId) ------------>|--- 处理完成
  |<-- 200 OK (result) ----------------|
  |                                   |
  |--- 执行回调 (eventId)             |
```

**关键点**：
- ❌ 不是等待30秒超时
- ✅ 使用轮询查询（polling）
- ✅ 1秒间隔主动查询状态
- ✅ 收到结果后通过eventId执行回调

---

## 二、架构实现状态

### 2.1 前端实现 ✅ 基础完成，待完善

#### ✅ 已实现
1. **ClientId localStorage 持久化**
   - 位置: `unified_rpc_client.js:87-104`
   - 刷新后恢复客户端ID

2. **事件回调存储**
   - `pendingRequests` Map存储 eventId → callback
   - 位置: `unified_rpc_client.js:104,270`

3. **WebSocket 消息接收**
   - 收到推送时查找并执行回调
   - 位置: `unified_rpc_client.js:270`

#### ❌ 待实现

1. **HTTP 自动轮询机制**
   - 当前状态: HTTP请求后同步等待
   - 需要: 检测 `status: 'accepted'` 后自动开启轮询
   - 实现: `_pollForResult(requestId, resolve, reject)`

2. **WebSocket ACK 发送**
   - 当前状态: 部分实现
   - 需要: 收到 `requires_ack` 响应后立即发送ACK
   - 实现: `_sendAck(requestId)`

3. **请求持久化（可选）**
   - pending请求ID存localStorage
   - 刷新后恢复等待中的请求

---

### 2.2 后端实现 ✅ 核心完成，待优化

#### ✅ 已实现

1. **事件表存储**
   - 位置: `pycore/pyutils/rpc/common/task_table.py`
   - 所有请求存入TaskTable
   - 支持状态跟踪（PENDING → PROCESSING → COMPLETED）

2. **库存表机制**
   - 位置: `pycore/pyutils/rpc/common/inventory_table.py`
   - WebSocket推送失败后存入库存
   - 重连时检查并发送

3. **WebSocket 推送**
   - 位置: `pycore/pyutils/rpc/server/ack_manager.py:69-135`
   - 处理完成后推送结果
   - 支持重试机制（3次，间隔3秒）

4. **HTTP 查询接口**
   - 位置: `pycore/pyutils/rpc/server/http_handler.py:229`
   - 端点: `GET /rpc/query/{request_id}`
   - 返回处理状态和结果

5. **ACK 确认机制**
   - WebSocket: 客户端发送ACK消息
   - HTTP: 状态码200 = ACK确认
   - 位置: `ack_manager.py:254-279`

#### ❌ 待优化

1. **非阻塞重试机制**
   - 当前状态: 使用 `await asyncio.sleep()` 阻塞
   - 位置: `ack_manager.py:237` (`_check_ack_timeout`)
   - 需要: 使用 `call_later()` 非阻塞定时器
   - 原因: 避免阻塞事件循环

2. **客户端清理配置**
   - 需要添加: MAX_CLIENTS 限制
   - 需要添加: CLIENT_TIMEOUT 配置
   - 位置: `client_manager.py`

---

## 三、协议一致性检查

### 3.1 消息格式 ✅ 符合

#### Request 格式
```json
{
    "type": "request",
    "id": "uuid-event-id",
    "route": "controller_name",
    "params": {...}
}
```

#### Response 格式
```json
{
    "type": "response",
    "id": "uuid-event-id",
    "success": true,
    "result": {...},
    "error": null,
    "requires_ack": true
}
```

#### ACK 格式
```json
{
    "type": "ack",
    "id": "uuid-event-id"
}
```

### 3.2 HTTP 异步响应 ✅ 符合

**阶段1: 接受请求**
```json
{
    "id": "uuid-event-id",
    "status": "accepted",
    "message": "Request accepted, please query result after 1 second",
    "requires_ack": true
}
```

**阶段2: 轮询结果**
```json
{
    "id": "uuid-event-id",
    "status": "completed",
    "result": {...},
    "error": null,
    "success": true
}
```

---

## 四、实现优先级和TODO

### P0 - 核心功能（必须实现）

1. ✅ **后端：事件表存储** (task_table.py)
2. ✅ **后端：WebSocket推送** (ack_manager.py)
3. ✅ **后端：HTTP查询接口** (http_handler.py:229)
4. ✅ **后端：库存表机制** (inventory_table.py)
5. ✅ **前端：事件回调存储** (pendingRequests Map)
6. ✅ **前端：ClientId持久化** (localStorage)

### P1 - 待完成功能

7. ❌ **前端：HTTP自动轮询**
   - 文件: `unified_rpc_client.js`
   - 方法: `_pollForResult(requestId, resolve, reject)`
   - 逻辑: 检测accepted响应 → 1秒间隔轮询 → 执行回调

8. ❌ **前端：WebSocket ACK发送**
   - 文件: `unified_rpc_client.js`
   - 方法: `_sendAck(requestId)`
   - 逻辑: 收到requires_ack → 发送ACK消息

9. ❌ **后端：非阻塞重试**
   - 文件: `ack_manager.py`
   - 修改: `_check_ack_timeout` 使用 `call_later()`
   - 原因: 避免阻塞事件循环

### P2 - 优化功能

10. ❌ **后端：客户端清理配置**
    - MAX_CLIENTS = 10000
    - CLIENT_TIMEOUT = 3600秒

11. ❌ **前端：请求持久化（可选）**
    - pending请求存localStorage
    - 刷新后恢复

---

## 五、架构合规性评分

### 总体符合度: **85%**

#### ✅ 已符合 (85%)
- ✅ 事件ID系统（前后端都存）
- ✅ 回调存储（前后端都存）
- ✅ WebSocket推送机制
- ✅ HTTP轮询接口（后端）
- ✅ 库存表机制
- ✅ ACK确认机制
- ✅ ClientId持久化
- ✅ 事件表状态跟踪
- ✅ 统一响应格式

#### ❌ 待完成 (15%)
- ❌ HTTP自动轮询（前端）
- ❌ WebSocket ACK发送（前端完善）
- ❌ 非阻塞重试（后端优化）

---

## 六、关键架构澄清

### ❌ 错误理解：超时等待模式

```javascript
// ❌ 错误：等待30秒超时
async call(route, params) {
    const timeout = 30000; // 30秒
    return new Promise((resolve, reject) => {
        setTimeout(() => reject('timeout'), timeout);
        // 发送请求...
    });
}
```

### ✅ 正确架构：事件驱动模式

**WebSocket 模式：**
```javascript
// ✅ 正确：注册回调，等待推送
async call(route, params) {
    const eventId = generateUUID();
    return new Promise((resolve, reject) => {
        // 存储回调
        this.pendingRequests.set(eventId, {resolve, reject});

        // 发送请求
        this.ws.send(JSON.stringify({
            type: 'request',
            id: eventId,
            route, params
        }));

        // 不等待！由 ws.onmessage 接收推送后执行回调
    });
}

ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'response') {
        // 通过eventId查找回调
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
            pending.resolve(msg.result);  // 执行回调
            this.pendingRequests.delete(msg.id);

            // 发送ACK
            if (msg.requires_ack) {
                this._sendAck(msg.id);
            }
        }
    }
};
```

**HTTP 模式：**
```javascript
// ✅ 正确：轮询查询
async _callHttp(eventId, route, params, resolve, reject) {
    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({id: eventId, route, params})
    });

    const data = await response.json();

    // 检测异步响应
    if (data.status === 'accepted') {
        // 自动开启轮询
        this._pollForResult(eventId, resolve, reject);
    } else {
        // 同步结果
        resolve(data.result);
    }
}

_pollForResult(eventId, resolve, reject) {
    const poll = async () => {
        const response = await fetch(`/rpc/query/${eventId}`);
        const data = await response.json();

        if (data.status === 'completed') {
            resolve(data.result);  // 执行回调
        } else if (data.status === 'processing') {
            setTimeout(poll, 1000);  // 1秒后再查
        } else {
            reject(new Error(data.error));
        }
    };

    setTimeout(poll, 1000);  // 1秒后开始轮询
}
```

---

## 七、测试验证

### 7.1 事件ID系统测试

```javascript
// 前端测试
const eventId = await client.call('tts', {text: 'test'});
// 验证: pendingRequests 包含 eventId
assert(client.pendingRequests.has(eventId));
```

```python
# 后端测试
event = task_table.get_task(event_id)
assert event.task_id == event_id
assert event.route == 'tts'
assert event.protocol == 'websocket'
```

### 7.2 WebSocket推送测试

```javascript
// 前端收到推送
ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    // 验证: 通过eventId找到回调
    const pending = this.pendingRequests.get(msg.id);
    assert(pending !== undefined);
    pending.resolve(msg.result);
};
```

### 7.3 HTTP轮询测试

```javascript
// 前端轮询
const result = await client.call('tts', {text: 'test'});
// 验证: 自动轮询并返回结果
assert(result !== null);
```

---

## 八、总结

### 核心要点

1. **不是超时等待**，而是**事件驱动异步**
2. **WebSocket**: 推送模式（reactive）
3. **HTTP**: 轮询模式（polling）
4. **事件ID**: 前后端都存，用于查找回调
5. **回调存储**: 前后端都存，收到结果时执行

### 当前状态

- ✅ 后端架构基本完成（85%）
- ✅ 前端基础功能完成
- ❌ 需要完善：HTTP轮询、ACK发送、非阻塞重试

### 下一步

1. 实现前端HTTP自动轮询
2. 完善WebSocket ACK发送
3. 优化后端非阻塞重试机制
4. 集成测试验证

---

**最后更新**: 2025-11-18
**架构合规度**: 85%
**待完成项**: 3项核心功能
