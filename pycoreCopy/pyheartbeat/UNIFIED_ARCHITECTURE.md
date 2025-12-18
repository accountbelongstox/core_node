# PyHeartbeat 统一架构 v3.0

**整合日期**: 2025-12-08
**架构版本**: 3.0 (Unified)

---

## 🎯 整合目标

将 PyHeartbeat 从**多文件复杂架构**简化为**两文件统一架构**。

### 整合前 (5个文件)
```
pycore/pyheartbeat/
├── __init__.py
├── heartbeat_system.py
├── heartbeat_pusher.py
├── periodic_task_manager.py
├── unified_api.py
└── [文档]
```

### 整合后 (2个文件) ✅
```
pycore/pyheartbeat/
├── __init__.py           # 导出接口
├── heartbeat.py          # 统一核心（包含所有功能）
└── [文档]
```

---

## 📦 核心文件说明

### 1. heartbeat.py

**包含所有功能**:
- `CallbackInfo` - 回调信息类
- `HeartbeatPusher` - 心跳推送线程
- `HeartbeatSystem` - 系统协调器
- 全局实例和辅助函数

**核心特性**:
1. **1秒固定tick** - 不可变的基础节奏
2. **回调注册机制** - `register_callback(name, func, interval=30)`
3. **tick计数器拦截** - 30秒 = 跳过29次tick，第30次执行
4. **无额外线程** - 所有逻辑在一个HeartbeatPusher线程中
5. **任务队列处理** - 同时处理GlobalTaskQueue中的任务

### 2. __init__.py

**导出接口**:
```python
from pycore.pyheartbeat import (
    get_heartbeat_system,      # 获取系统实例
    initialize_heartbeat_system, # 初始化系统
    HeartbeatSystem,           # 系统类
    HeartbeatPusher,           # 推送器类
    CallbackInfo,              # 回调信息类
    get_global_thread_pool,    # 线程池
)
```

---

## 🔑 核心机制：Tick计数器拦截

### 原理

不使用时间比较，而是使用tick计数器：

```python
# 传统方式（已废弃）
if current_time - last_run_time >= interval:
    run_callback()

# 新方式：tick计数器拦截
if (current_tick - last_run_tick) >= interval:
    run_callback()  # 30秒 = 跳过29次，第30次执行
```

### 优势

1. **简单**: 整数比较，无浮点误差
2. **精确**: 每次tick固定1秒
3. **高效**: 无需time.time()调用
4. **清晰**: 30秒间隔 = 30个tick

---

## 🚀 使用方法

### 基础使用

```python
from pycore.pyheartbeat import get_heartbeat_system

# 1. 获取系统实例
heartbeat = get_heartbeat_system()

# 2. 启动系统（在 start_heartbeat() 中自动调用）
heartbeat.start()

# 3. 注册回调
def my_task():
    print("Running every 30 seconds")

heartbeat.register_callback(
    name='my_task',
    callback=my_task,
    interval=30  # 30秒 = 30个tick
)
```

### Matrix ADB 示例

```python
from pycore.pyheartbeat import get_heartbeat_system

heartbeat = get_heartbeat_system()

# 网络扫描 - 每30秒
heartbeat.register_callback(
    name='adb_network_scan',
    callback=lambda: adb_service._network_scan_task(),
    interval=30
)

# USB扫描 - 每5秒
heartbeat.register_callback(
    name='adb_usb_scan',
    callback=lambda: adb_service._usb_scan_task(),
    interval=5
)

# 清理 - 每60秒
heartbeat.register_callback(
    name='adb_cleanup',
    callback=lambda: adb_service._cleanup_task(),
    interval=60
)
```

### 启用/禁用回调

```python
heartbeat = get_heartbeat_system()

# 禁用
heartbeat.disable_callback('adb_network_scan')

# 启用
heartbeat.enable_callback('adb_network_scan')

# 注销
heartbeat.unregister_callback('adb_network_scan')
```

### 获取统计信息

```python
stats = heartbeat.get_stats()

# 返回：
{
    'running': True,
    'uptime': 123.45,
    'total_ticks': 123,
    'tasks_pushed': 10,
    'callbacks': {
        'adb_network_scan': {
            'enabled': True,
            'interval': 30,
            'run_count': 4,
            'ticks_until_next': 5
        }
    }
}
```

---

## 🔄 工作流程

```
┌─────────────────────────────────────────┐
│    HeartbeatPusher (1秒tick)            │
└───────────┬─────────────────────────────┘
            │
            ├─→ 1. 执行回调 (tick计数器拦截)
            │   ├─ 检查每个回调
            │   ├─ (current_tick - last_run_tick) >= interval?
            │   └─ 是 → 执行回调
            │
            └─→ 2. 处理任务队列
                ├─ 从GlobalTaskQueue获取任务
                └─ 路由到对应的handler

每10个tick → 打印心跳日志
```

---

## 📊 对比：旧架构 vs 新架构

| 特性 | 旧架构 | 新架构 |
|------|--------|--------|
| 文件数量 | 5个 | 2个 |
| 核心类 | 4个 | 3个 |
| 周期任务实现 | PeriodicTaskManager | Tick计数器拦截 |
| Task生成 | 动态生成到队列 | 直接回调执行 |
| 复杂度 | 高 | 低 |
| 维护性 | 中 | 高 |
| 性能 | 中 | 高（减少对象创建） |

