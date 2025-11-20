# RPC修复记录 - 2025-11-18

## 问题1: RPC组件初始化日志缺失
所有组件debug默认改True，添加初始化日志

## 问题2: HTTP Handler时间导入冲突
删除5处局部import time，保留全局导入

## 问题3: 前端client_id为undefined
调整options对象顺序，clientId放最后防覆盖

## 问题4: unregister时未清除ws引用 ✅ 核心修复
断开连接时client.ws仍指向已关闭对象，导致发送失败

## 问题5: 客户端表不是唯一管理入口 ✅ 架构改进
AckManager、UnifiedServer直接访问client_manager.clients字典，违反封装原则

## 问题6: ws=None时访问.closed崩溃 ✅ 严重Bug
is_websocket_connected()和safe_send()未检查ws是否为None，直接访问ws.closed导致AttributeError

## 核心修复

### client_manager.py (L537, L554)
```python
# unregister时清除ws引用
client.status = ClientStatus.RECONNECTING
client.ws = None  # ✅ 防止引用已关闭WebSocket
```

### ack_manager.py (L67, L156-198)
```python
# 删除直接字典访问，改用公共方法
success = await self.client_manager.safe_send(
    client_id=client_id,
    message=message,
    queue_if_disconnected=(attempt < max_retries - 1)
)
```

## 架构改进：唯一客户端管理入口

**ClientManager.clients** 全局总表（唯一数据源）：
- 注册: `register_websocket_client()` → status=CONNECTING, ws=新对象
- 注销: `unregister_websocket_client()` → status=RECONNECTING, ws=None
- 发送: `safe_send()` → 自动检查status和ws.closed
- 查询: `get_client()`, `is_websocket_connected()`

**其他组件**: 通过ClientManager公共方法访问，不直接操作clients字典

### unified_server.py (L489-509)
```python
# 改用公共方法获取客户端列表
all_clients = self.client_manager.get_all_websocket_clients()
for client in all_clients:
    if client and client.ws:
        # Safe check before accessing ws.closed
        if client.ws and not client.ws.closed:
            await client.ws.close(...)
```

### client_manager.py (L398, L623)
```python
# safe_send: 检查ws不为None
if client.ws is None or client.ws.closed:
    # Handle disconnected state

# is_websocket_connected: 三重检查
return (client.status == ClientStatus.CONNECTED and
        client.ws is not None and
        not client.ws.closed)
```

## 修改文件
- client_manager.py - unregister清除ws, safe_send/is_connected检查ws=None
- ack_manager.py - 使用safe_send()代替直接发送，删除ws_clients属性
- unified_server.py - shutdown使用公共方法，安全检查ws.closed
- unified_rpc_client.js - clientId顺序修复

## 客户端生命周期完整性验证 ✅

### 正常流程
1. 连接: register_websocket_client() → status=CONNECTING, ws=新对象
2. 就绪: set_client_status(CONNECTED) → status=CONNECTED
3. 活动: update_client_activity() → last_active更新
4. 断开: unregister_websocket_client() → status=RECONNECTING, **ws=None**
5. 重连: register_websocket_client(reuse=True) → status=CONNECTING, ws=新对象, 保留pending_messages
6. 清理: remove_client() → 从clients字典删除（超时后）

### 异常处理
- safe_send失败 → 自动更新status=DISCONNECTED
- ws=None或ws.closed → safe_send返回False
- is_websocket_connected → 三重检查（status + ws不为None + not ws.closed）

## 修改详情

### 文件1: client_manager.py
**修改位置**：
- L537: `client.ws = None` (unregister RECONNECTING分支)
- L554: `client.ws = None` (unregister DISCONNECTED分支)
- L398: `if client.ws is None or client.ws.closed:` (safe_send检查)
- L623: `client.ws is not None and not client.ws.closed` (is_websocket_connected检查)

**影响范围**：
- unregister_websocket_client() - 断开时清除ws引用
- safe_send() - 发送前检查ws不为None
- is_websocket_connected() - 三重安全检查

### 文件2: ack_manager.py
**修改位置**：
- L67: 删除 `@property ws_clients` 方法
- L156-198: 重写 `_send_notification_attempt()` 方法

**修改前**：
```python
client_info = self.client_manager.clients.get(client_id)  # ❌ 直接访问
ws = client_info.ws
await ws.send_json(message)
```

