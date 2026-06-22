# PyHeartbeat 驱动架构 - ADB 设备管理重构

**重构日期**: 2025-12-08
**架构版本**: 2.0 (PyHeartbeat Driven)

---

## 🎯 重构目标

将 Matrix ADB 设备管理从**独立线程模式**改为**PyHeartbeat 驱动模式**。

### 旧架构问题
- ❌ 独立的 `ADBHeartbeatThread` 和 `DevicePushService` 线程
- ❌ 各自的 `while` 循环和 `time.sleep()`
- ❌ 难以统一管理和调度
- ❌ 关闭时可能挂起（`join()` 超时）

### 新架构优势
- ✅ 统一由 PyHeartbeat 调度
- ✅ 使用任务队列机制
- ✅ ENCYCLOPEDIA 保存 busy 标识，避免重复执行
- ✅ 易于扩展和监控

---

## 🏗️ 新架构组件

### 1. PeriodicTaskManager

**文件**: `pycore/pyheartbeat/periodic_task_manager.py`

**功能**: 管理周期性任务的生成

```python
periodic_mgr = get_periodic_task_manager()

periodic_mgr.register(
    task_type='adb.network_scan',
    interval=30.0,  # 每 30 秒
    priority=TaskPriority.NORMAL
)
```

**工作原理**:
1. 每次 HeartbeatPusher tick (1秒)
2. 检查各任务的时间间隔
3. 到期的任务生成 Task 放入 GlobalTaskQueue

### 2. HeartbeatPusher 集成

**文件**: `pycore/pyheartbeat/heartbeat_pusher.py`

**改动**:
```python
def _tick(self):
    self._total_ticks += 1
    current_time = time.time()

    # 触发周期性任务生成
    self._periodic_task_manager.tick(current_time)

    # 从队列拉取任务并路由
    task = self._task_queue.get(block=False, timeout=0.1)
    ...
```

### 3. ADBHeartbeatService

**文件**: `pyapps/matrix/adb_device_manager/adb_heartbeat_service.py`

**改动**: 不再继承 `threading.Thread`

```python
class ADBHeartbeatService:  # ❌ 不再是 Thread
    def handle_task(self, task: Task) -> bool:
        """处理来自 PyHeartbeat 的任务"""
        task_type = task.task_type

        # 检查 busy 标识
        busy_key = f"adb_service.{task_type}.busy"
        if ENCYCLOPEDIA.get(busy_key, False):
            return False  # 忙，跳过

        ENCYCLOPEDIA.add(busy_key, True)
        try:
            # 执行任务
            if task_type == "adb.network_scan":
                self._network_scan_task()
            ...
            return True
        finally:
            ENCYCLOPEDIA.add(busy_key, False)
```

### 4. matrix_main.py 重构

**文件**: `pyapps/matrix/matrix_main.py`

**改动**: 使用 PyHeartbeat 架构

```python
def matrix_main_entry():
    # 1. 初始化 ADB 服务（不是线程）
    _adb_service = init_adb_heartbeat_service(adb_path="adb")

    # 2. 注册任务处理器到 GlobalThreadPool
    thread_pool.register_thread(
        name='adb_service',
        instance=_adb_service,
        task_handlers={
            'adb.network_scan': handle_adb_task,
            'adb.usb_scan': handle_adb_task,
            ...
        }
    )

    # 3. 注册周期性任务到 PeriodicTaskManager
    periodic_mgr.register('adb.network_scan', interval=30.0)
    periodic_mgr.register('adb.usb_scan', interval=5.0)
    periodic_mgr.register('adb.cleanup', interval=60.0)
    periodic_mgr.register('adb.heartbeat', interval=10.0)
    periodic_mgr.register('adb.push_devices', interval=10.0)
```

---

## 🔄 工作流程

```
[1秒 tick] HeartbeatPusher
    ↓
PeriodicTaskManager.tick(current_time)
    ↓
检查各任务时间间隔
    ↓
生成到期任务 → GlobalTaskQueue
    ↓
HeartbeatPusher 拉取任务
    ↓
根据 task_type 路由到 adb_service
    ↓
ADBHeartbeatService.handle_task(task)
    ↓
检查 ENCYCLOPEDIA busy 标识
    ↓ (不 busy)
执行扫描/推送逻辑
    ↓
清除 busy 标识
```

---

## 📊 任务类型和间隔

| 任务类型 | 间隔 | 优先级 | 描述 |
|---------|------|--------|------|
| `adb.network_scan` | 30秒 | NORMAL | 扫描局域网设备 (Root 设备) |
| `adb.usb_scan` | 5秒 | NORMAL | 扫描 USB 设备并转无线 |
| `adb.cleanup` | 60秒 | LOW | 清理过期设备 |
| `adb.heartbeat` | 10秒 | NORMAL | 更新设备心跳 |
| `adb.push_devices` | 10秒 | NORMAL | 推送设备列表到前端 |

---

## 🔐 ENCYCLOPEDIA Busy 标识

### 为什么需要 Busy 标识？

防止任务重复执行：如果上一次扫描还没完成，不应该启动新的扫描。

