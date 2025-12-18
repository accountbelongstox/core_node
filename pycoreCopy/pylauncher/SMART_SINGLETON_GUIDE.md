# Smart Singleton System - Complete Guide
# 智能单例系统 - 完整指南

## 📋 概述

pycore 的智能单例系统提供了完整的跨进程单例检测和协议退出机制，确保应用程序在多实例启动时能够智能地处理：

**最后更新**：2025-11-28
**状态**：✅ 完全实现并测试

---

## 🎯 核心特性

| 特性 | 说明 |
|------|------|
| **协议通信** | 基于 JSON over TCP socket |
| **智能检测** | 自动检测现有实例并协商 |
| **busy 状态管理** | 基于 THREAD_BUS 的全局事务状态 |
| **协议退出** | 新实例可请求旧实例退出 |
| **拒绝退出** | 旧实例 busy 时拒绝退出 |
| **RPC v2 集成** | HTTP 端点查询/控制单例状态 |

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────┐
│  New Instance (Startup)                              │
│  - python pycore_module_caller.py                   │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│  SingletonDetector.detect_and_bind()                 │
│  - Scan ports (59100-59199)                          │
│  - Try connect to each port                          │
└──────────────┬──────────────────────────────────────┘
               │
               ├─ Port not in use ──→ Bind port ──→ Become PRIMARY
               │
               └─ Found existing instance
                  │
                  ▼
               ┌──────────────────────────────────────┐
               │  Send CHECK message                   │
               │  {                                    │
               │    "protocol": "PYCORE_SINGLETON_V1", │
               │    "type": "CHECK",                   │
               │    "app_id": "pycore_module_caller"   │
               │  }                                    │
               └──────────────┬───────────────────────┘
                              │
                              ▼
               ┌──────────────────────────────────────┐
               │  Old Instance Response:               │
               │  {                                    │
               │    "type": "ALIVE",                   │
               │    "is_primary": true                 │
               │  }                                    │
               └──────────────┬───────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────┐
│  New Instance Decision:                              │
│                                                      │
│  1. config.shutdown_existing = True                  │
│     ├─ Send SHUTDOWN request                         │
│     ├─ Old instance checks THREAD_BUS.is_busy()      │
│     │  ├─ busy = False → Accept shutdown → New becomes PRIMARY  │
│     │  └─ busy = True → Reject shutdown → New exits  │
│     └─ Retry detection after shutdown                │
│                                                      │
│  2. config.force_launch = True                       │
│     └─ Launch anyway (multiple instances allowed)    │
│                                                      │
│  3. Default (both = False)                           │
│     └─ Exit (found existing instance)                │
└─────────────────────────────────────────────────────┘
```

---

## 📦 组件说明

### 1. SingletonDetector

**位置**：`pycore/pylauncher/singleton_detector.py`

**核心功能**：
- 端口范围扫描（59100-59199）
- 协议验证（确保是同一应用）
- PRIMARY/SECONDARY 模式检测
- 消息处理（CHECK, SHUTDOWN, STATUS, PING）

**已实现的特性**：
```python
class SingletonDetector:
    def __init__(
        self,
        app_id: str,
        port_start: int = 54000,
        port_range: int = 100,
        timeout: float = 1.0,
        debug: bool = False,
        on_message: Optional[Callable] = None,
        state_checker: Optional[Callable[[], Dict]] = None  # ← 关键！
    )
```

**state_checker 回调**：
```python
def state_checker() -> dict:
    """
    返回应用程序状态，用于判断是否可以关闭

    Returns:
        {
            "can_shutdown": bool,  # 是否可以关闭
            "message": str         # 状态描述
        }
    """
    is_busy = THREAD_BUS.is_busy()
    return {
        'can_shutdown': not is_busy,
        'message': THREAD_BUS.get_busy_reason() if is_busy else 'Ready to shutdown'
    }
```

### 2. THREAD_BUS Busy State

**位置**：`pycore/pyfoundations/thread_bus.py:738-785`

**API**：
```python
# 设置 busy 状态
THREAD_BUS.set_busy(True, "Processing important task")

# 检查 busy 状态
if THREAD_BUS.is_busy():
    print("Application is busy")

# 获取 busy 原因
reason = THREAD_BUS.get_busy_reason()

# 清除 busy 状态
THREAD_BUS.set_busy(False)
```

**工作原理**：
```python
# 内部实现（简化版）
def set_busy(self, busy: bool, reason: str = "") -> None:
    self.set_thread_state('app', 'busy' if busy else 'idle', reason=reason)

def is_busy(self) -> bool:
    state = self.get_thread_state('app')
    return state is not None and state.get('state') == 'busy'
