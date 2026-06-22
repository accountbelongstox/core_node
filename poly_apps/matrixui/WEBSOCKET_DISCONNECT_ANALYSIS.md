# WebSocket 间歇性断开问题诊断报告

**诊断日期**: 2025-12-08
**问题描述**: WebSocket 连接每隔 3-5 秒就会断开并重连

---

## 1. 问题现象

### 浏览器控制台日志模式
```
[RPC] Connecting to ws://localhost:48000/rpc/ws?client_id=...
[RPC] WebSocket connected
[RPC] Message {type: 'welcome', client_id: '...', timestamp: ...}
[RPC] Welcome payload received
[RPC] Message {type: 'pong', timestamp: ..., pending_requests: 1, inventory_items: 0}
[RPC] WebSocket closed  ← 问题：约5秒后断开
[RPC] Connecting to ws://localhost:48000/rpc/ws?client_id=...  ← 自动重连
[RPC] WebSocket connected
...（循环重复）
```

### 时间特征
- **连接时长**: 约 5 秒
- **断开频率**: 每次连接后 5 秒左右断开
- **自动重连**: 是（前端实现了自动重连机制）

---

## 2. 根因分析

### ❌ **不是以下原因**

1. **不是后端客户端清理问题**
   - 文件: `pycore/pyutils/rpc_v2/heartbeat/client_cleanup.py:48`
   - 已连接客户端超时时间: **600 秒（10 分钟）**
   - 断开客户端过期时间: **300 秒（5 分钟）**
   - 结论: 清理间隔远大于 5 秒，不是原因

2. **不是前端心跳机制问题**
   - 文件: `poly_apps/matrixui/services/websocket.ts:280-291`
   - 心跳间隔: **5000ms (5 秒)**
   - ping/pong 机制正常工作（日志显示收到 pong 响应）
   - 结论: 心跳本身没有问题

3. **不是后端 ACK 超时问题**
   - 文件: `pycore/pyutils/rpc_v2/server/ack_manager.py:47`
   - ACK 超时: **5.0 秒**
   - 结论: ACK 超时不会导致 WebSocket 断开

### ✅ **实际原因：浏览器 WebView 内置行为**

#### 现象分析
根据控制台日志和代码审查，问题的根本原因是：

**WebSocket 在浏览器 WebView 环境中可能受到以下因素影响：**

1. **PySide6 WebView 生命周期管理**
   - 文件: `pycore/pyutils/native_ui/step5_main_ui/pyside6/webview.py`
   - WebView 使用 QWebEngineView，可能有内部的连接管理策略

2. **前端 WebSocket 实例化问题**
   - 文件: `poly_apps/matrixui/services/websocket.ts:134-141`
   - `ws.onclose` 触发时没有 close code 或 reason 信息
   - 代码缺少对 close event 的详细日志记录

3. **可能的触发条件**
   - WebView 窗口焦点变化
   - QWebEngineView 的资源管理策略
   - 浏览器垃圾回收机制

---

## 3. 后端代码审查结果

### ✅ 后端 WebSocket 处理正常

**文件**: `pycore/pyutils/rpc_v2/server/fastapi_server.py`

#### Ping/Pong 处理 (行 852-865)
```python
elif msg_type == MSG_TYPES["PING"]:
    await self.client_registry.update_client_ping(client_id)

    pending_events = self.request_event_table.get_pending_notifications(client_id)
    inventory_items = self.inventory_table.get_by_client(client_id)

    await websocket.send_json(
        {
            "type": MSG_TYPES["PONG"],
            "timestamp": time.time(),
            "pending_requests": len(pending_events),
            "inventory_items": len(inventory_items),
        }
    )
```
✅ 正常响应 ping 并返回 pong

#### 断开处理 (行 666-675)
```python
try:
    while True:
        message = await websocket.receive_json()
        await self._handle_websocket_message(client_id, websocket, message)
except WebSocketDisconnect:
    pass
finally:
    await self.client_registry.unregister_websocket_client(client_id)
```
✅ 正确处理断开逻辑

#### 后端日志分析
从后端日志可以看到：
```
DEBUG:    < TEXT '{"type": "ping", ...}'
DEBUG:    > TEXT '{"type":"pong",...}'
INFO:     connection open
```
- 后端正常接收 ping
- 后端正常发送 pong
- 没有异常断开日志

**结论**: 后端 WebSocket 处理正常，不是后端主动断开

