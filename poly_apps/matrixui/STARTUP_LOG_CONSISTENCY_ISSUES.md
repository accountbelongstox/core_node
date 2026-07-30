# 启动日志逻辑一致性问题分析

**分析日期**: 2025-12-08
**问题**: 启动日志中存在多处逻辑不一致和时序混乱的警告信息

---

## 1. 问题总结

从启动日志中识别出以下逻辑不一致的黄色警告信息：

1. ❌ **"ADB heartbeat thread not available, device push service not started"** - 时序问题
2. ⚠️ **"No static mount from frontend (dev mode or not ready)"** - 描述不准确
3. ⚠️ **"frontend.ready received - will close debug window when it becomes available"** - 描述不清晰
4. ✅ **"No timeout set - will wait indefinitely..."** - 正确的警告信息

---

## 2. 问题 1: ADB Heartbeat 时序不一致 ❌

### 问题表现

```
[Matrix API] All RPC v2 routes registered successfully
======================================================================
[Matrix] Warning: ADB heartbeat thread not available, device push service not started
[rpc_v2] Initialization callback completed
...
(几十行日志后)
...
[Matrix] Starting ADB Device Management Heartbeat...
[ADBHeartbeat] Started (tick=1.0s)
[Matrix] ADB Heartbeat Thread started
```

**矛盾**:
- 第一次说 "ADB heartbeat thread not available"
- 几十行后成功启动了 ADB heartbeat

### 根本原因

**文件**: `pyapps/matrix/matrix_main.py`

#### 时序分析

1. **Phase 4.7**: RPC v2 启动
   ```python
   # launch_native_app.py:413
   'init_callback': config.rpc_init_callback  # 调用 rpc_init_callback
   ```

2. **rpc_init_callback 执行** (matrix_main.py:88-123)
   ```python
   def rpc_init_callback(rpc_server):
       register_all_routes(rpc_server)

       # ❌ 此时检查 _adb_heartbeat_thread
       if _adb_heartbeat_thread:
           # 启动 device push service
           ...
       else:
           ColorPrint.yellow("[Matrix] Warning: ADB heartbeat thread not available...")  # 行 123
   ```

3. **Phase 6-7**: 调用 main_entry
   ```python
   # launch_native_app.py:236
   if config.main_entry:
       config.main_entry()  # 调用 matrix_main_entry
   ```

4. **matrix_main_entry 执行** (matrix_main.py:34-65)
   ```python
   def matrix_main_entry():
       global _adb_heartbeat_thread

       # ✅ 在这里才启动 ADB heartbeat
       ColorPrint.blue("[Matrix] Starting ADB Device Management Heartbeat...")  # 行 55
       _adb_heartbeat_thread = ADBHeartbeatThread(...)
       _adb_heartbeat_thread.start()
   ```

### 问题本质

**检查时机过早**: 在 RPC v2 初始化回调中检查 ADB heartbeat，但此时 ADB heartbeat 还没有启动（要等到 main_entry 才启动）。

### 影响

- ❌ **功能影响**: Device Push Service 没有启动（WebSocket 设备列表推送功能失效）
- ⚠️ **日志混乱**: 用户看到"不可用"的警告，但后面又显示成功启动

### 修复方案

#### 方案 A: 在 main_entry 中初始化 Device Push Service（推荐）

**修改文件**: `pyapps/matrix/matrix_main.py`

