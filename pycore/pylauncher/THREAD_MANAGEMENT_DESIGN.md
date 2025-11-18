# Thread Management Architecture

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

### Phase 1: Create Thread Manager
- [x] Design architecture
- [ ] Implement ThreadManager class
- [ ] Create THREAD_REGISTRY
- [ ] Add shutdown priority system

### Phase 2: Update ServiceConfig
- [ ] Add enable_rpc_v2 field
- [ ] Add generic thread config fields
- [ ] Keep backward compatibility

### Phase 3: Update launcher.py
- [ ] Replace hard-coded services with ThreadManager
- [ ] Implement shutdown sequence
- [ ] Update ServiceInstances

### Phase 4: Update THREAD_BUS
- [ ] Add priority-based shutdown
- [ ] Add shutdown sequence logging
- [ ] Test shutdown order

## Benefits

1. **Extensible**: 添加新服务只需在 THREAD_REGISTRY 中声明
2. **Clear shutdown order**: 明确的关闭优先级
3. **Default services**: pyheartbeat 默认启动
4. **Backward compatible**: 保持现有 API 不变
5. **Centralized management**: 统一的线程生命周期管理

## Usage Example

```python
# Old way (still works)
config = ServiceConfig(enable_rpc=True, enable_speech=True)

# New way (extensible)
config = ServiceConfig(
    enable_heartbeat=True,  # Default
    enable_rpc_v2=True,     # New service
    rpc_v2_config={...}
)

instances = launch_services(config)

# Shutdown automatically follows priority order
# 1. RPC v2 shuts down (priority 50)
# 2. Speech shuts down (priority 60)
# 3. Heartbeat shuts down last (priority 100)
```