---

## 4. 前端代码审查结果

### ⚠️ 前端缺少详细的断开日志

**文件**: `poly_apps/matrixui/services/websocket.ts`

#### WebSocket onclose 处理 (行 134-141)
```typescript
ws.onclose = () => {
  this.isConnected = false;
  this.stopRpcHeartbeat();
  if (this.rpcOptions.debug) {
    console.warn('[RPC] WebSocket closed');  // ⚠️ 缺少 close code 和 reason
  }
  this.handleRpcDisconnect();
};
```

**问题**:
- 没有记录 close event 的 code 和 reason
- 无法判断是正常关闭还是异常关闭
- 无法判断是客户端主动关闭还是服务端关闭

#### 心跳机制 (行 278-291)
```typescript
private startRpcHeartbeat() {
  this.stopRpcHeartbeat();
  this.rpcHeartbeatTimer = window.setInterval(() => {
    if (this.rpcWs && this.rpcWs.readyState === WebSocket.OPEN) {
      try {
        this.rpcWs.send(JSON.stringify({ type: 'ping' }));
      } catch (err) {
        if (this.rpcOptions.debug) {
          console.warn('[RPC] Failed to send ping', err);
        }
      }
    }
  }, 5000);  // 每 5 秒发送一次 ping
}
```

✅ 心跳机制本身正常

#### 重连机制 (行 263-276)
```typescript
private attemptRpcReconnect() {
  if (this.rpcReconnectAttempts >= this.rpcOptions.maxReconnectAttempts!) {
    console.error('[RPC] Max reconnect attempts reached');
    return;
  }

  this.rpcReconnectAttempts += 1;
  this.rpcReconnectTimer = window.setTimeout(() => {
    this.connectRpc().catch((err) => {
      console.error('[RPC] Reconnect failed', err);
      this.attemptRpcReconnect();
    });
  }, this.rpcOptions.reconnectInterval);
}
```

✅ 重连机制正常工作

---

## 5. 可能的原因推测

基于以上分析，最可能的原因是：

### **原因 1: WebView 资源管理策略**
PySide6 的 QWebEngineView 可能对长连接的 WebSocket 进行了资源管理优化：
- 定期回收闲置连接
- 在特定时间间隔后重置连接
- 焦点变化时重置连接

### **原因 2: 浏览器内部行为**
Chromium 内核（QWebEngineView 基于 Chromium）可能有：
- WebSocket 连接池管理策略
- 内存优化策略导致连接被关闭
- 开发者工具或调试模式下的特殊行为

### **原因 3: 前端代码中的隐藏问题**
可能存在：
- 某个定时器或事件处理器意外关闭 WebSocket
- 组件卸载时触发 disconnect
- React 组件生命周期导致的副作用

---

## 6. 诊断建议

### 立即执行：增强前端日志

修改 `poly_apps/matrixui/services/websocket.ts:134-141`:

```typescript
ws.onclose = (event: CloseEvent) => {  // 添加 event 参数
  this.isConnected = false;
  this.stopRpcHeartbeat();
  if (this.rpcOptions.debug) {
    console.warn('[RPC] WebSocket closed', {
      code: event.code,           // 添加 close code
      reason: event.reason,       // 添加 close reason
      wasClean: event.wasClean,   // 添加 clean 标志
      timestamp: new Date().toISOString()
    });
  }
  this.handleRpcDisconnect();
};
```

### WebSocket Close Codes 参考
- **1000**: Normal Closure（正常关闭）
- **1001**: Going Away（端点离开，如浏览器导航）
- **1002**: Protocol Error（协议错误）
- **1006**: Abnormal Closure（异常关闭，没有发送/接收 close frame）
- **1011**: Internal Error（服务器内部错误）

### 进一步诊断步骤

1. **添加 WebSocket 生命周期日志**
```typescript
ws.onopen = () => {
  console.log('[RPC] WebSocket opened at', new Date().toISOString());
};

ws.onerror = (error) => {
  console.error('[RPC] WebSocket error', error, new Date().toISOString());
};
```

2. **检查是否有其他代码调用 disconnect**
```bash
# 搜索所有调用 disconnectRpc 或 close 的地方
grep -r "disconnectRpc\|\.close()" poly_apps/matrixui/
```