---

## 🗑️ 删除的文件

以下文件已删除（功能已整合到 `heartbeat.py`）：

- ~~`heartbeat_system.py`~~ → 整合到 `heartbeat.py`
- ~~`heartbeat_pusher.py`~~ → 整合到 `heartbeat.py`
- ~~`periodic_task_manager.py`~~ → 改为回调机制
- ~~`unified_api.py`~~ → 不再需要

---

## ⚙️ 启动流程

### 在 starters.py 中启动

```python
# pycore/pythreadpool/starters.py

def start_heartbeat(config: Dict[str, Any]):
    """Start unified heartbeat system"""
    from pycore.pyheartbeat import initialize_heartbeat_system

    instance = initialize_heartbeat_system()
    instance.start()  # 启动1秒tick

    # 注册关闭处理器
    THREAD_BUS.register_shutdown_handler(
        handler=lambda: instance.stop(),
        priority=100,
        name="heartbeat"
    )

    return instance
```

### 在应用中注册回调

```python
# pyapps/matrix/matrix_main.py

def matrix_main_entry():
    heartbeat = get_heartbeat_system()

    # 注册ADB任务回调
    heartbeat.register_callback('adb_network_scan', callback, 30)
    heartbeat.register_callback('adb_usb_scan', callback, 5)
    heartbeat.register_callback('adb_cleanup', callback, 60)
```

---

## 🧪 测试验证

### 验证心跳运行

```python
from pycore.pyheartbeat import get_heartbeat_system

heartbeat = get_heartbeat_system()

# 检查运行状态
assert heartbeat.is_running() == True

# 检查统计信息
stats = heartbeat.get_stats()
print(f"Total ticks: {stats['total_ticks']}")
print(f"Uptime: {stats['uptime']}")
```

### 验证回调执行

```python
call_count = 0

def test_callback():
    global call_count
    call_count += 1

heartbeat.register_callback('test', test_callback, interval=5)

# 等待6秒
time.sleep(6)

# 应该执行1次
assert call_count >= 1
```

---

## 📝 迁移指南

### 从旧架构迁移

#### 旧方式：PeriodicTaskManager

```python
# ❌ 旧代码
from pycore.pyheartbeat import get_periodic_task_manager

periodic_mgr = get_periodic_task_manager()
periodic_mgr.register(
    task_type='adb.network_scan',
    interval=30.0,
    task_data_generator=lambda: {},
    priority=TaskPriority.NORMAL
)
```

#### 新方式：回调注册

```python
# ✅ 新代码
from pycore.pyheartbeat import get_heartbeat_system

heartbeat = get_heartbeat_system()
heartbeat.register_callback(
    name='adb_network_scan',
    callback=lambda: adb_service._network_scan_task(),
    interval=30
)
```

### 主要变化

1. **不再生成Task对象** - 直接回调执行
2. **使用tick计数器** - 而不是时间比较
3. **更简洁的API** - `register_callback()` 替代 `register()`
4. **无需task_type** - 回调名称即可

---

## 🎨 设计原则

1. **KISS (Keep It Simple, Stupid)** - 尽可能简化
2. **单一职责** - 每个类只做一件事
3. **零依赖** - 只依赖 pyfoundations 和 pythreadpool
4. **高内聚** - 相关功能整合在一起
5. **易扩展** - 回调机制易于添加新功能

---

## 🚦 性能优化

### 减少对象创建

- ❌ 旧架构：每次生成新的Task对象
- ✅ 新架构：直接回调，无对象创建

### 减少时间调用

- ❌ 旧架构：每个任务调用 `time.time()`
- ✅ 新架构：使用tick计数器（整数比较）

### 减少队列操作

- ❌ 旧架构：生成Task → 队列 → 拉取 → 路由 → 执行
- ✅ 新架构：回调 → 执行

---

## 📚 相关文档

- `PYHEARTBEAT_ARCHITECTURE.md` - 旧架构文档（参考）
- `INTEGRATION_SPECIFICATION.md` - 集成规范
- `../pythreadpool/README.md` - 线程池文档

---

## ✅ 整合完成清单

- [x] 创建统一的 `heartbeat.py` 文件
- [x] 删除 `heartbeat_system.py`
- [x] 删除 `heartbeat_pusher.py`
- [x] 删除 `periodic_task_manager.py`
- [x] 删除 `unified_api.py`
- [x] 更新 `__init__.py` 导出
- [x] 更新 `starters.py` 启动代码
- [x] 更新 `matrix_main.py` 使用回调
- [x] 创建架构文档

---

## 🎉 总结

### 核心成果

1. **文件数量**: 5个 → 2个 (减少60%)
2. **代码行数**: ~800行 → ~400行 (减少50%)
3. **核心概念**: Task生成 → 回调机制
4. **复杂度**: 高 → 低
5. **性能**: 中 → 高

### 关键特性

1. ✅ **1秒固定tick** - 简单可靠的节奏
2. ✅ **回调注册** - 易于使用的API
3. ✅ **tick计数器拦截** - 高效的间隔控制
4. ✅ **无额外线程** - 统一在一个线程中
5. ✅ **易于扩展** - 添加新回调非常简单

---

**整合完成**: 2025-12-08
**架构版本**: 3.0 Unified
**文件数量**: 2个
**状态**: ✅ 生产就绪