```python
def matrix_main_entry():
    """Matrix main entry point (called after native_ui initialization)"""
    global _adb_heartbeat_thread

    from pyapps.matrix.controller.event_handlers import register_matrix_event_handlers
    from pyapps.matrix.adb_device_manager.device_push_service import init_device_push_service, stop_device_push_service
    from pycore.pyutils.rpc_v2.service_launcher import get_rpc_server  # 获取 RPC 服务器实例

    # Register Matrix event handlers
    register_matrix_event_handlers(...)
    ColorPrint.green("[Matrix] Event handlers registered successfully")

    # Start ADB Device Management Heartbeat
    ColorPrint.blue("[Matrix] Starting ADB Device Management Heartbeat...")
    _adb_heartbeat_thread = ADBHeartbeatThread(...)
    _adb_heartbeat_thread.start()
    ColorPrint.green("[Matrix] ADB Heartbeat Thread started")
    ColorPrint.blue("[Matrix] ADB Device Manager initialized")

    # ✅ 在这里初始化 Device Push Service
    rpc_server = get_rpc_server()  # 获取已启动的 RPC 服务器
    if rpc_server and _adb_heartbeat_thread:
        ColorPrint.blue("[Matrix] Starting Device Push Service...")
        device_push_service = init_device_push_service(
            adb_heartbeat_thread=_adb_heartbeat_thread,
            rpc_server=rpc_server,
            push_interval=10.0
        )
        ColorPrint.green(f"[Matrix] Device Push Service started (interval: 10.0s)")

        # Register shutdown handler
        def stop_device_push():
            ColorPrint.blue("[Matrix] Stopping Device Push Service...")
            stop_device_push_service()
            ColorPrint.green("[Matrix] Device Push Service stopped")

        THREAD_BUS.register_shutdown_handler(
            handler=stop_device_push,
            priority=85,
            name="device_push_service"
        )
    else:
        ColorPrint.yellow("[Matrix] Warning: Cannot start device push service (RPC server not available)")


def rpc_init_callback(rpc_server):
    """RPC v2 initialization callback - only register routes"""
    from pyapps.matrix.api.main import register_all_routes

    # ✅ 只注册路由，不检查 ADB heartbeat
    register_all_routes(rpc_server)
    # ❌ 删除这里的 device push service 初始化代码
```

#### 方案 B: 延迟初始化 Device Push Service

使用 THREAD_BUS 事件机制，在 ADB heartbeat 启动后再初始化 device push service：

```python
# In matrix_main_entry():
def matrix_main_entry():
    ...
    _adb_heartbeat_thread.start()

    # 触发事件通知 ADB heartbeat 已就绪
    THREAD_BUS.trigger_event('adb.heartbeat.ready', {
        'thread': _adb_heartbeat_thread
    })

# In rpc_init_callback():
def rpc_init_callback(rpc_server):
    register_all_routes(rpc_server)

    # 监听 ADB heartbeat 就绪事件
    def on_adb_ready(data):
        adb_thread = data.get('thread')
        if adb_thread:
            init_device_push_service(adb_thread, rpc_server, 10.0)

    THREAD_BUS.on('adb.heartbeat.ready', on_adb_ready)
```

---

## 3. 问题 2: Frontend Static Mount 描述不准确 ⚠️

### 问题表现

```
[FrontendThread] Frontend ready at http://localhost:38007
[Frontend] FRONTEND READY
...
[NativeLauncher] No static mount from frontend (dev mode or not ready)
```

**矛盾**:
- Frontend 已经显示 "FRONTEND READY"
- 但日志还说 "(dev mode or not ready)"

### 根本原因

**文件**: `pycore/pyutils/native_ui/step3_launcher/launch_native_app.py:403`

```python
elif config.debug:
    ColorPrint.yellow("[NativeLauncher] No static mount from frontend (dev mode or not ready)")
```

### 问题分析

- Frontend 确实已经 ready
- Dev 模式下确实没有 static mount（因为使用的是 dev server）
- 但 "or not ready" 这部分描述不准确，容易误导

### 修复方案

```python
# pycore/pyutils/native_ui/step3_launcher/launch_native_app.py:402-403

elif config.debug:
    if config.frontend_mode == "dev":
        ColorPrint.yellow("[NativeLauncher] No static mount from frontend (using dev server)")
    else:
        ColorPrint.yellow("[NativeLauncher] No static mount from frontend (not ready yet)")
```

---

## 4. 问题 3: Debug Window 可用性描述不清晰 ⚠️

### 问题表现

```
[FrontendThread] Frontend ready at http://localhost:38007
...
[NativeLauncher] frontend.ready received - will close debug window when it becomes available
```

**混淆**:
- Frontend 已经 ready
- 但说 "when it becomes available" (当它变为可用时)

### 根本原因

**文件**: `pycore/pyutils/native_ui/step3_launcher/launch_native_app.py:114-117`

```python
thread = startup_thread_ref['thread']
if thread is None:
    if config.debug:
        ColorPrint.yellow("[NativeLauncher] frontend.ready received - will close debug window when it becomes available")
    return
```

### 问题分析

