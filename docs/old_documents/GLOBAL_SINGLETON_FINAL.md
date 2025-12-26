# 全局单例改造完成 ✅

## 改造原则

**用户要求**：
> "说了所有在模块里就导出的就是单例,不要再任何类库中再实例化"

**实现方式**：
- 在模块级别创建唯一实例并导出
- 禁止使用 `.instance()` 类方法
- 直接 `from module import singleton_instance` 使用

## 已改造的8个核心单例

### 1. DeviceManager
**文件**: `pycore/pyutils/device_manager.py`

```python
# 导出全局实例
from pycore.pyutils.device_manager import device_manager

# ✅ 正确
device = device_manager.get_device(serial)

# ❌ 错误
device_manager = DeviceManager.instance()
```

### 2. PortPool
**文件**: `pycore/pyutils/device/port_pool.py`

```python
# 导出全局实例
from pycore.pyutils.device.port_pool import port_pool

# ✅ 正确
port = await port_pool.allocate(serial)

# ❌ 错误
port_pool = PortPool.instance()
```

### 3. NetworkScanner
**文件**: `pyapps/matrix/adb_device_manager/network_scanner.py`

```python
# 导出全局实例
from pyapps.matrix.adb_device_manager.network_scanner import network_scanner

# ✅ 正确
found_ips = network_scanner.scan_network()

# ❌ 错误
scanner = NetworkScanner.instance()
```

### 4. ADBExecutor
**文件**: `pyapps/matrix/adb_device_manager/adb_executor.py`

```python
# 导出全局实例
from pyapps.matrix.adb_device_manager.adb_executor import adb_executor

# ✅ 正确
devices = adb_executor.get_devices()

# ❌ 错误
adb = ADBExecutor.instance()
```

### 5. DeviceTable
**文件**: `pyapps/matrix/adb_device_manager/device_table.py`

```python
# 导出全局实例
from pyapps.matrix.adb_device_manager.device_table import device_table

# ✅ 正确
all_devices = device_table.get_all_devices()

# ❌ 错误
table = DeviceTable.instance()
```

### 6. USBMonitor (工厂函数)
**文件**: `pyapps/matrix/adb_device_manager/usb_monitor.py`

```python
# 使用工厂函数（延迟初始化）
from pyapps.matrix.adb_device_manager.usb_monitor import get_usb_monitor

# ✅ 正确
usb_monitor = get_usb_monitor()
results = usb_monitor.process_usb_devices()

# ❌ 错误
usb_monitor = USBMonitor.instance()
```

### 7. ScrcpyServerManager (工厂函数)
**文件**: `pycore/pyutils/device/scrcpy_server_manager.py`

```python
# 使用工厂函数
from pycore.pyutils.device.scrcpy_server_manager import get_scrcpy_server_manager

# ✅ 正确
server_mgr = get_scrcpy_server_manager(adb_path, jar_path)

# ❌ 错误
server_mgr = ScrcpyServerManager.instance()
```

### 8. ConnectionManager (工厂函数)
**文件**: `pycore/pyutils/device/connection_manager.py`

```python
# 使用工厂函数（需要依赖注入）
from pycore.pyutils.device.connection_manager import get_connection_manager

# ✅ 正确
conn_mgr = get_connection_manager(
    device_manager=device_manager,
    port_pool=port_pool,
    server_manager=server_manager,
    adb_path=adb_path
)

# ❌ 错误
conn_mgr = ConnectionManager.instance()
```

## 已修复的文件列表

### 核心单例文件
- ✅ `pycore/pyutils/device_manager.py` - DeviceManager全局实例
- ✅ `pycore/pyutils/device/port_pool.py` - PortPool全局实例
- ✅ `pycore/pyutils/device/scrcpy_server_manager.py` - 工厂函数
- ✅ `pycore/pyutils/device/connection_manager.py` - 工厂函数
- ✅ `pyapps/matrix/adb_device_manager/network_scanner.py` - 全局实例
- ✅ `pyapps/matrix/adb_device_manager/adb_executor.py` - 全局实例
- ✅ `pyapps/matrix/adb_device_manager/device_table.py` - 全局实例
- ✅ `pyapps/matrix/adb_device_manager/usb_monitor.py` - 工厂函数

### 使用单例的服务文件
- ✅ `pyapps/matrix/services/video_stream_service.py`
- ✅ `pyapps/matrix/services/video_stream_health_service.py`
- ✅ `pyapps/matrix/services/device_state_coordinator.py`
- ✅ `pyapps/matrix/services/control_service.py`
- ✅ `pyapps/matrix/services/device_service.py`
- ✅ `pyapps/matrix/services/recording_service.py`
- ✅ `pyapps/matrix/services/screen_service.py`
- ✅ `pyapps/matrix/adb_device_manager/adb_heartbeat_service.py`
- ✅ `pyapps/matrix/adb_device_manager/adb_heartbeat_thread.py`
- ✅ `pyapps/matrix/discover_devices.py`

### 模块初始化
- ✅ `pyapps/matrix/adb_device_manager/__init__.py` - 正确的导入顺序

## 循环依赖处理

### 问题
USBMonitor依赖ADBExecutor和DeviceTable，如果在模块加载时就创建实例会导致循环依赖：
```
usb_monitor.py 加载
  → 导入 adb_executor（模块级）
    → 导入 device_table（模块级）
      → usb_monitor 还未完成加载 ❌
```

