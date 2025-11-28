# Platform Launcher Architecture - 架构文档

## 📋 Architecture Overview - 架构概览

```
pycore_module_caller.py
    ↓
launch_platform_aware() [pycore/callmodule/platform/launcher.py]
    ↓
ServiceLauncher [pycore/pylauncher/launcher.py]
    ↓ (Singleton Detection)
SingletonDetector [pycore/pylauncher/singleton_detector.py]
    ↓ (State Check via THREAD_BUS)
THREAD_BUS [pycore/pyfoundations/thread_bus.py]
    ↓ (If singleton OK)
Platform-Specific UI:
    - Windows: launch_windows_tray() [pycore/callmodule/platform/windows_tray.py]
    - Linux: launch_linux_service() [pycore/callmodule/platform/linux_service.py]
```

---

## 🎯 Design Principles - 设计原则

### 1. Single Responsibility - 单一职责

每个组件只负责一件事：

- **`launch_platform_aware()`**: 平台检测和启动流程协调
- **`ServiceLauncher`**: 单例检测和服务生命周期管理
- **`SingletonDetector`**: 单例协议通信
- **`THREAD_BUS`**: 全局状态管理（busy/idle）
- **`windows_tray.py` / `linux_service.py`**: 平台特定的 UI 和 RPC 服务器

### 2. No Redundancy - 避免冗余

**CRITICAL**: 单例检测逻辑**只存在于一个地方**：
- ✅ `ServiceLauncher` 内部调用 `SingletonDetector`
- ❌ **不要**在 `launch_platform_aware()` 中重复实现单例检测
- ❌ **不要**在 `windows_tray.py` 中重复实现单例检测
- ❌ **不要**在 `linux_service.py` 中重复实现单例检测

### 3. Parameter Passing - 参数传递

通过参数传递结果，而不是在多个文件中重复判断：

```python
# ✅ 正确：通过参数传递
launcher = ServiceLauncher(config)
launcher.start()  # 内部处理单例
singleton_port = launcher.detection_result.port
launch_windows_tray(launcher=launcher, singleton_port=singleton_port)

# ❌ 错误：在多个文件中重复判断
# 不要在 windows_tray.py 中再次调用 SingletonDetector.detect_and_bind()
```

---

## 📁 Component Details - 组件详情

### 1. `launch_platform_aware()` - 平台感知启动器

**Location**: `pycore/callmodule/platform/launcher.py`

**Responsibility**:
- 创建 `ServiceLauncher` 配置
- 调用 `ServiceLauncher.start()` 进行单例检测
- 根据平台启动对应的 UI

**Key Code**:
```python
def launch_platform_aware(host='0.0.0.0', port=59000, debug=False):
    # 1. 创建配置
    config = LauncherConfig(
        app_id="pycore_module_caller",
        singleton=True,              # 启用单例检测
        shutdown_existing=True,      # 尝试替换 idle 实例
        services={'heartbeat': {}}
    )

    # 2. 启动 ServiceLauncher（处理单例检测）
    launcher = ServiceLauncher(config)
    if not launcher.start():
        return  # 单例冲突，退出

    # 3. 获取单例信息
    singleton_port = launcher.detection_result.port

    # 4. 启动平台特定 UI
    if IS_WINDOWS:
        launch_windows_tray(launcher=launcher, singleton_port=singleton_port)
    else:
        launch_linux_service(launcher=launcher, singleton_port=singleton_port)
```

**What it DOES NOT do**:
- ❌ 不执行单例检测（由 ServiceLauncher 负责）
- ❌ 不处理单例协议通信（由 SingletonDetector 负责）
- ❌ 不管理 busy 状态（由 THREAD_BUS 负责）

---

### 2. `ServiceLauncher` - 服务启动器

**Location**: `pycore/pylauncher/launcher.py`

**Responsibility**:
- **单例检测**（通过 `SingletonDetector`）
- 服务生命周期管理（heartbeat, rpc_v2 等）
- 保存检测结果（`detection_result`）