### 标识命名规则

```
adb_service.{task_type}.busy
```

示例：
- `adb_service.adb.network_scan.busy`
- `adb_service.adb.usb_scan.busy`
- `adb_service.adb.push_devices.busy`

### 使用方式

```python
# 检查
if ENCYCLOPEDIA.get('adb_service.adb.network_scan.busy', False):
    return False  # 忙，跳过

# 设置
ENCYCLOPEDIA.add('adb_service.adb.network_scan.busy', True)

# 清除
ENCYCLOPEDIA.add('adb_service.adb.network_scan.busy', False)
```

---

## 🗑️ 删除的文件

~~`pyapps/matrix/adb_device_manager/adb_heartbeat_thread.py`~~ (旧的 Thread 实现)

**被替换为**: `adb_heartbeat_service.py`

---

## ✅ 重构验证

### 测试步骤

1. **启动 Matrix 应用**
   ```bash
   python pymain.py app=matrix
   ```

2. **观察日志**
   ```
   [HeartbeatPusher] Started (interval=1.0s)
   [ADBHeartbeatService] Initialized (PyHeartbeat driven)
   [Matrix] ADB task handlers registered to GlobalThreadPool
   [Matrix] Periodic ADB tasks registered to PyHeartbeat
   [PeriodicTaskManager] Generated task: adb.network_scan (run #1)
   [ADBService] Running network scan task...
   ```

3. **检查心跳日志**
   ```
   [HeartbeatPusher] Tick #10, Time: 2025-12-08 20:00:00
   [HeartbeatPusher] Tick #20, Time: 2025-12-08 20:00:10
   ```

4. **验证设备推送**
   - 前端应该每 10 秒收到 `adb.devices.update` 事件
   - 包含设备列表和统计信息

### 预期行为

- ✅ 没有独立线程启动
- ✅ 所有操作由 PyHeartbeat 驱动
- ✅ 任务按时生成和执行
- ✅ Busy 标识防止重复执行
- ✅ 应用正常关闭，没有挂起

---

## 📈 性能对比

| 指标 | 旧架构 | 新架构 |
|------|--------|--------|
| 独立线程数 | 2 (ADBHeartbeat + DevicePush) | 0 |
| 阻塞 sleep | ✅ (`time.sleep()`) | ❌ (事件驱动) |
| 统一调度 | ❌ | ✅ |
| 可监控性 | 低 | 高 |
| 关闭可靠性 | 中 (可能超时) | 高 |

---

## 🔮 未来扩展

### 添加新的周期性任务

```python
# 1. 注册周期性任务
periodic_mgr.register(
    task_type='adb.battery_monitor',
    interval=60.0,  # 每分钟
    priority=TaskPriority.LOW
)

# 2. 在 ADBHeartbeatService 添加处理器
def handle_task(self, task: Task):
    ...
    elif task_type == "adb.battery_monitor":
        self._battery_monitor_task()
    ...

# 3. 注册到 GlobalThreadPool
thread_pool.register_thread(
    name='adb_service',
    task_handlers={
        ...
        'adb.battery_monitor': handle_adb_task,
    }
)
```

### 动态调整任务间隔

```python
periodic_mgr = get_periodic_task_manager()

# 启用/禁用任务
periodic_mgr.disable('adb.network_scan')
periodic_mgr.enable('adb.network_scan')

# 获取统计信息
stats = periodic_mgr.get_stats()
# {'adb.network_scan': {'enabled': True, 'interval': 30.0, 'run_count': 10, ...}}
```

---

## 🐛 已知问题和解决方案

### 问题 1: 任务执行时间超过间隔

**现象**: 如果网络扫描需要 35 秒，但间隔设置为 30 秒

**解决方案**:
1. Busy 标识会跳过新任务
2. 调整间隔或优化执行速度
3. 监控 `PeriodicTaskManager.get_stats()`

### 问题 2: ENCYCLOPEDIA busy 标识泄漏

**现象**: 异常导致 busy 标识未清除

**解决方案**:
```python
try:
    ENCYCLOPEDIA.add(busy_key, True)
    self._network_scan_task()
finally:
    ENCYCLOPEDIA.add(busy_key, False)  # ✅ finally 确保清除
```

---

## 📝 总结

### 重构成果

- ✅ **架构统一**: 所有周期性任务由 PyHeartbeat 驱动
- ✅ **代码简化**: 删除独立线程，减少复杂性
- ✅ **可靠性提升**: 使用 busy 标识防止重复，统一关闭流程
- ✅ **可扩展性**: 易于添加新任务类型

### 关键设计

1. **PeriodicTaskManager**: 周期性任务生成器
2. **ENCYCLOPEDIA busy 标识**: 防止重复执行
3. **GlobalThreadPool 注册**: 任务路由机制
4. **ADBHeartbeatService**: 无线程的服务类

### 技术栈

- PyHeartbeat (任务调度)
- GlobalTaskQueue (任务队列)
- GlobalThreadPool (任务路由)
- ENCYCLOPEDIA (状态管理)

---

**重构完成**: 2025-12-08
**架构版本**: 2.0 PyHeartbeat Driven