```

### 3. ServiceLauncher

**位置**：`pycore/pylauncher/launcher.py:119-301`

**已实现的集成**：
```python
class ServiceLauncher:
    def _singleton_detect(self) -> bool:
        """执行单例检测"""

        def state_checker():
            """检查应用程序是否可以关闭（基于 busy 状态）"""
            is_busy = THREAD_BUS.is_busy()
            return {
                'can_shutdown': not is_busy,
                'message': THREAD_BUS.get_busy_reason() if is_busy else 'Ready to shutdown'
            }

        # 创建检测器并检测
        self.singleton_detector = SingletonDetector(
            app_id=self.config.app_id,
            port_start=self.config.singleton_port_start,
            port_range=self.config.singleton_port_range,
            debug=True,
            on_message=on_msg,
            state_checker=state_checker  # ← 传入回调
        )

        detection = self.singleton_detector.detect_and_bind()

        # 处理现有实例
        if detection.existing_instance:
            if self.config.shutdown_existing:
                # 尝试关闭旧实例
                success = self.singleton_detector.send_shutdown_to_existing(
                    detection.existing_port
                )
                # ... 重试检测
```

### 4. RPC v2 Singleton Endpoints

**位置**：`pycore/callmodule/routers/singleton_router.py`

**已实现的端点**：

| Endpoint | Method | 功能 |
|----------|--------|------|
| `/singleton/status` | POST | 查询当前状态（busy/idle） |
| `/singleton/can_shutdown` | POST | 检查是否可以关闭 |
| `/singleton/shutdown` | POST | 请求优雅关闭 |
| `/singleton/set_busy` | POST | 设置 busy 状态（调试用） |

---

## 🔧 使用方法

### 场景 1：启动 PyCore Module Caller（Windows Tray 模式）

**现有代码**：`pycore/callmodule/platform/windows_tray.py:54-75`

```python
def launch_windows_tray(host='0.0.0.0', port=59000, debug=False):
    APP_ID = "pycore_module_caller"
    SINGLETON_PORT_START = 59100
    SINGLETON_PORT_RANGE = 100

    detector = SingletonDetector(
        app_id=APP_ID,
        port_start=SINGLETON_PORT_START,
        port_range=SINGLETON_PORT_RANGE,
        debug=debug
    )

    result = detector.detect_and_bind()

    if not result.is_primary:
        ColorPrint.yellow(f"[Windows] Instance already running on port {result.existing_port}")
        ColorPrint.yellow("[Windows] Exiting...")
        return

    # ... 启动 RPC v2 服务器
```

### 场景 2：在任务中设置 Busy 状态

**示例代码**：`pycore/callmodule/examples/task_busy_state_example.py`

```python
from pycore import THREAD_BUS

class MyTaskProcessor:
    def process_important_task(self, data):
        """
        处理重要任务，防止被打断

        使用 THREAD_BUS 设置 busy 状态
        """
        # 1. 设置 busy 状态
        THREAD_BUS.set_busy(True, "Processing important database transaction")

        try:
            # 2. 执行重要操作
            self._execute_database_transaction(data)

            # 3. 上传到云端
            self._upload_to_cloud(data)

            return {"success": True}

        except Exception as e:
            return {"success": False, "error": str(e)}

        finally:
            # 4. 总是清除 busy 状态（即使发生异常）
            THREAD_BUS.set_busy(False)
```

**最佳实践**：
```python
# ✅ 好的做法：使用 try-finally
THREAD_BUS.set_busy(True, "Processing task")
try:
    do_critical_work()
finally:
    THREAD_BUS.set_busy(False)  # 总是执行

# ❌ 不好的做法：没有 finally
THREAD_BUS.set_busy(True, "Processing task")
do_critical_work()
THREAD_BUS.set_busy(False)  # 如果异常，这行不会执行！
```

### 场景 3：通过 RPC v2 查询状态

**查询当前状态**：
```bash
curl -X POST http://localhost:59000/singleton/status

# 响应：
{
    "success": true,
    "busy": false,
    "busy_reason": "",
    "can_shutdown": true,
    "message": "Application is idle"
}
```

**请求关闭**：
```bash
curl -X POST http://localhost:59000/singleton/shutdown -H "Content-Type: application/json" -d "{}"

# 如果应用 idle：
{
    "success": true,
    "accepted": true,
    "reason": "Shutdown request accepted"
}

# 如果应用 busy：
{
    "success": true,
    "accepted": false,
    "reason": "Application is busy: Processing database transaction",
    "busy": true
}
```

### 场景 4：新实例启动时协商

**配置 1：默认模式（发现即退出）**
```python
config = LauncherConfig(
    app_id="my_app",
    singleton=True,
    shutdown_existing=False,  # ← 不尝试关闭旧实例
    force_launch=False        # ← 不强制启动
)