**Key Code**:
```python
class ServiceLauncher:
    def __init__(self, config: LauncherConfig):
        self.singleton_detector = None
        self.detection_result = None  # 保存检测结果

    def _singleton_detect(self) -> bool:
        # 1. 定义 state_checker（检查 THREAD_BUS 的 busy 状态）
        def state_checker():
            is_busy = THREAD_BUS.is_busy()
            return {
                'can_shutdown': not is_busy,
                'message': THREAD_BUS.get_busy_reason() if is_busy else 'Ready'
            }

        # 2. 创建并绑定 SingletonDetector
        self.singleton_detector, detection = self._create_singleton_detector(
            on_msg, state_checker
        )

        # 3. 如果发现旧实例，尝试协商关闭
        if detection.existing_instance and self.config.shutdown_existing:
            success = self.singleton_detector.send_shutdown_to_existing(...)
            if success:
                # 重试检测
                self.singleton_detector, detection = self._create_singleton_detector(...)

        # 4. 保存结果
        self.detection_result = detection
        return detection.is_primary
```

**Integration Points**:
- **Input**: `LauncherConfig` (配置单例行为)
- **Output**: `detection_result` (单例检测结果)
- **Dependencies**:
  - `SingletonDetector` (单例协议通信)
  - `THREAD_BUS` (状态查询)

---

### 3. `SingletonDetector` - 单例检测器

**Location**: `pycore/pylauncher/singleton_detector.py`

**Responsibility**:
- 端口扫描和绑定
- 单例协议通信（CHECK, ALIVE, SHUTDOWN, etc.）
- 监听和处理来自新实例的请求

**Protocol**:
```
New Instance                Old Instance (PRIMARY)
     │                              │
     ├──── CHECK message ──────→   │
     │                              │
     │   ←──── ALIVE ────────────   │
     │                              │
     │                         Check state_checker()
     │                         THREAD_BUS.is_busy()?
     │                              │
     ├──── SHUTDOWN ──────────→    │
     │                              │
     │                         if busy:
     │   ←── REJECTED ────────     拒绝
     │   (busy reason)              │
     │                         else:
     │   ←── ACCEPTED ────────     接受 + 发送 THREAD_BUS.request_shutdown()
     │                              │
     ▼                              ▼
   Exit                         Shutdown
```

**Key Mechanism**:
```python
class SingletonDetector:
    def __init__(self, state_checker: Optional[Callable[[], Dict]] = None):
        self.state_checker = state_checker  # 回调函数

    def _handle_client(self, client_socket, address):
        if msg_type == MessageType.SHUTDOWN.value:
            can_shutdown = True
            if self.state_checker:
                # 调用 state_checker 检查是否可以关闭
                app_state = self.state_checker()
                can_shutdown = app_state.get("can_shutdown", True)
                message = app_state.get("message", "")

            if can_shutdown:
                # 接受关闭请求
                self._send_response(..., MessageType.SHUTDOWN_ACK, status="accepted")
                # 触发关闭（通过回调）
                if self.on_message:
                    self.on_message({'type': 'SHUTDOWN', 'pid': ...})
            else:
                # 拒绝关闭请求
                self._send_response(..., MessageType.SHUTDOWN_ACK, status="rejected", reason=message)
```

---

### 4. `THREAD_BUS` - 全局状态管理

**Location**: `pycore/pyfoundations/thread_bus.py`

**Responsibility**:
- 管理全局 busy/idle 状态
- 提供线程安全的状态查询 API
- 处理 shutdown 请求

**API**:
```python
class ThreadBus:
    def set_busy(self, busy: bool, reason: str = "") -> None:
        """设置 busy 状态"""
        self.set_thread_state('app', 'busy' if busy else 'idle', reason=reason)

    def is_busy(self) -> bool:
        """查询是否 busy"""
        state = self.get_thread_state('app')
        return state is not None and state.get('state') == 'busy'

    def get_busy_reason(self) -> Optional[str]:
        """获取 busy 原因"""
        state = self.get_thread_state('app')
        if state and state.get('state') == 'busy':
            return state.get('reason', '')
        return None

    def request_shutdown(self, reason: str, execute_handlers: bool = True) -> None:
        """请求关闭（触发所有 shutdown handlers）"""
        # 执行所有注册的 shutdown handlers
        # 由各组件自行清理资源
```

**Usage in Tasks**:
```python
from pycore import THREAD_BUS

def process_important_task(data):
    # ✅ 正确：使用 try-finally
    THREAD_BUS.set_busy(True, "Processing critical task")
    try:
        do_work(data)
    finally:
        THREAD_BUS.set_busy(False)  # 总是清除

# ❌ 错误：异常时不会清除
def bad_example(data):
    THREAD_BUS.set_busy(True, "Processing")
    do_work(data)  # 如果抛异常，busy 不会清除！
    THREAD_BUS.set_busy(False)
```