- 这里的 "when it becomes available" 指的是 **startup_thread 对象**，而不是 frontend
- Frontend 确实已经 ready
- 但 startup_thread 的 thread 对象还没有设置到 startup_thread_ref 中
- 消息描述不够清晰，容易让人误解是在等 frontend

### 修复方案

```python
# pycore/pyutils/native_ui/step3_launcher/launch_native_app.py:114-117

thread = startup_thread_ref['thread']
if thread is None:
    if config.debug:
        ColorPrint.yellow("[NativeLauncher] frontend.ready received - debug window thread not available yet, will close when thread is ready")
    return
```

或者更简洁：

```python
if thread is None:
    if config.debug:
        ColorPrint.yellow("[NativeLauncher] frontend.ready received - waiting for startup window thread")
    return
```

---

## 5. 问题 4: Frontend 等待超时警告 ✅

### 日志信息

```
[FrontendThread] Waiting for frontend at http://localhost:38007/
[FrontendThread] No timeout set - will wait indefinitely...
```

### 分析

**文件**: `pycore/pyutils/native_ui/step9_frontend/frontend_thread.py:481`

```python
ColorPrint.yellow(f"[FrontendThread] No timeout set - will wait indefinitely...")
```

### 结论

✅ **这个警告是正确的**，有意为之：
- 明确告知用户没有设置超时
- 提醒用户如果 frontend 启动失败，程序会一直等待
- 这是一个有用的提示信息，不需要修改

---

## 6. 修复优先级

### 高优先级 🔴

1. **ADB Heartbeat 时序问题** (问题 1)
   - **影响**: Device Push Service 没有启动，WebSocket 设备列表推送功能失效
   - **建议**: 立即修复，使用方案 A（在 main_entry 中初始化）

### 中优先级 🟡

2. **Frontend Static Mount 描述** (问题 2)
   - **影响**: 日志误导性描述
   - **建议**: 改进描述准确性

3. **Debug Window 可用性描述** (问题 3)
   - **影响**: 日志描述不清晰
   - **建议**: 改进描述清晰度

### 无需修改 ✅

4. **Frontend 等待超时警告** (问题 4)
   - **影响**: 无
   - **结论**: 正确的警告信息

---

## 7. 完整修复代码

### 文件 1: `pyapps/matrix/matrix_main.py`

#### 修改 matrix_main_entry (添加 Device Push Service 初始化)

```python
def matrix_main_entry():
    """Matrix main entry point (called after native_ui initialization)"""
    global _adb_heartbeat_thread

    from pyapps.matrix.controller.event_handlers import register_matrix_event_handlers
    from pyapps.matrix.adb_device_manager.device_push_service import init_device_push_service, stop_device_push_service

    # Register Matrix event handlers
    register_matrix_event_handlers(
        frontend_port=Config.FRONTEND_PORT,
        backend_port=Config.WEB_PORT,
        backend_host=Config.WEB_HOST,
        frontend_mode=Config.FRONTEND_MODE
    )
    ColorPrint.green("[Matrix] Event handlers registered successfully")

    # Start ADB Device Management Heartbeat
    ColorPrint.blue("[Matrix] Starting ADB Device Management Heartbeat...")
    _adb_heartbeat_thread = ADBHeartbeatThread(
        adb_path="adb",
        tick_interval=1.0,
        network_scan_interval=30.0,
        usb_scan_interval=5.0,
        cleanup_interval=60.0,
        heartbeat_interval=10.0,
        daemon=True
    )
    _adb_heartbeat_thread.start()
    ColorPrint.green("[Matrix] ADB Heartbeat Thread started")
    ColorPrint.blue("[Matrix] ADB Device Manager initialized")

    # ✅ 新增: 初始化 Device Push Service
    from pycore.pyutils.rpc_v2.service_launcher import get_rpc_server

    rpc_server = get_rpc_server()
    if rpc_server and _adb_heartbeat_thread:
        ColorPrint.blue("[Matrix] Starting Device Push Service...")
        device_push_service = init_device_push_service(
            adb_heartbeat_thread=_adb_heartbeat_thread,
            rpc_server=rpc_server,
            push_interval=10.0
        )
        ColorPrint.green(f"[Matrix] Device Push Service started (interval: 10.0s)")

        # Register shutdown handler
        def stop_device_push():
            ColorPrint.blue("[Matrix] Stopping Device Push Service...")
            stop_device_push_service()
            ColorPrint.green("[Matrix] Device Push Service stopped")

        THREAD_BUS.register_shutdown_handler(
            handler=stop_device_push,
            priority=85,
            name="device_push_service"
        )
    else:
        ColorPrint.yellow("[Matrix] Warning: Cannot start device push service (RPC server not available)")
```