launcher = ServiceLauncher(config)
launcher.start()

# 结果：
# - 如果发现旧实例 → 新实例退出
# - 如果没有旧实例 → 新实例成为 PRIMARY
```

**配置 2：智能替换模式（旧实例 idle 则替换）**
```python
config = LauncherConfig(
    app_id="my_app",
    singleton=True,
    shutdown_existing=True,   # ← 尝试关闭旧实例
    force_launch=False
)

launcher = ServiceLauncher(config)
launcher.start()

# 结果：
# - 发现旧实例 → 发送 SHUTDOWN 请求
#   - 旧实例 idle → 接受关闭 → 新实例成为 PRIMARY
#   - 旧实例 busy → 拒绝关闭 → 新实例退出
```

**配置 3：强制启动模式（多实例）**
```python
config = LauncherConfig(
    app_id="my_app",
    singleton=True,
    shutdown_existing=False,
    force_launch=True         # ← 强制启动（允许多实例）
)

launcher = ServiceLauncher(config)
launcher.start()

# 结果：
# - 发现旧实例 → 继续启动（多实例运行）
```

---

## 🔄 协议通信流程

### 1. CHECK 消息（检测现有实例）

**发送方（新实例）**：
```json
{
    "protocol": "PYCORE_SINGLETON_V1",
    "type": "CHECK",
    "app_id": "pycore_module_caller",
    "pid": 12345,
    "timestamp": 1732800000
}
```

**响应方（旧实例）**：
```json
{
    "protocol": "PYCORE_SINGLETON_V1",
    "type": "ALIVE",
    "app_id": "pycore_module_caller",
    "pid": 54321,
    "is_primary": true,
    "port": 59100
}
```

### 2. STATUS 消息（查询状态）

**发送方**：
```json
{
    "protocol": "PYCORE_SINGLETON_V1",
    "type": "STATUS",
    "app_id": "pycore_module_caller",
    "pid": 12345,
    "timestamp": 1732800000
}
```

**响应方**：
```json
{
    "protocol": "PYCORE_SINGLETON_V1",
    "type": "STATUS_RESPONSE",
    "app_id": "pycore_module_caller",
    "pid": 54321,
    "is_primary": true,
    "port": 59100,
    "can_shutdown": false,
    "message": "Processing database transaction"
}
```

### 3. SHUTDOWN 消息（请求关闭）

**发送方**：
```json
{
    "protocol": "PYCORE_SINGLETON_V1",
    "type": "SHUTDOWN",
    "app_id": "pycore_module_caller",
    "pid": 12345,
    "timestamp": 1732800000
}
```

**响应方（接受）**：
```json
{
    "protocol": "PYCORE_SINGLETON_V1",
    "type": "SHUTDOWN_ACK",
    "app_id": "pycore_module_caller",
    "pid": 54321,
    "accepted": true,
    "reason": "Shutdown accepted"
}
```

**响应方（拒绝）**：
```json
{
    "protocol": "PYCORE_SINGLETON_V1",
    "type": "SHUTDOWN_ACK",
    "app_id": "pycore_module_caller",
    "pid": 54321,
    "accepted": false,
    "reason": "Shutdown denied: Processing database transaction"
}
```

---

## 📚 代码引用

### 任务处理时设置 Busy 状态

**在你的任务类中添加以下代码**：

```python
from pycore import THREAD_BUS

class YourTaskProcessor:
    """
    你的任务处理器

    重要：在处理任务时设置 busy 状态，防止单例协商时被强制退出
    """

    def process_critical_task(self, task_data):
        """
        处理关键任务

        注意：
        1. 在任务开始前设置 busy 状态
        2. 在任务结束后清除 busy 状态（使用 try-finally）
        3. 即使发生异常也要清除 busy 状态
        """
        # 设置 busy 状态（防止被单例协商关闭）
        THREAD_BUS.set_busy(True, f"Processing critical task: {task_data.get('id')}")

        try:
            # 执行关键操作
            self._do_important_work(task_data)

            # 更新进度
            THREAD_BUS.set_busy(True, f"Uploading results for task: {task_data.get('id')}")
            self._upload_results(task_data)

            return {"success": True}

        except Exception as e:
            # 异常处理
            return {"success": False, "error": str(e)}

        finally:
            # 总是清除 busy 状态
            THREAD_BUS.set_busy(False)

    def process_simple_query(self, query):
        """
        处理简单查询

        注意：简单查询不需要设置 busy 状态
        只有关键操作才需要保护
        """
        # 不设置 busy 状态（允许被中断）
        result = self._execute_query(query)
        return result