---

### 5. `windows_tray.py` - Windows 托盘模式

**Location**: `pycore/callmodule/platform/windows_tray.py`

**Responsibility**:
- 启动 RPC v2 服务器（FastAPI）
- 创建系统托盘图标和菜单
- 处理 UI 事件（打开 Web 界面、重启、退出）

**Signature**:
```python
def launch_windows_tray(
    host='0.0.0.0',
    port=59000,
    debug=False,
    launcher=None,         # ServiceLauncher 实例
    singleton_port=None    # 单例端口（用于显示）
):
    """
    Launch RPC v2 server with Windows system tray.

    IMPORTANT:
    - This function does NOT perform singleton detection
    - Singleton is handled by ServiceLauncher BEFORE calling this
    """
```

**What it DOES**:
- ✅ 启动 FastAPI RPC v2 服务器
- ✅ 注册路由（MCP, singleton, homepage）
- ✅ 创建系统托盘
- ✅ 通过 `launcher.stop()` 清理资源

**What it DOES NOT do**:
- ❌ 不执行单例检测
- ❌ 不调用 `SingletonDetector`
- ❌ 不管理 busy 状态（任务类负责）

---

### 6. `linux_service.py` - Linux 服务模式

**Location**: `pycore/callmodule/platform/linux_service.py`

**Responsibility**:
- 启动 RPC v2 服务器（FastAPI）
- 在前台运行（适合 systemd）

**Signature**:
```python
def launch_linux_service(
    host='0.0.0.0',
    port=59000,
    debug=False,
    launcher=None,         # ServiceLauncher 实例
    singleton_port=None    # 单例端口（用于日志）
):
    """
    Launch RPC v2 server in Linux service mode.

    IMPORTANT:
    - This function does NOT perform singleton detection
    - Singleton is handled by ServiceLauncher BEFORE calling this
    """
```

---

## 🔄 Complete Flow - 完整流程

### Scenario 1: First Instance Startup - 首次启动

```
1. pycore_module_caller.py
2. launch_platform_aware()
3. ServiceLauncher(config)
4. ServiceLauncher.start()
   ├─ _singleton_detect()
   │  ├─ SingletonDetector.detect_and_bind()
   │  │  ├─ 扫描端口 59100-59199
   │  │  ├─ 绑定到 59100
   │  │  └─ 返回 DetectionResult(is_primary=True, port=59100)
   │  └─ 保存 detection_result
   └─ 启动 heartbeat 服务
5. launch_windows_tray(launcher, singleton_port=59100)
   ├─ 启动 RPC v2 服务器（端口 59000）
   ├─ 注册路由
   └─ 启动系统托盘
```

### Scenario 2: Second Instance (Idle Replacement) - 第二个实例（闲置替换）

```
1. pycore_module_caller.py (新实例)
2. launch_platform_aware()
3. ServiceLauncher.start()
   ├─ _singleton_detect()
   │  ├─ SingletonDetector.detect_and_bind()
   │  │  ├─ 扫描到端口 59100 有旧实例
   │  │  ├─ 发送 CHECK → 收到 ALIVE
   │  │  └─ 返回 DetectionResult(is_primary=False, existing_port=59100)
   │  │
   │  ├─ shutdown_existing=True，尝试协商关闭
   │  ├─ send_shutdown_to_existing(59100)
   │  │  ├─ 发送 SHUTDOWN 请求
   │  │  ├─ 旧实例检查 state_checker()
   │  │  │  └─ THREAD_BUS.is_busy() → False (idle)
   │  │  ├─ 旧实例回复 SHUTDOWN_ACK (accepted)
   │  │  ├─ 旧实例执行 THREAD_BUS.request_shutdown()
   │  │  └─ 旧实例关闭
   │  │
   │  ├─ 重试检测
   │  ├─ SingletonDetector.detect_and_bind()
   │  │  ├─ 扫描到端口 59100 空闲
   │  │  ├─ 绑定到 59100
   │  │  └─ 返回 DetectionResult(is_primary=True, port=59100)
   │  └─ 成为 PRIMARY
   │
   └─ 启动服务
4. launch_windows_tray(...)  # 新实例的 tray
```