**修改后**：
```python
success = await self.client_manager.safe_send(  # ✅ 使用公共方法
    client_id=client_id,
    message=message,
    queue_if_disconnected=(attempt < max_retries - 1)
)
```

### 文件3: unified_server.py
**修改位置**：
- L489-491: 改用 `get_all_websocket_clients()` 替代直接访问clients.keys()
- L496: `client.client_id` 替代循环变量 `client_id`
- L503: 添加 `client.ws and` 检查
- L506: `client.client_id` 替代 `client_id`
- L509: `client.client_id` 替代 `client_id`

**修改前**：
```python
for client_id in list(self.client_manager.clients.keys()):  # ❌
    client = self.client_manager.get_client(client_id)
    if client and client.ws:
        if not client.ws.closed:  # ❌ 未检查ws是否为None
```

**修改后**：
```python
all_clients = self.client_manager.get_all_websocket_clients()  # ✅
for client in all_clients:
    if client and client.ws:
        if client.ws and not client.ws.closed:  # ✅ 双重检查
```

### 文件4: unified_rpc_client.js
**修改位置**：L106-121

**修改前**：
```javascript
this.options = {
    clientId: clientId,  // ❌ 先设置
    ...options          // 覆盖前面的设置
};
```

**修改后**：
```javascript
this.options = {
    ...options,
    clientId: clientId  // ✅ 最后设置，不会被覆盖
};
```

## 其他涉及文件（仅添加日志）
- task_table.py - 添加初始化和创建任务日志
- inventory_table.py - 添加初始化日志
- request_processor.py - 添加初始化日志
- websocket_handler.py - 添加初始化日志
- http_handler.py - 删除局部import time，添加访问日志

## 修复统计

**核心修复文件**：4个
- client_manager.py (4处修改)
- ack_manager.py (2处修改)
- unified_server.py (5处修改)
- unified_rpc_client.js (1处修改)

**日志增强文件**：5个
- task_table.py, inventory_table.py, request_processor.py
- websocket_handler.py, http_handler.py

**问题总数**：6个（3个严重，3个一般）
- ⭐⭐⭐ 严重：问题4、5、6（核心架构和Bug）
- ⭐ 一般：问题1、2、3（日志和前端配置）

**代码行数**：约15处实质性修改

## 验证测试

### 预期行为
```
[ClientManager] Client registered: 2608e7fc... (status: connecting)
[ClientManager] Client 2608e7fc... status: connecting → connected
[ClientManager] Message sent to 2608e7fc...  ← ✅ 成功发送
[AckManager] Sent response to WebSocket client...
[AckManager] ACK received from client...
```

### 不应出现
```
[AckManager] WebSocket client xxx not connected  ← ❌ 不应出现
[InventoryTable] Stored result for request xxx   ← ❌ 不应全部进入inventory
```

### 测试方法
1. 重启RPC服务
2. 前端连接WebSocket
3. 发送任意RPC请求（如clipboard_get）
4. 观察日志：消息应成功发送，收到ACK确认
5. 验证：任务不应进入inventory（除非真正断开连接）

## 问题7: 前端WebSocket和HTTP混用 ✅ 新增功能
WebSocket可用时仍使用HTTP polling，效率低下

## 问题8: pending requests未持久化 ✅ 新增功能
页面刷新后丢失所有pending请求，无法恢复

## 前端库改进 (2025-11-18)

### unified_rpc_client.js - WebSocket优先策略

#### 1. 严格WebSocket优先模式 (L323-336)
```javascript
// ✅ 检查WebSocket是否可用
const hasWebSocket = this.mode === 'ws' && this.connected && ...;

if (hasWebSocket) {
    // 强制使用WebSocket
    this._callWebSocket(...);
} else if (this.options.forceWebSocket) {
    // 可选：强制WebSocket模式，不可用时拒绝请求
    reject(new Error('WebSocket required but not connected'));
} else {
    // 只在WebSocket完全不可用时fallback到HTTP
    this._callHttp(...);
}
```

#### 2. 请求-回调映射持久化 (L349-360, L661-721)
```javascript
// 发送请求时存储完整元数据
this.pendingRequests.set(requestId, {
    resolve,      // 回调函数（不可序列化）
    reject,       // 错误回调（不可序列化）
    route,        // 路由名称（可持久化）
    params,       // 请求参数（可持久化）
    timestamp     // 请求时间戳（可持久化）
});

// 自动保存到localStorage
this._savePendingRequests();
```