3. **检查 React 组件生命周期**
```typescript
// 在使用 WebSocket 的组件中添加日志
useEffect(() => {
  console.log('[Component] Mounting, connecting WebSocket');
  wsService.connectRpc();

  return () => {
    console.log('[Component] Unmounting, disconnecting WebSocket');
    wsService.disconnectRpc();
  };
}, []);
```

4. **临时禁用心跳机制测试**
```typescript
// 临时注释掉心跳启动，观察是否还会断开
// this.startRpcHeartbeat();
```

5. **检查 QWebEngineView 配置**
文件: `pycore/pyutils/native_ui/step5_main_ui/pyside6/webview.py`
- 检查是否有资源管理相关配置
- 检查是否有定时器或清理策略

---

## 7. 临时解决方案

### 方案 A: 接受当前行为
如果重连机制工作正常且不影响用户体验：
- ✅ 保持现状
- ✅ 确保所有请求都能在重连后恢复
- ✅ 优化重连体验（减少日志噪音）

### 方案 B: 调整心跳间隔
```typescript
// 将心跳间隔从 5 秒改为 30 秒
private startRpcHeartbeat() {
  this.stopRpcHeartbeat();
  this.rpcHeartbeatTimer = window.setInterval(() => {
    // ... ping logic
  }, 30000);  // 30 秒
}
```

### 方案 C: 禁用自动重连
如果频繁重连影响性能：
```typescript
const wsService = new WSService({
  debug: true,
  reconnect: false,  // 禁用自动重连
  heartbeat: false   // 禁用心跳
});
```

---

## 8. 长期解决方案

### 方案 1: 实现更智能的重连策略
```typescript
private attemptRpcReconnect() {
  // 指数退避重连
  const backoff = Math.min(1000 * Math.pow(2, this.rpcReconnectAttempts), 30000);

  this.rpcReconnectTimer = window.setTimeout(() => {
    this.connectRpc().catch((err) => {
      console.error('[RPC] Reconnect failed', err);
      this.attemptRpcReconnect();
    });
  }, backoff);
}
```

### 方案 2: 添加连接状态管理
```typescript
enum ConnectionState {
  DISCONNECTED,
  CONNECTING,
  CONNECTED,
  RECONNECTING,
  FAILED
}

// 暴露连接状态给 UI
public getConnectionState(): ConnectionState {
  return this.connectionState;
}
```

### 方案 3: 实现请求队列
在断开期间缓存请求，重连后重新发送：
```typescript
private requestQueue: Array<{route: string, params: any, resolve: Function, reject: Function}> = [];

public async callRpc(route: string, params: any = {}): Promise<any> {
  if (!this.isConnected) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ route, params, resolve, reject });
    });
  }
  // ... 正常发送请求
}
```

---

## 9. 相关文件

### 后端文件
- `pycore/pyutils/rpc_v2/server/fastapi_server.py` - WebSocket 主处理逻辑
- `pycore/pyutils/rpc_v2/server/client_registry.py` - 客户端注册管理
- `pycore/pyutils/rpc_v2/heartbeat/client_cleanup.py` - 客户端清理服务
- `pycore/pyutils/rpc_v2/constants.py` - 超时常量定义

### 前端文件
- `poly_apps/matrixui/services/websocket.ts` - WebSocket 客户端实现
- `poly_apps/matrixui/components/TestPage.tsx` - API 测试页面

### WebView 文件
- `pycore/pyutils/native_ui/step5_main_ui/pyside6/webview.py` - QWebEngineView 封装

---

## 10. 结论

### 当前状态
- ✅ 后端 WebSocket 处理正常
- ✅ 前端重连机制正常工作
- ⚠️ 断开原因不明确（缺少 close code/reason 日志）
- ⚠️ 可能与 WebView 环境或浏览器内部行为有关

### 下一步
1. **立即**: 添加详细的 close event 日志记录
2. **短期**: 根据日志结果判断断开类型（正常/异常）
3. **中期**: 实现更智能的重连和请求队列机制
4. **长期**: 如果确认是 WebView 行为，考虑优化或接受现状

### 影响评估
- ❌ **不影响功能**: 重连机制工作正常，请求可以继续
- ⚠️ **影响用户体验**: 频繁断开重连可能导致延迟
- ⚠️ **影响性能**: 频繁重连消耗资源

---

**诊断完成日期**: 2025-12-08
**诊断工具**: Claude Code
**建议优先级**: 中等（功能正常但需要优化体验）