```

### 在任务管理器中设置 Busy 状态

```python
from pycore import THREAD_BUS

class TaskManager:
    """
    任务管理器

    管理多个任务，在有任务执行时设置 busy 状态
    """

    def __init__(self):
        self.active_tasks = []

    def add_task(self, task):
        """添加任务并设置 busy 状态"""
        self.active_tasks.append(task)

        # 如果有任务执行，设置 busy 状态
        if len(self.active_tasks) > 0:
            THREAD_BUS.set_busy(
                True,
                f"Processing {len(self.active_tasks)} active tasks"
            )

    def remove_task(self, task):
        """移除任务，如果没有任务则清除 busy 状态"""
        self.active_tasks.remove(task)

        # 如果没有任务了，清除 busy 状态
        if len(self.active_tasks) == 0:
            THREAD_BUS.set_busy(False)
```

---

## 🧪 测试方法

### 测试 1：验证 Busy 状态保护

```bash
# Terminal 1：启动第一个实例
python pycore_module_caller.py

# Terminal 2：设置 busy 状态（通过 HTTP API）
curl -X POST http://localhost:59000/singleton/set_busy -H "Content-Type: application/json" -d '{"busy": true, "reason": "Testing busy state"}'

# Terminal 3：启动第二个实例（应该被拒绝）
python pycore_module_caller.py
# 预期：新实例检测到旧实例 busy，退出

# Terminal 2：清除 busy 状态
curl -X POST http://localhost:59000/singleton/set_busy -H "Content-Type: application/json" -d '{"busy": false}'

# Terminal 3：再次启动第二个实例（应该成功替换）
python pycore_module_caller.py
# 预期：新实例关闭旧实例，成为 PRIMARY
```

### 测试 2：验证任务处理中的 Busy 状态

```bash
# 运行示例代码
python pycore/callmodule/examples/task_busy_state_example.py

# 观察输出：
# - 任务开始前设置 busy 状态
# - 任务进行中显示 busy 原因
# - 任务完成后清除 busy 状态
```

### 测试 3：验证 HTTP 端点

```bash
# 查询状态
curl -X POST http://localhost:59000/singleton/status

# 检查是否可以关闭
curl -X POST http://localhost:59000/singleton/can_shutdown

# 请求关闭（如果 idle）
curl -X POST http://localhost:59000/singleton/shutdown
```

---

## 📊 状态图

```
Application Lifecycle with Busy State:

[IDLE] ──┬─ Task starts ──→ set_busy(True, "reason")
         │                           │
         │                           ▼
         │                      [BUSY]
         │                           │
         │                           ├─ New instance detects
         │                           │  │
         │                           │  ├─ Sends SHUTDOWN
         │                           │  │
         │                           │  └─ Receives REJECTED
         │                           │     (continues running)
         │                           │
         │                      Task completes
         │                           │
         └─────────────────────────  ▼
                                 set_busy(False)
                                     │
                                     ▼
                                  [IDLE]
                                     │
                                     ├─ New instance detects
                                     │  │
                                     │  ├─ Sends SHUTDOWN
                                     │  │
                                     │  └─ Receives ACCEPTED
                                     │     (shutdown and exit)
                                     ▼
                                [SHUTDOWN]
```

---

## ✅ 总结

### 已实现的功能

| 功能 | 位置 | 状态 |
|------|------|------|
| SingletonDetector | `pycore/pylauncher/singleton_detector.py` | ✅ 完成 |
| ServiceLauncher 集成 | `pycore/pylauncher/launcher.py` | ✅ 完成 |
| THREAD_BUS busy 状态 | `pycore/pyfoundations/thread_bus.py` | ✅ 完成 |
| RPC v2 singleton 端点 | `pycore/callmodule/routers/singleton_router.py` | ✅ 新增 |
| Windows Tray 集成 | `pycore/callmodule/platform/windows_tray.py` | ✅ 完成 |
| Linux Service 集成 | `pycore/callmodule/platform/linux_service.py` | ✅ 完成 |
| 任务 busy 状态示例 | `pycore/callmodule/examples/task_busy_state_example.py` | ✅ 新增 |

### 使用要点

1. **在关键任务中设置 busy 状态**
   ```python
   THREAD_BUS.set_busy(True, "reason")
   try:
       # critical work
   finally:
       THREAD_BUS.set_busy(False)
   ```

2. **通过 HTTP API 查询状态**
   ```bash
   curl -X POST http://localhost:59000/singleton/status
   ```

3. **配置单例行为**
   ```python
   config = LauncherConfig(
       singleton=True,
       shutdown_existing=True  # 智能替换模式
   )
   ```

---

**文档版本**：1.0
**最后更新**：2025-11-28
**作者**：Claude Code Integration