#### 3. localStorage持久化机制 (L661-721)
```javascript
// 保存方法：仅存储可序列化的元数据
_savePendingRequests() {
    const pendingData = [];
    this.pendingRequests.forEach((value, requestId) => {
        pendingData.push({
            id: requestId,
            route: value.route,
            params: value.params,
            timestamp: value.timestamp
        });
    });
    localStorage.setItem(storageKey, JSON.stringify(pendingData));
}

// 加载方法：页面刷新后恢复
_loadPendingRequests() {
    const stored = localStorage.getItem(storageKey);
    this.storedPendingRequests = JSON.parse(stored);
    // 注意：回调需要用户重新调用API来注册
}
```

#### 4. 请求完成时更新存储 (L266-285)
```javascript
// 收到响应后删除并更新localStorage
this.pendingRequests.delete(message.id);
this._savePendingRequests();  // ✅ 自动更新
```

### 新增配置选项
```javascript
{
    forceWebSocket: false,  // 强制WebSocket模式（不可用时拒绝请求）
    debug: true             // 开启详细日志
}
```

### 使用示例
```javascript
// 创建客户端（WebSocket优先）
const client = new UnifiedRpcClient('http://localhost:59000', {
    debug: true,
    forceWebSocket: false  // false=允许HTTP fallback, true=强制WebSocket
});

await client.connect();

// 发送请求（自动选择WebSocket，自动持久化）
const result = await client.call('tts', { text: '你好' });
// 每个请求都有唯一requestID和回调映射
// 元数据自动保存到localStorage
// WebSocket可用时不使用HTTP
```

### 架构优势
1. **WebSocket优先**：可用时100%使用WebSocket，不会混用HTTP
2. **请求持久化**：页面刷新不丢失pending请求元数据
3. **自动恢复**：重新连接后可查询历史请求状态
4. **回调管理**：每个requestID严格对应一个回调
5. **存储管理**：自动保存/加载/清理localStorage

## 问题9: 事件回调未规范化管理 ✅ 新增功能
前端缺少统一的事件回调注册表，回调管理混乱

## 问题10: localStorage存储冗余数据 ✅ 架构优化
存储了route、params等运行时数据，违反只存ID原则

## Event/Callback Registry (MCP Table) - 2025-11-18

### 核心架构

**事件MCP表**：所有事件回调必须在此表中注册
- `callbackRegistry` - Map<callbackId, callbackFunction>
- 只存储callbackId到localStorage（不存储函数）
- 数据立即传递给回调函数（不存储params/result）

### 新增方法

#### 1. registerCallback(callbackId, callbackFunction)
```javascript
// 注册事件回调
client.registerCallback('ui_update', (message) => {
    console.log('Updating UI with:', message.result);
    updateUI(message.result);
});
```

#### 2. unregisterCallback(callbackId)
```javascript
// 注销事件回调
client.unregisterCallback('ui_update');
```

#### 3. Default Callback Handler
当收到推送但未找到注册的回调时，使用默认处理器：
- 打印接收到的数据
- 显示缺失的callbackId
- 提示如何注册自定义处理器

**默认处理器输出示例**：
```
═══════════════════════════════════════════════════
[UnifiedRpcClient] Default Callback Handler
═══════════════════════════════════════════════════
Callback ID: ui_update
Status: SUCCESS

Received Data:
{
  "type": "response",
  "id": "abc123",
  "success": true,
  "result": {...}
}

⚠️  No custom handler registered for this callback ID

📝 To register a custom handler, use:

   client.registerCallback('ui_update', (message) => {
       // Your custom handler code here
       console.log("Processing result:", message.result);
       // Example: Update UI, save to database, etc.
   });

═══════════════════════════════════════════════════
```

### localStorage存储策略优化

#### 修改前 ❌
```javascript
localStorage.setItem('rpc_pending_requests_xxx', JSON.stringify([
    {
        id: 'request-123',
        route: 'tts',           // ❌ 不应存储
        params: {text: '你好'},  // ❌ 不应存储
        timestamp: 1700000000
    }
]));
```