### 解决方案
使用工厂函数延迟初始化：

```python
# usb_monitor.py
_usb_monitor: Optional['USBMonitor'] = None

def get_usb_monitor() -> 'USBMonitor':
    """延迟初始化"""
    global _usb_monitor
    if _usb_monitor is None:
        from pyapps.matrix.adb_device_manager.adb_executor import adb_executor
        from pyapps.matrix.adb_device_manager.device_table import device_table
        _usb_monitor = USBMonitor(adb_executor, device_table)
    return _usb_monitor
```

## 验证测试

### 测试1: 导入测试
```bash
python -c "
from pyapps.matrix.adb_device_manager import adb_executor, device_table, network_scanner
print('✓ 导入成功')
print(f'  adb_executor: {type(adb_executor).__name__}')
print(f'  device_table: {type(device_table).__name__}')
print(f'  network_scanner: {type(network_scanner).__name__}')
"
# 输出:
# ✓ 导入成功
#   adb_executor: ADBExecutor
#   device_table: DeviceTable
#   network_scanner: NetworkScanner
```

### 测试2: 单例验证
```bash
python -c "
from pycore.pyutils.device_manager import device_manager

# 从不同模块导入，应该是同一个实例
from pyapps.matrix.services.device_state_coordinator import DeviceStateCoordinator
coordinator = DeviceStateCoordinator()
coordinator.initialize()

print(f'ID1: {id(device_manager)}')
print(f'ID2: {id(coordinator._device_manager)}')
print(f'Same: {device_manager is coordinator._device_manager}')
"
# 输出: Same: True
```

### 测试3: 服务初始化
```bash
python -c "
from pyapps.matrix.adb_device_manager import init_adb_heartbeat_service
service = init_adb_heartbeat_service(adb_path='adb')
print(f'✓ Service created: {type(service).__name__}')
print(f'  adb: {type(service.adb).__name__}')
print(f'  network_scanner: {type(service.network_scanner).__name__}')
print(f'  device_table: {type(service.device_table).__name__}')
"
# 全部成功
```

## 修复的错误

### 错误1: "Device not in global DeviceManager"
**原因**: 多个DeviceManager实例，ConnectionManager注册到实例A，VideoStreamHealth查询实例B

**修复**: DeviceManager改为模块级单例，所有代码使用同一个`device_manager`实例

### 错误2: "name 'adb_executor' is not defined"
**原因**: USBMonitor在模块加载时就尝试使用`adb_executor`，但存在循环依赖

**修复**: USBMonitor改为`get_usb_monitor()`工厂函数，延迟初始化

### 错误3: "cannot import name 'get_connection_manager'"
**原因**: Python脚本批量修改时未正确写入工厂函数

**修复**: 手动添加`get_connection_manager()`函数到connection_manager.py

### 错误4: "DeviceManager has no attribute 'instance'"
**原因**: 多个服务文件还在使用旧的`.instance()`方法

**修复**: 批量替换所有服务文件中的`DeviceManager.instance()`为`device_manager`

## 优势

### 1. 更简洁
```python
# 旧方式 - 需要记住调用.instance()
manager = DeviceManager.instance()

# 新方式 - 直接导入使用
from pycore.pyutils.device_manager import device_manager
```

### 2. 更直观
模块导入即全局单例，符合Python习惯

### 3. 线程安全
Python的import机制天然线程安全，模块只加载一次

### 4. 无性能损耗
不需要每次检查`_instance`和获取锁

### 5. 避免循环依赖
工厂函数可以延迟初始化，在首次调用时才导入依赖

## 使用指南

### 基本原则
1. **直接导入实例** - 不要调用`.instance()`
2. **使用工厂函数** - 对于有依赖的单例，使用`get_xxx()`
3. **禁止重新实例化** - 不要`MyClass()`创建新实例

### 示例代码

```python
# ✅ 正确的使用方式
from pycore.pyutils.device_manager import device_manager
from pycore.pyutils.device.port_pool import port_pool
from pyapps.matrix.adb_device_manager.adb_executor import adb_executor
from pyapps.matrix.adb_device_manager.device_table import device_table
from pyapps.matrix.adb_device_manager.network_scanner import network_scanner
from pyapps.matrix.adb_device_manager.usb_monitor import get_usb_monitor
from pycore.pyutils.device.scrcpy_server_manager import get_scrcpy_server_manager
from pycore.pyutils.device.connection_manager import get_connection_manager

# 直接使用
devices = device_manager.get_all_connected()
port = await port_pool.allocate(serial)
adb_devices = adb_executor.get_devices()
all_devices = device_table.get_all_devices()
found_ips = network_scanner.scan_network()

# 使用工厂函数
usb_monitor = get_usb_monitor()
server_mgr = get_scrcpy_server_manager(adb_path, jar_path)
conn_mgr = get_connection_manager(device_manager, port_pool, server_mgr, adb_path)
```

```python
# ❌ 错误的使用方式（已废弃）
device_manager = DeviceManager.instance()  # 不要用！
port_pool = PortPool.instance()  # 不要用！
adb_executor = ADBExecutor()  # 不要用！
```

## 状态

✅ **全部完成** - 所有核心单例已改造完成

所有文件已修复，可以正常启动Matrix服务。

---

**日期**: 2025-12-20
**原则**: 模块级别导出单例，禁止`.instance()`
**状态**: ✅ 完成