#### 修改 rpc_init_callback (移除 Device Push Service 初始化)

```python
def rpc_init_callback(rpc_server):
    """
    RPC v2 initialization callback

    Called by RPC v2 server after it starts.
    It registers all Matrix routes to the RPC v2 server instance.

    Args:
        rpc_server: RPC v2 server instance (RpcServer)
    """
    from pyapps.matrix.api.main import register_all_routes

    # Register all Matrix RPC v2 routes
    register_all_routes(rpc_server)

    # ❌ 删除: 不在这里初始化 Device Push Service（移到 matrix_main_entry）
    # Device Push Service 会在 matrix_main_entry() 中初始化，
    # 确保 ADB heartbeat 已经启动
```

### 文件 2: `pycore/pyutils/native_ui/step3_launcher/launch_native_app.py`

#### 修改 No static mount 警告 (行 402-403)

```python
# 行 402-403
elif config.debug:
    if config.frontend_mode == "dev":
        ColorPrint.yellow("[NativeLauncher] No static mount from frontend (using dev server)")
    else:
        ColorPrint.yellow("[NativeLauncher] No static mount from frontend (not ready yet)")
```

#### 修改 Debug window 可用性警告 (行 116)

```python
# 行 116
ColorPrint.yellow("[NativeLauncher] frontend.ready received - waiting for startup window thread")
```

---

## 8. 验证步骤

### 步骤 1: 应用修复
```bash
# 应用上述修复代码
```

### 步骤 2: 重启应用
```bash
python .\pymain.py app=matrix
```

### 步骤 3: 检查日志

期望看到的日志顺序：

```
[Matrix API] All RPC v2 routes registered successfully
======================================================================
[rpc_v2] Initialization callback completed          # ✅ 没有 ADB 警告
...
[Matrix] Starting ADB Device Management Heartbeat...
[ADBHeartbeat] Started (tick=1.0s)
[Matrix] ADB Heartbeat Thread started
[Matrix] Starting Device Push Service...            # ✅ 成功启动
[Matrix] Device Push Service started (interval: 10.0s)
```

### 步骤 4: 测试 Device Push Service

```javascript
// 在浏览器控制台测试
const wsService = window.wsService;

// 监听设备更新事件
wsService.onRpcEvent('adb.devices.update', (data) => {
    console.log('[DevicePush] Received device update:', data);
});

// 应该每 10 秒收到一次设备列表推送
```

---

## 9. 相关文件清单

### 需要修改的文件

1. **pyapps/matrix/matrix_main.py**
   - 函数: `matrix_main_entry()` - 添加 Device Push Service 初始化
   - 函数: `rpc_init_callback()` - 移除 Device Push Service 初始化

2. **pycore/pyutils/native_ui/step3_launcher/launch_native_app.py**
   - 行 402-403: 改进 static mount 警告描述
   - 行 116: 改进 debug window 警告描述

### 需要检查的工具函数

可能需要添加：
- **pycore/pyutils/rpc_v2/service_launcher.py**
  - 函数: `get_rpc_server()` - 获取已启动的 RPC 服务器实例

---

## 10. 总结

### 核心问题

**时序不一致**: RPC v2 初始化时检查依赖服务（ADB heartbeat），但依赖服务在更后面才启动。

### 根本原因

启动流程设计不合理：
1. Phase 4.7: RPC v2 启动 → 调用 rpc_init_callback
2. Phase 6-7: 调用 main_entry → 启动 ADB heartbeat

### 解决方案

**重新组织初始化顺序**:
- rpc_init_callback: 只注册路由
- matrix_main_entry: 启动 ADB heartbeat + 初始化 Device Push Service

### 预期效果

- ✅ 消除日志中的逻辑矛盾
- ✅ Device Push Service 正常启动
- ✅ WebSocket 设备列表推送功能正常工作
- ✅ 日志描述更准确清晰

---

**分析完成日期**: 2025-12-08
**修复建议**: 高优先级 - 立即修复 ADB Heartbeat 时序问题
