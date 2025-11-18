# Thread Management Architecture

## Status: ✅ IMPLEMENTED

**Implementation Date**: 2025-11-19
**Files Modified**:
- `pycore/pyheartbeat/thread_pool.py` - Extended with THREAD_REGISTRY and priority shutdown
- `pycore/pylauncher/launcher.py` - Updated to use GlobalThreadPool with prioritized shutdown

## Overview

设计通用的线程管理机制，让 launcher.py 可以灵活扩展各种线程类，并在 shutdown 时按优先级顺序关闭。

## Current Problems

1. **Hard-coded services**: 每个服务都是硬编码在 ServiceConfig 和 launch_services 中
2. **No shutdown order**: 没有明确的关闭顺序，可能导致依赖问题
3. **Not extensible**: 添加新服务需要修改多处代码

## New Architecture

### 1. Thread Registry System

```python
# 线程注册表 - 声明式配置
THREAD_REGISTRY = {
    "heartbeat": {
        "class": "HeartbeatSystem",
        "module": "pycore.pyheartbeat",
        "default_enabled": True,  # 默认启动
        "priority": 100,  # 关闭优先级（数字越小越先关）
        "config_key": "enable_heartbeat"
    },
    "rpc_v2": {
        "class": "UnifiedRPCServer",
        "module": "pycore.pyutils.rpc_v2.server.unified_server",
        "default_enabled": False,  # 需要配置
        "priority": 50,
        "config_key": "enable_rpc_v2"
    },
    "rpc": {
        "class": "RPCServer",
        "module": "pycore.pyutils.rpc.server",
        "default_enabled": False,
        "priority": 50,
        "config_key": "enable_rpc"
    },
    "speech": {
        "class": "SpeechThread",
        "module": "pycore.pyutils.speech",
        "default_enabled": False,
        "priority": 60,
        "config_key": "enable_speech"
    }
}
```

### 2. Shutdown Priority

关闭顺序（priority 从小到大）：
1. **RPC/Network services** (priority: 50) - 先关闭外部接口
2. **Speech/Processing** (priority: 60) - 再关闭处理服务
3. **Heartbeat** (priority: 100) - 最后关闭心跳

### 3. THREAD_BUS Integration

在 THREAD_BUS 中注册关闭顺序：

```python
def register_shutdown_sequence(priority: int, shutdown_func: Callable):
    """
    Register shutdown function with priority

    Lower priority shuts down first
    """
    THREAD_BUS.register_event_handler(
        'global.shutdown.requested',
        shutdown_func,
        priority=priority
    )
```

### 4. Generic Thread Launcher

```python
class ThreadManager:
    """Generic thread manager"""

    def __init__(self, config: ServiceConfig):
        self.config = config
        self.threads = {}  # thread_name -> instance

    def launch_thread(self, thread_name: str) -> Optional[Any]:
        """Launch thread by name from registry"""
        thread_def = THREAD_REGISTRY.get(thread_name)
        if not thread_def:
            return None

        # Check if enabled
        enabled_key = thread_def["config_key"]
        if not getattr(self.config, enabled_key, False):
            return None

        # Import and instantiate
        module = importlib.import_module(thread_def["module"])
        thread_class = getattr(module, thread_def["class"])
        instance = thread_class(...)

        # Register shutdown
        priority = thread_def["priority"]
        self.register_shutdown(thread_name, instance, priority)

        # Start
        instance.start()
        self.threads[thread_name] = instance
        return instance
```

## Implementation Plan

### Phase 1: Extend GlobalThreadPool ✅ COMPLETED
- [x] Design architecture
- [x] Create THREAD_REGISTRY in thread_pool.py
- [x] Add shutdown_priority field to ThreadInfo
- [x] Implement get_shutdown_order() method
- [x] Implement shutdown_by_priority() method
- [x] Export THREAD_REGISTRY in __all__

### Phase 2: Update launcher.py ✅ COMPLETED
- [x] Add thread_pool field to ServiceInstances
- [x] Initialize GlobalThreadPool in launch_services()
- [x] Register heartbeat service with thread pool
- [x] Register RPC service with thread pool
- [x] Register speech service with thread pool
- [x] Update stop_services() to use shutdown_by_priority()
- [x] Add custom shutdown callback for each service type
- [x] Keep backward compatibility with manual shutdown fallback