### Scenario 3: Second Instance (Busy Rejection) - 第二个实例（忙碌拒绝）

```
1. pycore_module_caller.py (新实例)
2. ServiceLauncher.start()
   ├─ _singleton_detect()
   │  ├─ 发现旧实例在 59100
   │  ├─ send_shutdown_to_existing(59100)
   │  │  ├─ 发送 SHUTDOWN 请求
   │  │  ├─ 旧实例检查 state_checker()
   │  │  │  └─ THREAD_BUS.is_busy() → True (处理关键任务)
   │  │  ├─ 旧实例回复 SHUTDOWN_ACK (rejected, reason="Processing critical task")
   │  │  └─ 返回 False
   │  └─ 返回 False（单例检测失败）
   └─ ServiceLauncher.start() 返回 False
3. launch_platform_aware() 检查 success=False
4. 退出（不启动 tray）
```

---

## 🧪 Testing - 测试

### Test 1: Idle Replacement - 闲置替换

```bash
# 终端 1：启动第一个实例
python pycore_module_caller.py

# 终端 2：启动第二个实例（应该成功替换）
python pycore_module_caller.py

# 预期结果：
# - 第二个实例检测到旧实例
# - 请求旧实例关闭
# - 旧实例 idle，接受关闭
# - 第二个实例成为 PRIMARY
# - 第一个实例退出
```

### Test 2: Busy Rejection - 忙碌拒绝

```bash
# 终端 1：启动第一个实例
python pycore_module_caller.py

# 终端 2：设置 busy 状态
curl -X POST http://localhost:59000/singleton/set_busy \
  -H "Content-Type: application/json" \
  -d '{"busy": true, "reason": "Processing critical task"}'

# 终端 3：启动第二个实例（应该被拒绝）
python pycore_module_caller.py

# 预期结果：
# - 第二个实例检测到旧实例
# - 请求旧实例关闭
# - 旧实例 busy，拒绝关闭
# - 第二个实例退出
# - 第一个实例继续运行
```

### Test 3: HTTP API - HTTP API 测试

```bash
# 查询状态
curl -X POST http://localhost:59000/singleton/status

# 设置 busy
curl -X POST http://localhost:59000/singleton/set_busy \
  -H "Content-Type: application/json" \
  -d '{"busy": true, "reason": "Testing"}'

# 请求关闭
curl -X POST http://localhost:59000/singleton/shutdown
```

---

## ✅ Checklist - 检查清单

### Architecture Compliance - 架构合规性

- [x] 单例检测**只在** `ServiceLauncher` 中执行
- [x] `launch_platform_aware()` **不包含**单例检测逻辑
- [x] `windows_tray.py` **不包含**单例检测逻辑
- [x] `linux_service.py` **不包含**单例检测逻辑
- [x] 通过参数传递结果（`launcher`, `singleton_port`）
- [x] 使用 `THREAD_BUS` 管理 busy 状态
- [x] 所有资源清理通过 `launcher.stop()` 统一管理

### Code Quality - 代码质量

- [x] 单一职责原则
- [x] 避免重复逻辑
- [x] 清晰的组件边界
- [x] 文档和注释完整

---

## 📚 References - 参考

### Related Files

| File | Purpose |
|------|---------|
| `pycore/callmodule/platform/launcher.py` | 平台感知启动器 |
| `pycore/pylauncher/launcher.py` | 服务启动器（单例检测） |
| `pycore/pylauncher/singleton_detector.py` | 单例协议通信 |
| `pycore/pyfoundations/thread_bus.py` | 全局状态管理 |
| `pycore/callmodule/platform/windows_tray.py` | Windows 托盘模式 |
| `pycore/callmodule/platform/linux_service.py` | Linux 服务模式 |
| `pycore/callmodule/routers/singleton_router.py` | RPC v2 单例控制端点 |
| `pycore/callmodule/examples/task_busy_state_example.py` | Busy 状态使用示例 |

### Documentation

- `pycore/pylauncher/SMART_SINGLETON_GUIDE.md` - 智能单例使用指南
- `pycore/pylauncher/SMART_SINGLETON_SUMMARY.md` - 智能单例实现总结
- `pycore/callmodule/platform/ARCHITECTURE.md` - 本文档

---

**Document Version**: 1.0
**Last Updated**: 2025-11-28
**Architecture Status**: ✅ Production Ready
