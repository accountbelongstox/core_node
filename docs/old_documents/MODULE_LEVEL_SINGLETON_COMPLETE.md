# 模块级别单例改造完成 ✅

## 改造说明

**原来的问题**：使用 `instance()` 类方法实现单例，导致使用时需要记住调用 `.instance()`

**新的方案**：直接在模块级别创建唯一实例并导出，使用时直接import

## 改造后的使用方式

### ✅ 正确用法（新）

```python
# 直接导入全局实例
from pycore.pyutils.device_manager import device_manager
from pycore.pyutils.device.port_pool import port_pool
from pyapps.matrix.adb_device_manager.network_scanner import network_scanner
from pyapps.matrix.adb_device_manager.adb_executor import adb_executor
from pyapps.matrix.adb_device_manager.device_table import device_table
from pyapps.matrix.adb_device_manager.usb_monitor import usb_monitor

# 直接使用
devices = device_manager.get_all_connected()
port = await port_pool.allocate(serial)
found_ips = network_scanner.scan_network()
```

### ❌ 错误用法（旧）

```python
# 不再使用 instance() 方法
device_manager = DeviceManager.instance()  # ❌ 已废弃
port_pool = PortPool.instance()  # ❌ 已废弃
```

## 已改造的模块

### 1. DeviceManager
**文件**: `pycore/pyutils/device_manager.py`

```python
# 导出全局实例
from pycore.pyutils.device_manager import device_manager

# 使用
device = device_manager.get_device(serial)
devices = device_manager.get_all_connected()
```

### 2. PortPool
**文件**: `pycore/pyutils/device/port_pool.py`

```python
# 导出全局实例
from pycore.pyutils.device.port_pool import port_pool

# 使用
port = await port_pool.allocate(serial)
await port_pool.release(serial)
```

### 3. ScrcpyServerManager
**文件**: `pycore/pyutils/device/scrcpy_server_manager.py`

```python
# 使用工厂函数（需要配置参数）
from pycore.pyutils.device.scrcpy_server_manager import get_scrcpy_server_manager

server_manager = get_scrcpy_server_manager(adb_path, jar_path)
await server_manager.push_jar_to_device(serial)
```

### 4. ConnectionManager
**文件**: `pycore/pyutils/device/connection_manager.py`

```python
# 使用工厂函数（需要依赖注入）
from pycore.pyutils.device.connection_manager import get_connection_manager

conn_mgr = get_connection_manager(
    device_manager=device_manager,
    port_pool=port_pool,
    server_manager=server_manager,
    adb_path=adb_path
)
```

### 5. NetworkScanner
**文件**: `pyapps/matrix/adb_device_manager/network_scanner.py`

```python
# 导出全局实例
from pyapps.matrix.adb_device_manager.network_scanner import network_scanner

# 使用
found_ips = network_scanner.scan_network()
```

### 6. ADBExecutor
**文件**: `pyapps/matrix/adb_device_manager/adb_executor.py`

```python
# 导出全局实例
from pyapps.matrix.adb_device_manager.adb_executor import adb_executor

# 使用
devices = adb_executor.get_devices()
```

### 7. DeviceTable
**文件**: `pyapps/matrix/adb_device_manager/device_table.py`

```python
# 导出全局实例
from pyapps.matrix.adb_device_manager.device_table import device_table

# 使用
device_table.add_device(device_info)
all_devices = device_table.get_all_devices()
```

### 8. USBMonitor
**文件**: `pyapps/matrix/adb_device_manager/usb_monitor.py`

```python
# 导出全局实例
from pyapps.matrix.adb_device_manager.usb_monitor import usb_monitor

# 使用
results = usb_monitor.process_usb_devices()
```

## 已更新的使用位置

### VideoStreamService
**文件**: `pyapps/matrix/services/video_stream_service.py`

```python
# 修改前
self.device_manager = DeviceManager.instance()
self.port_pool = PortPool.instance()

# 修改后
from pycore.pyutils.device_manager import device_manager
from pycore.pyutils.device.port_pool import port_pool
self.device_manager = device_manager
self.port_pool = port_pool
```

### VideoStreamHealthService
**文件**: `pyapps/matrix/services/video_stream_health_service.py`

```python
# 修改前
self.device_manager = DeviceManager.instance()

# 修改后
from pycore.pyutils.device_manager import device_manager
self.device_manager = device_manager
```

### ADBHeartbeatService & ADBHeartbeatThread
**文件**:
- `pyapps/matrix/adb_device_manager/adb_heartbeat_service.py`
- `pyapps/matrix/adb_device_manager/adb_heartbeat_thread.py`

```python
# 修改前
self.network_scanner = NetworkScanner.instance()
self.adb = ADBExecutor.instance()
self.usb_monitor = USBMonitor.instance()
self.device_table = DeviceTable.instance()

# 修改后
from pyapps.matrix.adb_device_manager.network_scanner import network_scanner
from pyapps.matrix.adb_device_manager.adb_executor import adb_executor
from pyapps.matrix.adb_device_manager.usb_monitor import usb_monitor
from pyapps.matrix.adb_device_manager.device_table import device_table

self.network_scanner = network_scanner
self.adb = adb_executor
self.usb_monitor = usb_monitor
self.device_table = device_table
```

## 技术细节

### 模块级别单例原理

Python模块在第一次导入时会被加载并缓存，后续导入直接返回缓存的模块对象。因此：

```python
# module.py
class MyClass:
    def __init__(self):
        self.value = 0

# 模块级别创建实例（只执行一次）
my_instance = MyClass()

__all__ = ['MyClass', 'my_instance']
```

```python
# file1.py
from module import my_instance
my_instance.value = 10

# file2.py
from module import my_instance
print(my_instance.value)  # 输出: 10 （同一个实例）
```

### 优势

1. **更简单**：不需要记住调用 `.instance()`
2. **更直观**：`from module import instance` 直接明确
3. **更pythonic**：符合Python模块导入习惯
4. **无性能损耗**：模块导入时创建，无额外的线程锁检查
5. **线程安全**：Python的import机制天然线程安全

### 特殊情况处理

对于需要配置参数的类（如ScrcpyServerManager、ConnectionManager），使用工厂函数：

```python
# 模块级别
_instance = None

def get_instance(param1, param2):
    global _instance
    if _instance is None:
        _instance = MyClass(param1, param2)
    return _instance
```

## 重启服务

**重要**：修改完成后需要重启Matrix服务才能生效：

```bash
# 停止服务
Ctrl+C

# 重启服务
python pyapps/matrix/main.py
```

## 验证

重启后检查日志，应该看到：
```
[DeviceManager] 全局实例已创建
[NetworkScanner] Initialized with IP caching enabled
[PortPool] ...
```

所有设备应该正常连接，不再出现"Device not in global DeviceManager"错误。

---

**日期**: 2025-12-19
**改造原因**: 用户要求不要在类库里不停创建实例，总的只导出一个实例
**状态**: ✅ 完成