#### 修改后 ✅
```javascript
// 只存储requestId + callbackId
localStorage.setItem('rpc_pending_requests_xxx', JSON.stringify([
    {
        id: 'request-123',
        callbackId: 'ui_update',  // ✅ 只存ID
        timestamp: 1700000000
    }
]));

// 回调注册表：只存callbackId（不存函数）
localStorage.setItem('rpc_callback_registry_xxx', JSON.stringify([
    'ui_update',
    'data_sync',
    'notification_handler'
]));
```

### 使用示例

#### 完整流程示例
```javascript
// 1. 创建客户端
const client = new UnifiedRpcClient('http://localhost:59000', {
    debug: true
});

await client.connect();

// 2. 注册事件回调
client.registerCallback('tts_complete', (message) => {
    if (message.success) {
        console.log('TTS completed:', message.result);
        playAudio(message.result.audio_url);
    } else {
        console.error('TTS failed:', message.error);
        showError(message.error);
    }
});

// 3. 发送请求并关联回调
const result = await client.call('tts',
    { text: '你好世界' },
    { callbackId: 'tts_complete' }  // ✅ 关联回调ID
);

// 4. 收到推送时自动执行注册的回调
// - 如果找到回调：执行 tts_complete(message)
// - 如果未找到：执行默认处理器（打印数据和注册提示）
```

#### 页面刷新后恢复
```javascript
// 页面加载时，客户端会提示需要重新注册回调
// Console output:
// [UnifiedRpcClient] Found 3 callback IDs from previous session.
// Callback functions need to be re-registered:
//   - tts_complete
//   - ui_update
//   - data_sync

// 重新注册所有回调
client.registerCallback('tts_complete', (message) => { /* ... */ });
client.registerCallback('ui_update', (message) => { /* ... */ });
client.registerCallback('data_sync', (message) => { /* ... */ });
```

### 架构优势

1. **统一管理**：所有事件回调在MCP表中注册，避免散乱
2. **轻量存储**：localStorage只存ID，不存数据/函数
3. **即时处理**：数据立即传递给回调，适合UI更新
4. **默认处理**：未注册回调时自动提示，便于调试
5. **向后兼容**：保留Promise API，支持两种使用方式

### 文件修改清单

**unified_rpc_client.js**：
- L131-141: 添加callbackRegistry和相关初始化
- L275-301: 修改消息处理，调用_executeCallback
- L353: call()方法接受callbackId参数
- L369-378: _callWebSocket存储callbackId而非route/params
- L701-744: 修改localStorage只存requestId+callbackId
- L760-894: 添加6个新方法（register/unregister/execute/default/save/load）

**修改统计**：
- 新增代码行数：约150行
- 修改现有代码：约30行
- 新增公共方法：6个

## 问题11: 前端debugger断点 ✅ 已排查
按F12会暂停在debugger - 已检查代码无debugger语句，为浏览器设置问题

## 问题12: WebSocket已连接但仍使用HTTP ✅ 需要澄清

**现象**：看到日志显示WebSocket已连接，但仍有HTTP请求
```
[UnifiedRpcClient] WebSocket connected
[HttpHandler] HTTP POST /rpc/status from 127.0.0.1
```

**原因分析**：
1. `/rpc/status` 是HTTP端点（unified_server.py:356），用于服务发现
2. 这不是通过 `client.call('status', ...)` 调用的RPC路由
3. 这是正常行为，不是问题

**HTTP端点（不走WebSocket）**：
- `GET /health` - 健康检查
- `POST /rpc/status` - 服务发现
- `GET /rpc/session/{session_id}` - 会话查询

**RPC路由（应走WebSocket）**：
- `clipboard_get` - 剪贴板操作
- `tts` - 语音合成
- 等其他业务路由

**验证方法**：
```javascript
// ✅ 这应该走WebSocket（如果WebSocket已连接）
await client.call('clipboard_get', {});

// ❌ 这是HTTP请求，不走WebSocket
await fetch('http://localhost:59000/rpc/status', { method: 'POST' });
```

## 相关文档
- `CLIENT_MANAGER_ANALYSIS.md` - 客户端管理机制全局分析
- `WEBSOCKET_FIXES_2025-11-18.md` - WebSocket通信修复详情
- `REQUEST_CALLBACK_SPEC.md` - 请求-回调机制规范