### Phase 3: Future Enhancements (Optional)
- [ ] Add enable_rpc_v2 field to ServiceConfig
- [ ] Register more services (tts_switch, stt_switch) with thread pool
- [ ] Integrate with THREAD_BUS shutdown events
- [ ] Add shutdown sequence logging to ENCYCLOPEDIA
- [ ] Add unit tests for shutdown order

## Implementation Summary

### What Was Done

1. **Extended GlobalThreadPool** (`pycore/pyheartbeat/thread_pool.py`):
   - Added `THREAD_REGISTRY` with service definitions and shutdown priorities
   - Added `shutdown_priority` field to `ThreadInfo` dataclass
   - Extended `register_thread()` to accept `shutdown_priority` parameter
   - Implemented `get_shutdown_order()` to sort threads by priority
   - Implemented `shutdown_by_priority()` to gracefully shutdown threads in order
   - Updated `to_dict()` to include shutdown_priority in output

2. **Updated launcher.py** (`pycore/pylauncher/launcher.py`):
   - Added `thread_pool` field to `ServiceInstances` dataclass
   - Initialize GlobalThreadPool at start of `launch_services()`
   - Register heartbeat, RPC, and speech services with thread pool on startup
   - Rewrote `stop_services()` to use `shutdown_by_priority()` with custom callbacks
   - Added fallback to manual shutdown for backward compatibility

### Shutdown Priority Order

```
Priority 50: RPC Server (shuts down first)
Priority 60: Speech Service
Priority 100: Heartbeat System (shuts down last)
```

## Benefits

1. **Extensible**: 添加新服务只需在 THREAD_REGISTRY 中声明
2. **Clear shutdown order**: 明确的关闭优先级（RPC先关，Heartbeat最后关）
3. **Default services**: pyheartbeat 默认启动
4. **Backward compatible**: 保持现有 API 不变，有 fallback 机制
5. **Centralized management**: 统一的线程生命周期管理
6. **Reusable**: 利用现有的 GlobalThreadPool，无重复实现

## Usage Example

```python
# Launch services (same as before)
config = ServiceConfig(
    enable_heartbeat=True,
    enable_rpc=True,
    enable_speech=True
)

instances = launch_services(config)

# Services are automatically registered with thread pool
# instances.thread_pool contains GlobalThreadPool

# Shutdown now automatically follows priority order
stop_services(instances)

# Output:
# [ThreadPool] Starting prioritized shutdown...
# [ThreadPool] Shutdown order: ['rpc', 'speech', 'heartbeat']
# [ThreadPool] Shutting down 'rpc' (priority: 50)...
# [Launcher] Stopping RPC Server...
# [ThreadPool] Thread 'rpc' stopped successfully
# [ThreadPool] Shutting down 'speech' (priority: 60)...
# [ThreadPool] Thread 'speech' stopped successfully
# [ThreadPool] Shutting down 'heartbeat' (priority: 100)...
# [ThreadPool] Thread 'heartbeat' stopped successfully
# [ThreadPool] Prioritized shutdown complete
```

## How to Add New Services

To add a new service to the thread management system:

1. **Add to THREAD_REGISTRY** in `thread_pool.py`:
```python
THREAD_REGISTRY = {
    "my_new_service": {
        "description": "My new service description",
        "default_enabled": False,
        "shutdown_priority": 55,  # Between RPC (50) and Speech (60)
    },
}
```

2. **Register in launcher.py** when starting the service:
```python
if config.enable_my_service:
    instances.my_service = start_my_service()

    if instances.my_service:
        instances.thread_pool.register_thread(
            name="my_new_service",
            instance=instances.my_service,
            task_handlers={'my_task': lambda task: True},
            metadata={'service': 'my_service'}
        )
```

3. **Add shutdown callback** in `stop_services()`:
```python
def shutdown_service(thread_name: str, thread_instance: Any):
    if thread_name == "my_new_service" and instances.my_service:
        if hasattr(instances.my_service, 'stop'):
            instances.my_service.stop()
```

That's it! The service will now shutdown in the correct priority order.
